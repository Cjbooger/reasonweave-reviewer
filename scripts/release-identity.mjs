import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const RELEASE_IDENTITY_CONFIG_PATH = "config/release-identity.json";

const MAX_RELEASE_IDENTITY_BYTES = 16 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_DISPLAY_NAME = /^[\p{L}\p{N}](?:[\p{L}\p{N} &'’-]*[\p{L}\p{N}])?$/u;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function portableRelativePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

export function canonicalReleaseSlug(displayName) {
  invariant(
    typeof displayName === "string" &&
      displayName.length > 0 &&
      displayName === displayName.trim() &&
      displayName.length <= 80 &&
      SAFE_DISPLAY_NAME.test(displayName),
    "Release identity displayName must be a trimmed human-readable name.",
  );
  return displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertCanonicalReleaseIdentity(value) {
  invariant(
    value && typeof value === "object" && !Array.isArray(value),
    "Release identity config must be a JSON object.",
  );
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "displayName",
    "retiredDisplayNames",
    "schemaVersion",
    "slug",
  ];
  invariant(
    JSON.stringify(keys) === JSON.stringify(expectedKeys),
    "Release identity config must contain exactly schemaVersion, displayName, slug, and retiredDisplayNames.",
  );
  invariant(
    value.schemaVersion === 1,
    "Release identity config schemaVersion must be 1.",
  );
  const canonicalSlug = canonicalReleaseSlug(value.displayName);
  invariant(
    SAFE_SLUG.test(value.slug) && value.slug.length <= 80,
    "Release identity slug must be a lowercase canonical slug.",
  );
  invariant(
    value.slug === canonicalSlug,
    "Release identity slug must match the canonical displayName slug.",
  );
  invariant(
    Array.isArray(value.retiredDisplayNames),
    "Release identity retiredDisplayNames must be an array.",
  );
  const retiredDisplayNames = value.retiredDisplayNames.map((name) => {
    canonicalReleaseSlug(name);
    return name;
  });
  invariant(
    new Set(retiredDisplayNames.map((name) => name.toLocaleLowerCase()))
      .size === retiredDisplayNames.length,
    "Release identity retiredDisplayNames must not contain duplicates.",
  );
  invariant(
    !retiredDisplayNames.some(
      (name) =>
        name.toLocaleLowerCase() === value.displayName.toLocaleLowerCase(),
    ),
    "Release identity retiredDisplayNames must not include the current displayName.",
  );
  return {
    schemaVersion: 1,
    displayName: value.displayName,
    slug: value.slug,
    retiredDisplayNames,
  };
}

export function releaseIdentityText(identity) {
  const canonical = assertCanonicalReleaseIdentity({
    schemaVersion: identity?.schemaVersion,
    displayName: identity?.displayName,
    slug: identity?.slug,
    retiredDisplayNames: identity?.retiredDisplayNames,
  });
  return `${canonical.displayName} (${canonical.slug})`;
}

export function assertReleaseIdentityRecord(record, identity) {
  const canonical = assertCanonicalReleaseIdentity({
    schemaVersion: identity?.schemaVersion,
    displayName: identity?.displayName,
    slug: identity?.slug,
    retiredDisplayNames: identity?.retiredDisplayNames,
  });
  const expectedRecord = identity?.record;
  invariant(
    record && typeof record === "object" && !Array.isArray(record),
    "Release identity record must be an object.",
  );
  invariant(
    JSON.stringify(Object.keys(record).sort()) ===
      JSON.stringify(["displayName", "path", "sha256", "slug"]),
    "Release identity record must contain exactly path, sha256, displayName, and slug.",
  );
  invariant(
    record.path === RELEASE_IDENTITY_CONFIG_PATH &&
      typeof record.sha256 === "string" &&
      SHA256.test(record.sha256) &&
      record.displayName === canonical.displayName &&
      record.slug === canonical.slug &&
      (!expectedRecord || record.sha256 === expectedRecord.sha256),
    "Release identity record does not match the canonical identity.",
  );
  return record;
}

export function releaseIdentityRecord(identity) {
  const canonical = assertCanonicalReleaseIdentity({
    schemaVersion: identity?.schemaVersion,
    displayName: identity?.displayName,
    slug: identity?.slug,
    retiredDisplayNames: identity?.retiredDisplayNames,
  });
  assertReleaseIdentityRecord(identity?.record, identity);
  return {
    path: identity.record.path,
    sha256: identity.record.sha256,
    displayName: canonical.displayName,
    slug: canonical.slug,
  };
}

export function assertReleaseIdentityText({ content, label, identity }) {
  const canonical = assertCanonicalReleaseIdentity({
    schemaVersion: identity?.schemaVersion,
    displayName: identity?.displayName,
    slug: identity?.slug,
    retiredDisplayNames: identity?.retiredDisplayNames,
  });
  invariant(
    typeof content === "string" &&
      typeof label === "string" &&
      label.length > 0,
    "Release identity text assertions require labeled text content.",
  );
  invariant(
    content.includes(canonical.displayName),
    `${label} must include the canonical release displayName.`,
  );
  invariant(
    !canonical.retiredDisplayNames.some((retiredName) =>
      content.toLocaleLowerCase().includes(retiredName.toLocaleLowerCase()),
    ),
    `${label} must not include a retired release displayName.`,
  );
  return content;
}

export async function loadReleaseIdentity({ root }) {
  const resolvedRoot = path.resolve(root);
  const configDirectory = path.join(resolvedRoot, "config");
  const configPath = path.join(
    resolvedRoot,
    ...RELEASE_IDENTITY_CONFIG_PATH.split("/"),
  );
  let directoryMetadata;
  let metadata;
  try {
    [directoryMetadata, metadata] = await Promise.all([
      fs.lstat(configDirectory),
      fs.lstat(configPath),
    ]);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        "Release identity config must exist as config/release-identity.json.",
      );
    }
    throw error;
  }
  invariant(
    !directoryMetadata.isSymbolicLink() && directoryMetadata.isDirectory(),
    "Release identity config directory must be a real directory.",
  );
  invariant(
    !metadata.isSymbolicLink() && metadata.isFile() && metadata.size > 0,
    "Release identity config must be a non-empty regular file.",
  );
  invariant(
    metadata.size <= MAX_RELEASE_IDENTITY_BYTES,
    "Release identity config exceeds the size limit.",
  );
  const [directoryReal, configReal, content] = await Promise.all([
    fs.realpath(configDirectory),
    fs.realpath(configPath),
    fs.readFile(configPath),
  ]);
  invariant(
    path.dirname(configReal) === directoryReal,
    "Release identity config must remain directly inside config.",
  );
  let value;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch {
    throw new Error("Release identity config must contain valid JSON.");
  }
  const canonical = assertCanonicalReleaseIdentity(value);
  const record = {
    path: portableRelativePath(resolvedRoot, configPath),
    sha256: createHash("sha256").update(content).digest("hex"),
    displayName: canonical.displayName,
    slug: canonical.slug,
  };
  assertReleaseIdentityRecord(record, { ...canonical, record });
  return { ...canonical, record };
}
