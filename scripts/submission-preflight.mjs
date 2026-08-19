import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadReleaseIdentity,
  releaseIdentityRecord,
} from "./release-identity.mjs";
import {
  loadReleaseNarration,
  releaseNarrationRecord,
} from "./release-narration.mjs";
import { approvedVoiceRecordDigest } from "./elevenlabs-voice-catalog.mjs";
import {
  DEMO_FINAL_SECONDS,
  parseDemoSrt,
  validateDemoCues,
} from "./demo-release-contract.mjs";

export const REQUIRED_DETERMINISTIC_COMMANDS = Object.freeze([
  "npm run format:check",
  "npm run verify",
  "npm run build",
  "npm run performance:bundle",
  "npm run test:e2e",
  "npm run test:e2e:no-key",
]);

export const MANUAL_EXTERNAL_GATES = Object.freeze([
  "final public-name adoption and clearance",
  "credentialed live evaluation and citation review",
  "deployment, signed-out verification, and host controls",
  "reviewer repository access",
  "human narration and caption approval",
  "public video verification",
  "Devpost fields, feedback session, and submission receipt",
]);

const RELEASE_MANUAL_GATE_CHECK_IDS = Object.freeze([
  ["public-name-adoption-clearance"],
  ["live-evaluation-citation-review"],
  ["deployed-app-signed-out"],
  ["reviewer-repository-access"],
  ["release-media-receipt", "human-narration-caption-approval"],
  ["public-youtube-video"],
  ["devpost-submission", "feedback-session"],
]);

export const FINAL_RELEASE_EVIDENCE_PATH = "config/final-release-evidence.json";
const PUBLIC_NAME_PRESERVATION_BASELINE_PATH =
  "docs/public-name-preservation-baseline.sha256";

export const FINAL_RELEASE_CHECK_IDS = Object.freeze([
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

const REQUIRED_REVIEWERS = Object.freeze([
  "testing@devpost.com",
  "build-week-event@openai.com",
]);
const MAX_FINAL_RELEASE_EVIDENCE_BYTES = 64 * 1024;
const MAX_RELEASE_JSON_BYTES = 2 * 1024 * 1024;
const MAX_RELEASE_MEDIA_RECEIPT_BYTES = 256 * 1024;
const MAX_RELEASE_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_RELEASE_VIDEO_BYTES = 64 * 1024 * 1024;
const DEMO_VIDEO_FRAME_RATE = 30;
const DEMO_FINAL_FRAME_COUNT = Math.round(
  DEMO_FINAL_SECONDS * DEMO_VIDEO_FRAME_RATE,
);
const MINIMUM_APP_AVAILABILITY = "2026-08-06T00:00:00.000Z";
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const REQUIRED_LIVE_EVAL_FIXTURE_IDS = Object.freeze([
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
]);
const REQUIRED_LIVE_EVAL_CHECK_IDS = Object.freeze([
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
]);
const REQUIRED_LIVE_EVAL_STAGES = Object.freeze([
  "routes",
  "quest",
  "evidence",
  "reflection",
  "map",
]);
// Release evidence is deliberately short-lived: it must describe this release
// review, not a previous candidate's successful run.
const MAX_FINAL_RELEASE_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SCREENSHOT_RELEASE_FILES = new Set([
  ".wonderlab-screenshot-output.json",
  "screenshot-receipt.json",
  "spark-desktop.jpg",
  "routes-desktop.jpg",
  "prediction-desktop.jpg",
  "evidence-create-desktop.jpg",
  "discovery-desktop.jpg",
  "discovery-card-desktop.jpg",
  "discovery-mobile.jpg",
  "discovery-mobile-trace.jpg",
]);
const RELEASE_MEDIA_OUTPUT_FILES = new Set([
  "technical-proof-board.png",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
  "release-media-receipt.json",
]);
const RELEASE_MEDIA_CONTENT_FILES = Object.freeze([
  "technical-proof-board.svg",
  "technical-proof-board.png",
  "seeded-demo-rehearsal.srt",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
]);
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
const NARRATION_REUSE_REPAIR_PATH_SET = new Set(
  NARRATION_REUSE_REPAIR_SPECS.flatMap(({ changedPaths }) => changedPaths),
);

function git(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(
      `git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.stdout.trim();
}

function gitBytes(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const detail = Buffer.concat([
      result.stderr ?? Buffer.alloc(0),
      result.stdout ?? Buffer.alloc(0),
    ])
      .toString("utf8")
      .trim();
    throw new Error(
      `git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.stdout;
}

function check(id, passed, detail) {
  return { id, status: passed ? "PASS" : "FAIL", detail };
}

async function verifyPublicNamePreservationBaseline({ root, identity }) {
  const baselinePath = path.join(
    root,
    ...PUBLIC_NAME_PRESERVATION_BASELINE_PATH.split("/"),
  );
  const content = await readFile(baselinePath, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("The public-name preservation baseline is empty.");
  }

  const currentPublicOg = `public/${identity.slug}-og.png`;
  const records = lines.map((line, index) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match || !isSafeRelativePath(match[2])) {
      throw new Error(
        `Invalid preservation record at line ${index + 1} of ${PUBLIC_NAME_PRESERVATION_BASELINE_PATH}.`,
      );
    }
    return { sha256: match[1], relativePath: match[2] };
  });
  const uniquePaths = new Set(records.map(({ relativePath }) => relativePath));
  if (uniquePaths.size !== records.length) {
    throw new Error(
      "The public-name preservation baseline has duplicate paths.",
    );
  }
  if (uniquePaths.has(currentPublicOg)) {
    throw new Error(
      `${currentPublicOg} is current release output governed by the release-media receipt and must not be frozen in the preservation baseline.`,
    );
  }

  const trackedPaths = new Set(
    git(root, ["ls-files", "-z", "--"]).split("\0").filter(Boolean),
  );
  const realRoot = await realpath(root);
  for (const record of records) {
    if (!trackedPaths.has(record.relativePath)) {
      throw new Error(
        `Preserved path ${record.relativePath} must be tracked by Git.`,
      );
    }
    const absolutePath = path.join(root, ...record.relativePath.split("/"));
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(
        `Preserved path ${record.relativePath} must be a regular file inside the repository.`,
      );
    }
    const resolvedPath = await realpath(absolutePath);
    if (!isInside(realRoot, resolvedPath)) {
      throw new Error(
        `Preserved path ${record.relativePath} must be a regular file inside the repository.`,
      );
    }
    const bytes = await readFile(absolutePath);
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== record.sha256) {
      throw new Error(
        `Preserved path ${record.relativePath} no longer matches its recorded SHA-256.`,
      );
    }
  }

  return records.length;
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function isPastOrPresentIsoTimestamp(value) {
  return isIsoTimestamp(value) && Date.parse(value) <= Date.now();
}

function isRecentPastIsoTimestamp(value, { after } = {}) {
  if (!isPastOrPresentIsoTimestamp(value)) return false;
  const timestamp = Date.parse(value);
  const earliest = Date.now() - MAX_FINAL_RELEASE_EVIDENCE_AGE_MS;
  return (
    timestamp >= earliest &&
    (!after || (isIsoTimestamp(after) && timestamp >= Date.parse(after)))
  );
}

function normalizedOrigin(value) {
  if (!isPublicHttpsUrl(value)) return null;
  return new URL(value).origin;
}

function isCanonicalGithubRepositoryUrl(value) {
  if (!isPublicHttpsUrl(value, { host: "github.com" })) return false;
  const parsed = new URL(value);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return (
    parsed.hostname === "github.com" &&
    segments.length === 2 &&
    segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment)) &&
    !parsed.search &&
    !parsed.hash
  );
}

