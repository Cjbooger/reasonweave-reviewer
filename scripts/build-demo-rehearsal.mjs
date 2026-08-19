import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { readAnchoredFiles } from "./anchored-directory-ops.mjs";
import { runBufferedChildProcess } from "./buffered-child-process.mjs";
import {
  DEMO_FINAL_SECONDS,
  validateDemoReleaseInputs,
} from "./demo-release-contract.mjs";
import {
  APPROVED_VOICE_FILENAME,
  approvedVoiceRecordDigest,
  loadApprovedVoiceRecord,
  loadCaptureBinding,
  PREVIEW_AUDIO_FILENAME,
  PREVIEW_VOICE_FILENAME,
  USER_SELECTED_TTS_ONLY_MODE,
} from "./elevenlabs-voice-catalog.mjs";
import { resolveElevenLabsArtifactSource } from "./demo-artifact-source.mjs";
import { validateElevenLabsTiming } from "./elevenlabs-timing.mjs";
import {
  assertReleaseMediaDirectoryIdentity,
  assertReleaseMediaInputsMatchReceipt,
  RELEASE_MEDIA_FILES,
  resolveReleaseMediaPaths,
} from "./release-media-paths.mjs";
import {
  assertReleaseIdentityRecord,
  releaseIdentityRecord,
} from "./release-identity.mjs";
import {
  assertReleaseNarrationAttemptBinding,
  loadReleaseNarration,
  releaseNarrationRecord,
} from "./release-narration.mjs";

const DEMO_OWNER = "wonderlab-seeded-demo-v1";
const PRODUCT_SECONDS = 142;
const PROOF_SECONDS = 20;
const CLOSING_SECONDS = 12;
const FINAL_SECONDS = PRODUCT_SECONDS + PROOF_SECONDS + CLOSING_SECONDS;
if (FINAL_SECONDS !== DEMO_FINAL_SECONDS) {
  throw new Error(
    "The assembly segment durations do not match the shared demo release timeline.",
  );
}
const CAPTION_RAIL_HEIGHT = 96;
const CAPTION_X = 80;
const OPENING_DISCLOSURE_SECONDS = 8;
const OPENING_CAPTION_Y = 535;
const PRODUCT_CAPTION_Y = 602;
const STILL_CAPTION_Y = 624;
const STILL_CONTENT_HEIGHT = 720 - CAPTION_RAIL_HEIGHT;
const STILL_CONTENT_WIDTH = 1110;
const PROOF_RAIL_COLOR = "0xf4f0e7";
const CLOSING_RAIL_COLOR = "0x041f32";
const ASSEMBLY_TIMELINE_REPAIR_PATHS = Object.freeze(
  [
    "scripts/build-demo-rehearsal.mjs",
    "scripts/submission-preflight.mjs",
    "tests/demo-script-consistency.test.ts",
    "tests/elevenlabs-generation-boundary.test.ts",
    "tests/submission-preflight.test.ts",
  ].sort(),
);
const ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS = Object.freeze(
  [
    ...ASSEMBLY_TIMELINE_REPAIR_PATHS,
    "docs/public-name-migration.md",
    "docs/public-name-preservation-baseline.sha256",
  ].sort(),
);
const NARRATION_REUSE_REPAIR_SPECS = Object.freeze([
  Object.freeze({
    mode: "assembly_timeline_repair",
    changedPaths: ASSEMBLY_TIMELINE_REPAIR_PATHS,
  }),
  Object.freeze({
    mode: "assembly_timeline_and_preservation_repair",
    changedPaths: ASSEMBLY_TIMELINE_AND_PRESERVATION_REPAIR_PATHS,
  }),
]);
const REQUIRED_MILESTONES = [
  "spark",
  "routes",
  "prediction",
  "evidence",
  "creation",
  "reflection",
  "discovery",
  "map",
  "export",
  "end",
];
const REQUIRED_FRAME_PREFIXES = [
  "01-spark",
  "02-routes",
  "03-prediction",
  "04-evidence",
  "05-creation",
  "06-reflection",
  "07-discovery",
  "08-map",
  "09-branch-choice",
  "10-discovery-card-reflection",
  "10-discuss-trace",
  "11-export",
];

const root = process.cwd();
const allowHistoricalReleaseMedia =
  process.env.WONDERLAB_ASSEMBLE_ALLOW_HISTORICAL_MEDIA === "true";
if (
  allowHistoricalReleaseMedia &&
  process.env.WONDERLAB_RELEASE_MEDIA_DIR !== undefined
) {
  throw new Error(
    "WONDERLAB_ASSEMBLE_ALLOW_HISTORICAL_MEDIA may be used only with the historical docs/media root.",
  );
}
const releaseMediaBinding = await resolveReleaseMediaPaths({
  root,
  environment: process.env,
  mode: "media-read",
  requiredFiles: [
    RELEASE_MEDIA_FILES.proofBoardPng,
    RELEASE_MEDIA_FILES.closingCard,
    RELEASE_MEDIA_FILES.captions,
  ],
  requireCurrentRelease: !allowHistoricalReleaseMedia,
});
const releaseNarration = await loadReleaseNarration({ root });
const allowedOutputRoot = path.resolve(root, "output", "playwright");
const configuredOutput =
  process.env.WONDERLAB_CAPTURE_OUTPUT ??
  path.join("output", "playwright", "wonderlab-demo");
const configuredElevenLabsArtifactSource =
  process.env.WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE;
