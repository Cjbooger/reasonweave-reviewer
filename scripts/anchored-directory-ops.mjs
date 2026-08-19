import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function safeFilename(filename) {
  return (
    typeof filename === "string" &&
    filename.length > 0 &&
    filename !== "." &&
    filename !== ".." &&
    path.basename(filename) === filename &&
    !filename.includes("\\")
  );
}

export async function createDirectoryAnchor(directoryPath, message) {
  const metadata = await fs.lstat(directoryPath);
  invariant(!metadata.isSymbolicLink() && metadata.isDirectory(), message);
  return {
    path: directoryPath,
    realPath: await fs.realpath(directoryPath),
    dev: metadata.dev,
    ino: metadata.ino,
    message,
  };
}

export async function withAnchoredDirectory(anchor, operation) {
  invariant(
    anchor && typeof operation === "function",
    "Anchored directory operation is invalid.",
  );
  const returnDirectory = process.cwd();
  let changedDirectory = false;
  try {
    process.chdir(anchor.path);
    changedDirectory = true;
    const metadata = await fs.stat(".");
    invariant(
      metadata.isDirectory() &&
        metadata.dev === anchor.dev &&
        metadata.ino === anchor.ino,
      anchor.message,
    );
    return await operation();
  } finally {
    if (changedDirectory) process.chdir(returnDirectory);
  }
}

export async function createAnchoredChildDirectory({
  parentAnchor,
  directoryName,
  message,
}) {
  invariant(
    safeFilename(directoryName) && typeof message === "string",
    "Anchored directory creation contract is invalid.",
  );
  return withAnchoredDirectory(parentAnchor, async () => {
    await fs.mkdir(directoryName, { mode: 0o700 });
    const metadata = await fs.lstat(directoryName);
    invariant(!metadata.isSymbolicLink() && metadata.isDirectory(), message);
    return {
      path: path.join(parentAnchor.path, directoryName),
      realPath: await fs.realpath(directoryName),
      dev: metadata.dev,
      ino: metadata.ino,
      message,
    };
  });
}

export async function readAnchoredFiles({ anchor, filenames }) {
  invariant(
    Array.isArray(filenames) &&
      filenames.length > 0 &&
      new Set(filenames).size === filenames.length &&
      filenames.every(safeFilename),
    "Anchored reads require distinct direct-child filenames.",
  );
  return withAnchoredDirectory(anchor, async () => {
    const files = {};
    for (const filename of filenames) {
      const pathMetadata = await fs.lstat(filename);
      invariant(
        !pathMetadata.isSymbolicLink() &&
          pathMetadata.isFile() &&
          pathMetadata.size > 0,
        `Anchored file ${filename} must be a non-empty regular file.`,
      );
      const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
      const handle = await fs.open(filename, flags);
      try {
        const metadata = await handle.stat();
        invariant(
          metadata.isFile() &&
            metadata.size > 0 &&
            metadata.dev === pathMetadata.dev &&
            metadata.ino === pathMetadata.ino,
          `Anchored file ${filename} must be a non-empty regular file.`,
        );
        const content = await handle.readFile();
        invariant(
          content.length === metadata.size,
          `Anchored file ${filename} changed while it was read.`,
        );
        files[filename] = {
          content,
          dev: metadata.dev,
          ino: metadata.ino,
          bytes: metadata.size,
        };
      } finally {
        await handle.close();
      }
    }
    return files;
  });
}

export async function writeExclusiveAnchoredFile({
  anchor,
  filename,
  content,
}) {
  invariant(
    safeFilename(filename) && Buffer.isBuffer(content) && content.length > 0,
    "Anchored publication requires a direct filename and non-empty buffer.",
  );
  return withAnchoredDirectory(anchor, async () => {
    const flags =
      fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      (fsConstants.O_NOFOLLOW ?? 0);
    const handle = await fs.open(filename, flags, 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
      const metadata = await handle.stat();
      invariant(
        metadata.isFile() && metadata.size === content.length,
        `Anchored publication ${filename} is incomplete.`,
      );
      return {
        dev: metadata.dev,
        ino: metadata.ino,
        bytes: metadata.size,
      };
    } finally {
      await handle.close();
    }
  });
}

