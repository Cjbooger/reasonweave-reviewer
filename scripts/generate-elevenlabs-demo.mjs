import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCleanCredentialSourceStatus,
  loadCaptureBinding,
  safeProviderFailureClassification,
  USER_SELECTED_TTS_ONLY_MODE,
  validatedVoiceId,
  verifyApprovedVoiceForGeneration,
} from "./elevenlabs-voice-catalog.mjs";
import { readAnchoredFiles } from "./anchored-directory-ops.mjs";
import { validateDemoReleaseInputs } from "./demo-release-contract.mjs";
import {
  assertReleaseMediaInputsMatchReceipt,
  RELEASE_MEDIA_FILES,
  resolveReleaseMediaPaths,
} from "./release-media-paths.mjs";
import {
  assertReleaseIdentityRecord,
  releaseIdentityRecord,
} from "./release-identity.mjs";
import {
  loadReleaseNarration,
  releaseNarrationRecord,
} from "./release-narration.mjs";

const root = process.cwd();
const requireCurrentRelease =
  process.argv.includes("--generate") ||
  process.argv.includes("--credentialed-request");
const releaseMediaBinding = await resolveReleaseMediaPaths({
  root,
  environment: process.env,
  mode: "media-read",
  requiredFiles: [
    RELEASE_MEDIA_FILES.captions,
    RELEASE_MEDIA_FILES.proofBoardPng,
    RELEASE_MEDIA_FILES.closingCard,
  ],
  requireCurrentRelease,
});
const allowedOutputRoot = path.resolve(root, "output", "playwright");
const outputDir = path.resolve(
  root,
  process.env.WONDERLAB_CAPTURE_OUTPUT ?? "output/playwright/wonderlab-demo",
);
const releaseMediaDirectoryAnchor = {
  path: releaseMediaBinding.mediaDir,
  realPath: releaseMediaBinding.mediaReal,
  dev: releaseMediaBinding.identity.dev,
  ino: releaseMediaBinding.identity.ino,
  message:
    "The selected release-media directory changed before narration input capture.",
};
const releaseMediaInputs = await readAnchoredFiles({
  anchor: releaseMediaDirectoryAnchor,
  filenames: [
    RELEASE_MEDIA_FILES.captions,
    RELEASE_MEDIA_FILES.proofBoardPng,
    RELEASE_MEDIA_FILES.closingCard,
  ],
});
if (releaseMediaBinding.releaseMediaReceipt) {
  assertReleaseMediaInputsMatchReceipt({
    binding: releaseMediaBinding,
    inputs: releaseMediaInputs,
    filenames: [
      RELEASE_MEDIA_FILES.captions,
      RELEASE_MEDIA_FILES.proofBoardPng,
      RELEASE_MEDIA_FILES.closingCard,
    ],
  });
}
const captionsContent =
  releaseMediaInputs[RELEASE_MEDIA_FILES.captions].content;
const proofBoardContent =
  releaseMediaInputs[RELEASE_MEDIA_FILES.proofBoardPng].content;
const closingCardContent =
  releaseMediaInputs[RELEASE_MEDIA_FILES.closingCard].content;
const { cues } = await validateDemoReleaseInputs({
  captions: captionsContent,
  proofBoard: proofBoardContent,
  closingCard: closingCardContent,
});
const scriptPath = fileURLToPath(import.meta.url);
const withAiKeysPath = path.join(
  process.env.HOME ?? "",
  ".local",
  "bin",
  "with-ai-keys",
);
const modelId = "eleven_multilingual_v2";
const outputFormat = "mp3_44100_128";

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

