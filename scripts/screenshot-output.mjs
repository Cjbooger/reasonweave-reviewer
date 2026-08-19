import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  loadReleaseIdentity,
  releaseIdentityRecord,
} from "./release-identity.mjs";

import {
  createAnchoredChildDirectory,
  createDirectoryAnchor,
  readAnchoredFiles,
  reserveExclusiveAnchoredFile,
  withAnchoredDirectory,
  writeExclusiveAnchoredFile,
  writeReservedAnchoredFile,
} from "./anchored-directory-ops.mjs";

export const SCREENSHOT_FILENAMES = Object.freeze([
  "spark-desktop.jpg",
  "routes-desktop.jpg",
  "prediction-desktop.jpg",
  "evidence-create-desktop.jpg",
  "discovery-desktop.jpg",
  "discovery-card-desktop.jpg",
  "discovery-mobile.jpg",
  "discovery-mobile-trace.jpg",
]);

export const SCREENSHOT_OWNER_FILE = ".wonderlab-screenshot-output.json";
export const SCREENSHOT_RECEIPT_FILE = "screenshot-receipt.json";

export const SCREENSHOT_OWNER = "wonderlab-screenshot-output-v1";
const SAFE_RELEASE_DIRECTORY = /^[a-z0-9][a-z0-9-]{1,79}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

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

function configuredParts(configuredOutput) {
  invariant(
    typeof configuredOutput === "string" &&
      configuredOutput.length > 0 &&
      configuredOutput === configuredOutput.trim() &&
      !configuredOutput.includes("\\") &&
      !path.posix.isAbsolute(configuredOutput),
    "WONDERLAB_SCREENSHOT_OUTPUT must be a relative direct child of docs/screenshots.",
  );

  const parts = configuredOutput.split("/");
  invariant(
    parts.length === 3 &&
      parts[0] === "docs" &&
      parts[1] === "screenshots" &&
      SAFE_RELEASE_DIRECTORY.test(parts[2]),
    "WONDERLAB_SCREENSHOT_OUTPUT must name a new lowercase release directory directly under docs/screenshots.",
  );
  return parts;
}

async function assertDirectoryIdentity(binding) {
  await withAnchoredDirectory(binding.directoryAnchor, async () => {});
  const metadata = await fs.lstat(binding.outputDir);
  invariant(
    !metadata.isSymbolicLink() &&
      metadata.isDirectory() &&
      metadata.dev === binding.identity.dev &&
      metadata.ino === binding.identity.ino,
    "The screenshot output directory changed during capture.",
  );
  invariant(
    (await fs.realpath(binding.outputDir)) === binding.outputReal,
    "The screenshot output directory no longer resolves to its original location.",
  );
}

function validateSource(sourceSha, sourceStatus) {
  invariant(
    typeof sourceSha === "string" && FULL_SHA.test(sourceSha),
    "Screenshot capture requires the exact 40-character source SHA.",
  );
  invariant(
    typeof sourceStatus === "string" && sourceStatus.trim() === "",
    "Screenshot capture requires a clean Git worktree before creating output.",
  );
}

export async function prepareScreenshotOutput({
  root,
  configuredOutput,
  sourceSha,
  sourceStatus,
}) {
  const resolvedRoot = path.resolve(root);
  const releaseIdentity = await loadReleaseIdentity({ root: resolvedRoot });
  const parts = configuredParts(configuredOutput);
  invariant(
    parts[2].startsWith(`${releaseIdentity.slug}-`),
    "WONDERLAB_SCREENSHOT_OUTPUT must begin with the canonical release slug followed by a hyphen.",
  );
  validateSource(sourceSha, sourceStatus);

  const screenshotsRoot = path.join(resolvedRoot, "docs", "screenshots");
  const screenshotsAnchor = await createDirectoryAnchor(
    screenshotsRoot,
    "docs/screenshots must be a real directory.",
  );
  const outputDir = path.join(resolvedRoot, ...parts);
  invariant(
    isInside(screenshotsRoot, outputDir),
    "WONDERLAB_SCREENSHOT_OUTPUT must stay inside docs/screenshots.",
  );

  let outputAnchor;
  try {
    outputAnchor = await createAnchoredChildDirectory({
      parentAnchor: screenshotsAnchor,
      directoryName: parts[2],
      message:
        "WONDERLAB_SCREENSHOT_OUTPUT must resolve to a real child of docs/screenshots.",
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "WONDERLAB_SCREENSHOT_OUTPUT must not already exist; choose a fresh release directory.",
      );
    }
    throw error;
  }

  const outputReal = outputAnchor.realPath;
  invariant(
    isInside(screenshotsAnchor.realPath, outputReal),
    "WONDERLAB_SCREENSHOT_OUTPUT must resolve to a real child of docs/screenshots.",
  );
  outputAnchor.message =
    "The screenshot output directory changed during capture.";

  const relativeOutputPath = portableRelativePath(resolvedRoot, outputDir);
  const binding = {
    root: resolvedRoot,
    outputDir,
    outputReal,
    directoryAnchor: outputAnchor,
    relativeOutputPath,
    identity: { dev: outputAnchor.dev, ino: outputAnchor.ino },
    sourceSha,
    releaseIdentity,
    fileIdentities: {},
    writeRecords: {},
    written: new Set(),
    paths: Object.fromEntries(
      SCREENSHOT_FILENAMES.map((filename) => [
        filename,
        path.join(outputReal, filename),
      ]),
    ),
  };

  const ownerContent = `${JSON.stringify(
    {
      schemaVersion: 1,
      owner: SCREENSHOT_OWNER,
      sourceSha,
      outputDir: relativeOutputPath,
      releaseIdentity: releaseIdentityRecord(releaseIdentity),
    },
    null,
    2,
  )}\n`;
  await writeExclusiveAnchoredFile({
    anchor: outputAnchor,
    filename: SCREENSHOT_OWNER_FILE,
    content: Buffer.from(ownerContent),
  });
  for (const filename of SCREENSHOT_FILENAMES) {
    binding.fileIdentities[filename] = await reserveExclusiveAnchoredFile({
      anchor: outputAnchor,
      filename,
    });
  }
  await assertDirectoryIdentity(binding);
  return binding;
}

