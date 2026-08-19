import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveElevenLabsArtifactSource } from "../scripts/demo-artifact-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots: string[] = [];
const DEFAULT_RELEASE_ID = "reasonweave-test-release";
const SCREENSHOT_FILENAMES = [
  "spark-desktop.jpg",
  "routes-desktop.jpg",
  "prediction-desktop.jpg",
  "evidence-create-desktop.jpg",
  "discovery-desktop.jpg",
  "discovery-card-desktop.jpg",
  "discovery-mobile.jpg",
  "discovery-mobile-trace.jpg",
] as const;
const RELEASE_MEDIA_FILENAMES = [
  "technical-proof-board.svg",
  "technical-proof-board.png",
  "seeded-demo-rehearsal.srt",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
] as const;
const VALID_MP3_BASE64 =
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAB7wCTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5PKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysr///////////////////////////////////////////8AAAAATGF2YzYyLjI4AAAAAAAAAAAAAAAAJAKjAAAAAAAAAe8wbBzeAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EsQpg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMRTg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

const VALID_CAPTION_LINES = Array.from(
  { length: 29 },
  (_, index) =>
    `ReasonWeave learning cue ${String(index + 1).padStart(2, "0")}.`,
);

function srtTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},000`;
}

const VALID_RELEASE_SRT = `${VALID_CAPTION_LINES.map(
  (text, index) =>
    `${index + 1}\n${srtTimestamp(index * 6)} --> ${srtTimestamp((index + 1) * 6)}\n${text}`,
).join("\n\n")}\n`;
const VALID_NARRATION_TEXT = `${VALID_CAPTION_LINES.join("\n\n")}\n`;

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) =>
        fs.rm(temporaryRoot, { recursive: true, force: true }),
      ),
  );
});

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

async function credentialedGenerationFixture({
  voiceId = "OZxMHsGaBmV5pjMIDIn0",
}: { voiceId?: string } = {}) {
  const fixtureRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "reasonweave-elevenlabs-boundary-"),
  );
  temporaryRoots.push(fixtureRoot);
  await fs.mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, "docs", "media"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixtureRoot, "config"), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, "public"), { recursive: true });
  await fs.copyFile(
    path.join(root, "scripts", "generate-elevenlabs-demo.mjs"),
    path.join(fixtureRoot, "scripts", "generate-elevenlabs-demo.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "elevenlabs-voice-catalog.mjs"),
    path.join(fixtureRoot, "scripts", "elevenlabs-voice-catalog.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "release-media-paths.mjs"),
    path.join(fixtureRoot, "scripts", "release-media-paths.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "screenshot-output.mjs"),
    path.join(fixtureRoot, "scripts", "screenshot-output.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "release-identity.mjs"),
    path.join(fixtureRoot, "scripts", "release-identity.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "release-narration.mjs"),
    path.join(fixtureRoot, "scripts", "release-narration.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "anchored-directory-ops.mjs"),
    path.join(fixtureRoot, "scripts", "anchored-directory-ops.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "demo-release-contract.mjs"),
    path.join(fixtureRoot, "scripts", "demo-release-contract.mjs"),
  );
  await provisionReleaseMedia(fixtureRoot, DEFAULT_RELEASE_ID, voiceId);
  await fs.writeFile(path.join(fixtureRoot, ".gitignore"), "output/\n");
  await fs.writeFile(
    path.join(fixtureRoot, "fetch-sentinel.cjs"),
    "globalThis.fetch = () => { throw new Error('FETCH_SENTINEL_CALLED'); };\n",
  );
  git(fixtureRoot, ["init", "--quiet"]);
  git(fixtureRoot, ["config", "user.email", "tests@example.invalid"]);
  git(fixtureRoot, ["config", "user.name", "ReasonWeave tests"]);
  git(fixtureRoot, ["add", "."]);
  git(fixtureRoot, ["commit", "--quiet", "-m", "fixture"]);
  return fixtureRoot;
}

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

async function provisionReleaseMedia(
  fixtureRoot: string,
  releaseId: string,
  narrationVoiceId = "OZxMHsGaBmV5pjMIDIn0",
) {
  const identityConfig = {
    schemaVersion: 1,
    displayName: "ReasonWeave",
    slug: "reasonweave",
    retiredDisplayNames: ["WonderLab"],
  };
  const identityContent = `${JSON.stringify(identityConfig, null, 2)}\n`;
  const releaseIdentity = {
    path: "config/release-identity.json",
    sha256: sha256(identityContent),
    displayName: identityConfig.displayName,
    slug: identityConfig.slug,
  };
  await fs.writeFile(
    path.join(fixtureRoot, "config", "release-identity.json"),
    identityContent,
  );
  await fs.writeFile(
    path.join(fixtureRoot, "config", "release-narration.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        provider: "elevenlabs",
        voiceId: narrationVoiceId,
        verificationMode: "user_selected_tts_only",
      },
      null,
      2,
    )}\n`,
  );
  const mediaDir = path.join(fixtureRoot, "docs", "media", releaseId);
  const screenshotDir = path.join(
    fixtureRoot,
    "docs",
    "screenshots",
    releaseId,
  );
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshotRecords = [];
  for (const filename of SCREENSHOT_FILENAMES) {
    const content = Buffer.from(`ReasonWeave screenshot ${filename}\n`);
    await fs.writeFile(path.join(screenshotDir, filename), content);
    screenshotRecords.push({
      path: `docs/screenshots/${releaseId}/${filename}`,
      bytes: content.length,
      sha256: sha256(content),
    });
  }
  const sourceSha = "a".repeat(40);
  await fs.writeFile(
    path.join(screenshotDir, ".wonderlab-screenshot-output.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      owner: "wonderlab-screenshot-output-v1",
      sourceSha,
      outputDir: `docs/screenshots/${releaseId}`,
      releaseIdentity,
    })}\n`,
  );
  const screenshotReceipt = {
    schemaVersion: 1,
    kind: "wonderlab-screenshot-receipt",
    source: { fullSha: sourceSha, cleanBeforeCapture: true },
    outputDir: `docs/screenshots/${releaseId}`,
    releaseIdentity,
    screenshots: screenshotRecords,
  };
  const screenshotReceiptContent = `${JSON.stringify(screenshotReceipt)}\n`;
  await fs.writeFile(
    path.join(screenshotDir, "screenshot-receipt.json"),
    screenshotReceiptContent,
  );
  const screenshotEvidence = {
    ownerPath: `docs/screenshots/${releaseId}/.wonderlab-screenshot-output.json`,
    receiptPath: `docs/screenshots/${releaseId}/screenshot-receipt.json`,
    receiptSha256: sha256(screenshotReceiptContent),
    releaseScreenshot: screenshotRecords[4],
    sourceSha,
  };
  const proofBoardPng = await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 4,
      background: "#041f32",
    },
  })
    .png()
    .toBuffer();
  const closingCardPng = await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 4,
      background: "#fbf8f1",
    },
  })
    .png()
    .toBuffer();
  const mediaContents: Record<
    (typeof RELEASE_MEDIA_FILENAMES)[number],
    Buffer
  > = {
    "technical-proof-board.svg": Buffer.from("<svg>ReasonWeave proof</svg>\n"),
    "technical-proof-board.png": proofBoardPng,
    "seeded-demo-rehearsal.srt": Buffer.from(VALID_RELEASE_SRT),
    "youtube-thumbnail.png": Buffer.from("ReasonWeave thumbnail\n"),
    "seeded-demo-badge.png": Buffer.from("ReasonWeave badge\n"),
    "closing-card.png": closingCardPng,
  };
  const mediaFiles = [];
  for (const filename of RELEASE_MEDIA_FILENAMES) {
    const content = mediaContents[filename];
    await fs.writeFile(path.join(mediaDir, filename), content);
    mediaFiles.push({
      filename,
      path: `docs/media/${releaseId}/${filename}`,
      bytes: content.length,
      sha256: sha256(content),
    });
  }
  const publicOg = Buffer.from("ReasonWeave social image\n");
  await fs.writeFile(
    path.join(fixtureRoot, "public", "reasonweave-og.png"),
    publicOg,
  );
  await fs.writeFile(
    path.join(mediaDir, "release-media-receipt.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "wonderlab-release-media-receipt",
      releaseDirectory: releaseId,
      releaseIdentity,
      screenshotEvidence,
      mediaFiles,
      publicOg: {
        path: "public/reasonweave-og.png",
        bytes: publicOg.length,
        sha256: sha256(publicOg),
      },
    })}\n`,
  );
  return `docs/media/${releaseId}`;
}

async function replaceReceiptBoundMedia(
  fixtureRoot: string,
  releaseId: string,
  filename: (typeof RELEASE_MEDIA_FILENAMES)[number],
  content: Buffer,
) {
  const mediaDir = path.join(fixtureRoot, "docs", "media", releaseId);
  const receiptPath = path.join(mediaDir, "release-media-receipt.json");
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  const record = receipt.mediaFiles.find(
    (candidate: { filename?: string }) => candidate.filename === filename,
  );
  if (!record) throw new Error(`Missing receipt record for ${filename}.`);
  await fs.writeFile(path.join(mediaDir, filename), content);
  record.bytes = content.length;
  record.sha256 = sha256(content);
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
}