function isPublicHttpsUrl(value, { host } = {}) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLocaleLowerCase().replace(/\.$/, "");
    const unbracketedHostname = hostname.replace(/^\[(.*)\]$/, "$1");
    const isIpLiteral =
      unbracketedHostname.includes(":") ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(unbracketedHostname);
    const reservedHostname = [
      "localhost",
      ".localhost",
      ".local",
      ".test",
      ".invalid",
      ".example",
      "example.com",
      ".example.com",
      "example.net",
      ".example.net",
      "example.org",
      ".example.org",
      ".internal",
      ".lan",
      ".home",
    ].some((suffix) =>
      suffix.startsWith(".") ? hostname.endsWith(suffix) : hostname === suffix,
    );
    return (
      parsed.protocol === "https:" &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      !isIpLiteral &&
      !reservedHostname &&
      hostname.includes(".") &&
      (!host || hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function isPublicYoutubeUrl(value) {
  if (!isPublicHttpsUrl(value)) return false;
  const parsed = new URL(value);
  const validVideoId = (videoId) =>
    typeof videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(videoId);
  return (
    (parsed.hostname === "youtu.be" &&
      validVideoId(parsed.pathname.slice(1)) &&
      !parsed.pathname.slice(1).includes("/")) ||
    ((parsed.hostname === "youtube.com" ||
      parsed.hostname.endsWith(".youtube.com")) &&
      parsed.pathname === "/watch" &&
      validVideoId(parsed.searchParams.get("v")))
  );
}

function isSafeRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    !value.includes("\\") &&
    !path.posix.isAbsolute(value) &&
    value
      .split("/")
      .every((part) => part.length > 0 && part !== "." && part !== "..")
  );
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

async function readBoundedArtifact(
  root,
  relativePath,
  { allowedRoot, maxBytes },
) {
  if (!isSafeRelativePath(relativePath)) return null;
  const allowedRootPath = path.resolve(root, ...allowedRoot.split("/"));
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  if (!isInside(allowedRootPath, absolutePath)) return null;
  try {
    const [allowedRootMetadata, metadata] = await Promise.all([
      lstat(allowedRootPath),
      lstat(absolutePath),
    ]);
    if (
      allowedRootMetadata.isSymbolicLink() ||
      !allowedRootMetadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      !metadata.isFile() ||
      metadata.size === 0 ||
      metadata.size > maxBytes
    ) {
      return null;
    }
    const [allowedRootReal, artifactReal] = await Promise.all([
      realpath(allowedRootPath),
      realpath(absolutePath),
    ]);
    if (!isInside(allowedRootReal, artifactReal)) return null;
    const content = await readFile(absolutePath);
    if (content.length !== metadata.size) return null;
    return {
      path: relativePath,
      bytes: metadata.size,
      sha256: createHash("sha256").update(content).digest("hex"),
      content,
    };
  } catch {
    return null;
  }
}

async function readBoundedJson(root, relativePath, options) {
  const artifact = await readBoundedArtifact(root, relativePath, options);
  if (!artifact) return null;
  try {
    return {
      ...artifact,
      value: JSON.parse(artifact.content.toString("utf8")),
    };
  } catch {
    return null;
  }
}

function recordMatchesArtifact(record, artifact) {
  return (
    isPlainObject(record) &&
    record.path === artifact?.path &&
    Number.isSafeInteger(record.bytes) &&
    record.bytes > 0 &&
    record.bytes === artifact?.bytes &&
    SHA256.test(record.sha256 ?? "") &&
    record.sha256 === artifact?.sha256
  );
}

function isAllowedGeneratedReleaseMediaPath(relativePath, identity) {
  if (relativePath === `public/${identity.slug}-og.png`) return true;
  const parts = relativePath.split("/");
  const releaseDirectory = parts[2];
  if (
    parts.length !== 4 ||
    typeof releaseDirectory !== "string" ||
    !releaseDirectory.startsWith(`${identity.slug}-`) ||
    !/^[a-z0-9][a-z0-9-]{1,79}$/.test(releaseDirectory)
  ) {
    return false;
  }
  if (parts[0] === "docs" && parts[1] === "screenshots") {
    return SCREENSHOT_RELEASE_FILES.has(parts[3]);
  }
  if (parts[0] === "docs" && parts[1] === "media") {
    return RELEASE_MEDIA_OUTPUT_FILES.has(parts[3]);
  }
  return false;
}

function hasOnlyAllowlistedDescendantPaths({
  root,
  ancestor,
  descendant,
  allowedPath,
  allowEqual,
}) {
  if (
    !FULL_GIT_SHA.test(ancestor ?? "") ||
    !FULL_GIT_SHA.test(descendant ?? "")
  ) {
    return false;
  }
  if (ancestor === descendant) return allowEqual;
  try {
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
    const changedPaths = git(root, [
      "diff",
      "--name-only",
      "--no-renames",
      `${ancestor}..${descendant}`,
    ])
      .split(/\r?\n/)
      .filter(Boolean);
    return (
      changedPaths.length > 0 &&
      changedPaths.every((relativePath) => allowedPath(relativePath))
    );
  } catch {
    return false;
  }
}

function exactAssemblyTimelineRepairTransition({
  root,
  fromSourceSha,
  toSourceSha,
  reuse,
}) {
  if (fromSourceSha === toSourceSha) {
    return reuse === undefined ? { reused: false } : null;
  }
  const repairSpec = NARRATION_REUSE_REPAIR_SPECS.find(
    (candidate) =>
      reuse?.mode === candidate.mode &&
      JSON.stringify(reuse?.changedPaths) ===
        JSON.stringify(candidate.changedPaths),
  );
  if (
    !FULL_GIT_SHA.test(fromSourceSha ?? "") ||
    !FULL_GIT_SHA.test(toSourceSha ?? "") ||
    !isPlainObject(reuse) ||
    reuse.schemaVersion !== 1 ||
    !repairSpec ||
    reuse.fromSourceSha !== fromSourceSha ||
    reuse.toSourceSha !== toSourceSha
  ) {
    return null;
  }
  const repairPathSet = new Set(repairSpec.changedPaths);
  try {
    git(root, ["merge-base", "--is-ancestor", fromSourceSha, toSourceSha]);
    const changes = git(root, [
      "diff",
      "--name-status",
      "--no-renames",
      `${fromSourceSha}..${toSourceSha}`,
    ])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [status, changedPath, ...extra] = line.split("\t");
        return { status, changedPath, extra };
      });
    if (
      changes.length !== repairSpec.changedPaths.length ||
      !changes.every(
        ({ status, changedPath, extra }) =>
          status === "M" &&
          repairPathSet.has(changedPath) &&
          extra.length === 0,
      ) ||
      JSON.stringify(changes.map(({ changedPath }) => changedPath).sort()) !==
        JSON.stringify(repairSpec.changedPaths)
    ) {
      return null;
    }
    const files = repairSpec.changedPaths.map((changedPath) => ({
      path: changedPath,
      status: "M",
      beforeBlob: git(root, ["rev-parse", `${fromSourceSha}:${changedPath}`]),
      afterBlob: git(root, ["rev-parse", `${toSourceSha}:${changedPath}`]),
    }));
    if (
      files.some(
        ({ beforeBlob, afterBlob }) =>
          !/^[0-9a-f]{40,64}$/.test(beforeBlob) ||
          !/^[0-9a-f]{40,64}$/.test(afterBlob) ||
          beforeBlob === afterBlob,
      )
    ) {
      return null;
    }
    const transition = {
      schemaVersion: 1,
      mode: repairSpec.mode,
      fromSourceSha,
      toSourceSha,
      changedPaths: repairSpec.changedPaths,
      files,
    };
    const expected = {
      ...transition,
      transitionSha256: createHash("sha256")
        .update(JSON.stringify(transition))
        .digest("hex"),
    };
    return JSON.stringify(reuse) === JSON.stringify(expected) ? expected : null;
  } catch {
    return null;
  }
}

function screenshotRepairPathsAreExactOrAbsent({
  root,
  screenshotSourceSha,
  candidateSourceSha,
}) {
  try {
    const repairChanges = git(root, [
      "diff",
      "--name-status",
      "--no-renames",
      `${screenshotSourceSha}..${candidateSourceSha}`,
    ])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [status, changedPath, ...extra] = line.split("\t");
        return { status, changedPath, extra };
      })
      .filter(({ changedPath }) =>
        NARRATION_REUSE_REPAIR_PATH_SET.has(changedPath),
      );
    return (
      repairChanges.length === 0 ||
      NARRATION_REUSE_REPAIR_SPECS.some(
        ({ changedPaths }) =>
          repairChanges.length === changedPaths.length &&
          repairChanges.every(
            ({ status, extra }) => status === "M" && extra.length === 0,
          ) &&
          JSON.stringify(
            repairChanges.map(({ changedPath }) => changedPath).sort(),
          ) === JSON.stringify(changedPaths),
      )
    );
  } catch {
    return false;
  }
}

function candidateHasOnlyFinalEvidenceDescendants({
  root,
  candidateSourceSha,
  head,
}) {
  return hasOnlyAllowlistedDescendantPaths({
    root,
    ancestor: candidateSourceSha,
    descendant: head,
    allowedPath: (relativePath) => relativePath === FINAL_RELEASE_EVIDENCE_PATH,
    allowEqual: false,
  });
}

function screenshotSourceBecomesCandidate({
  root,
  screenshotSourceSha,
  candidateSourceSha,
  identity,
}) {
  return (
    hasOnlyAllowlistedDescendantPaths({
      root,
      ancestor: screenshotSourceSha,
      descendant: candidateSourceSha,
      allowedPath: (relativePath) =>
        isAllowedGeneratedReleaseMediaPath(relativePath, identity) ||
        NARRATION_REUSE_REPAIR_PATH_SET.has(relativePath),
      allowEqual: false,
    }) &&
    screenshotRepairPathsAreExactOrAbsent({
      root,
      screenshotSourceSha,
      candidateSourceSha,
    })
  );
}

async function readFinalReleaseEvidence(root) {
  const configDirectory = path.join(root, "config");
  const evidencePath = path.join(
    root,
    ...FINAL_RELEASE_EVIDENCE_PATH.split("/"),
  );
  const [directoryMetadata, evidenceMetadata] = await Promise.all([
    lstat(configDirectory),
    lstat(evidencePath),
  ]);
  if (
    directoryMetadata.isSymbolicLink() ||
    !directoryMetadata.isDirectory() ||
    evidenceMetadata.isSymbolicLink() ||
    !evidenceMetadata.isFile() ||
    evidenceMetadata.size === 0 ||
    evidenceMetadata.size > MAX_FINAL_RELEASE_EVIDENCE_BYTES
  ) {
    throw new Error(
      `${FINAL_RELEASE_EVIDENCE_PATH} must be a non-empty regular JSON file inside config.`,
    );
  }
  const [directoryReal, evidenceReal, content] = await Promise.all([
    realpath(configDirectory),
    realpath(evidencePath),
    readFile(evidencePath),
  ]);
  if (path.dirname(evidenceReal) !== directoryReal) {
    throw new Error(
      `${FINAL_RELEASE_EVIDENCE_PATH} must remain directly inside config.`,
    );
  }
  try {
    git(root, [
      "ls-files",
      "--error-unmatch",
      "--",
      FINAL_RELEASE_EVIDENCE_PATH,
    ]);
    const committedContent = gitBytes(root, [
      "show",
      `HEAD:${FINAL_RELEASE_EVIDENCE_PATH}`,
    ]);
    if (!committedContent.equals(content)) {
      throw new Error("content mismatch");
    }
  } catch {
    throw new Error(
      `${FINAL_RELEASE_EVIDENCE_PATH} must be tracked and byte-identical to HEAD.`,
    );
  }
  try {
    return JSON.parse(content.toString("utf8"));
  } catch {
    throw new Error(`${FINAL_RELEASE_EVIDENCE_PATH} must contain valid JSON.`);
  }
}

function hasReleaseEvidenceShape(evidence, identity) {
  if (!isPlainObject(evidence)) return false;
  const expectedKeys = [
    "application",
    "devpost",
    "feedback",
    "kind",
    "liveEvaluation",
    "media",
    "publicName",
    "releaseIdentity",
    "reviewerRepository",
    "schemaVersion",
  ];
  return (
    JSON.stringify(Object.keys(evidence).sort()) ===
      JSON.stringify(expectedKeys) &&
    evidence.schemaVersion === 1 &&
    evidence.kind === "wonderlab-final-release-evidence" &&
    JSON.stringify(evidence.releaseIdentity) ===
      JSON.stringify(releaseIdentityRecord(identity)) &&
    [
      evidence.publicName,
      evidence.liveEvaluation,
      evidence.application,
      evidence.reviewerRepository,
      evidence.media,
      evidence.devpost,
      evidence.feedback,
    ].every(isPlainObject)
  );
}

