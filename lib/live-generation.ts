import "server-only";

import { ApiError } from "@/lib/api-errors";

export const REQUIRED_OPENAI_MODEL = "gpt-5.6";
export const MAX_LIVE_RELEASE_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

const FULL_GIT_SHA = /^[a-f0-9]{40}$/i;

export type LiveGenerationEnvironment = Readonly<{
  NODE_ENV?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  VERCEL?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  WONDERLAB_LIVE_GENERATION_ENABLED?: string;
  WONDERLAB_LIVE_GENERATION_EXPIRES_AT?: string;
  WONDERLAB_LIVE_RELEASE_SHA?: string;
}>;

/**
 * Local development stays convenient, while production defaults to seeded-only.
 * Production live mode is deliberately short-lived and, on Vercel, bound to an
 * exact deployment source SHA. This is a release lock, not a distributed quota.
 */
export function isLiveGenerationEnabled(
  environment: LiveGenerationEnvironment = process.env,
  now = Date.now(),
): boolean {
  if (environment.NODE_ENV !== "production") return true;
  if (environment.WONDERLAB_LIVE_GENERATION_ENABLED !== "true") return false;

  const model = environment.OPENAI_MODEL?.trim() || REQUIRED_OPENAI_MODEL;
  if (model !== REQUIRED_OPENAI_MODEL) return false;

  const rawExpiry = environment.WONDERLAB_LIVE_GENERATION_EXPIRES_AT?.trim();
  if (!rawExpiry?.endsWith("Z")) return false;
  const expiresAt = Date.parse(rawExpiry);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt - now > MAX_LIVE_RELEASE_WINDOW_MS
  ) {
    return false;
  }

  if (environment.VERCEL === "1") {
    const approvedSha = environment.WONDERLAB_LIVE_RELEASE_SHA?.trim();
    const deployedSha = environment.VERCEL_GIT_COMMIT_SHA?.trim();
    if (
      !approvedSha ||
      !deployedSha ||
      !FULL_GIT_SHA.test(approvedSha) ||
      !FULL_GIT_SHA.test(deployedSha) ||
      approvedSha.toLowerCase() !== deployedSha.toLowerCase()
    ) {
      return false;
    }
  }

  return true;
}

/**
 * The release lock permits live generation only when a server-side credential
 * is also present. Callers receive this boolean, never the credential itself.
 */
export function isLiveGenerationAvailable(
  environment: LiveGenerationEnvironment = process.env,
  now = Date.now(),
): boolean {
  return (
    isLiveGenerationEnabled(environment, now) &&
    Boolean(environment.OPENAI_API_KEY?.trim())
  );
}

export function assertLiveGenerationEnabled(
  environment: LiveGenerationEnvironment = process.env,
  now = Date.now(),
): void {
  if (isLiveGenerationEnabled(environment, now)) return;

  throw new ApiError({
    code: "LIVE_GENERATION_DISABLED",
    message:
      "Live generation is not enabled for this deployment. You can continue with the demo quest.",
    status: 503,
  });
}
