import fs from "node:fs/promises";
import path from "node:path";

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

export async function resolveElevenLabsArtifactSource({
  root,
  allowedOutputRoot,
  outputDir,
  configuredSource,
}) {
  const resolvedRoot = path.resolve(root);
  const resolvedAllowedRoot = path.resolve(allowedOutputRoot);
  const configuredParts = configuredSource?.split("/");

  if (configuredSource !== undefined) {
    invariant(
      typeof configuredSource === "string" &&
        configuredSource.length > 0 &&
        !path.isAbsolute(configuredSource) &&
        !configuredSource.includes("\\"),
      "WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE must be a relative child of output/playwright.",
    );
    invariant(
      configuredParts.length > 0 &&
        configuredParts.every(
          (part) => part.length > 0 && part !== "." && part !== "..",
        ),
      "WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE must name a relative child directory without traversal.",
    );
  }

  const sourceDir = configuredSource
    ? path.resolve(resolvedAllowedRoot, ...configuredParts)
    : path.resolve(outputDir);
  invariant(
    isInside(resolvedAllowedRoot, sourceDir),
    "WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE must stay inside output/playwright.",
  );

  const allowedMetadata = await fs.lstat(resolvedAllowedRoot);
  invariant(
    !allowedMetadata.isSymbolicLink() && allowedMetadata.isDirectory(),
    "output/playwright must be a real directory.",
  );

  const relativeSource = path.relative(resolvedAllowedRoot, sourceDir);
  const sourceParts = relativeSource.split(path.sep);
  let checkedPath = resolvedAllowedRoot;
  for (const part of sourceParts) {
    checkedPath = path.join(checkedPath, part);
    const metadata = await fs.lstat(checkedPath);
    invariant(
      !metadata.isSymbolicLink() && metadata.isDirectory(),
      "WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE must resolve through real directories only.",
    );
  }

  const allowedReal = await fs.realpath(resolvedAllowedRoot);
  const sourceReal = await fs.realpath(sourceDir);
  invariant(
    isInside(allowedReal, sourceReal),
    "Resolved ElevenLabs artifact source escapes output/playwright.",
  );

  return {
    outputReal: sourceReal,
    relativeOutputPath: portableRelativePath(resolvedRoot, sourceDir),
  };
}
