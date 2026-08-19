export const LEARNER_WORK_TTL_MS = 24 * 60 * 60 * 1000;

const LEARNER_WORK_STORAGE_VERSION = 1;

interface LearnerWorkEnvelope<T> {
  version: typeof LEARNER_WORK_STORAGE_VERSION;
  savedAt: number;
  data: T;
}

export interface LearnerWorkRecord<T> {
  data: T;
  savedAt: number;
  expiresAt: number;
}

export function serializeLearnerWork<T>(data: T, now = Date.now()): string {
  const envelope: LearnerWorkEnvelope<T> = {
    version: LEARNER_WORK_STORAGE_VERSION,
    savedAt: now,
    data,
  };

  return JSON.stringify(envelope);
}

export function readLearnerWork<T>(
  raw: string,
  now = Date.now(),
): LearnerWorkRecord<T> | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LearnerWorkEnvelope<T>>;
    const savedAt = parsed.savedAt;
    const age = typeof savedAt === "number" ? now - savedAt : Number.NaN;

    if (
      parsed.version !== LEARNER_WORK_STORAGE_VERSION ||
      !Object.hasOwn(parsed, "data") ||
      !Number.isFinite(savedAt) ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > LEARNER_WORK_TTL_MS
    ) {
      return null;
    }

    return {
      data: parsed.data as T,
      savedAt: savedAt as number,
      expiresAt: (savedAt as number) + LEARNER_WORK_TTL_MS,
    };
  } catch {
    return null;
  }
}

export function parseLearnerWork<T>(raw: string, now = Date.now()): T | null {
  return readLearnerWork<T>(raw, now)?.data ?? null;
}
