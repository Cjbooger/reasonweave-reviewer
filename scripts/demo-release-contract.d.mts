export interface DemoSrtCue {
  index: number;
  start: number;
  end: number;
  lines: string[];
  text: string;
}

export interface DemoCaptionMetrics {
  maximumLineLength: number;
  maximumWordsPerMinute: number;
}

export interface DemoPngMetadata {
  format: "png";
  width: number;
  height: number;
  channels: 4;
  bitDepth: 8;
  interlaced: false;
}

export const DEMO_FINAL_SECONDS: 174;

export function parseDemoSrt(value: string): DemoSrtCue[];

export function validateDemoCues(
  cues: DemoSrtCue[],
  options?: { finalSeconds?: number },
): DemoCaptionMetrics;

export function assertDemoImageDimensions(options: {
  content: Buffer;
  width: number;
  height: number;
  label: string;
}): Promise<DemoPngMetadata>;

export function validateDemoReleaseInputs(options: {
  captions: Buffer;
  proofBoard: Buffer;
  closingCard: Buffer;
}): Promise<{
  cues: DemoSrtCue[];
  captionMetrics: DemoCaptionMetrics;
}>;
