import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import releaseIdentity from "@/config/release-identity.json";
import {
  discoveryCardProofPath,
  validatedExternalBaseUrl,
} from "@/scripts/capture-inputs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedDiscoveryCardFilename = `${releaseIdentity.slug}-learning-trace.md`;

describe("capture external URL boundary", () => {
  it("accepts HTTP(S), normalizes the URL, and removes one trailing slash", () => {
    expect(validatedExternalBaseUrl(" HTTPS://Example.COM/wonderlab/ ")).toBe(
      "https://example.com/wonderlab",
    );
    expect(validatedExternalBaseUrl("http://127.0.0.1:3107/")).toBe(
      "http://127.0.0.1:3107",
    );
    expect(validatedExternalBaseUrl("   ")).toBeUndefined();
  });

  it.each([
    "ftp://example.com/wonderlab",
    "https://user@example.com/wonderlab",
    "https://example.com/wonderlab?token=secret",
    "https://example.com/wonderlab#secret",
    "not a URL",
  ])("rejects an unsafe external URL without reflecting it: %s", (value) => {
    expect(() => validatedExternalBaseUrl(value)).toThrow(
      "WONDERLAB_CAPTURE_BASE_URL must be a valid HTTP(S) URL",
    );

    try {
      validatedExternalBaseUrl(value);
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  });

  it("fails before capture work and does not disclose URL credentials", () => {
    const secret = "capture-secret-value";
    const outputName = `capture-url-negative-${process.pid}`;
    const outputPath = path.join(root, "output", "playwright", outputName);
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "capture-seeded-demo.mjs")],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          WONDERLAB_CAPTURE_BASE_URL: `https://capture:${secret}@example.com/wonderlab?token=${secret}`,
          WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${outputName}`,
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("WONDERLAB_CAPTURE_BASE_URL must be a valid");
    expect(output).not.toContain(secret);
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});

describe("capture download filename boundary", () => {
  it("allows only the fixed basename inside capture staging", () => {
    const stagingDir = path.join(root, "output", "playwright", "staging");
    expect(
      discoveryCardProofPath(
        stagingDir,
        expectedDiscoveryCardFilename,
        expectedDiscoveryCardFilename,
      ),
    ).toBe(path.join(stagingDir, expectedDiscoveryCardFilename));
  });

  it.each([
    "../reasonweave-learning-trace.md",
    "nested/reasonweave-learning-trace.md",
    "nested\\reasonweave-learning-trace.md",
    "/tmp/reasonweave-learning-trace.md",
    "reasonweave-learning-trace-2.md",
    "reasonweave-learning-trace.md.txt",
  ])("rejects an untrusted suggested filename: %s", (value) => {
    expect(() =>
      discoveryCardProofPath(
        "/tmp/staging",
        value,
        expectedDiscoveryCardFilename,
      ),
    ).toThrow(
      `Discovery Card export must use the canonical release filename ${expectedDiscoveryCardFilename}`,
    );
  });
});
