import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const catalogModuleUrl = pathToFileURL(
  path.join(process.cwd(), "scripts", "elevenlabs-voice-catalog.mjs"),
).href;

async function loadCatalogModule() {
  return import(/* @vite-ignore */ catalogModuleUrl);
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function rawVoice(overrides: Record<string, unknown> = {}) {
  return {
    voice_id: "voice_alpha",
    name: "Warm Narrator",
    category: "premade",
    description: "A warm educational narrator.",
    labels: {
      accent: "American",
      age: "middle aged",
      gender: "female",
      use_case: "narration",
    },
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/voice_alpha/preview.mp3#fragment",
    ...overrides,
  };
}

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) =>
        fs.rm(temporaryRoot, { recursive: true, force: true }),
      ),
  );
});

async function captureFixture(sourceSha = "a".repeat(40)) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-voices-"));
  temporaryRoots.push(root);
  const outputDir = path.join(root, "output", "playwright", "wonderlab-demo-a");
  await fs.mkdir(outputDir, { recursive: true });
  const relativeOutput = "output/playwright/wonderlab-demo-a";
  await fs.writeFile(
    path.join(outputDir, ".wonderlab-demo-output.json"),
    JSON.stringify({
      schemaVersion: 1,
      owner: "wonderlab-seeded-demo-v1",
      outputDir: relativeOutput,
      relativeOutputPath: relativeOutput,
    }),
  );
  await fs.writeFile(
    path.join(outputDir, "capture-manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      source: {
        fullSha: sourceSha,
        shortSha: sourceSha.slice(0, 7),
        dirty: false,
      },
    }),
  );
  return { root, outputDir, sourceSha };
}