const outputDir = path.resolve(root, configuredOutput);
const productTake = path.join(outputDir, "product-take.webm");
const captureManifestPath = path.join(outputDir, "capture-manifest.json");
const ownershipMarkerPath = path.join(outputDir, ".wonderlab-demo-output.json");
const proofBoard = releaseMediaBinding.files[RELEASE_MEDIA_FILES.proofBoardPng];
const closingCard = releaseMediaBinding.files[RELEASE_MEDIA_FILES.closingCard];
const captionsPath = releaseMediaBinding.files[RELEASE_MEDIA_FILES.captions];
const releaseMediaDirectoryAnchor = {
  path: releaseMediaBinding.mediaDir,
  realPath: releaseMediaBinding.mediaReal,
  dev: releaseMediaBinding.identity.dev,
  ino: releaseMediaBinding.identity.ino,
  message: "The selected release-media directory changed during assembly.",
};
const releaseMediaInputs = await readAnchoredFiles({
  anchor: releaseMediaDirectoryAnchor,
  filenames: [
    RELEASE_MEDIA_FILES.proofBoardPng,
    RELEASE_MEDIA_FILES.closingCard,
    RELEASE_MEDIA_FILES.captions,
  ],
});
if (releaseMediaBinding.releaseMediaReceipt) {
  assertReleaseMediaInputsMatchReceipt({
    binding: releaseMediaBinding,
    inputs: releaseMediaInputs,
    filenames: [
      RELEASE_MEDIA_FILES.proofBoardPng,
      RELEASE_MEDIA_FILES.closingCard,
      RELEASE_MEDIA_FILES.captions,
    ],
  });
}
await assertReleaseMediaDirectoryIdentity(releaseMediaBinding);
const proofBoardInput = releaseMediaInputs[RELEASE_MEDIA_FILES.proofBoardPng];
const closingCardInput = releaseMediaInputs[RELEASE_MEDIA_FILES.closingCard];
const captionsInput = releaseMediaInputs[RELEASE_MEDIA_FILES.captions];
const captureScriptPath = path.join(root, "scripts", "capture-seeded-demo.mjs");
const buildScriptPath = path.join(root, "scripts", "build-demo-rehearsal.mjs");
const renderScriptPath = path.join(root, "scripts", "render-release-media.mjs");
const releaseMediaPathScriptPath = path.join(
  root,
  "scripts",
  "release-media-paths.mjs",
);
const demoReleaseContractScriptPath = path.join(
  root,
  "scripts",
  "demo-release-contract.mjs",
);
const releaseIdentityScriptPath = path.join(
  root,
  "scripts",
  "release-identity.mjs",
);
const releaseIdentityConfigPath = path.join(
  root,
  ...releaseMediaBinding.releaseIdentity.record.path.split("/"),
);
const releaseNarrationConfigPath = path.join(
  root,
  ...releaseNarration.record.path.split("/"),
);
const releaseMediaReceiptPath = releaseMediaBinding.releaseMediaReceipt?.path;
const anchoredDirectoryOpsScriptPath = path.join(
  root,
  "scripts",
  "anchored-directory-ops.mjs",
);
const bufferedChildProcessScriptPath = path.join(
  root,
  "scripts",
  "buffered-child-process.mjs",
);
const packageLockPath = path.join(root, "package-lock.json");
const finalVideo = path.join(outputDir, "seeded-demo-rehearsal.mp4");
const rehearsalManifestPath = path.join(outputDir, "rehearsal-manifest.json");
const narrationProvider = process.env.WONDERLAB_NARRATION_PROVIDER ?? "say";
const voice = process.env.WONDERLAB_CAPTURE_VOICE ?? "Samantha";
const allowDirtyAssembly =
  process.env.WONDERLAB_ASSEMBLE_ALLOW_DIRTY === "true";
const allowDirtyCapture =
  process.env.WONDERLAB_ASSEMBLE_ALLOW_DIRTY_CAPTURE === "true";
const allowAssemblyTimelineRepairReuse =
  process.env.WONDERLAB_ELEVENLABS_ALLOW_ASSEMBLY_REPAIR_REUSE === "true";
const configuredAssemblyTimelineRepairSha256 =
  process.env.WONDERLAB_ELEVENLABS_ASSEMBLY_REPAIR_SHA256;
const keepBuild = process.env.WONDERLAB_KEEP_BUILD === "true";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

function run(command, args, options = {}) {
  if (options.input !== undefined) {
    return runBufferedChildProcess(command, args, {
      input: options.input,
      cwd: options.cwd ?? root,
      capture: options.capture,
    });
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw new Error(
      `Unable to run ${command}: ${result.error.code ?? result.error.message}`,
    );
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${command} failed with status ${result.status}${detail ? `:\n${detail}` : ""}`,
    );
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function commandText(command, args, options = {}) {
  const result = run(command, args, { ...options, capture: true });
  return `${result.stdout}${result.stderr}`;
}

function assemblyTimelineRepairReuse(fromSourceSha, toSourceSha) {
  if (fromSourceSha === toSourceSha) {
    invariant(
      !allowAssemblyTimelineRepairReuse &&
        configuredAssemblyTimelineRepairSha256 === undefined,
      "Assembly-repair narration reuse settings are only valid when provider artifacts come from the exact prior repair source.",
    );
    return undefined;
  }

  invariant(
    allowAssemblyTimelineRepairReuse,
    "Reusing ElevenLabs artifacts across an assembly timeline repair requires WONDERLAB_ELEVENLABS_ALLOW_ASSEMBLY_REPAIR_REUSE=true.",
  );
  run("git", ["merge-base", "--is-ancestor", fromSourceSha, toSourceSha], {
    capture: true,
  });
  const changes = commandText("git", [
    "diff",
    "--name-status",
    "--no-renames",
    `${fromSourceSha}..${toSourceSha}`,
  ])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, changedPath, ...extra] = line.split("\t");
      invariant(
        status === "M" && changedPath && extra.length === 0,
        "The narration reuse transition must contain only exact modified repair files.",
      );
      return changedPath;
    })
    .sort();
  const repairSpec = NARRATION_REUSE_REPAIR_SPECS.find(
    (candidate) =>
      JSON.stringify(changes) === JSON.stringify(candidate.changedPaths),
  );
  invariant(
    repairSpec,
    "The narration reuse transition does not match an exact supported release repair.",
  );

  const files = repairSpec.changedPaths.map((changedPath) => {
    const beforeBlob = commandText("git", [
      "rev-parse",
      `${fromSourceSha}:${changedPath}`,
    ]).trim();
    const afterBlob = commandText("git", [
      "rev-parse",
      `${toSourceSha}:${changedPath}`,
    ]).trim();
    invariant(
      /^[0-9a-f]{40,64}$/.test(beforeBlob) &&
        /^[0-9a-f]{40,64}$/.test(afterBlob) &&
        beforeBlob !== afterBlob,
      `The repair transition does not bind distinct Git blobs for ${changedPath}.`,
    );
    return { path: changedPath, status: "M", beforeBlob, afterBlob };
  });
  const transition = {
    schemaVersion: 1,
    mode: repairSpec.mode,
    fromSourceSha,
    toSourceSha,
    changedPaths: repairSpec.changedPaths,
    files,
  };
  const transitionSha256 = crypto
    .createHash("sha256")
    .update(JSON.stringify(transition))
    .digest("hex");
  invariant(
    configuredAssemblyTimelineRepairSha256 === transitionSha256,
    `WONDERLAB_ELEVENLABS_ASSEMBLY_REPAIR_SHA256 must explicitly approve repair fingerprint ${transitionSha256}.`,
  );

  return { ...transition, transitionSha256 };
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function renderCaptionCard(cue, destination) {
  const singleLine = cue.lines.length === 1;
  const linePositions = singleLine ? [58] : [38, 72];
  const longestLine = Math.max(...cue.lines.map((line) => line.length));
  const backgroundWidth = Math.min(1_060, Math.max(420, longestLine * 17 + 72));
  const backgroundX = (1_120 - backgroundWidth) / 2;
  const backgroundY = singleLine ? 18 : 6;
  const backgroundHeight = singleLine ? 58 : 82;
  const text = cue.lines
    .map(
      (line, index) =>
        `<text x="560" y="${linePositions[index]}" text-anchor="middle" fill="#ffffff" stroke="#041f32" stroke-opacity="0.72" stroke-width="5" paint-order="stroke" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join("");
  const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="96" viewBox="0 0 1120 96">
  <rect x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" rx="16" fill="#041f32" fill-opacity="0.82"/>
  ${text}
</svg>
`);
  await sharp(svg).png({ compressionLevel: 9 }).toFile(destination);
}

function probe(filePath) {
  return JSON.parse(
    commandText("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_name,codec_type,width,height,duration,nb_frames",
      "-of",
      "json",
      filePath,
    ]),
  );
}

function assertVideoTimeline(filePath, expectedDuration, description) {
  const result = probe(filePath);
  const videoStream = result.streams.find(
    (stream) => stream.codec_type === "video",
  );
  const containerDuration = Number(result.format.duration);
  const streamDuration = Number(videoStream?.duration);
  const frameCount = Number(videoStream?.nb_frames);
  const expectedFrameCount = Math.round(expectedDuration * 30);

  invariant(videoStream, `${description} is missing its video stream.`);
  invariant(
    Number.isFinite(containerDuration) &&
      Math.abs(containerDuration - expectedDuration) <= 0.15,
    `${description} container duration ${containerDuration} does not match ${expectedDuration} seconds.`,
  );
  invariant(
    Number.isFinite(streamDuration) &&
      Math.abs(streamDuration - expectedDuration) <= 0.15,
    `${description} video-stream duration ${streamDuration} does not match ${expectedDuration} seconds.`,
  );
  invariant(
    Number.isInteger(frameCount) &&
      Math.abs(frameCount - expectedFrameCount) <= 1,
    `${description} frame count ${videoStream.nb_frames ?? "missing"} does not match ${expectedFrameCount}.`,
  );

  return {
    result,
    videoStream,
    containerDuration,
    streamDuration,
    frameCount,
  };
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function fileRecord(filePath) {
  const stats = await fs.lstat(filePath);
  invariant(
    !stats.isSymbolicLink() && stats.isFile(),
    `${filePath} must be a real regular file.`,
  );
  return {
    path: path.relative(root, filePath),
    bytes: stats.size,
    sha256: await sha256(filePath),
  };
}

function capturedFileRecord(filePath, input) {
  return {
    path: path.relative(root, filePath),
    bytes: input.bytes,
    sha256: crypto.createHash("sha256").update(input.content).digest("hex"),
  };
}

async function assertContainedRegularFile(filePath, parentReal, description) {
  const stats = await fs.lstat(filePath);
  invariant(
    !stats.isSymbolicLink() && stats.isFile(),
    `${description} must be a real regular file.`,
  );
  const resolved = await fs.realpath(filePath);
  invariant(
    isInside(parentReal, resolved),
    `${description} must stay inside the owned capture output.`,
  );
  return resolved;
}

async function readJson(filePath, description) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read ${description} at ${filePath}: ${error.message}`,
    );
  }
}

