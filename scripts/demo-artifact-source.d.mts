export interface DemoArtifactSourceOptions {
  root: string;
  allowedOutputRoot: string;
  outputDir: string;
  configuredSource?: string;
}

export interface DemoArtifactSource {
  outputReal: string;
  relativeOutputPath: string;
}

export function resolveElevenLabsArtifactSource(
  options: DemoArtifactSourceOptions,
): Promise<DemoArtifactSource>;