export async function reserveExclusiveAnchoredFile({ anchor, filename }) {
  invariant(
    safeFilename(filename),
    "Anchored reservation requires a direct filename.",
  );
  return withAnchoredDirectory(anchor, async () => {
    const flags =
      fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      (fsConstants.O_NOFOLLOW ?? 0);
    const handle = await fs.open(filename, flags, 0o600);
    try {
      await handle.sync();
      const metadata = await handle.stat();
      invariant(
        metadata.isFile() && metadata.size === 0,
        `Anchored reservation ${filename} is not an empty regular file.`,
      );
      return { dev: metadata.dev, ino: metadata.ino };
    } finally {
      await handle.close();
    }
  });
}

export async function writeReservedAnchoredFile({
  anchor,
  filename,
  expectedIdentity,
  content,
}) {
  invariant(
    safeFilename(filename) &&
      Number.isSafeInteger(expectedIdentity?.dev) &&
      Number.isSafeInteger(expectedIdentity?.ino) &&
      Buffer.isBuffer(content) &&
      content.length > 0,
    "Anchored reserved write contract is invalid.",
  );
  return withAnchoredDirectory(anchor, async () => {
    const pathMetadata = await fs.lstat(filename);
    invariant(
      !pathMetadata.isSymbolicLink() &&
        pathMetadata.isFile() &&
        pathMetadata.size === 0 &&
        pathMetadata.dev === expectedIdentity.dev &&
        pathMetadata.ino === expectedIdentity.ino,
      `Anchored reservation ${filename} changed before its write.`,
    );
    const flags = fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0);
    const handle = await fs.open(filename, flags);
    try {
      const openedMetadata = await handle.stat();
      invariant(
        openedMetadata.isFile() &&
          openedMetadata.size === 0 &&
          openedMetadata.dev === expectedIdentity.dev &&
          openedMetadata.ino === expectedIdentity.ino,
        `Anchored reservation ${filename} changed while it was opened.`,
      );
      await handle.writeFile(content);
      await handle.sync();
      const writtenMetadata = await handle.stat();
      invariant(
        writtenMetadata.dev === expectedIdentity.dev &&
          writtenMetadata.ino === expectedIdentity.ino &&
          writtenMetadata.size === content.length,
        `Anchored reserved write ${filename} is incomplete.`,
      );
      return {
        dev: writtenMetadata.dev,
        ino: writtenMetadata.ino,
        bytes: writtenMetadata.size,
      };
    } finally {
      await handle.close();
    }
  });
}

export async function cleanupAnchoredDirectory({
  parentAnchor,
  directoryAnchor,
  expectedFiles,
}) {
  invariant(
    path.dirname(directoryAnchor.path) === parentAnchor.path &&
      safeFilename(path.basename(directoryAnchor.path)) &&
      Array.isArray(expectedFiles) &&
      expectedFiles.length > 0 &&
      expectedFiles.every(
        (record) =>
          safeFilename(record?.filename) &&
          Number.isSafeInteger(record.dev) &&
          Number.isSafeInteger(record.ino),
      ),
    "Anchored cleanup contract is invalid.",
  );
  const expectedNames = expectedFiles.map((record) => record.filename).sort();
  invariant(
    new Set(expectedNames).size === expectedNames.length,
    "Anchored cleanup filenames must be distinct.",
  );

  await withAnchoredDirectory(directoryAnchor, async () => {
    const entries = (await fs.readdir(".")).sort();
    invariant(
      JSON.stringify(entries) === JSON.stringify(expectedNames),
      "Anchored cleanup refuses a staging directory with unexpected entries.",
    );
    for (const record of expectedFiles) {
      const metadata = await fs.lstat(record.filename);
      invariant(
        !metadata.isSymbolicLink() &&
          metadata.isFile() &&
          metadata.dev === record.dev &&
          metadata.ino === record.ino,
        `Anchored cleanup file ${record.filename} changed identity.`,
      );
      await fs.unlink(record.filename);
    }
  });

  await withAnchoredDirectory(parentAnchor, async () => {
    const directoryName = path.basename(directoryAnchor.path);
    const metadata = await fs.lstat(directoryName);
    invariant(
      !metadata.isSymbolicLink() &&
        metadata.isDirectory() &&
        metadata.dev === directoryAnchor.dev &&
        metadata.ino === directoryAnchor.ino,
      "Anchored cleanup staging directory changed identity.",
    );
    await fs.rmdir(directoryName);
  });
}