async function hasCurrentReleaseMediaReceipt(root, relativePath, identity) {
  if (
    !isSafeRelativePath(relativePath) ||
    !relativePath.startsWith("docs/media/") ||
    !relativePath.endsWith("/release-media-receipt.json")
  ) {
    return false;
  }
  const receiptArtifact = await readBoundedJson(root, relativePath, {
    allowedRoot: "docs/media",
    maxBytes: MAX_RELEASE_MEDIA_RECEIPT_BYTES,
  });
  const receipt = receiptArtifact?.value;
  const releaseDirectory = relativePath.split("/")[2];
  const screenshotDirectory = `docs/screenshots/${releaseDirectory}`;
  const expectedIdentity = releaseIdentityRecord(identity);
  if (
    !isPlainObject(receipt) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== "wonderlab-release-media-receipt" ||
    !isRecentPastIsoTimestamp(receipt.generatedAt) ||
    receipt.releaseDirectory !== releaseDirectory ||
    !releaseDirectory.startsWith(`${identity.slug}-`) ||
    JSON.stringify(receipt.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    !FULL_GIT_SHA.test(receipt.screenshotEvidence?.sourceSha ?? "") ||
    receipt.screenshotEvidence?.ownerPath !==
      `${screenshotDirectory}/.wonderlab-screenshot-output.json` ||
    receipt.screenshotEvidence?.receiptPath !==
      `${screenshotDirectory}/screenshot-receipt.json` ||
    !Array.isArray(receipt.mediaFiles) ||
    receipt.mediaFiles.length !== RELEASE_MEDIA_CONTENT_FILES.length ||
    receipt.publicOg?.path !== `public/${identity.slug}-og.png`
  ) {
    return false;
  }

  const [ownerArtifact, screenshotReceiptArtifact] = await Promise.all([
    readBoundedJson(root, receipt.screenshotEvidence.ownerPath, {
      allowedRoot: "docs/screenshots",
      maxBytes: MAX_RELEASE_MEDIA_RECEIPT_BYTES,
    }),
    readBoundedJson(root, receipt.screenshotEvidence.receiptPath, {
      allowedRoot: "docs/screenshots",
      maxBytes: MAX_RELEASE_MEDIA_RECEIPT_BYTES,
    }),
  ]);
  const owner = ownerArtifact?.value;
  const screenshotReceipt = screenshotReceiptArtifact?.value;
  if (
    !isPlainObject(owner) ||
    owner.schemaVersion !== 1 ||
    owner.owner !== "wonderlab-screenshot-output-v1" ||
    owner.sourceSha !== receipt.screenshotEvidence.sourceSha ||
    owner.outputDir !== screenshotDirectory ||
    JSON.stringify(owner.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    !isPlainObject(screenshotReceipt) ||
    screenshotReceipt.schemaVersion !== 1 ||
    screenshotReceipt.kind !== "wonderlab-screenshot-receipt" ||
    !isRecentPastIsoTimestamp(screenshotReceipt.generatedAt) ||
    screenshotReceipt.source?.fullSha !==
      receipt.screenshotEvidence.sourceSha ||
    screenshotReceipt.source?.cleanBeforeCapture !== true ||
    screenshotReceipt.outputDir !== screenshotDirectory ||
    JSON.stringify(screenshotReceipt.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    screenshotReceiptArtifact.sha256 !==
      receipt.screenshotEvidence.receiptSha256 ||
    !Array.isArray(screenshotReceipt.screenshots) ||
    screenshotReceipt.screenshots.length !== SCREENSHOT_RELEASE_FILES.size - 2
  ) {
    return false;
  }
  if (
    !isRecentPastIsoTimestamp(receipt.generatedAt, {
      after: screenshotReceipt.generatedAt,
    })
  ) {
    return false;
  }

  const screenshotRecords = screenshotReceipt.screenshots;
  for (const filename of [...SCREENSHOT_RELEASE_FILES].filter(
    (candidate) => !candidate.endsWith(".json"),
  )) {
    const expectedPath = `${screenshotDirectory}/${filename}`;
    const record = screenshotRecords.find(
      (candidate) => candidate?.path === expectedPath,
    );
    const artifact = await readBoundedArtifact(root, expectedPath, {
      allowedRoot: "docs/screenshots",
      maxBytes: MAX_RELEASE_VIDEO_BYTES,
    });
    if (!recordMatchesArtifact(record, artifact)) return false;
    if (
      filename === "discovery-desktop.jpg" &&
      JSON.stringify(record) !==
        JSON.stringify(receipt.screenshotEvidence.releaseScreenshot)
    ) {
      return false;
    }
  }

  const mediaArtifacts = {};
  for (const [index, filename] of RELEASE_MEDIA_CONTENT_FILES.entries()) {
    const record = receipt.mediaFiles[index];
    const expectedPath = `docs/media/${releaseDirectory}/${filename}`;
    if (record?.filename !== filename || record?.path !== expectedPath) {
      return false;
    }
    const artifact = await readBoundedArtifact(root, expectedPath, {
      allowedRoot: "docs/media",
      maxBytes: MAX_RELEASE_VIDEO_BYTES,
    });
    if (!recordMatchesArtifact(record, artifact)) return false;
    mediaArtifacts[filename] = artifact;
  }
  const publicOgArtifact = await readBoundedArtifact(
    root,
    receipt.publicOg.path,
    { allowedRoot: "public", maxBytes: MAX_RELEASE_VIDEO_BYTES },
  );
  return recordMatchesArtifact(receipt.publicOg, publicOgArtifact)
    ? { artifact: receiptArtifact, receipt, mediaArtifacts }
    : false;
}

async function hasCurrentLiveEvaluationReport(
  root,
  reportRecord,
  identity,
  candidateSourceSha,
  applicationUrl,
) {
  const relativePath = reportRecord?.path;
  if (
    !isSafeRelativePath(relativePath) ||
    !relativePath.startsWith("output/release/") ||
    !relativePath.endsWith(".json")
  ) {
    return false;
  }
  const wrapperArtifact = await readBoundedJson(root, relativePath, {
    allowedRoot: "output/release",
    maxBytes: MAX_FINAL_RELEASE_EVIDENCE_BYTES,
  });
  if (!recordMatchesArtifact(reportRecord, wrapperArtifact)) return false;
  const wrapper = wrapperArtifact?.value;
  if (
    !isPlainObject(wrapper) ||
    wrapper.schemaVersion !== 1 ||
    wrapper.kind !== "wonderlab-live-evaluation-report" ||
    JSON.stringify(wrapper.releaseIdentity) !==
      JSON.stringify(releaseIdentityRecord(identity)) ||
    wrapper.source?.fullSha !== candidateSourceSha ||
    wrapper.source?.cleanBeforeRun !== true ||
    wrapper.model?.id !== "gpt-5.6" ||
    wrapper.webSearch?.required !== true ||
    wrapper.webSearch?.completed !== true ||
    wrapper.citations?.required !== true ||
    wrapper.citations?.present !== true ||
    wrapper.citationReview?.humanReviewed !== true ||
    wrapper.citationReview?.passed !== true ||
    !isRecentPastIsoTimestamp(wrapper.citationReview?.reviewedAt) ||
    !isPlainObject(wrapper.evaluationReport)
  ) {
    return false;
  }

  const actualArtifact = await readBoundedJson(
    root,
    wrapper.evaluationReport.path,
    { allowedRoot: "output/evals", maxBytes: MAX_RELEASE_JSON_BYTES },
  );
  if (!recordMatchesArtifact(wrapper.evaluationReport, actualArtifact)) {
    return false;
  }
  const report = actualArtifact.value;
  const fixtures = report?.fixtures;
  const summary = report?.summary;
  const fixtureIds = Array.isArray(fixtures)
    ? fixtures.map((fixture) => fixture?.id)
    : [];
  const expectedTargetOrigin = normalizedOrigin(applicationUrl);
  const fixturesAreComplete = fixtures?.every((fixture) => {
    const checkIds = Array.isArray(fixture?.checks)
      ? fixture.checks.map((fixtureCheck) => fixtureCheck?.id)
      : [];
    const stageTimings = fixture?.stageTimings;
    const associations = fixture?.evidence?.sourceAssociations;
    const bundle = fixture?.evidence?.bundle;
    const bundleItems = bundle?.items;
    const bundleSources = bundle?.sources;
    return (
      isPlainObject(fixture) &&
      typeof fixture.question === "string" &&
      fixture.question.trim().length > 0 &&
      isPlainObject(fixture.settings) &&
      typeof fixture.settings.level === "string" &&
      Number.isSafeInteger(fixture.settings.durationMinutes) &&
      fixture.settings.durationMinutes > 0 &&
      isPlainObject(fixture.syntheticInput) &&
      typeof fixture.syntheticInput.prediction === "string" &&
      fixture.syntheticInput.prediction.trim().length > 0 &&
      typeof fixture.syntheticInput.artifact === "string" &&
      fixture.syntheticInput.artifact.trim().length > 0 &&
      isPlainObject(fixture.syntheticInput.evidenceDecision) &&
      isPlainObject(fixture.syntheticInput.evidenceApplication) &&
      isPastOrPresentIsoTimestamp(fixture.startedAt) &&
      isPastOrPresentIsoTimestamp(fixture.completedAt) &&
      Date.parse(fixture.completedAt) >= Date.parse(fixture.startedAt) &&
      isIsoTimestamp(report?.run?.startedAt) &&
      isIsoTimestamp(report?.run?.completedAt) &&
      Date.parse(fixture.startedAt) >= Date.parse(report.run.startedAt) &&
      Date.parse(fixture.completedAt) <= Date.parse(report.run.completedAt) &&
      Number.isFinite(fixture.durationMs) &&
      fixture.durationMs >= 0 &&
      isPlainObject(stageTimings) &&
      JSON.stringify(Object.keys(stageTimings).sort()) ===
        JSON.stringify([...REQUIRED_LIVE_EVAL_STAGES].sort()) &&
      REQUIRED_LIVE_EVAL_STAGES.every(
        (stage) =>
          stageTimings[stage]?.status === "completed" &&
          Number.isFinite(stageTimings[stage]?.durationMs) &&
          stageTimings[stage].durationMs >= 0,
      ) &&
      Array.isArray(fixture.routes) &&
      fixture.routes.length === 3 &&
      isPlainObject(fixture.selectedRoute) &&
      typeof fixture.selectedRoute.id === "string" &&
      isPlainObject(fixture.quest) &&
      isPlainObject(bundle) &&
      Array.isArray(bundleItems) &&
      bundleItems.length >= 2 &&
      bundleItems.length <= 4 &&
      Array.isArray(bundleSources) &&
      bundleSources.length >= 1 &&
      bundleSources.length <= 8 &&
      typeof bundle.conciseExplanation === "string" &&
      bundle.conciseExplanation.trim().length > 0 &&
      new Set(bundleItems.map((item) => item?.id)).size ===
        bundleItems.length &&
      new Set(bundleSources.map((source) => source?.id)).size ===
        bundleSources.length &&
      bundleItems.every(
        (item) =>
          isPlainObject(item) &&
          typeof item.id === "string" &&
          item.id.length > 0 &&
          ["evidence", "inference", "open_question"].includes(item.kind) &&
          typeof item.statement === "string" &&
          item.statement.trim().length > 0 &&
          Array.isArray(item.sourceIds) &&
          (item.kind !== "evidence" || item.sourceIds.length > 0) &&
          new Set(item.sourceIds).size === item.sourceIds.length &&
          item.sourceIds.every((sourceId) =>
            bundleSources.some((source) => source?.id === sourceId),
          ),
      ) &&
      bundleItems.some((item) => item?.kind === "evidence") &&
      bundleSources.every(
        (source) =>
          isPlainObject(source) &&
          typeof source.id === "string" &&
          source.id.length > 0 &&
          typeof source.title === "string" &&
          source.title.trim().length > 0 &&
          typeof source.domain === "string" &&
          source.domain.trim().length > 0 &&
          isPublicHttpsUrl(source.url) &&
          (() => {
            const hostname = new URL(source.url).hostname.replace(/^www\./, "");
            const declaredDomain = source.domain
              .toLocaleLowerCase("en-US")
              .replace(/^www\./, "");
            return (
              hostname === declaredDomain ||
              hostname.endsWith(`.${declaredDomain}`)
            );
          })(),
      ) &&
      Array.isArray(associations) &&
      associations.length === bundleItems.length &&
      new Set(associations.map((association) => association?.itemId)).size ===
        associations.length &&
      associations.every(
        (association) =>
          isPlainObject(association) &&
          (() => {
            const item = bundleItems.find(
              (candidate) => candidate?.id === association.itemId,
            );
            const expectedSources = item?.sourceIds?.map((sourceId) =>
              bundleSources.find((source) => source?.id === sourceId),
            );
            return (
              item &&
              association.kind === item.kind &&
              association.statement === item.statement &&
              JSON.stringify(association.sourceIds) ===
                JSON.stringify(item.sourceIds) &&
              JSON.stringify(association.sources) ===
                JSON.stringify(expectedSources) &&
              Array.isArray(association.unresolvedSourceIds) &&
              association.unresolvedSourceIds.length === 0
            );
          })() &&
          Array.isArray(association.sources) &&
          association.sources.every(
            (source) =>
              isPlainObject(source) &&
              typeof source.id === "string" &&
              association.sourceIds.includes(source.id) &&
              isPublicHttpsUrl(source.url),
          ),
      ) &&
      isPlainObject(fixture.reflectionResult) &&
      isPlainObject(fixture.mapSummary) &&
      Number.isSafeInteger(fixture.mapSummary.nodeCount) &&
      fixture.mapSummary.nodeCount > 0 &&
      fixture.failure === null &&
      fixture.passed === true &&
      Array.isArray(fixture.checks) &&
      fixture.checks.length >= REQUIRED_LIVE_EVAL_CHECK_IDS.length &&
      new Set(checkIds).size === checkIds.length &&
      REQUIRED_LIVE_EVAL_CHECK_IDS.every((id) => checkIds.includes(id)) &&
      fixture.checks.every(
        (fixtureCheck) =>
          isPlainObject(fixtureCheck) &&
          typeof fixtureCheck.id === "string" &&
          typeof fixtureCheck.detail === "string" &&
          fixtureCheck.detail.length > 0 &&
          fixtureCheck.passed === true,
      )
    );
  });
  const valid =
    isPlainObject(report) &&
    report.schemaVersion === 2 &&
    report.kind === "wonderlab-live-evaluation" &&
    isRecentPastIsoTimestamp(report.generatedAt) &&
    isPlainObject(report.run) &&
    report.run.runnerAccessedApiKey === false &&
    isRecentPastIsoTimestamp(report.run.startedAt) &&
    isRecentPastIsoTimestamp(report.run.completedAt, {
      after: report.run.startedAt,
    }) &&
    Date.parse(report.run.completedAt) >= Date.parse(report.run.startedAt) &&
    isRecentPastIsoTimestamp(report.generatedAt, {
      after: report.run.completedAt,
    }) &&
    isRecentPastIsoTimestamp(wrapper.citationReview?.reviewedAt, {
      after: report.generatedAt,
    }) &&
    report.run.targetOrigin === expectedTargetOrigin &&
    isPlainObject(report.privacy) &&
    report.privacy.syntheticFixturesOnly === true &&
    Array.isArray(fixtures) &&
    fixtures.length === REQUIRED_LIVE_EVAL_FIXTURE_IDS.length &&
    JSON.stringify([...fixtureIds].sort()) ===
      JSON.stringify([...REQUIRED_LIVE_EVAL_FIXTURE_IDS].sort()) &&
    fixtures.length === report.run.fixtureCount &&
    report.run.requestedFixtureLimit ===
      REQUIRED_LIVE_EVAL_FIXTURE_IDS.length &&
    summary?.passed === true &&
    summary.totalFixtures === fixtures.length &&
    summary.passedFixtures === fixtures.length &&
    summary.failedFixtures === 0 &&
    Number.isSafeInteger(summary.totalChecks) &&
    summary.totalChecks ===
      fixtures.reduce((total, fixture) => total + fixture.checks.length, 0) &&
    summary.passedChecks === summary.totalChecks &&
    summary.failedChecks === 0 &&
    fixturesAreComplete;
  return valid ? { report, wrapper } : false;
}

function hasLiveReviewerRemoteBinding(root, reviewerRepository) {
  try {
    const head = git(root, [
      "ls-remote",
      "--symref",
      reviewerRepository.url,
      "HEAD",
    ]);
    const refs = git(root, ["ls-remote", reviewerRepository.url]);
    const headIncludesReviewerSha = head
      .split("\n")
      .some((line) => line === `${reviewerRepository.fullSha}\tHEAD`);
    const refIncludesReviewerSha = refs
      .split("\n")
      .some((line) => line.startsWith(`${reviewerRepository.fullSha}\t`));
    return headIncludesReviewerSha && refIncludesReviewerSha;
  } catch {
    // This is intentionally fail-closed: a release gate cannot treat a
    // locally recorded repository URL as evidence that the reviewer can fetch it.
    return false;
  }
}

async function hasCurrentReviewerHistoryAudit(
  root,
  reviewerRepository,
  identity,
  candidateSourceSha,
) {
  const auditRecord = reviewerRepository?.historyAudit;
  const auditPath = auditRecord?.path;
  if (
    !isCanonicalGithubRepositoryUrl(reviewerRepository?.url) ||
    !isSafeRelativePath(auditPath) ||
    !auditPath.startsWith("output/release/") ||
    !auditPath.endsWith("reviewer-history-audit.json")
  ) {
    return false;
  }
  const artifact = await readBoundedJson(root, auditPath, {
    allowedRoot: "output/release",
    maxBytes: MAX_FINAL_RELEASE_EVIDENCE_BYTES,
  });
  if (!recordMatchesArtifact(auditRecord, artifact)) return false;
  const audit = artifact?.value;
  let candidateTreeSha = null;
  try {
    candidateTreeSha = git(root, ["rev-parse", `${candidateSourceSha}^{tree}`]);
  } catch {
    return false;
  }
  const reviewerUrl = reviewerRepository.url.replace(/\/$/, "");
  const permissionRecord = await readBoundedJson(
    root,
    audit.permissionEvidence?.recordPath,
    {
      allowedRoot: "output/release",
      maxBytes: MAX_FINAL_RELEASE_EVIDENCE_BYTES,
    },
  );
  const permissionEvidenceValid =
    permissionRecord &&
    permissionRecord.sha256 === audit.permissionEvidence?.recordSha256 &&
    isPlainObject(permissionRecord.value) &&
    permissionRecord.value.schemaVersion === 1 &&
    permissionRecord.value.kind === "wonderlab-github-reviewer-access" &&
    permissionRecord.value.repositoryUrl === reviewerRepository.url &&
    isRecentPastIsoTimestamp(permissionRecord.value.capturedAt) &&
    Array.isArray(permissionRecord.value.grants) &&
    permissionRecord.value.grants.length === REQUIRED_REVIEWERS.length &&
    REQUIRED_REVIEWERS.every((reviewer) =>
      permissionRecord.value.grants.some(
        (grant) =>
          isPlainObject(grant) &&
          grant.email === reviewer &&
          grant.repositoryUrl === reviewerRepository.url &&
          typeof grant.githubLogin === "string" &&
          /^[A-Za-z0-9-]+$/.test(grant.githubLogin) &&
          grant.permission === "pull" &&
          grant.capturedAt === permissionRecord.value.capturedAt &&
          isRecentPastIsoTimestamp(grant.capturedAt) &&
          grant.captureSource === "github-api-collaborators",
      ),
    );
  const valid =
    isPlainObject(audit) &&
    audit.schemaVersion === 1 &&
    audit.kind === "wonderlab-reviewer-history-audit" &&
    JSON.stringify(audit.releaseIdentity) ===
      JSON.stringify(releaseIdentityRecord(identity)) &&
    audit.candidateSourceSha === candidateSourceSha &&
    audit.reviewerRepository?.url === reviewerRepository.url &&
    audit.reviewerRepository?.fullSha === reviewerRepository.fullSha &&
    audit.repositoryMode === "history_free_export" &&
    audit.sourceMapping?.candidateFullSha === candidateSourceSha &&
    audit.sourceMapping?.candidateTreeSha === candidateTreeSha &&
    audit.sourceMapping?.reviewerFullSha === reviewerRepository.fullSha &&
    audit.sourceMapping?.reviewerTreeSha === candidateTreeSha &&
    audit.sourceMapping?.treesMatch === true &&
    audit.remoteVerification?.commitUrl ===
      `${reviewerUrl}/commit/${reviewerRepository.fullSha}` &&
    isPublicHttpsUrl(audit.remoteVerification?.commitUrl, {
      host: "github.com",
    }) &&
    isRecentPastIsoTimestamp(audit.remoteVerification?.verifiedAt) &&
    isPlainObject(audit.permissionEvidence) &&
    audit.permissionEvidence.captureMethod ===
      "github-reviewer-access-export" &&
    isSafeRelativePath(audit.permissionEvidence.recordPath) &&
    audit.permissionEvidence.recordPath.startsWith("output/release/") &&
    audit.permissionEvidence.recordPath.endsWith(
      "github-reviewer-access.json",
    ) &&
    SHA256.test(audit.permissionEvidence.recordSha256 ?? "") &&
    isRecentPastIsoTimestamp(audit.permissionEvidence?.verifiedAt, {
      after: permissionRecord?.value?.capturedAt,
    }) &&
    Array.isArray(audit.permissionEvidence?.reviewerAccess) &&
    REQUIRED_REVIEWERS.every((reviewer) =>
      audit.permissionEvidence.reviewerAccess.includes(reviewer),
    ) &&
    permissionEvidenceValid &&
    isRecentPastIsoTimestamp(audit.auditedAt, {
      after: audit.permissionEvidence?.verifiedAt,
    }) &&
    audit.checks?.unverifiedRouteArtAbsent === true &&
    audit.checks?.largeBinariesAbsent === true &&
    audit.checks?.secretsScanPassed === true &&
    isRecentPastIsoTimestamp(audit.auditedAt, {
      after: audit.remoteVerification?.verifiedAt,
    });
  return valid ? { audit } : false;
}

function looksLikeMp3(content) {
  return (
    content?.subarray(0, 3).toString("ascii") === "ID3" ||
    (content?.length >= 2 &&
      content[0] === 0xff &&
      (content[1] & 0xe0) === 0xe0)
  );
}

function looksLikeMp4(content) {
  return (
    content?.length >= 12 && content.subarray(4, 8).toString("ascii") === "ftyp"
  );
}

function runBoundedMediaCommand(command, args, root) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  return { stdout: result.stdout, stderr: result.stderr };
}

function lastNumericMatch(value, pattern) {
  const matches = [...value.matchAll(pattern)];
  const parsed = Number(matches.at(-1)?.[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function verifyFinalVideoStreams(root, videoArtifact) {
  const absolutePath = path.join(root, ...videoArtifact.path.split("/"));
  const probeResult = runBoundedMediaCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_name,codec_type,width,height,duration,nb_frames",
      "-of",
      "json",
      absolutePath,
    ],
    root,
  );
  if (!probeResult) return null;
  let probe;
  try {
    probe = JSON.parse(probeResult.stdout);
  } catch {
    return null;
  }
  const video = probe?.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe?.streams?.find((stream) => stream.codec_type === "audio");
  const subtitles = probe?.streams?.filter(
    (stream) => stream.codec_type === "subtitle",
  );
  const subtitle = subtitles?.[0];
  const durationSeconds = Number(probe?.format?.duration);
  const videoStreamDurationSeconds = Number(video?.duration);
  const videoFrameCount = Number(video?.nb_frames);
  if (
    video?.codec_name !== "h264" ||
    video.width !== 1280 ||
    video.height !== 720 ||
    audio?.codec_name !== "aac" ||
    subtitles?.length !== 1 ||
    subtitle?.codec_name !== "mov_text" ||
    !Number.isSafeInteger(subtitle.index) ||
    !Number.isFinite(durationSeconds) ||
    Math.abs(durationSeconds - DEMO_FINAL_SECONDS) > 0.15 ||
    !Number.isFinite(videoStreamDurationSeconds) ||
    Math.abs(videoStreamDurationSeconds - DEMO_FINAL_SECONDS) > 0.15 ||
    !Number.isSafeInteger(videoFrameCount) ||
    Math.abs(videoFrameCount - DEMO_FINAL_FRAME_COUNT) > 1
  ) {
    return null;
  }
  const decodeResult = runBoundedMediaCommand(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-v",
      "info",
      "-i",
      absolutePath,
      "-filter_complex",
      "[0:a:0]ebur128=peak=true[aout]",
      "-map",
      "0:v:0",
      "-map",
      "[aout]",
      "-f",
      "null",
      "-",
    ],
    root,
  );
  if (!decodeResult) return null;
  const output = `${decodeResult.stdout}\n${decodeResult.stderr}`;
  const integratedLufs = lastNumericMatch(
    output,
    /\bI:\s*(-?\d+(?:\.\d+)?)\s+LUFS/g,
  );
  const truePeakDbfs = lastNumericMatch(
    output,
    /\bPeak:\s*(-?\d+(?:\.\d+)?)\s+dBFS/g,
  );
  if (
    integratedLufs === null ||
    integratedLufs < -18 ||
    integratedLufs > -14 ||
    truePeakDbfs === null ||
    truePeakDbfs > -1
  ) {
    return null;
  }
  return {
    durationSeconds,
    videoStreamDurationSeconds,
    videoFrameCount,
    width: video.width,
    height: video.height,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    subtitleCodec: subtitle.codec_name,
    subtitleStreamIndex: subtitle.index,
    integratedLufs,
    truePeakDbfs,
  };
}

function embeddedSubtitleMatchesReceipt(
  root,
  videoArtifact,
  receiptCues,
  subtitleStreamIndex,
) {
  const absolutePath = path.join(root, ...videoArtifact.path.split("/"));
  const extraction = runBoundedMediaCommand(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-v",
      "error",
      "-i",
      absolutePath,
      "-map",
      `0:${subtitleStreamIndex}`,
      "-f",
      "srt",
      "-",
    ],
    root,
  );
  if (!extraction || !extraction.stdout.trim()) return false;
  try {
    const embeddedCues = parseDemoSrt(extraction.stdout);
    return (
      embeddedCues.length === receiptCues.length &&
      embeddedCues.every((cue, index) => {
        const receiptCue = receiptCues[index];
        return (
          cue.start === receiptCue.start &&
          cue.end === receiptCue.end &&
          cue.text === receiptCue.text
        );
      })
    );
  } catch {
    return false;
  }
}

function verifyProviderAudio(root, audioArtifact) {
  const absolutePath = path.join(root, ...audioArtifact.path.split("/"));
  const result = runBoundedMediaCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,codec_type",
      "-of",
      "json",
      absolutePath,
    ],
    root,
  );
  if (!result) return false;
  try {
    const probe = JSON.parse(result.stdout);
    const duration = Number(probe?.format?.duration);
    return (
      Number.isFinite(duration) &&
      duration > 0 &&
      probe?.streams?.some(
        (stream) =>
          stream.codec_type === "audio" && stream.codec_name === "mp3",
      )
    );
  } catch {
    return false;
  }
}

