import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertReleaseMediaInputsMatchReceipt,
  assertReleaseMediaDirectoryIdentity,
  RELEASE_MEDIA_FILES,
  RELEASE_MEDIA_RECEIPT_FILE,
  RELEASE_MEDIA_RENDER_OUTPUTS,
  resolveReleaseMediaPaths,
} from "../scripts/release-media-paths.mjs";
import { readAnchoredFiles } from "../scripts/anchored-directory-ops.mjs";
import { releaseIdentityRecord } from "../scripts/release-identity.mjs";
import {
  finalizeScreenshotOutput,
  prepareScreenshotOutput,
  SCREENSHOT_FILENAMES,
  SCREENSHOT_OWNER_FILE,
  writeScreenshotOutput,
} from "../scripts/screenshot-output.mjs";

const roots: string[] = [];
const releaseId = "curiotrellis-2026-07-18";
const releaseMediaDirectory = `docs/media/${releaseId}`;
const publicOgOutput = "public/curiotrellis-og.png";
const screenshotSourceSha = "a".repeat(40);

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-media-"));
  roots.push(root);
  await Promise.all([
    fs.mkdir(path.join(root, "docs", "media", releaseId), {
      recursive: true,
    }),
    fs.mkdir(path.join(root, "docs", "screenshots"), {
      recursive: true,
    }),
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
      path.join(
        root,
        "docs",
        "media",
        releaseId,
        RELEASE_MEDIA_FILES.proofBoardSvg,
      ),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>CurioTrellis proof</text></svg>',
    ),
    fs.writeFile(
      path.join(root, "docs", "media", releaseId, RELEASE_MEDIA_FILES.captions),
      "1\n00:00:00,000 --> 00:00:01,000\nCurioTrellis test narration.\n",
    ),
  ]);
  const screenshotBinding = await prepareScreenshotOutput({
    root,
    configuredOutput: `docs/screenshots/${releaseId}`,
    sourceSha: screenshotSourceSha,
    sourceStatus: "",
  });
  for (const [index, filename] of SCREENSHOT_FILENAMES.entries()) {
    await writeScreenshotOutput({
      binding: screenshotBinding,
      filename,
      content: Buffer.from(`image-${index}-${filename}`),
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

async function sha256Record(filePath: string, recordPath: string) {
  const content = await fs.readFile(filePath);
  return {
    path: recordPath,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

async function publishFixtureReleaseReceipt(root: string) {
  const binding = await resolveReleaseMediaPaths({
    root,
    environment: renderEnvironment(),
    mode: "render",
    requiredFiles: [
      RELEASE_MEDIA_FILES.proofBoardSvg,
      RELEASE_MEDIA_FILES.captions,
    ],
  });
  for (const filename of RELEASE_MEDIA_RENDER_OUTPUTS) {
    await fs.writeFile(
      path.join(root, releaseMediaDirectory, filename),
      `CurioTrellis ${filename}`,
    );
  }
  await fs.writeFile(
    path.join(root, publicOgOutput),
    "CurioTrellis public social image",
  );
  const mediaFiles = [];
  for (const filename of Object.values(RELEASE_MEDIA_FILES)) {
    mediaFiles.push({
      filename,
      ...(await sha256Record(
        path.join(root, releaseMediaDirectory, filename),
        `${releaseMediaDirectory}/${filename}`,
      )),
    });
  }
  const receipt = {
    schemaVersion: 1,
    kind: "wonderlab-release-media-receipt",
    generatedAt: "2026-07-18T12:00:00.000Z",
    releaseDirectory: releaseId,
    releaseIdentity: releaseIdentityRecord(binding.releaseIdentity),
    screenshotEvidence: binding.screenshotEvidence,
    mediaFiles,
    publicOg: await sha256Record(
      path.join(root, publicOgOutput),
      publicOgOutput,
    ),
  };
  await fs.writeFile(
    path.join(root, releaseMediaDirectory, RELEASE_MEDIA_RECEIPT_FILE),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
}

function renderEnvironment(overrides: Record<string, string> = {}) {
  return {
    WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
    WONDERLAB_RELEASE_SCREENSHOT: `docs/screenshots/${releaseId}/discovery-desktop.jpg`,
    WONDERLAB_PUBLIC_OG_OUTPUT: "public/curiotrellis-og.png",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("release-media path contract", () => {
  it("resolves a complete versioned render contract", async () => {
    const root = await fixtureRoot();
    const binding = await resolveReleaseMediaPaths({
      root,
      environment: renderEnvironment(),
      mode: "render",
      requiredFiles: [
        RELEASE_MEDIA_FILES.proofBoardSvg,
        RELEASE_MEDIA_FILES.captions,
      ],
    });

    expect(binding.relativeMediaDir).toBe(`docs/media/${releaseId}`);
    expect(binding.releaseScreenshot).toBe(
      path.join(
        root,
        "docs",
        "screenshots",
        releaseId,
        "discovery-desktop.jpg",
      ),
    );
    expect(binding.relativePublicOgOutput).toBe("public/curiotrellis-og.png");
    expect(binding.screenshotEvidence).toMatchObject({
      sourceSha: screenshotSourceSha,
      receiptPath: `docs/screenshots/${releaseId}/screenshot-receipt.json`,
    });
  });

  it("requires an intact source-bound screenshot receipt", async () => {
    const root = await fixtureRoot();
    await fs.rm(
      path.join(
        root,
        "docs",
        "screenshots",
        releaseId,
        "screenshot-receipt.json",
      ),
    );
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: renderEnvironment(),
        mode: "render",
      }),
    ).rejects.toThrow(/Screenshot receipt/);

    const secondRoot = await fixtureRoot();
    await fs.appendFile(
      path.join(
        secondRoot,
        "docs",
        "screenshots",
        releaseId,
        "discovery-desktop.jpg",
      ),
      "tampered",
    );
    await expect(
      resolveReleaseMediaPaths({
        root: secondRoot,
        environment: renderEnvironment(),
        mode: "render",
      }),
    ).rejects.toThrow(/no longer matches its recorded bytes and hash/);
  });

  it.each([
    {},
    { WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${releaseId}` },
    {
      WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${releaseId}`,
      WONDERLAB_RELEASE_SCREENSHOT: `docs/screenshots/${releaseId}/discovery-desktop.jpg`,
    },
  ])("rejects a partial render contract: %j", async (environment) => {
    const root = await fixtureRoot();
    await expect(
      resolveReleaseMediaPaths({ root, environment, mode: "render" }),
    ).rejects.toThrow(/requires WONDERLAB_RELEASE_MEDIA_DIR/);
  });

  it.each([
    "docs/media",
    "docs/media/../release",
    "docs/media/nested/release",
    "docs\\media\\release",
    "/tmp/release",
    "docs/media/UPPERCASE",
    " docs/media/release",
  ])("rejects an unsafe media directory: %s", async (mediaDir) => {
    const root = await fixtureRoot();
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: renderEnvironment({
          WONDERLAB_RELEASE_MEDIA_DIR: mediaDir,
        }),
        mode: "render",
      }),
    ).rejects.toThrow(/WONDERLAB_RELEASE_MEDIA_DIR/);
  });

  it("rejects a versioned directory that does not use the canonical slug", async () => {
    const root = await fixtureRoot();
    const wrongReleaseId = "reasonweave-2026-07-18";
    await fs.mkdir(path.join(root, "docs", "media", wrongReleaseId));

    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: renderEnvironment({
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${wrongReleaseId}`,
        }),
        mode: "render",
      }),
    ).rejects.toThrow(/canonical release slug/);
  });

  it("rejects mismatched, historical, nested, and symlinked screenshots", async () => {
    const root = await fixtureRoot();
    for (const screenshot of [
      "docs/screenshots/discovery-desktop.jpg",
      "docs/screenshots/other-release/discovery-desktop.jpg",
      `docs/screenshots/${releaseId}/nested/discovery-desktop.jpg`,
    ]) {
      await expect(
        resolveReleaseMediaPaths({
          root,
          environment: renderEnvironment({
            WONDERLAB_RELEASE_SCREENSHOT: screenshot,
          }),
          mode: "render",
        }),
      ).rejects.toThrow(/WONDERLAB_RELEASE_SCREENSHOT/);
    }

    const screenshot = path.join(
      root,
      "docs",
      "screenshots",
      releaseId,
      "discovery-desktop.jpg",
    );
    await fs.rm(screenshot);
    await fs.symlink(
      path.join(root, "docs", "media", releaseId, RELEASE_MEDIA_FILES.captions),
      screenshot,
    );
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: renderEnvironment(),
        mode: "render",
      }),
    ).rejects.toThrow(/non-empty regular file/);
  });

  it.each([
    "public/reasonweave-og.png",
    "public/nested/curiotrellis-og.png",
    "../public/curiotrellis-og.png",
    "/tmp/curiotrellis-og.png",
    "public/CurioTrellis-og.png",
  ])("rejects an unsafe public OG output: %s", async (ogOutput) => {
    const root = await fixtureRoot();
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: renderEnvironment({
          WONDERLAB_PUBLIC_OG_OUTPUT: ogOutput,
        }),
        mode: "render",
      }),
    ).rejects.toThrow(/WONDERLAB_PUBLIC_OG_OUTPUT/);
  });

  it("rejects every existing render output without changing it", async () => {
    for (const filename of [
      ...RELEASE_MEDIA_RENDER_OUTPUTS,
      "curiotrellis-og.png",
    ]) {
      const root = await fixtureRoot();
      const filePath = filename.endsWith("-og.png")
        ? path.join(root, "public", filename)
        : path.join(root, "docs", "media", releaseId, filename);
      await fs.writeFile(filePath, "preserve-me");
      await expect(
        resolveReleaseMediaPaths({
          root,
          environment: renderEnvironment(),
          mode: "render",
        }),
      ).rejects.toThrow(/already exists/);
      expect(await fs.readFile(filePath, "utf8")).toBe("preserve-me");
    }
  });

  it("preserves the legacy media-read default and accepts a versioned override", async () => {
    const root = await fixtureRoot();
    await fs.writeFile(
      path.join(root, "docs", "media", RELEASE_MEDIA_FILES.captions),
      "legacy captions",
    );
    const legacy = await resolveReleaseMediaPaths({
      root,
      environment: {},
      mode: "media-read",
      requiredFiles: [RELEASE_MEDIA_FILES.captions],
    });
    expect(legacy.relativeMediaDir).toBe("docs/media");

    await publishFixtureReleaseReceipt(root);
    const versioned = await resolveReleaseMediaPaths({
      root,
      environment: {
        WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${releaseId}`,
      },
      mode: "media-read",
      requiredFiles: [RELEASE_MEDIA_FILES.captions],
    });
    expect(versioned.relativeMediaDir).toBe(`docs/media/${releaseId}`);
  });

  it("requires a receipt-bound release before versioned media reads", async () => {
    const root = await fixtureRoot();

    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: {
          WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
        },
        mode: "media-read",
        requiredFiles: [RELEASE_MEDIA_FILES.captions],
      }),
    ).rejects.toThrow(/Release media receipt/);
  });

  it("rejects a receipt-bound media file changed on disk", async () => {
    const root = await fixtureRoot();
    await publishFixtureReleaseReceipt(root);
    await fs.appendFile(
      path.join(root, releaseMediaDirectory, RELEASE_MEDIA_FILES.captions),
      "tampered after receipt publication",
    );

    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: {
          WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
        },
        mode: "media-read",
        requiredFiles: [RELEASE_MEDIA_FILES.captions],
        requireCurrentRelease: true,
      }),
    ).rejects.toThrow(/no longer matches its release media receipt/);
  });

  it("rejects an anchored media snapshot that diverges from its validated receipt", async () => {
    const root = await fixtureRoot();
    await publishFixtureReleaseReceipt(root);
    const binding = await resolveReleaseMediaPaths({
      root,
      environment: {
        WONDERLAB_RELEASE_MEDIA_DIR: releaseMediaDirectory,
      },
      mode: "media-read",
      requiredFiles: [RELEASE_MEDIA_FILES.captions],
    });
    const inputs = await readAnchoredFiles({
      anchor: {
        path: binding.mediaDir,
        realPath: binding.mediaReal,
        dev: binding.identity.dev,
        ino: binding.identity.ino,
        message: "Release media directory changed during anchored test read.",
      },
      filenames: [RELEASE_MEDIA_FILES.captions],
    });

    expect(
      assertReleaseMediaInputsMatchReceipt({
        binding,
        inputs,
        filenames: [RELEASE_MEDIA_FILES.captions],
      }),
    ).toBe(inputs);
    expect(() =>
      assertReleaseMediaInputsMatchReceipt({
        binding,
        inputs: {
          ...inputs,
          [RELEASE_MEDIA_FILES.captions]: {
            ...inputs[RELEASE_MEDIA_FILES.captions],
            content: Buffer.from("tampered caption snapshot"),
          },
        },
        filenames: [RELEASE_MEDIA_FILES.captions],
      }),
    ).toThrow(/does not match its validated release media receipt/);
  });

  it("rejects symlinked media directories and required inputs", async () => {
    const root = await fixtureRoot();
    const cleanBinding = await resolveReleaseMediaPaths({
      root,
      environment: renderEnvironment(),
      mode: "render",
      requiredFiles: [
        RELEASE_MEDIA_FILES.proofBoardSvg,
        RELEASE_MEDIA_FILES.captions,
      ],
    });
    const mediaDir = path.join(root, "docs", "media", releaseId);
    const outside = path.join(root, "outside-media");
    await fs.mkdir(outside);
    await fs.rm(mediaDir, { recursive: true });
    await fs.symlink(outside, mediaDir);
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: {
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${releaseId}`,
        },
        mode: "media-read",
      }),
    ).rejects.toThrow(/real directory/);

    await fs.rm(mediaDir);
    await fs.mkdir(mediaDir);
    await fs.writeFile(
      path.join(mediaDir, RELEASE_MEDIA_FILES.proofBoardSvg),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>CurioTrellis proof</text></svg>',
    );
    for (const filename of RELEASE_MEDIA_RENDER_OUTPUTS) {
      await fs.writeFile(
        path.join(mediaDir, filename),
        `CurioTrellis ${filename}`,
      );
    }
    const outsideCaptions = path.join(outside, "captions.srt");
    await fs.writeFile(outsideCaptions, "CurioTrellis captions");
    await fs.symlink(
      outsideCaptions,
      path.join(mediaDir, RELEASE_MEDIA_FILES.captions),
    );
    await fs.writeFile(
      path.join(root, publicOgOutput),
      "CurioTrellis public social image",
    );
    const mediaFiles = [];
    for (const filename of Object.values(RELEASE_MEDIA_FILES)) {
      const content = await fs.readFile(path.join(mediaDir, filename));
      mediaFiles.push({
        filename,
        path: `${releaseMediaDirectory}/${filename}`,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    }
    await fs.writeFile(
      path.join(mediaDir, RELEASE_MEDIA_RECEIPT_FILE),
      `${JSON.stringify({
        schemaVersion: 1,
        kind: "wonderlab-release-media-receipt",
        generatedAt: "2026-07-18T12:00:00.000Z",
        releaseDirectory: releaseId,
        releaseIdentity: releaseIdentityRecord(cleanBinding.releaseIdentity),
        screenshotEvidence: cleanBinding.screenshotEvidence,
        mediaFiles,
        publicOg: await sha256Record(
          path.join(root, publicOgOutput),
          publicOgOutput,
        ),
      })}\n`,
    );
    await expect(
      resolveReleaseMediaPaths({
        root,
        environment: {
          WONDERLAB_RELEASE_MEDIA_DIR: `docs/media/${releaseId}`,
        },
        mode: "media-read",
        requiredFiles: [RELEASE_MEDIA_FILES.captions],
      }),
    ).rejects.toThrow(/non-empty regular file/);
  });

  it("detects a replaced public directory before publication", async () => {
    const root = await fixtureRoot();
    const binding = await resolveReleaseMediaPaths({
      root,
      environment: renderEnvironment(),
      mode: "render",
    });
    const publicDirectory = path.join(root, "public");
    const anchoredPublicDirectory = path.join(root, "public-anchored");
    const outsideDirectory = path.join(root, "outside-public");
    await fs.rename(publicDirectory, anchoredPublicDirectory);
    await fs.mkdir(outsideDirectory);
    await fs.symlink(outsideDirectory, publicDirectory);

    await expect(assertReleaseMediaDirectoryIdentity(binding)).rejects.toThrow(
      /public output directory changed/,
    );
    expect(await fs.readdir(outsideDirectory)).toEqual([]);
  });
});