async function assertAbsent(filePath, description) {
  try {
    await fs.access(filePath);
    throw new Error(
      `${description} already exists at ${filePath}. Move it aside before building another canonical rehearsal.`,
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function verifyRecordedFile(record, expectedPath, description) {
  invariant(record && typeof record === "object", `${description} is missing.`);
  const resolved = path.resolve(root, record.path ?? "");
  invariant(
    resolved === expectedPath,
    `${description} path does not match ${path.relative(root, expectedPath)}.`,
  );
  const current = await fileRecord(expectedPath);
  invariant(
    current.sha256 === record.sha256,
    `${description} hash does not match the capture manifest.`,
  );
  if (typeof record.bytes === "number") {
    invariant(
      current.bytes === record.bytes,
      `${description} size does not match the capture manifest.`,
    );
  }
  return current;
}

function validateCaptureAssertions(assertions) {
  invariant(
    assertions?.openingDisclosuresVisible === true,
    "Capture did not prove the opening age and AI/source disclosures.",
  );
  invariant(
    assertions?.seededLaunchVerified === true ||
      assertions?.sparkSampleFilled === true,
    "Capture did not prove the canonical seeded journey launched from Spark.",
  );
  invariant(
    assertions?.evidenceDecisionRecorded === true,
    "Capture did not prove the learner Evidence Decision.",
  );
  invariant(
    assertions?.evidenceApplicationRecorded === true,
    "Capture did not prove the learner evidence-to-design link.",
  );
  invariant(
    assertions?.artifactAnchorRecorded === true,
    "Capture did not prove the learner creation anchor.",
  );
  invariant(
    assertions?.creationReviewChecked === true,
    "Capture did not prove the learner creation self-review.",
  );
  invariant(
    assertions?.allReflectionFieldsShown === true,
    "Capture did not show all three learner reflection statements.",
  );
  invariant(
    assertions?.mapNodeCount === 9,
    "Capture did not prove all nine Curiosity Map nodes.",
  );
  invariant(
    Number(assertions?.mapNodeMinimumOpacity) >= 0.95,
    "Capture ended with a visually hidden Curiosity Map node.",
  );
  invariant(
    assertions?.mapNodesInViewport === true,
    "Capture did not compose all nine Curiosity Map nodes inside the video viewport.",
  );
  invariant(
    assertions?.finalChangeVisible === true,
    "Capture did not show the learner's before-and-now payoff.",
  );
  invariant(
    assertions?.atAGlancePayoffVisible === true,
    "Capture did not show the At a glance learner-selected next-question payoff.",
  );
  invariant(
    assertions?.selectedQuestionCloseupVisible === true,
    "Capture did not show the selected next question inside the Discovery Card.",
  );
  invariant(
    assertions?.facilitatorPromptVisible === true,
    "Capture did not show the Discuss this trace facilitator prompt and non-evaluative note.",
  );
  invariant(
    assertions?.exportActionVisible === true,
    "Capture did not show the verified Discovery Card export action.",
  );
  invariant(
    assertions?.exportVerified === true,
    "Capture did not verify Copy Markdown or Download .md.",
  );
  invariant(
    assertions?.seededBadgeVisible === true,
    "Capture did not keep persistent seeded-demo provenance visible.",
  );
}

function validateMilestones(milestones) {
  invariant(Array.isArray(milestones), "Capture milestones are missing.");
  const byName = new Map(
    milestones.map((milestone) => [milestone.name, milestone]),
  );
  for (const name of REQUIRED_MILESTONES) {
    const milestone = byName.get(name);
    invariant(milestone, `Capture milestone ${name} is missing.`);
    const target = Number(milestone.targetSeconds);
    const actual = Number(milestone.actualSeconds);
    const deadline = Number(milestone.deadlineSeconds);
    invariant(
      Number.isFinite(target) &&
        Number.isFinite(actual) &&
        Number.isFinite(deadline),
      `Capture milestone ${name} has invalid timing data.`,
    );
    invariant(
      actual >= target - 1 && actual <= deadline,
      `Capture milestone ${name} landed at ${actual.toFixed(2)}s outside its ${target.toFixed(2)}–${deadline.toFixed(2)}s window.`,
    );
  }
}

function validateFrameRecords(frames) {
  invariant(Array.isArray(frames), "Capture frame records are missing.");
  const names = frames.map((frame) => frame.name);
  for (const prefix of REQUIRED_FRAME_PREFIXES) {
    invariant(
      names.some((name) => name === prefix || name?.startsWith(`${prefix}-`)),
      `Capture frame ${prefix} is missing.`,
    );
  }
  const uniquePaths = new Set(frames.map((frame) => frame.path));
  invariant(
    uniquePaths.size === frames.length,
    "Capture frame records contain duplicate paths.",
  );
}

function atempoFilters(speed) {
  const filters = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  if (remaining > 1.001) filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters;
}

function measureLoudness(filePath) {
  const output = commandText("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    filePath,
    "-vn",
    "-filter:a",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const integratedMatches = [
    ...output.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g),
  ];
  const peakMatches = [...output.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?) dBFS/g)];
  if (integratedMatches.length === 0 || peakMatches.length === 0) {
    throw new Error(
      `FFmpeg did not report integrated loudness and true peak. Summary tail:\n${output.slice(-1_500)}`,
    );
  }
  return {
    integratedLufs: Number(integratedMatches.at(-1)[1]),
    truePeakDbfs: Number(peakMatches.at(-1)[1]),
  };
}

function makeStillClip(imageInput, outputPath, duration, videoFilter) {
  run(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-vf",
      `loop=loop=-1:size=1:start=0,${videoFilter},setsar=1,format=yuv420p`,
      "-t",
      String(duration),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      outputPath,
    ],
    { input: imageInput },
  );
  assertVideoTimeline(outputPath, duration, path.basename(outputPath));
}

