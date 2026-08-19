export const RELEASE_NARRATION_CONFIG_PATH: "config/release-narration.json";

export interface CanonicalReleaseNarration {
  schemaVersion: 1;
  provider: "elevenlabs";
  voiceId: string;
  verificationMode: "user_selected_tts_only";
}

export interface ReleaseNarrationRecord {
  path: "config/release-narration.json";
  sha256: string;
  provider: "elevenlabs";
  voiceId: string;
  verificationMode: "user_selected_tts_only";
}

export interface ReleaseNarration extends CanonicalReleaseNarration {
  record: ReleaseNarrationRecord;
}

export function assertCanonicalReleaseNarration(
  value: unknown,
): CanonicalReleaseNarration;
export function assertReleaseNarrationRecord(
  record: unknown,
  narration: unknown,
): ReleaseNarrationRecord;
export function releaseNarrationRecord(
  narration: unknown,
): ReleaseNarrationRecord;
export function assertReleaseNarrationAttemptBinding<T>(
  attempt: T,
  narration: unknown,
): T;
export function loadReleaseNarration(options: {
  root: string;
}): Promise<ReleaseNarration>;
