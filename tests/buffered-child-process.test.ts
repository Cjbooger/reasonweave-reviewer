import { mkdtemp, mkdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDirectoryAnchor,
  readAnchoredFiles,
} from "../scripts/anchored-directory-ops.mjs";
import { runBufferedChildProcess } from "../scripts/buffered-child-process.mjs";

describe("buffered child-process input", () => {
  it("delivers the captured bytes after the public source directory is replaced", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "wonderlab-buffered-child-"),
    );
    const publicDirectory = path.join(root, "release-media");
    const parkedDirectory = path.join(root, "release-media-parked");
    const filename = "proof-board.png";
    const original = Buffer.from("receipt-bound original media");
    const replacement = Buffer.from("replacement media");
    await mkdir(publicDirectory);
    await writeFile(path.join(publicDirectory, filename), original);

    const anchor = await createDirectoryAnchor(
      publicDirectory,
      "The selected test media directory changed.",
    );
    const captured = await readAnchoredFiles({
      anchor,
      filenames: [filename],
    });

    await rename(publicDirectory, parkedDirectory);
    await mkdir(publicDirectory);
    await writeFile(path.join(publicDirectory, filename), replacement);

    const result = runBufferedChildProcess(
      process.execPath,
      [
        "-e",
        "const chunks=[];process.stdin.on('data',chunk=>chunks.push(chunk));process.stdin.on('end',()=>process.stdout.write(Buffer.concat(chunks)));",
      ],
      { input: captured[filename].content, capture: true },
    );

    expect(Buffer.from(result.stdout)).toEqual(original);
    expect(Buffer.from(result.stdout)).not.toEqual(replacement);
  });
});