describe("ElevenLabs default premade catalog", () => {
  it("paginates from has_more and its opaque token with fixed filters", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          voices: [rawVoice({ voice_id: "voice_z", name: "Zed" })],
          has_more: true,
          next_page_token: "opaque-token",
          total_count: 1,
        }),
      )
      .mockResolvedValueOnce(
        response({
          voices: [rawVoice({ voice_id: "voice_a", name: "Ada" })],
          has_more: false,
          next_page_token: null,
          total_count: 999,
        }),
      );

    const voices = await listDefaultPremadeVoices({
      apiKey: "test-key",
      fetchImpl,
    });

    expect(voices.map((voice: { voiceId: string }) => voice.voiceId)).toEqual([
      "voice_a",
      "voice_z",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(firstUrl.searchParams.get("voice_type")).toBe("default");
    expect(firstUrl.searchParams.get("category")).toBe("premade");
    expect(firstUrl.searchParams.get("page_size")).toBe("100");
    expect(firstUrl.searchParams.get("include_total_count")).toBe("false");
    expect(firstUrl.searchParams.has("next_page_token")).toBe(false);
    const secondUrl = new URL(String(fetchImpl.mock.calls[1][0]));
    expect(secondUrl.searchParams.get("next_page_token")).toBe("opaque-token");
  });

  it("allows an oversized default first page but enforces the total bound", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const voices = Array.from({ length: 101 }, (_, index) =>
      rawVoice({
        voice_id: `voice_${index}`,
        name: `Voice ${String(index).padStart(3, "0")}`,
      }),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response({ voices, has_more: false, total_count: 1 }));

    await expect(
      listDefaultPremadeVoices({
        apiKey: "test-key",
        fetchImpl,
        maxVoices: 101,
      }),
    ).resolves.toHaveLength(101);
    await expect(
      listDefaultPremadeVoices({
        apiKey: "test-key",
        fetchImpl,
        maxVoices: 100,
      }),
    ).rejects.toThrow(/bounded voice limit/i);
  });

  it("fails closed on missing, repeated, and excessive page tokens", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const missingToken = vi
      .fn()
      .mockResolvedValue(
        response({ voices: [], has_more: true, next_page_token: null }),
      );
    await expect(
      listDefaultPremadeVoices({
        apiKey: "test-key",
        fetchImpl: missingToken,
      }),
    ).rejects.toThrow(/omitted its next page token/i);

    const repeatedToken = vi
      .fn()
      .mockResolvedValueOnce(
        response({ voices: [], has_more: true, next_page_token: "same" }),
      )
      .mockResolvedValueOnce(
        response({ voices: [], has_more: true, next_page_token: "same" }),
      );
    await expect(
      listDefaultPremadeVoices({
        apiKey: "test-key",
        fetchImpl: repeatedToken,
      }),
    ).rejects.toThrow(/repeated a page token/i);

    const tooManyPages = vi
      .fn()
      .mockResolvedValueOnce(
        response({ voices: [], has_more: true, next_page_token: "next" }),
      );
    await expect(
      listDefaultPremadeVoices({
        apiKey: "test-key",
        fetchImpl: tooManyPages,
        maxPages: 1,
      }),
    ).rejects.toThrow(/bounded page limit/i);
  });

  it("emits only normalized allowlisted metadata", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        voices: [
          rawVoice({
            name: "\u001b[31m  Warm\u0007\u202e Narrator  ",
            description: `  Natural ${"voice ".repeat(80)}`,
            labels: {
              accent: " American\n",
              use_case: " narration ",
              private_owner: "must-not-leak",
            },
            sharing: { whitelisted_emails: ["private@example.test"] },
            samples: [{ recording_id: "private-recording" }],
          }),
          rawVoice({ voice_id: "cloned", category: "cloned" }),
        ],
        has_more: false,
      }),
    );

    const voices = await listDefaultPremadeVoices({
      apiKey: "test-key",
      fetchImpl,
    });
    expect(voices).toHaveLength(1);
    expect(voices[0]).toEqual({
      voiceId: "voice_alpha",
      name: "Warm Narrator",
      voiceType: "default",
      category: "premade",
      description: expect.stringMatching(/^Natural voice/),
      labels: { accent: "American", use_case: "narration" },
      previewUrl:
        "https://storage.googleapis.com/eleven-public-prod/premade/voices/voice_alpha/preview.mp3",
    });
    expect(JSON.stringify(voices)).not.toMatch(
      /private|sharing|samples|recording/i,
    );
  });

  it("rejects conflicting duplicate IDs", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        voices: [rawVoice(), rawVoice({ name: "Different Name" })],
        has_more: false,
      }),
    );

    await expect(
      listDefaultPremadeVoices({ apiKey: "test-key", fetchImpl }),
    ).rejects.toThrow(/conflicting metadata/i);
  });

  it("finds the exact requested ID even when the first page contains extras", async () => {
    const { findDefaultPremadeVoice } = await loadCatalogModule();
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        voices: [
          rawVoice({ voice_id: "extra_voice" }),
          rawVoice({ voice_id: "approved_voice", name: "Approved" }),
        ],
        has_more: false,
      }),
    );

    await expect(
      findDefaultPremadeVoice({
        voiceId: "approved_voice",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      voiceId: "approved_voice",
      voiceType: "default",
      category: "premade",
    });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.getAll("voice_ids")).toEqual(["approved_voice"]);
  });

  it("reports only bounded provider failure classification", async () => {
    const { listDefaultPremadeVoices } = await loadCatalogModule();
    const secret = "provider-secret-value";
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        response({ detail: { status: `missing_permissions\n${secret}` } }, 403),
      );

    try {
      await listDefaultPremadeVoices({ apiKey: secret, fetchImpl });
      throw new Error("Expected catalog failure.");
    } catch (error) {
      expect(String(error)).toContain("HTTP 403; unknown");
      expect(String(error)).not.toContain(secret);
    }
  });

  it("falls back only to the pinned official George record for exact missing_permissions", async () => {
    const { PINNED_OFFICIAL_DEFAULT_VOICE, findDefaultPremadeVoice } =
      await loadCatalogModule();
    const missingPermissions = vi
      .fn()
      .mockResolvedValue(
        response({ detail: { status: "missing_permissions" } }, 401),
      );

    await expect(
      findDefaultPremadeVoice({
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        apiKey: "tts-only-key",
        fetchImpl: missingPermissions,
      }),
    ).resolves.toEqual({
      ...PINNED_OFFICIAL_DEFAULT_VOICE,
      verificationMode: "pinned_official_tts_only",
      catalogDenial: {
        endpoint: "/v2/voices",
        status: 401,
        code: "missing_permissions",
      },
    });
  });

  it("does not substitute a pinned voice for another voice or another provider failure", async () => {
    const { PINNED_OFFICIAL_DEFAULT_VOICE, findDefaultPremadeVoice } =
      await loadCatalogModule();
    const missingPermissions = vi
      .fn()
      .mockResolvedValue(
        response({ detail: { status: "missing_permissions" } }, 401),
      );
    await expect(
      findDefaultPremadeVoice({
        voiceId: "not_george",
        apiKey: "tts-only-key",
        fetchImpl: missingPermissions,
      }),
    ).rejects.toThrow(/HTTP 401; missing_permissions/i);

    for (const failure of [
      response({ detail: { status: "invalid_api_key" } }, 401),
      response({ detail: { status: "missing_permissions" } }, 403),
      response({ detail: { status: "missing_permissions" } }, 500),
      response({ detail: { status: "missing_permissions extra" } }, 401),
    ]) {
      await expect(
        findDefaultPremadeVoice({
          voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
          apiKey: "tts-only-key",
          fetchImpl: vi.fn().mockResolvedValue(failure),
        }),
      ).rejects.toThrow(/ElevenLabs voice catalog failed/i);
    }
  });

  it("uses a finite provider-status allowlist and rejects signed or foreign previews", async () => {
    const { safeProviderFailureClassification, sanitizeVoiceMetadata } =
      await loadCatalogModule();
    expect(
      safeProviderFailureClassification({
        detail: { status: "missing_permissions" },
      }),
    ).toBe("missing_permissions");
    expect(
      safeProviderFailureClassification({
        detail: { status: "provider-secret-value" },
      }),
    ).toBe("unknown");
    expect(
      sanitizeVoiceMetadata(
        rawVoice({
          preview_url:
            "https://storage.googleapis.com/eleven-public-prod/premade/voices/voice_alpha/preview.mp3?signature=secret",
        }),
      ),
    ).not.toHaveProperty("previewUrl");
    expect(
      sanitizeVoiceMetadata(
        rawVoice({ preview_url: "https://example.test/preview.mp3" }),
      ),
    ).not.toHaveProperty("previewUrl");
  });

  it("refuses credential injection when Git reports dirty or untracked source", async () => {
    const { assertCleanCredentialSourceStatus } = await loadCatalogModule();
    expect(() => assertCleanCredentialSourceStatus("")).not.toThrow();
    expect(() =>
      assertCleanCredentialSourceStatus(
        " M scripts/generate-elevenlabs-demo.mjs",
      ),
    ).toThrow(/dirty or untracked Git tree/i);
    expect(() =>
      assertCleanCredentialSourceStatus("?? scripts/unreviewed.mjs"),
    ).toThrow(/dirty or untracked Git tree/i);
  });
});

