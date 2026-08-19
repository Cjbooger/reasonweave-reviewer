import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const ELEVENLABS_VOICE_CATALOG_URL =
  "https://api.elevenlabs.io/v2/voices";
export const DEMO_OUTPUT_OWNER = "wonderlab-seeded-demo-v1";
export const APPROVED_VOICE_FILENAME = "approved-voice.json";
export const PREVIEW_VOICE_FILENAME = "preview-voice.json";
export const PREVIEW_AUDIO_FILENAME = "premade-preview.mp3";
export const VOICE_MODE_TRANSITION_LOCK_FILENAME =
  ".voice-mode-transition.lock";
export const PINNED_OFFICIAL_DEFAULT_VOICE = Object.freeze({
  voiceId: "JBFqnCBsd6RMkjVDRZzb",
  name: "George",
  voiceType: "default",
  category: "premade",
  previewUrl:
    "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3",
});
export const PINNED_OFFICIAL_DOCS_SOURCE = "elevenlabs-official-docs";
export const PINNED_OFFICIAL_TTS_ONLY_MODE = "pinned_official_tts_only";
export const CATALOG_VERIFIED_MODE = "catalog_verified";
export const USER_SELECTED_TTS_ONLY_MODE = "user_selected_tts_only";

const MAX_CATALOG_PAGES = 10;
const MAX_CATALOG_VOICES = 1_000;
const MAX_JSON_FILE_BYTES = 64 * 1024;
const MAX_PREVIEW_AUDIO_BYTES = 16 * 1024 * 1024;
const SAFE_VOICE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const SAFE_SHA = /^[a-f0-9]{40}$/;
const ALLOWED_LABELS = ["accent", "age", "gender", "language", "use_case"];
const ALLOWED_PROVIDER_FAILURES = new Set([
  "bad_request",
  "forbidden",
  "insufficient_credits",
  "invalid_api_key",
  "invalid_request",
  "missing_permissions",
  "model_not_found",
  "quota_exceeded",
  "rate_limit_exceeded",
  "server_error",
  "system_busy",
  "too_many_concurrent_requests",
  "unauthorized",
  "voice_not_found",
]);

class VoiceCatalogError extends Error {
  constructor(status, classification) {
    super(
      `ElevenLabs voice catalog failed (HTTP ${Number(status) || "unknown"}; ${classification}).`,
    );
    this.status = status;
    this.classification = classification;
  }
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => allowedKeys.includes(key))
  );
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function normalizedText(value, maxLength) {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\p{Cf}/gu, " ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function sanitizedPreviewUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hostname !== "storage.googleapis.com" ||
      !url.pathname.startsWith("/eleven-public-prod/premade/voices/") ||
      url.search
    ) {
      return undefined;
    }
    url.hash = "";
    return url.href.length <= 2_048 ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function pinnedOfficialDefaultVoice(voiceId) {
  return voiceId === PINNED_OFFICIAL_DEFAULT_VOICE.voiceId
    ? {
        ...PINNED_OFFICIAL_DEFAULT_VOICE,
        verificationMode: PINNED_OFFICIAL_TTS_ONLY_MODE,
        catalogDenial: {
          endpoint: "/v2/voices",
          status: 401,
          code: "missing_permissions",
        },
      }
    : undefined;
}

function isPinnedOfficialDefaultVoice(voice) {
  return (
    voice?.verificationMode === PINNED_OFFICIAL_TTS_ONLY_MODE &&
    voice.voiceId === PINNED_OFFICIAL_DEFAULT_VOICE.voiceId &&
    voice.name === PINNED_OFFICIAL_DEFAULT_VOICE.name &&
    voice.voiceType === PINNED_OFFICIAL_DEFAULT_VOICE.voiceType &&
    voice.category === PINNED_OFFICIAL_DEFAULT_VOICE.category &&
    voice.previewUrl === PINNED_OFFICIAL_DEFAULT_VOICE.previewUrl &&
    voice.catalogDenial?.endpoint === "/v2/voices" &&
    voice.catalogDenial?.status === 401 &&
    voice.catalogDenial?.code === "missing_permissions" &&
    voice.description === undefined &&
    voice.labels === undefined
  );
}

function isSafeMissingPermissionsCatalogError(error) {
  return (
    error instanceof VoiceCatalogError &&
    error.status === 401 &&
    error.classification === "missing_permissions"
  );
}

function userSelectedTtsOnlyVerification(voiceId, selectedAt) {
  return {
    schemaVersion: 1,
    mode: USER_SELECTED_TTS_ONLY_MODE,
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
  };
}

export function validatedVoiceId(value) {
  invariant(
    typeof value === "string" && SAFE_VOICE_ID.test(value),
    "Voice ID must contain only letters, numbers, underscores, or hyphens.",
  );
  return value;
}

export function sanitizeVoiceMetadata(value) {
  if (!isRecord(value) || value.category !== "premade") return undefined;
  if (
    typeof value.voice_id !== "string" ||
    !SAFE_VOICE_ID.test(value.voice_id)
  ) {
    return undefined;
  }
  const name = normalizedText(value.name, 100);
  if (!name) return undefined;

  const labels = {};
  if (isRecord(value.labels)) {
    for (const key of ALLOWED_LABELS) {
      const label = normalizedText(value.labels[key], 80);
      if (label) labels[key] = label;
    }
  }

  const description = normalizedText(value.description, 240);
  const previewUrl = sanitizedPreviewUrl(value.preview_url);
  return {
    voiceId: value.voice_id,
    name,
    voiceType: "default",
    category: "premade",
    ...(description ? { description } : {}),
    ...(Object.keys(labels).length > 0 ? { labels } : {}),
    ...(previewUrl ? { previewUrl } : {}),
  };
}

export function safeProviderFailureClassification(body) {
  const detail = isRecord(body) ? body.detail : undefined;
  const candidate = isRecord(detail) ? (detail.status ?? detail.code) : detail;
  return typeof candidate === "string" &&
    ALLOWED_PROVIDER_FAILURES.has(candidate)
    ? candidate
    : "unknown";
}

export function assertCleanCredentialSourceStatus(status) {
  invariant(
    typeof status === "string" && status.trim() === "",
    "Refusing to load ElevenLabs credentials into a dirty or untracked Git tree. Commit the reviewed voice tooling first.",
  );
}