async function ensureSafeOutputDirectory() {
  invariant(
    isInside(allowedOutputRoot, outputDir),
    `WONDERLAB_CAPTURE_OUTPUT must be a child of ${path.relative(root, allowedOutputRoot)}.`,
  );
  await fs.mkdir(allowedOutputRoot, { recursive: true });
  const allowedReal = await fs.realpath(allowedOutputRoot);
  const outputReal = await fs.realpath(outputDir);
  invariant(
    isInside(allowedReal, outputReal),
    "The resolved capture output escapes output/playwright, possibly through a symlink.",
  );
  return outputReal;
}

function preflight() {
  invariant(
    narrationProvider === "say" || narrationProvider === "elevenlabs",
    "WONDERLAB_NARRATION_PROVIDER must be either say or elevenlabs.",
  );
  if (narrationProvider === "say") {
    invariant(
      process.platform === "darwin",
      "Automated narration with say requires macOS. Use WONDERLAB_NARRATION_PROVIDER=elevenlabs with generated provider audio on other platforms.",
    );
  }

  const ffmpegVersion = commandText("ffmpeg", ["-hide_banner", "-version"]);
  const ffprobeVersion = commandText("ffprobe", ["-hide_banner", "-version"]);
  const encoders = commandText("ffmpeg", ["-hide_banner", "-encoders"]);
  const filters = commandText("ffmpeg", ["-hide_banner", "-filters"]);
  for (const encoder of ["libx264", "aac", "mov_text"]) {
    invariant(
      new RegExp(`\\b${encoder}\\b`).test(encoders),
      `FFmpeg must include the ${encoder} encoder.`,
    );
  }
  for (const filter of [
    "apad",
    "atempo",
    "concat",
    "loop",
    "loudnorm",
    "overlay",
  ]) {
    invariant(
      new RegExp(`\\b${filter}\\b`).test(filters),
      `FFmpeg must include the ${filter} filter.`,
    );
  }

  if (narrationProvider === "say") {
    const voices = commandText("/usr/bin/say", ["-v", "?"]);
    invariant(
      voices
        .split("\n")
        .some((line) => line.trimStart().startsWith(`${voice} `)),
      `The macOS voice “${voice}” is not installed.`,
    );
  }

  return {
    ffmpeg: ffmpegVersion.split("\n")[0].trim(),
    ffprobe: ffprobeVersion.split("\n")[0].trim(),
    ...(narrationProvider === "say" ? { sayVoice: voice } : {}),
  };
}

invariant(
  path.resolve(
    run("git", ["rev-parse", "--show-toplevel"], {
      capture: true,
    }).stdout.trim(),
  ) === root,
  `Run demo assembly from the ${releaseMediaBinding.releaseIdentity.displayName} repository root.`,
);

const outputReal = await ensureSafeOutputDirectory();
const owner = await readJson(
  ownershipMarkerPath,
  "demo output ownership marker",
);
invariant(
  owner.owner === DEMO_OWNER,
  `Output ownership marker must name ${DEMO_OWNER}.`,
);
invariant(
  path.resolve(owner.outputDir ?? "") === outputDir,
  "Output ownership marker does not match the configured capture directory.",
);

await assertAbsent(finalVideo, "Canonical rehearsal video");
await assertAbsent(rehearsalManifestPath, "Canonical rehearsal manifest");

const status = commandText("git", [
  "status",
  "--porcelain=v1",
  "--untracked-files=normal",
]).trim();
const assemblyDirty = status.length > 0;
if (assemblyDirty && !allowDirtyAssembly) {
  throw new Error(
    "Refusing to assemble from a dirty Git tree. Commit the candidate first, or set WONDERLAB_ASSEMBLE_ALLOW_DIRTY=true for an explicitly non-release rehearsal.",
  );
}

const fullSha = commandText("git", ["rev-parse", "HEAD"]).trim();
const shortSha = commandText("git", ["rev-parse", "--short", "HEAD"]).trim();
const captureManifest = await readJson(captureManifestPath, "capture manifest");
invariant(
  captureManifest.schemaVersion === 1,
  "Unsupported capture manifest schema.",
);
if (!allowHistoricalReleaseMedia) {
  assertReleaseIdentityRecord(
    captureManifest.releaseIdentity,
    releaseMediaBinding.releaseIdentity,
  );
}
invariant(
  captureManifest.mode === "seeded_fallback",
  "Capture manifest must identify seeded_fallback mode.",
);
invariant(
  captureManifest.server?.owned === true &&
    captureManifest.server?.mode === "capture_owned_next_dev" &&
    captureManifest.server?.stoppedBeforePublication === true,
  "Release assembly requires a capture-owned Next server that stopped before capture publication.",
);
invariant(
  captureManifest.source?.fullSha === fullSha,
  `Capture checkpoint ${captureManifest.source?.shortSha ?? "unknown"} does not match assembly checkpoint ${shortSha}.`,
);
if (captureManifest.source?.dirty && !allowDirtyCapture) {
  throw new Error(
    "Refusing a dirty capture. Re-record from the clean candidate, or set WONDERLAB_ASSEMBLE_ALLOW_DIRTY_CAPTURE=true for a non-release rehearsal.",
  );
}

validateCaptureAssertions(captureManifest.assertions);
validateMilestones(captureManifest.milestones);
validateFrameRecords(captureManifest.outputs?.frames);
const videoLeadInSeconds = Number(captureManifest.videoLeadInSeconds);
invariant(
  Number.isFinite(videoLeadInSeconds) &&
    videoLeadInSeconds >= 0 &&
    videoLeadInSeconds <= 10,
  "Capture manifest videoLeadInSeconds must be between 0 and 10 seconds.",
);

const capturedProduct = await verifyRecordedFile(
  captureManifest.outputs?.productTake,
  productTake,
  "Captured product take",
);
const capturedScript = await verifyRecordedFile(
  captureManifest.inputs?.captureScript,
  captureScriptPath,
  "Capture script",
);
for (const frame of captureManifest.outputs.frames) {
  const framePath = path.resolve(root, frame.path ?? "");
  invariant(
    isInside(outputReal, framePath),
    `Capture frame ${frame.name} escapes the owned output directory.`,
  );
  await verifyRecordedFile(frame, framePath, `Capture frame ${frame.name}`);
}

