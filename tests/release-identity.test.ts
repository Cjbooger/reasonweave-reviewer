import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertReleaseIdentityRecord,
  assertReleaseIdentityText,
  loadReleaseIdentity,
  releaseIdentityRecord,
} from "../scripts/release-identity.mjs";

const roots: string[] = [];

async function fixtureIdentity() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-identity-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "config"));
  await fs.writeFile(
    path.join(root, "config", "release-identity.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      displayName: "CurioTrellis",
      slug: "curiotrellis",
      retiredDisplayNames: ["WonderLab", "ReasonWeave"],
    })}\n`,
  );
  return loadReleaseIdentity({ root });
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("canonical release identity", () => {
  it("binds stored records to the exact identity-config hash", async () => {
    const identity = await fixtureIdentity();
    const record = releaseIdentityRecord(identity);

    expect(assertReleaseIdentityRecord(record, identity)).toEqual(record);
    expect(() =>
      assertReleaseIdentityRecord(
        { ...record, sha256: "f".repeat(64) },
        identity,
      ),
    ).toThrow(/does not match the canonical identity/);
  });

  it("requires current branding and rejects retired names in release text", async () => {
    const identity = await fixtureIdentity();

    expect(
      assertReleaseIdentityText({
        content: "CurioTrellis makes reasoning visible.",
        label: "caption",
        identity,
      }),
    ).toContain("CurioTrellis");
    expect(() =>
      assertReleaseIdentityText({
        content: "CurioTrellis replaces ReasonWeave.",
        label: "caption",
        identity,
      }),
    ).toThrow(/retired release displayName/);
  });
});