async function provisionCapture(
  fixtureRoot: string,
  outputName: string,
  sourceSha: string,
) {
  const outputDir = path.join(fixtureRoot, "output", "playwright", outputName);
  const relativeOutputPath = `output/playwright/${outputName}`;
  await fs.mkdir(path.join(outputDir, "elevenlabs"), { recursive: true });
  await fs.writeFile(
    path.join(outputDir, ".wonderlab-demo-output.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      owner: "wonderlab-seeded-demo-v1",
      outputDir: relativeOutputPath,
      relativeOutputPath,
    })}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, "capture-manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      source: { fullSha: sourceSha, dirty: false },
      releaseIdentity: {
        path: "config/release-identity.json",
        sha256: sha256(
          await fs.readFile(
            path.join(fixtureRoot, "config", "release-identity.json"),
          ),
        ),
        displayName: "ReasonWeave",
        slug: "reasonweave",
      },
    })}\n`,
  );
  return { outputDir, relativeOutputPath };
}

function runCredentialedGeneration(
  fixtureRoot: string,
  outputName: string,
  preload: string,
) {
  return spawnSync(
    process.execPath,
    ["scripts/generate-elevenlabs-demo.mjs", "--credentialed-request"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ELEVENLABS_API_KEY: "offline-test-key",
        NODE_OPTIONS: `--require ./${preload}`,
        WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
        WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
      },
    },
  );
}

async function fixtureHead(fixtureRoot: string) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function approvedVoiceEvidence(captureSourceSha: string) {
  const { voiceMetadataFingerprint } = await import(
    /* @vite-ignore */ pathToFileURL(
      path.join(root, "scripts", "elevenlabs-voice-catalog.mjs"),
    ).href
  );
  const voice = {
    voiceId: "voice_alpha",
    name: "Approved Narrator",
    voiceType: "default",
    category: "premade",
  };
  const voiceFingerprint = voiceMetadataFingerprint(voice);
  const previewAudio = Buffer.from("preview-audio");
  const previewSha256 = createHash("sha256").update(previewAudio).digest("hex");
  const recordedAt = "2026-07-17T12:00:00.000Z";
  const previewRecord = {
    schemaVersion: 1,
    provider: "elevenlabs",
    status: "previewed",
    voiceId: voice.voiceId,
    voiceFingerprint,
    preview: {
      filename: "premade-preview.mp3",
      sha256: previewSha256,
      bytes: previewAudio.length,
      recordedAt,
    },
    captureSourceSha,
  };
  const approvalRecord = {
    schemaVersion: 1,
    provider: "elevenlabs",
    status: "approved",
    voice,
    voiceFingerprint,
    verification: {
      schemaVersion: 1,
      mode: "catalog_verified",
      endpoint: "/v2/voices",
      filters: { voiceType: "default", category: "premade" },
      verifiedAt: recordedAt,
    },
    approval: {
      method: "explicit-cli-confirmation",
      previewReviewed: true,
      recordedAt,
    },
    preview: {
      sha256: previewSha256,
      bytes: previewAudio.length,
      recordedAt,
    },
    captureSourceSha,
  };
  return { approvalRecord, previewAudio, previewRecord };
}

async function pinnedGeorgeEvidence(captureSourceSha: string) {
  const {
    PINNED_OFFICIAL_DEFAULT_VOICE,
    createApprovedVoiceRecord,
    createPreviewVoiceRecord,
  } = await import(
    /* @vite-ignore */ pathToFileURL(
      path.join(root, "scripts", "elevenlabs-voice-catalog.mjs"),
    ).href
  );
  const voice = {
    ...PINNED_OFFICIAL_DEFAULT_VOICE,
    verificationMode: "pinned_official_tts_only",
    catalogDenial: {
      endpoint: "/v2/voices",
      status: 401,
      code: "missing_permissions",
    },
  };
  const previewAudio = Buffer.from("preview-audio");
  const previewRecord = createPreviewVoiceRecord({
    voice,
    captureSourceSha,
    audio: previewAudio,
    now: "2026-07-17T12:00:00.000Z",
  });
  const approvalRecord = createApprovedVoiceRecord({
    voice,
    captureSourceSha,
    preview: previewRecord,
    now: "2026-07-17T12:01:00.000Z",
  });
  return { approvalRecord, previewAudio, previewRecord, voice };
}

async function writeUserSelectedApproval({
  outputDir,
  sourceSha,
  voiceId,
}: {
  outputDir: string;
  sourceSha: string;
  voiceId: string;
}) {
  const selectedAt = "2026-07-17T12:00:00.000Z";
  await fs.writeFile(
    path.join(outputDir, "elevenlabs", "approved-voice.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      provider: "elevenlabs",
      status: "approved",
      voice: { voiceId },
      verification: {
        schemaVersion: 1,
        mode: "user_selected_tts_only",
        source: "explicit_user_provided_exact_voice_id",
        voiceId,
        metadata: "unverified",
        preview: "not_performed",
        catalogDenial: {
          endpoint: "/v2/voices",
          status: 401,
          code: "missing_permissions",
        },
        selectedAt,
      },
      approval: {
        method: "explicit-cli-user-selected-voice-confirmation",
        selectedAt,
      },
      captureSourceSha: sourceSha,
    })}\n`,
  );
}

async function publicGenerateWrapperFixture({
  fixtureRoot,
  outputName,
  voiceId,
}: {
  fixtureRoot: string;
  outputName: string;
  voiceId: string;
}) {
  const preload = "fake-public-generate-provider.cjs";
  await fs.writeFile(
    path.join(fixtureRoot, preload),
    [
      'const fs = require("node:fs");',
      "globalThis.fetch = async (url, init = {}) => {",
      '  const method = init.method || "GET";',
      "  fs.appendFileSync(process.env.FETCH_LOG_PATH, `${method} ${url}\\n`);",
      '  if (method === "GET") return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
      '  if (method === "POST") return { ok: false, status: 503, json: async () => ({ detail: { status: "provider_test_sentinel" } }) };',
      '  throw new Error("UNEXPECTED_FETCH_METHOD");',
      "};",
      "",
    ].join("\n"),
  );
  git(fixtureRoot, ["add", preload]);
  git(fixtureRoot, ["commit", "--quiet", "-m", "fake wrapper provider"]);

  const sourceSha = await fixtureHead(fixtureRoot);
  const { outputDir } = await provisionCapture(
    fixtureRoot,
    outputName,
    sourceSha,
  );
  await writeUserSelectedApproval({ outputDir, sourceSha, voiceId });

  const fakeHome = path.join(fixtureRoot, "output", `${outputName}-home`);
  const wrapperPath = path.join(fakeHome, ".local", "bin", "with-ai-keys");
  const wrapperLog = path.join(
    fixtureRoot,
    "output",
    `${outputName}-wrapper.json`,
  );
  const fetchLog = path.join(fixtureRoot, "output", `${outputName}-fetch.log`);
  const narrationPath = path.join(outputDir, "elevenlabs", "narration.txt");
  await fs.mkdir(path.dirname(wrapperPath), { recursive: true });
  await fs.writeFile(
    wrapperPath,
    [
      "#!/usr/bin/env node",
      'const { createHash } = require("node:crypto");',
      'const { spawnSync } = require("node:child_process");',
      'const fs = require("node:fs");',
      "const [keyName, separator, command, ...args] = process.argv.slice(2);",
      'if (keyName !== "ELEVENLABS_API_KEY" || separator !== "--" || !command) process.exit(64);',
      "const narrationPath = process.env.NARRATION_PATH;",
      "const wrapperLog = process.env.WRAPPER_LOG_PATH;",
      "const record = () => {",
      "  const metadata = fs.lstatSync(narrationPath);",
      "  const content = fs.readFileSync(narrationPath);",
      '  return { dev: metadata.dev, ino: metadata.ino, bytes: metadata.size, sha256: createHash("sha256").update(content).digest("hex") };',
      "};",
      "const before = record();",
      "const result = spawnSync(command, args, {",
      '  stdio: "inherit",',
      '  env: { ...process.env, ELEVENLABS_API_KEY: "offline-wrapper-test-key" },',
      "});",
      "const after = record();",
      "fs.writeFileSync(wrapperLog, JSON.stringify({ before, after, childStatus: result.status }));",
      "process.exit(result.status ?? 1);",
      "",
    ].join("\n"),
  );
  await fs.chmod(wrapperPath, 0o700);

  return {
    environment: {
      ...process.env,
      ELEVENLABS_API_KEY: "",
      FETCH_LOG_PATH: fetchLog,
      HOME: fakeHome,
      NARRATION_PATH: narrationPath,
      NODE_OPTIONS: `--require ./${preload}`,
      WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
      WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
      WRAPPER_LOG_PATH: wrapperLog,
    },
    fetchLog,
    narrationPath,
    outputDir,
    wrapperLog,
  };
}

function runPublicGenerate(
  fixtureRoot: string,
  voiceId: string,
  environment: NodeJS.ProcessEnv,
) {
  return spawnSync(
    process.execPath,
    [
      "scripts/generate-elevenlabs-demo.mjs",
      "--generate",
      "--voice-id",
      voiceId,
    ],
    { cwd: fixtureRoot, encoding: "utf8", env: environment },
  );
}

