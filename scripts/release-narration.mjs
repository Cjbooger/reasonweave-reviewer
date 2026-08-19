import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const RELEASE_NARRATION_CONFIG_PATH = "config/release-narration.json";

const MAX_RELEASE_NARRATION_BYTES = 16 * 1024;
const SAFE_VOICE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function portableRelativePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

export function assertCanonicalReleaseNarration(value) {
  invariant(
    value && typeof value === "object" && !Array.isArray(value),
    "Release narration config must be a JSON object.",
  );
  invariant(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([
        "provider",
        "schemaVersion",
        "verificationMode",
        "voiceId",
      ]),
    "Release narration config must contain exactly schemaVersion, provider, voiceId, and verificationMode.",
  );
  invariant(
    value.schemaVersion === 1 &&
      value.provider === "elevenlabs" &&
      typeof value.voiceId === "string" &&
      SAFE_VOICE_ID.test(value.voiceId) &&
      value.verificationMode === "user_selected_tts_only",
    "Release narration config must select a valid user-selected ElevenLabs voice.",
  );
  return {
    schemaVersion: 1,
    provider: "elevenlabs",
    voiceId: value.voiceId,
    verificationMode: "user_selected_tts_only",
  };
}

export function assertReleaseNarrationRecord(record, narration) {
  const canonical = assertCanonicalReleaseNarration({
    schemaVersion: narration?.schemaVersion,
    provider: narration?.provider,
    voiceId: narration?.voiceId,
    verificationMode: narration?.verificationMode,
  });
  invariant(
    record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      JSON.stringify(Object.keys(record).sort()) ===
        JSON.stringify([
          "path",
          "provider",
          "sha256",
          "verificationMode",
          "voiceId",
        ]) &&
      record.path === RELEASE_NARRATION_CONFIG_PATH &&
      typeof record.sha256 === "string" &&
      SHA256.test(record.sha256) &&
      record.provider === canonical.provider &&
      record.voiceId === canonical.voiceId &&
      record.verificationMode === canonical.verificationMode &&
      (!narration?.record || record.sha256 === narration.record.sha256),
    "Release narration record does not match the canonical narration config.",
  );
  return record;
}

export function releaseNarrationRecord(narration) {
  const canonical = assertCanonicalReleaseNarration({
    schemaVersion: narration?.schemaVersion,
    provider: narration?.provider,
    voiceId: narration?.voiceId,
    verificationMode: narration?.verificationMode,
  });
  assertReleaseNarrationRecord(narration?.record, narration);
  return {
    path: narration.record.path,
    sha256: narration.record.sha256,
    provider: canonical.provider,
    voiceId: canonical.voiceId,
    verificationMode: canonical.verificationMode,
  };
}

export function assertReleaseNarrationAttemptBinding(attempt, narration) {
  const expected = releaseNarrationRecord(narration);
  invariant(
    attempt &&
      typeof attempt === "object" &&
      !Array.isArray(attempt) &&
      attempt.releaseNarration &&
      JSON.stringify(attempt.releaseNarration) === JSON.stringify(expected),
    "ElevenLabs narration attempt receipt does not match the canonical release narration config.",
  );
  return attempt;
}

export async function loadReleaseNarration({ root }) {
  const resolvedRoot = path.resolve(root);
  const configDirectory = path.join(resolvedRoot, "config");
  const configPath = path.join(
    resolvedRoot,
    ...RELEASE_NARRATION_CONFIG_PATH.split("/"),
  );
  const [directoryMetadata, metadata] = await Promise.all([
    fs.lstat(configDirectory),
    fs.lstat(configPath),
  ]).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new Error(
        "Release narration config must exist as config/release-narration.json.",
      );
    }
    throw error;
  });
  invariant(
    !directoryMetadata.isSymbolicLink() &&
      directoryMetadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      metadata.isFile() &&
      metadata.size > 0 &&
      metadata.size <= MAX_RELEASE_NARRATION_BYTES,
    "Release narration config must be a bounded regular file in config.",
  );
  const [directoryReal, configReal, content] = await Promise.all([
    fs.realpath(configDirectory),
    fs.realpath(configPath),
    fs.readFile(configPath),
  ]);
  invariant(
    path.dirname(configReal) === directoryReal,
    "Release narration config must remain directly inside config.",
  );
  let value;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch {
    throw new Error("Release narration config must contain valid JSON.");
  }
  const canonical = assertCanonicalReleaseNarration(value);
  const record = {
    path: portableRelativePath(resolvedRoot, configPath),
    sha256: createHash("sha256").update(content).digest("hex"),
    provider: canonical.provider,
    voiceId: canonical.voiceId,
    verificationMode: canonical.verificationMode,
  };
  assertReleaseNarrationRecord(record, { ...canonical, record });
  return { ...canonical, record };
}
