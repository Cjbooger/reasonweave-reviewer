import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  finalizeScreenshotOutput,
  prepareScreenshotOutput,
  SCREENSHOT_FILENAMES,
  SCREENSHOT_OWNER_FILE,
  SCREENSHOT_RECEIPT_FILE,
  writeScreenshotOutput,
} from "../scripts/screenshot-output.mjs";

const roots: string[] = [];
const sourceSha = "a".repeat(40);
const releaseIdentity = {
  schemaVersion: 1,
  displayName: "ReasonWeave",
  slug: "reasonweave",
  retiredDisplayNames: ["WonderLab"],
};

async function writeReleaseIdentity(root: string) {
  await fs.mkdir(path.join(root, "config"), { recursive: true });
  await fs.writeFile(
    path.join(root, "config", "release-identity.json"),
    `${JSON.stringify(releaseIdentity, null, 2)}\n`,
  );
}

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-shots-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "docs", "screenshots"), { recursive: true });
  await writeReleaseIdentity(root);
  return root;
}

function screenshotBytes(index: number) {
  return Buffer.from([0xff, 0xd8, 0xff, index + 1]);
}

async function writeAllScreenshots(
  binding: Awaited<ReturnType<typeof prepareScreenshotOutput>>,
) {
  for (const [index, filename] of SCREENSHOT_FILENAMES.entries()) {
    await writeScreenshotOutput({
      binding,
      filename,
      content: screenshotBytes(index),
    });
  }
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("versioned screenshot output", () => {
  it("creates one fresh direct child with fixed distinct screenshot paths", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });

    expect(binding.relativeOutputPath).toBe(
      "docs/screenshots/reasonweave-2026-07-18",
    );
    expect(Object.keys(binding.paths)).toEqual(SCREENSHOT_FILENAMES);
    expect(new Set(Object.values(binding.paths)).size).toBe(8);
    for (const filename of SCREENSHOT_FILENAMES) {
      expect((await fs.lstat(binding.paths[filename])).size).toBe(0);
    }
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(binding.outputDir, SCREENSHOT_OWNER_FILE),
          "utf8",
        ),
      ),
    ).toMatchObject({
      owner: "wonderlab-screenshot-output-v1",
      sourceSha,
      releaseIdentity: { displayName: "ReasonWeave", slug: "reasonweave" },
    });
  });

  it.each([
    undefined,
    "",
    " docs/screenshots/release",
    "docs/screenshots/release ",
    "docs/screenshots",
    "docs/screenshots/../release",
    "docs/screenshots/nested/release",
    "docs\\screenshots\\release",
    "/tmp/release",
    "docs/screenshots/UPPERCASE",
    "docs/screenshots/.hidden",
  ])("rejects an unsafe configured directory: %s", async (configuredOutput) => {
    const root = await fixtureRoot();
    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput,
        sourceSha,
        sourceStatus: "",
      }),
    ).rejects.toThrow(/WONDERLAB_SCREENSHOT_OUTPUT/);
  });

  it("rejects a release directory that does not begin with the canonical slug", async () => {
    const root = await fixtureRoot();
    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput: "docs/screenshots/curiotrellis-2026-07-18",
        sourceSha,
        sourceStatus: "",
      }),
    ).rejects.toThrow(/canonical release slug/);
  });

  it("rejects a dirty source before creating output", async () => {
    const root = await fixtureRoot();
    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
        sourceSha,
        sourceStatus: " M app/page.tsx",
      }),
    ).rejects.toThrow(/clean Git worktree/);
    await expect(
      fs.lstat(
        path.join(root, "docs", "screenshots", "reasonweave-2026-07-18"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an existing directory or symlink without modifying it", async () => {
    const root = await fixtureRoot();
    const screenshotsRoot = path.join(root, "docs", "screenshots");
    await fs.mkdir(path.join(screenshotsRoot, "reasonweave-existing-release"));
    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput: "docs/screenshots/reasonweave-existing-release",
        sourceSha,
        sourceStatus: "",
      }),
    ).rejects.toThrow(/must not already exist/);

    const outside = path.join(root, "outside");
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(screenshotsRoot, "reasonweave-linked-release"),
    );
    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput: "docs/screenshots/reasonweave-linked-release",
        sourceSha,
        sourceStatus: "",
      }),
    ).rejects.toThrow(/must not already exist/);
  });

  it("rejects a symlinked screenshot root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-shots-"));
    roots.push(root);
    const realRoot = path.join(root, "real-screenshots");
    await fs.mkdir(realRoot, { recursive: true });
    await fs.mkdir(path.join(root, "docs"));
    await writeReleaseIdentity(root);
    await fs.symlink(realRoot, path.join(root, "docs", "screenshots"));

    await expect(
      prepareScreenshotOutput({
        root,
        configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
        sourceSha,
        sourceStatus: "",
      }),
    ).rejects.toThrow(/docs\/screenshots must be a real directory/);
  });

  it("publishes a source-bound receipt for exactly eight regular JPGs", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    await writeAllScreenshots(binding);
    const endingSourceStatus = [
      `?? ${binding.relativeOutputPath}/${SCREENSHOT_OWNER_FILE}`,
      ...SCREENSHOT_FILENAMES.map(
        (filename) => `?? ${binding.relativeOutputPath}/${filename}`,
      ),
    ].join("\n");

    const receipt = await finalizeScreenshotOutput({
      root,
      binding,
      endingSourceSha: sourceSha,
      endingSourceStatus,
    });
    expect(receipt.screenshots).toHaveLength(8);
    expect(receipt.releaseIdentity).toMatchObject({
      displayName: "ReasonWeave",
      slug: "reasonweave",
    });
    expect(receipt.screenshots[0]).toMatchObject({
      bytes: 4,
      sha256: createHash("sha256").update(screenshotBytes(0)).digest("hex"),
    });
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(binding.outputDir, SCREENSHOT_RECEIPT_FILE),
          "utf8",
        ),
      ),
    ).toEqual(receipt);
  });

  it("fails closed on source drift, extra files, and symlinked screenshots", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    await writeAllScreenshots(binding);
    const status = SCREENSHOT_FILENAMES.map(
      (filename) => `?? ${binding.relativeOutputPath}/${filename}`,
    ).join("\n");

    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: "b".repeat(40),
        endingSourceStatus: status,
      }),
    ).rejects.toThrow(/source SHA changed/);

    await fs.writeFile(path.join(binding.outputDir, "extra.txt"), "extra");
    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: sourceSha,
        endingSourceStatus: status,
      }),
    ).rejects.toThrow(/exactly the ownership marker and eight required JPGs/);
    await fs.rm(path.join(binding.outputDir, "extra.txt"));

    await fs.rm(binding.paths[SCREENSHOT_FILENAMES[0]]);
    await fs.symlink(
      binding.paths[SCREENSHOT_FILENAMES[1]],
      binding.paths[SCREENSHOT_FILENAMES[0]],
    );
    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: sourceSha,
        endingSourceStatus: status,
      }),
    ).rejects.toThrow(/non-empty regular file/);
  });

  it("rejects tracked or unrelated changes after capture", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    await writeAllScreenshots(binding);

    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: sourceSha,
        endingSourceStatus: " M scripts/screenshot-output.mjs",
      }),
    ).rejects.toThrow(/changed outside/);
  });

  it("refuses a replaced output directory before writing any capture bytes", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    const anchoredDirectory = `${binding.outputDir}-anchored`;
    await fs.rename(binding.outputDir, anchoredDirectory);
    await fs.mkdir(binding.outputDir);

    await expect(
      writeScreenshotOutput({
        binding,
        filename: SCREENSHOT_FILENAMES[0],
        content: screenshotBytes(0),
      }),
    ).rejects.toThrow(/output directory changed/);
    expect(await fs.readdir(binding.outputDir)).toEqual([]);
    expect(
      (await fs.lstat(path.join(anchoredDirectory, SCREENSHOT_FILENAMES[0])))
        .size,
    ).toBe(0);
  });

  it("rejects a screenshot changed after its reserved capture write", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    await writeAllScreenshots(binding);
    await fs.writeFile(binding.paths[SCREENSHOT_FILENAMES[0]], "tampered");
    const status = SCREENSHOT_FILENAMES.map(
      (filename) => `?? ${binding.relativeOutputPath}/${filename}`,
    ).join("\n");

    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: sourceSha,
        endingSourceStatus: status,
      }),
    ).rejects.toThrow(/changed after its reserved capture write/);
  });

  it("never publishes a receipt through a replaced output directory", async () => {
    const root = await fixtureRoot();
    const binding = await prepareScreenshotOutput({
      root,
      configuredOutput: "docs/screenshots/reasonweave-2026-07-18",
      sourceSha,
      sourceStatus: "",
    });
    await writeAllScreenshots(binding);
    const status = SCREENSHOT_FILENAMES.map(
      (filename) => `?? ${binding.relativeOutputPath}/${filename}`,
    ).join("\n");
    const anchoredDirectory = `${binding.outputDir}-anchored`;
    await fs.rename(binding.outputDir, anchoredDirectory);
    await fs.mkdir(binding.outputDir);

    await expect(
      finalizeScreenshotOutput({
        root,
        binding,
        endingSourceSha: sourceSha,
        endingSourceStatus: status,
      }),
    ).rejects.toThrow(/output directory changed/);
    expect(await fs.readdir(binding.outputDir)).toEqual([]);
    await expect(
      fs.lstat(path.join(binding.outputDir, SCREENSHOT_RECEIPT_FILE)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.lstat(path.join(anchoredDirectory, SCREENSHOT_RECEIPT_FILE)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
