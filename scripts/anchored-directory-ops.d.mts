export interface DirectoryAnchor {
  path: string;
  realPath: string;
  dev: number;
  ino: number;
  message: string;
}

export function createDirectoryAnchor(
  directoryPath: string,
  message: string,
): Promise<DirectoryAnchor>;

export function withAnchoredDirectory<T>(
  anchor: DirectoryAnchor,
  operation: () => Promise<T>,
): Promise<T>;

export function createAnchoredChildDirectory(options: {
  parentAnchor: DirectoryAnchor;
  directoryName: string;
  message: string;
}): Promise<DirectoryAnchor>;

export function readAnchoredFiles(options: {
  anchor: DirectoryAnchor;
  filenames: readonly string[];
}): Promise<
  Record<string, { content: Buffer; dev: number; ino: number; bytes: number }>
>;

export function writeExclusiveAnchoredFile(options: {
  anchor: DirectoryAnchor;
  filename: string;
  content: Buffer;
}): Promise<{ dev: number; ino: number; bytes: number }>;

export function reserveExclusiveAnchoredFile(options: {
  anchor: DirectoryAnchor;
  filename: string;
}): Promise<{ dev: number; ino: number }>;

export function writeReservedAnchoredFile(options: {
  anchor: DirectoryAnchor;
  filename: string;
  expectedIdentity: { dev: number; ino: number };
  content: Buffer;
}): Promise<{ dev: number; ino: number; bytes: number }>;

export function cleanupAnchoredDirectory(options: {
  parentAnchor: DirectoryAnchor;
  directoryAnchor: DirectoryAnchor;
  expectedFiles: Array<{ filename: string; dev: number; ino: number }>;
}): Promise<void>;
