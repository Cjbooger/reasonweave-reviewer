import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCleanCredentialSourceStatus,
  assertPublicArtifactContinuity,
  findDefaultPremadeVoice,
  listDefaultPremadeVoices,
  loadCaptureBinding,
  downloadPremadeVoicePreview,
  parseVoiceCatalogArguments,
  USER_SELECTED_TTS_ONLY_MODE,
  writeApprovedVoiceRecord,
  writeUserSelectedTtsOnlyVoiceRecord,
} from "./elevenlabs-voice-catalog.mjs";
import { loadReleaseNarration } from "./release-narration.mjs";

const root = process.cwd();
const scriptPath = fileURLToPath(import.meta.url);
const withAiKeysPath = path.join(
  process.env.HOME ?? "",
  ".local",
  "bin",
  "with-ai-keys",
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });
  invariant(
    result.status === 0,
    "Unable to verify the ReasonWeave Git checkout.",
  );
  return result.stdout.trim();
}

function credentialedArguments(options) {
  return [
    "--credentialed-request",
    ...(options.approveVoiceId
      ? [
          "--approve-voice",
          options.approveVoiceId,
          "--confirm-preview-reviewed",
        ]
      : options.previewVoiceId
        ? ["--preview-voice", options.previewVoiceId]
        : options.approveUserSelectedVoiceId
          ? [
              "--approve-user-selected-voice",
              options.approveUserSelectedVoiceId,
              "--confirm-user-selected-voice",
            ]
          : []),
  ];
}