describe("credentialed ElevenLabs generation boundary", () => {
  it("documents the canonical narration voice as the optional CLI default", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const result = spawnSync(
      process.execPath,
      ["scripts/generate-elevenlabs-demo.mjs", "--help"],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("[--voice-id <voice-id>]");
    expect(result.stdout).toContain(
      "Voice defaults to config/release-narration.json",
    );
    expect(result.stdout).not.toContain("FETCH_SENTINEL_CALLED");
  });

  it("uses a versioned release caption file for a provider-free dry run", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      "versioned-dry-run",
      sourceSha,
    );

    const result = spawnSync(
      process.execPath,
      ["scripts/generate-elevenlabs-demo.mjs"],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
          WONDERLAB_CAPTURE_OUTPUT: "output/playwright/versioned-dry-run",
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Dry run only. No ElevenLabs request was made.",
    );
    expect(result.stdout).toContain('"voiceId": "OZxMHsGaBmV5pjMIDIn0"');
    expect(
      await fs.readFile(
        path.join(outputDir, "elevenlabs", "narration.txt"),
        "utf8",
      ),
    ).toBe(VALID_NARRATION_TEXT);
    await expect(
      fs.lstat(path.join(outputDir, "elevenlabs", "narration.mp3")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects receipt-valid but structurally invalid captions before any provider fetch or attempt artifact", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const invalidSrt = Buffer.from(
      "1\n00:00:00,000 --> 00:00:06,000\nReasonWeave invalid release cue.\n",
    );
    await replaceReceiptBoundMedia(
      fixtureRoot,
      DEFAULT_RELEASE_ID,
      "seeded-demo-rehearsal.srt",
      invalidSrt,
    );
    git(fixtureRoot, ["add", "."]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "invalid caption contract"]);
    const outputName = "invalid-caption-contract";

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Captions must use at least 20 readable cues.");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.access(
        path.join(
          fixtureRoot,
          "output",
          "playwright",
          outputName,
          "elevenlabs",
          "narration-attempt.json",
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects noncanonical receipt-valid SRT timestamps before any provider fetch", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const noncanonicalSrt = Buffer.from(
      VALID_RELEASE_SRT.replace("00:01:00,000", "00:00:60,000"),
    );
    await replaceReceiptBoundMedia(
      fixtureRoot,
      DEFAULT_RELEASE_ID,
      "seeded-demo-rehearsal.srt",
      noncanonicalSrt,
    );
    git(fixtureRoot, ["add", "."]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "noncanonical timestamp"]);
    const outputName = "noncanonical-timestamp-contract";

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Invalid SRT timestamp: 00:00:60,000");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
  });

  it("rejects a receipt-valid proof board with wrong dimensions before any provider fetch or attempt artifact", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const wrongSizeProofBoard = await sharp({
      create: {
        width: 1599,
        height: 900,
        channels: 4,
        background: "#041f32",
      },
    })
      .png()
      .toBuffer();
    await replaceReceiptBoundMedia(
      fixtureRoot,
      DEFAULT_RELEASE_ID,
      "technical-proof-board.png",
      wrongSizeProofBoard,
    );
    git(fixtureRoot, ["add", "."]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "invalid image contract"]);
    const outputName = "invalid-image-contract";

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("The proof board must be a 1600x900 PNG.");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.access(
        path.join(
          fixtureRoot,
          "output",
          "playwright",
          outputName,
          "elevenlabs",
          "narration-attempt.json",
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fully decodes receipt-valid PNG inputs before any provider fetch", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const proofBoardPath = path.join(
      fixtureRoot,
      "docs",
      "media",
      DEFAULT_RELEASE_ID,
      "technical-proof-board.png",
    );
    const corruptProofBoard = Buffer.from(await fs.readFile(proofBoardPath));
    corruptProofBoard[corruptProofBoard.length - 1] ^= 0xff;
    await replaceReceiptBoundMedia(
      fixtureRoot,
      DEFAULT_RELEASE_ID,
      "technical-proof-board.png",
      corruptProofBoard,
    );
    git(fixtureRoot, ["add", "."]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "corrupt image payload"]);
    const outputName = "corrupt-image-contract";

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("The proof board must be a 1600x900 PNG.");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.access(
        path.join(
          fixtureRoot,
          "output",
          "playwright",
          outputName,
          "elevenlabs",
          "narration-attempt.json",
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires every validated release input to remain committed before any provider fetch", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const relativeProofBoard = `docs/media/${DEFAULT_RELEASE_ID}/technical-proof-board.png`;
    git(fixtureRoot, ["rm", "--cached", "--", relativeProofBoard]);
    await fs.appendFile(
      path.join(fixtureRoot, ".gitignore"),
      `${relativeProofBoard}\n`,
    );
    git(fixtureRoot, ["add", ".gitignore"]);
    git(fixtureRoot, [
      "commit",
      "--quiet",
      "-m",
      "make proof board local only",
    ]);
    const outputName = "uncommitted-proof-contract";

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Unable to verify the release checkout.");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.access(
        path.join(
          fixtureRoot,
          "output",
          "playwright",
          outputName,
          "elevenlabs",
          "narration-attempt.json",
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a noncanonical dry-run voice before any provider boundary", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const sourceSha = await fixtureHead(fixtureRoot);
    await provisionCapture(fixtureRoot, "noncanonical-dry-run", sourceSha);

    const result = spawnSync(
      process.execPath,
      ["scripts/generate-elevenlabs-demo.mjs", "--voice-id", "voice_alpha"],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
          WONDERLAB_CAPTURE_OUTPUT: "output/playwright/noncanonical-dry-run",
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "must match the canonical release narration voice",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      "FETCH_SENTINEL_CALLED",
    );
  });

  it("rejects paid narration without a current receipt-bound release before provider access", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        "OZxMHsGaBmV5pjMIDIn0",
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Current narration and final assembly require WONDERLAB_RELEASE_MEDIA_DIR for a receipt-bound versioned release",
    );
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
  });

  it("lets a fresh public generate wrapper reuse its exact text in the credentialed child", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const boundary = await publicGenerateWrapperFixture({
      fixtureRoot,
      outputName: "fresh-public-generate",
      voiceId,
    });

    const result = runPublicGenerate(
      fixtureRoot,
      voiceId,
      boundary.environment,
    );
    const output = `${result.stdout}${result.stderr}`;
    const wrapper = JSON.parse(await fs.readFile(boundary.wrapperLog, "utf8"));
    const fetches = (await fs.readFile(boundary.fetchLog, "utf8"))
      .trim()
      .split("\n");
    const finalMetadata = await fs.lstat(boundary.narrationPath);

    expect(result.status).not.toBe(0);
    expect(wrapper.childStatus).not.toBe(0);
    expect(wrapper.before).toEqual(wrapper.after);
    expect(wrapper.after).toMatchObject({
      dev: finalMetadata.dev,
      ino: finalMetadata.ino,
      bytes: finalMetadata.size,
    });
    expect(fetches).toHaveLength(2);
    expect(fetches[0]).toMatch(
      new RegExp(
        `^GET https://api\\.elevenlabs\\.io/v2/voices\\?.*voice_ids=${voiceId}`,
      ),
    );
    expect(fetches[1]).toMatch(
      new RegExp(
        `^POST https://api\\.elevenlabs\\.io/v1/text-to-speech/${voiceId}/with-timestamps\\?`,
      ),
    );
    expect(output).not.toContain("EEXIST");
    expect(output).not.toContain("offline-wrapper-test-key");
    await expect(fs.readFile(boundary.narrationPath, "utf8")).resolves.toBe(
      VALID_NARRATION_TEXT,
    );
    await expect(
      fs
        .readFile(
          path.join(boundary.outputDir, "elevenlabs", "narration-attempt.json"),
          "utf8",
        )
        .then(JSON.parse),
    ).resolves.toMatchObject({ status: "request_started" });
    for (const filename of ["narration.mp3", "narration-timestamps.json"]) {
      await expect(
        fs.lstat(path.join(boundary.outputDir, "elevenlabs", filename)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("preserves dry-run narration bytes and inode through the public generate wrapper", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const boundary = await publicGenerateWrapperFixture({
      fixtureRoot,
      outputName: "dry-run-then-public-generate",
      voiceId,
    });
    const dryRun = spawnSync(
      process.execPath,
      ["scripts/generate-elevenlabs-demo.mjs", "--voice-id", voiceId],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: boundary.environment,
      },
    );
    expect(dryRun.status, `${dryRun.stdout}${dryRun.stderr}`).toBe(0);
    const dryRunMetadata = await fs.lstat(boundary.narrationPath);
    await expect(fs.lstat(boundary.fetchLog)).rejects.toMatchObject({
      code: "ENOENT",
    });

    const result = runPublicGenerate(
      fixtureRoot,
      voiceId,
      boundary.environment,
    );
    const output = `${result.stdout}${result.stderr}`;
    const wrapper = JSON.parse(await fs.readFile(boundary.wrapperLog, "utf8"));
    const finalMetadata = await fs.lstat(boundary.narrationPath);
    const fetches = (await fs.readFile(boundary.fetchLog, "utf8"))
      .trim()
      .split("\n");

    expect(result.status).not.toBe(0);
    expect(wrapper.before).toEqual(wrapper.after);
    expect(wrapper.before).toMatchObject({
      dev: dryRunMetadata.dev,
      ino: dryRunMetadata.ino,
      bytes: dryRunMetadata.size,
    });
    expect(finalMetadata).toMatchObject({
      dev: dryRunMetadata.dev,
      ino: dryRunMetadata.ino,
      size: dryRunMetadata.size,
    });
    expect(fetches).toHaveLength(2);
    expect(fetches[0]).toContain(`voice_ids=${voiceId}`);
    expect(fetches[1]).toContain(
      `/v1/text-to-speech/${voiceId}/with-timestamps?`,
    );
    expect(output).not.toContain("EEXIST");
    expect(output).not.toContain("offline-wrapper-test-key");
    await expect(fs.readFile(boundary.narrationPath, "utf8")).resolves.toBe(
      VALID_NARRATION_TEXT,
    );
  });

  it("never replaces existing narration text during dry-run or credentialed publication", async () => {
    for (const credentialedRequest of [false, true]) {
      const fixtureRoot = await credentialedGenerationFixture();
      const outputName = credentialedRequest
        ? "existing-credentialed-narration"
        : "existing-dry-run-narration";
      const { outputDir } = await provisionCapture(
        fixtureRoot,
        outputName,
        await fixtureHead(fixtureRoot),
      );
      const narrationPath = path.join(outputDir, "elevenlabs", "narration.txt");
      const existingNarration = "Owner-approved historical narration.\n";
      await fs.writeFile(narrationPath, existingNarration);

      const result = spawnSync(
        process.execPath,
        [
          "scripts/generate-elevenlabs-demo.mjs",
          ...(credentialedRequest ? ["--credentialed-request"] : []),
          "--voice-id",
          "OZxMHsGaBmV5pjMIDIn0",
        ],
        {
          cwd: fixtureRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            ELEVENLABS_API_KEY: "offline-test-key",
            NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
            WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
            WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
          },
        },
      );
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain(
        "narration.txt already exists with different content. Resolve and archive the prior narration text",
      );
      expect(output).not.toContain("FETCH_SENTINEL_CALLED");
      expect(output).not.toContain("offline-test-key");
      await expect(fs.readFile(narrationPath, "utf8")).resolves.toBe(
        existingNarration,
      );
      await expect(
        fs.readdir(path.join(outputDir, "elevenlabs")),
      ).resolves.toEqual(["narration.txt"]);
    }
  });

  it("rejects symlinked and non-regular narration text without mutating them", async () => {
    for (const existingKind of ["symlink", "directory"] as const) {
      const fixtureRoot = await credentialedGenerationFixture();
      const outputName = `existing-${existingKind}-narration`;
      const { outputDir } = await provisionCapture(
        fixtureRoot,
        outputName,
        await fixtureHead(fixtureRoot),
      );
      const narrationDir = path.join(outputDir, "elevenlabs");
      const narrationPath = path.join(narrationDir, "narration.txt");
      const outsideText = path.join(
        fixtureRoot,
        "output",
        `${outputName}-outside.txt`,
      );
      if (existingKind === "symlink") {
        await fs.writeFile(outsideText, "Outside narration target.\n");
        await fs.symlink(outsideText, narrationPath);
      } else {
        await fs.mkdir(narrationPath);
      }

      const result = spawnSync(
        process.execPath,
        [
          "scripts/generate-elevenlabs-demo.mjs",
          "--voice-id",
          "OZxMHsGaBmV5pjMIDIn0",
        ],
        {
          cwd: fixtureRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
            WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
            WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
          },
        },
      );
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toMatch(/symbolic link|anchored regular file/i);
      expect(output).not.toContain("FETCH_SENTINEL_CALLED");
      expect(
        (await fs.readdir(narrationDir)).filter((filename) =>
          filename.startsWith(".narration-text-"),
        ),
      ).toEqual([]);
      if (existingKind === "symlink") {
        expect((await fs.lstat(narrationPath)).isSymbolicLink()).toBe(true);
        await expect(fs.readFile(outsideText, "utf8")).resolves.toBe(
          "Outside narration target.\n",
        );
      } else {
        expect((await fs.lstat(narrationPath)).isDirectory()).toBe(true);
        await expect(fs.readdir(narrationPath)).resolves.toEqual([]);
      }
    }
  });

  it("rejects a post-receipt caption swap before any provider access", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const releaseId = "reasonweave-anchored-input";
    const relativeMediaDir = `docs/media/${releaseId}`;
    const releaseMediaDir = path.join(fixtureRoot, relativeMediaDir);
    const maliciousSrt =
      "1\n00:00:00,000 --> 00:00:01,000\nParent-swap narration.\n";
    await provisionReleaseMedia(fixtureRoot, releaseId);
    const preload = "caption-post-receipt-swap.cjs";
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const crypto = require("node:crypto");',
        'const fs = require("node:fs");',
        'const fsPromises = require("node:fs/promises");',
        'const path = require("node:path");',
        'const { syncBuiltinESMExports } = require("node:module");',
        'globalThis.fetch = () => { throw new Error("FETCH_SENTINEL_CALLED"); };',
        "const swapLog = path.resolve(process.env.SWAP_LOG);",
        'const captionsName = "seeded-demo-rehearsal.srt";',
        `const maliciousSrt = ${JSON.stringify(maliciousSrt)};`,
        "const state = { receiptRead: false, tampered: false, receiptSha256: null };",
        "fs.mkdirSync(path.dirname(swapLog), { recursive: true });",
        "const persist = () => fs.writeFileSync(swapLog, JSON.stringify(state));",
        'const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");',
        "const originalReadFile = fsPromises.readFile.bind(fsPromises);",
        "fsPromises.readFile = async (filePath, ...args) => {",
        "  if (path.basename(String(filePath)) !== captionsName || state.tampered) return originalReadFile(filePath, ...args);",
        "  const value = await originalReadFile(filePath, ...args);",
        "  state.receiptRead = true;",
        "  state.receiptSha256 = sha256(value);",
        "  fs.writeFileSync(filePath, maliciousSrt);",
        "  state.tampered = true;",
        "  persist();",
        "  return value;",
        "};",
        "syncBuiltinESMExports();",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, [
      "add",
      preload,
      relativeMediaDir,
      `docs/screenshots/${releaseId}`,
    ]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "caption swap fixture"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const outputName = "anchored-caption-snapshot";
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    const swapLog = path.join(
      fixtureRoot,
      "output",
      "race-test-logs",
      "caption-swap.json",
    );
    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        "OZxMHsGaBmV5pjMIDIn0",
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: relativeMediaDir,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const state = JSON.parse(await fs.readFile(swapLog, "utf8"));
    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "does not match its validated release media receipt",
    );
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    expect(state).toMatchObject({ receiptRead: true, tampered: true });
    expect(state.receiptSha256).not.toBe(sha256(maliciousSrt));
    await expect(
      fs.access(path.join(outputDir, "elevenlabs", "narration.txt")),
    ).rejects.toThrow();
    await expect(
      fs.readFile(
        path.join(releaseMediaDir, "seeded-demo-rehearsal.srt"),
        "utf8",
      ),
    ).resolves.toBe(maliciousSrt);
  });

  it("verifies the voice before writing the single-attempt receipt and POST", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "generate-elevenlabs-demo.mjs"),
      "utf8",
    );
    const firstVerification = source.indexOf(
      "verifyApprovedVoiceForGeneration({",
    );
    const expectedMode = source.indexOf(
      "expectedVerificationMode: releaseNarration.verificationMode",
      firstVerification,
    );
    const assertedMode = source.indexOf(
      "verification.mode === releaseNarration.verificationMode",
      expectedMode,
    );
    const receipt = source.indexOf("JSON.stringify(attempt, null, 2)");
    const post = source.indexOf('method: "POST"');
    expect(firstVerification).toBeGreaterThanOrEqual(0);
    expect(expectedMode).toBeGreaterThan(firstVerification);
    expect(assertedMode).toBeGreaterThan(expectedMode);
    expect(receipt).toBeGreaterThan(assertedMode);
    expect(post).toBeGreaterThan(receipt);
  });

  it("refuses a dirty/untracked checkout before any provider fetch or POST", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    await fs.writeFile(
      path.join(fixtureRoot, "untracked-change.txt"),
      "dirty\n",
    );

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        "OZxMHsGaBmV5pjMIDIn0",
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          NODE_OPTIONS: "--require ./fetch-sentinel.cjs",
          WONDERLAB_CAPTURE_OUTPUT: "output/playwright/dirty-credentialed-run",
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Refusing to load ElevenLabs credentials into a dirty or untracked Git tree",
    );
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    expect(
      await fs
        .access(
          path.join(
            fixtureRoot,
            "output",
            "playwright",
            "dirty-credentialed-run",
            "elevenlabs",
            "narration-attempt.json",
          ),
        )
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it("rejects a capture source SHA mismatch before any provider fetch or POST", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "mismatched-capture";
    await provisionCapture(fixtureRoot, outputName, "a".repeat(40));

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Capture source checkpoint does not match the current Git checkpoint",
    );
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
  });

  it("rejects a missing approval receipt before any provider fetch or POST", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "missing-approval";
    await provisionCapture(
      fixtureRoot,
      outputName,
      await fixtureHead(fixtureRoot),
    );

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("approved-voice.json");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
  });

  it("rejects a symlinked narration directory before any provider fetch or POST", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "symlinked-narration";
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      await fixtureHead(fixtureRoot),
    );
    const narrationDir = path.join(outputDir, "elevenlabs");
    const outside = path.join(fixtureRoot, "outside-narration");
    await fs.mkdir(outside);
    await fs.rmdir(narrationDir);
    await fs.symlink(outside, narrationDir);

    const result = runCredentialedGeneration(
      fixtureRoot,
      outputName,
      "fetch-sentinel.cjs",
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("must be a real directory");
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
  });

  it("fails closed when the capture output is swapped at the narration-text open boundary", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "capture-output-swap";
    const outsideCapture = path.join(fixtureRoot, "outside-capture");
    const swapLog = path.join(fixtureRoot, "capture-output-swap.json");
    const preload = "capture-output-swap.cjs";
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const fs = require("node:fs");',
        'const fsPromises = require("node:fs/promises");',
        'const path = require("node:path");',
        'const { syncBuiltinESMExports } = require("node:module");',
        'globalThis.fetch = () => { throw new Error("FETCH_SENTINEL_CALLED"); };',
        "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
        "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
        "const swapLog = path.resolve(process.env.SWAP_LOG);",
        "const parkedOutput = `${publicOutput}-parked`;",
        "const state = { swapped: false, openedOutside: false, writeReachedOutside: false };",
        "let outsideCaptureReal;",
        "const persist = () => fs.writeFileSync(swapLog, JSON.stringify(state));",
        "const originalOpen = fsPromises.open.bind(fsPromises);",
        "fsPromises.open = async (filePath, ...args) => {",
        '  if (!state.swapped && path.basename(filePath).startsWith(".narration-text-")) {',
        '    fs.mkdirSync(path.join(outsideCapture, "elevenlabs"), { recursive: true });',
        "    outsideCaptureReal = fs.realpathSync(outsideCapture);",
        "    fs.renameSync(publicOutput, parkedOutput);",
        "    fs.symlinkSync(outsideCapture, publicOutput);",
        "    state.swapped = true;",
        "    persist();",
        "  }",
        "  const handle = await originalOpen(filePath, ...args);",
        "  if (state.swapped && fs.realpathSync(path.dirname(filePath)).startsWith(`${outsideCaptureReal}${path.sep}`)) {",
        "    state.openedOutside = true;",
        "    persist();",
        "    const originalWriteFile = handle.writeFile.bind(handle);",
        "    handle.writeFile = async (...writeArgs) => {",
        "      state.writeReachedOutside = true;",
        "      persist();",
        "      return originalWriteFile(...writeArgs);",
        "    };",
        "  }",
        "  return handle;",
        "};",
        "syncBuiltinESMExports();",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", preload]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "capture swap preload"]);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      await fixtureHead(fixtureRoot),
    );

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        "OZxMHsGaBmV5pjMIDIn0",
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          SWAP_OUTSIDE_CAPTURE: outsideCapture,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const swap = JSON.parse(await fs.readFile(swapLog, "utf8"));

    expect(result.status).not.toBe(0);
    expect(output).not.toContain("FETCH_SENTINEL_CALLED");
    expect(output).not.toContain("offline-test-key");
    expect(swap).toEqual({
      swapped: true,
      openedOutside: false,
      writeReachedOutside: false,
    });
    await expect(
      fs.access(path.join(outsideCapture, "elevenlabs", "narration.txt")),
    ).rejects.toThrow();
    await expect(
      fs.readdir(path.join(outsideCapture, "elevenlabs")),
    ).resolves.toEqual([]);
    await expect(
      fs.access(path.join(outputDir, "elevenlabs", "narration.txt")),
    ).rejects.toThrow();
  });

  it("stops before the paid POST when the public capture output is swapped during exact-ID verification", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "pre-post-output-swap";
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const outsideCapture = path.join(
      fixtureRoot,
      "output",
      "outside-pre-post-capture",
    );
    const testLogDir = path.join(fixtureRoot, "output", "race-test-logs");
    const fetchLog = path.join(testLogDir, "pre-post-fetch.log");
    const swapLog = path.join(testLogDir, "pre-post-swap.json");
    const preload = "fake-pre-post-output-swap.cjs";
    await fs.mkdir(testLogDir, { recursive: true });
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
        "const parkedOutput = `${publicOutput}-parked`;",
        "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
        "const fetchLog = path.resolve(process.env.FETCH_LOG_PATH);",
        "const swapLog = path.resolve(process.env.SWAP_LOG);",
        "const state = { swapped: false, getCount: 0, postCount: 0 };",
        "const persist = () => fs.writeFileSync(swapLog, JSON.stringify(state));",
        "globalThis.fetch = async (url, init = {}) => {",
        '  const method = init.method || "GET";',
        "  fs.appendFileSync(fetchLog, `${method} ${url}\\n`);",
        '  if (method === "GET") {',
        "    state.getCount += 1;",
        '    fs.mkdirSync(path.join(outsideCapture, "elevenlabs"), { recursive: true });',
        "    fs.renameSync(publicOutput, parkedOutput);",
        "    fs.symlinkSync(outsideCapture, publicOutput);",
        "    state.swapped = true;",
        "    persist();",
        '    return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
        "  }",
        '  if (method === "POST") {',
        "    state.postCount += 1;",
        "    persist();",
        `    return { ok: true, status: 200, json: async () => ({ audio_base64: ${JSON.stringify(VALID_MP3_BASE64)}, alignment: { characters: [] } }) };`,
        "  }",
        '  throw new Error("UNEXPECTED_FETCH_METHOD");',
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", preload]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "fake pre-post swap"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    await writeUserSelectedApproval({ outputDir, sourceSha, voiceId });

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          SWAP_OUTSIDE_CAPTURE: outsideCapture,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const fetches = (await fs.readFile(fetchLog, "utf8")).trim().split("\n");
    const swap = JSON.parse(await fs.readFile(swapLog, "utf8"));

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "The public capture output changed during narration generation.",
    );
    expect(fetches).toHaveLength(1);
    expect(fetches[0]).toMatch(
      /^GET https:\/\/api\.elevenlabs\.io\/v2\/voices\?/,
    );
    expect(fetches[0]).toContain(`voice_ids=${voiceId}`);
    expect(fetches[0]).not.toContain("POST ");
    expect(swap).toEqual({ swapped: true, getCount: 1, postCount: 0 });
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.readdir(path.join(outsideCapture, "elevenlabs")),
    ).resolves.toEqual([]);
  });

  it("fails before the exact-ID GET when the capture swaps after approval evidence is read", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "pre-exact-get-output-swap";
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const outsideCapture = path.join(
      fixtureRoot,
      "output",
      "outside-pre-exact-get-capture",
    );
    const testLogDir = path.join(fixtureRoot, "output", "race-test-logs");
    const fetchLog = path.join(testLogDir, "pre-exact-get-fetch.log");
    const swapLog = path.join(testLogDir, "pre-exact-get-swap.json");
    const preload = "fake-pre-exact-get-output-swap.cjs";
    await fs.mkdir(testLogDir, { recursive: true });
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const fs = require("node:fs");',
        'const fsp = require("node:fs/promises");',
        'const path = require("node:path");',
        'const { syncBuiltinESMExports } = require("node:module");',
        "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
        "const parkedOutput = `${publicOutput}-parked`;",
        "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
        "const state = { swapped: false, fetches: 0 };",
        "const persist = () => fs.writeFileSync(process.env.SWAP_LOG, JSON.stringify(state));",
        "const originalOpen = fsp.open;",
        "fsp.open = async (filePath, ...args) => {",
        "  const handle = await originalOpen(filePath, ...args);",
        '  if (!state.swapped && path.basename(filePath) === "approved-voice.json") {',
        '    fs.mkdirSync(path.join(outsideCapture, "elevenlabs"), { recursive: true });',
        "    fs.renameSync(publicOutput, parkedOutput);",
        "    fs.symlinkSync(outsideCapture, publicOutput);",
        "    state.swapped = true;",
        "    persist();",
        "  }",
        "  return handle;",
        "};",
        "syncBuiltinESMExports();",
        "globalThis.fetch = async () => {",
        "  state.fetches += 1;",
        "  persist();",
        '  fs.appendFileSync(process.env.FETCH_LOG_PATH, "FETCH\\n");',
        '  throw new Error("FETCH_MUST_NOT_RUN");',
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", preload]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "pre exact-get swap"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    await writeUserSelectedApproval({ outputDir, sourceSha, voiceId });

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          SWAP_OUTSIDE_CAPTURE: outsideCapture,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const swap = JSON.parse(await fs.readFile(swapLog, "utf8"));

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "The public capture output changed during narration generation.",
    );
    expect(swap).toEqual({ swapped: true, fetches: 0 });
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(
        path.join(outsideCapture, "elevenlabs", "narration-attempt.json"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(path.join(outsideCapture, "elevenlabs", "narration.mp3")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(output).not.toContain("offline-test-key");
  });

  it("fails before the paid POST when the capture swaps after its attempt receipt", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "pre-paid-post-output-swap";
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const outsideCapture = path.join(
      fixtureRoot,
      "output",
      "outside-pre-paid-post-capture",
    );
    const testLogDir = path.join(fixtureRoot, "output", "race-test-logs");
    const fetchLog = path.join(testLogDir, "pre-paid-post-fetch.log");
    const swapLog = path.join(testLogDir, "pre-paid-post-swap.json");
    const preload = "fake-pre-paid-post-output-swap.cjs";
    await fs.mkdir(testLogDir, { recursive: true });
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const fs = require("node:fs");',
        'const fsp = require("node:fs/promises");',
        'const path = require("node:path");',
        'const { syncBuiltinESMExports } = require("node:module");',
        "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
        "const parkedOutput = `${publicOutput}-parked`;",
        "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
        "const state = { swapped: false, getCount: 0, postCount: 0 };",
        "const persist = () => fs.writeFileSync(process.env.SWAP_LOG, JSON.stringify(state));",
        "const originalStat = fsp.stat;",
        "fsp.stat = async (filePath, ...args) => {",
        "  const metadata = await originalStat(filePath, ...args);",
        '  if (!state.swapped && filePath === "." && fs.existsSync(path.join(process.cwd(), "narration-attempt.json"))) {',
        '    fs.mkdirSync(path.join(outsideCapture, "elevenlabs"), { recursive: true });',
        "    fs.renameSync(publicOutput, parkedOutput);",
        "    fs.symlinkSync(outsideCapture, publicOutput);",
        "    state.swapped = true;",
        "    persist();",
        "  }",
        "  return metadata;",
        "};",
        "syncBuiltinESMExports();",
        "globalThis.fetch = async (url, init = {}) => {",
        '  const method = init.method || "GET";',
        "  fs.appendFileSync(process.env.FETCH_LOG_PATH, `${method} ${url}\\n`);",
        '  if (method === "GET") {',
        "    state.getCount += 1;",
        "    persist();",
        '    return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
        "  }",
        '  if (method === "POST") {',
        "    state.postCount += 1;",
        "    persist();",
        '    throw new Error("PAID_POST_MUST_NOT_RUN");',
        "  }",
        '  throw new Error("UNEXPECTED_FETCH_METHOD");',
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", preload]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "pre paid-post swap"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    await writeUserSelectedApproval({ outputDir, sourceSha, voiceId });

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          SWAP_OUTSIDE_CAPTURE: outsideCapture,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const fetches = (await fs.readFile(fetchLog, "utf8")).trim().split("\n");
    const swap = JSON.parse(await fs.readFile(swapLog, "utf8"));

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "The public capture output changed during narration generation.",
    );
    expect(fetches).toHaveLength(1);
    expect(fetches[0]).toMatch(
      /^GET https:\/\/api\.elevenlabs\.io\/v2\/voices\?/,
    );
    expect(swap).toEqual({ swapped: true, getCount: 1, postCount: 0 });
    await expect(
      fs.access(path.join(outsideCapture, "elevenlabs", "narration.mp3")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(
        path.join(outsideCapture, "elevenlabs", "narration-timestamps.json"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(output).not.toContain("offline-test-key");
  });

  it("keeps the post-response decode temp anchored when the public capture output is swapped", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "decode-output-swap";
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const outsideCapture = path.join(
      fixtureRoot,
      "output",
      "outside-decode-capture",
    );
    const testLogDir = path.join(fixtureRoot, "output", "race-test-logs");
    const fetchLog = path.join(testLogDir, "decode-fetch.log");
    const swapLog = path.join(testLogDir, "decode-swap.json");
    const preload = "fake-decode-output-swap.cjs";
    await fs.mkdir(testLogDir, { recursive: true });
    await fs.writeFile(
      path.join(fixtureRoot, preload),
      [
        'const fs = require("node:fs");',
        'const fsPromises = require("node:fs/promises");',
        'const path = require("node:path");',
        'const { syncBuiltinESMExports } = require("node:module");',
        "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
        "const parkedOutput = `${publicOutput}-parked`;",
        "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
        "const fetchLog = path.resolve(process.env.FETCH_LOG_PATH);",
        "const swapLog = path.resolve(process.env.SWAP_LOG);",
        "const state = { swapped: false, getCount: 0, postCount: 0, openedAnchored: false, openedOutside: false, writeReachedAnchored: false, writeReachedOutside: false };",
        "const persist = () => fs.writeFileSync(swapLog, JSON.stringify(state));",
        "globalThis.fetch = async (url, init = {}) => {",
        '  const method = init.method || "GET";',
        "  fs.appendFileSync(fetchLog, `${method} ${url}\\n`);",
        '  if (method === "GET") {',
        "    state.getCount += 1;",
        "    persist();",
        '    return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
        "  }",
        '  if (method === "POST") {',
        "    state.postCount += 1;",
        "    persist();",
        `    return { ok: true, status: 200, json: async () => ({ audio_base64: ${JSON.stringify(VALID_MP3_BASE64)}, alignment: { characters: [] } }) };`,
        "  }",
        '  throw new Error("UNEXPECTED_FETCH_METHOD");',
        "};",
        "const originalOpen = fsPromises.open.bind(fsPromises);",
        "fsPromises.open = async (filePath, ...args) => {",
        '  const isDecodeTemp = path.basename(filePath).startsWith(".narration-decode-");',
        "  if (isDecodeTemp && !state.swapped) {",
        '    fs.mkdirSync(path.join(outsideCapture, "elevenlabs"), { recursive: true });',
        "    fs.renameSync(publicOutput, parkedOutput);",
        "    fs.symlinkSync(outsideCapture, publicOutput);",
        "    state.swapped = true;",
        "    persist();",
        "  }",
        "  const handle = await originalOpen(filePath, ...args);",
        "  if (isDecodeTemp) {",
        "    const openedPath = fs.realpathSync(filePath);",
        '    const anchoredRoot = `${fs.realpathSync(path.join(parkedOutput, "elevenlabs"))}${path.sep}`;',
        '    const outsideRoot = `${fs.realpathSync(path.join(outsideCapture, "elevenlabs"))}${path.sep}`;',
        "    const openedAnchored = openedPath.startsWith(anchoredRoot);",
        "    const openedOutside = openedPath.startsWith(outsideRoot);",
        "    state.openedAnchored ||= openedAnchored;",
        "    state.openedOutside ||= openedOutside;",
        "    persist();",
        "    const originalWriteFile = handle.writeFile.bind(handle);",
        "    handle.writeFile = async (...writeArgs) => {",
        "      state.writeReachedAnchored ||= openedAnchored;",
        "      state.writeReachedOutside ||= openedOutside;",
        "      persist();",
        "      return originalWriteFile(...writeArgs);",
        "    };",
        "  }",
        "  return handle;",
        "};",
        "syncBuiltinESMExports();",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", preload]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "fake decode swap"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    await writeUserSelectedApproval({ outputDir, sourceSha, voiceId });

    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: `--require ./${preload}`,
          SWAP_LOG: swapLog,
          SWAP_OUTSIDE_CAPTURE: outsideCapture,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    const fetches = (await fs.readFile(fetchLog, "utf8")).trim().split("\n");
    const swap = JSON.parse(await fs.readFile(swapLog, "utf8"));

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "The public capture output changed during narration generation.",
    );
    expect(fetches).toHaveLength(2);
    expect(fetches[0]).toMatch(
      /^GET https:\/\/api\.elevenlabs\.io\/v2\/voices\?/,
    );
    expect(fetches[1]).toMatch(
      new RegExp(
        `^POST https://api\\.elevenlabs\\.io/v1/text-to-speech/${voiceId}/with-timestamps\\?`,
      ),
    );
    expect(swap).toEqual({
      swapped: true,
      getCount: 1,
      postCount: 1,
      openedAnchored: true,
      openedOutside: false,
      writeReachedAnchored: true,
      writeReachedOutside: false,
    });
    expect(output).not.toContain("offline-test-key");
    await expect(
      fs.readdir(path.join(outsideCapture, "elevenlabs")),
    ).resolves.toEqual([]);
    for (const artifact of [
      "narration.mp3",
      "narration-timestamps.json",
      "narration-attempt.json",
    ]) {
      await expect(
        fs.access(path.join(`${outputDir}-parked`, "elevenlabs", artifact)),
      ).resolves.toBeUndefined();
    }
  });

  it("rejects catalog-approved generation mode before provider access or an attempt receipt", async () => {
    const fixtureRoot = await credentialedGenerationFixture({
      voiceId: "voice_alpha",
    });
    const outputName = "changed-live-metadata";
    await fs.writeFile(
      path.join(fixtureRoot, "fake-catalog.cjs"),
      [
        'const fs = require("node:fs");',
        "globalThis.fetch = async (url, init = {}) => {",
        '  fs.appendFileSync(process.env.FETCH_LOG_PATH, `${init.method || "GET"} ${url}\\n`);',
        "  return {",
        "    ok: true,",
        "    status: 200,",
        "    json: async () => ({",
        '      voices: [{ voice_id: "voice_alpha", name: "Renamed Narrator", category: "premade" }],',
        "      has_more: false,",
        "    }),",
        "  };",
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", "fake-catalog.cjs"]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "fake catalog"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    const evidence = await approvedVoiceEvidence(sourceSha);
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "approved-voice.json"),
      `${JSON.stringify(evidence.approvalRecord)}\n`,
    );
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "preview-voice.json"),
      `${JSON.stringify(evidence.previewRecord)}\n`,
    );
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "premade-preview.mp3"),
      evidence.previewAudio,
    );
    const fetchLog = path.join(outputDir, "fetch.log");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        "voice_alpha",
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: "--require ./fake-catalog.cjs",
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Approved voice verification mode does not match the canonical release narration config",
    );
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(path.join(outputDir, "elevenlabs", "narration-attempt.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(output).not.toContain("offline-test-key");
  });

  it("rejects pinned-premade generation mode before provider access or an attempt receipt", async () => {
    const fixtureRoot = await credentialedGenerationFixture({
      voiceId: "JBFqnCBsd6RMkjVDRZzb",
    });
    const outputName = "pinned-george-generation";
    await fs.writeFile(
      path.join(fixtureRoot, "fake-pinned-generation.cjs"),
      [
        'const fs = require("node:fs");',
        "globalThis.fetch = async (url, init = {}) => {",
        '  const method = init.method || "GET";',
        "  fs.appendFileSync(process.env.FETCH_LOG_PATH, `${method} ${url}\\n`);",
        '  if (method === "GET") {',
        "    return {",
        "      ok: false,",
        "      status: 401,",
        '      json: async () => ({ detail: { status: "missing_permissions" } }),',
        "    };",
        "  }",
        '  if (method === "POST") {',
        '    const attempt = JSON.parse(fs.readFileSync(process.env.ATTEMPT_PATH, "utf8"));',
        '    if (attempt.status !== "request_started") throw new Error("RECEIPT_NOT_WRITTEN");',
        "    return {",
        "      ok: true,",
        "      status: 200,",
        "      json: async () => ({",
        `        audio_base64: ${JSON.stringify(VALID_MP3_BASE64)},`,
        "        alignment: { characters: [] },",
        "      }),",
        "    };",
        "  }",
        '  throw new Error("UNEXPECTED_FETCH_METHOD");',
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", "fake-pinned-generation.cjs"]);
    git(fixtureRoot, ["commit", "--quiet", "-m", "fake pinned provider"]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    const evidence = await pinnedGeorgeEvidence(sourceSha);
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "approved-voice.json"),
      `${JSON.stringify(evidence.approvalRecord)}\n`,
    );
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "preview-voice.json"),
      `${JSON.stringify(evidence.previewRecord)}\n`,
    );
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "premade-preview.mp3"),
      evidence.previewAudio,
    );
    const fetchLog = path.join(outputDir, "fetch.log");
    const attemptPath = path.join(
      outputDir,
      "elevenlabs",
      "narration-attempt.json",
    );
    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        evidence.voice.voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ATTEMPT_PATH: attemptPath,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: "--require ./fake-pinned-generation.cjs",
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Approved voice verification mode does not match the canonical release narration config",
    );
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(attemptPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(output).not.toContain("offline-test-key");
  });

  it("runs a user-selected TTS-only ID as exact GET, receipted POST, with no preview metadata", async () => {
    const fixtureRoot = await credentialedGenerationFixture();
    const outputName = "user-selected-generation";
    await fs.writeFile(
      path.join(fixtureRoot, "fake-user-selected-generation.cjs"),
      [
        'const fs = require("node:fs");',
        "globalThis.fetch = async (url, init = {}) => {",
        '  const method = init.method || "GET";',
        "  fs.appendFileSync(process.env.FETCH_LOG_PATH, `${method} ${url}\\n`);",
        '  if (method === "GET") return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
        '  if (method === "POST") {',
        '    const attempt = JSON.parse(fs.readFileSync(process.env.ATTEMPT_PATH, "utf8"));',
        '    if (attempt.status !== "request_started" || !attempt.voice.approvalDigest || attempt.voice.name || attempt.voice.reviewedPreviewSha256) throw new Error("BAD_USER_SELECTED_RECEIPT");',
        `    return { ok: true, status: 200, json: async () => ({ audio_base64: process.env.MALFORMED_AUDIO ? Buffer.from("ID3garbage").toString("base64") : ${JSON.stringify(VALID_MP3_BASE64)}, alignment: { characters: [] } }) };`,
        "  }",
        '  throw new Error("UNEXPECTED_FETCH_METHOD");',
        "};",
        "",
      ].join("\n"),
    );
    git(fixtureRoot, ["add", "fake-user-selected-generation.cjs"]);
    git(fixtureRoot, [
      "commit",
      "--quiet",
      "-m",
      "fake user selected provider",
    ]);
    const sourceSha = await fixtureHead(fixtureRoot);
    const { outputDir } = await provisionCapture(
      fixtureRoot,
      outputName,
      sourceSha,
    );
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const selectedAt = "2026-07-17T12:00:00.000Z";
    await fs.writeFile(
      path.join(outputDir, "elevenlabs", "approved-voice.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        provider: "elevenlabs",
        status: "approved",
        voice: { voiceId },
        verification: {
          schemaVersion: 1,
          mode: "user_selected_tts_only",
          source: "explicit_user_provided_exact_voice_id",
          voiceId,
          metadata: "unverified",
          preview: "not_performed",
          catalogDenial: {
            endpoint: "/v2/voices",
            status: 401,
            code: "missing_permissions",
          },
          selectedAt,
        },
        approval: {
          method: "explicit-cli-user-selected-voice-confirmation",
          selectedAt,
        },
        captureSourceSha: sourceSha,
      })}\n`,
    );
    const fetchLog = path.join(outputDir, "fetch.log");
    const attemptPath = path.join(
      outputDir,
      "elevenlabs",
      "narration-attempt.json",
    );
    const result = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ATTEMPT_PATH: attemptPath,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: fetchLog,
          NODE_OPTIONS: "--require ./fake-user-selected-generation.cjs",
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    const fetches = (await fs.readFile(fetchLog, "utf8")).trim().split("\n");
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(fetches).toHaveLength(2);
    expect(fetches[0]).toMatch(
      /^GET https:\/\/api\.elevenlabs\.io\/v2\/voices\?/,
    );
    expect(fetches[0]).toContain(`voice_ids=${voiceId}`);
    expect(fetches[1]).toMatch(
      new RegExp(
        `^POST https://api\\.elevenlabs\\.io/v1/text-to-speech/${voiceId}/with-timestamps\\?`,
      ),
    );

    const malformedOutputName = "user-selected-malformed-audio";
    const { outputDir: malformedOutputDir } = await provisionCapture(
      fixtureRoot,
      malformedOutputName,
      sourceSha,
    );
    await fs.copyFile(
      path.join(outputDir, "elevenlabs", "approved-voice.json"),
      path.join(malformedOutputDir, "elevenlabs", "approved-voice.json"),
    );
    const malformedFetchLog = path.join(malformedOutputDir, "fetch.log");
    const malformedAttemptPath = path.join(
      malformedOutputDir,
      "elevenlabs",
      "narration-attempt.json",
    );
    const malformed = spawnSync(
      process.execPath,
      [
        "scripts/generate-elevenlabs-demo.mjs",
        "--credentialed-request",
        "--voice-id",
        voiceId,
      ],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ATTEMPT_PATH: malformedAttemptPath,
          ELEVENLABS_API_KEY: "offline-test-key",
          FETCH_LOG_PATH: malformedFetchLog,
          MALFORMED_AUDIO: "1",
          NODE_OPTIONS: "--require ./fake-user-selected-generation.cjs",
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${malformedOutputName}`,
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${DEFAULT_RELEASE_ID}`,
        },
      },
    );
    expect(malformed.status).not.toBe(0);
    expect(`${malformed.stdout}${malformed.stderr}`).toMatch(/decode|MP3/i);
    expect(
      await fs
        .access(path.join(malformedOutputDir, "elevenlabs", "narration.mp3"))
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
    expect(
      (await fs.readFile(malformedFetchLog, "utf8")).trim().split("\n"),
    ).toHaveLength(2);
  });
});

