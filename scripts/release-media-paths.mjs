import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  SCREENSHOT_FILENAMES,
  SCREENSHOT_OWNER,
  SCREENSHOT_OWNER_FILE,
  SCREENSHOT_RECEIPT_FILE,
} from "./screenshot-output.mjs";
import {
  assertReleaseIdentityRecord,
  assertReleaseIdentityText,
  loadReleaseIdentity,
} from "./release-identity.mjs";

export const RELEASE_MEDIA_FILES = Object.freeze({
  proofBoardSvg: "technical-proof-board.svg",
  proofBoardPng: "technical-proof-board.png",
  captions: "seeded-demo-rehearsal.srt",
  thumbnail: "youtube-thumbnail.png",
  badge: "seeded-demo-badge.png",
  closingCard: "closing-card.png",
});

export const RELEASE_MEDIA_RENDER_OUTPUTS = Object.freeze([
  RELEASE_MEDIA_FILES.proofBoardPng,
  RELEASE_MEDIA_FILES.thumbnail,
  RELEASE_MEDIA_FILES.badge,
  RELEASE_MEDIA_FILES.closingCard,
]);

export const RELEASE_MEDIA_RECEIPT_FILE = "release-media-receipt.json";

const SAFE_RELEASE_DIRECTORY = /^[a-z0-9][a-z0-9-]{1,79}$/;
const SAFE_OG_FILENAME = /^[a-z0-9][a-z0-9-]{1,79}-og\.png$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_SCREENSHOT_RECORD_BYTES = 128 * 1024;
const MAX_RELEASE_MEDIA_RECEIPT_BYTES = 256 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function portableRelativePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

function relativeParts(rawValue, variableName) {
  invariant(
    typeof rawValue === "string" &&
      rawValue.length > 0 &&
      rawValue === rawValue.trim() &&
      !rawValue.includes("\\") &&
      !path.posix.isAbsolute(rawValue),
    `${variableName} must be a repository-relative POSIX path.`,
  );
  const parts = rawValue.split("/");
  invariant(
    parts.every((part) => part.length > 0 && part !== "." && part !== ".."),
    `${variableName} must not contain empty or traversal segments.`,
  );
  return parts;
}

function configuredMediaParts(rawValue, releaseIdentity) {
  const parts = relativeParts(rawValue, "WONDERLAB_RELEASE_MEDIA_DIR");
  invariant(
    parts.length === 3 &&
      parts[0] === "docs" &&
      parts[1] === "media" &&
      SAFE_RELEASE_DIRECTORY.test(parts[2]),
    "WONDERLAB_RELEASE_MEDIA_DIR must name a lowercase release directory directly under docs/media.",
  );
  invariant(
    parts[2].startsWith(`${releaseIdentity.slug}-`),
    "WONDERLAB_RELEASE_MEDIA_DIR must begin with the canonical release slug followed by a hyphen.",
  );
  return parts;
}

function configuredScreenshotParts(rawValue, expectedReleaseDirectory) {
  const parts = relativeParts(rawValue, "WONDERLAB_RELEASE_SCREENSHOT");
  invariant(
    parts.length === 4 &&
      parts[0] === "docs" &&
      parts[1] === "screenshots" &&
      parts[2] === expectedReleaseDirectory &&
      parts[3] === "discovery-desktop.jpg",
    "WONDERLAB_RELEASE_SCREENSHOT must be discovery-desktop.jpg inside the matching versioned screenshot directory.",
  );
  return parts;
}

function configuredOgParts(rawValue, releaseIdentity) {
  const parts = relativeParts(rawValue, "WONDERLAB_PUBLIC_OG_OUTPUT");
  invariant(
    parts.length === 2 &&
      parts[0] === "public" &&
      SAFE_OG_FILENAME.test(parts[1]) &&
      parts[1] === `${releaseIdentity.slug}-og.png`,
    "WONDERLAB_PUBLIC_OG_OUTPUT must exactly match the canonical release slug at public/<slug>-og.png.",
  );
  return parts;
}