export async function writeScreenshotOutput({ binding, filename, content }) {
  invariant(
    SCREENSHOT_FILENAMES.includes(filename) && binding?.paths?.[filename],
    "Screenshot writes require one of the fixed release filenames.",
  );
  invariant(
    Buffer.isBuffer(content) && content.length > 0,
    "Screenshot writes require a non-empty image buffer.",
  );
  invariant(
    !binding.written.has(filename),
    `Screenshot ${filename} was already written.`,
  );
  const expectedIdentity = binding.fileIdentities[filename];
  await writeReservedAnchoredFile({
    anchor: binding.directoryAnchor,
    filename,
    expectedIdentity,
    content,
  });
  await assertDirectoryIdentity(binding);
  binding.writeRecords[filename] = {
    ...expectedIdentity,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
  binding.written.add(filename);
}

function assertOnlyConfiguredOutputChanged(status, relativeOutputPath) {
  invariant(
    typeof status === "string",
    "Screenshot capture requires a Git status snapshot after capture.",
  );
  const prefix = `?? ${relativeOutputPath}/`;
  const lines = status
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  invariant(
    lines.length > 0 && lines.every((line) => line.startsWith(prefix)),
    "The Git worktree changed outside the configured screenshot output during capture.",
  );
}

function fileRecord(filename, anchoredRecord, binding) {
  const expectedRecord = binding.writeRecords[filename];
  const content = anchoredRecord.content;
  const sha256 = createHash("sha256").update(content).digest("hex");
  invariant(
    anchoredRecord.dev === expectedRecord.dev &&
      anchoredRecord.ino === expectedRecord.ino &&
      anchoredRecord.bytes === expectedRecord.bytes &&
      sha256 === expectedRecord.sha256,
    "A screenshot changed after its reserved capture write.",
  );
  return {
    path: `${binding.relativeOutputPath}/${filename}`,
    bytes: anchoredRecord.bytes,
    sha256,
  };
}

export async function finalizeScreenshotOutput({
  binding,
  endingSourceSha,
  endingSourceStatus,
}) {
  invariant(
    binding?.sourceSha === endingSourceSha && FULL_SHA.test(endingSourceSha),
    "The source SHA changed during screenshot capture.",
  );
  assertOnlyConfiguredOutputChanged(
    endingSourceStatus,
    binding.relativeOutputPath,
  );
  invariant(
    JSON.stringify(
      releaseIdentityRecord(await loadReleaseIdentity({ root: binding.root })),
    ) === JSON.stringify(releaseIdentityRecord(binding.releaseIdentity)),
    "The release identity changed during screenshot capture.",
  );
  await assertDirectoryIdentity(binding);
  invariant(
    SCREENSHOT_FILENAMES.every((filename) => binding.written.has(filename)),
    "Every screenshot must be published through the reserved write boundary before finalization.",
  );

  const entries = (
    await withAnchoredDirectory(binding.directoryAnchor, () => fs.readdir("."))
  ).sort();
  const expectedBeforeReceipt = [
    SCREENSHOT_OWNER_FILE,
    ...SCREENSHOT_FILENAMES,
  ].sort();
  invariant(
    JSON.stringify(entries) === JSON.stringify(expectedBeforeReceipt),
    "The screenshot output must contain exactly the ownership marker and eight required JPGs before receipt publication.",
  );

  const anchoredFiles = await readAnchoredFiles({
    anchor: binding.directoryAnchor,
    filenames: SCREENSHOT_FILENAMES,
  });
  const screenshots = [];
  for (const filename of SCREENSHOT_FILENAMES) {
    const filePath = binding.paths[filename];
    invariant(
      path.dirname(filePath) === binding.outputReal,
      "A screenshot path escaped the configured output directory.",
    );
    screenshots.push(fileRecord(filename, anchoredFiles[filename], binding));
  }

  const receipt = {
    schemaVersion: 1,
    kind: "wonderlab-screenshot-receipt",
    generatedAt: new Date().toISOString(),
    source: { fullSha: endingSourceSha, cleanBeforeCapture: true },
    outputDir: binding.relativeOutputPath,
    releaseIdentity: releaseIdentityRecord(binding.releaseIdentity),
    screenshots,
  };
  const receiptContent = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeExclusiveAnchoredFile({
    anchor: binding.directoryAnchor,
    filename: SCREENSHOT_RECEIPT_FILE,
    content: Buffer.from(receiptContent),
  });
  await assertDirectoryIdentity(binding);
  return receipt;
}