async function validateManifestArtifactRecord(
  root,
  record,
  { allowedRoot = "output/playwright", maxBytes = MAX_RELEASE_JSON_BYTES } = {},
) {
  const artifact = await readBoundedArtifact(root, record?.path, {
    allowedRoot,
    maxBytes,
  });
  return recordMatchesArtifact(record, artifact) ? artifact : null;
}

async function hasCurrentFinalAssembly(
  root,
  finalAssembly,
  identity,
  narration,
  candidateSourceSha,
  mediaReceiptResult,
) {
  if (
    !isPlainObject(finalAssembly) ||
    !isSafeRelativePath(finalAssembly.path) ||
    !finalAssembly.path.startsWith("output/playwright/") ||
    !finalAssembly.path.endsWith("/rehearsal-manifest.json")
  ) {
    return false;
  }
  const manifestArtifact = await readBoundedJson(root, finalAssembly.path, {
    allowedRoot: "output/playwright",
    maxBytes: MAX_RELEASE_JSON_BYTES,
  });
  if (!recordMatchesArtifact(finalAssembly, manifestArtifact)) return false;
  const manifest = manifestArtifact.value;
  const expectedIdentity = releaseIdentityRecord(identity);
  const expectedNarration = releaseNarrationRecord(narration);
  const artifactSourceDirectory =
    manifest?.narration?.artifactSource?.directory;
  const artifactSourceParts = isSafeRelativePath(artifactSourceDirectory)
    ? artifactSourceDirectory.split("/")
    : [];
  const providerSourceSha =
    manifest?.narration?.artifactSource?.captureSourceSha;
  const providerSourceReused = providerSourceSha !== candidateSourceSha;
  const reuseTransition = exactAssemblyTimelineRepairTransition({
    root,
    fromSourceSha: providerSourceSha,
    toSourceSha: candidateSourceSha,
    reuse: manifest?.narration?.artifactReuse,
  });
  if (
    !isPlainObject(manifest) ||
    manifest.schemaVersion !== (providerSourceReused ? 3 : 2) ||
    !reuseTransition ||
    manifest.mode !== "seeded_fallback" ||
    !isRecentPastIsoTimestamp(manifest.generatedAt) ||
    manifest.source?.capture?.fullSha !== candidateSourceSha ||
    manifest.source?.capture?.dirty !== false ||
    manifest.source?.assembly?.fullSha !== candidateSourceSha ||
    manifest.source?.assembly?.dirty !== false ||
    JSON.stringify(manifest.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    JSON.stringify(manifest.releaseNarration) !==
      JSON.stringify(expectedNarration) ||
    manifest.releaseMedia?.receipt?.path !==
      mediaReceiptResult?.artifact?.path ||
    manifest.releaseMedia?.receipt?.sha256 !==
      mediaReceiptResult?.artifact?.sha256 ||
    manifest.releaseMedia?.screenshotEvidence?.sourceSha !==
      mediaReceiptResult?.receipt?.screenshotEvidence?.sourceSha ||
    manifest.releaseMedia?.publicOgOutput !==
      `public/${identity.slug}-og.png` ||
    manifest.voice !== narration.voiceId ||
    manifest.narration?.provider !== "elevenlabs" ||
    manifest.narration?.voiceId !== narration.voiceId ||
    manifest.narration?.modelId !== "eleven_multilingual_v2" ||
    manifest.narration?.captureSourceSha !== providerSourceSha ||
    artifactSourceParts.length !== 3 ||
    artifactSourceParts[0] !== "output" ||
    artifactSourceParts[1] !== "playwright" ||
    manifest.narration?.verification?.mode !== narration.verificationMode ||
    manifest.narration?.verification?.voiceId !== narration.voiceId ||
    manifest.narration?.approvedVoice?.voiceId !== narration.voiceId ||
    manifest.narration?.alignment !== "raw_character_alignment"
  ) {
    return false;
  }

  const providerArtifactDirectory = `${artifactSourceDirectory}/elevenlabs`;
  if (
    manifest.narration.approval?.path !==
      `${providerArtifactDirectory}/approved-voice.json` ||
    manifest.narration.attempt?.path !==
      `${providerArtifactDirectory}/narration-attempt.json` ||
    manifest.narration.timing?.path !==
      `${providerArtifactDirectory}/narration-timestamps.json` ||
    manifest.narration.audio?.path !==
      `${providerArtifactDirectory}/narration.mp3` ||
    manifest.narration.artifactSource?.captureManifest?.path !==
      `${artifactSourceDirectory}/capture-manifest.json`
  ) {
    return false;
  }

  const [
    approvalArtifact,
    attemptArtifact,
    timingArtifact,
    audioArtifact,
    providerCaptureManifestArtifact,
  ] = await Promise.all([
    validateManifestArtifactRecord(root, manifest.narration.approval),
    validateManifestArtifactRecord(root, manifest.narration.attempt),
    validateManifestArtifactRecord(root, manifest.narration.timing),
    validateManifestArtifactRecord(root, manifest.narration.audio, {
      maxBytes: MAX_RELEASE_AUDIO_BYTES,
    }),
    validateManifestArtifactRecord(
      root,
      manifest.narration.artifactSource.captureManifest,
    ),
  ]);
  if (
    !approvalArtifact ||
    !attemptArtifact ||
    !timingArtifact ||
    !audioArtifact ||
    !providerCaptureManifestArtifact ||
    !looksLikeMp3(audioArtifact.content) ||
    !verifyProviderAudio(root, audioArtifact)
  ) {
    return false;
  }
  let approval;
  let attempt;
  let timing;
  let providerCaptureManifest;
  try {
    approval = JSON.parse(approvalArtifact.content.toString("utf8"));
    attempt = JSON.parse(attemptArtifact.content.toString("utf8"));
    timing = JSON.parse(timingArtifact.content.toString("utf8"));
    providerCaptureManifest = JSON.parse(
      providerCaptureManifestArtifact.content.toString("utf8"),
    );
  } catch {
    return false;
  }
  let cues;
  let captionMetrics;
  try {
    cues = parseDemoSrt(
      mediaReceiptResult.mediaArtifacts[
        "seeded-demo-rehearsal.srt"
      ].content.toString("utf8"),
    );
    captionMetrics = validateDemoCues(cues);
  } catch {
    return false;
  }
  const expectedNarrationText = cues.map((cue) => cue.text).join("\n\n");
  const alignment = timing?.alignment;
  let approvalDigest = null;
  try {
    approvalDigest = approvedVoiceRecordDigest(approval);
  } catch {
    return false;
  }
  if (
    approval?.schemaVersion !== 2 ||
    approval.provider !== "elevenlabs" ||
    approval.status !== "approved" ||
    approval.voice?.voiceId !== narration.voiceId ||
    approval.captureSourceSha !== providerSourceSha ||
    approval.verification?.mode !== narration.verificationMode ||
    approval.verification?.voiceId !== narration.voiceId ||
    !isRecentPastIsoTimestamp(approval.verification?.selectedAt) ||
    approval.approval?.method !==
      "explicit-cli-user-selected-voice-confirmation" ||
    approval.approval?.selectedAt !== approval.verification?.selectedAt ||
    attempt?.schemaVersion !== 1 ||
    attempt.provider !== "elevenlabs" ||
    attempt.status !== "artifacts_published" ||
    attempt.captureSourceSha !== providerSourceSha ||
    !isRecentPastIsoTimestamp(attempt.startedAt, {
      after: approval.verification?.selectedAt,
    }) ||
    !isRecentPastIsoTimestamp(attempt.completedAt, {
      after: attempt.startedAt,
    }) ||
    Date.parse(attempt.completedAt) < Date.parse(attempt.startedAt) ||
    !SHA256.test(attempt.sourceTextSha256 ?? "") ||
    attempt.outputFormat !== "mp3_44100_128" ||
    attempt.modelId !== manifest.narration.modelId ||
    attempt.voice?.voiceId !== narration.voiceId ||
    attempt.voice?.approvalDigest !== approvalDigest ||
    JSON.stringify(attempt.voice?.verification) !==
      JSON.stringify(approval.verification) ||
    attempt.artifacts?.audio?.bytes !== audioArtifact.bytes ||
    attempt.artifacts?.audio?.sha256 !== audioArtifact.sha256 ||
    attempt.artifacts?.timing?.bytes !== timingArtifact.bytes ||
    attempt.artifacts?.timing?.sha256 !== timingArtifact.sha256 ||
    JSON.stringify(attempt.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    JSON.stringify(attempt.releaseNarration) !==
      JSON.stringify(expectedNarration) ||
    attempt.releaseMediaReceipt?.path !== mediaReceiptResult.artifact.path ||
    attempt.releaseMediaReceipt?.sha256 !==
      mediaReceiptResult.artifact.sha256 ||
    timing?.voiceId !== narration.voiceId ||
    timing?.modelId !== manifest.narration.modelId ||
    timing.sourceText !== expectedNarrationText ||
    createHash("sha256").update(timing.sourceText).digest("hex") !==
      attempt.sourceTextSha256 ||
    !Array.isArray(alignment?.characters) ||
    !Array.isArray(alignment?.character_start_times_seconds) ||
    !Array.isArray(alignment?.character_end_times_seconds) ||
    alignment.characters.length !== expectedNarrationText.length ||
    alignment.character_start_times_seconds.length !==
      expectedNarrationText.length ||
    alignment.character_end_times_seconds.length !==
      expectedNarrationText.length ||
    alignment.characters.join("") !== expectedNarrationText ||
    !recordMatchesArtifact(
      manifest.inputs?.captions,
      mediaReceiptResult.mediaArtifacts["seeded-demo-rehearsal.srt"],
    ) ||
    !recordMatchesArtifact(
      manifest.inputs?.releaseMediaReceipt,
      mediaReceiptResult.artifact,
    ) ||
    !recordMatchesArtifact(
      manifest.inputs?.providerCaptureManifest,
      providerCaptureManifestArtifact,
    )
  ) {
    return false;
  }

  const [captureManifestArtifact, productTakeArtifact] = await Promise.all([
    validateManifestArtifactRecord(root, manifest.inputs?.captureManifest),
    validateManifestArtifactRecord(root, manifest.inputs?.productTake, {
      maxBytes: MAX_RELEASE_VIDEO_BYTES,
    }),
  ]);
  if (!captureManifestArtifact || !productTakeArtifact) return false;
  let captureManifest;
  try {
    captureManifest = JSON.parse(
      captureManifestArtifact.content.toString("utf8"),
    );
  } catch {
    return false;
  }
  const captureAssertions = captureManifest?.assertions;
  if (
    providerCaptureManifest?.schemaVersion !== 1 ||
    providerCaptureManifest.mode !== "seeded_fallback" ||
    !isRecentPastIsoTimestamp(providerCaptureManifest.generatedAt, {
      after: mediaReceiptResult.receipt.generatedAt,
    }) ||
    providerCaptureManifest.source?.fullSha !== providerSourceSha ||
    providerCaptureManifest.source?.dirty !== false ||
    JSON.stringify(providerCaptureManifest.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    captureManifest?.schemaVersion !== 1 ||
    captureManifest.mode !== "seeded_fallback" ||
    !isRecentPastIsoTimestamp(captureManifest.generatedAt) ||
    !isRecentPastIsoTimestamp(captureManifest.generatedAt, {
      after: mediaReceiptResult.receipt.generatedAt,
    }) ||
    captureManifest.source?.fullSha !== candidateSourceSha ||
    captureManifest.source?.dirty !== false ||
    JSON.stringify(captureManifest.releaseIdentity) !==
      JSON.stringify(expectedIdentity) ||
    !recordMatchesArtifact(
      captureManifest.outputs?.productTake,
      productTakeArtifact,
    ) ||
    JSON.stringify(manifest.captureAssertions) !==
      JSON.stringify(captureAssertions) ||
    captureAssertions?.openingDisclosuresVisible !== true ||
    captureAssertions?.seededLaunchVerified !== true ||
    captureAssertions?.evidenceDecisionRecorded !== true ||
    captureAssertions?.evidenceApplicationRecorded !== true ||
    captureAssertions?.artifactAnchorRecorded !== true ||
    captureAssertions?.creationReviewChecked !== true ||
    captureAssertions?.allReflectionFieldsShown !== true ||
    captureAssertions?.nextQuestionChoice?.checked !== true ||
    captureAssertions?.nextQuestionChoice?.mapSelectedCount !== 1 ||
    captureAssertions?.nextQuestionChoice?.mapUnselectedCount !== 2 ||
    captureAssertions?.mapNodeCount !== 9 ||
    captureAssertions?.mapNodeMinimumOpacity !== 1 ||
    captureAssertions?.mapNodesInViewport !== true ||
    captureAssertions?.exportVerified !== true ||
    captureAssertions?.seededBadgeVisible !== true
  ) {
    return false;
  }

  if (
    !isRecentPastIsoTimestamp(manifest.generatedAt, {
      after: captureManifest.generatedAt,
    }) ||
    !isRecentPastIsoTimestamp(approval.verification?.selectedAt, {
      after: providerCaptureManifest.generatedAt,
    }) ||
    !isRecentPastIsoTimestamp(manifest.generatedAt, {
      after: attempt.completedAt,
    })
  ) {
    return false;
  }

  const finalVideoArtifact = await validateManifestArtifactRecord(
    root,
    manifest.output,
    { maxBytes: MAX_RELEASE_VIDEO_BYTES },
  );
  const verifiedVideo = finalVideoArtifact
    ? verifyFinalVideoStreams(root, finalVideoArtifact)
    : null;
  const finalAssemblyValid =
    finalVideoArtifact &&
    looksLikeMp4(finalVideoArtifact.content) &&
    verifiedVideo &&
    Number.isFinite(manifest.output.durationSeconds) &&
    Math.abs(manifest.output.durationSeconds - DEMO_FINAL_SECONDS) <= 0.15 &&
    manifest.output.durationSeconds < 180 &&
    manifest.output.width === 1280 &&
    manifest.output.height === 720 &&
    manifest.output.videoCodec === "h264" &&
    manifest.output.audioCodec === "aac" &&
    manifest.output.subtitleCodec === "mov_text" &&
    manifest.output.durationSeconds === verifiedVideo.durationSeconds &&
    manifest.output.videoStreamDurationSeconds ===
      verifiedVideo.videoStreamDurationSeconds &&
    manifest.output.videoFrameCount === verifiedVideo.videoFrameCount &&
    manifest.output.width === verifiedVideo.width &&
    manifest.output.height === verifiedVideo.height &&
    manifest.output.videoCodec === verifiedVideo.videoCodec &&
    manifest.output.audioCodec === verifiedVideo.audioCodec &&
    manifest.output.subtitleCodec === verifiedVideo.subtitleCodec &&
    Number.isFinite(manifest.output.integratedLufs) &&
    manifest.output.integratedLufs >= -18 &&
    manifest.output.integratedLufs <= -14 &&
    Number.isFinite(manifest.output.truePeakDbfs) &&
    manifest.output.truePeakDbfs <= -1 &&
    Math.abs(manifest.output.integratedLufs - verifiedVideo.integratedLufs) <=
      0.2 &&
    Math.abs(manifest.output.truePeakDbfs - verifiedVideo.truePeakDbfs) <=
      0.2 &&
    manifest.captions?.burnedIn === true &&
    manifest.captions?.path ===
      mediaReceiptResult.mediaArtifacts["seeded-demo-rehearsal.srt"].path &&
    manifest.captions?.embeddedSubtitleCodec === "mov_text" &&
    embeddedSubtitleMatchesReceipt(
      root,
      finalVideoArtifact,
      cues,
      verifiedVideo.subtitleStreamIndex,
    ) &&
    manifest.captions?.cueCount === cues.length &&
    manifest.captions?.maximumLineLength === captionMetrics.maximumLineLength &&
    Math.abs(
      manifest.captions?.maximumWordsPerMinute -
        Number(captionMetrics.maximumWordsPerMinute.toFixed(2)),
    ) <= 0.01;
  return finalAssemblyValid ? { artifact: manifestArtifact, manifest } : false;
}

async function collectFinalReleaseChecks({ root, identity, narration, head }) {
  if (!identity || !narration) {
    return FINAL_RELEASE_CHECK_IDS.map((id) =>
      check(
        id,
        false,
        "The release identity config must pass before final-release evidence can be verified.",
      ),
    );
  }
  let evidence = null;
  let evidenceError = null;
  try {
    evidence = await readFinalReleaseEvidence(root);
  } catch (error) {
    evidenceError = error.message;
  }

  const shapeValid = evidence && hasReleaseEvidenceShape(evidence, identity);
  const missingEvidenceDetail = evidenceError
    ? `${evidenceError} Record this gate in that evidence file.`
    : `Record this gate in ${FINAL_RELEASE_EVIDENCE_PATH} with the current release identity.`;
  const field = (name) => (shapeValid ? evidence[name] : null);
  const publicName = field("publicName");
  const liveEvaluation = field("liveEvaluation");
  const application = field("application");
  const reviewerRepository = field("reviewerRepository");
  const media = field("media");
  const devpost = field("devpost");
  const feedback = field("feedback");
  const candidateSourceSha = application?.sourceSha;
  const candidateSourceIsCurrent = candidateHasOnlyFinalEvidenceDescendants({
    root,
    candidateSourceSha,
    head,
  });

  const mediaReceiptResult =
    media &&
    (await hasCurrentReleaseMediaReceipt(
      root,
      media.releaseMediaReceipt,
      identity,
    ));
  const screenshotToCandidateValid =
    mediaReceiptResult &&
    screenshotSourceBecomesCandidate({
      root,
      screenshotSourceSha:
        mediaReceiptResult.receipt.screenshotEvidence.sourceSha,
      candidateSourceSha,
      identity,
    });
  const finalAssemblyResult =
    mediaReceiptResult &&
    screenshotToCandidateValid &&
    (await hasCurrentFinalAssembly(
      root,
      media.finalAssembly,
      identity,
      narration,
      candidateSourceSha,
      mediaReceiptResult,
    ));
  const liveEvaluationValid =
    liveEvaluation &&
    (await hasCurrentLiveEvaluationReport(
      root,
      liveEvaluation.report,
      identity,
      candidateSourceSha,
      application?.url,
    ));
  const reviewerAccess = reviewerRepository?.reviewerAccess;
  const reviewerHistoryAuditValid =
    reviewerRepository &&
    (await hasCurrentReviewerHistoryAudit(
      root,
      reviewerRepository,
      identity,
      candidateSourceSha,
    ));
  let candidateTreeSha = null;
  let finalEvidenceHeadAt = null;
  try {
    candidateTreeSha = git(root, ["rev-parse", `${candidateSourceSha}^{tree}`]);
    finalEvidenceHeadAt = git(root, ["show", "-s", "--format=%cI", "HEAD"]);
  } catch {
    // The dependent release checks remain fail-closed below.
  }
  const reviewerRemoteBound =
    reviewerHistoryAuditValid &&
    candidateTreeSha &&
    hasLiveReviewerRemoteBinding(root, reviewerRepository);
  const isFreshReleaseEvent = (value, { after } = {}) =>
    isRecentPastIsoTimestamp(value, { after }) &&
    isIsoTimestamp(finalEvidenceHeadAt) &&
    Date.parse(value) <= Date.parse(finalEvidenceHeadAt);
  const mediaGeneratedAt = finalAssemblyResult?.manifest?.generatedAt;
  const assemblyRepair =
    finalAssemblyResult?.manifest?.narration?.artifactReuse;
  const assemblyRepairReview = media?.assemblyRepairReview;
  const assemblyRepairReviewValid = assemblyRepair
    ? isPlainObject(assemblyRepairReview) &&
      assemblyRepairReview.schemaVersion === 1 &&
      assemblyRepairReview.mode === assemblyRepair.mode &&
      assemblyRepairReview.fromSourceSha === assemblyRepair.fromSourceSha &&
      assemblyRepairReview.toSourceSha === assemblyRepair.toSourceSha &&
      assemblyRepairReview.transitionSha256 ===
        assemblyRepair.transitionSha256 &&
      isFreshReleaseEvent(assemblyRepairReview.reviewedAt, {
        after: mediaGeneratedAt,
      })
    : assemblyRepairReview === undefined;
  const deploymentVerified =
    isPublicHttpsUrl(application?.url) &&
    isFreshReleaseEvent(application?.signedOutVerifiedAt) &&
    isFreshReleaseEvent(application?.freeVerifiedAt) &&
    isFreshReleaseEvent(application?.unrestrictedVerifiedAt) &&
    isIsoTimestamp(application?.availableThrough) &&
    Date.parse(application.availableThrough) >=
      Date.parse(MINIMUM_APP_AVAILABILITY) &&
    candidateSourceIsCurrent;
  const finalVideoSha256 = finalAssemblyResult?.manifest?.output?.sha256;
  const mediaHumanApprovalsValid =
    isFreshReleaseEvent(media?.narrationApprovedAt, {
      after: mediaGeneratedAt,
    }) &&
    isFreshReleaseEvent(media?.captionsApprovedAt, {
      after: mediaGeneratedAt,
    }) &&
    SHA256.test(media?.narrationApprovedVideoSha256 ?? "") &&
    media.narrationApprovedVideoSha256 === finalVideoSha256 &&
    SHA256.test(media?.captionsApprovedVideoSha256 ?? "") &&
    media.captionsApprovedVideoSha256 === finalVideoSha256;
  const publicVideoValid =
    isPublicYoutubeUrl(media?.youtubeUrl) &&
    isFreshReleaseEvent(media?.publishedAt, { after: mediaGeneratedAt }) &&
    SHA256.test(media?.youtubeSourceSha256 ?? "") &&
    media.youtubeSourceSha256 === finalVideoSha256;

  return [
    check(
      "public-name-adoption-clearance",
      isFreshReleaseEvent(publicName?.adoptedAt) &&
        isFreshReleaseEvent(publicName?.clearanceReviewedAt, {
          after: publicName?.adoptedAt,
        }),
      isFreshReleaseEvent(publicName?.adoptedAt) &&
        isFreshReleaseEvent(publicName?.clearanceReviewedAt, {
          after: publicName?.adoptedAt,
        })
        ? "Current public-name adoption and clearance review are recorded."
        : missingEvidenceDetail,
    ),
    check(
      "live-evaluation-citation-review",
      isFreshReleaseEvent(liveEvaluation?.verifiedAt, {
        after: liveEvaluationValid?.wrapper?.citationReview?.reviewedAt,
      }) && liveEvaluationValid,
      isFreshReleaseEvent(liveEvaluation?.verifiedAt, {
        after: liveEvaluationValid?.wrapper?.citationReview?.reviewedAt,
      }) && liveEvaluationValid
        ? "A current identity-bound live evaluation and citation-review report is present."
        : "A current identity-bound live evaluation report under output/release is required.",
    ),
    check(
      "deployed-app-signed-out",
      deploymentVerified,
      deploymentVerified
        ? `A public HTTPS app was verified signed-out, free, and unrestricted; it remains available through at least ${MINIMUM_APP_AVAILABILITY}, and later commits contain only allowlisted release evidence.`
        : missingEvidenceDetail,
    ),
    check(
      "reviewer-repository-access",
      isCanonicalGithubRepositoryUrl(reviewerRepository?.url) &&
        FULL_GIT_SHA.test(reviewerRepository?.fullSha ?? "") &&
        isFreshReleaseEvent(reviewerRepository?.verifiedAt, {
          after: reviewerHistoryAuditValid?.audit?.auditedAt,
        }) &&
        Array.isArray(reviewerAccess) &&
        REQUIRED_REVIEWERS.every((reviewer) =>
          reviewerAccess.includes(reviewer),
        ) &&
        reviewerHistoryAuditValid &&
        reviewerRemoteBound,
      isCanonicalGithubRepositoryUrl(reviewerRepository?.url) &&
        FULL_GIT_SHA.test(reviewerRepository?.fullSha ?? "") &&
        isFreshReleaseEvent(reviewerRepository?.verifiedAt, {
          after: reviewerHistoryAuditValid?.audit?.auditedAt,
        }) &&
        Array.isArray(reviewerAccess) &&
        REQUIRED_REVIEWERS.every((reviewer) =>
          reviewerAccess.includes(reviewer),
        ) &&
        reviewerHistoryAuditValid &&
        reviewerRemoteBound
        ? "Canonical GitHub reviewer repository, current remote HEAD binding, structured reviewer-access capture, and identity-bound tree audit are verified."
        : missingEvidenceDetail,
    ),
    check(
      "release-media-receipt",
      Boolean(
        mediaReceiptResult &&
        screenshotToCandidateValid &&
        finalAssemblyResult &&
        assemblyRepairReviewValid &&
        mediaHumanApprovalsValid,
      ),
      mediaReceiptResult &&
        finalAssemblyResult &&
        assemblyRepairReviewValid &&
        mediaHumanApprovalsValid
        ? "The renderer receipt, capture-bound ElevenLabs artifacts, caption/audio contract, final video hash, and human approvals are current and identity-bound."
        : "A full current renderer receipt plus a hashed final assembly manifest/video, exact-voice provider artifacts, and human approvals are required.",
    ),
    check(
      "public-youtube-video",
      publicVideoValid,
      publicVideoValid
        ? "A public YouTube URL, publication timestamp, and exact final-video source hash are recorded."
        : missingEvidenceDetail,
    ),
    check(
      "human-narration-caption-approval",
      mediaHumanApprovalsValid,
      mediaHumanApprovalsValid
        ? "Human narration and caption approvals are recorded."
        : missingEvidenceDetail,
    ),
    check(
      "devpost-submission",
      isPublicHttpsUrl(devpost?.url, { host: "devpost.com" }) &&
        isFreshReleaseEvent(devpost?.submittedAt, { after: mediaGeneratedAt }),
      isPublicHttpsUrl(devpost?.url, { host: "devpost.com" }) &&
        isFreshReleaseEvent(devpost?.submittedAt, { after: mediaGeneratedAt })
        ? "A Devpost submission URL and submission timestamp are recorded."
        : missingEvidenceDetail,
    ),
    check(
      "feedback-session",
      typeof feedback?.sessionId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          feedback.sessionId,
        ) &&
        isFreshReleaseEvent(feedback?.completedAt, { after: mediaGeneratedAt }),
      typeof feedback?.sessionId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          feedback.sessionId,
        ) &&
        isFreshReleaseEvent(feedback?.completedAt, { after: mediaGeneratedAt })
        ? "The primary Codex feedback session ID and completion timestamp are recorded."
        : missingEvidenceDetail,
    ),
  ];
}

function hasCurrentIdentity(content, identity) {
  return (
    content.includes(identity.displayName) &&
    !hasRetiredIdentity(content, identity)
  );
}

function hasRetiredIdentity(content, identity) {
  return identity.retiredDisplayNames.some((name) =>
    content.toLocaleLowerCase().includes(name.toLocaleLowerCase()),
  );
}

function markdownVisibleLines(content) {
  const withoutComments = content.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) =>
    comment.replace(/[^\r\n]/g, " "),
  );
  const lines = withoutComments.split(/\r?\n/);
  let activeFence = null;

  return lines.map((line) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const length = fenceMatch[1].length;
      if (!activeFence) {
        activeFence = { marker, length };
        return "";
      }
      if (
        marker === activeFence.marker &&
        length >= activeFence.length &&
        fenceMatch[2].trim().length === 0
      ) {
        activeFence = null;
      }
      return "";
    }
    return activeFence ? "" : line;
  });
}