async function realDirectory(directoryPath, message) {
  let metadata;
  try {
    metadata = await fs.lstat(directoryPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(message);
    throw error;
  }
  invariant(!metadata.isSymbolicLink() && metadata.isDirectory(), message);
  return {
    metadata,
    realPath: await fs.realpath(directoryPath),
  };
}

async function realRegularFile(filePath, parentReal, message) {
  let metadata;
  try {
    metadata = await fs.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(message);
    throw error;
  }
  invariant(
    !metadata.isSymbolicLink() && metadata.isFile() && metadata.size > 0,
    message,
  );
  const realPath = await fs.realpath(filePath);
  invariant(isInside(parentReal, realPath), message);
  return filePath;
}

async function assertAbsent(filePath, message) {
  try {
    await fs.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

async function readScreenshotJson(filePath, parentReal, label) {
  await realRegularFile(
    filePath,
    parentReal,
    `${label} must be a non-empty regular file in the selected screenshot directory.`,
  );
  const metadata = await fs.lstat(filePath);
  invariant(
    metadata.size <= MAX_SCREENSHOT_RECORD_BYTES,
    `${label} exceeds the release-record size limit.`,
  );
  try {
    const content = await fs.readFile(filePath);
    return {
      content,
      value: JSON.parse(content.toString("utf8")),
    };
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

async function validateScreenshotEvidence({
  resolvedRoot,
  screenshotDir,
  screenshotDirReal,
  releaseDirectory,
  releaseIdentity,
}) {
  const relativeOutputPath = `docs/screenshots/${releaseDirectory}`;
  const ownerPath = path.join(screenshotDir, SCREENSHOT_OWNER_FILE);
  const receiptPath = path.join(screenshotDir, SCREENSHOT_RECEIPT_FILE);
  const [ownerRecord, receiptRecord] = await Promise.all([
    readScreenshotJson(ownerPath, screenshotDirReal, "Screenshot owner record"),
    readScreenshotJson(receiptPath, screenshotDirReal, "Screenshot receipt"),
  ]);
  const owner = ownerRecord.value;
  const receipt = receiptRecord.value;
  invariant(
    owner?.schemaVersion === 1 &&
      owner.owner === SCREENSHOT_OWNER &&
      FULL_SHA.test(owner.sourceSha) &&
      owner.outputDir === relativeOutputPath &&
      owner.releaseIdentity,
    "Screenshot owner record does not match the selected release directory.",
  );
  assertReleaseIdentityRecord(owner.releaseIdentity, releaseIdentity);
  invariant(
    receipt?.schemaVersion === 1 &&
      receipt.kind === "wonderlab-screenshot-receipt" &&
      receipt.source?.fullSha === owner.sourceSha &&
      receipt.source?.cleanBeforeCapture === true &&
      receipt.outputDir === relativeOutputPath &&
      receipt.releaseIdentity &&
      Array.isArray(receipt.screenshots) &&
      receipt.screenshots.length === SCREENSHOT_FILENAMES.length,
    "Screenshot receipt does not match its owner record and clean source binding.",
  );
  assertReleaseIdentityRecord(receipt.releaseIdentity, releaseIdentity);
  invariant(
    JSON.stringify(owner.releaseIdentity) ===
      JSON.stringify(receipt.releaseIdentity),
    "Screenshot owner and receipt release identities do not match.",
  );

  let releaseScreenshotRecord;
  for (const [index, filename] of SCREENSHOT_FILENAMES.entries()) {
    const record = receipt.screenshots[index];
    const expectedPath = `${relativeOutputPath}/${filename}`;
    invariant(
      record?.path === expectedPath &&
        Number.isSafeInteger(record.bytes) &&
        record.bytes > 0 &&
        SHA256.test(record.sha256),
      `Screenshot receipt entry ${filename} is invalid or out of order.`,
    );
    const filePath = path.join(screenshotDir, filename);
    await realRegularFile(
      filePath,
      screenshotDirReal,
      `Receipt-bound screenshot ${filename} must be a non-empty regular file.`,
    );
    const metadata = await fs.lstat(filePath);
    const content = await fs.readFile(filePath);
    invariant(
      metadata.size === record.bytes &&
        createHash("sha256").update(content).digest("hex") === record.sha256,
      `Receipt-bound screenshot ${filename} no longer matches its recorded bytes and hash.`,
    );
    if (filename === "discovery-desktop.jpg") {
      releaseScreenshotRecord = {
        path: record.path,
        bytes: record.bytes,
        sha256: record.sha256,
      };
    }
  }

  return {
    ownerPath: portableRelativePath(resolvedRoot, ownerPath),
    receiptPath: portableRelativePath(resolvedRoot, receiptPath),
    receiptSha256: createHash("sha256")
      .update(receiptRecord.content)
      .digest("hex"),
    releaseScreenshot: releaseScreenshotRecord,
    sourceSha: owner.sourceSha,
  };
}

async function resolvedMediaDirectory({
  root,
  configuredMediaDir,
  releaseIdentity,
}) {
  const mediaRoot = path.join(root, "docs", "media");
  const mediaRootRecord = await realDirectory(
    mediaRoot,
    "docs/media must be a real directory.",
  );
  if (configuredMediaDir === undefined) {
    return {
      mediaDir: mediaRoot,
      mediaReal: mediaRootRecord.realPath,
      releaseDirectory: undefined,
      identity: {
        dev: mediaRootRecord.metadata.dev,
        ino: mediaRootRecord.metadata.ino,
      },
    };
  }

  const parts = configuredMediaParts(configuredMediaDir, releaseIdentity);
  const mediaDir = path.join(root, ...parts);
  const mediaRecord = await realDirectory(
    mediaDir,
    "WONDERLAB_RELEASE_MEDIA_DIR must already exist as a real directory.",
  );
  invariant(
    isInside(mediaRootRecord.realPath, mediaRecord.realPath),
    "WONDERLAB_RELEASE_MEDIA_DIR resolves outside docs/media.",
  );
  return {
    mediaDir,
    mediaReal: mediaRecord.realPath,
    releaseDirectory: parts[2],
    identity: { dev: mediaRecord.metadata.dev, ino: mediaRecord.metadata.ino },
  };
}

async function requiredMediaFiles(binding, requiredFiles) {
  const paths = {};
  for (const filename of requiredFiles) {
    invariant(
      Object.values(RELEASE_MEDIA_FILES).includes(filename) &&
        path.basename(filename) === filename,
      "Release-media callers may require only known fixed filenames.",
    );
    const filePath = path.join(binding.mediaDir, filename);
    paths[filename] = await realRegularFile(
      filePath,
      binding.mediaReal,
      `Required release media ${filename} must be a non-empty regular file inside the selected media directory.`,
    );
  }
  return paths;
}

async function readReleaseMediaReceipt(filePath, parentReal) {
  await realRegularFile(
    filePath,
    parentReal,
    "Release media receipt must be a non-empty regular file in the selected media directory.",
  );
  const metadata = await fs.lstat(filePath);
  invariant(
    metadata.size <= MAX_RELEASE_MEDIA_RECEIPT_BYTES,
    "Release media receipt exceeds the size limit.",
  );
  const content = await fs.readFile(filePath);
  try {
    return { content, value: JSON.parse(content.toString("utf8")) };
  } catch {
    throw new Error("Release media receipt must contain valid JSON.");
  }
}

async function assertRecordedFile({
  filePath,
  parentReal,
  record,
  expectedPath,
  label,
}) {
  invariant(
    record?.path === expectedPath &&
      Number.isSafeInteger(record.bytes) &&
      record.bytes > 0 &&
      SHA256.test(record.sha256),
    `${label} receipt record is invalid.`,
  );
  await realRegularFile(
    filePath,
    parentReal,
    `${label} must be a non-empty regular file.`,
  );
  const [metadata, content] = await Promise.all([
    fs.lstat(filePath),
    fs.readFile(filePath),
  ]);
  invariant(
    metadata.size === record.bytes &&
      createHash("sha256").update(content).digest("hex") === record.sha256,
    `${label} no longer matches its release media receipt.`,
  );
  return content;
}

async function validateReleaseMediaReceipt({
  resolvedRoot,
  binding,
  releaseIdentity,
}) {
  invariant(
    binding.releaseDirectory,
    "A current release media receipt requires a versioned release directory.",
  );
  const receiptPath = path.join(binding.mediaDir, RELEASE_MEDIA_RECEIPT_FILE);
  const receiptRecord = await readReleaseMediaReceipt(
    receiptPath,
    binding.mediaReal,
  );
  const receipt = receiptRecord.value;
  invariant(
    receipt?.schemaVersion === 1 &&
      receipt.kind === "wonderlab-release-media-receipt" &&
      receipt.releaseDirectory === binding.releaseDirectory &&
      receipt.releaseIdentity &&
      Array.isArray(receipt.mediaFiles) &&
      receipt.mediaFiles.length === Object.values(RELEASE_MEDIA_FILES).length,
    "Release media receipt does not match the selected release directory.",
  );
  assertReleaseIdentityRecord(receipt.releaseIdentity, releaseIdentity);

  const screenshotsRoot = path.join(resolvedRoot, "docs", "screenshots");
  const screenshotsRootRecord = await realDirectory(
    screenshotsRoot,
    "docs/screenshots must be a real directory.",
  );
  const screenshotDir = path.join(screenshotsRoot, binding.releaseDirectory);
  const screenshotDirRecord = await realDirectory(
    screenshotDir,
    "The receipt-bound screenshot directory must be a real directory.",
  );
  invariant(
    isInside(screenshotsRootRecord.realPath, screenshotDirRecord.realPath),
    "The receipt-bound screenshot directory resolves outside docs/screenshots.",
  );
  const screenshotEvidence = await validateScreenshotEvidence({
    resolvedRoot,
    screenshotDir,
    screenshotDirReal: screenshotDirRecord.realPath,
    releaseDirectory: binding.releaseDirectory,
    releaseIdentity,
  });
  invariant(
    JSON.stringify(receipt.screenshotEvidence) ===
      JSON.stringify(screenshotEvidence),
    "Release media receipt does not match the source-bound screenshot evidence.",
  );

  const mediaContents = {};
  for (const [index, filename] of Object.values(
    RELEASE_MEDIA_FILES,
  ).entries()) {
    const record = receipt.mediaFiles[index];
    invariant(
      record?.filename === filename,
      "Release media receipt files are missing or out of order.",
    );
    mediaContents[filename] = await assertRecordedFile({
      filePath: path.join(binding.mediaDir, filename),
      parentReal: binding.mediaReal,
      record,
      expectedPath: `${binding.relativeMediaDir}/${filename}`,
      label: `Receipt-bound release media ${filename}`,
    });
  }
  for (const filename of [
    RELEASE_MEDIA_FILES.proofBoardSvg,
    RELEASE_MEDIA_FILES.captions,
  ]) {
    assertReleaseIdentityText({
      content: mediaContents[filename].toString("utf8"),
      label: `Receipt-bound release media ${filename}`,
      identity: releaseIdentity,
    });
  }

  const publicRoot = path.join(resolvedRoot, "public");
  const publicRootRecord = await realDirectory(
    publicRoot,
    "public must be a real directory.",
  );
  const relativePublicOgOutput = `public/${releaseIdentity.slug}-og.png`;
  const publicOgOutput = path.join(
    resolvedRoot,
    ...relativePublicOgOutput.split("/"),
  );
  await assertRecordedFile({
    filePath: publicOgOutput,
    parentReal: publicRootRecord.realPath,
    record: receipt.publicOg,
    expectedPath: relativePublicOgOutput,
    label: "Receipt-bound public social image",
  });

  return {
    path: receiptPath,
    relativePath: portableRelativePath(resolvedRoot, receiptPath),
    sha256: createHash("sha256").update(receiptRecord.content).digest("hex"),
    value: receipt,
    screenshotEvidence,
    publicOgOutput,
    relativePublicOgOutput,
  };
}

export async function assertReleaseMediaDirectoryIdentity(binding) {
  const metadata = await fs.lstat(binding.mediaDir);
  invariant(
    !metadata.isSymbolicLink() &&
      metadata.isDirectory() &&
      metadata.dev === binding.identity.dev &&
      metadata.ino === binding.identity.ino,
    "The selected release-media directory changed during the operation.",
  );
  invariant(
    (await fs.realpath(binding.mediaDir)) === binding.mediaReal,
    "The selected release-media directory no longer resolves to its original location.",
  );
  for (const anchor of binding.directoryAnchors ?? []) {
    const anchorMetadata = await fs.lstat(anchor.path);
    invariant(
      !anchorMetadata.isSymbolicLink() &&
        anchorMetadata.isDirectory() &&
        anchorMetadata.dev === anchor.dev &&
        anchorMetadata.ino === anchor.ino &&
        (await fs.realpath(anchor.path)) === anchor.realPath,
      anchor.message,
    );
  }
}

export function assertReleaseMediaInputsMatchReceipt({
  binding,
  inputs,
  filenames,
}) {
  const receipt = binding?.releaseMediaReceipt?.value;
  invariant(
    receipt && Array.isArray(receipt.mediaFiles),
    "Receipt-bound release media inputs require a validated release media receipt.",
  );
  invariant(
    Array.isArray(filenames) &&
      filenames.length > 0 &&
      new Set(filenames).size === filenames.length &&
      filenames.every((filename) =>
        Object.values(RELEASE_MEDIA_FILES).includes(filename),
      ),
    "Receipt-bound release media inputs require distinct known filenames.",
  );

  const orderedFilenames = Object.values(RELEASE_MEDIA_FILES);
  for (const filename of filenames) {
    const record = receipt.mediaFiles[orderedFilenames.indexOf(filename)];
    const input = inputs?.[filename];
    invariant(
      record?.filename === filename &&
        record.path === `${binding.relativeMediaDir}/${filename}` &&
        Number.isSafeInteger(record.bytes) &&
        SHA256.test(record.sha256) &&
        Buffer.isBuffer(input?.content) &&
        input.bytes === record.bytes &&
        input.content.length === record.bytes &&
        createHash("sha256").update(input.content).digest("hex") ===
          record.sha256,
      `Anchored release media ${filename} does not match its validated release media receipt.`,
    );
  }
  return inputs;
}

export async function resolveReleaseMediaPaths({
  root,
  environment,
  mode,
  requiredFiles = [],
  requireCurrentRelease = false,
}) {
  const resolvedRoot = path.resolve(root);
  invariant(
    mode === "render" || mode === "media-read",
    "Release-media path mode must be render or media-read.",
  );
  invariant(
    typeof requireCurrentRelease === "boolean",
    "requireCurrentRelease must be a boolean.",
  );
  const releaseIdentity = await loadReleaseIdentity({ root: resolvedRoot });
  const configuredMediaDir = environment.WONDERLAB_RELEASE_MEDIA_DIR;
  const configuredScreenshot = environment.WONDERLAB_RELEASE_SCREENSHOT;
  const configuredOgOutput = environment.WONDERLAB_PUBLIC_OG_OUTPUT;

  if (mode === "render") {
    invariant(
      configuredMediaDir !== undefined &&
        configuredScreenshot !== undefined &&
        configuredOgOutput !== undefined,
      "Release rendering requires WONDERLAB_RELEASE_MEDIA_DIR, WONDERLAB_RELEASE_SCREENSHOT, and WONDERLAB_PUBLIC_OG_OUTPUT together.",
    );
  } else {
    invariant(
      configuredMediaDir !== undefined ||
        (configuredScreenshot === undefined &&
          configuredOgOutput === undefined),
      "Release-media overrides require WONDERLAB_RELEASE_MEDIA_DIR.",
    );
    invariant(
      !requireCurrentRelease || configuredMediaDir !== undefined,
      "Current narration and final assembly require WONDERLAB_RELEASE_MEDIA_DIR for a receipt-bound versioned release.",
    );
  }

  const binding = await resolvedMediaDirectory({
    root: resolvedRoot,
    configuredMediaDir,
    releaseIdentity,
  });
  binding.releaseIdentity = releaseIdentity;
  binding.relativeMediaDir = portableRelativePath(
    resolvedRoot,
    binding.mediaDir,
  );

  if (mode === "media-read") {
    if (binding.releaseDirectory) {
      binding.releaseMediaReceipt = await validateReleaseMediaReceipt({
        resolvedRoot,
        binding,
        releaseIdentity,
      });
      binding.screenshotEvidence =
        binding.releaseMediaReceipt.screenshotEvidence;
      binding.publicOgOutput = binding.releaseMediaReceipt.publicOgOutput;
      binding.relativePublicOgOutput =
        binding.releaseMediaReceipt.relativePublicOgOutput;
    } else {
      invariant(
        !requireCurrentRelease,
        "Current narration and final assembly cannot use the historical docs/media root.",
      );
    }
    binding.files = await requiredMediaFiles(binding, requiredFiles);
    await assertReleaseMediaDirectoryIdentity(binding);
    return binding;
  }

  binding.files = await requiredMediaFiles(binding, requiredFiles);

  invariant(
    binding.releaseDirectory,
    "Release rendering cannot target the historical docs/media directory.",
  );
  const screenshotParts = configuredScreenshotParts(
    configuredScreenshot,
    binding.releaseDirectory,
  );
  const screenshotsRoot = path.join(resolvedRoot, "docs", "screenshots");
  const screenshotsRootRecord = await realDirectory(
    screenshotsRoot,
    "docs/screenshots must be a real directory.",
  );
  const screenshotDir = path.join(
    resolvedRoot,
    ...screenshotParts.slice(0, -1),
  );
  const screenshotDirRecord = await realDirectory(
    screenshotDir,
    "The selected versioned screenshot directory must be a real directory.",
  );
  invariant(
    isInside(screenshotsRootRecord.realPath, screenshotDirRecord.realPath),
    "WONDERLAB_RELEASE_SCREENSHOT resolves outside docs/screenshots.",
  );
  const releaseScreenshot = await realRegularFile(
    path.join(resolvedRoot, ...screenshotParts),
    screenshotDirRecord.realPath,
    "WONDERLAB_RELEASE_SCREENSHOT must be a non-empty regular file in the matching versioned screenshot directory.",
  );
  const screenshotEvidence = await validateScreenshotEvidence({
    resolvedRoot,
    screenshotDir,
    screenshotDirReal: screenshotDirRecord.realPath,
    releaseDirectory: binding.releaseDirectory,
    releaseIdentity,
  });

  const publicRoot = path.join(resolvedRoot, "public");
  const publicRootRecord = await realDirectory(
    publicRoot,
    "public must be a real directory.",
  );
  const ogParts = configuredOgParts(configuredOgOutput, releaseIdentity);
  const publicOgOutput = path.join(resolvedRoot, ...ogParts);
  invariant(
    path.dirname(publicOgOutput) === publicRoot &&
      (await fs.realpath(path.dirname(publicOgOutput))) ===
        publicRootRecord.realPath,
    "WONDERLAB_PUBLIC_OG_OUTPUT must stay directly inside public.",
  );

  for (const filename of RELEASE_MEDIA_RENDER_OUTPUTS) {
    await assertAbsent(
      path.join(binding.mediaDir, filename),
      `Release media output ${filename} already exists; choose a fresh release directory.`,
    );
  }
  await assertAbsent(
    path.join(binding.mediaDir, RELEASE_MEDIA_RECEIPT_FILE),
    `Release media output ${RELEASE_MEDIA_RECEIPT_FILE} already exists; choose a fresh release directory.`,
  );
  await assertAbsent(
    publicOgOutput,
    "WONDERLAB_PUBLIC_OG_OUTPUT already exists; choose a fresh public social-image path.",
  );

  binding.releaseScreenshot = releaseScreenshot;
  binding.screenshotEvidence = screenshotEvidence;
  binding.publicOgOutput = publicOgOutput;
  binding.relativePublicOgOutput = portableRelativePath(
    resolvedRoot,
    publicOgOutput,
  );
  binding.releaseMediaReceiptPath = path.join(
    binding.mediaDir,
    RELEASE_MEDIA_RECEIPT_FILE,
  );
  binding.screenshotDirectoryAnchor = {
    path: screenshotDir,
    realPath: screenshotDirRecord.realPath,
    dev: screenshotDirRecord.metadata.dev,
    ino: screenshotDirRecord.metadata.ino,
    message:
      "The selected screenshot directory changed during release rendering.",
  };
  binding.publicDirectoryAnchor = {
    path: publicRoot,
    realPath: publicRootRecord.realPath,
    dev: publicRootRecord.metadata.dev,
    ino: publicRootRecord.metadata.ino,
    message: "The public output directory changed during release rendering.",
  };
  binding.directoryAnchors = [
    binding.screenshotDirectoryAnchor,
    binding.publicDirectoryAnchor,
  ];
  await assertReleaseMediaDirectoryIdentity(binding);
  return binding;
}
