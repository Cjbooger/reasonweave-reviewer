import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupAnchoredDirectory,
  createDirectoryAnchor,
  readAnchoredFiles,
  withAnchoredDirectory,
  writeExclusiveAnchoredFile,
} from "../scripts/anchored-directory-ops.mjs";

const roots: string[] = [];

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wonderlab-anchor-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("anchored directory operations", () => {
  it("keeps a relative write on the anchored inode after its public path is replaced", async () => {
    const root = await fixtureRoot();
    const publicDirectory = path.join(root, "public");
    const anchoredPublic = path.join(root, "public-anchored");
    await fs.mkdir(publicDirectory);
    const anchor = await createDirectoryAnchor(
      publicDirectory,
      "The public directory changed.",
    );

    await withAnchoredDirectory(anchor, async () => {
      await fs.rename(publicDirectory, anchoredPublic);
      await fs.mkdir(publicDirectory);
      await fs.writeFile("anchored.txt", "safe");
    });

    expect(
      await fs.readFile(path.join(anchoredPublic, "anchored.txt"), "utf8"),
    ).toBe("safe");
    expect(await fs.readdir(publicDirectory)).toEqual([]);
  });

  it("refuses exclusive publication through a replacement directory", async () => {
    const root = await fixtureRoot();
    const publicDirectory = path.join(root, "public");
    const outside = path.join(root, "outside");
    await fs.mkdir(publicDirectory);
    await fs.mkdir(outside);
    const anchor = await createDirectoryAnchor(
      publicDirectory,
      "The public directory changed.",
    );
    await fs.rename(publicDirectory, path.join(root, "public-anchored"));
    await fs.symlink(outside, publicDirectory);

    await expect(
      writeExclusiveAnchoredFile({
        anchor,
        filename: "candidate-og.png",
        content: Buffer.from("image"),
      }),
    ).rejects.toThrow(/public directory changed/);
    expect(await fs.readdir(outside)).toEqual([]);
  });

  it("reads and cleans only the anchored staging directory", async () => {
    const root = await fixtureRoot();
    const parent = path.join(root, "media");
    const staging = path.join(parent, ".wonderlab-media-staging-test");
    await fs.mkdir(staging, { recursive: true });
    await fs.writeFile(path.join(staging, "asset.png"), "asset");
    const parentAnchor = await createDirectoryAnchor(
      parent,
      "The media directory changed.",
    );
    const stagingAnchor = await createDirectoryAnchor(
      staging,
      "The staging directory changed.",
    );
    const files = await readAnchoredFiles({
      anchor: stagingAnchor,
      filenames: ["asset.png"],
    });

    await cleanupAnchoredDirectory({
      parentAnchor,
      directoryAnchor: stagingAnchor,
      expectedFiles: [
        {
          filename: "asset.png",
          dev: files["asset.png"].dev,
          ino: files["asset.png"].ino,
        },
      ],
    });
    await expect(fs.lstat(staging)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not clean a replacement media tree", async () => {
    const root = await fixtureRoot();
    const parent = path.join(root, "media");
    const stagingName = ".wonderlab-media-staging-test";
    const staging = path.join(parent, stagingName);
    await fs.mkdir(staging, { recursive: true });
    await fs.writeFile(path.join(staging, "asset.png"), "asset");
    const parentAnchor = await createDirectoryAnchor(
      parent,
      "The media directory changed.",
    );
    const stagingAnchor = await createDirectoryAnchor(
      staging,
      "The staging directory changed.",
    );
    const files = await readAnchoredFiles({
      anchor: stagingAnchor,
      filenames: ["asset.png"],
    });
    const anchoredParent = `${parent}-anchored`;
    await fs.rename(parent, anchoredParent);
    await fs.mkdir(path.join(parent, stagingName), { recursive: true });
    await fs.writeFile(path.join(parent, stagingName, "victim.txt"), "keep");

    await expect(
      cleanupAnchoredDirectory({
        parentAnchor,
        directoryAnchor: stagingAnchor,
        expectedFiles: [
          {
            filename: "asset.png",
            dev: files["asset.png"].dev,
            ino: files["asset.png"].ino,
          },
        ],
      }),
    ).rejects.toThrow();
    expect(
      await fs.readFile(path.join(parent, stagingName, "victim.txt"), "utf8"),
    ).toBe("keep");
    expect(
      await fs.readFile(
        path.join(anchoredParent, stagingName, "asset.png"),
        "utf8",
      ),
    ).toBe("asset");
  });
});
