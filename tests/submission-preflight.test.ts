import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/submission-preflight.mjs");
type ParsedJson = ReturnType<typeof JSON.parse>;
const roots: string[] = [];
const FIXTURE_SOURCE_SHA = "a".repeat(40);
const FIXTURE_HEAD_SHA = "b".repeat(40);
const PROVIDER_SOURCE_SHA = "f".repeat(40);
const SCREENSHOT_SOURCE_SHA = "d".repeat(40);
const REVIEWER_SOURCE_SHA = "c".repeat(40);
const CANDIDATE_TREE_SHA = "e".repeat(40);
const PAST_TIMESTAMP = new Date(Date.now() - 60_000).toISOString();
const RELEASE_ID = "curiotrellis-2026-07-19";
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
const MEDIA_FILENAMES = [
  "technical-proof-board.svg",
  "technical-proof-board.png",
  "seeded-demo-rehearsal.srt",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
] as const;
const LIVE_EVAL_FIXTURE_IDS = [
  "underwater-habitat",
  "dreams",
  "car-free-city",
  "earworms",
  "plant-communication",
  "fair-games",
  "living-computer",
  "money",
  "relativity-time",
  "school-food-waste",
] as const;
const GENERATED_RELEASE_PATHS = [
  ...SCREENSHOT_FILENAMES.map(
    (filename) => `docs/screenshots/${RELEASE_ID}/${filename}`,
  ),
  `docs/screenshots/${RELEASE_ID}/.wonderlab-screenshot-output.json`,
  `docs/screenshots/${RELEASE_ID}/screenshot-receipt.json`,
  "technical-proof-board.png",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
  "release-media-receipt.json",
].map((value) =>
  value.includes("/") ? value : `docs/media/${RELEASE_ID}/${value}`,
);
GENERATED_RELEASE_PATHS.push("public/curiotrellis-og.png");
const ASSEMBLY_TIMELINE_REPAIR_PATHS = [
  "scripts/build-demo-rehearsal.mjs",
  "scripts/submission-preflight.mjs",
  "tests/demo-script-consistency.test.ts",
  "tests/elevenlabs-generation-boundary.test.ts",
  "tests/submission-preflight.test.ts",
].sort();
const ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS = [
  ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
  "docs/public-name-migration.md",
  "docs/public-name-preservation-baseline.sha256",
].sort();

function srtTimestamp(totalSeconds: number) {
  const milliseconds = Math.round(totalSeconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
}

const FIXTURE_CAPTION_TEXTS = Array.from(
  { length: 30 },
  (_, index) => `C${index + 1}`,
);
const FIXTURE_SRT = `${FIXTURE_CAPTION_TEXTS.map((text, index) => {
  const start = index * 5.8;
  const end = (index + 1) * 5.8;
  return `${index + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${text}`;
}).join("\n\n")}\n`;
const FIXTURE_NARRATION_TEXT = FIXTURE_CAPTION_TEXTS.join("\n\n");

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

async function fixtureRoot() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "wonderlab-submission-preflight-"),
  );
  roots.push(root);
  await Promise.all([
    fs.mkdir(path.join(root, "config"), { recursive: true }),
    fs.mkdir(path.join(root, "app"), { recursive: true }),
    fs.mkdir(path.join(root, "components"), { recursive: true }),
    fs.mkdir(path.join(root, "lib"), { recursive: true }),
    fs.mkdir(path.join(root, "docs"), { recursive: true }),
    fs.mkdir(path.join(root, "docs", "media", "curiotrellis-final"), {
      recursive: true,
    }),
    fs.mkdir(path.join(root, "output", "release"), { recursive: true }),
    fs.mkdir(path.join(root, "bin"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(root, "config/release-identity.json"),
      JSON.stringify({
        schemaVersion: 1,
        displayName: "CurioTrellis",
        slug: "curiotrellis",
        retiredDisplayNames: ["ReasonWeave"],
      }),
    ),
    fs.writeFile(
      path.join(root, "config/release-narration.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "elevenlabs",
        voiceId: "OZxMHsGaBmV5pjMIDIn0",
        verificationMode: "user_selected_tts_only",
      }),
    ),
    fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ name: "curiotrellis" }),
    ),
    fs.writeFile(
      path.join(root, "package-lock.json"),
      JSON.stringify({
        name: "curiotrellis",
        packages: { "": { name: "curiotrellis" } },
      }),
    ),
    fs.writeFile(
      path.join(root, "app/layout.tsx"),
      'applicationName: "CurioTrellis"\nimages: ["/curiotrellis-og.png"]\n',
    ),
    fs.writeFile(
      path.join(root, "components/discovery-card.tsx"),
      'anchor.download = "curiotrellis-learning-trace.md"\n',
    ),
    fs.writeFile(
      path.join(root, "lib/export-markdown.ts"),
      "# CurioTrellis Learning Trace\nCreated with CurioTrellis.\n",
    ),
    fs.writeFile(
      path.join(root, "README.md"),
      "# CurioTrellis\n\n> Make reasoning visible.\n\nCurioTrellis is the current release candidate.\n\n## Build status\n\nHistorical ReasonWeave evidence remains available.\n",
    ),
    fs.writeFile(
      path.join(root, "docs/devpost-draft.md"),
      "# Devpost submission draft\n\n## Project name\n\nCurioTrellis\n\n## Short description\n\nCurioTrellis makes reasoning visible.\n\n## Historical notes\n\nReasonWeave was a retired candidate.\n",
    ),
    fs.writeFile(
      path.join(root, "docs/demo-script.md"),
      "# Demo script\n\n## Timed script and shot list\n\nCurioTrellis makes learner reasoning visible.\n\n## Recording sequence\n\nHistorical ReasonWeave footage is retired.\n",
    ),
  ]);
  const preservedFixturePath = path.join(root, "docs", "preserved.txt");
  const preservedFixtureContent = Buffer.from("immutable fixture\n");
  await Promise.all([
    fs.writeFile(preservedFixturePath, preservedFixtureContent),
    fs.writeFile(
      path.join(root, "docs", "public-name-preservation-baseline.sha256"),
      `${createHash("sha256").update(preservedFixtureContent).digest("hex")}  docs/preserved.txt\n`,
    ),
  ]);
  const fakeGit = `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst args = process.argv.slice(2);\nfs.appendFileSync(process.env.PREFLIGHT_COMMAND_LOG, JSON.stringify(args) + "\\n");\nconst key = args.join(" ");\nif (key === "rev-parse --show-toplevel") process.stdout.write(process.cwd() + "\\n");\nelse if (key === "rev-parse HEAD") process.stdout.write((process.env.PREFLIGHT_HEAD_SHA || "${FIXTURE_HEAD_SHA}") + "\\n");\nelse if (key === "rev-parse ${FIXTURE_SOURCE_SHA}^{tree}") process.stdout.write("${CANDIDATE_TREE_SHA}\\n");\nelse if (key.startsWith("rev-parse ${PROVIDER_SOURCE_SHA}:")) process.stdout.write("${"1".repeat(40)}\\n");\nelse if (key.startsWith("rev-parse ${FIXTURE_SOURCE_SHA}:")) process.stdout.write("${"2".repeat(40)}\\n");\nelse if (key === "show -s --format=%cI HEAD") process.stdout.write((process.env.PREFLIGHT_HEAD_TIMESTAMP || new Date().toISOString()) + "\\n");\nelse if (key === "ls-remote --symref https://github.com/example/curiotrellis-reviewer HEAD") process.stdout.write("ref: refs/heads/main\\tHEAD\\n" + (process.env.PREFLIGHT_REVIEWER_REMOTE_SHA || "${REVIEWER_SOURCE_SHA}") + "\\tHEAD\\n");\nelse if (key === "ls-remote https://github.com/example/curiotrellis-reviewer") process.stdout.write((process.env.PREFLIGHT_REVIEWER_REMOTE_SHA || "${REVIEWER_SOURCE_SHA}") + "\\trefs/heads/main\\n");\nelse if (key === "status --porcelain=v1 --untracked-files=normal") process.stdout.write(process.env.PREFLIGHT_DIRTY === "true" ? " M package.json\\n" : "");\nelse if (key === "diff --check") process.exit(process.env.PREFLIGHT_BAD_DIFF === "true" ? 1 : 0);\nelse if (key === "ls-files --error-unmatch -- config/final-release-evidence.json") process.exit(process.env.PREFLIGHT_EVIDENCE_UNTRACKED === "true" ? 1 : 0);\nelse if (key === "show HEAD:config/final-release-evidence.json") process.stdout.write(process.env.PREFLIGHT_HEAD_EVIDENCE_MISMATCH === "true" ? "{}" : fs.readFileSync("config/final-release-evidence.json"));\nelse if (key.startsWith("merge-base --is-ancestor ")) process.exit(process.env.PREFLIGHT_ANCESTOR === "false" ? 1 : 0);\nelse if (key === "diff --name-only --no-renames ${SCREENSHOT_SOURCE_SHA}..${FIXTURE_SOURCE_SHA}") process.stdout.write(process.env.PREFLIGHT_SCREENSHOT_CHANGED_PATHS || ${JSON.stringify(`${GENERATED_RELEASE_PATHS.join("\n")}\n`)});\nelse if (key === "diff --name-status --no-renames ${SCREENSHOT_SOURCE_SHA}..${FIXTURE_SOURCE_SHA}") process.stdout.write(process.env.PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS || ${JSON.stringify(`${GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`).join("\n")}\n`)});\nelse if (key === "diff --name-only --no-renames ${FIXTURE_SOURCE_SHA}..${FIXTURE_HEAD_SHA}") process.stdout.write(process.env.PREFLIGHT_CHANGED_PATHS || "config/final-release-evidence.json\\n");\nelse if (key.startsWith("diff --name-status --no-renames ")) process.stdout.write(process.env.PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS || "");\nelse if (key.startsWith("diff --name-only --no-renames ")) process.stdout.write(process.env.PREFLIGHT_CHANGED_PATHS || "");\nelse process.exit(93);\n`;
  const fakeFfprobe = `#!/usr/bin/env node\nif (process.env.PREFLIGHT_BAD_FFPROBE === "true") process.exit(1);\nconst input = process.argv.at(-1);\nconst subtitles = process.env.PREFLIGHT_MULTI_SUBTITLE === "true" ? [{index:2,codec_type:"subtitle",codec_name:"mov_text"},{index:3,codec_type:"subtitle",codec_name:"mov_text"}] : [{index:2,codec_type:"subtitle",codec_name:"mov_text"}];\nconst videoDuration = process.env.PREFLIGHT_VIDEO_STREAM_DURATION || "174.000";\nconst videoFrameCount = process.env.PREFLIGHT_VIDEO_FRAME_COUNT || "5220";\nconst probe = input.endsWith(".mp3") ? {format:{duration:"12.000"},streams:[{codec_type:"audio",codec_name:"mp3"}]} : {format:{duration:"174.000"},streams:[{index:0,codec_type:"video",codec_name:"h264",width:1280,height:720,duration:videoDuration,nb_frames:videoFrameCount},{index:1,codec_type:"audio",codec_name:"aac"},...subtitles]};\nprocess.stdout.write(JSON.stringify(probe));\n`;
  const fakeFfmpeg = `#!/usr/bin/env node\nif (process.env.PREFLIGHT_BAD_FFMPEG === "true") process.exit(1);\nif (process.argv.includes("srt")) { process.stdout.write(process.env.PREFLIGHT_SUBTITLE_SRT !== undefined ? process.env.PREFLIGHT_SUBTITLE_SRT : ${JSON.stringify(FIXTURE_SRT)}); process.exit(0); }\nprocess.stderr.write("Integrated loudness:\\nI: -16.0 LUFS\\nTrue peak:\\nPeak: -2.0 dBFS\\n");\n`;
  const fakeGitWithBaselineTracking = fakeGit.replace(
    'else if (key === "ls-files --error-unmatch -- config/final-release-evidence.json")',
    'else if (key === "ls-files -z --") process.stdout.write("docs/preserved.txt\\0");\nelse if (key === "ls-files --error-unmatch -- config/final-release-evidence.json")',
  );
  await Promise.all([
    fs.writeFile(path.join(root, "bin/git"), fakeGitWithBaselineTracking, {
      mode: 0o755,
    }),
    fs.writeFile(path.join(root, "bin/ffprobe"), fakeFfprobe, {
      mode: 0o755,
    }),
    fs.writeFile(path.join(root, "bin/ffmpeg"), fakeFfmpeg, { mode: 0o755 }),
  ]);
  return root;
}

