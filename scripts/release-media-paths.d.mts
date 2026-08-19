export const RELEASE_MEDIA_FILES: Readonly<{
  proofBoardSvg: "technical-proof-board.svg";
  proofBoardPng: "technical-proof-board.png";
  captions: "seeded-demo-rehearsal.srt";
  thumbnail: "youtube-thumbnail.png";
  badge: "seeded-demo-badge.png";
  closingCard: "closing-card.png";
}>;

export const RELEASE_MEDIA_RENDER_OUTPUTS: readonly [
  "technical-proof-board.png",
  "youtube-thumbnail.png",
  "seeded-demo-badge.png",
  "closing-card.png",
];

export const RELEASE_MEDIA_RECEIPT_FILE: "release-media-receipt.json";

export type ReleaseMediaFilename =
  (typeof RELEASE_MEDIA_FILES)[keyof typeof RELEASE_MEDIA_FILES];

export interface ReleaseMediaBinding {
  mediaDir: string;
  mediaReal: string;
  releaseDirectory: string | undefined;
  identity: { dev: number; ino: number };
  relativeMediaDir: string;
  releaseIdentity: import("./release-identity.mjs").ReleaseIdentity;
  files: Partial<Record<ReleaseMediaFilename, string>>;
  directoryAnchors?: Array<{
    path: string;
    realPath: string;
    dev: number;
    ino: number;
    message: string;
  }>;
  screenshotDirectoryAnchor?: {
    path: string;
    realPath: string;
    dev: number;
    ino: number;
    message: string;
  };
  publicDirectoryAnchor?: {
    path: string;
    realPath: string;
    dev: number;
    ino: number;
    message: string;
  };
  releaseScreenshot?: string;
  screenshotEvidence?: {
    ownerPath: string;
    receiptPath: string;
    receiptSha256: string;
    releaseScreenshot: { path: string; bytes: number; sha256: string };
    sourceSha: string;
  };
  publicOgOutput?: string;
  relativePublicOgOutput?: string;
  releaseMediaReceiptPath?: string;
  releaseMediaReceipt?: {
    path: string;
    relativePath: string;
    sha256: string;
    value: unknown;
    screenshotEvidence: NonNullable<ReleaseMediaBinding["screenshotEvidence"]>;
    publicOgOutput: string;
    relativePublicOgOutput: string;
  };
}

export function resolveReleaseMediaPaths(options: {
  root: string;
  environment: Record<string, string | undefined>;
  mode: "render" | "media-read";
  requiredFiles?: readonly ReleaseMediaFilename[];
  requireCurrentRelease?: boolean;
}): Promise<ReleaseMediaBinding>;

export function assertReleaseMediaDirectoryIdentity(
  binding: ReleaseMediaBinding,
): Promise<void>;

export function assertReleaseMediaInputsMatchReceipt(options: {
  binding: ReleaseMediaBinding;
  inputs: Partial<
    Record<
      ReleaseMediaFilename,
      { content: Buffer; bytes: number; dev?: number; ino?: number }
    >
  >;
  filenames: readonly ReleaseMediaFilename[];
}): typeof options.inputs;