for (const filePath of [
  proofBoard,
  closingCard,
  captionsPath,
  captureScriptPath,
  buildScriptPath,
  renderScriptPath,
  releaseMediaPathScriptPath,
  demoReleaseContractScriptPath,
  releaseIdentityScriptPath,
  releaseIdentityConfigPath,
  ...(releaseMediaReceiptPath ? [releaseMediaReceiptPath] : []),
  anchoredDirectoryOpsScriptPath,
  bufferedChildProcessScriptPath,
  packageLockPath,
]) {
  await fs.access(filePath);
}

const productProbe = probe(productTake);
const productVideo = productProbe.streams.find(
  (stream) => stream.codec_type === "video",
);
const productDuration = Number(productProbe.format.duration);
invariant(
  productVideo?.width === 1280 && productVideo?.height === 720,
  "The product take must be 1280x720.",
);
invariant(
  productDuration >= videoLeadInSeconds + 141 &&
    productDuration <= videoLeadInSeconds + 146,
  `The product take duration ${productDuration.toFixed(3)}s does not match its ${videoLeadInSeconds.toFixed(3)}s lead-in plus the 142s timed sequence.`,
);

const { cues, captionMetrics } = await validateDemoReleaseInputs({
  captions: captionsInput.content,
  proofBoard: proofBoardInput.content,
  closingCard: closingCardInput.content,
});
const elevenLabsArtifactSource =
  narrationProvider === "elevenlabs"
    ? await resolveElevenLabsArtifactSource({
        root,
        allowedOutputRoot,
        outputDir,
        configuredSource: configuredElevenLabsArtifactSource,
      })
    : undefined;
const elevenLabsDir = path.join(
  elevenLabsArtifactSource?.outputReal ?? outputReal,
  "elevenlabs",
);
const elevenLabsAudioPath = path.join(elevenLabsDir, "narration.mp3");
const elevenLabsTimingPath = path.join(
  elevenLabsDir,
  "narration-timestamps.json",
);
const elevenLabsApprovalPath = path.join(
  elevenLabsDir,
  APPROVED_VOICE_FILENAME,
);
const elevenLabsPreviewRecordPath = path.join(
  elevenLabsDir,
  PREVIEW_VOICE_FILENAME,
);
const elevenLabsPreviewAudioPath = path.join(
  elevenLabsDir,
  PREVIEW_AUDIO_FILENAME,
);
const elevenLabsAttemptPath = path.join(
  elevenLabsDir,
  "narration-attempt.json",
);
let elevenLabsNarration;
if (narrationProvider === "elevenlabs") {
  const captureBinding = await loadCaptureBinding({
    root,
    outputDir: elevenLabsArtifactSource.outputReal,
  });
  if (!allowHistoricalReleaseMedia) {
    assertReleaseIdentityRecord(
      captureBinding.releaseIdentity,
      releaseMediaBinding.releaseIdentity,
    );
  }
  invariant(
    captureBinding.outputReal === elevenLabsArtifactSource.outputReal,
    "ElevenLabs artifact source changed while its capture binding was loaded.",
  );
  const artifactReuse = assemblyTimelineRepairReuse(
    captureBinding.captureSourceSha,
    fullSha,
  );
  await assertContainedRegularFile(
    elevenLabsAudioPath,
    captureBinding.outputReal,
    "ElevenLabs narration MP3",
  );
  await assertContainedRegularFile(
    elevenLabsTimingPath,
    captureBinding.outputReal,
    "ElevenLabs narration timing",
  );
  await assertContainedRegularFile(
    elevenLabsAttemptPath,
    captureBinding.outputReal,
    "ElevenLabs narration attempt receipt",
  );
  const timing = await readJson(elevenLabsTimingPath, "ElevenLabs timing");
  const attempt = await readJson(
    elevenLabsAttemptPath,
    "ElevenLabs narration attempt receipt",
  );
  assertReleaseNarrationAttemptBinding(attempt, releaseNarration);
  const providerProbe = probe(elevenLabsAudioPath);
  const providerDuration = Number(providerProbe.format.duration);
  invariant(
    providerProbe.streams.some((stream) => stream.codec_type === "audio") &&
      Number.isFinite(providerDuration) &&
      providerDuration > 0,
    "ElevenLabs narration MP3 must contain a valid audio stream.",
  );
  const cueSpans = validateElevenLabsTiming(timing, cues, providerDuration);
  const audioRecord = await fileRecord(elevenLabsAudioPath);
  const timingRecord = await fileRecord(elevenLabsTimingPath);
  const narrationSourceSha = crypto
    .createHash("sha256")
    .update(cues.map((cue) => cue.text).join("\n\n"))
    .digest("hex");
  invariant(
    attempt?.schemaVersion === 1 &&
      attempt.provider === "elevenlabs" &&
      attempt.status === "artifacts_published" &&
      attempt.captureSourceSha === captureBinding.captureSourceSha &&
      attempt.sourceTextSha256 === narrationSourceSha &&
      attempt.modelId === timing.modelId &&
      attempt.outputFormat === "mp3_44100_128" &&
      timing.voiceId === releaseNarration.voiceId &&
      attempt.voice?.voiceId === timing.voiceId &&
      attempt.artifacts?.audio?.bytes === audioRecord.bytes &&
      attempt.artifacts?.audio?.sha256 === audioRecord.sha256 &&
      attempt.artifacts?.timing?.bytes === timingRecord.bytes &&
      attempt.artifacts?.timing?.sha256 === timingRecord.sha256 &&
      (allowHistoricalReleaseMedia ||
        (JSON.stringify(attempt.releaseIdentity) ===
          JSON.stringify(
            releaseIdentityRecord(releaseMediaBinding.releaseIdentity),
          ) &&
          attempt.releaseMediaReceipt?.path ===
            releaseMediaBinding.releaseMediaReceipt?.relativePath &&
          attempt.releaseMediaReceipt?.sha256 ===
            releaseMediaBinding.releaseMediaReceipt?.sha256)),
    "ElevenLabs narration attempt receipt does not bind the approved request to these artifacts.",
  );
  const approvedVoice = await loadApprovedVoiceRecord({
    binding: captureBinding,
    voiceId: timing.voiceId,
  });
  invariant(
    approvedVoice.voice.voiceId === releaseNarration.voiceId &&
      approvedVoice.verification.mode === releaseNarration.verificationMode,
    "Approved ElevenLabs voice does not match the canonical release narration config.",
  );
  const userSelectedTtsOnly =
    approvedVoice.verification.mode === USER_SELECTED_TTS_ONLY_MODE;
  if (userSelectedTtsOnly) {
    await assertAbsent(
      elevenLabsPreviewRecordPath,
      "User-selected TTS-only preview record",
    );
    await assertAbsent(
      elevenLabsPreviewAudioPath,
      "User-selected TTS-only preview audio",
    );
    invariant(
      Object.keys(attempt.voice).sort().join(",") ===
        "approvalDigest,verification,voiceId" &&
        attempt.voice.approvalDigest ===
          approvedVoiceRecordDigest(approvedVoice) &&
        JSON.stringify(attempt.voice.verification) ===
          JSON.stringify(approvedVoice.verification),
      "ElevenLabs attempt receipt does not match the user-selected approval.",
    );
  } else {
    invariant(
      attempt.voice.name === approvedVoice.voice.name &&
        attempt.voice.voiceType === "default" &&
        attempt.voice.category === "premade" &&
        attempt.voice.fingerprint === approvedVoice.voiceFingerprint &&
        attempt.voice.reviewedPreviewSha256 === approvedVoice.preview.sha256 &&
        JSON.stringify(attempt.voice.verification) ===
          JSON.stringify(approvedVoice.verification),
      "ElevenLabs attempt receipt does not match the capture-approved voice metadata.",
    );
  }
  elevenLabsNarration = {
    audioPath: elevenLabsAudioPath,
    timingPath: elevenLabsTimingPath,
    captureManifestPath: path.join(
      elevenLabsArtifactSource.outputReal,
      "capture-manifest.json",
    ),
    approvalPath: elevenLabsApprovalPath,
    previewRecordPath: elevenLabsPreviewRecordPath,
    previewAudioPath: elevenLabsPreviewAudioPath,
    attemptPath: elevenLabsAttemptPath,
    approvedVoice,
    artifactSource: {
      directory: elevenLabsArtifactSource.relativeOutputPath,
      captureSourceSha: captureBinding.captureSourceSha,
    },
    artifactReuse,
    userSelectedTtsOnly,
    cueSpans,
    modelId: timing.modelId,
    voiceId: timing.voiceId,
  };
}
const prerequisites = preflight();
const inputRecords = {
  captureManifest: await fileRecord(captureManifestPath),
  productTake: capturedProduct,
  captureScript: capturedScript,
  buildScript: await fileRecord(buildScriptPath),
  renderScript: await fileRecord(renderScriptPath),
  releaseMediaPathScript: await fileRecord(releaseMediaPathScriptPath),
  demoReleaseContractScript: await fileRecord(demoReleaseContractScriptPath),
  releaseIdentityScript: await fileRecord(releaseIdentityScriptPath),
  releaseIdentityConfig: await fileRecord(releaseIdentityConfigPath),
  releaseNarrationConfig: await fileRecord(releaseNarrationConfigPath),
  ...(releaseMediaReceiptPath
    ? { releaseMediaReceipt: await fileRecord(releaseMediaReceiptPath) }
    : {}),
  anchoredDirectoryOpsScript: await fileRecord(anchoredDirectoryOpsScriptPath),
  bufferedChildProcessScript: await fileRecord(bufferedChildProcessScriptPath),
  packageLock: await fileRecord(packageLockPath),
  captions: capturedFileRecord(captionsPath, captionsInput),
  proofBoard: capturedFileRecord(proofBoard, proofBoardInput),
  closingCard: capturedFileRecord(closingCard, closingCardInput),
  ...(elevenLabsNarration
    ? {
        providerAudio: await fileRecord(elevenLabsNarration.audioPath),
        providerTiming: await fileRecord(elevenLabsNarration.timingPath),
        providerCaptureManifest: await fileRecord(
          elevenLabsNarration.captureManifestPath,
        ),
        providerApproval: await fileRecord(elevenLabsNarration.approvalPath),
        ...(!elevenLabsNarration.userSelectedTtsOnly
          ? {
              providerPreviewRecord: await fileRecord(
                elevenLabsNarration.previewRecordPath,
              ),
              providerPreviewAudio: await fileRecord(
                elevenLabsNarration.previewAudioPath,
              ),
            }
          : {}),
        providerAttempt: await fileRecord(elevenLabsNarration.attemptPath),
      }
    : {}),
};
invariant(
  inputRecords.releaseNarrationConfig.path === releaseNarration.record.path &&
    inputRecords.releaseNarrationConfig.sha256 ===
      releaseNarration.record.sha256,
  "Recorded release narration config does not match the originally loaded canonical config.",
);
const inputPaths = {
  captureManifest: captureManifestPath,
  productTake,
  captureScript: captureScriptPath,
  buildScript: buildScriptPath,
  renderScript: renderScriptPath,
  releaseMediaPathScript: releaseMediaPathScriptPath,
  demoReleaseContractScript: demoReleaseContractScriptPath,
  releaseIdentityScript: releaseIdentityScriptPath,
  releaseIdentityConfig: releaseIdentityConfigPath,
  releaseNarrationConfig: releaseNarrationConfigPath,
  ...(releaseMediaReceiptPath
    ? { releaseMediaReceipt: releaseMediaReceiptPath }
    : {}),
  anchoredDirectoryOpsScript: anchoredDirectoryOpsScriptPath,
  bufferedChildProcessScript: bufferedChildProcessScriptPath,
  packageLock: packageLockPath,
  captions: captionsPath,
  proofBoard,
  closingCard,
  ...(elevenLabsNarration
    ? {
        providerAudio: elevenLabsNarration.audioPath,
        providerTiming: elevenLabsNarration.timingPath,
        providerCaptureManifest: elevenLabsNarration.captureManifestPath,
        providerApproval: elevenLabsNarration.approvalPath,
        providerPreviewRecord: elevenLabsNarration.previewRecordPath,
        providerPreviewAudio: elevenLabsNarration.previewAudioPath,
        providerAttempt: elevenLabsNarration.attemptPath,
      }
    : {}),
};