describe("ElevenLabs voice approval", () => {
  it("requires both explicit approval flags", async () => {
    const { parseVoiceCatalogArguments } = await loadCatalogModule();
    expect(() =>
      parseVoiceCatalogArguments(["--approve-voice", "voice_alpha"]),
    ).toThrow(/requires --confirm-preview-reviewed/i);
    expect(() =>
      parseVoiceCatalogArguments(["--confirm-preview-reviewed"]),
    ).toThrow(/requires --approve-voice/i);
    expect(
      parseVoiceCatalogArguments([
        "--approve-voice",
        "voice_alpha",
        "--confirm-preview-reviewed",
      ]),
    ).toMatchObject({
      approveVoiceId: "voice_alpha",
      confirmPreviewReviewed: true,
    });
    expect(
      parseVoiceCatalogArguments(["--preview-voice", "voice_alpha"]),
    ).toMatchObject({ previewVoiceId: "voice_alpha" });
    expect(() =>
      parseVoiceCatalogArguments([
        "--preview-voice",
        "voice_alpha",
        "--approve-voice",
        "voice_alpha",
        "--confirm-preview-reviewed",
      ]),
    ).toThrow(/mutually exclusive/i);
    expect(() =>
      parseVoiceCatalogArguments([
        "--approve-user-selected-voice",
        "voice_alpha",
      ]),
    ).toThrow(/confirm-user-selected-voice/i);
    expect(
      parseVoiceCatalogArguments([
        "--approve-user-selected-voice",
        "voice_alpha",
        "--confirm-user-selected-voice",
      ]),
    ).toMatchObject({
      approveUserSelectedVoiceId: "voice_alpha",
      confirmUserSelectedVoice: true,
    });
    expect(
      parseVoiceCatalogArguments([
        "--approve-user-selected-voice",
        "--confirm-user-selected-voice",
      ]),
    ).toMatchObject({
      useReleaseNarrationVoice: true,
      confirmUserSelectedVoice: true,
    });
  });

  it("writes a schema-v2 user-selected TTS-only approval with no metadata or preview", async () => {
    const {
      loadCaptureBinding,
      validateApprovedVoiceRecord,
      verifyApprovedVoiceForGeneration,
      writeUserSelectedTtsOnlyVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const denial = vi
      .fn()
      .mockResolvedValue(
        response({ detail: { status: "missing_permissions" } }, 401),
      );
    const result = await writeUserSelectedTtsOnlyVoiceRecord({
      binding,
      voiceId: "OZxMHsGaBmV5pjMIDIn0",
      apiKey: "tts-only-key",
      fetchImpl: denial,
      assertCredentialBoundary: () => {},
      now: "2026-07-17T12:00:00.000Z",
    });
    expect(result.record).toEqual({
      schemaVersion: 2,
      provider: "elevenlabs",
      status: "approved",
      voice: { voiceId: "OZxMHsGaBmV5pjMIDIn0" },
      verification: {
        schemaVersion: 1,
        mode: "user_selected_tts_only",
        source: "explicit_user_provided_exact_voice_id",
        voiceId: "OZxMHsGaBmV5pjMIDIn0",
        metadata: "unverified",
        preview: "not_performed",
        catalogDenial: {
          endpoint: "/v2/voices",
          status: 401,
          code: "missing_permissions",
        },
        selectedAt: "2026-07-17T12:00:00.000Z",
      },
      approval: {
        method: "explicit-cli-user-selected-voice-confirmation",
        selectedAt: "2026-07-17T12:00:00.000Z",
      },
      captureSourceSha: fixture.sourceSha,
    });
    expect(JSON.stringify(result.record)).not.toMatch(
      /name|gender|previewUrl|fingerprint/i,
    );
    const requestUrl = new URL(String(denial.mock.calls[0][0]));
    expect(requestUrl.searchParams.getAll("voice_ids")).toEqual([
      "OZxMHsGaBmV5pjMIDIn0",
    ]);
    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: "OZxMHsGaBmV5pjMIDIn0",
        apiKey: "tts-only-key",
        fetchImpl: vi
          .fn()
          .mockResolvedValue(
            response({ detail: { status: "missing_permissions" } }, 401),
          ),
      }),
    ).resolves.toMatchObject({
      approvalDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(validateApprovedVoiceRecord(result.record)).toEqual(result.record);
    await expect(
      writeUserSelectedTtsOnlyVoiceRecord({
        binding,
        voiceId: "OZxMHsGaBmV5pjMIDIn0",
        apiKey: "catalog-key",
        fetchImpl: vi
          .fn()
          .mockResolvedValue(response({ voices: [], has_more: false })),
        assertCredentialBoundary: () => {},
      }),
    ).rejects.toThrow(/exact-ID/i);
  });

  it("fails closed on checkout mutation and mixed preview/user-selected artifacts", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      VOICE_MODE_TRANSITION_LOCK_FILENAME,
      writePreviewVoiceRecord,
      writeUserSelectedTtsOnlyVoiceRecord,
    } = await loadCatalogModule();
    const exactDenial = () =>
      vi
        .fn()
        .mockResolvedValue(
          response({ detail: { status: "missing_permissions" } }, 401),
        );
    const voiceId = "OZxMHsGaBmV5pjMIDIn0";
    const mutated = await captureFixture();
    const mutatedBinding = await loadCaptureBinding({
      root: mutated.root,
      outputDir: mutated.outputDir,
      currentSourceSha: mutated.sourceSha,
    });
    await expect(
      writeUserSelectedTtsOnlyVoiceRecord({
        binding: mutatedBinding,
        voiceId,
        apiKey: "tts-only-key",
        fetchImpl: exactDenial(),
        assertCredentialBoundary: () => {
          throw new Error("checkout changed");
        },
      }),
    ).rejects.toThrow(/checkout changed/i);
    await expect(
      fs.access(
        path.join(mutated.outputDir, "elevenlabs", "approved-voice.json"),
      ),
    ).rejects.toThrow();

    const locked = await captureFixture();
    const lockedBinding = await loadCaptureBinding({
      root: locked.root,
      outputDir: locked.outputDir,
      currentSourceSha: locked.sourceSha,
    });
    const lockedNarration = path.join(locked.outputDir, "elevenlabs");
    await fs.mkdir(lockedNarration);
    await fs.writeFile(
      path.join(lockedNarration, VOICE_MODE_TRANSITION_LOCK_FILENAME),
      "locked",
    );
    await expect(
      writeUserSelectedTtsOnlyVoiceRecord({
        binding: lockedBinding,
        voiceId,
        apiKey: "tts-only-key",
        fetchImpl: exactDenial(),
        assertCredentialBoundary: () => {},
      }),
    ).rejects.toThrow(/transition is in progress/i);
    await expect(
      fs.access(path.join(lockedNarration, "approved-voice.json")),
    ).rejects.toThrow();

    const selected = await captureFixture();
    const selectedBinding = await loadCaptureBinding({
      root: selected.root,
      outputDir: selected.outputDir,
      currentSourceSha: selected.sourceSha,
    });
    await writeUserSelectedTtsOnlyVoiceRecord({
      binding: selectedBinding,
      voiceId,
      apiKey: "tts-only-key",
      fetchImpl: exactDenial(),
      assertCredentialBoundary: () => {},
    });
    await expect(
      writePreviewVoiceRecord({
        binding: selectedBinding,
        voice: sanitizeVoiceMetadata(rawVoice()),
        audio: Buffer.from("preview-audio"),
      }),
    ).rejects.toThrow(/cannot be combined/i);

    const preview = await captureFixture();
    const previewBinding = await loadCaptureBinding({
      root: preview.root,
      outputDir: preview.outputDir,
      currentSourceSha: preview.sourceSha,
    });
    await writePreviewVoiceRecord({
      binding: previewBinding,
      voice: sanitizeVoiceMetadata(rawVoice()),
      audio: Buffer.from("preview-audio"),
    });
    await expect(
      writeUserSelectedTtsOnlyVoiceRecord({
        binding: previewBinding,
        voiceId,
        apiKey: "tts-only-key",
        fetchImpl: exactDenial(),
        assertCredentialBoundary: () => {},
      }),
    ).rejects.toThrow(/must be absent/i);
  });

  it("binds an atomic approval to the real owner, manifest, and source SHA", async () => {
    const {
      loadCaptureBinding,
      loadApprovedVoiceRecord,
      sanitizeVoiceMetadata,
      validateApprovedVoiceRecord,
      verifyApprovedVoiceForGeneration,
      writePreviewVoiceRecord,
      writeApprovedVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    await writePreviewVoiceRecord({
      binding,
      voice,
      audio: Buffer.from("preview-audio"),
      now: "2026-07-17T11:59:00.000Z",
    });
    const result = await writeApprovedVoiceRecord({
      binding,
      voice,
      now: "2026-07-17T12:00:00.000Z",
    });
    const written = JSON.parse(await fs.readFile(result.approvalPath, "utf8"));

    expect(validateApprovedVoiceRecord(written)).toMatchObject({
      provider: "elevenlabs",
      status: "approved",
      voice: {
        voiceId: "voice_alpha",
        voiceType: "default",
        category: "premade",
      },
      approval: { previewReviewed: true },
      voiceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      preview: { sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      captureSourceSha: fixture.sourceSha,
    });
    const { verification, ...legacyRecord } = written;
    const normalizedLegacy = validateApprovedVoiceRecord({
      ...legacyRecord,
      catalog: {
        endpoint: verification.endpoint,
        filters: verification.filters,
        verifiedAt: verification.verifiedAt,
      },
    });
    expect(normalizedLegacy).toMatchObject({
      verification: {
        schemaVersion: 1,
        mode: "catalog_verified",
        endpoint: "/v2/voices",
        verifiedAt: "2026-07-17T12:00:00.000Z",
      },
    });
    expect(normalizedLegacy).not.toHaveProperty("catalog");
    expect(() =>
      validateApprovedVoiceRecord({
        ...written,
        catalog: {
          endpoint: verification.endpoint,
          filters: verification.filters,
          verifiedAt: verification.verifiedAt,
        },
      }),
    ).toThrow(/approved voice record is invalid/i);
    expect(JSON.stringify(written)).not.toContain("previewUrl");
    expect(JSON.stringify(written)).not.toContain("preview_url");
    expect((await fs.stat(result.approvalPath)).mode & 0o777).toBe(0o600);
    await expect(
      loadApprovedVoiceRecord({ binding, voiceId: "voice_alpha" }),
    ).resolves.toMatchObject({
      voice: { voiceId: "voice_alpha", name: "Warm Narrator" },
      captureSourceSha: fixture.sourceSha,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        voices: [rawVoice()],
        has_more: false,
      }),
    );
    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: "voice_alpha",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      liveVoice: { voiceId: "voice_alpha", category: "premade" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(writeApprovedVoiceRecord({ binding, voice })).rejects.toThrow(
      /already exists/i,
    );
  });

  it("records pinned fallback approval as official-docs evidence and requires it during generation", async () => {
    const {
      PINNED_OFFICIAL_DEFAULT_VOICE,
      createPreviewVoiceRecord,
      createApprovedVoiceRecord,
      loadCaptureBinding,
      verifyApprovedVoiceForGeneration,
      writeApprovedVoiceRecord,
      writePreviewVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const pinnedVoice = {
      ...PINNED_OFFICIAL_DEFAULT_VOICE,
      verificationMode: "pinned_official_tts_only",
      catalogDenial: {
        endpoint: "/v2/voices",
        status: 401,
        code: "missing_permissions",
      },
    };
    await writePreviewVoiceRecord({
      binding,
      voice: pinnedVoice,
      audio: Buffer.from("preview-audio"),
      now: "2026-07-17T12:00:00.000Z",
    });
    const approval = await writeApprovedVoiceRecord({
      binding,
      voice: pinnedVoice,
      now: "2026-07-17T12:01:00.000Z",
    });
    expect(approval.record).toMatchObject({
      verification: {
        mode: "pinned_official_tts_only",
        source: "elevenlabs-official-docs",
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        metadataRecheck: "unavailable_with_this_key_scope",
        catalogDenial: {
          endpoint: "/v2/voices",
          status: 401,
          code: "missing_permissions",
        },
      },
    });
    expect(approval.record).not.toHaveProperty("catalog");

    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        apiKey: "tts-only-key",
        fetchImpl: vi
          .fn()
          .mockResolvedValue(
            response({ detail: { status: "missing_permissions" } }, 401),
          ),
      }),
    ).resolves.toMatchObject({
      liveVoice: { voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId },
    });

    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        apiKey: "catalog-key",
        fetchImpl: vi.fn().mockResolvedValue(
          response({
            voices: [
              rawVoice({
                voice_id: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
                name: PINNED_OFFICIAL_DEFAULT_VOICE.name,
                preview_url: PINNED_OFFICIAL_DEFAULT_VOICE.previewUrl,
              }),
            ],
            has_more: false,
          }),
        ),
      }),
    ).rejects.toThrow(/verification source does not match/i);

    const preview = createPreviewVoiceRecord({
      voice: pinnedVoice,
      captureSourceSha: fixture.sourceSha,
      audio: Buffer.from("preview-audio"),
      now: "2026-07-17T12:00:00.000Z",
    });
    expect(() =>
      createApprovedVoiceRecord({
        voice: { ...pinnedVoice, name: "Not George" },
        captureSourceSha: fixture.sourceSha,
        preview,
      }),
    ).toThrow(/preview voice evidence/i);

    const tampered = JSON.parse(
      await fs.readFile(approval.approvalPath, "utf8"),
    );
    tampered.verification.catalogDenial.status = 403;
    await fs.writeFile(approval.approvalPath, JSON.stringify(tampered));
    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        apiKey: "tts-only-key",
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow(/approved voice record is invalid/i);
  });

  it("rejects a mismatched or tampered approval before the live catalog check", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      verifyApprovedVoiceForGeneration,
      writePreviewVoiceRecord,
      writeApprovedVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    await writePreviewVoiceRecord({
      binding,
      voice,
      audio: Buffer.from("preview-audio"),
      now: "2026-07-17T12:00:00.000Z",
    });
    await writeApprovedVoiceRecord({
      binding,
      voice,
      now: "2026-07-17T12:01:00.000Z",
    });
    const fetchImpl = vi.fn();

    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: "different_voice",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).rejects.toThrow(/does not match the requested voice ID/i);
    expect(fetchImpl).not.toHaveBeenCalled();

    const approvalPath = path.join(
      fixture.outputDir,
      "elevenlabs",
      "approved-voice.json",
    );
    const tampered = JSON.parse(await fs.readFile(approvalPath, "utf8"));
    tampered.privateAccountField = "must-not-be-accepted";
    await fs.writeFile(approvalPath, JSON.stringify(tampered));
    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: "voice_alpha",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).rejects.toThrow(/approved voice record is invalid/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects source mismatch and a symlinked approval path", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      writePreviewVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    await expect(
      loadCaptureBinding({
        root: fixture.root,
        outputDir: fixture.outputDir,
        currentSourceSha: "b".repeat(40),
      }),
    ).rejects.toThrow(/does not match the current Git checkpoint/i);

    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const narrationDir = path.join(fixture.outputDir, "elevenlabs");
    await fs.mkdir(narrationDir);
    const outside = path.join(fixture.root, "outside.json");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, path.join(narrationDir, "approved-voice.json"));

    const voice = sanitizeVoiceMetadata(rawVoice());
    await expect(
      writePreviewVoiceRecord({
        binding,
        voice,
        audio: Buffer.from("x"),
      }),
    ).rejects.toThrow(/must be a regular file/i);
  });

  it("requires preview evidence, detects preview tampering, and binds it to the capture SHA", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      writeApprovedVoiceRecord,
      writePreviewVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    await expect(writeApprovedVoiceRecord({ binding, voice })).rejects.toThrow(
      /preview voice record/i,
    );
    await writePreviewVoiceRecord({
      binding,
      voice,
      audio: Buffer.from("preview-audio"),
    });
    const audioPath = path.join(
      fixture.outputDir,
      "elevenlabs",
      "premade-preview.mp3",
    );
    await fs.writeFile(audioPath, "tampered");
    await expect(writeApprovedVoiceRecord({ binding, voice })).rejects.toThrow(
      /no longer matches its recorded digest/i,
    );

    const second = await captureFixture("b".repeat(40));
    const secondBinding = await loadCaptureBinding({
      root: second.root,
      outputDir: second.outputDir,
      currentSourceSha: second.sourceSha,
    });
    await writePreviewVoiceRecord({
      binding: secondBinding,
      voice,
      audio: Buffer.from("preview-audio"),
    });
    const previewPath = path.join(
      second.outputDir,
      "elevenlabs",
      "preview-voice.json",
    );
    const preview = JSON.parse(await fs.readFile(previewPath, "utf8"));
    preview.captureSourceSha = fixture.sourceSha;
    await fs.writeFile(previewPath, JSON.stringify(preview));
    await expect(
      writeApprovedVoiceRecord({ binding: secondBinding, voice }),
    ).rejects.toThrow(/capture source checkpoint/i);
  });

  it("downloads only a bounded allowlisted premade preview into capture evidence", async () => {
    const {
      downloadPremadeVoicePreview,
      loadCaptureBinding,
      sanitizeVoiceMetadata,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    const previewAudio = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === "content-length"
            ? String(previewAudio.length)
            : name === "content-type"
              ? "audio/mpeg"
              : null,
      },
      arrayBuffer: async () => previewAudio,
    });
    const result = await downloadPremadeVoicePreview({
      binding,
      voice,
      fetchImpl,
      now: "2026-07-17T12:00:00.000Z",
    });
    expect(result.record).toMatchObject({
      voiceId: voice.voiceId,
      captureSourceSha: fixture.sourceSha,
      preview: {
        bytes: previewAudio.length,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(voice.previewUrl);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "error" });

    const invalidFixture = await captureFixture("c".repeat(40));
    const invalidBinding = await loadCaptureBinding({
      root: invalidFixture.root,
      outputDir: invalidFixture.outputDir,
      currentSourceSha: invalidFixture.sourceSha,
    });
    await expect(
      downloadPremadeVoicePreview({
        binding: invalidBinding,
        voice,
        fetchImpl: vi.fn().mockResolvedValue({
          ok: true,
          headers: {
            get: (name: string) =>
              name === "content-type" ? "text/html" : null,
          },
          arrayBuffer: async () => Buffer.from("not audio"),
        }),
      }),
    ).rejects.toThrow(/did not return MP3 audio/i);
  });

  it("accepts the pinned George MP3 bytes despite the provider's exact text/plain metadata", async () => {
    const {
      PINNED_OFFICIAL_DEFAULT_VOICE,
      downloadPremadeVoicePreview,
      loadCaptureBinding,
      sanitizeVoiceMetadata,
    } = await loadCatalogModule();
    const previewAudio = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    const plainTextMp3Response = () => ({
      ok: true,
      headers: {
        get: (name: string) =>
          name === "content-length"
            ? String(previewAudio.length)
            : name === "content-type"
              ? "text/plain"
              : null,
      },
      arrayBuffer: async () => previewAudio,
    });
    const fixture = await captureFixture("d".repeat(40));
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const pinnedVoice = {
      ...PINNED_OFFICIAL_DEFAULT_VOICE,
      verificationMode: "pinned_official_tts_only",
      catalogDenial: {
        endpoint: "/v2/voices",
        status: 401,
        code: "missing_permissions",
      },
    };
    await expect(
      downloadPremadeVoicePreview({
        binding,
        voice: pinnedVoice,
        fetchImpl: vi.fn().mockResolvedValue(plainTextMp3Response()),
      }),
    ).resolves.toMatchObject({
      record: {
        voiceId: PINNED_OFFICIAL_DEFAULT_VOICE.voiceId,
        preview: { bytes: previewAudio.length },
      },
    });

    const genericFixture = await captureFixture("e".repeat(40));
    const genericBinding = await loadCaptureBinding({
      root: genericFixture.root,
      outputDir: genericFixture.outputDir,
      currentSourceSha: genericFixture.sourceSha,
    });
    await expect(
      downloadPremadeVoicePreview({
        binding: genericBinding,
        voice: sanitizeVoiceMetadata(rawVoice()),
        fetchImpl: vi.fn().mockResolvedValue(plainTextMp3Response()),
      }),
    ).rejects.toThrow(/did not return MP3 audio/i);
  });

  it("rejects a live premade voice when any sanitized metadata changes", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      verifyApprovedVoiceForGeneration,
      writeApprovedVoiceRecord,
      writePreviewVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    await writePreviewVoiceRecord({
      binding,
      voice,
      audio: Buffer.from("preview-audio"),
    });
    await writeApprovedVoiceRecord({ binding, voice });
    await expect(
      verifyApprovedVoiceForGeneration({
        binding,
        voiceId: voice.voiceId,
        apiKey: "test-key",
        fetchImpl: vi.fn().mockResolvedValue(
          response({
            voices: [rawVoice({ description: "Changed description" })],
            has_more: false,
          }),
        ),
      }),
    ).rejects.toThrow(/metadata changed/i);
  });

  it("publishes exactly one approval if callers race", async () => {
    const {
      loadCaptureBinding,
      sanitizeVoiceMetadata,
      writeApprovedVoiceRecord,
      writePreviewVoiceRecord,
    } = await loadCatalogModule();
    const fixture = await captureFixture();
    const binding = await loadCaptureBinding({
      root: fixture.root,
      outputDir: fixture.outputDir,
      currentSourceSha: fixture.sourceSha,
    });
    const voice = sanitizeVoiceMetadata(rawVoice());
    await writePreviewVoiceRecord({
      binding,
      voice,
      audio: Buffer.from("preview-audio"),
    });
    const outcomes = await Promise.allSettled([
      writeApprovedVoiceRecord({ binding, voice }),
      writeApprovedVoiceRecord({ binding, voice }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
  });
});