async function writeFinalReleaseEvidence(
  root: string,
  overrides: Record<string, unknown> = {},
) {
  const sourceSha = FIXTURE_SOURCE_SHA;
  const screenshotSourceSha = SCREENSHOT_SOURCE_SHA;
  const identityContent = await fs.readFile(
    path.join(root, "config/release-identity.json"),
  );
  const releaseIdentity = {
    path: "config/release-identity.json",
    sha256: createHash("sha256").update(identityContent).digest("hex"),
    displayName: "CurioTrellis",
    slug: "curiotrellis",
  };
  const narrationContent = await fs.readFile(
    path.join(root, "config/release-narration.json"),
  );
  const releaseNarration = {
    path: "config/release-narration.json",
    sha256: createHash("sha256").update(narrationContent).digest("hex"),
    provider: "elevenlabs",
    voiceId: "OZxMHsGaBmV5pjMIDIn0",
    verificationMode: "user_selected_tts_only",
  };
  const writeArtifact = async (
    relativePath: string,
    content: string | Buffer,
  ) => {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    await fs.writeFile(absolutePath, buffer);
    return {
      path: relativePath,
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  };
  const writeJsonArtifact = (relativePath: string, value: unknown) =>
    writeArtifact(relativePath, `${JSON.stringify(value, null, 2)}\n`);

  const screenshotDirectory = `docs/screenshots/${RELEASE_ID}`;
  const screenshotRecords = [];
  for (const [index, filename] of SCREENSHOT_FILENAMES.entries()) {
    screenshotRecords.push(
      await writeArtifact(
        `${screenshotDirectory}/${filename}`,
        Buffer.from(`fixture-jpeg-${index}-${filename}`),
      ),
    );
  }
  const screenshotOwnerPath = `${screenshotDirectory}/.wonderlab-screenshot-output.json`;
  await writeJsonArtifact(screenshotOwnerPath, {
    schemaVersion: 1,
    owner: "wonderlab-screenshot-output-v1",
    sourceSha: screenshotSourceSha,
    outputDir: screenshotDirectory,
    releaseIdentity,
  });
  const screenshotReceiptPath = `${screenshotDirectory}/screenshot-receipt.json`;
  const screenshotReceiptRecord = await writeJsonArtifact(
    screenshotReceiptPath,
    {
      schemaVersion: 1,
      kind: "wonderlab-screenshot-receipt",
      generatedAt: PAST_TIMESTAMP,
      source: { fullSha: screenshotSourceSha, cleanBeforeCapture: true },
      outputDir: screenshotDirectory,
      releaseIdentity,
      screenshots: screenshotRecords,
    },
  );
  const screenshotEvidence = {
    ownerPath: screenshotOwnerPath,
    receiptPath: screenshotReceiptPath,
    receiptSha256: screenshotReceiptRecord.sha256,
    releaseScreenshot: screenshotRecords.find((record) =>
      record.path.endsWith("/discovery-desktop.jpg"),
    ),
    sourceSha: screenshotSourceSha,
  };

  const mediaDirectory = `docs/media/${RELEASE_ID}`;
  const mediaRecords = [];
  for (const [index, filename] of MEDIA_FILENAMES.entries()) {
    mediaRecords.push({
      filename,
      ...(await writeArtifact(
        `${mediaDirectory}/${filename}`,
        filename === "seeded-demo-rehearsal.srt"
          ? FIXTURE_SRT
          : Buffer.from(`fixture-media-${index}-${filename}`),
      )),
    });
  }
  const publicOg = await writeArtifact(
    "public/curiotrellis-og.png",
    Buffer.from("fixture-public-og-png"),
  );
  const releaseMediaReceiptPath = `${mediaDirectory}/release-media-receipt.json`;
  const releaseMediaReceiptRecord = await writeJsonArtifact(
    releaseMediaReceiptPath,
    {
      schemaVersion: 1,
      kind: "wonderlab-release-media-receipt",
      generatedAt: PAST_TIMESTAMP,
      releaseDirectory: RELEASE_ID,
      releaseIdentity,
      screenshotEvidence,
      mediaFiles: mediaRecords,
      publicOg,
    },
  );

  const actualEvaluationPath =
    "output/evals/live-eval-2026-01-01T00-00-00-000Z.json";
  const actualEvaluationRecord = await writeJsonArtifact(actualEvaluationPath, {
    schemaVersion: 2,
    kind: "wonderlab-live-evaluation",
    generatedAt: PAST_TIMESTAMP,
    run: {
      startedAt: PAST_TIMESTAMP,
      completedAt: PAST_TIMESTAMP,
      durationMs: 1,
      targetOrigin: "https://curiotrellis.app",
      timeoutMs: 45_000,
      requestedFixtureLimit: LIVE_EVAL_FIXTURE_IDS.length,
      fixtureCount: LIVE_EVAL_FIXTURE_IDS.length,
      runnerAccessedApiKey: false,
    },
    privacy: { syntheticFixturesOnly: true, excludes: ["API keys"] },
    fixtures: LIVE_EVAL_FIXTURE_IDS.map((id) => ({
      id,
      question: `Why ${id}?`,
      settings: { level: "middle", durationMinutes: 20 },
      syntheticInput: {
        prediction: "A testable prediction.",
        evidenceDecision: { sourceId: "source-1" },
        evidenceApplication: { findingId: "finding-1" },
        artifact: "A learner-created model.",
      },
      startedAt: PAST_TIMESTAMP,
      completedAt: PAST_TIMESTAMP,
      durationMs: 1,
      stageTimings: Object.fromEntries(
        ["routes", "quest", "evidence", "reflection", "map"].map((stage) => [
          stage,
          { status: "completed", durationMs: 1 },
        ]),
      ),
      routes: [{ id: "route-1" }, { id: "route-2" }, { id: "route-3" }],
      selectedRoute: { id: "route-1" },
      quest: { title: "Investigate" },
      evidence: {
        bundle: {
          items: [
            {
              id: "finding-1",
              kind: "evidence",
              statement: "A sourced finding.",
              sourceIds: ["source-1"],
            },
            {
              id: "open-1",
              kind: "open_question",
              statement: "What should we investigate next?",
              sourceIds: [],
            },
          ],
          sources: [
            {
              id: "source-1",
              title: "NOAA source",
              url: "https://oceanservice.noaa.gov/facts",
              domain: "oceanservice.noaa.gov",
            },
          ],
          conciseExplanation: "The finding has one source.",
        },
        sourceAssociations: [
          {
            itemId: "finding-1",
            kind: "evidence",
            statement: "A sourced finding.",
            sourceIds: ["source-1"],
            sources: [
              {
                id: "source-1",
                title: "NOAA source",
                url: "https://oceanservice.noaa.gov/facts",
                domain: "oceanservice.noaa.gov",
              },
            ],
            unresolvedSourceIds: [],
          },
          {
            itemId: "open-1",
            kind: "open_question",
            statement: "What should we investigate next?",
            sourceIds: [],
            sources: [],
            unresolvedSourceIds: [],
          },
        ],
      },
      reflectionResult: { summary: "Reflection" },
      mapSummary: { nodeCount: 9 },
      failure: null,
      passed: true,
      checks: [
        "routes:routes-exactly-three",
        "routes:routes-unique-ids",
        "quest:quest-time-budget",
        "evidence:evidence-source-integrity",
        "evidence:evidence-all-references-resolve",
        "reflection:reflection-specific-feedback",
        "reflection-decision:reflection-decision-current-source",
        "reflection-decision:reflection-application-grounding",
        "map:map-node-count",
        "map:map-edge-integrity",
      ].map((checkId) => ({ id: checkId, passed: true, detail: "ok" })),
    })),
    summary: {
      passed: true,
      totalFixtures: LIVE_EVAL_FIXTURE_IDS.length,
      passedFixtures: LIVE_EVAL_FIXTURE_IDS.length,
      failedFixtures: 0,
      totalChecks: LIVE_EVAL_FIXTURE_IDS.length * 10,
      passedChecks: LIVE_EVAL_FIXTURE_IDS.length * 10,
      failedChecks: 0,
    },
  });
  const liveEvaluationReport = await writeJsonArtifact(
    "output/release/live-evaluation-report.json",
    {
      schemaVersion: 1,
      kind: "wonderlab-live-evaluation-report",
      releaseIdentity,
      source: { fullSha: sourceSha, cleanBeforeRun: true },
      model: { id: "gpt-5.6" },
      webSearch: { required: true, completed: true },
      citations: { required: true, present: true },
      citationReview: {
        humanReviewed: true,
        passed: true,
        reviewedAt: PAST_TIMESTAMP,
      },
      evaluationReport: actualEvaluationRecord,
    },
  );

  const reviewerRepositoryUrl =
    "https://github.com/example/curiotrellis-reviewer";
  const reviewerAccessPath =
    "output/release/curiotrellis-github-reviewer-access.json";
  const reviewerAccess = await writeJsonArtifact(reviewerAccessPath, {
    schemaVersion: 1,
    kind: "wonderlab-github-reviewer-access",
    repositoryUrl: reviewerRepositoryUrl,
    capturedAt: PAST_TIMESTAMP,
    grants: [
      {
        email: "testing@devpost.com",
        repositoryUrl: reviewerRepositoryUrl,
        githubLogin: "devpost-testing",
        permission: "pull",
        capturedAt: PAST_TIMESTAMP,
        captureSource: "github-api-collaborators",
      },
      {
        email: "build-week-event@openai.com",
        repositoryUrl: reviewerRepositoryUrl,
        githubLogin: "openai-build-week",
        permission: "pull",
        capturedAt: PAST_TIMESTAMP,
        captureSource: "github-api-collaborators",
      },
    ],
  });
  const historyAuditPath =
    "output/release/curiotrellis-reviewer-history-audit.json";
  const historyAudit = await writeJsonArtifact(historyAuditPath, {
    schemaVersion: 1,
    kind: "wonderlab-reviewer-history-audit",
    releaseIdentity,
    candidateSourceSha: sourceSha,
    reviewerRepository: {
      url: reviewerRepositoryUrl,
      fullSha: REVIEWER_SOURCE_SHA,
    },
    repositoryMode: "history_free_export",
    sourceMapping: {
      candidateFullSha: sourceSha,
      candidateTreeSha: CANDIDATE_TREE_SHA,
      reviewerFullSha: REVIEWER_SOURCE_SHA,
      reviewerTreeSha: CANDIDATE_TREE_SHA,
      treesMatch: true,
    },
    remoteVerification: {
      commitUrl: `${reviewerRepositoryUrl}/commit/${REVIEWER_SOURCE_SHA}`,
      verifiedAt: PAST_TIMESTAMP,
    },
    permissionEvidence: {
      captureMethod: "github-reviewer-access-export",
      recordPath: reviewerAccess.path,
      recordSha256: reviewerAccess.sha256,
      verifiedAt: PAST_TIMESTAMP,
      reviewerAccess: ["testing@devpost.com", "build-week-event@openai.com"],
    },
    auditedAt: PAST_TIMESTAMP,
    checks: {
      unverifiedRouteArtAbsent: true,
      largeBinariesAbsent: true,
      secretsScanPassed: true,
    },
  });

  const assemblyDirectory = `output/playwright/${RELEASE_ID}`;
  const approvalVerification = {
    schemaVersion: 1,
    mode: releaseNarration.verificationMode,
    source: "explicit_user_provided_exact_voice_id",
    voiceId: releaseNarration.voiceId,
    metadata: "unverified",
    preview: "not_performed",
    catalogDenial: {
      endpoint: "/v2/voices",
      status: 401,
      code: "missing_permissions",
    },
    selectedAt: PAST_TIMESTAMP,
  };
  const narrationCharacters = [...FIXTURE_NARRATION_TEXT];
  const narrationStarts = narrationCharacters.map((_, index) => index / 100);
  const narrationEnds = narrationCharacters.map(
    (_, index) => (index + 1) / 100,
  );
  const approvalPayload = {
    schemaVersion: 2,
    provider: "elevenlabs",
    status: "approved",
    voice: { voiceId: releaseNarration.voiceId },
    verification: approvalVerification,
    approval: {
      method: "explicit-cli-user-selected-voice-confirmation",
      selectedAt: PAST_TIMESTAMP,
    },
    captureSourceSha: sourceSha,
  };
  const approvalRecord = await writeJsonArtifact(
    `${assemblyDirectory}/elevenlabs/approved-voice.json`,
    approvalPayload,
  );
  const audioRecord = await writeArtifact(
    `${assemblyDirectory}/elevenlabs/narration.mp3`,
    Buffer.from("ID3fixture-audio"),
  );
  const timingRecord = await writeJsonArtifact(
    `${assemblyDirectory}/elevenlabs/narration-timestamps.json`,
    {
      voiceId: releaseNarration.voiceId,
      modelId: "eleven_multilingual_v2",
      sourceText: FIXTURE_NARRATION_TEXT,
      alignment: {
        characters: narrationCharacters,
        character_start_times_seconds: narrationStarts,
        character_end_times_seconds: narrationEnds,
      },
      normalizedAlignment: null,
    },
  );
  const attemptRecord = await writeJsonArtifact(
    `${assemblyDirectory}/elevenlabs/narration-attempt.json`,
    {
      schemaVersion: 1,
      provider: "elevenlabs",
      status: "artifacts_published",
      captureSourceSha: sourceSha,
      startedAt: PAST_TIMESTAMP,
      completedAt: PAST_TIMESTAMP,
      sourceTextSha256: createHash("sha256")
        .update(FIXTURE_NARRATION_TEXT)
        .digest("hex"),
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      voice: {
        voiceId: releaseNarration.voiceId,
        approvalDigest: createHash("sha256")
          .update(stableJson(approvalPayload))
          .digest("hex"),
        verification: approvalVerification,
      },
      artifacts: {
        audio: { bytes: audioRecord.bytes, sha256: audioRecord.sha256 },
        timing: { bytes: timingRecord.bytes, sha256: timingRecord.sha256 },
      },
      releaseIdentity,
      releaseNarration,
      releaseMediaReceipt: {
        path: releaseMediaReceiptRecord.path,
        sha256: releaseMediaReceiptRecord.sha256,
      },
    },
  );
  const productTakeRecord = await writeArtifact(
    `${assemblyDirectory}/product-take.webm`,
    Buffer.from("fixture-captured-product-video"),
  );
  const captureAssertions = {
    openingDisclosuresVisible: true,
    seededLaunchVerified: true,
    evidenceDecisionRecorded: true,
    evidenceApplicationRecorded: true,
    artifactAnchorRecorded: true,
    creationReviewChecked: true,
    allReflectionFieldsShown: true,
    nextQuestionChoice: {
      checked: true,
      mapSelectedCount: 1,
      mapUnselectedCount: 2,
    },
    mapNodeCount: 9,
    mapNodeMinimumOpacity: 1,
    mapNodesInViewport: true,
    exportVerified: true,
    seededBadgeVisible: true,
  };
  const captureManifestRecord = await writeJsonArtifact(
    `${assemblyDirectory}/capture-manifest.json`,
    {
      schemaVersion: 1,
      generatedAt: PAST_TIMESTAMP,
      mode: "seeded_fallback",
      source: { fullSha: sourceSha, dirty: false },
      releaseIdentity,
      assertions: captureAssertions,
      outputs: { productTake: productTakeRecord },
    },
  );
  const finalVideoRecord = await writeArtifact(
    `${assemblyDirectory}/seeded-demo-rehearsal.mp4`,
    Buffer.from("0000ftypisomfixture-video"),
  );
  const finalAssembly = await writeJsonArtifact(
    `${assemblyDirectory}/rehearsal-manifest.json`,
    {
      schemaVersion: 2,
      generatedAt: PAST_TIMESTAMP,
      mode: "seeded_fallback",
      source: {
        capture: { fullSha: sourceSha, dirty: false },
        assembly: { fullSha: sourceSha, dirty: false },
      },
      releaseIdentity,
      releaseNarration,
      releaseMedia: {
        receipt: {
          path: releaseMediaReceiptRecord.path,
          sha256: releaseMediaReceiptRecord.sha256,
        },
        screenshotEvidence,
        publicOgOutput: publicOg.path,
      },
      voice: releaseNarration.voiceId,
      narration: {
        provider: "elevenlabs",
        modelId: "eleven_multilingual_v2",
        voiceId: releaseNarration.voiceId,
        timing: timingRecord,
        audio: audioRecord,
        approval: approvalRecord,
        attempt: attemptRecord,
        approvedVoice: { voiceId: releaseNarration.voiceId },
        verification: {
          mode: releaseNarration.verificationMode,
          voiceId: releaseNarration.voiceId,
        },
        artifactSource: {
          directory: assemblyDirectory,
          captureSourceSha: sourceSha,
          captureManifest: captureManifestRecord,
        },
        captureSourceSha: sourceSha,
        alignment: "raw_character_alignment",
      },
      inputs: {
        captureManifest: captureManifestRecord,
        providerCaptureManifest: captureManifestRecord,
        productTake: productTakeRecord,
        captions: mediaRecords.find(
          (record) => record.filename === "seeded-demo-rehearsal.srt",
        ),
        releaseMediaReceipt: releaseMediaReceiptRecord,
      },
      captureAssertions,
      captions: {
        path: `${mediaDirectory}/seeded-demo-rehearsal.srt`,
        cueCount: FIXTURE_CAPTION_TEXTS.length,
        maximumLineLength: 3,
        maximumWordsPerMinute: 10.34,
        burnedIn: true,
        embeddedSubtitleCodec: "mov_text",
      },
      output: {
        ...finalVideoRecord,
        durationSeconds: 174,
        videoStreamDurationSeconds: 174,
        videoFrameCount: 5220,
        width: 1280,
        height: 720,
        videoCodec: "h264",
        audioCodec: "aac",
        subtitleCodec: "mov_text",
        integratedLufs: -16,
        truePeakDbfs: -2,
      },
    },
  );
  const evidence = {
    schemaVersion: 1,
    kind: "wonderlab-final-release-evidence",
    releaseIdentity,
    publicName: {
      adoptedAt: PAST_TIMESTAMP,
      clearanceReviewedAt: PAST_TIMESTAMP,
    },
    liveEvaluation: {
      verifiedAt: PAST_TIMESTAMP,
      report: liveEvaluationReport,
    },
    application: {
      url: "https://curiotrellis.app",
      sourceSha,
      signedOutVerifiedAt: PAST_TIMESTAMP,
      freeVerifiedAt: PAST_TIMESTAMP,
      unrestrictedVerifiedAt: PAST_TIMESTAMP,
      availableThrough: "2026-08-06T00:00:00.000Z",
    },
    reviewerRepository: {
      url: reviewerRepositoryUrl,
      fullSha: REVIEWER_SOURCE_SHA,
      reviewerAccess: ["testing@devpost.com", "build-week-event@openai.com"],
      verifiedAt: PAST_TIMESTAMP,
      historyAudit,
    },
    media: {
      releaseMediaReceipt: releaseMediaReceiptPath,
      finalAssembly,
      youtubeUrl: "https://www.youtube.com/watch?v=curioTree01",
      youtubeSourceSha256: finalVideoRecord.sha256,
      publishedAt: PAST_TIMESTAMP,
      narrationApprovedAt: PAST_TIMESTAMP,
      narrationApprovedVideoSha256: finalVideoRecord.sha256,
      captionsApprovedAt: PAST_TIMESTAMP,
      captionsApprovedVideoSha256: finalVideoRecord.sha256,
    },
    devpost: {
      url: "https://openai.devpost.com/software/curiotrellis",
      submittedAt: PAST_TIMESTAMP,
    },
    feedback: {
      sessionId: "019c7714-3b77-74d1-9866-e1f484aae2ab",
      completedAt: PAST_TIMESTAMP,
    },
    ...overrides,
  };
  await fs.writeFile(
    path.join(root, "config/final-release-evidence.json"),
    JSON.stringify(evidence),
  );
}

async function rewriteJsonArtifact(
  root: string,
  relativePath: string,
  mutate: (value: ParsedJson) => void,
) {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  const value = JSON.parse(await fs.readFile(absolutePath, "utf8"));
  mutate(value);
  const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await fs.writeFile(absolutePath, content);
  return {
    path: relativePath,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

async function mutateFinalEvidence(
  root: string,
  mutate: (value: ParsedJson) => void,
) {
  return rewriteJsonArtifact(
    root,
    "config/final-release-evidence.json",
    mutate,
  );
}

async function bindFinalAssemblyToReusedNarration(
  root: string,
  {
    mode = "assembly_timeline_repair",
    changedPaths = ASSEMBLY_TIMELINE_REPAIR_PATHS,
  }: { mode?: string; changedPaths?: string[] } = {},
) {
  const currentDirectory = `output/playwright/${RELEASE_ID}`;
  const providerDirectory = "output/playwright/provider-source";
  const writeArtifact = async (
    relativePath: string,
    content: string | Buffer,
  ) => {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    return {
      path: relativePath,
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  };
  const writeJson = (relativePath: string, value: ParsedJson) =>
    writeArtifact(relativePath, `${JSON.stringify(value, null, 2)}\n`);

  const currentCapture = JSON.parse(
    await fs.readFile(
      path.join(root, currentDirectory, "capture-manifest.json"),
      "utf8",
    ),
  );
  const providerCaptureRecord = await writeJson(
    `${providerDirectory}/capture-manifest.json`,
    {
      ...currentCapture,
      source: { ...currentCapture.source, fullSha: PROVIDER_SOURCE_SHA },
    },
  );
  const currentApproval = JSON.parse(
    await fs.readFile(
      path.join(root, currentDirectory, "elevenlabs/approved-voice.json"),
      "utf8",
    ),
  );
  const providerApproval = {
    ...currentApproval,
    captureSourceSha: PROVIDER_SOURCE_SHA,
  };
  const providerApprovalRecord = await writeJson(
    `${providerDirectory}/elevenlabs/approved-voice.json`,
    providerApproval,
  );
  const providerAudioRecord = await writeArtifact(
    `${providerDirectory}/elevenlabs/narration.mp3`,
    await fs.readFile(
      path.join(root, currentDirectory, "elevenlabs/narration.mp3"),
    ),
  );
  const providerTimingRecord = await writeArtifact(
    `${providerDirectory}/elevenlabs/narration-timestamps.json`,
    await fs.readFile(
      path.join(root, currentDirectory, "elevenlabs/narration-timestamps.json"),
    ),
  );
  const currentAttempt = JSON.parse(
    await fs.readFile(
      path.join(root, currentDirectory, "elevenlabs/narration-attempt.json"),
      "utf8",
    ),
  );
  const providerAttemptRecord = await writeJson(
    `${providerDirectory}/elevenlabs/narration-attempt.json`,
    {
      ...currentAttempt,
      captureSourceSha: PROVIDER_SOURCE_SHA,
      voice: {
        ...currentAttempt.voice,
        approvalDigest: createHash("sha256")
          .update(stableJson(providerApproval))
          .digest("hex"),
      },
      artifacts: {
        audio: {
          bytes: providerAudioRecord.bytes,
          sha256: providerAudioRecord.sha256,
        },
        timing: {
          bytes: providerTimingRecord.bytes,
          sha256: providerTimingRecord.sha256,
        },
      },
    },
  );
  const transition = {
    schemaVersion: 1,
    mode,
    fromSourceSha: PROVIDER_SOURCE_SHA,
    toSourceSha: FIXTURE_SOURCE_SHA,
    changedPaths,
    files: changedPaths.map((changedPath) => ({
      path: changedPath,
      status: "M",
      beforeBlob: "1".repeat(40),
      afterBlob: "2".repeat(40),
    })),
  };
  const artifactReuse = {
    ...transition,
    transitionSha256: createHash("sha256")
      .update(JSON.stringify(transition))
      .digest("hex"),
  };
  const finalAssemblyRecord = await rewriteJsonArtifact(
    root,
    `${currentDirectory}/rehearsal-manifest.json`,
    (manifest) => {
      manifest.schemaVersion = 3;
      manifest.narration.approval = providerApprovalRecord;
      manifest.narration.attempt = providerAttemptRecord;
      manifest.narration.audio = providerAudioRecord;
      manifest.narration.timing = providerTimingRecord;
      manifest.narration.captureSourceSha = PROVIDER_SOURCE_SHA;
      manifest.narration.artifactSource = {
        directory: providerDirectory,
        captureSourceSha: PROVIDER_SOURCE_SHA,
        captureManifest: providerCaptureRecord,
      };
      manifest.narration.artifactReuse = artifactReuse;
      manifest.inputs.providerCaptureManifest = providerCaptureRecord;
    },
  );
  await mutateFinalEvidence(root, (evidence) => {
    evidence.media.finalAssembly = finalAssemblyRecord;
    evidence.media.assemblyRepairReview = {
      schemaVersion: 1,
      mode: artifactReuse.mode,
      fromSourceSha: artifactReuse.fromSourceSha,
      toSourceSha: artifactReuse.toSourceSha,
      transitionSha256: artifactReuse.transitionSha256,
      reviewedAt: PAST_TIMESTAMP,
    };
  });
  return finalAssemblyRecord;
}

function run(
  root: string,
  environment: Record<string, string> = {},
  args: string[] = [],
) {
  const commandLog = path.join(root, "commands.jsonl");
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}`,
      PREFLIGHT_COMMAND_LOG: commandLog,
      ...environment,
    },
  });
  return {
    result,
    report: JSON.parse(result.stdout),
    commands: fsSync
      .readFileSync(commandLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
  };
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("submission preflight", () => {
  it("reports local PASS checks and external PENDING gates without invoking release actions", async () => {
    const root = await fixtureRoot();
    const { result, report, commands } = run(root);

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(
      report.checks.every(
        (entry: { status: string }) => entry.status === "PASS",
      ),
    ).toBe(true);
    expect(
      report.manualExternalGates.every(
        (entry: { status: string }) => entry.status === "PENDING",
      ),
    ).toBe(true);
    expect(report.requiredDeterministicCommands).toContain(
      "npm run test:e2e:no-key",
    );
    expect(report.summary).toEqual({ pass: 14, fail: 0, pending: 7 });
    expect(report.nextSafeAction).toContain("Run the listed deterministic");
    expect(
      report.checks.find(
        (entry: { id: string }) => entry.id === "release-narration-config",
      ).detail,
    ).toContain("elevenlabs/OZxMHsGaBmV5pjMIDIn0/user_selected_tts_only");
    expect(commands).toEqual([
      ["rev-parse", "--show-toplevel"],
      ["rev-parse", "HEAD"],
      ["status", "--porcelain=v1", "--untracked-files=normal"],
      ["diff", "--check"],
      ["ls-files", "-z", "--"],
    ]);
  });

  it("fails when the receipt-governed current public OG is frozen in the preservation baseline", async () => {
    const root = await fixtureRoot();
    await fs.appendFile(
      path.join(root, "docs", "public-name-preservation-baseline.sha256"),
      `${"0".repeat(64)}  public/curiotrellis-og.png\n`,
    );
    const { result, report } = run(root);

    expect(result.status).toBe(1);
    expect(
      report.checks.find(
        (entry: { id: string }) =>
          entry.id === "public-name-preservation-baseline",
      ),
    ).toMatchObject({
      status: "FAIL",
      detail:
        "public/curiotrellis-og.png is current release output governed by the release-media receipt and must not be frozen in the preservation baseline.",
    });
  });

  it("fails when an immutable preservation-baseline file changes", async () => {
    const root = await fixtureRoot();
    await fs.appendFile(path.join(root, "docs", "preserved.txt"), "tampered");
    const { result, report } = run(root);

    expect(result.status).toBe(1);
    expect(
      report.checks.find(
        (entry: { id: string }) =>
          entry.id === "public-name-preservation-baseline",
      ),
    ).toMatchObject({
      status: "FAIL",
      detail:
        "Preserved path docs/preserved.txt no longer matches its recorded SHA-256.",
    });
  });

  it("fails when a preservation-baseline entry is not tracked by Git", async () => {
    const root = await fixtureRoot();
    const untrackedContent = Buffer.from("untracked fixture\n");
    await fs.writeFile(
      path.join(root, "docs", "untracked.txt"),
      untrackedContent,
    );
    await fs.appendFile(
      path.join(root, "docs", "public-name-preservation-baseline.sha256"),
      `${createHash("sha256").update(untrackedContent).digest("hex")}  docs/untracked.txt\n`,
    );
    const { result, report } = run(root);

    expect(result.status).toBe(1);
    expect(
      report.checks.find(
        (entry: { id: string }) =>
          entry.id === "public-name-preservation-baseline",
      ),
    ).toMatchObject({
      status: "FAIL",
      detail: "Preserved path docs/untracked.txt must be tracked by Git.",
    });
  });

  it("fails deterministic checks while retaining external gates as pending", async () => {
    const root = await fixtureRoot();
    await fs.writeFile(
      path.join(root, "components/discovery-card.tsx"),
      'anchor.download = "reasonweave-learning-trace.md"\n',
    );
    const { result, report } = run(root, { PREFLIGHT_DIRTY: "true" });

    expect(result.status).toBe(1);
    expect(
      report.checks.find(
        (entry: { id: string }) => entry.id === "clean-worktree",
      ).status,
    ).toBe("FAIL");
    expect(
      report.checks.find(
        (entry: { id: string }) =>
          entry.id === "identity-surface:components/discovery-card.tsx",
      ).status,
    ).toBe("FAIL");
    expect(
      report.manualExternalGates.every(
        (entry: { status: string }) => entry.status === "PENDING",
      ),
    ).toBe(true);
    expect(report.summary).toEqual({ pass: 12, fail: 2, pending: 7 });
    expect(report.nextSafeAction).toContain("Resolve deterministic FAIL");
  });

  it("keeps local readiness unchanged but fails every missing final-release deliverable in --release mode", async () => {
    const root = await fixtureRoot();
    const { result, report } = run(root, {}, ["--release"]);

    expect(result.status).toBe(1);
    expect(report.mode).toBe("release");
    expect(report.summary).toEqual({ pass: 14, fail: 0, pending: 0 });
    expect(report.releaseSummary).toEqual({ pass: 0, fail: 9 });
    expect(
      report.releaseChecks.map((entry: { id: string }) => entry.id),
    ).toEqual([
      "public-name-adoption-clearance",
      "live-evaluation-citation-review",
      "deployed-app-signed-out",
      "reviewer-repository-access",
      "release-media-receipt",
      "public-youtube-video",
      "human-narration-caption-approval",
      "devpost-submission",
      "feedback-session",
    ]);
    expect(
      report.releaseChecks.every(
        (entry: { status: string }) => entry.status === "FAIL",
      ),
    ).toBe(true);
    expect(
      report.manualExternalGates.every(
        (entry: { status: string }) => entry.status === "FAIL",
      ),
    ).toBe(true);
    expect(report.nextSafeAction).toContain("final-release FAIL");
  });

  it("passes --release only with structured current-identity public evidence", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { result, report } = run(root, {}, ["--release"]);

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(report.summary).toEqual({ pass: 14, fail: 0, pending: 0 });
    expect(report.releaseSummary).toEqual({ pass: 9, fail: 0 });
    expect(
      report.releaseChecks.every(
        (entry: { status: string }) => entry.status === "PASS",
      ),
    ).toBe(true);
    expect(
      report.manualExternalGates.every(
        (entry: { status: string }) => entry.status === "VERIFIED",
      ),
    ).toBe(true);
    expect(report.nextSafeAction).toContain(
      "All strict final-release evidence gates are verified",
    );
  });

  it("accepts paid narration reuse only across the exact assembly timeline repair", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await bindFinalAssemblyToReusedNarration(root);
    const repairNameStatus = `${ASSEMBLY_TIMELINE_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`;
    const { result, report } = run(
      root,
      {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: repairNameStatus,
      },
      ["--release"],
    );

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("PASS");
  });

  it("accepts narration reuse across the exact combined timeline and preservation-contract repair", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await bindFinalAssemblyToReusedNarration(root, {
      mode: "assembly_timeline_and_preservation_repair",
      changedPaths: ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS,
    });
    const repairNameStatus = `${ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`;
    const { result, report } = run(
      root,
      {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: repairNameStatus,
      },
      ["--release"],
    );

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("PASS");
  });

  it.each([
    ["non-ancestor", { PREFLIGHT_ANCESTOR: "false" }],
    [
      "extra application change",
      {
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: `${[
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
          "M\tapp/page.tsx",
        ].join("\n")}\n`,
      },
    ],
    [
      "partial preservation repair",
      {
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: `${[
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
          "M\tdocs/public-name-preservation-baseline.sha256",
        ].join("\n")}\n`,
      },
    ],
  ])(
    "rejects narration reuse across a %s transition",
    async (_label, extra) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      await bindFinalAssemblyToReusedNarration(root);
      const environment = {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: `${ASSEMBLY_TIMELINE_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`,
        ...extra,
      };
      const { report } = run(root, environment, ["--release"]);

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "release-media-receipt",
        ).status,
      ).toBe("FAIL");
    },
  );

  it("rejects narration reuse without its exact manifest bridge", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await bindFinalAssemblyToReusedNarration(root);
    const finalAssemblyRecord = await rewriteJsonArtifact(
      root,
      `output/playwright/${RELEASE_ID}/rehearsal-manifest.json`,
      (manifest) => {
        delete manifest.narration.artifactReuse;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.media.finalAssembly = finalAssemblyRecord;
    });
    const repairNameStatus = `${ASSEMBLY_TIMELINE_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`;
    const { report } = run(
      root,
      {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: repairNameStatus,
      },
      ["--release"],
    );

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a self-attested repair fingerprint that does not match Git blobs", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await bindFinalAssemblyToReusedNarration(root);
    let tamperedTransitionSha256 = "";
    const finalAssemblyRecord = await rewriteJsonArtifact(
      root,
      `output/playwright/${RELEASE_ID}/rehearsal-manifest.json`,
      (manifest) => {
        const transition = {
          ...manifest.narration.artifactReuse,
          files: manifest.narration.artifactReuse.files.map(
            (file: ParsedJson, index: number) =>
              index === 0 ? { ...file, afterBlob: "3".repeat(40) } : file,
          ),
        };
        delete transition.transitionSha256;
        tamperedTransitionSha256 = createHash("sha256")
          .update(JSON.stringify(transition))
          .digest("hex");
        manifest.narration.artifactReuse = {
          ...transition,
          transitionSha256: tamperedTransitionSha256,
        };
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.media.finalAssembly = finalAssemblyRecord;
      evidence.media.assemblyRepairReview.transitionSha256 =
        tamperedTransitionSha256;
    });
    const { report } = run(
      root,
      {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: `${ASSEMBLY_TIMELINE_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`,
      },
      ["--release"],
    );

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it("keeps reused narration pending until its exact repair fingerprint is reviewed", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await bindFinalAssemblyToReusedNarration(root);
    await mutateFinalEvidence(root, (evidence) => {
      delete evidence.media.assemblyRepairReview;
    });
    const { report } = run(
      root,
      {
        PREFLIGHT_SCREENSHOT_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS,
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
        ].join("\n")}\n`,
        PREFLIGHT_SCREENSHOT_NAME_STATUS_CHANGED_PATHS: `${[
          ...GENERATED_RELEASE_PATHS.map((changedPath) => `A\t${changedPath}`),
          ...ASSEMBLY_TIMELINE_REPAIR_PATHS.map(
            (changedPath) => `M\t${changedPath}`,
          ),
        ].join("\n")}\n`,
        PREFLIGHT_REPAIR_NAME_STATUS_CHANGED_PATHS: `${ASSEMBLY_TIMELINE_REPAIR_PATHS.map((changedPath) => `M\t${changedPath}`).join("\n")}\n`,
      },
      ["--release"],
    );

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    ["untracked", { PREFLIGHT_EVIDENCE_UNTRACKED: "true" }],
    ["different from HEAD", { PREFLIGHT_HEAD_EVIDENCE_MISMATCH: "true" }],
  ])("rejects final evidence that is %s", async (_label, environment) => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { result, report } = run(root, environment, ["--release"]);

    expect(result.status).toBe(1);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "public-name-adoption-clearance",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a self-referential application candidate equal to final-evidence HEAD", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { result, report } = run(
      root,
      { PREFLIGHT_HEAD_SHA: FIXTURE_SOURCE_SHA },
      ["--release"],
    );

    expect(result.status).toBe(1);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "deployed-app-signed-out",
      ).status,
    ).toBe("FAIL");
  });

  it("allows only the final evidence record after the application candidate", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const descendantHead = "b".repeat(40);
    const allowed = run(
      root,
      {
        PREFLIGHT_HEAD_SHA: descendantHead,
        PREFLIGHT_CHANGED_PATHS: "config/final-release-evidence.json\n",
      },
      ["--release"],
    );

    expect(
      allowed.report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "deployed-app-signed-out",
      ).status,
    ).toBe("PASS");

    const changedAppRoot = await fixtureRoot();
    await writeFinalReleaseEvidence(changedAppRoot);
    const rejected = run(
      changedAppRoot,
      {
        PREFLIGHT_HEAD_SHA: descendantHead,
        PREFLIGHT_CHANGED_PATHS:
          "config/final-release-evidence.json\napp/page.tsx\n",
      },
      ["--release"],
    );
    expect(
      rejected.report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "deployed-app-signed-out",
      ).status,
    ).toBe("FAIL");
  });

  it("enforces the screenshot-to-media-to-application two-phase source boundary", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { result, report } = run(
      root,
      { PREFLIGHT_SCREENSHOT_CHANGED_PATHS: "app/page.tsx\n" },
      ["--release"],
    );

    expect(result.status).toBe(1);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    ["missing free verification", { freeVerifiedAt: undefined }],
    [
      "future unrestricted verification",
      { unrestrictedVerifiedAt: "2999-01-01T00:00:00.000Z" },
    ],
    [
      "insufficient availability",
      { availableThrough: "2026-08-05T23:59:59.999Z" },
    ],
  ])(
    "rejects deployment evidence with %s",
    async (_label, applicationPatch) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      await mutateFinalEvidence(root, (evidence) => {
        Object.assign(evidence.application, applicationPatch);
      });
      const { report } = run(root, {}, ["--release"]);

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "deployed-app-signed-out",
        ).status,
      ).toBe("FAIL");
    },
  );

  it.each([
    "https://127.0.0.1/",
    "https://[fe80::1]/",
    "https://preview.local/",
    "https://preview.test/",
    "https://preview.invalid/",
    "https://preview.example/",
    "https://example.com/",
    "https://preview.example.com/",
    "https://example.net/",
    "https://preview.example.org/",
  ])("rejects non-public deployment host %s", async (url) => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await mutateFinalEvidence(root, (evidence) => {
      evidence.application.url = url;
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "deployed-app-signed-out",
      ).status,
    ).toBe("FAIL");
  });

  it("requires reviewer full-SHA and all history-audit passes", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await mutateFinalEvidence(root, (evidence) => {
      evidence.reviewerRepository.fullSha = "abc123";
    });
    let report = run(root, {}, ["--release"]).report;
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "reviewer-repository-access",
      ).status,
    ).toBe("FAIL");

    const failedAuditRoot = await fixtureRoot();
    await writeFinalReleaseEvidence(failedAuditRoot);
    const failedAudit = await rewriteJsonArtifact(
      failedAuditRoot,
      "output/release/curiotrellis-reviewer-history-audit.json",
      (audit) => {
        audit.checks.unverifiedRouteArtAbsent = false;
      },
    );
    await mutateFinalEvidence(failedAuditRoot, (evidence) => {
      evidence.reviewerRepository.historyAudit = failedAudit;
    });
    report = run(failedAuditRoot, {}, ["--release"]).report;
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "reviewer-repository-access",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    [
      "non-GitHub repository",
      "https://gitlab.com/example/curiotrellis-reviewer",
      {},
    ],
    [
      "remote HEAD mismatch",
      "https://github.com/example/curiotrellis-reviewer",
      { PREFLIGHT_REVIEWER_REMOTE_SHA: "f".repeat(40) },
    ],
  ])("rejects reviewer evidence with %s", async (_label, url, environment) => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await mutateFinalEvidence(root, (evidence) => {
      evidence.reviewerRepository.url = url;
    });
    const { report } = run(root, environment, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "reviewer-repository-access",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects substituted ignored receipts whose committed bindings were not updated", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.substituted = true;
      },
    );
    await rewriteJsonArtifact(
      root,
      "output/release/curiotrellis-reviewer-history-audit.json",
      (audit) => {
        audit.substituted = true;
      },
    );
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "reviewer-repository-access",
      ).status,
    ).toBe("FAIL");
  });

  it.each(["tree mapping", "permission grant"])(
    "rejects reviewer audit with an invalid %s",
    async (failureMode) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      const auditRecord = await rewriteJsonArtifact(
        root,
        "output/release/curiotrellis-reviewer-history-audit.json",
        (audit) => {
          if (failureMode === "tree mapping") {
            audit.sourceMapping.reviewerTreeSha = "f".repeat(40);
          } else {
            audit.permissionEvidence.captureMethod = "self-attested";
          }
        },
      );
      await mutateFinalEvidence(root, (evidence) => {
        evidence.reviewerRepository.historyAudit = auditRecord;
      });
      const { report } = run(root, {}, ["--release"]);

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "reviewer-repository-access",
        ).status,
      ).toBe("FAIL");
    },
  );

  it.each(["failed", "zero", "partial"])(
    "rejects a %s actual live-evaluation report even with a rehashed wrapper",
    async (mode) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      const actualPath = "output/evals/live-eval-2026-01-01T00-00-00-000Z.json";
      const actualRecord = await rewriteJsonArtifact(
        root,
        actualPath,
        (actual) => {
          if (mode === "failed") {
            actual.summary.passed = false;
            actual.summary.failedFixtures = 1;
          } else if (mode === "zero") {
            actual.run.fixtureCount = 0;
            actual.run.requestedFixtureLimit = 0;
            actual.fixtures = [];
            actual.summary = {
              passed: true,
              totalFixtures: 0,
              passedFixtures: 0,
              failedFixtures: 0,
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
            };
          } else {
            actual.run.fixtureCount = 1;
            actual.run.requestedFixtureLimit = 1;
            actual.fixtures = actual.fixtures.slice(0, 1);
            actual.summary.totalFixtures = 1;
            actual.summary.passedFixtures = 1;
            actual.summary.totalChecks = 1;
            actual.summary.passedChecks = 1;
          }
        },
      );
      const wrapperRecord = await rewriteJsonArtifact(
        root,
        "output/release/live-evaluation-report.json",
        (wrapper) => {
          wrapper.evaluationReport = actualRecord;
        },
      );
      await mutateFinalEvidence(root, (evidence) => {
        evidence.liveEvaluation.report = wrapperRecord;
      });
      const { report } = run(root, {}, ["--release"]);

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) =>
            entry.id === "live-evaluation-citation-review",
        ).status,
      ).toBe("FAIL");
    },
  );

  it("rejects a hand-authored live-evaluation wrapper without the actual schema-v2 report", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        delete wrapper.evaluationReport;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a rehashed final assembly with a different ElevenLabs voice", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const assemblyPath = `output/playwright/${RELEASE_ID}/rehearsal-manifest.json`;
    const assemblyRecord = await rewriteJsonArtifact(
      root,
      assemblyPath,
      (manifest) => {
        manifest.voice = "different-voice";
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.media.finalAssembly = assemblyRecord;
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    ["mismatched", FIXTURE_SRT.replace("C1", "Different caption")],
    ["empty", ""],
  ])("rejects %s embedded subtitles", async (_label, subtitleSrt) => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { report } = run(root, { PREFLIGHT_SUBTITLE_SRT: subtitleSrt }, [
      "--release",
    ]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a video with multiple subtitle streams", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const { report } = run(root, { PREFLIGHT_MULTI_SUBTITLE: "true" }, [
      "--release",
    ]);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    ["short H.264 duration", "142.066016", "5220"],
    ["short H.264 frame sequence", "174.000", "4262"],
    ["known 142-second video in a 174-second container", "142.066016", "4262"],
  ])(
    "rejects a 174-second container with a %s",
    async (_label, duration, frames) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      const { report } = run(
        root,
        {
          PREFLIGHT_VIDEO_STREAM_DURATION: duration,
          PREFLIGHT_VIDEO_FRAME_COUNT: frames,
        },
        ["--release"],
      );

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "release-media-receipt",
        ).status,
      ).toBe("FAIL");
    },
  );

  it("rejects incomplete or retargeted live-evaluation evidence", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const actualRecord = await rewriteJsonArtifact(
      root,
      "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
      (actual) => {
        actual.run.targetOrigin = "https://other.example";
        actual.fixtures[0].stageTimings.map.status = "not_run";
      },
    );
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.evaluationReport = actualRecord;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects dummy or mismatched live-evaluation source associations", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const actualRecord = await rewriteJsonArtifact(
      root,
      "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
      (actual) => {
        actual.fixtures[0].evidence.bundle.items = [];
      },
    );
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.evaluationReport = actualRecord;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
    });
    const { report } = run(root, {}, ["--release"]);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
  });

  it("permits source-free open questions but rejects a mismatched projection", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const actualRecord = await rewriteJsonArtifact(
      root,
      "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
      (actual) => {
        actual.fixtures[0].evidence.bundle.items.push({
          id: "inference-1",
          kind: "inference",
          statement: "What should we investigate next?",
          sourceIds: [],
        });
        actual.fixtures[0].evidence.sourceAssociations.push({
          itemId: "inference-1",
          kind: "inference",
          statement: "What should we investigate next?",
          sourceIds: [],
          sources: [],
          unresolvedSourceIds: [],
        });
      },
    );
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.evaluationReport = actualRecord;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
    });
    expect(
      run(root, {}, ["--release"]).report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("PASS");
  });

  it.each([
    [
      "source-free-only bundle",
      (fixture: Record<string, unknown>) => {
        const evidence = fixture.evidence as {
          bundle: { items: Array<{ kind: string; sourceIds: string[] }> };
          sourceAssociations: Array<{
            kind: string;
            sourceIds: string[];
            sources: unknown[];
          }>;
        };
        evidence.bundle.items.forEach((item) => {
          item.kind = "open_question";
          item.sourceIds = [];
        });
        evidence.sourceAssociations.forEach((association) => {
          association.kind = "open_question";
          association.sourceIds = [];
          association.sources = [];
        });
      },
    ],
    [
      "declared domain mismatch",
      (fixture: Record<string, unknown>) => {
        const evidence = fixture.evidence as {
          bundle: { sources: Array<{ domain: string }> };
        };
        evidence.bundle.sources[0].domain = "wrong.example";
      },
    ],
  ])(
    "rejects a %s canonical evidence violation",
    async (_label, mutateFixture) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      const actualRecord = await rewriteJsonArtifact(
        root,
        "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
        (actual) => mutateFixture(actual.fixtures[0]),
      );
      const wrapperRecord = await rewriteJsonArtifact(
        root,
        "output/release/live-evaluation-report.json",
        (wrapper) => {
          wrapper.evaluationReport = actualRecord;
        },
      );
      await mutateFinalEvidence(root, (evidence) => {
        evidence.liveEvaluation.report = wrapperRecord;
      });
      expect(
        run(root, {}, ["--release"]).report.releaseChecks.find(
          (entry: { id: string }) =>
            entry.id === "live-evaluation-citation-review",
        ).status,
      ).toBe("FAIL");
    },
  );

  it.each(["PREFLIGHT_BAD_FFPROBE", "PREFLIGHT_BAD_FFMPEG"])(
    "rejects final video when bounded media verification fails at %s",
    async (failureVariable) => {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      const { report } = run(root, { [failureVariable]: "true" }, [
        "--release",
      ]);

      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "release-media-receipt",
        ).status,
      ).toBe("FAIL");
    },
  );

  it("rejects a minimal renderer receipt and an oversized receipt before release", async () => {
    for (const content of [
      JSON.stringify({
        schemaVersion: 1,
        kind: "wonderlab-release-media-receipt",
      }),
      "x".repeat(256 * 1024 + 1),
    ]) {
      const root = await fixtureRoot();
      await writeFinalReleaseEvidence(root);
      await fs.writeFile(
        path.join(
          root,
          "docs",
          "media",
          RELEASE_ID,
          "release-media-receipt.json",
        ),
        content,
      );
      const { report } = run(root, {}, ["--release"]);
      expect(
        report.releaseChecks.find(
          (entry: { id: string }) => entry.id === "release-media-receipt",
        ).status,
      ).toBe("FAIL");
    }
  });

  it.each([
    ["empty YouTube ID", { youtubeUrl: "https://www.youtube.com/watch?v=" }],
    ["short YouTube ID", { youtubeUrl: "https://www.youtube.com/watch?v=x" }],
    ["wrong uploaded source", { youtubeSourceSha256: "f".repeat(64) }],
  ])("rejects public video evidence with %s", async (_label, mediaPatch) => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await mutateFinalEvidence(root, (evidence) => {
      Object.assign(evidence.media, mediaPatch);
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "public-youtube-video",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a placeholder feedback identifier", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    await mutateFinalEvidence(root, (evidence) => {
      evidence.feedback.sessionId = "feedback-session-123";
    });
    const { report } = run(root, {}, ["--release"]);

    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "feedback-session",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects future-dated release events", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const future = "2999-01-01T00:00:00.000Z";
    await mutateFinalEvidence(root, (evidence) => {
      evidence.publicName.adoptedAt = future;
      evidence.liveEvaluation.verifiedAt = future;
      evidence.reviewerRepository.verifiedAt = future;
      evidence.media.publishedAt = future;
      evidence.media.narrationApprovedAt = future;
      evidence.devpost.submittedAt = future;
      evidence.feedback.completedAt = future;
    });
    const { report } = run(root, {}, ["--release"]);
    for (const id of [
      "public-name-adoption-clearance",
      "live-evaluation-citation-review",
      "reviewer-repository-access",
      "release-media-receipt",
      "public-youtube-video",
      "human-narration-caption-approval",
      "devpost-submission",
      "feedback-session",
    ]) {
      expect(
        report.releaseChecks.find((entry: { id: string }) => entry.id === id)
          .status,
      ).toBe("FAIL");
    }
  });

  it("rejects stale and causally out-of-order release events", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const beforeMedia = new Date(
      Date.parse(PAST_TIMESTAMP) - 1_000,
    ).toISOString();
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.verifiedAt = stale;
      evidence.media.narrationApprovedAt = beforeMedia;
      evidence.devpost.submittedAt = beforeMedia;
    });
    const { report } = run(root, {}, ["--release"]);

    for (const id of [
      "live-evaluation-citation-review",
      "release-media-receipt",
      "human-narration-caption-approval",
      "devpost-submission",
    ]) {
      expect(
        report.releaseChecks.find((entry: { id: string }) => entry.id === id)
          .status,
      ).toBe("FAIL");
    }
  });

  it("rejects a fresh re-attestation over stale underlying artifacts", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const actualRecord = await rewriteJsonArtifact(
      root,
      "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
      (actual) => {
        actual.generatedAt = stale;
      },
    );
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.evaluationReport = actualRecord;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
      evidence.liveEvaluation.verifiedAt = PAST_TIMESTAMP;
    });
    const { report } = run(root, {}, ["--release"]);
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
  });

  it("rejects a fixture outside its otherwise fresh run window", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const actualRecord = await rewriteJsonArtifact(
      root,
      "output/evals/live-eval-2026-01-01T00-00-00-000Z.json",
      (actual) => {
        actual.fixtures[0].startedAt = new Date(
          Date.parse(actual.run.startedAt) - 1,
        ).toISOString();
      },
    );
    const wrapperRecord = await rewriteJsonArtifact(
      root,
      "output/release/live-evaluation-report.json",
      (wrapper) => {
        wrapper.evaluationReport = actualRecord;
      },
    );
    await mutateFinalEvidence(root, (evidence) => {
      evidence.liveEvaluation.report = wrapperRecord;
    });
    expect(
      run(root, {}, ["--release"]).report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
  });

  it("reports reviewer, receipt, and feedback failures separately", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root, {
      reviewerRepository: {
        url: "https://github.com/example/curiotrellis",
        reviewerAccess: ["testing@devpost.com"],
        verifiedAt: "2026-07-19T14:20:00.000Z",
      },
      media: {
        releaseMediaReceipt: "docs/media/curiotrellis-final/missing.json",
        youtubeUrl: "https://www.youtube.com/watch?v=curiotrellis",
        publishedAt: "2026-07-19T14:25:00.000Z",
        narrationApprovedAt: "2026-07-19T14:30:00.000Z",
        captionsApprovedAt: "2026-07-19T14:35:00.000Z",
      },
      feedback: {
        sessionId: "",
        completedAt: "2026-07-19T14:45:00.000Z",
      },
    });
    const { result, report } = run(root, {}, ["--release"]);

    expect(result.status).toBe(1);
    expect(report.releaseSummary).toEqual({ pass: 4, fail: 5 });
    for (const id of [
      "reviewer-repository-access",
      "release-media-receipt",
      "public-youtube-video",
      "human-narration-caption-approval",
      "feedback-session",
    ]) {
      expect(
        report.releaseChecks.find((entry: { id: string }) => entry.id === id)
          .status,
      ).toBe("FAIL");
    }
  });

  it("rejects stale media and live-evaluation proof from another commit", async () => {
    const root = await fixtureRoot();
    await writeFinalReleaseEvidence(root);
    const staleSha = "b".repeat(40);
    for (const relativePath of [
      `docs/media/${RELEASE_ID}/release-media-receipt.json`,
      "output/release/live-evaluation-report.json",
    ]) {
      const absolutePath = path.join(root, relativePath);
      const content = JSON.parse(await fs.readFile(absolutePath, "utf8"));
      if (content.screenshotEvidence) {
        content.screenshotEvidence.sourceSha = staleSha;
      }
      if (content.source) content.source.fullSha = staleSha;
      await fs.writeFile(absolutePath, JSON.stringify(content));
    }

    const { result, report } = run(root, {}, ["--release"]);

    expect(result.status).toBe(1);
    expect(report.releaseSummary).toEqual({ pass: 5, fail: 4 });
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "live-evaluation-citation-review",
      ).status,
    ).toBe("FAIL");
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "release-media-receipt",
      ).status,
    ).toBe("FAIL");
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) => entry.id === "public-youtube-video",
      ).status,
    ).toBe("FAIL");
    expect(
      report.releaseChecks.find(
        (entry: { id: string }) =>
          entry.id === "human-narration-caption-approval",
      ).status,
    ).toBe("FAIL");
  });

  it.each([
    {
      relativePath: "README.md",
      content:
        "# ReasonWeave\n\nReasonWeave is the current release candidate.\n",
      checkId: "judge-identity:README.md",
    },
    {
      relativePath: "docs/devpost-draft.md",
      content:
        "# Devpost submission draft\n\n## Project name\n\nReasonWeave\n\n## Short description\n\nReasonWeave makes reasoning visible.\n",
      checkId: "judge-identity:docs/devpost-draft.md",
    },
    {
      relativePath: "docs/demo-script.md",
      content:
        "# Demo script\n\n## Timed script and shot list\n\nReasonWeave makes learner reasoning visible.\n\n## Recording sequence\n\nCurioTrellis is the current release.\n",
      checkId: "judge-identity:docs/demo-script.md",
    },
  ])(
    "fails stale active judge copy in $relativePath",
    async ({ relativePath, content, checkId }) => {
      const root = await fixtureRoot();
      await fs.writeFile(path.join(root, relativePath), content);
      const { result, report } = run(root);

      expect(result.status).toBe(1);
      expect(
        report.checks.find((entry: { id: string }) => entry.id === checkId)
          .status,
      ).toBe("FAIL");
      expect(report.summary).toEqual({ pass: 13, fail: 1, pending: 7 });
    },
  );

  it("requires the canonical README heading to be the first nonempty line", async () => {
    const root = await fixtureRoot();
    await fs.writeFile(
      path.join(root, "README.md"),
      "Stale release title\n\n# CurioTrellis\n\nCurioTrellis is the current release candidate.\n",
    );
    const { result, report } = run(root);

    expect(result.status).toBe(1);
    expect(
      report.checks.find(
        (entry: { id: string }) => entry.id === "judge-identity:README.md",
      ).status,
    ).toBe("FAIL");
  });

  it("allows a leading README HTML comment before the canonical heading", async () => {
    const root = await fixtureRoot();
    await fs.writeFile(
      path.join(root, "README.md"),
      "<!-- release operator note -->\n# CurioTrellis\n\nCurioTrellis is the current release candidate.\n",
    );
    const { result, report } = run(root);

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(
      report.checks.find(
        (entry: { id: string }) => entry.id === "judge-identity:README.md",
      ).status,
    ).toBe("PASS");
  });

  it.each([
    {
      relativePath: "README.md",
      content:
        "# CurioTrellis\n\nCurioTrellis is the current release candidate.\n\n# ReasonWeave\n\nReasonWeave is the actual release candidate.\n",
      checkId: "judge-identity:README.md",
    },
    {
      relativePath: "docs/devpost-draft.md",
      content:
        "# Devpost submission draft\n\n## Project name\n\nCurioTrellis\n\n## Short description\n\nCurioTrellis makes reasoning visible.\n\n## Project name\n\nReasonWeave\n\n## Short description\n\nReasonWeave is the actual submission.\n",
      checkId: "judge-identity:docs/devpost-draft.md",
    },
    {
      relativePath: "docs/demo-script.md",
      content:
        "# Demo script\n\n## Timed script and shot list\n\nCurioTrellis makes learner reasoning visible.\n\n## Recording sequence\n\nSetup.\n\n## Timed script and shot list\n\nReasonWeave is the actual narration.\n\n## Recording sequence\n\nRecord.\n",
      checkId: "judge-identity:docs/demo-script.md",
    },
  ])(
    "fails duplicate active judge sections in $relativePath",
    async ({ relativePath, content, checkId }) => {
      const root = await fixtureRoot();
      await fs.writeFile(path.join(root, relativePath), content);
      const { result, report } = run(root);

      expect(result.status).toBe(1);
      expect(
        report.checks.find((entry: { id: string }) => entry.id === checkId)
          .status,
      ).toBe("FAIL");
    },
  );

  it.each([
    {
      relativePath: "docs/devpost-draft.md",
      content:
        "# Devpost submission draft\n\n```md\n## Project name\n\nCurioTrellis\n\n## Short description\n\nCurioTrellis makes reasoning visible.\n```\n\n## Project name\n\nReasonWeave\n\n## Short description\n\nReasonWeave is the actual submission.\n",
      checkId: "judge-identity:docs/devpost-draft.md",
    },
    {
      relativePath: "docs/demo-script.md",
      content:
        "# Demo script\n\n~~~md\n## Timed script and shot list\n\nCurioTrellis makes learner reasoning visible.\n~~~\n\n## Timed script and shot list\n\nReasonWeave is the actual narration.\n\n## Recording sequence\n\nRecord.\n",
      checkId: "judge-identity:docs/demo-script.md",
    },
  ])(
    "ignores fenced decoy headings in $relativePath",
    async ({ relativePath, content, checkId }) => {
      const root = await fixtureRoot();
      await fs.writeFile(path.join(root, relativePath), content);
      const { result, report } = run(root);

      expect(result.status).toBe(1);
      expect(
        report.checks.find((entry: { id: string }) => entry.id === checkId)
          .status,
      ).toBe("FAIL");
    },
  );

  it("allows retired names in historical sections outside the active judge-facing regions", async () => {
    const root = await fixtureRoot();
    await Promise.all([
      fs.appendFile(
        path.join(root, "README.md"),
        "\n## Historical release notes\n\nReasonWeave was a retired candidate.\n",
      ),
      fs.appendFile(
        path.join(root, "docs/devpost-draft.md"),
        "\n## Archive\n\nReasonWeave was a retired candidate.\n",
      ),
      fs.appendFile(
        path.join(root, "docs/demo-script.md"),
        "\n## Operator evidence\n\nReasonWeave was a retired candidate.\n",
      ),
    ]);
    const { result, report } = run(root);

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(report.summary).toEqual({ pass: 14, fail: 0, pending: 7 });
  });
});