const buildDir = path.join(
  outputDir,
  `.wonderlab-build-${process.pid}-${Date.now()}`,
);
const tempFinalVideo = path.join(
  outputDir,
  `.seeded-demo-rehearsal-${process.pid}.tmp.mp4`,
);
const tempManifest = path.join(
  outputDir,
  `.rehearsal-manifest-${process.pid}.tmp.json`,
);
let publishedVideo = false;

try {
  await fs.mkdir(buildDir, { recursive: false });
  const buildReal = await fs.realpath(buildDir);
  invariant(
    isInside(outputReal, buildReal),
    "Temporary build directory escaped the owned output directory.",
  );

  const productMp4 = path.join(buildDir, "01-product.mp4");
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    productTake,
    "-ss",
    videoLeadInSeconds.toFixed(3),
    "-vf",
    "fps=30,tpad=stop_mode=clone:stop_duration=2,format=yuv420p",
    "-t",
    String(PRODUCT_SECONDS),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    productMp4,
  ]);
  assertVideoTimeline(productMp4, PRODUCT_SECONDS, "Product segment");

  const proofRail = `scale=${STILL_CONTENT_WIDTH}:${STILL_CONTENT_HEIGHT}:flags=lanczos,pad=1280:720:(ow-iw)/2:0:color=${PROOF_RAIL_COLOR},setsar=1`;
  const proofClips = [
    ["02-proof-full.mp4", 4, proofRail],
    ["03-boundaries-left.mp4", 5, `crop=760:428:45:245,${proofRail}`],
    ["04-boundaries-right.mp4", 3.5, `crop=760:428:795:245,${proofRail}`],
    ["05-proof-left.mp4", 3.5, `crop=820:461:40:439,${proofRail}`],
    ["06-proof-right.mp4", 4, `crop=800:450:780:439,${proofRail}`],
  ].map(([name, duration, filter]) => {
    const outputPath = path.join(buildDir, name);
    makeStillClip(proofBoardInput.content, outputPath, duration, filter);
    return outputPath;
  });

  const closingMp4 = path.join(buildDir, "07-closing.mp4");
  run(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-vf",
      `loop=loop=-1:size=1:start=0,scale=${STILL_CONTENT_WIDTH}:${STILL_CONTENT_HEIGHT}:flags=lanczos,pad=1280:720:(ow-iw)/2:0:color=${CLOSING_RAIL_COLOR},setsar=1,format=yuv420p`,
      "-t",
      String(CLOSING_SECONDS),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      closingMp4,
    ],
    { input: closingCardInput.content },
  );
  assertVideoTimeline(closingMp4, CLOSING_SECONDS, "Closing segment");

  const videoSegments = [productMp4, ...proofClips, closingMp4];
  const silentVideo = path.join(buildDir, "silent-video.mp4");
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    ...videoSegments.flatMap((segment) => ["-i", segment]),
    "-filter_complex",
    `${videoSegments.map((_, index) => `[${index}:v]`).join("")}concat=n=${videoSegments.length}:v=1:a=0[v]`,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    silentVideo,
  ]);
  assertVideoTimeline(silentVideo, FINAL_SECONDS, "Concatenated silent video");

  const audioPaths = [];
  for (const cue of cues) {
    const prefix = String(cue.index).padStart(2, "0");
    const sourceAudio = path.join(
      buildDir,
      `${prefix}-source.${narrationProvider === "say" ? "aiff" : "wav"}`,
    );
    const fittedAudio = path.join(buildDir, `${prefix}-voice.wav`);
    const slotDuration = cue.end - cue.start;

    if (narrationProvider === "say") {
      run("/usr/bin/say", [
        "-v",
        voice,
        "-r",
        "155",
        "-o",
        sourceAudio,
        cue.text,
      ]);
    } else {
      const cueSpan = elevenLabsNarration.cueSpans[cue.index - 1];
      run("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        cueSpan.start.toFixed(6),
        "-t",
        (cueSpan.end - cueSpan.start).toFixed(6),
        "-i",
        elevenLabsNarration.audioPath,
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_s16le",
        sourceAudio,
      ]);
    }
    const sourceDuration = Number(probe(sourceAudio).format.duration);
    invariant(
      Number.isFinite(sourceDuration) && sourceDuration >= 0.2,
      narrationProvider === "say"
        ? `macOS say produced empty audio for narration cue ${cue.index}. In sandboxed environments, run demo assembly with permission to access the system voice service.`
        : `ElevenLabs alignment produced empty audio for narration cue ${cue.index}.`,
    );
    const targetSpeechDuration = Math.max(slotDuration - 0.45, 1);
    const speed =
      sourceDuration > targetSpeechDuration
        ? sourceDuration / targetSpeechDuration
        : 1;
    invariant(
      speed <= 1.75,
      `Narration cue ${cue.index} would require an unnatural ${speed.toFixed(2)}× speed-up.`,
    );
    const audioFilter = [
      ...atempoFilters(speed),
      `apad=whole_dur=${slotDuration.toFixed(3)}`,
    ].join(",");

    run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      sourceAudio,
      "-af",
      audioFilter,
      "-t",
      slotDuration.toFixed(3),
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      fittedAudio,
    ]);
    audioPaths.push(fittedAudio);
  }

  const concatList = path.join(buildDir, "audio-concat.txt");
  await fs.writeFile(
    concatList,
    `${audioPaths
      .map((audioPath) => `file '${path.basename(audioPath)}'`)
      .join("\n")}\n`,
  );
  const rawNarration = path.join(buildDir, "narration-raw.wav");
  run(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      path.basename(concatList),
      "-c:a",
      "pcm_s16le",
      path.basename(rawNarration),
    ],
    { cwd: buildDir },
  );

  const narration = path.join(buildDir, "narration.wav");
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    rawNarration,
    "-af",
    "loudnorm=I=-16:TP=-2:LRA=7",
    "-t",
    String(FINAL_SECONDS),
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    narration,
  ]);
  const narrationDuration = Number(probe(narration).format.duration);
  invariant(
    Math.abs(narrationDuration - FINAL_SECONDS) <= 0.05,
    "Narration does not match the final timeline.",
  );

  const captionCards = [];
  for (const cue of cues) {
    const captionCard = path.join(
      buildDir,
      `caption-${String(cue.index).padStart(2, "0")}.png`,
    );
    await renderCaptionCard(cue, captionCard);
    captionCards.push(captionCard);
  }

  const captionedVideo = path.join(buildDir, "captioned-video.mp4");
  const captionOverlayFilter = cues
    .map((cue, index) => {
      const input = index === 0 ? "[0:v]" : `[caption-${index}]`;
      const output =
        index === cues.length - 1 ? "[captioned]" : `[caption-${index + 1}]`;
      const captionY =
        cue.start < OPENING_DISCLOSURE_SECONDS
          ? OPENING_CAPTION_Y
          : cue.start >= PRODUCT_SECONDS
            ? STILL_CAPTION_Y
            : PRODUCT_CAPTION_Y;
      return `${input}[${index + 1}:v]overlay=${CAPTION_X}:${captionY}:eof_action=repeat:repeatlast=1:shortest=0:enable='gte(t,${cue.start.toFixed(3)})*lt(t,${cue.end.toFixed(3)})'${output}`;
    })
    .join(";");

  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    silentVideo,
    ...captionCards.flatMap((captionCard) => ["-i", captionCard]),
    "-filter_complex",
    captionOverlayFilter,
    "-map",
    "[captioned]",
    "-t",
    String(FINAL_SECONDS),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    captionedVideo,
  ]);
  assertVideoTimeline(captionedVideo, FINAL_SECONDS, "Captioned video");

  run(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      captionedVideo,
      "-i",
      narration,
      "-f",
      "srt",
      "-i",
      "pipe:0",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-map",
      "2:s:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-c:s",
      "mov_text",
      "-metadata:s:s:0",
      "language=eng",
      "-metadata:s:s:0",
      "title=English captions",
      "-t",
      String(FINAL_SECONDS),
      "-movflags",
      "+faststart",
      tempFinalVideo,
    ],
    { cwd: buildDir, input: captionsInput.content },
  );

  const finalTimeline = assertVideoTimeline(
    tempFinalVideo,
    FINAL_SECONDS,
    "Final rehearsal",
  );
  const finalProbe = finalTimeline.result;
  const videoStream = finalProbe.streams.find(
    (stream) => stream.codec_type === "video",
  );
  const audioStream = finalProbe.streams.find(
    (stream) => stream.codec_type === "audio",
  );
  const subtitleStream = finalProbe.streams.find(
    (stream) => stream.codec_type === "subtitle",
  );
  const duration = finalTimeline.containerDuration;
  invariant(
    videoStream?.codec_name === "h264" &&
      audioStream?.codec_name === "aac" &&
      subtitleStream?.codec_name === "mov_text" &&
      videoStream.width === 1280 &&
      videoStream.height === 720,
    "The assembled rehearsal failed its codec, subtitle, size, or duration contract.",
  );

  const loudness = measureLoudness(tempFinalVideo);
  invariant(
    loudness.integratedLufs >= -18 && loudness.integratedLufs <= -14,
    `Narration loudness ${loudness.integratedLufs} LUFS is outside the -18 to -14 target.`,
  );
  invariant(
    loudness.truePeakDbfs <= -1,
    `Narration true peak ${loudness.truePeakDbfs} dBFS is too high.`,
  );

  const endingFullSha = commandText("git", ["rev-parse", "HEAD"]).trim();
  const endingStatus = commandText("git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  ]).trim();
  invariant(
    endingFullSha === fullSha && endingStatus === status,
    "The Git checkpoint changed during assembly. No rehearsal will be published.",
  );
  for (const [name, record] of Object.entries(inputRecords)) {
    if (
      name === "captions" ||
      name === "proofBoard" ||
      name === "closingCard"
    ) {
      continue;
    }
    await verifyRecordedFile(
      record,
      inputPaths[name],
      `Assembly input ${name}`,
    );
  }
  await assertReleaseMediaDirectoryIdentity(releaseMediaBinding);
  const endingReleaseMediaInputs = await readAnchoredFiles({
    anchor: releaseMediaDirectoryAnchor,
    filenames: [
      RELEASE_MEDIA_FILES.proofBoardPng,
      RELEASE_MEDIA_FILES.closingCard,
      RELEASE_MEDIA_FILES.captions,
    ],
  });
  await assertReleaseMediaDirectoryIdentity(releaseMediaBinding);
  for (const [name, filename] of [
    ["captions", RELEASE_MEDIA_FILES.captions],
    ["proofBoard", RELEASE_MEDIA_FILES.proofBoardPng],
    ["closingCard", RELEASE_MEDIA_FILES.closingCard],
  ]) {
    const endingInput = endingReleaseMediaInputs[filename];
    invariant(
      endingInput.bytes === inputRecords[name].bytes &&
        crypto
          .createHash("sha256")
          .update(endingInput.content)
          .digest("hex") === inputRecords[name].sha256,
      `Assembly input ${name} changed after its anchored snapshot.`,
    );
  }

  const finalRecord = await fileRecord(tempFinalVideo);
  finalRecord.path = path.relative(root, finalVideo);

  const manifest = {
    schemaVersion: elevenLabsNarration?.artifactReuse ? 3 : 2,
    generatedAt: new Date().toISOString(),
    mode: "seeded_fallback",
    source: {
      capture: captureManifest.source,
      assembly: {
        fullSha,
        shortSha,
        dirty: assemblyDirty,
        dirtyStatus: status,
      },
    },
    releaseIdentity: releaseIdentityRecord(releaseMediaBinding.releaseIdentity),
    releaseNarration: releaseNarrationRecord(releaseNarration),
    releaseMedia: releaseMediaBinding.releaseMediaReceipt
      ? {
          directory: releaseMediaBinding.relativeMediaDir,
          receipt: {
            path: releaseMediaBinding.releaseMediaReceipt.relativePath,
            sha256: releaseMediaBinding.releaseMediaReceipt.sha256,
          },
          screenshotEvidence: releaseMediaBinding.screenshotEvidence,
          publicOgOutput: releaseMediaBinding.relativePublicOgOutput,
        }
      : {
          directory: releaseMediaBinding.relativeMediaDir,
          historicalOverride: true,
        },
    prerequisites,
    voice: narrationProvider === "say" ? voice : elevenLabsNarration.voiceId,
    narration: {
      provider: narrationProvider,
      ...(elevenLabsNarration
        ? {
            modelId: elevenLabsNarration.modelId,
            voiceId: elevenLabsNarration.voiceId,
            timing: inputRecords.providerTiming,
            audio: inputRecords.providerAudio,
            approval: inputRecords.providerApproval,
            reviewedPreview: elevenLabsNarration.userSelectedTtsOnly
              ? { status: "not_performed" }
              : {
                  record: inputRecords.providerPreviewRecord,
                  audio: inputRecords.providerPreviewAudio,
                },
            attempt: inputRecords.providerAttempt,
            approvedVoice: elevenLabsNarration.approvedVoice.voice,
            verification: elevenLabsNarration.approvedVoice.verification,
            artifactSource: {
              ...elevenLabsNarration.artifactSource,
              captureManifest: inputRecords.providerCaptureManifest,
            },
            ...(elevenLabsNarration.artifactReuse
              ? { artifactReuse: elevenLabsNarration.artifactReuse }
              : {}),
            captureSourceSha:
              elevenLabsNarration.approvedVoice.captureSourceSha,
            alignment: "raw_character_alignment",
          }
        : { rateWordsPerMinute: 155 }),
    },
    inputs: inputRecords,
    captureAssertions: captureManifest.assertions,
    milestones: captureManifest.milestones,
    videoLeadInSeconds,
    captions: {
      path: path.relative(root, captionsPath),
      cueCount: cues.length,
      maximumLineLength: captionMetrics.maximumLineLength,
      maximumWordsPerMinute: Number(
        captionMetrics.maximumWordsPerMinute.toFixed(2),
      ),
      burnedIn: true,
      renderer: "sharp-svg-card-plus-ffmpeg-overlay",
      stillSegmentRailPixels: CAPTION_RAIL_HEIGHT,
      openingPlacement: {
        throughSeconds: OPENING_DISCLOSURE_SECONDS,
        x: CAPTION_X,
        y: OPENING_CAPTION_Y,
        purpose: "Preserve the visible 13+ and AI/source disclosure.",
      },
      embeddedSubtitleCodec: subtitleStream.codec_name,
    },
    proofSequence: {
      productSeconds: PRODUCT_SECONDS,
      clips: [
        { name: "full-board", startSeconds: 142, durationSeconds: 4 },
        { name: "routes-and-quest", startSeconds: 146, durationSeconds: 5 },
        {
          name: "evidence-and-reflect",
          startSeconds: 151,
          durationSeconds: 3.5,
        },
        {
          name: "no-key-proof",
          startSeconds: 154.5,
          durationSeconds: 3.5,
        },
        { name: "codex-story", startSeconds: 158, durationSeconds: 4 },
      ],
      closingSeconds: CLOSING_SECONDS,
    },
    output: {
      ...finalRecord,
      durationSeconds: duration,
      videoStreamDurationSeconds: finalTimeline.streamDuration,
      videoFrameCount: finalTimeline.frameCount,
      width: videoStream.width,
      height: videoStream.height,
      videoCodec: videoStream.codec_name,
      audioCodec: audioStream.codec_name,
      subtitleCodec: subtitleStream.codec_name,
      integratedLufs: loudness.integratedLufs,
      truePeakDbfs: loudness.truePeakDbfs,
    },
    publicationStatus:
      "local seeded rehearsal only; not uploaded and not live-model proof",
  };
  await fs.writeFile(tempManifest, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });

  await fs.rename(tempFinalVideo, finalVideo);
  publishedVideo = true;
  try {
    await fs.rename(tempManifest, rehearsalManifestPath);
  } catch (error) {
    await fs.rm(finalVideo, { force: true });
    publishedVideo = false;
    throw error;
  }

  console.log(`Built ${finalVideo}`);
  console.log(`Manifest ${rehearsalManifestPath}`);
} finally {
  if (!keepBuild) {
    await Promise.allSettled([
      fs.rm(tempFinalVideo, { force: true }),
      fs.rm(tempManifest, { force: true }),
    ]);
  }
  if (!keepBuild) {
    await fs.rm(buildDir, { recursive: true, force: true });
  } else {
    console.log(`Kept temporary build directory ${buildDir}`);
  }
  if (!publishedVideo) {
    console.error("No canonical rehearsal was published.");
  }
}
