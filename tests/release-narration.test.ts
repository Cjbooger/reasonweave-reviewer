import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertCanonicalReleaseNarration,
  assertReleaseNarrationAttemptBinding,
  loadReleaseNarration,
  releaseNarrationRecord,
} from "../scripts/release-narration.mjs";

const roots: string[] = [];
const canonical = {
  schemaVersion: 1,
  provider: "elevenlabs",
  voiceId: "OZxMHsGaBmV5pjMIDIn0",
  verificationMode: "user_selected_tts_only",
};

async function fixture(config = canonical) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-narration-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "config"));
  await fs.writeFile(
    path.join(root, "config", "release-narration.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("canonical release narration", () => {
  it("locks the checked-in release to the owner-selected voice", async () => {
    const narration = await loadReleaseNarration({ root: path.resolve(".") });

    expect(narration).toMatchObject(canonical);
  });

  it("loads the configured user-selected ElevenLabs voice with a hash-bound record", async () => {
    const narration = await loadReleaseNarration({ root: await fixture() });

    expect(narration).toMatchObject(canonical);
    expect(releaseNarrationRecord(narration)).toMatchObject({
      path: "config/release-narration.json",
      provider: canonical.provider,
      voiceId: canonical.voiceId,
      verificationMode: canonical.verificationMode,
    });
  });

  it("rejects extra keys and any noncanonical verification mode", () => {
    expect(() =>
      assertCanonicalReleaseNarration({ ...canonical, extra: true }),
    ).toThrow(/exactly/);
    expect(() =>
      assertCanonicalReleaseNarration({
        ...canonical,
        verificationMode: "catalog_verified",
      }),
    ).toThrow(/user-selected/);
  });

  it("rejects legacy or altered attempt receipts without the exact current narration binding", async () => {
    const narration = await loadReleaseNarration({ root: await fixture() });
    const releaseNarration = releaseNarrationRecord(narration);
    const currentAttempt = { releaseNarration };

    expect(
      assertReleaseNarrationAttemptBinding(currentAttempt, narration),
    ).toBe(currentAttempt);
    expect(() => assertReleaseNarrationAttemptBinding({}, narration)).toThrow(
      /canonical release narration/,
    );
    expect(() =>
      assertReleaseNarrationAttemptBinding(
        {
          releaseNarration: {
            ...releaseNarration,
            voiceId: "differentVoice",
          },
        },
        narration,
      ),
    ).toThrow(/canonical release narration/);
    expect(() =>
      assertReleaseNarrationAttemptBinding(
        {
          releaseNarration: {
            ...releaseNarration,
            extra: true,
          },
        },
        narration,
      ),
    ).toThrow(/canonical release narration/);
  });
});
