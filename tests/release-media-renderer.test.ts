import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  RELEASE_MEDIA_FILES,
  RELEASE_MEDIA_RECEIPT_FILE,
  RELEASE_MEDIA_RENDER_OUTPUTS,
} from "../scripts/release-media-paths.mjs";
import {
  finalizeScreenshotOutput,
  prepareScreenshotOutput,
  SCREENSHOT_FILENAMES,
  SCREENSHOT_OWNER_FILE,
  writeScreenshotOutput,
} from "../scripts/screenshot-output.mjs";

const rendererPath = path.resolve("scripts/render-release-media.mjs");
const releaseId = "curiotrellis-2026-07-18";
const releaseMediaDirectory = `docs/media/${releaseId}`;
const releaseScreenshot = `docs/screenshots/${releaseId}/discovery-desktop.jpg`;
const publicOgOutput = "public/curiotrellis-og.png";
const screenshotSourceSha = "a".repeat(40);
const roots: string[] = [];

function srtTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},000`;
}

function validReleaseSrt(displayName: string) {
  return `${Array.from({ length: 29 }, (_, index) => {
    const text = `${displayName} learning cue ${String(index + 1).padStart(2, "0")}.`;
    return `${index + 1}\n${srtTimestamp(index * 6)} --> ${srtTimestamp((index + 1) * 6)}\n${text}`;
  }).join("\n\n")}\n`;
}

async function fixtureRoot() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "wonderlab-media-renderer-"),
  );
  roots.push(root);

  const mediaDirectory = path.join(root, releaseMediaDirectory);
  await Promise.all([
    fs.mkdir(mediaDirectory, { recursive: true }),
    fs.mkdir(path.join(root, "docs", "screenshots"), { recursive: true }),
    fs.mkdir(path.join(root, "public"), { recursive: true }),
    fs.mkdir(path.join(root, "config"), { recursive: true }),
  ]);

  await Promise.all([
    fs.writeFile(
      path.join(root, "config", "release-identity.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        displayName: "CurioTrellis",
        slug: "curiotrellis",
        retiredDisplayNames: ["WonderLab", "ReasonWeave"],
      })}\n`,
    ),
    fs.writeFile(
      path.join(mediaDirectory, RELEASE_MEDIA_FILES.proofBoardSvg),
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
        <rect width="1600" height="900" fill="#041f32"/>
        <text x="800" y="450" text-anchor="middle" fill="#fbf8f1" font-family="Arial" font-size="64">CurioTrellis technical proof board</text>
      </svg>`,
    ),
    fs.writeFile(
      path.join(mediaDirectory, RELEASE_MEDIA_FILES.captions),
      validReleaseSrt("CurioTrellis"),
    ),
  ]);
  const screenshotBinding = await prepareScreenshotOutput({
    root,
    configuredOutput: path.dirname(releaseScreenshot),
    sourceSha: screenshotSourceSha,
    sourceStatus: "",
  });
  const discoveryImage = await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 3,
      background: "#d9eeea",
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  for (const [index, filename] of SCREENSHOT_FILENAMES.entries()) {
    await writeScreenshotOutput({
      binding: screenshotBinding,
      filename,
      content:
        filename === "discovery-desktop.jpg"
          ? discoveryImage
          : Buffer.from(`screenshot-${index}-${filename}`),
    });
  }
  await finalizeScreenshotOutput({
    root,
    binding: screenshotBinding,
    endingSourceSha: screenshotSourceSha,
    endingSourceStatus: [
      `?? ${screenshotBinding.relativeOutputPath}/${SCREENSHOT_OWNER_FILE}`,
      ...SCREENSHOT_FILENAMES.map(
        (filename) => `?? ${screenshotBinding.relativeOutputPath}/${filename}`,
      ),
    ].join("\n"),
  });

  return root;
}

function cleanChildEnvironment() {
  const environment = { ...process.env };
  delete environment.WONDERLAB_RELEASE_MEDIA_DIR;
  delete environment.WONDERLAB_RELEASE_SCREENSHOT;
  delete environment.WONDERLAB_PUBLIC_OG_OUTPUT;
  return environment;
}

function render(root: string, environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [rendererPath], {
    cwd: root,
    encoding: "utf8",
    env: environment,
  });
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, entryPath)));
    } else {
      files.push(path.relative(root, entryPath).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

async function sha256(filePath: string) {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("release-media renderer publication boundary", () => {
  it("publishes only fresh versioned outputs and preserves them on rerun", async () => {
    const root = await fixtureRoot();
    const environment = {
      ...cleanChildEnvironment(),
      WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
      WONDERLAB_RELEASE_SCREENSHOT: releaseScreenshot,
      WONDERLAB_PUBLIC_OG_OUTPUT: publicOgOutput,
    };
    const filesBefore = await listFiles(root);

    const firstRun = render(root, environment);

    expect(firstRun.error).toBeUndefined();
    expect(firstRun.status, firstRun.stderr).toBe(0);
    expect(firstRun.stdout).toContain(
      `in ${releaseMediaDirectory} and ${publicOgOutput}`,
    );

    const publishedFiles = [
      ...RELEASE_MEDIA_RENDER_OUTPUTS.map((filename) =>
        path.join(root, releaseMediaDirectory, filename),
      ),
      path.join(root, releaseMediaDirectory, RELEASE_MEDIA_RECEIPT_FILE),
      path.join(root, publicOgOutput),
    ];
    const filesAfterFirstRun = await listFiles(root);
    const addedFiles = filesAfterFirstRun.filter(
      (filename) => !filesBefore.includes(filename),
    );
    expect(addedFiles).toEqual(
      [
        ...RELEASE_MEDIA_RENDER_OUTPUTS.map(
          (filename) => `${releaseMediaDirectory}/${filename}`,
        ),
        `${releaseMediaDirectory}/${RELEASE_MEDIA_RECEIPT_FILE}`,
        publicOgOutput,
      ].sort(),
    );
    await expect(
      fs.readFile(
        path.join(root, releaseMediaDirectory, RELEASE_MEDIA_RECEIPT_FILE),
        "utf8",
      ),
    ).resolves.toContain('"displayName": "CurioTrellis"');

    for (const filename of RELEASE_MEDIA_RENDER_OUTPUTS) {
      await expect(
        fs.lstat(path.join(root, "docs", "media", filename)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
    await expect(
      fs.lstat(path.join(root, "public", "reasonweave-og.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const hashesBeforeRerun = new Map(
      await Promise.all(
        publishedFiles.map(
          async (filePath) => [filePath, await sha256(filePath)] as const,
        ),
      ),
    );

    const rerun = render(root, environment);

    expect(rerun.status).not.toBe(0);
    expect(`${rerun.stderr}\n${rerun.stdout}`).toMatch(/already exists/);
    expect(await listFiles(root)).toEqual(filesAfterFirstRun);
    for (const filePath of publishedFiles) {
      expect(await sha256(filePath)).toBe(hashesBeforeRerun.get(filePath));
    }
  }, 30_000);

  it("rejects retired brand text before publishing any output", async () => {
    const root = await fixtureRoot();
    const environment = {
      ...cleanChildEnvironment(),
      WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
      WONDERLAB_RELEASE_SCREENSHOT: releaseScreenshot,
      WONDERLAB_PUBLIC_OG_OUTPUT: publicOgOutput,
    };
    await fs.writeFile(
      path.join(root, releaseMediaDirectory, RELEASE_MEDIA_FILES.captions),
      "1\n00:00:00,000 --> 00:00:02,000\nReasonWeave stale narration.\n",
    );
    const filesBefore = await listFiles(root);

    const result = render(root, environment);

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toMatch(
      /must include the canonical release displayName|must not include a retired release displayName/,
    );
    expect(await listFiles(root)).toEqual(filesBefore);
  });

  it("rejects structurally invalid captions before rendering or publishing outputs", async () => {
    const root = await fixtureRoot();
    const environment = {
      ...cleanChildEnvironment(),
      WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
      WONDERLAB_RELEASE_SCREENSHOT: releaseScreenshot,
      WONDERLAB_PUBLIC_OG_OUTPUT: publicOgOutput,
    };
    await fs.writeFile(
      path.join(root, releaseMediaDirectory, RELEASE_MEDIA_FILES.captions),
      "1\n00:00:00,000 --> 00:00:06,000\nCurioTrellis invalid release cue.\n",
    );
    const filesBefore = await listFiles(root);

    const result = render(root, environment);

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain(
      "Captions must use at least 20 readable cues.",
    );
    expect(await listFiles(root)).toEqual(filesBefore);
  });

  it("rejects a proof board with wrong dimensions before publishing outputs", async () => {
    const root = await fixtureRoot();
    const environment = {
      ...cleanChildEnvironment(),
      WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
      WONDERLAB_RELEASE_SCREENSHOT: releaseScreenshot,
      WONDERLAB_PUBLIC_OG_OUTPUT: publicOgOutput,
    };
    await fs.writeFile(
      path.join(root, releaseMediaDirectory, RELEASE_MEDIA_FILES.proofBoardSvg),
      `<svg xmlns="http://www.w3.org/2000/svg" width="1599" height="900" viewBox="0 0 1599 900">
        <text x="800" y="450">CurioTrellis proof board</text>
      </svg>`,
    );
    const filesBefore = await listFiles(root);

    const result = render(root, environment);

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain(
      "The proof board must be a 1600x900 PNG.",
    );
    expect(await listFiles(root)).toEqual(filesBefore);
  });

  it("rejects a partial release contract before writing outputs", async () => {
    const root = await fixtureRoot();
    const filesBefore = await listFiles(root);
    const partialEnvironment = {
      ...cleanChildEnvironment(),
      WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
    };

    const result = render(root, partialEnvironment);

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toMatch(
      /requires WONDERLAB_RELEASE_MEDIA_DIR, WONDERLAB_RELEASE_SCREENSHOT, and WONDERLAB_PUBLIC_OG_OUTPUT together/,
    );
    expect(await listFiles(root)).toEqual(filesBefore);
  });
});