function committedFileSha256(sourcePath) {
  const result = spawnSync("git", ["show", `HEAD:${sourcePath}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 64 * 1024,
  });
  invariant(
    result.status === 0 && Buffer.isBuffer(result.stdout),
    `Unable to read committed credential-bound source ${sourcePath}.`,
  );
  return createHash("sha256").update(result.stdout).digest("hex");
}

function worktreeFileSha256(sourcePath) {
  return createHash("sha256")
    .update(readFileSync(path.join(root, ...sourcePath.split("/"))))
    .digest("hex");
}

function assertCredentialBoundary({ releaseNarration, expectedSourceSha }) {
  invariant(
    path.resolve(gitOutput(["rev-parse", "--show-toplevel"])) === root,
    "Run the voice catalog from the ReasonWeave repository root.",
  );
  assertCleanCredentialSourceStatus(
    gitOutput(["status", "--porcelain=v1", "--untracked-files=all"]),
  );
  invariant(
    gitOutput(["rev-parse", "HEAD"]) === expectedSourceSha,
    "The source checkpoint changed during the credentialed voice operation.",
  );
  for (const sourcePath of [
    path.relative(root, scriptPath),
    "scripts/elevenlabs-voice-catalog.mjs",
    "scripts/release-narration.mjs",
    releaseNarration.record.path,
  ]) {
    gitOutput(["ls-files", "--error-unmatch", "--", sourcePath]);
  }
  invariant(
    committedFileSha256(releaseNarration.record.path) ===
      releaseNarration.record.sha256 &&
      worktreeFileSha256(releaseNarration.record.path) ===
        releaseNarration.record.sha256,
    `${releaseNarration.record.path} does not match the committed credential boundary.`,
  );
}

function credentialBoundFetch(assertCurrentCredentialBoundary) {
  invariant(
    typeof globalThis.fetch === "function",
    "A fetch implementation is required.",
  );
  return async (...arguments_) => {
    assertCurrentCredentialBoundary();
    try {
      return await globalThis.fetch(...arguments_);
    } finally {
      assertCurrentCredentialBoundary();
    }
  };
}

async function anchorArtifactDirectory({ binding, outputDir }) {
  const outputMetadata = await fs.lstat(outputDir);
  invariant(
    !outputMetadata.isSymbolicLink() && outputMetadata.isDirectory(),
    "The capture output must remain a real directory before voice approval.",
  );
  const resolvedMetadata = await fs.lstat(binding.outputReal);
  invariant(
    !resolvedMetadata.isSymbolicLink() &&
      resolvedMetadata.isDirectory() &&
      resolvedMetadata.dev === outputMetadata.dev &&
      resolvedMetadata.ino === outputMetadata.ino,
    "The capture output changed before voice artifacts could be anchored.",
  );

  process.chdir(binding.outputReal);
  const anchoredOutput = await fs.stat(".");
  invariant(
    anchoredOutput.isDirectory() &&
      anchoredOutput.dev === outputMetadata.dev &&
      anchoredOutput.ino === outputMetadata.ino,
    "The capture output changed before voice artifacts could be anchored.",
  );

  try {
    await fs.mkdir("elevenlabs", { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const narrationMetadata = await fs.lstat("elevenlabs");
  invariant(
    !narrationMetadata.isSymbolicLink() && narrationMetadata.isDirectory(),
    "The ElevenLabs artifact directory must be a real directory.",
  );
  process.chdir("elevenlabs");
  const anchoredNarration = await fs.stat(".");
  invariant(
    anchoredNarration.isDirectory() &&
      anchoredNarration.dev === narrationMetadata.dev &&
      anchoredNarration.ino === narrationMetadata.ino,
    "The ElevenLabs artifact directory changed before it could be anchored.",
  );

  const anchoredBinding = {
    ...binding,
    anchoredNarrationIdentity: {
      dev: narrationMetadata.dev,
      ino: narrationMetadata.ino,
    },
    publicArtifactIdentity: {
      outputPath: outputDir,
      outputDev: outputMetadata.dev,
      outputIno: outputMetadata.ino,
      narrationPath: path.join(outputDir, "elevenlabs"),
      narrationDev: narrationMetadata.dev,
      narrationIno: narrationMetadata.ino,
    },
  };
  await assertPublicArtifactContinuity(anchoredBinding);
  return anchoredBinding;
}

async function run() {
  const options = parseVoiceCatalogArguments(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/list-elevenlabs-premade-voices.mjs [--preview-voice <voice-id> | --approve-voice <voice-id> --confirm-preview-reviewed | --approve-user-selected-voice [voice-id] --confirm-user-selected-voice]",
    );
    return;
  }
  const releaseNarration = await loadReleaseNarration({ root });
  if (options.useReleaseNarrationVoice) {
    options.approveUserSelectedVoiceId = releaseNarration.voiceId;
  }
  const selectedVoiceId =
    options.approveUserSelectedVoiceId ??
    options.approveVoiceId ??
    options.previewVoiceId;
  if (selectedVoiceId) {
    invariant(
      selectedVoiceId === releaseNarration.voiceId,
      `Requested voice must match the canonical release narration voice ${releaseNarration.voiceId}.`,
    );
  }
  invariant(
    releaseNarration.verificationMode !== USER_SELECTED_TTS_ONLY_MODE ||
      (!options.previewVoiceId && !options.approveVoiceId),
    `Canonical release narration verification mode ${releaseNarration.verificationMode} permits only --approve-user-selected-voice.`,
  );
  const currentSourceSha = gitOutput(["rev-parse", "HEAD"]);
  const assertCurrentCredentialBoundary = () =>
    assertCredentialBoundary({
      releaseNarration,
      expectedSourceSha: currentSourceSha,
    });

  if (!options.credentialedRequest) {
    assertCurrentCredentialBoundary();
    const result = spawnSync(
      withAiKeysPath,
      [
        "ELEVENLABS_API_KEY",
        "--",
        process.execPath,
        scriptPath,
        ...credentialedArguments(options),
      ],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error) {
      throw new Error(
        `Unable to start the credentialed ElevenLabs catalog request: ${result.error.message}`,
      );
    }
    if (result.status !== 0) process.exit(result.status ?? 1);
    return;
  }

  assertCurrentCredentialBoundary();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  invariant(
    apiKey,
    "ELEVENLABS_API_KEY is unavailable. Run the catalog through with-ai-keys.",
  );
  const providerFetch = credentialBoundFetch(assertCurrentCredentialBoundary);

  if (
    !options.approveVoiceId &&
    !options.previewVoiceId &&
    !options.approveUserSelectedVoiceId
  ) {
    const voices = await listDefaultPremadeVoices({
      apiKey,
      fetchImpl: providerFetch,
    });
    console.log(
      JSON.stringify(
        {
          filters: { voiceType: "default", category: "premade" },
          voices,
        },
        null,
        2,
      ),
    );
    return;
  }

  const outputDir = path.resolve(
    root,
    process.env.WONDERLAB_CAPTURE_OUTPUT ?? "output/playwright/wonderlab-demo",
  );
  const captureBinding = await loadCaptureBinding({
    root,
    outputDir,
    currentSourceSha,
  });
  const binding = await anchorArtifactDirectory({
    binding: captureBinding,
    outputDir,
  });
  if (options.approveUserSelectedVoiceId) {
    const approval = await writeUserSelectedTtsOnlyVoiceRecord({
      binding,
      voiceId: options.approveUserSelectedVoiceId,
      apiKey,
      fetchImpl: providerFetch,
      assertCredentialBoundary: assertCurrentCredentialBoundary,
    });
    await assertPublicArtifactContinuity(binding);
    console.log(
      JSON.stringify(
        {
          approvedVoice: approval.record.voice,
          verification: approval.record.verification,
          captureSourceSha: approval.record.captureSourceSha,
          approvalPath: path.relative(root, approval.approvalPath),
        },
        null,
        2,
      ),
    );
    return;
  }
  await assertPublicArtifactContinuity(binding);
  const voice = await findDefaultPremadeVoice({
    voiceId: options.previewVoiceId ?? options.approveVoiceId,
    apiKey,
    fetchImpl: providerFetch,
  });
  await assertPublicArtifactContinuity(binding);
  if (options.previewVoiceId) {
    const preview = await downloadPremadeVoicePreview({
      binding,
      voice,
      fetchImpl: providerFetch,
    });
    await assertPublicArtifactContinuity(binding);
    console.log(
      JSON.stringify(
        {
          previewedVoice: { voiceId: voice.voiceId, name: voice.name },
          captureSourceSha: preview.record.captureSourceSha,
          previewAudioPath: path.relative(root, preview.previewAudioPath),
          previewPath: path.relative(root, preview.previewPath),
        },
        null,
        2,
      ),
    );
    return;
  }
  const approval = await writeApprovedVoiceRecord({ binding, voice });
  await assertPublicArtifactContinuity(binding);
  console.log(
    JSON.stringify(
      {
        approvedVoice: approval.record.voice,
        captureSourceSha: approval.record.captureSourceSha,
        approvalPath: path.relative(root, approval.approvalPath),
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Voice catalog failed.",
  );
  process.exitCode = 1;
});
