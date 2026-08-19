import { ApiError } from "@/lib/api-errors";

const WINDOW_MS = 60_000;
export const PER_SESSION_REQUESTS_PER_WINDOW = 8;
export const GLOBAL_REQUESTS_PER_WINDOW = 60;
export const PER_SESSION_CONCURRENCY = 2;
export const GLOBAL_CONCURRENCY = 8;
export const MAX_TRACKED_SESSIONS = 512;

interface WindowCounter {
  startedAt: number;
  count: number;
}

interface SessionBucket extends WindowCounter {
  active: number;
  lastSeenAt: number;
}

const sessions = new Map<string, SessionBucket>();
let globalWindow: WindowCounter = { startedAt: 0, count: 0 };
let globalActive = 0;

function currentWindow(counter: WindowCounter, now: number): WindowCounter {
  if (now - counter.startedAt >= WINDOW_MS) {
    return { startedAt: now, count: 0 };
  }
  return counter;
}

function retryAfterSeconds(counter: WindowCounter, now: number): number {
  return Math.max(1, Math.ceil((counter.startedAt + WINDOW_MS - now) / 1_000));
}

function rateLimitError(retryAfter: number): ApiError {
  return new ApiError({
    code: "OPENAI_RATE_LIMITED",
    message:
      "This anonymous session has created several live quest steps quickly. Wait a moment, then retry or use the demo quest.",
    status: 429,
    retryable: true,
    retryAfterSeconds: retryAfter,
  });
}

function pruneExpiredSessions(now: number): void {
  if (sessions.size < 256) return;
  for (const [key, bucket] of sessions) {
    if (bucket.active === 0 && now - bucket.lastSeenAt >= WINDOW_MS * 2) {
      sessions.delete(key);
    }
  }
}

/**
 * A best-effort per-instance spend and concurrency guard for anonymous usage.
 * Deployment-level rate limiting is still required because serverless instances
 * do not share memory and a hostile client can rotate anonymous identifiers.
 */
export async function withGenerationPermit<T>(
  safetyIdentifier: string,
  operation: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  pruneExpiredSessions(now);
  const candidateGlobalWindow = { ...currentWindow(globalWindow, now) };
  const existing = sessions.get(safetyIdentifier);
  const candidateSession = existing ?? {
    startedAt: now,
    count: 0,
    active: 0,
    lastSeenAt: now,
  };
  const reset = currentWindow(candidateSession, now);
  const bucket: SessionBucket = {
    ...candidateSession,
    ...reset,
    lastSeenAt: now,
  };

  if (bucket.count >= PER_SESSION_REQUESTS_PER_WINDOW) {
    throw rateLimitError(retryAfterSeconds(bucket, now));
  }
  if (candidateGlobalWindow.count >= GLOBAL_REQUESTS_PER_WINDOW) {
    throw rateLimitError(retryAfterSeconds(candidateGlobalWindow, now));
  }
  if (
    bucket.active >= PER_SESSION_CONCURRENCY ||
    globalActive >= GLOBAL_CONCURRENCY
  ) {
    throw rateLimitError(1);
  }
  if (existing === undefined && sessions.size >= MAX_TRACKED_SESSIONS) {
    throw rateLimitError(1);
  }

  bucket.count += 1;
  bucket.active += 1;
  candidateGlobalWindow.count += 1;
  sessions.set(safetyIdentifier, bucket);
  globalWindow = candidateGlobalWindow;
  globalActive += 1;

  try {
    return await operation();
  } finally {
    bucket.active -= 1;
    bucket.lastSeenAt = Date.now();
    globalActive -= 1;
  }
}

export function generationGuardSnapshotForTests(): Readonly<{
  sessionCount: number;
  globalActive: number;
  globalRequestCount: number;
}> {
  return Object.freeze({
    sessionCount: sessions.size,
    globalActive,
    globalRequestCount: globalWindow.count,
  });
}

export function resetGenerationGuardForTests(): void {
  sessions.clear();
  globalWindow = { startedAt: 0, count: 0 };
  globalActive = 0;
}