export function voiceCatalogUrl({ nextPageToken, voiceIds } = {}) {
  const url = new URL(ELEVENLABS_VOICE_CATALOG_URL);
  url.searchParams.set("voice_type", "default");
  url.searchParams.set("category", "premade");
  url.searchParams.set("page_size", "100");
  url.searchParams.set("include_total_count", "false");
  url.searchParams.set("sort", "name");
  url.searchParams.set("sort_direction", "asc");
  if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
  for (const voiceId of voiceIds ?? []) {
    url.searchParams.append("voice_ids", validatedVoiceId(voiceId));
  }
  return url;
}

async function catalogPage({ apiKey, fetchImpl, nextPageToken, voiceIds }) {
  invariant(
    typeof apiKey === "string" && apiKey.length > 0,
    "ELEVENLABS_API_KEY is unavailable. Run through with-ai-keys.",
  );
  const response = await fetchImpl(
    voiceCatalogUrl({ nextPageToken, voiceIds }),
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new VoiceCatalogError(
      response.status,
      safeProviderFailureClassification(errorBody),
    );
  }

  const body = await response.json().catch(() => undefined);
  invariant(
    isRecord(body) &&
      Array.isArray(body.voices) &&
      typeof body.has_more === "boolean",
    "ElevenLabs voice catalog returned an invalid response.",
  );
  return body;
}

export async function listDefaultPremadeVoices({
  apiKey,
  fetchImpl = globalThis.fetch,
  voiceIds,
  maxPages = MAX_CATALOG_PAGES,
  maxVoices = MAX_CATALOG_VOICES,
}) {
  invariant(
    typeof fetchImpl === "function",
    "A fetch implementation is required.",
  );
  invariant(
    Number.isInteger(maxPages) && maxPages > 0 && maxPages <= 50,
    "maxPages must be an integer from 1 to 50.",
  );
  invariant(
    Number.isInteger(maxVoices) && maxVoices > 0 && maxVoices <= 5_000,
    "maxVoices must be an integer from 1 to 5000.",
  );
  if (voiceIds) {
    invariant(
      Array.isArray(voiceIds) && voiceIds.length > 0 && voiceIds.length <= 100,
      "voiceIds must contain between 1 and 100 IDs.",
    );
    voiceIds.forEach(validatedVoiceId);
  }

  const voices = new Map();
  const seenPageTokens = new Set();
  let nextPageToken;

  for (let page = 0; page < maxPages; page += 1) {
    const body = await catalogPage({
      apiKey,
      fetchImpl,
      nextPageToken,
      voiceIds,
    });

    for (const candidate of body.voices) {
      const voice = sanitizeVoiceMetadata(candidate);
      if (!voice) continue;
      const existing = voices.get(voice.voiceId);
      if (existing) {
        invariant(
          JSON.stringify(existing) === JSON.stringify(voice),
          "ElevenLabs returned conflicting metadata for one voice ID.",
        );
      } else {
        voices.set(voice.voiceId, voice);
      }
    }
    invariant(
      voices.size <= maxVoices,
      "ElevenLabs voice catalog exceeded the bounded voice limit.",
    );

    if (!body.has_more) {
      return [...voices.values()].sort(
        (left, right) =>
          left.name.localeCompare(right.name, "en") ||
          left.voiceId.localeCompare(right.voiceId, "en"),
      );
    }

    invariant(
      typeof body.next_page_token === "string" &&
        body.next_page_token.length > 0 &&
        body.next_page_token.length <= 2_048,
      "ElevenLabs voice catalog omitted its next page token.",
    );
    invariant(
      !seenPageTokens.has(body.next_page_token),
      "ElevenLabs voice catalog repeated a page token.",
    );
    seenPageTokens.add(body.next_page_token);
    nextPageToken = body.next_page_token;
  }

  throw new Error("ElevenLabs voice catalog exceeded the bounded page limit.");
}

