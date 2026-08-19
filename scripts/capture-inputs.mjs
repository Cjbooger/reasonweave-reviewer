import path from "node:path";

export function validatedExternalBaseUrl(rawValue) {
  const value = rawValue?.trim();
  if (!value) return undefined;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "WONDERLAB_CAPTURE_BASE_URL must be a valid HTTP(S) URL without credentials, query parameters, or a fragment.",
    );
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "WONDERLAB_CAPTURE_BASE_URL must be a valid HTTP(S) URL without credentials, query parameters, or a fragment.",
    );
  }

  return parsed.href.endsWith("/") ? parsed.href.slice(0, -1) : parsed.href;
}

export function discoveryCardProofPath(
  stagingDir,
  suggestedFilename,
  expectedFilename,
) {
  if (
    typeof expectedFilename !== "string" ||
    expectedFilename.length === 0 ||
    expectedFilename !== expectedFilename.trim() ||
    path.posix.basename(expectedFilename) !== expectedFilename ||
    path.win32.basename(expectedFilename) !== expectedFilename ||
    suggestedFilename !== expectedFilename ||
    path.posix.basename(suggestedFilename) !== suggestedFilename ||
    path.win32.basename(suggestedFilename) !== suggestedFilename
  ) {
    throw new Error(
      `Discovery Card export must use the canonical release filename ${expectedFilename}.`,
    );
  }

  const resolvedStagingDir = path.resolve(stagingDir);
  const proofPath = path.resolve(resolvedStagingDir, suggestedFilename);
  const relative = path.relative(resolvedStagingDir, proofPath);
  if (
    relative !== suggestedFilename ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Discovery Card export resolved outside capture staging.");
  }

  return proofPath;
}