describe("ElevenLabs assembly provenance binding", () => {
  it("resolves only real owned artifact directories beneath output/playwright", async () => {
    const fixtureRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "reasonweave-artifact-source-"),
    );
    temporaryRoots.push(fixtureRoot);
    const allowedOutputRoot = path.join(fixtureRoot, "output", "playwright");
    const currentOutput = path.join(allowedOutputRoot, "current");
    const priorOutput = path.join(allowedOutputRoot, "prior");
    await fs.mkdir(currentOutput, { recursive: true });
    await fs.mkdir(priorOutput, { recursive: true });

    await expect(
      resolveElevenLabsArtifactSource({
        root: fixtureRoot,
        allowedOutputRoot,
        outputDir: currentOutput,
        configuredSource: "prior",
      }),
    ).resolves.toEqual({
      outputReal: await fs.realpath(priorOutput),
      relativeOutputPath: "output/playwright/prior",
    });
    await expect(
      resolveElevenLabsArtifactSource({
        root: fixtureRoot,
        allowedOutputRoot,
        outputDir: currentOutput,
      }),
    ).resolves.toEqual({
      outputReal: await fs.realpath(currentOutput),
      relativeOutputPath: "output/playwright/current",
    });

    for (const configuredSource of [
      "../prior",
      "nested//prior",
      priorOutput,
      "prior\\escape",
    ]) {
      await expect(
        resolveElevenLabsArtifactSource({
          root: fixtureRoot,
          allowedOutputRoot,
          outputDir: currentOutput,
          configuredSource,
        }),
      ).rejects.toThrow(/relative child|traversal|inside/i);
    }

    await fs.symlink(priorOutput, path.join(allowedOutputRoot, "linked"));
    await expect(
      resolveElevenLabsArtifactSource({
        root: fixtureRoot,
        allowedOutputRoot,
        outputDir: currentOutput,
        configuredSource: "linked",
      }),
    ).rejects.toThrow(/real directories only/i);
  });

  it("requires the final learner-payoff, branch-choice, and export frames", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );

    for (const proof of [
      "09-branch-choice",
      "10-discovery-card-reflection",
      "10-discuss-trace",
      "11-export",
      "assertions?.finalChangeVisible === true",
      "assertions?.atAGlancePayoffVisible === true",
      "assertions?.selectedQuestionCloseupVisible === true",
      "assertions?.facilitatorPromptVisible === true",
      "assertions?.exportActionVisible === true",
    ]) {
      expect(source).toContain(proof);
    }
  });

  it("binds assembly media through the shared release path contract and records that contract", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );

    expect(source).toContain("resolveReleaseMediaPaths");
    expect(source).toContain('mode: "media-read"');
    for (const input of [
      "RELEASE_MEDIA_FILES.proofBoardPng",
      "RELEASE_MEDIA_FILES.closingCard",
      "RELEASE_MEDIA_FILES.captions",
      "readAnchoredFiles",
      "assertReleaseMediaInputsMatchReceipt({",
      "validateDemoReleaseInputs({",
      "proofBoardInput.content",
      "closingCardInput.content",
      "captions: captionsInput.content",
      "runBufferedChildProcess",
      '"image2pipe"',
      "{ input: closingCardInput.content }",
      "{ cwd: buildDir, input: captionsInput.content }",
      "endingReleaseMediaInputs",
      "assertReleaseMediaDirectoryIdentity(releaseMediaBinding)",
      "releaseMediaPathScript: await fileRecord(releaseMediaPathScriptPath)",
      "releaseMediaPathScript: releaseMediaPathScriptPath",
      "demoReleaseContractScript: await fileRecord(demoReleaseContractScriptPath)",
      "demoReleaseContractScript: demoReleaseContractScriptPath",
      "anchoredDirectoryOpsScript: await fileRecord(anchoredDirectoryOpsScriptPath)",
      "anchoredDirectoryOpsScript: anchoredDirectoryOpsScriptPath",
      "bufferedChildProcessScript: await fileRecord(bufferedChildProcessScriptPath)",
      "bufferedChildProcessScript: bufferedChildProcessScriptPath",
    ]) {
      expect(source).toContain(input);
    }
    expect(
      source.indexOf("assertReleaseMediaInputsMatchReceipt({"),
    ).toBeLessThan(source.indexOf("const proofBoardInput ="));
    expect(source).not.toContain('fs.readFile(captionsPath, "utf8")');
    expect(source).not.toContain("fs.copyFile(captionsPath, localCaptions)");
    expect(source).not.toContain("localProofBoard");
    expect(source).not.toContain("localClosingCard");
    expect(source).not.toContain("localCaptions");
    expect(source).not.toContain("makeStillClip(proofBoard,");
    expect(source).not.toMatch(/"-i",\s*closingCard,/);
  });

  it("loops buffered stills in the video filter and verifies the encoded video timeline", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );

    expect(source).toContain("loop=loop=-1:size=1:start=0");
    expect(source).not.toMatch(/"image2pipe",\s*"-loop",\s*"1"/);
    expect(source).toContain(
      "format=duration,size:stream=codec_name,codec_type,width,height,duration,nb_frames",
    );
    for (const contract of [
      "function assertVideoTimeline",
      '"loop",',
      'assertVideoTimeline(productMp4, PRODUCT_SECONDS, "Product segment")',
      'assertVideoTimeline(closingMp4, CLOSING_SECONDS, "Closing segment")',
      'assertVideoTimeline(silentVideo, FINAL_SECONDS, "Concatenated silent video")',
      'assertVideoTimeline(captionedVideo, FINAL_SECONDS, "Captioned video")',
      '"Final rehearsal"',
      "videoStreamDurationSeconds: finalTimeline.streamDuration",
      "videoFrameCount: finalTimeline.frameCount",
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("keeps release narration config recording, identity checks, and final input verification in parity", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );
    const recorded = source.indexOf(
      "releaseNarrationConfig: await fileRecord(releaseNarrationConfigPath)",
    );
    const identityCheck = source.indexOf(
      "inputRecords.releaseNarrationConfig.path === releaseNarration.record.path",
    );
    const inputPath = source.indexOf(
      "releaseNarrationConfig: releaseNarrationConfigPath",
    );
    const finalVerification = source.indexOf(
      "for (const [name, record] of Object.entries(inputRecords))",
    );

    expect(recorded).toBeGreaterThanOrEqual(0);
    expect(identityCheck).toBeGreaterThan(recorded);
    expect(source).toContain(
      "inputRecords.releaseNarrationConfig.sha256 ===\n      releaseNarration.record.sha256",
    );
    expect(inputPath).toBeGreaterThan(identityCheck);
    expect(finalVerification).toBeGreaterThan(inputPath);
    expect(source).toContain("inputPaths[name]");
  });

  it("requires external artifacts to carry the current narration binding without rebinding their capture to HEAD", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );

    expect(source).toContain("WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE");
    expect(source).toContain("resolveElevenLabsArtifactSource");
    expect(source).toMatch(
      /loadCaptureBinding\(\{\s*root,\s*outputDir: elevenLabsArtifactSource\.outputReal,\s*\}\)/,
    );
    expect(source).not.toContain("currentSourceSha: fullSha");
    expect(source).toContain(
      "attempt.captureSourceSha === captureBinding.captureSourceSha",
    );
    const narrationBinding = source.indexOf(
      "assertReleaseNarrationAttemptBinding(attempt, releaseNarration)",
    );
    const providerProbe = source.indexOf(
      "const providerProbe = probe(elevenLabsAudioPath)",
    );
    expect(narrationBinding).toBeGreaterThanOrEqual(0);
    expect(providerProbe).toBeGreaterThan(narrationBinding);
    expect(source).toContain(
      "providerCaptureManifest: await fileRecord(\n          elevenLabsNarration.captureManifestPath",
    );
    expect(source).toContain(
      "providerCaptureManifest: elevenLabsNarration.captureManifestPath",
    );
    expect(source).toContain(
      "captureManifest: inputRecords.providerCaptureManifest",
    );
    expect(source).toContain(
      "WONDERLAB_ELEVENLABS_ALLOW_ASSEMBLY_REPAIR_REUSE",
    );
    expect(source).toContain("WONDERLAB_ELEVENLABS_ASSEMBLY_REPAIR_SHA256");
    expect(source).toContain("function assemblyTimelineRepairReuse");
    expect(source).toContain('status === "M"');
    expect(source).toContain("ASSEMBLY_TIMELINE_REPAIR_PATHS");
    expect(source).toContain('mode: "assembly_timeline_repair"');
    expect(source).toContain(
      'mode: "assembly_timeline_and_preservation_repair"',
    );
    expect(source).toContain('"docs/public-name-migration.md"');
    expect(source).toContain('"docs/public-name-preservation-baseline.sha256"');
    expect(source).toContain("beforeBlob");
    expect(source).toContain("afterBlob");
    expect(source).toContain("transitionSha256");
    expect(source).toContain(
      "schemaVersion: elevenLabsNarration?.artifactReuse ? 3 : 2",
    );
  });

  it("records approval and attempt receipts in both inputs and narration manifest", async () => {
    const source = await fs.readFile(
      path.join(root, "scripts", "build-demo-rehearsal.mjs"),
      "utf8",
    );

    expect(source).toContain("APPROVED_VOICE_FILENAME");
    expect(source).toMatch(
      /elevenLabsApprovalPath\s*=\s*path\.join\(\s*elevenLabsDir,\s*APPROVED_VOICE_FILENAME,?\s*\)/,
    );
    expect(source).toMatch(
      /providerApproval:\s*await fileRecord\(\s*elevenLabsNarration\.approvalPath,?\s*\)/,
    );
    expect(source).toMatch(
      /providerAttempt:\s*await fileRecord\(\s*elevenLabsNarration\.attemptPath,?\s*\)/,
    );
    expect(source).toMatch(
      /providerPreviewRecord:\s*await fileRecord\(\s*elevenLabsNarration\.previewRecordPath,?\s*\)/,
    );
    expect(source).toMatch(
      /providerPreviewAudio:\s*await fileRecord\(\s*elevenLabsNarration\.previewAudioPath,?\s*\)/,
    );
    expect(source).toContain("approval: inputRecords.providerApproval");
    expect(source).toContain("attempt: inputRecords.providerAttempt");
    expect(source).toContain("record: inputRecords.providerPreviewRecord");
    expect(source).toContain("audio: inputRecords.providerPreviewAudio");
    expect(source).toContain(
      "verification: elevenLabsNarration.approvedVoice.verification",
    );
  });
});
