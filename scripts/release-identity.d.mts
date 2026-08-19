export const RELEASE_IDENTITY_CONFIG_PATH: "config/release-identity.json";

export interface CanonicalReleaseIdentity {
  schemaVersion: 1;
  displayName: string;
  slug: string;
  retiredDisplayNames: string[];
}

export interface ReleaseIdentityRecord {
  path: "config/release-identity.json";
  sha256: string;
  displayName: string;
  slug: string;
}

export interface ReleaseIdentity extends CanonicalReleaseIdentity {
  record: ReleaseIdentityRecord;
}

export function canonicalReleaseSlug(displayName: string): string;
export function assertCanonicalReleaseIdentity(
  value: unknown,
): CanonicalReleaseIdentity;
export function releaseIdentityText(identity: unknown): string;
export function assertReleaseIdentityRecord(
  record: unknown,
  identity: unknown,
): ReleaseIdentityRecord;
export function releaseIdentityRecord(identity: unknown): ReleaseIdentityRecord;
export function assertReleaseIdentityText(options: {
  content: unknown;
  label: unknown;
  identity: unknown;
}): string;
export function loadReleaseIdentity(options: {
  root: string;
}): Promise<ReleaseIdentity>;