function markdownHeadings(content) {
  const lines = markdownVisibleLines(content);
  return lines.flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    return match
      ? [{ level: match[1].length, title: match[2], line: index }]
      : [];
  });
}

function markdownSection(content, heading) {
  const lines = markdownVisibleLines(content);
  const headings = markdownHeadings(content);
  const targets = headings.filter(
    (candidate) =>
      candidate.level === heading.level && candidate.title === heading.title,
  );
  if (targets.length !== 1) {
    return null;
  }
  const [target] = targets;

  const followingHeading = headings.find(
    (candidate) =>
      candidate.line > target.line && candidate.level <= target.level,
  );
  return lines
    .slice(target.line + 1, followingHeading?.line ?? lines.length)
    .join("\n")
    .trim();
}

function openingParagraph(content) {
  const lines = markdownVisibleLines(content);
  const firstHeading = markdownHeadings(content).find(
    (heading) => heading.level === 1,
  );
  if (!firstHeading) {
    return null;
  }

  const paragraph = [];
  for (const line of lines.slice(firstHeading.line + 1)) {
    if (/^#{1,6}\s/.test(line)) {
      break;
    }
    if (line.trim().length === 0) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }
    if (/^\s*(?:>|<!--|!\[)/.test(line)) {
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.length > 0 ? paragraph.join(" ") : null;
}

function hasExactFirstH1(content, expectedTitle) {
  const firstNonemptyLine = markdownVisibleLines(content)
    .find((line) => line.trim().length > 0)
    ?.trim();
  const h1Headings = markdownHeadings(content).filter(
    (heading) => heading.level === 1,
  );
  return (
    firstNonemptyLine === `# ${expectedTitle}` &&
    h1Headings.length === 1 &&
    h1Headings[0].title === expectedTitle
  );
}

export async function collectSubmissionPreflight({
  root = process.cwd(),
  releaseMode = false,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const checks = [];
  let head = null;
  let identity = null;
  let narration = null;

  try {
    const repositoryRoot = path.resolve(
      git(resolvedRoot, ["rev-parse", "--show-toplevel"]),
    );
    checks.push(
      check(
        "repository-root",
        repositoryRoot === resolvedRoot,
        repositoryRoot === resolvedRoot
          ? "Running from the Git repository root."
          : `Expected repository root ${repositoryRoot}.`,
      ),
    );
    head = git(resolvedRoot, ["rev-parse", "HEAD"]);
    checks.push(check("git-head", /^[0-9a-f]{40}$/.test(head), head));

    const status = git(resolvedRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=normal",
    ]);
    checks.push(
      check(
        "clean-worktree",
        status.length === 0,
        status.length === 0 ? "Worktree is clean." : "Worktree has changes.",
      ),
    );
    git(resolvedRoot, ["diff", "--check"]);
    checks.push(check("diff-check", true, "git diff --check passed."));
  } catch (error) {
    checks.push(check("git-state", false, error.message));
  }

  try {
    const [loadedIdentity, packageJson, packageLock] = await Promise.all([
      loadReleaseIdentity({ root: resolvedRoot }),
      readJson(resolvedRoot, "package.json"),
      readJson(resolvedRoot, "package-lock.json"),
    ]);
    identity = loadedIdentity;
    checks.push(
      check(
        "release-identity-config",
        true,
        `${identity.displayName} (${identity.slug}) loaded from ${identity.record.path}.`,
      ),
    );

    const packageAligned =
      packageJson.name === identity.slug &&
      packageLock.name === identity.slug &&
      packageLock.packages?.[""]?.name === identity.slug;
    checks.push(
      check(
        "package-identity-alignment",
        packageAligned,
        packageAligned
          ? "package.json and package-lock.json match the release slug."
          : "Package identity does not match config/release-identity.json.",
      ),
    );

    try {
      const preservedFileCount = await verifyPublicNamePreservationBaseline({
        root: resolvedRoot,
        identity,
      });
      checks.push(
        check(
          "public-name-preservation-baseline",
          true,
          `${preservedFileCount} immutable or historical tracked files match their recorded hashes; the current public OG remains receipt-governed.`,
        ),
      );
    } catch (error) {
      checks.push(
        check("public-name-preservation-baseline", false, error.message),
      );
    }

    const surfaceFiles = [
      {
        relativePath: "app/layout.tsx",
        requiredFragments: [
          `applicationName: \"${identity.displayName}\"`,
          `/${identity.slug}-og.png`,
        ],
        requiresDisplayName: true,
      },
      {
        relativePath: "components/discovery-card.tsx",
        requiredFragments: [
          `anchor.download = \"${identity.slug}-learning-trace.md\"`,
        ],
        requiresDisplayName: false,
      },
      {
        relativePath: "lib/export-markdown.ts",
        requiredFragments: [
          `# ${identity.displayName} Learning Trace`,
          `Created with ${identity.displayName}.`,
        ],
        requiresDisplayName: true,
      },
    ];
    for (const {
      relativePath,
      requiredFragments,
      requiresDisplayName,
    } of surfaceFiles) {
      const content = await readFile(
        path.join(resolvedRoot, relativePath),
        "utf8",
      );
      const aligned =
        (!requiresDisplayName || hasCurrentIdentity(content, identity)) &&
        requiredFragments.every((fragment) => content.includes(fragment));
      checks.push(
        check(
          `identity-surface:${relativePath}`,
          aligned,
          aligned
            ? "Current-facing identity surface matches the release identity."
            : "Current-facing identity surface is missing the canonical identity, contains a retired identity, or has an unexpected artifact name.",
        ),
      );
    }

    const judgeIdentityFiles = [
      {
        relativePath: "README.md",
        matches(content) {
          const paragraph = openingParagraph(content);
          return (
            hasExactFirstH1(content, identity.displayName) &&
            paragraph?.includes(identity.displayName) &&
            !hasRetiredIdentity(paragraph, identity)
          );
        },
        detail:
          "README must use the canonical first H1 and name the current release in its opening prose paragraph.",
      },
      {
        relativePath: "docs/devpost-draft.md",
        matches(content) {
          const projectName = markdownSection(content, {
            level: 2,
            title: "Project name",
          });
          const shortDescription = markdownSection(content, {
            level: 2,
            title: "Short description",
          });
          return (
            projectName === identity.displayName &&
            shortDescription?.includes(identity.displayName) &&
            !hasRetiredIdentity(shortDescription, identity)
          );
        },
        detail:
          "Devpost project name and short description must use the canonical release identity.",
      },
      {
        relativePath: "docs/demo-script.md",
        matches(content) {
          const timedScript = markdownSection(content, {
            level: 2,
            title: "Timed script and shot list",
          });
          return (
            timedScript?.includes(identity.displayName) &&
            !hasRetiredIdentity(timedScript, identity)
          );
        },
        detail:
          "The active timed script and shot list must use the canonical release identity.",
      },
    ];
    for (const { relativePath, matches, detail } of judgeIdentityFiles) {
      const content = await readFile(
        path.join(resolvedRoot, relativePath),
        "utf8",
      );
      const aligned = matches(content);
      checks.push(
        check(
          `judge-identity:${relativePath}`,
          aligned,
          aligned
            ? "Judge-facing identity copy matches the release identity."
            : detail,
        ),
      );
    }
  } catch (error) {
    checks.push(check("release-identity", false, error.message));
  }

  try {
    narration = await loadReleaseNarration({ root: resolvedRoot });
    checks.push(
      check(
        "release-narration-config",
        true,
        `${narration.provider}/${narration.voiceId}/${narration.verificationMode} loaded from ${narration.record.path}.`,
      ),
    );
  } catch (error) {
    checks.push(check("release-narration-config", false, error.message));
  }

  const releaseChecks = releaseMode
    ? await collectFinalReleaseChecks({
        root: resolvedRoot,
        identity,
        narration,
        head,
      })
    : [];
  const manualExternalGates = MANUAL_EXTERNAL_GATES.map((gate, index) => {
    if (!releaseMode) return { gate, status: "PENDING" };
    const requiredCheckIds = RELEASE_MANUAL_GATE_CHECK_IDS[index];
    const verified = requiredCheckIds.every(
      (id) => releaseChecks.find((entry) => entry.id === id)?.status === "PASS",
    );
    return {
      gate,
      status: verified ? "VERIFIED" : "FAIL",
      requiredCheckIds,
    };
  });

  const summary = {
    pass: checks.filter((entry) => entry.status === "PASS").length,
    fail: checks.filter((entry) => entry.status === "FAIL").length,
    pending: manualExternalGates.filter((entry) => entry.status === "PENDING")
      .length,
  };
  const releaseSummary = releaseMode
    ? {
        pass: releaseChecks.filter((entry) => entry.status === "PASS").length,
        fail: releaseChecks.filter((entry) => entry.status === "FAIL").length,
      }
    : null;

  return {
    schemaVersion: 1,
    kind: "wonderlab-submission-preflight",
    source: { head },
    checks,
    summary,
    ...(releaseMode
      ? {
          mode: "release",
          releaseEvidencePath: FINAL_RELEASE_EVIDENCE_PATH,
          releaseChecks,
          releaseSummary,
        }
      : {}),
    nextSafeAction:
      summary.fail > 0
        ? "Resolve deterministic FAIL checks before running the listed deterministic commands."
        : releaseSummary?.fail > 0
          ? "Resolve final-release FAIL checks and record the required evidence before submission."
          : releaseMode
            ? "All strict final-release evidence gates are verified; run the listed deterministic commands on this exact HEAD before submission."
            : "Run the listed deterministic commands in order; external/manual gates remain pending.",
    requiredDeterministicCommands: REQUIRED_DETERMINISTIC_COMMANDS,
    manualExternalGates,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const releaseMode = process.argv.slice(2).includes("--release");
  const report = await collectSubmissionPreflight({ releaseMode });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (
    report.checks.some((entry) => entry.status === "FAIL") ||
    report.releaseChecks?.some((entry) => entry.status === "FAIL") ||
    report.manualExternalGates.some((entry) => entry.status === "FAIL")
  ) {
    process.exitCode = 1;
  }
}