export async function findDefaultPremadeVoice({
  voiceId,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  const requestedVoiceId = validatedVoiceId(voiceId);
  let voices;
  try {
    voices = await listDefaultPremadeVoices({
      apiKey,
      fetchImpl,
      voiceIds: [requestedVoiceId],
    });
  } catch (error) {
    const pinned = pinnedOfficialDefaultVoice(requestedVoiceId);
    if (pinned && isSafeMissingPermissionsCatalogError(error)) return pinned;
    throw error;
  }
  const voice = voices.find(
    (candidate) => candidate.voiceId === requestedVoiceId,
  );
  invariant(
    voice,
    "The requested voice is not currently available as a default premade voice.",
  );
  return voice;
}

function insideDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function readBoundedJson(filePath, description) {
  const metadata = await fs.lstat(filePath);
  invariant(
    !metadata.isSymbolicLink() && metadata.isFile(),
    `${description} must be a regular file.`,
  );
  invariant(
    metadata.size > 0 && metadata.size <= MAX_JSON_FILE_BYTES,
    `${description} has an invalid size.`,
  );
  let handle;
  try {
    // O_NOFOLLOW closes the lstat/open race on platforms that provide it.
    // The inode comparison remains a defensive fallback for platforms without it.
    const noFollow = fsConstants.O_NOFOLLOW ?? 0;
    try {
      handle = await fs.open(filePath, fsConstants.O_RDONLY | noFollow);
    } catch (error) {
      if (noFollow === 0 || error?.code !== "EINVAL") throw error;
      handle = await fs.open(filePath, "r");
    }
    const opened = await handle.stat();
    invariant(
      opened.isFile() &&
        opened.size === metadata.size &&
        opened.dev === metadata.dev &&
        opened.ino === metadata.ino,
      `${description} changed while it was being read.`,
    );
    return JSON.parse(await handle.readFile({ encoding: "utf8" }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${description} must contain valid JSON.`);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function catalogVerification(timestamp) {
  return {
    schemaVersion: 1,
    mode: CATALOG_VERIFIED_MODE,
    endpoint: "/v2/voices",
    filters: { voiceType: "default", category: "premade" },
    verifiedAt: timestamp,
  };
}

function pinnedOfficialDocsVerification() {
  return {
    schemaVersion: 1,
    mode: PINNED_OFFICIAL_TTS_ONLY_MODE,
    source: PINNED_OFFICIAL_DOCS_SOURCE,
    voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
    previewUrl: PINNED_OFFICIAL_DEFAULT_VOICE.previewUrl,
    metadataRecheck: "unavailable_with_this_key_scope",
    catalogDenial: {
      endpoint: "/v2/voices",
      status: 401,
      code: "missing_permissions",
    },
  };
}

function verificationForVoice(voice, timestamp) {
  return isPinnedOfficialDefaultVoice(voice)
    ? pinnedOfficialDocsVerification(timestamp)
    : catalogVerification(timestamp);
}

function validVerification(value) {
  if (!isRecord(value)) return false;
  if (value.mode === CATALOG_VERIFIED_MODE) {
    return (
      hasOnlyKeys(value, [
        "schemaVersion",
        "mode",
        "endpoint",
        "filters",
        "verifiedAt",
      ]) &&
      value.schemaVersion === 1 &&
      value.endpoint === "/v2/voices" &&
      hasOnlyKeys(value.filters, ["voiceType", "category"]) &&
      value.filters.voiceType === "default" &&
      value.filters.category === "premade" &&
      isIsoTimestamp(value.verifiedAt)
    );
  }
  if (value.mode === USER_SELECTED_TTS_ONLY_MODE) {
    return (
      hasOnlyKeys(value, [
        "schemaVersion",
        "mode",
        "source",
        "voiceId",
        "metadata",
        "preview",
        "catalogDenial",
        "selectedAt",
      ]) &&
      value.schemaVersion === 1 &&
      value.source === "explicit_user_provided_exact_voice_id" &&
      typeof value.voiceId === "string" &&
      SAFE_VOICE_ID.test(value.voiceId) &&
      value.metadata === "unverified" &&
      value.preview === "not_performed" &&
      hasOnlyKeys(value.catalogDenial, ["endpoint", "status", "code"]) &&
      value.catalogDenial.endpoint === "/v2/voices" &&
      value.catalogDenial.status === 401 &&
      value.catalogDenial.code === "missing_permissions" &&
      isIsoTimestamp(value.selectedAt)
    );
  }
  return (
    hasOnlyKeys(value, [
      "schemaVersion",
      "mode",
      "source",
      "voiceId",
      "previewUrl",
      "metadataRecheck",
      "catalogDenial",
    ]) &&
    value.schemaVersion === 1 &&
    value.mode === PINNED_OFFICIAL_TTS_ONLY_MODE &&
    value.source === PINNED_OFFICIAL_DOCS_SOURCE &&
    value.voiceId === PINNED_OFFICIAL_DEFAULT_VOICE.voiceId &&
    value.previewUrl === PINNED_OFFICIAL_DEFAULT_VOICE.previewUrl &&
    value.metadataRecheck === "unavailable_with_this_key_scope" &&
    hasOnlyKeys(value.catalogDenial, ["endpoint", "status", "code"]) &&
    value.catalogDenial.endpoint === "/v2/voices" &&
    value.catalogDenial.status === 401 &&
    value.catalogDenial.code === "missing_permissions"
  );
}

function approvedRecordVerification(record) {
  return record.verification;
}

function normalizedLegacyCatalogVerification(value) {
  if (!hasOnlyKeys(value, ["endpoint", "filters", "verifiedAt"])) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    mode: CATALOG_VERIFIED_MODE,
    endpoint: value.endpoint,
    filters: value.filters,
    verifiedAt: value.verifiedAt,
  };
}

export function voiceMetadataFingerprint(voice) {
  const sanitized = sanitizeVoiceMetadata({
    voice_id: voice?.voiceId,
    name: voice?.name,
    category: voice?.category,
    description: voice?.description,
    labels: voice?.labels,
    preview_url: voice?.previewUrl,
  });
  invariant(sanitized, "Voice metadata is invalid.");
  return sha256(stableJson(sanitized));
}

export function approvedVoiceRecordDigest(record) {
  validateApprovedVoiceRecord(record);
  return sha256(stableJson(record));
}

function portableRelativePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

export async function loadCaptureBinding({
  root,
  outputDir,
  currentSourceSha,
  anchoredOutputIdentity,
}) {
  const resolvedRoot = path.resolve(root);
  const allowedRoot = path.join(resolvedRoot, "output", "playwright");
  const resolvedOutput = path.resolve(outputDir);
  invariant(
    insideDirectory(allowedRoot, resolvedOutput),
    "Capture output must stay inside output/playwright.",
  );

  const allowedMetadata = await fs.lstat(allowedRoot);
  invariant(
    !allowedMetadata.isSymbolicLink() && allowedMetadata.isDirectory(),
    "output/playwright must be a real directory.",
  );
  const allowedReal = await fs.realpath(allowedRoot);
  let outputReal;
  let outputReadRoot;
  if (anchoredOutputIdentity !== undefined) {
    invariant(
      Number.isInteger(anchoredOutputIdentity?.dev) &&
        Number.isInteger(anchoredOutputIdentity?.ino) &&
        typeof anchoredOutputIdentity?.realPath === "string" &&
        path.isAbsolute(anchoredOutputIdentity.realPath) &&
        path.resolve(anchoredOutputIdentity.realPath) ===
          anchoredOutputIdentity.realPath &&
        insideDirectory(allowedReal, anchoredOutputIdentity.realPath),
      "Anchored capture output identity is invalid.",
    );
    const anchoredMetadata = await fs.stat(".");
    const publicMetadata = await fs.lstat(resolvedOutput);
    invariant(
      anchoredMetadata.isDirectory() &&
        anchoredMetadata.dev === anchoredOutputIdentity.dev &&
        anchoredMetadata.ino === anchoredOutputIdentity.ino &&
        !publicMetadata.isSymbolicLink() &&
        publicMetadata.isDirectory() &&
        publicMetadata.dev === anchoredOutputIdentity.dev &&
        publicMetadata.ino === anchoredOutputIdentity.ino,
      "The capture output changed before its anchored files were read.",
    );
    outputReal = anchoredOutputIdentity.realPath;
    outputReadRoot = ".";
  } else {
    const outputMetadata = await fs.lstat(resolvedOutput);
    invariant(
      !outputMetadata.isSymbolicLink() && outputMetadata.isDirectory(),
      "Capture output must be a real directory.",
    );
    outputReal = await fs.realpath(resolvedOutput);
    invariant(
      insideDirectory(allowedReal, outputReal),
      "Resolved capture output escapes output/playwright.",
    );
    outputReadRoot = outputReal;
  }

  const relativeOutputPath = portableRelativePath(resolvedRoot, resolvedOutput);
  const owner = await readBoundedJson(
    path.join(outputReadRoot, ".wonderlab-demo-output.json"),
    "Capture ownership marker",
  );
  invariant(
    isRecord(owner) &&
      owner.schemaVersion === 1 &&
      owner.owner === DEMO_OUTPUT_OWNER &&
      owner.outputDir === relativeOutputPath &&
      owner.relativeOutputPath === relativeOutputPath,
    "Capture ownership marker does not match this output directory.",
  );

  const manifest = await readBoundedJson(
    path.join(outputReadRoot, "capture-manifest.json"),
    "Capture manifest",
  );
  invariant(
    isRecord(manifest) &&
      manifest.schemaVersion === 1 &&
      isRecord(manifest.source) &&
      typeof manifest.source.fullSha === "string" &&
      SAFE_SHA.test(manifest.source.fullSha) &&
      manifest.source.dirty === false,
    "Capture manifest does not contain a clean source checkpoint.",
  );
  if (currentSourceSha !== undefined) {
    invariant(
      SAFE_SHA.test(currentSourceSha) &&
        manifest.source.fullSha === currentSourceSha,
      "Capture source checkpoint does not match the current Git checkpoint.",
    );
  }

  return {
    outputReal,
    relativeOutputPath,
    captureSourceSha: manifest.source.fullSha,
    releaseIdentity: manifest.releaseIdentity,
  };
}

async function realElevenLabsDirectory(binding, create = false) {
  if (binding.anchoredNarrationIdentity !== undefined) {
    invariant(
      Number.isInteger(binding.anchoredNarrationIdentity?.dev) &&
        Number.isInteger(binding.anchoredNarrationIdentity?.ino),
      "Anchored ElevenLabs output identity is invalid.",
    );
    const metadata = await fs.stat(".");
    invariant(
      metadata.isDirectory() &&
        metadata.dev === binding.anchoredNarrationIdentity.dev &&
        metadata.ino === binding.anchoredNarrationIdentity.ino,
      "The anchored ElevenLabs output changed while artifacts were loaded.",
    );
    return ".";
  }
  const narrationDir = path.join(binding.outputReal, "elevenlabs");
  if (create) await fs.mkdir(narrationDir, { recursive: true });
  const narrationMetadata = await fs.lstat(narrationDir);
  invariant(
    !narrationMetadata.isSymbolicLink() && narrationMetadata.isDirectory(),
    "ElevenLabs output must be a real directory.",
  );
  const narrationReal = await fs.realpath(narrationDir);
  invariant(
    insideDirectory(binding.outputReal, narrationReal),
    "Resolved ElevenLabs output escapes the capture directory.",
  );
  return narrationReal;
}

async function assertPublicDirectoryIdentity({ filePath, dev, ino, message }) {
  let metadata;
  try {
    metadata = await fs.lstat(filePath);
  } catch {
    throw new Error(message);
  }
  invariant(
    !metadata.isSymbolicLink() &&
      metadata.isDirectory() &&
      metadata.dev === dev &&
      metadata.ino === ino,
    message,
  );
}

export async function assertPublicArtifactContinuity(binding) {
  assertCaptureBinding(binding);
  if (binding.publicArtifactIdentity === undefined) return;
  const identity = binding.publicArtifactIdentity;
  invariant(
    isRecord(identity) &&
      typeof identity.outputPath === "string" &&
      path.isAbsolute(identity.outputPath) &&
      path.resolve(identity.outputPath) === identity.outputPath &&
      Number.isInteger(identity.outputDev) &&
      Number.isInteger(identity.outputIno) &&
      typeof identity.narrationPath === "string" &&
      path.isAbsolute(identity.narrationPath) &&
      path.dirname(identity.narrationPath) === identity.outputPath &&
      path.basename(identity.narrationPath) === "elevenlabs" &&
      Number.isInteger(identity.narrationDev) &&
      Number.isInteger(identity.narrationIno),
    "Public ElevenLabs artifact identity is invalid.",
  );
  await assertPublicDirectoryIdentity({
    filePath: identity.outputPath,
    dev: identity.outputDev,
    ino: identity.outputIno,
    message: "The public capture output changed during voice approval.",
  });
  await assertPublicDirectoryIdentity({
    filePath: identity.narrationPath,
    dev: identity.narrationDev,
    ino: identity.narrationIno,
    message: "The public ElevenLabs directory changed during voice approval.",
  });
}

async function assertAbsentArtifact(directory, filename, description) {
  try {
    await fs.lstat(path.join(directory, filename));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(
    `${description} must be absent for this voice approval mode.`,
  );
}

async function assertNoUserSelectedApproval(directory) {
  try {
    const record = validateApprovedVoiceRecord(
      await readBoundedJson(
        path.join(directory, APPROVED_VOICE_FILENAME),
        "Approved voice record",
      ),
    );
    invariant(
      record.verification.mode !== USER_SELECTED_TTS_ONLY_MODE,
      "A user-selected TTS-only approval cannot be combined with preview-based voice artifacts.",
    );
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

async function assertNoPreviewBasedApproval(directory) {
  try {
    const record = validateApprovedVoiceRecord(
      await readBoundedJson(
        path.join(directory, APPROVED_VOICE_FILENAME),
        "Approved voice record",
      ),
    );
    invariant(
      record.verification.mode === USER_SELECTED_TTS_ONLY_MODE,
      "A preview-based approval cannot be combined with user-selected TTS-only voice artifacts.",
    );
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

async function withVoiceModeTransitionLock(directory, operation) {
  invariant(
    typeof operation === "function",
    "A voice mode transition operation is required.",
  );
  const lockPath = path.join(directory, VOICE_MODE_TRANSITION_LOCK_FILENAME);
  let handle;
  try {
    handle = await fs.open(
      lockPath,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "Another voice approval transition is in progress. No artifacts were written.",
      );
    }
    throw error;
  }
  let operationResult;
  let operationError;
  try {
    await handle.sync();
    operationResult = await operation();
  } catch (error) {
    operationError = error;
  }

  const cleanupFailures = [];
  try {
    await handle.close();
  } catch (error) {
    cleanupFailures.push(error);
  }
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") cleanupFailures.push(error);
  }
  if (cleanupFailures.length > 0) {
    throw new Error(
      operationError
        ? "Voice mode transition failed and its lock could not be fully cleaned up. Inspect the capture before retrying."
        : "Voice mode transition completed, but its lock could not be fully cleaned up. Artifacts may have been written; inspect the capture before retrying.",
      { cause: operationError ?? cleanupFailures[0] },
    );
  }
  if (operationError) throw operationError;
  return operationResult;
}

function assertCaptureBinding(binding) {
  invariant(
    isRecord(binding) &&
      typeof binding.outputReal === "string" &&
      typeof binding.captureSourceSha === "string" &&
      SAFE_SHA.test(binding.captureSourceSha),
    "Capture binding is invalid.",
  );
}

async function publishExclusiveFile({ directory, filename, content }) {
  const destination = path.join(directory, filename);
  const temporary = path.join(
    directory,
    `.${filename}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );
  try {
    const existing = await fs.lstat(destination);
    invariant(
      !existing.isSymbolicLink() && existing.isFile(),
      `${filename} path must be a regular file.`,
    );
    throw new Error(
      `${filename} already exists. Move it aside before recording another selection.`,
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    // link(2) is atomic and, unlike rename(2), never replaces a concurrent file.
    await fs.link(temporary, destination);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `${filename} already exists. Move it aside before recording another selection.`,
      );
    }
    throw error;
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
  return destination;
}

async function readBoundedAudio(filePath, description) {
  const metadata = await fs.lstat(filePath);
  invariant(
    !metadata.isSymbolicLink() && metadata.isFile(),
    `${description} must be a regular file.`,
  );
  invariant(
    metadata.size > 0 && metadata.size <= MAX_PREVIEW_AUDIO_BYTES,
    `${description} has an invalid size.`,
  );
  const handle = await fs.open(
    filePath,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = await handle.stat();
    invariant(
      opened.isFile() &&
        opened.size === metadata.size &&
        opened.dev === metadata.dev &&
        opened.ino === metadata.ino,
      `${description} changed while it was being read.`,
    );
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function isMp3Audio(value) {
  return (
    Buffer.isBuffer(value) &&
    value.length >= 3 &&
    (value.subarray(0, 3).toString("ascii") === "ID3" ||
      (value[0] === 0xff && (value[1] & 0xe0) === 0xe0))
  );
}

export function createPreviewVoiceRecord({
  voice,
  captureSourceSha,
  audio,
  now,
}) {
  invariant(
    typeof captureSourceSha === "string" && SAFE_SHA.test(captureSourceSha),
    "Capture source checkpoint is invalid.",
  );
  invariant(
    Buffer.isBuffer(audio) &&
      audio.length > 0 &&
      audio.length <= MAX_PREVIEW_AUDIO_BYTES,
    "Preview audio is invalid.",
  );
  const timestamp = new Date(now ?? Date.now()).toISOString();
  return {
    schemaVersion: 1,
    provider: "elevenlabs",
    status: "previewed",
    voiceId: voice.voiceId,
    voiceFingerprint: voiceMetadataFingerprint(voice),
    preview: {
      filename: PREVIEW_AUDIO_FILENAME,
      sha256: sha256(audio),
      bytes: audio.length,
      recordedAt: timestamp,
    },
    captureSourceSha,
  };
}

export function validatePreviewVoiceRecord(value) {
  invariant(
    hasOnlyKeys(value, [
      "schemaVersion",
      "provider",
      "status",
      "voiceId",
      "voiceFingerprint",
      "preview",
      "captureSourceSha",
    ]) &&
      value.schemaVersion === 1 &&
      value.provider === "elevenlabs" &&
      value.status === "previewed" &&
      typeof value.voiceId === "string" &&
      SAFE_VOICE_ID.test(value.voiceId) &&
      typeof value.voiceFingerprint === "string" &&
      /^[a-f0-9]{64}$/.test(value.voiceFingerprint) &&
      hasOnlyKeys(value.preview, [
        "filename",
        "sha256",
        "bytes",
        "recordedAt",
      ]) &&
      value.preview.filename === PREVIEW_AUDIO_FILENAME &&
      typeof value.preview.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(value.preview.sha256) &&
      Number.isInteger(value.preview.bytes) &&
      value.preview.bytes > 0 &&
      value.preview.bytes <= MAX_PREVIEW_AUDIO_BYTES &&
      isIsoTimestamp(value.preview.recordedAt) &&
      typeof value.captureSourceSha === "string" &&
      SAFE_SHA.test(value.captureSourceSha),
    "Preview voice record is invalid.",
  );
  return value;
}

export async function loadPreviewVoiceRecord({ binding, voiceId }) {
  assertCaptureBinding(binding);
  const requestedVoiceId = validatedVoiceId(voiceId);
  const narrationReal = await realElevenLabsDirectory(binding);
  let rawRecord;
  try {
    rawRecord = await readBoundedJson(
      path.join(narrationReal, PREVIEW_VOICE_FILENAME),
      "Preview voice record",
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Preview voice record is required before approval.");
    }
    throw error;
  }
  const record = validatePreviewVoiceRecord(rawRecord);
  invariant(
    record.captureSourceSha === binding.captureSourceSha,
    "Preview voice record does not match the capture source checkpoint.",
  );
  invariant(
    record.voiceId === requestedVoiceId,
    "Preview voice record does not match the requested voice ID.",
  );
  const audio = await readBoundedAudio(
    path.join(narrationReal, record.preview.filename),
    "Premade preview audio",
  );
  invariant(
    audio.length === record.preview.bytes &&
      sha256(audio) === record.preview.sha256,
    "Premade preview audio no longer matches its recorded digest.",
  );
  return record;
}

export async function writePreviewVoiceRecord({ binding, voice, audio, now }) {
  assertCaptureBinding(binding);
  invariant(
    typeof voice?.previewUrl === "string" &&
      sanitizedPreviewUrl(voice.previewUrl) === voice.previewUrl,
    "The selected default premade voice has no safe provider preview URL.",
  );
  const narrationReal = await realElevenLabsDirectory(binding, true);
  await assertPublicArtifactContinuity(binding);
  const result = await withVoiceModeTransitionLock(narrationReal, async () => {
    await assertNoUserSelectedApproval(narrationReal);
    const previewAudioPath = await publishExclusiveFile({
      directory: narrationReal,
      filename: PREVIEW_AUDIO_FILENAME,
      content: audio,
    });
    try {
      const record = createPreviewVoiceRecord({
        voice,
        captureSourceSha: binding.captureSourceSha,
        audio,
        now,
      });
      const previewPath = await publishExclusiveFile({
        directory: narrationReal,
        filename: PREVIEW_VOICE_FILENAME,
        content: `${JSON.stringify(record, null, 2)}\n`,
      });
      return { previewPath, previewAudioPath, record };
    } catch (error) {
      // An audio capture without a record is harmless but should not block an intentional retry.
      await fs.unlink(previewAudioPath).catch(() => {});
      throw error;
    }
  });
  await assertPublicArtifactContinuity(binding);
  return result;
}

export async function downloadPremadeVoicePreview({
  binding,
  voice,
  fetchImpl = globalThis.fetch,
  now,
}) {
  assertCaptureBinding(binding);
  const narrationReal = await realElevenLabsDirectory(binding, true);
  await assertNoUserSelectedApproval(narrationReal);
  invariant(
    typeof fetchImpl === "function",
    "A fetch implementation is required.",
  );
  invariant(
    typeof voice?.previewUrl === "string" &&
      sanitizedPreviewUrl(voice.previewUrl) === voice.previewUrl,
    "The selected default premade voice has no safe provider preview URL.",
  );
  await assertPublicArtifactContinuity(binding);
  const response = await fetchImpl(voice.previewUrl, {
    method: "GET",
    headers: { Accept: "audio/mpeg,audio/*;q=0.9" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  invariant(response?.ok, "ElevenLabs premade preview download failed.");
  const rawContentLength = response.headers?.get?.("content-length");
  const contentLength =
    rawContentLength === null || rawContentLength === undefined
      ? Number.NaN
      : Number(rawContentLength);
  const contentType = response.headers?.get?.("content-type");
  const pinnedOfficialPlainTextResponse =
    isPinnedOfficialDefaultVoice(voice) &&
    /^text\/plain(?:\s*;|$)/i.test(contentType ?? "");
  invariant(
    !contentType ||
      /^audio\/(?:mpeg|mp3)(?:\s*;|$)/i.test(contentType) ||
      pinnedOfficialPlainTextResponse,
    "ElevenLabs premade preview did not return MP3 audio.",
  );
  invariant(
    !Number.isFinite(contentLength) ||
      (contentLength > 0 && contentLength <= MAX_PREVIEW_AUDIO_BYTES),
    "ElevenLabs premade preview exceeded the bounded audio limit.",
  );
  const chunks = [];
  let totalBytes = 0;
  if (response.body?.[Symbol.asyncIterator]) {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      invariant(
        totalBytes <= MAX_PREVIEW_AUDIO_BYTES,
        "ElevenLabs premade preview exceeded the bounded audio limit.",
      );
      chunks.push(bytes);
    }
  } else {
    const bytes = Buffer.from(await response.arrayBuffer());
    totalBytes = bytes.length;
    invariant(
      totalBytes <= MAX_PREVIEW_AUDIO_BYTES,
      "ElevenLabs premade preview exceeded the bounded audio limit.",
    );
    chunks.push(bytes);
  }
  const audio = Buffer.concat(chunks, totalBytes);
  invariant(
    audio.length <= MAX_PREVIEW_AUDIO_BYTES && isMp3Audio(audio),
    "ElevenLabs premade preview did not return valid MP3 audio.",
  );
  await assertPublicArtifactContinuity(binding);
  return writePreviewVoiceRecord({ binding, voice, audio, now });
}

export function createApprovedVoiceRecord({
  voice,
  captureSourceSha,
  preview,
  now,
}) {
  invariant(
    isRecord(voice) &&
      voice.voiceType === "default" &&
      voice.category === "premade" &&
      SAFE_VOICE_ID.test(voice.voiceId) &&
      normalizedText(voice.name, 100) === voice.name,
    "Approved voice metadata is invalid.",
  );
  validatePreviewVoiceRecord(preview);
  invariant(
    preview.captureSourceSha === captureSourceSha &&
      preview.voiceId === voice.voiceId &&
      preview.voiceFingerprint === voiceMetadataFingerprint(voice),
    "Preview voice evidence does not match the current premade voice metadata.",
  );
  invariant(
    typeof captureSourceSha === "string" && SAFE_SHA.test(captureSourceSha),
    "Capture source checkpoint is invalid.",
  );
  const timestamp = new Date(now ?? Date.now()).toISOString();
  const labels = {};
  if (isRecord(voice.labels)) {
    for (const key of ALLOWED_LABELS) {
      const label = normalizedText(voice.labels[key], 80);
      if (label) labels[key] = label;
    }
  }
  return {
    schemaVersion: 1,
    provider: "elevenlabs",
    status: "approved",
    voice: {
      voiceId: voice.voiceId,
      name: voice.name,
      voiceType: "default",
      category: "premade",
      ...(voice.description ? { description: voice.description } : {}),
      ...(Object.keys(labels).length > 0 ? { labels } : {}),
    },
    voiceFingerprint: voiceMetadataFingerprint(voice),
    verification: verificationForVoice(voice, timestamp),
    approval: {
      method: "explicit-cli-confirmation",
      previewReviewed: true,
      recordedAt: timestamp,
    },
    preview: {
      sha256: preview.preview.sha256,
      bytes: preview.preview.bytes,
      recordedAt: preview.preview.recordedAt,
    },
    captureSourceSha,
  };
}

export function validateApprovedVoiceRecord(value) {
  if (value?.schemaVersion === 2) {
    invariant(
      hasOnlyKeys(value, [
        "schemaVersion",
        "provider",
        "status",
        "voice",
        "verification",
        "approval",
        "captureSourceSha",
      ]) &&
        value.provider === "elevenlabs" &&
        value.status === "approved" &&
        hasOnlyKeys(value.voice, ["voiceId"]) &&
        typeof value.voice.voiceId === "string" &&
        SAFE_VOICE_ID.test(value.voice.voiceId) &&
        validVerification(value.verification) &&
        value.verification.mode === USER_SELECTED_TTS_ONLY_MODE &&
        value.verification.voiceId === value.voice.voiceId &&
        hasOnlyKeys(value.approval, ["method", "selectedAt"]) &&
        value.approval.method ===
          "explicit-cli-user-selected-voice-confirmation" &&
        value.approval.selectedAt === value.verification.selectedAt &&
        isIsoTimestamp(value.approval.selectedAt) &&
        typeof value.captureSourceSha === "string" &&
        SAFE_SHA.test(value.captureSourceSha),
      "Approved voice record is invalid.",
    );
    return value;
  }
  const hasVerification = value?.verification !== undefined;
  const hasLegacyCatalog = value?.catalog !== undefined;
  const verification = hasVerification
    ? value.verification
    : normalizedLegacyCatalogVerification(value?.catalog);
  const validLabels =
    value?.voice?.labels === undefined ||
    (hasOnlyKeys(value.voice.labels, ALLOWED_LABELS) &&
      Object.entries(value.voice.labels).every(
        ([, label]) => normalizedText(label, 80) === label,
      ));
  invariant(
    hasOnlyKeys(value, [
      "schemaVersion",
      "provider",
      "status",
      "voice",
      "voiceFingerprint",
      hasLegacyCatalog ? "catalog" : "verification",
      "approval",
      "preview",
      "captureSourceSha",
    ]) &&
      hasVerification !== hasLegacyCatalog &&
      value.schemaVersion === 1 &&
      value.provider === "elevenlabs" &&
      value.status === "approved" &&
      hasOnlyKeys(value.voice, [
        "voiceId",
        "name",
        "voiceType",
        "category",
        "description",
        "labels",
      ]) &&
      value.voice.voiceType === "default" &&
      value.voice.category === "premade" &&
      typeof value.voice.voiceId === "string" &&
      SAFE_VOICE_ID.test(value.voice.voiceId) &&
      normalizedText(value.voice.name, 100) === value.voice.name &&
      (value.voice.description === undefined ||
        normalizedText(value.voice.description, 240) ===
          value.voice.description) &&
      validLabels &&
      typeof value.voiceFingerprint === "string" &&
      /^[a-f0-9]{64}$/.test(value.voiceFingerprint) &&
      validVerification(verification) &&
      hasOnlyKeys(value.approval, [
        "method",
        "previewReviewed",
        "recordedAt",
      ]) &&
      value.approval.method === "explicit-cli-confirmation" &&
      value.approval.previewReviewed === true &&
      isIsoTimestamp(value.approval.recordedAt) &&
      hasOnlyKeys(value.preview, ["sha256", "bytes", "recordedAt"]) &&
      typeof value.preview.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(value.preview.sha256) &&
      Number.isInteger(value.preview.bytes) &&
      value.preview.bytes > 0 &&
      value.preview.bytes <= MAX_PREVIEW_AUDIO_BYTES &&
      isIsoTimestamp(value.preview.recordedAt) &&
      typeof value.captureSourceSha === "string" &&
      SAFE_SHA.test(value.captureSourceSha),
    "Approved voice record is invalid.",
  );
  if (!hasLegacyCatalog) return value;
  const record = { ...value, verification };
  delete record.catalog;
  return record;
}

export async function loadApprovedVoiceRecord({ binding, voiceId }) {
  assertCaptureBinding(binding);
  const approvedVoiceId = validatedVoiceId(voiceId);
  const narrationReal = await realElevenLabsDirectory(binding);
  const record = validateApprovedVoiceRecord(
    await readBoundedJson(
      path.join(narrationReal, APPROVED_VOICE_FILENAME),
      "Approved voice record",
    ),
  );
  invariant(
    record.captureSourceSha === binding.captureSourceSha,
    "Approved voice record does not match the capture source checkpoint.",
  );
  const verification = approvedRecordVerification(record);
  invariant(
    verification &&
      (verification.mode !== PINNED_OFFICIAL_TTS_ONLY_MODE ||
        record.voice.voiceId === PINNED_OFFICIAL_DEFAULT_VOICE.voiceId),
    "Approved voice record has an invalid verification source.",
  );
  invariant(
    record.voice.voiceId === approvedVoiceId,
    "Approved voice record does not match the requested voice ID.",
  );
  if (verification.mode === USER_SELECTED_TTS_ONLY_MODE) return record;
  const preview = await loadPreviewVoiceRecord({
    binding,
    voiceId: approvedVoiceId,
  });
  invariant(
    preview.voiceFingerprint === record.voiceFingerprint &&
      preview.preview.sha256 === record.preview.sha256 &&
      preview.preview.bytes === record.preview.bytes &&
      preview.preview.recordedAt === record.preview.recordedAt,
    "Approved voice record no longer matches the reviewed preview evidence.",
  );
  return record;
}

export async function verifyUserSelectedTtsOnlyVoice({
  voiceId,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  const requestedVoiceId = validatedVoiceId(voiceId);
  try {
    await catalogPage({
      apiKey,
      fetchImpl,
      voiceIds: [requestedVoiceId],
    });
  } catch (error) {
    if (error?.wonderlabCredentialBoundaryFailure === true) throw error;
    if (isSafeMissingPermissionsCatalogError(error)) {
      return {
        endpoint: "/v2/voices",
        status: 401,
        code: "missing_permissions",
      };
    }
    throw new Error(
      "The user-selected voice requires an exact-ID /v2/voices 401 missing_permissions denial before continuing.",
    );
  }
  throw new Error(
    "The user-selected voice requires an exact-ID /v2/voices 401 missing_permissions denial before continuing.",
  );
}

export async function verifyApprovedVoiceForGeneration({
  binding,
  voiceId,
  apiKey,
  fetchImpl = globalThis.fetch,
  expectedVerificationMode,
}) {
  const approved = await loadApprovedVoiceRecord({ binding, voiceId });
  if (expectedVerificationMode !== undefined) {
    invariant(
      approved.verification.mode === expectedVerificationMode,
      "Approved voice verification mode does not match the canonical release narration config.",
    );
  }
  if (approved.verification.mode === USER_SELECTED_TTS_ONLY_MODE) {
    const denial = await verifyUserSelectedTtsOnlyVoice({
      voiceId,
      apiKey,
      fetchImpl,
    });
    invariant(
      stableJson(denial) === stableJson(approved.verification.catalogDenial),
      "The user-selected voice verification source does not match the current exact-ID denial.",
    );
    return {
      approved,
      verification: approved.verification,
      approvalDigest: approvedVoiceRecordDigest(approved),
      liveVoice: undefined,
    };
  }
  const liveVoice = await findDefaultPremadeVoice({
    voiceId,
    apiKey,
    fetchImpl,
  });
  invariant(
    stableJson(approvedRecordVerification(approved)) ===
      stableJson(
        verificationForVoice(
          liveVoice,
          approvedRecordVerification(approved).verifiedAt,
        ),
      ),
    "The approved voice verification source does not match the current voice verification.",
  );
  invariant(
    voiceMetadataFingerprint(liveVoice) === approved.voiceFingerprint,
    "The approved voice metadata changed. Review and approve the current premade voice before generating.",
  );
  return {
    approved,
    liveVoice,
    verification: approvedRecordVerification(approved),
  };
}

export async function writeApprovedVoiceRecord({ binding, voice, now }) {
  assertCaptureBinding(binding);
  const narrationReal = await realElevenLabsDirectory(binding, true);
  await assertPublicArtifactContinuity(binding);
  const result = await withVoiceModeTransitionLock(narrationReal, async () => {
    await assertNoUserSelectedApproval(narrationReal);
    const preview = await loadPreviewVoiceRecord({
      binding,
      voiceId: voice.voiceId,
    });
    const record = createApprovedVoiceRecord({
      voice,
      captureSourceSha: binding.captureSourceSha,
      preview,
      now,
    });
    const approvalPath = await publishExclusiveFile({
      directory: narrationReal,
      filename: APPROVED_VOICE_FILENAME,
      content: `${JSON.stringify(record, null, 2)}\n`,
    });
    return { approvalPath, record };
  });
  await assertPublicArtifactContinuity(binding);
  return result;
}

export async function writeUserSelectedTtsOnlyVoiceRecord({
  binding,
  voiceId,
  apiKey,
  fetchImpl = globalThis.fetch,
  assertCredentialBoundary,
  now,
}) {
  assertCaptureBinding(binding);
  invariant(
    typeof assertCredentialBoundary === "function",
    "A credential boundary assertion is required.",
  );
  const selectedVoiceId = validatedVoiceId(voiceId);
  const narrationReal = await realElevenLabsDirectory(binding, true);
  await assertPublicArtifactContinuity(binding);
  await assertAbsentArtifact(
    narrationReal,
    PREVIEW_VOICE_FILENAME,
    "Preview voice record",
  );
  await assertAbsentArtifact(
    narrationReal,
    PREVIEW_AUDIO_FILENAME,
    "Premade preview audio",
  );
  await assertNoPreviewBasedApproval(narrationReal);
  await assertPublicArtifactContinuity(binding);
  assertCredentialBoundary();
  await verifyUserSelectedTtsOnlyVoice({
    voiceId: selectedVoiceId,
    apiKey,
    fetchImpl,
  });
  assertCredentialBoundary();
  await assertPublicArtifactContinuity(binding);
  // Recheck after the network boundary so artifacts cannot race mode selection.
  const result = await withVoiceModeTransitionLock(narrationReal, async () => {
    await assertAbsentArtifact(
      narrationReal,
      PREVIEW_VOICE_FILENAME,
      "Preview voice record",
    );
    await assertAbsentArtifact(
      narrationReal,
      PREVIEW_AUDIO_FILENAME,
      "Premade preview audio",
    );
    await assertNoPreviewBasedApproval(narrationReal);
    const selectedAt = new Date(now ?? Date.now()).toISOString();
    const record = {
      schemaVersion: 2,
      provider: "elevenlabs",
      status: "approved",
      voice: { voiceId: selectedVoiceId },
      verification: userSelectedTtsOnlyVerification(
        selectedVoiceId,
        selectedAt,
      ),
      approval: {
        method: "explicit-cli-user-selected-voice-confirmation",
        selectedAt,
      },
      captureSourceSha: binding.captureSourceSha,
    };
    validateApprovedVoiceRecord(record);
    const approvalPath = await publishExclusiveFile({
      directory: narrationReal,
      filename: APPROVED_VOICE_FILENAME,
      content: `${JSON.stringify(record, null, 2)}\n`,
    });
    return { approvalPath, record };
  });
  await assertPublicArtifactContinuity(binding);
  return result;
}

export function parseVoiceCatalogArguments(args) {
  const options = {
    credentialedRequest: false,
    confirmPreviewReviewed: false,
    confirmUserSelectedVoice: false,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--credentialed-request") {
      options.credentialedRequest = true;
      continue;
    }
    if (argument === "--confirm-preview-reviewed") {
      options.confirmPreviewReviewed = true;
      continue;
    }
    if (argument === "--confirm-user-selected-voice") {
      options.confirmUserSelectedVoice = true;
      continue;
    }
    if (argument === "--approve-user-selected-voice") {
      const value = args[index + 1];
      if (value && !value.startsWith("--")) {
        options.approveUserSelectedVoiceId = validatedVoiceId(value);
        index += 1;
      } else {
        options.useReleaseNarrationVoice = true;
      }
      continue;
    }
    if (argument === "--approve-voice") {
      const value = args[index + 1];
      invariant(
        value && !value.startsWith("--"),
        "--approve-voice requires a voice ID.",
      );
      options.approveVoiceId = validatedVoiceId(value);
      index += 1;
      continue;
    }
    if (argument === "--preview-voice") {
      const value = args[index + 1];
      invariant(
        value && !value.startsWith("--"),
        "--preview-voice requires a voice ID.",
      );
      options.previewVoiceId = validatedVoiceId(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    throw new Error("Unknown voice catalog option.");
  }
  invariant(
    !options.confirmPreviewReviewed || options.approveVoiceId,
    "--confirm-preview-reviewed requires --approve-voice.",
  );
  invariant(
    !options.approveVoiceId || options.confirmPreviewReviewed,
    "--approve-voice requires --confirm-preview-reviewed.",
  );
  invariant(
    !options.confirmUserSelectedVoice ||
      options.approveUserSelectedVoiceId ||
      options.useReleaseNarrationVoice,
    "--confirm-user-selected-voice requires --approve-user-selected-voice.",
  );
  invariant(
    !(options.approveUserSelectedVoiceId || options.useReleaseNarrationVoice) ||
      options.confirmUserSelectedVoice,
    "--approve-user-selected-voice requires --confirm-user-selected-voice.",
  );
  invariant(
    [
      options.previewVoiceId,
      options.approveVoiceId,
      options.approveUserSelectedVoiceId,
      options.useReleaseNarrationVoice,
    ].filter(Boolean).length <= 1,
    "--preview-voice, --approve-voice, and --approve-user-selected-voice are mutually exclusive.",
  );
  invariant(
    !options.confirmUserSelectedVoice || !options.confirmPreviewReviewed,
    "--confirm-user-selected-voice and --confirm-preview-reviewed are mutually exclusive.",
  );
  invariant(
    !(options.previewVoiceId && options.confirmPreviewReviewed),
    "--confirm-preview-reviewed is only valid with --approve-voice.",
  );
  return options;
}
