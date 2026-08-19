import { inflateSync } from "node:zlib";

export const DEMO_FINAL_SECONDS = 174;

// Keep this module built-in-only: the credentialed narrator imports it after
// Keychain injection, before the clean-source boundary can authorize provider use.
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function pngCrc32(content) {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodedRgbaPngMetadata(content, expectedWidth, expectedHeight) {
  invariant(
    Buffer.isBuffer(content) &&
      content.length >= 45 &&
      content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    "Invalid PNG signature.",
  );

  let offset = PNG_SIGNATURE.length;
  let width;
  let height;
  let sawHeader = false;
  let sawImageData = false;
  let sawImageEnd = false;
  let imageDataEnded = false;
  const compressedParts = [];

  while (offset < content.length) {
    invariant(
      !sawImageEnd && offset + 12 <= content.length,
      "Invalid PNG chunk boundary.",
    );
    const chunkLength = content.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + 4;
    invariant(chunkEnd <= content.length, "Truncated PNG chunk.");

    const typeBytes = content.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");
    const data = content.subarray(dataStart, dataEnd);
    invariant(
      pngCrc32(Buffer.concat([typeBytes, data])) ===
        content.readUInt32BE(dataEnd),
      "Invalid PNG chunk checksum.",
    );

    if (!sawHeader) {
      invariant(type === "IHDR", "PNG must begin with IHDR.");
    }
    if (type === "IHDR") {
      invariant(!sawHeader && chunkLength === 13, "Invalid PNG header.");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      invariant(
        width > 0 &&
          height > 0 &&
          width === expectedWidth &&
          height === expectedHeight &&
          data[8] === 8 &&
          data[9] === 6 &&
          data[10] === 0 &&
          data[11] === 0 &&
          data[12] === 0,
        "PNG must be non-interlaced 8-bit RGBA.",
      );
      sawHeader = true;
    } else if (type === "IDAT") {
      invariant(
        sawHeader && !imageDataEnded && chunkLength > 0,
        "Invalid PNG image-data sequence.",
      );
      sawImageData = true;
      compressedParts.push(data);
    } else if (type === "IEND") {
      invariant(
        sawHeader && sawImageData && chunkLength === 0,
        "Invalid PNG image end.",
      );
      sawImageEnd = true;
    } else {
      if (sawImageData) imageDataEnded = true;
      invariant(
        (typeBytes[0] & 0x20) !== 0,
        `Unsupported critical PNG chunk ${type}.`,
      );
    }

    offset = chunkEnd;
  }

  invariant(
    sawHeader && sawImageData && sawImageEnd && offset === content.length,
    "Incomplete PNG image.",
  );
  const expectedDecodedBytes = height * (1 + width * 4);
  invariant(
    Number.isSafeInteger(expectedDecodedBytes),
    "PNG dimensions are too large.",
  );
  const decoded = inflateSync(Buffer.concat(compressedParts), {
    maxOutputLength: expectedDecodedBytes,
  });
  invariant(
    decoded.length === expectedDecodedBytes,
    "PNG decoded data has the wrong length.",
  );
  const rowBytes = 1 + width * 4;
  for (let row = 0; row < height; row += 1) {
    invariant(
      decoded[row * rowBytes] <= 4,
      `PNG row ${row + 1} has an invalid filter.`,
    );
  }

  return {
    format: "png",
    width,
    height,
    channels: 4,
    bitDepth: 8,
    interlaced: false,
  };
}

function timestampSeconds(value) {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value);
  if (!match) throw new Error(`Invalid SRT timestamp: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  if (minutes > 59 || seconds > 59) {
    throw new Error(`Invalid SRT timestamp: ${value}`);
  }
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function parseDemoSrt(value) {
  invariant(typeof value === "string", "Release captions must be UTF-8 text.");
  return value
    .replaceAll("\r\n", "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((block, blockIndex) => {
      const [rawIndex, timing, ...textLines] = block.split("\n");
      invariant(
        rawIndex && timing && textLines.length > 0,
        `Malformed SRT cue ${blockIndex + 1}.`,
      );
      invariant(
        /^[1-9]\d*$/.test(rawIndex) && Number.isSafeInteger(Number(rawIndex)),
        `Malformed SRT index in cue ${blockIndex + 1}.`,
      );
      const timingParts = timing.split(" --> ");
      invariant(
        timingParts.length === 2,
        `Malformed SRT timing in cue ${blockIndex + 1}.`,
      );
      return {
        index: Number(rawIndex),
        start: timestampSeconds(timingParts[0]),
        end: timestampSeconds(timingParts[1]),
        lines: textLines,
        text: textLines.join(" ").replace(/\s+/g, " ").trim(),
      };
    });
}

export function validateDemoCues(
  cues,
  { finalSeconds = DEMO_FINAL_SECONDS } = {},
) {
  invariant(cues.length >= 20, "Captions must use at least 20 readable cues.");
  invariant(cues[0]?.start === 0, "The first caption cue must start at 0.");

  let maximumLineLength = 0;
  let maximumWordsPerMinute = 0;
  for (const [cueIndex, cue] of cues.entries()) {
    invariant(
      cue.index === cueIndex + 1,
      `Caption indices must be sequential; expected ${cueIndex + 1}.`,
    );
    invariant(cue.text.length > 0, `Caption cue ${cue.index} is empty.`);
    invariant(
      cue.lines.length <= 2,
      `Caption cue ${cue.index} exceeds two lines.`,
    );
    for (const line of cue.lines) {
      maximumLineLength = Math.max(maximumLineLength, line.length);
      invariant(
        line.length <= 42,
        `Caption cue ${cue.index} has a line longer than 42 characters.`,
      );
    }

    const duration = cue.end - cue.start;
    invariant(duration > 0, `Caption cue ${cue.index} has no duration.`);
    invariant(
      duration >= 1.5 && duration <= 7,
      `Caption cue ${cue.index} must last between 1.5 and 7 seconds.`,
    );
    const wordCount = cue.text.split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = (wordCount / duration) * 60;
    maximumWordsPerMinute = Math.max(maximumWordsPerMinute, wordsPerMinute);
    invariant(
      wordsPerMinute <= 185,
      `Caption cue ${cue.index} exceeds 185 words per minute.`,
    );

    if (cueIndex > 0) {
      const gap = cue.start - cues[cueIndex - 1].end;
      invariant(
        Math.abs(gap) <= 0.001,
        `Caption cues ${cue.index - 1} and ${cue.index} are not contiguous.`,
      );
    }
  }

  invariant(
    Math.abs(cues.at(-1).end - finalSeconds) <= 0.001,
    `Captions must end at ${finalSeconds} seconds.`,
  );
  return { maximumLineLength, maximumWordsPerMinute };
}

export async function assertDemoImageDimensions({
  content,
  width,
  height,
  label,
}) {
  try {
    return decodedRgbaPngMetadata(content, width, height);
  } catch {
    throw new Error(`The ${label} must be a ${width}x${height} PNG.`);
  }
}

export async function validateDemoReleaseInputs({
  captions,
  proofBoard,
  closingCard,
}) {
  const cues = parseDemoSrt(captions.toString("utf8"));
  const captionMetrics = validateDemoCues(cues);
  await Promise.all([
    assertDemoImageDimensions({
      content: proofBoard,
      width: 1600,
      height: 900,
      label: "proof board",
    }),
    assertDemoImageDimensions({
      content: closingCard,
      width: 1280,
      height: 720,
      label: "closing card",
    }),
  ]);
  return { cues, captionMetrics };
}
