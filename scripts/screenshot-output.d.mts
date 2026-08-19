export const SCREENSHOT_FILENAMES: readonly [
  "spark-desktop.jpg",
  "routes-desktop.jpg",
  "prediction-desktop.jpg",
  "evidence-create-desktop.jpg",
  "discovery-desktop.jpg",
  "discovery-card-desktop.jpg",
  "discovery-mobile.jpg",
  "discovery-mobile-trace.jpg",
];

export type ScreenshotFilename = (typeof SCREENSHOT_FILENAMES)[number];

export const SCREENSHOT_OWNER_FILE: ".wonderlab-screenshot-output.json";
export const SCREENSHOT_RECEIPT_FILE: "screenshot-receipt.json";
export const SCREENSHOT_OWNER: "wonderlab-screenshot-output-v1";

export interface ScreenshotOutputBinding {
  root: string;
  outputDir: string;
  outputReal: string;
  directoryAnchor: import("./anchored-directory-ops.mjs").DirectoryAnchor;
  relativeOutputPath: string;
  identity: { dev: number; ino: number };
  sourceSha: string;
  releaseIdentity: import("./release-identity.mjs").ReleaseIdentity;
  fileIdentities: Record<ScreenshotFilename, { dev: number; ino: number }>;
  writeRecords: Record<
    ScreenshotFilename,
    { dev: number; ino: number; bytes: number; sha256: string }
  >;
  written: Set<ScreenshotFilename>;
  paths: Record<ScreenshotFilename, string>;
}

export interface ScreenshotRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ScreenshotReceipt {
  schemaVersion: 1;
  kind: "wonderlab-screenshot-receipt";
  generatedAt: string;
  source: { fullSha: string; cleanBeforeCapture: true };
  outputDir: string;
  releaseIdentity: import("./release-identity.mjs").ReleaseIdentityRecord;
  screenshots: ScreenshotRecord[];
}

export function prepareScreenshotOutput(options: {
  root: string;
  configuredOutput: string | undefined;
  sourceSha: string | undefined;
  sourceStatus: string;
}): Promise<ScreenshotOutputBinding>;

export function finalizeScreenshotOutput(options: {
  root: string;
  binding: ScreenshotOutputBinding;
  endingSourceSha: string;
  endingSourceStatus: string;
}): Promise<ScreenshotReceipt>;

export function writeScreenshotOutput(options: {
  binding: ScreenshotOutputBinding;
  filename: ScreenshotFilename;
  content: Buffer;
}): Promise<void>;