async function assertNotSymlinkIfPresent(filePath) {
  try {
    const metadata = await fs.lstat(filePath);
    invariant(
      !metadata.isSymbolicLink(),
      `${filePath} must not be a symbolic link.`,
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function assertStableNarrationDirectory(identity) {
  const anchored = await fs.stat(identity.operationRoot);
  invariant(
    anchored.isDirectory() &&
      anchored.dev === identity.dev &&
      anchored.ino === identity.ino,
    "The anchored ElevenLabs narration directory changed during generation.",
  );
}

async function assertPublicDirectoryIdentity(filePath, identity, message) {
  let metadata;
  try {
    metadata = await fs.lstat(filePath);
  } catch {
    throw new Error(message);
  }
  invariant(
    !metadata.isSymbolicLink() &&
      metadata.isDirectory() &&
      metadata.dev === identity.dev &&
      metadata.ino === identity.ino,
    message,
  );
}

async function assertPublicCaptureContinuity({
  publicOutputPath,
  outputIdentity,
  publicNarrationPath,
  narrationIdentity,
}) {
  await assertPublicDirectoryIdentity(
    publicOutputPath,
    outputIdentity,
    "The public capture output changed during narration generation.",
  );
  await assertPublicDirectoryIdentity(
    publicNarrationPath,
    narrationIdentity,
    "The public ElevenLabs narration directory changed during generation.",
  );
}

async function writeExclusiveNoFollow(filePath, content, mode = 0o600) {
  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await fs.open(filePath, flags, mode);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertExactReusableNarrationText({
  narrationIdentity,
  textPath,
  expectedContent,
}) {
  await assertStableNarrationDirectory(narrationIdentity);
  const pathMetadata = await fs.lstat(textPath);
  invariant(
    !pathMetadata.isSymbolicLink() && pathMetadata.isFile(),
    `${textPath} must be an anchored regular file before it can be reused.`,
  );
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await fs.open(textPath, flags);
  try {
    const openedMetadata = await handle.stat();
    invariant(
      openedMetadata.isFile() &&
        openedMetadata.dev === pathMetadata.dev &&
        openedMetadata.ino === pathMetadata.ino &&
        openedMetadata.size === pathMetadata.size,
      `${textPath} changed while it was opened for exact reuse.`,
    );
    const existingContent = await handle.readFile();
    invariant(
      existingContent.length === openedMetadata.size &&
        existingContent.equals(expectedContent),
      `${textPath} already exists with different content. Resolve and archive the prior narration text before generating again.`,
    );
    const currentPathMetadata = await fs.lstat(textPath);
    invariant(
      !currentPathMetadata.isSymbolicLink() &&
        currentPathMetadata.isFile() &&
        currentPathMetadata.dev === openedMetadata.dev &&
        currentPathMetadata.ino === openedMetadata.ino &&
        currentPathMetadata.size === openedMetadata.size,
      `${textPath} changed while it was validated for exact reuse.`,
    );
  } finally {
    await handle.close();
  }
  await assertStableNarrationDirectory(narrationIdentity);
}

async function writeAtomicNarrationText({
  narrationIdentity,
  textPath,
  content,
}) {
  const contentBytes = Buffer.isBuffer(content)
    ? content
    : Buffer.from(content, "utf8");
  const temporaryPath = path.join(
    narrationIdentity.operationRoot,
    `.narration-text-${process.pid}-${Date.now()}-${randomUUID()}.tmp`,
  );
  try {
    await assertStableNarrationDirectory(narrationIdentity);
    await writeExclusiveNoFollow(temporaryPath, contentBytes);
    await assertStableNarrationDirectory(narrationIdentity);
    try {
      // link(2) atomically publishes the complete temp file and never replaces
      // an existing narration.txt, including one created by a concurrent run.
      await fs.link(temporaryPath, textPath);
    } catch (error) {
      if (error?.code === "EEXIST") {
        await assertExactReusableNarrationText({
          narrationIdentity,
          textPath,
          expectedContent: contentBytes,
        });
      } else {
        throw error;
      }
    }
    await assertStableNarrationDirectory(narrationIdentity);
  } finally {
    await fs.unlink(temporaryPath).catch(() => {});
  }
}

function parseArguments(args) {
  const options = { generate: false, credentialedRequest: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--generate") {
      options.generate = true;
      continue;
    }
    if (argument === "--credentialed-request") {
      options.credentialedRequest = true;
      continue;
    }
    if (argument === "--voice-id") {
      const value = args[index + 1];
      invariant(
        value && !value.startsWith("--"),
        "--voice-id requires a value.",
      );
      options.voiceId = validatedVoiceId(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: npm run demo:narrate -- [--voice-id <voice-id>] [--generate]\nVoice defaults to config/release-narration.json; an explicit ID must match that canonical config.",
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  invariant(
    !(options.generate && options.credentialedRequest),
    "--generate and --credentialed-request cannot be combined.",
  );
  return options;
}

function gitOutput(args, { input } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
  });
  invariant(result.status === 0, "Unable to verify the release checkout.");
  return result.stdout.trim();
}

function committedFileSha256(sourcePath) {
  const result = spawnSync("git", ["show", `HEAD:${sourcePath}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 512 * 1024,
  });
  invariant(
    result.status === 0 && Buffer.isBuffer(result.stdout),
    `Unable to read committed credential-bound source ${sourcePath}.`,
  );
  return sha256(result.stdout);
}

function assertCredentialBoundary(capturedReleaseMedia) {
  const committedMedia = [
    RELEASE_MEDIA_FILES.captions,
    RELEASE_MEDIA_FILES.proofBoardPng,
    RELEASE_MEDIA_FILES.closingCard,
  ].map((filename) => ({
    content: capturedReleaseMedia?.[filename]?.content,
    filename,
    sourcePath: path.relative(root, releaseMediaBinding.files[filename]),
  }));
  for (const media of committedMedia) {
    invariant(
      Buffer.isBuffer(media.content) && media.content.length > 0,
      `Captured release media ${media.filename} is unavailable for credential validation.`,
    );
  }
  invariant(
    path.resolve(gitOutput(["rev-parse", "--show-toplevel"])) === root,
    `Run demo narration from the ${releaseMediaBinding.releaseIdentity.displayName} repository root.`,
  );
  assertCleanCredentialSourceStatus(
    gitOutput(["status", "--porcelain=v1", "--untracked-files=all"]),
  );
  for (const sourcePath of [
    path.relative(root, scriptPath),
    "scripts/elevenlabs-voice-catalog.mjs",
    "scripts/release-media-paths.mjs",
    "scripts/demo-release-contract.mjs",
    "scripts/screenshot-output.mjs",
    "scripts/anchored-directory-ops.mjs",
    "scripts/release-identity.mjs",
    "scripts/release-narration.mjs",
    releaseMediaBinding.releaseIdentity.record.path,
    releaseNarration.record.path,
    ...(releaseMediaBinding.releaseMediaReceipt
      ? [releaseMediaBinding.releaseMediaReceipt.relativePath]
      : []),
    ...committedMedia.map((media) => media.sourcePath),
  ]) {
    gitOutput(["ls-files", "--error-unmatch", "--", sourcePath]);
  }
  for (const media of committedMedia) {
    invariant(
      gitOutput(["hash-object", "--stdin"], { input: media.content }) ===
        gitOutput(["rev-parse", `HEAD:${media.sourcePath}`]),
      `Captured release media ${media.filename} does not match the committed credential boundary.`,
    );
  }
  for (const [sourcePath, expectedSha256] of [
    [
      releaseMediaBinding.releaseIdentity.record.path,
      releaseMediaBinding.releaseIdentity.record.sha256,
    ],
    [releaseNarration.record.path, releaseNarration.record.sha256],
    ...(releaseMediaBinding.releaseMediaReceipt
      ? [
          [
            releaseMediaBinding.releaseMediaReceipt.relativePath,
            releaseMediaBinding.releaseMediaReceipt.sha256,
          ],
        ]
      : []),
  ]) {
    invariant(
      committedFileSha256(sourcePath) === expectedSha256,
      `${sourcePath} does not match the committed credential boundary.`,
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizedProbeEnvironment() {
  return { PATH: process.env.PATH ?? "" };
}

function assertFfprobeAvailable() {
  const result = spawnSync("ffprobe", ["-version"], {
    encoding: "utf8",
    env: sanitizedProbeEnvironment(),
    maxBuffer: 64 * 1024,
    timeout: 15_000,
  });
  invariant(
    !result.error && result.status === 0 && !result.signal,
    "ffprobe is required to validate ElevenLabs MP3 narration before a paid request.",
  );
}

function credentialBoundFetch(assertCurrentProviderBoundary) {
  invariant(
    typeof globalThis.fetch === "function",
    "A fetch implementation is required.",
  );
  const assertBoundary = async () => {
    try {
      await assertCurrentProviderBoundary();
    } catch (error) {
      if (error && typeof error === "object") {
        error.wonderlabCredentialBoundaryFailure = true;
      }
      throw error;
    }
  };
  return async (...arguments_) => {
    await assertBoundary();
    try {
      return await globalThis.fetch(...arguments_);
    } finally {
      await assertBoundary();
    }
  };
}

async function assertDecodableMp3({ audio, narrationIdentity }) {
  invariant(
    Buffer.isBuffer(audio) &&
      audio.length > 3 &&
      audio.length <= 32 * 1024 * 1024,
    "ElevenLabs returned an invalid audio payload.",
  );
  const temporaryAudio = path.join(
    narrationIdentity.operationRoot,
    `.narration-decode-${process.pid}-${Date.now()}-${randomUUID()}.tmp.mp3`,
  );
  try {
    await assertStableNarrationDirectory(narrationIdentity);
    await writeExclusiveNoFollow(temporaryAudio, audio);
    await assertStableNarrationDirectory(narrationIdentity);
    const result = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type:format=duration",
        "-of",
        "json",
        temporaryAudio,
      ],
      {
        encoding: "utf8",
        env: sanitizedProbeEnvironment(),
        maxBuffer: 64 * 1024,
        timeout: 15_000,
      },
    );
    invariant(
      !result.error && result.status === 0 && !result.signal,
      "ElevenLabs returned audio that ffprobe could not decode as MP3.",
    );
    const probe = JSON.parse(result.stdout);
    invariant(
      probe?.streams?.some(
        (stream) =>
          stream?.codec_type === "audio" && stream?.codec_name === "mp3",
      ) && Number(probe?.format?.duration) > 0,
      "ElevenLabs returned audio that is not a decodable MP3 stream.",
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "ElevenLabs returned audio that is not a decodable MP3 stream.",
      );
    }
    throw error;
  } finally {
    await fs.unlink(temporaryAudio).catch(() => {});
  }
}

async function writeProviderArtifacts({
  sourceText,
  voiceId,
  audioPath,
  timestampsPath,
  attemptPath,
  narrationIdentity,
  publicOutputPath,
  outputIdentity,
  publicNarrationPath,
  binding,
  currentSourceSha,
}) {
  await assertStableNarrationDirectory(narrationIdentity);
  assertCredentialBoundary(releaseMediaInputs);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  invariant(
    apiKey,
    "ELEVENLABS_API_KEY is unavailable. Run the credentialed request through with-ai-keys.",
  );
  await Promise.all(
    [audioPath, timestampsPath, attemptPath].map(async (filePath) => {
      try {
        await fs.lstat(filePath);
        throw new Error(
          `${path.basename(filePath)} already exists. Resolve and archive the prior provider attempt before generating again.`,
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }),
  );

  const publicContinuity = {
    publicOutputPath,
    outputIdentity,
    publicNarrationPath,
    narrationIdentity,
  };
  const assertCurrentProviderBoundary = async () => {
    assertCredentialBoundary(releaseMediaInputs);
    invariant(
      gitOutput(["rev-parse", "HEAD"]) === currentSourceSha,
      "The source checkpoint changed during voice validation. No paid request was made.",
    );
    await assertStableNarrationDirectory(narrationIdentity);
    await assertPublicCaptureContinuity(publicContinuity);
  };
  const providerFetch = credentialBoundFetch(assertCurrentProviderBoundary);

  const { approved, liveVoice, verification, approvalDigest } =
    await verifyApprovedVoiceForGeneration({
      binding,
      voiceId,
      apiKey,
      fetchImpl: providerFetch,
      expectedVerificationMode: releaseNarration.verificationMode,
    });
  invariant(
    verification.mode === releaseNarration.verificationMode,
    "Approved voice verification mode does not match the canonical release narration config.",
  );
  await assertCurrentProviderBoundary();
  assertFfprobeAvailable();

  const attempt = {
    schemaVersion: 1,
    provider: "elevenlabs",
    status: "request_started",
    attemptId: randomUUID(),
    startedAt: new Date().toISOString(),
    captureSourceSha: binding.captureSourceSha,
    releaseIdentity: releaseIdentityRecord(releaseMediaBinding.releaseIdentity),
    releaseNarration: releaseNarrationRecord(releaseNarration),
    releaseMediaReceipt: {
      path: releaseMediaBinding.releaseMediaReceipt.relativePath,
      sha256: releaseMediaBinding.releaseMediaReceipt.sha256,
    },
    sourceTextSha256: sha256(sourceText),
    modelId,
    outputFormat,
    voice:
      verification.mode === USER_SELECTED_TTS_ONLY_MODE
        ? { voiceId, approvalDigest, verification }
        : {
            voiceId,
            name: approved.voice.name,
            voiceType: liveVoice.voiceType,
            category: liveVoice.category,
            fingerprint: approved.voiceFingerprint,
            reviewedPreviewSha256: approved.preview.sha256,
            verification,
          },
  };
  await writeExclusiveNoFollow(
    attemptPath,
    `${JSON.stringify(attempt, null, 2)}\n`,
  );
  await assertStableNarrationDirectory(narrationIdentity);
  await assertPublicCaptureContinuity(publicContinuity);

  let response;
  try {
    response = await providerFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ text: sourceText, model_id: modelId }),
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch {
    throw new Error(
      "ElevenLabs generation ended without a confirmed response. The attempt receipt was retained; do not retry until provider history is reviewed.",
    );
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `ElevenLabs generation failed (HTTP ${response.status}; ${safeProviderFailureClassification(errorBody)}).`,
    );
  }

  const body = await response.json().catch(() => undefined);
  invariant(
    typeof body?.audio_base64 === "string" &&
      body.audio_base64.length > 0 &&
      body.audio_base64.length <= 32 * 1024 * 1024 &&
      body.audio_base64.length % 4 === 0 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(body.audio_base64),
    "ElevenLabs returned no audio payload.",
  );
  invariant(
    body?.alignment && typeof body.alignment === "object",
    "ElevenLabs returned no raw character alignment.",
  );
  const audio = Buffer.from(body.audio_base64, "base64");
  await assertDecodableMp3({ audio, narrationIdentity });
  const timingPayload = {
    modelId,
    voiceId,
    sourceText,
    alignment: body.alignment,
    normalizedAlignment: body.normalized_alignment ?? null,
  };
  const timingBytes = Buffer.from(
    `${JSON.stringify(timingPayload, null, 2)}\n`,
    "utf8",
  );

  const nonce = `${process.pid}-${Date.now()}`;
  const temporaryAudio = path.join(
    narrationIdentity.operationRoot,
    `.narration-${nonce}.tmp.mp3`,
  );
  const temporaryTiming = path.join(
    narrationIdentity.operationRoot,
    `.narration-timestamps-${nonce}.tmp.json`,
  );
  const temporaryAttempt = path.join(
    narrationIdentity.operationRoot,
    `.narration-attempt-${nonce}.tmp.json`,
  );
  try {
    await assertStableNarrationDirectory(narrationIdentity);
    await writeExclusiveNoFollow(temporaryAudio, audio);
    await writeExclusiveNoFollow(temporaryTiming, timingBytes);
    await assertStableNarrationDirectory(narrationIdentity);
    await fs.link(temporaryAudio, audioPath);
    try {
      await fs.link(temporaryTiming, timestampsPath);
    } catch (error) {
      await fs.unlink(audioPath).catch(() => {});
      throw error;
    }
    const completedAttempt = {
      ...attempt,
      status: "artifacts_published",
      completedAt: new Date().toISOString(),
      artifacts: {
        audio: { bytes: audio.length, sha256: sha256(audio) },
        timing: { bytes: timingBytes.length, sha256: sha256(timingBytes) },
      },
    };
    await writeExclusiveNoFollow(
      temporaryAttempt,
      `${JSON.stringify(completedAttempt, null, 2)}\n`,
    );
    await assertStableNarrationDirectory(narrationIdentity);
    await fs.rename(temporaryAttempt, attemptPath);
    await assertStableNarrationDirectory(narrationIdentity);
  } finally {
    await Promise.all([
      fs.unlink(temporaryAudio).catch(() => {}),
      fs.unlink(temporaryTiming).catch(() => {}),
      fs.unlink(temporaryAttempt).catch(() => {}),
    ]);
  }

  await assertPublicCaptureContinuity(publicContinuity);

  console.log(
    `Generated ${audio.length} bytes of ElevenLabs narration with raw timestamps.`,
  );
}

async function ensureSafeOutputDirectory() {
  invariant(
    isInside(allowedOutputRoot, outputDir),
    `WONDERLAB_CAPTURE_OUTPUT must be a child of ${path.relative(root, allowedOutputRoot)}.`,
  );
  const allowedStat = await fs.lstat(allowedOutputRoot);
  invariant(
    !allowedStat.isSymbolicLink() && allowedStat.isDirectory(),
    `${allowedOutputRoot} must be a real directory.`,
  );
  const allowedReal = await fs.realpath(allowedOutputRoot);
  const outputStat = await fs.lstat(outputDir);
  invariant(
    !outputStat.isSymbolicLink() && outputStat.isDirectory(),
    `${outputDir} must be a real directory.`,
  );
  const outputReal = await fs.realpath(outputDir);
  invariant(
    isInside(allowedReal, outputReal),
    "The resolved capture output escapes output/playwright.",
  );
  return {
    identity: {
      dev: outputStat.dev,
      ino: outputStat.ino,
      realPath: outputReal,
    },
    outputReal,
  };
}

const releaseNarration = await loadReleaseNarration({ root });
const options = parseArguments(process.argv.slice(2));
options.voiceId ??= releaseNarration.voiceId;
invariant(
  options.voiceId === releaseNarration.voiceId,
  `--voice-id must match the canonical release narration voice ${releaseNarration.voiceId}.`,
);
invariant(
  path.resolve(
    spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
    }).stdout.trim(),
  ) === root,
  `Run demo narration from the ${releaseMediaBinding.releaseIdentity.displayName} repository root.`,
);
if (options.credentialedRequest) assertCredentialBoundary(releaseMediaInputs);
const { identity: outputIdentity, outputReal } =
  await ensureSafeOutputDirectory();

const sourceText = cues.map((cue) => cue.text).join("\n\n");
const narrationText = `${sourceText}\n`;
const narrationDir = path.join(outputReal, "elevenlabs");
const narrationStat = await fs.lstat(narrationDir);
invariant(
  !narrationStat.isSymbolicLink() && narrationStat.isDirectory(),
  `${narrationDir} must be a real directory.`,
);
const narrationReal = await fs.realpath(narrationDir);
invariant(
  isInside(outputReal, narrationReal),
  "The resolved ElevenLabs narration directory escapes the capture output.",
);
const narrationIdentity = {
  realPath: narrationReal,
  dev: narrationStat.dev,
  ino: narrationStat.ino,
  operationRoot: ".",
};

process.chdir(outputReal);
const anchoredOutput = await fs.stat(".");
invariant(
  anchoredOutput.isDirectory() &&
    anchoredOutput.dev === outputIdentity.dev &&
    anchoredOutput.ino === outputIdentity.ino,
  "The capture output changed before it could be anchored.",
);

let binding;
let currentSourceSha;
if (options.credentialedRequest) {
  currentSourceSha = gitOutput(["rev-parse", "HEAD"]);
  binding = await loadCaptureBinding({
    root,
    outputDir: outputReal,
    currentSourceSha,
    anchoredOutputIdentity: outputIdentity,
  });
  assertReleaseIdentityRecord(
    binding.releaseIdentity,
    releaseMediaBinding.releaseIdentity,
  );
}

const anchoredNarration = await fs.lstat("elevenlabs");
invariant(
  !anchoredNarration.isSymbolicLink() &&
    anchoredNarration.isDirectory() &&
    anchoredNarration.dev === narrationIdentity.dev &&
    anchoredNarration.ino === narrationIdentity.ino,
  "The ElevenLabs narration directory changed before it could be anchored.",
);
process.chdir("elevenlabs");
const currentNarration = await fs.stat(".");
invariant(
  currentNarration.isDirectory() &&
    currentNarration.dev === narrationIdentity.dev &&
    currentNarration.ino === narrationIdentity.ino,
  "The ElevenLabs narration directory changed before it could be anchored.",
);
await assertStableNarrationDirectory(narrationIdentity);
const textPath = "narration.txt";
const audioPath = "narration.mp3";
const timestampsPath = "narration-timestamps.json";
const attemptPath = "narration-attempt.json";
await Promise.all(
  [textPath, audioPath, timestampsPath, attemptPath].map(
    assertNotSymlinkIfPresent,
  ),
);
await writeAtomicNarrationText({
  narrationIdentity,
  textPath,
  content: narrationText,
});
await assertPublicCaptureContinuity({
  publicOutputPath: outputDir,
  outputIdentity,
  publicNarrationPath: narrationDir,
  narrationIdentity,
});

if (options.credentialedRequest) {
  const anchoredBinding = {
    ...binding,
    anchoredNarrationIdentity: {
      dev: narrationIdentity.dev,
      ino: narrationIdentity.ino,
    },
  };
  await writeProviderArtifacts({
    sourceText,
    voiceId: options.voiceId,
    audioPath,
    timestampsPath,
    attemptPath,
    narrationIdentity,
    publicOutputPath: outputDir,
    outputIdentity,
    publicNarrationPath: narrationDir,
    binding: anchoredBinding,
    currentSourceSha,
  });
} else if (options.generate) {
  assertCredentialBoundary(releaseMediaInputs);
  const result = spawnSync(
    withAiKeysPath,
    [
      "ELEVENLABS_API_KEY",
      "--",
      process.execPath,
      scriptPath,
      "--credentialed-request",
      "--voice-id",
      options.voiceId,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) {
    throw new Error(
      `Unable to start the credentialed ElevenLabs request: ${result.error.message}`,
    );
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log("Dry run only. No ElevenLabs request was made.");
  console.log(
    JSON.stringify(
      {
        voiceId: options.voiceId,
        modelId,
        outputFormat,
        output: path.join(narrationReal, audioPath),
        timestampsOutput: path.join(narrationReal, timestampsPath),
        characters: sourceText.length,
      },
      null,
      2,
    ),
  );
}
