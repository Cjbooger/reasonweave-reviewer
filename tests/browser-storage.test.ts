import { describe, expect, it } from "vitest";

import {
  LEARNER_WORK_TTL_MS,
  parseLearnerWork,
  readLearnerWork,
  serializeLearnerWork,
} from "@/lib/browser-storage";

describe("expiring learner-work storage", () => {
  const savedAt = Date.UTC(2026, 6, 16, 12);
  const work = { question: "Why do songs get stuck in our heads?" };

  it("round-trips work inside the retention window", () => {
    const raw = serializeLearnerWork(work, savedAt);

    expect(parseLearnerWork(raw, savedAt + LEARNER_WORK_TTL_MS)).toEqual(work);
    expect(readLearnerWork(raw, savedAt + 1)).toEqual({
      data: work,
      savedAt,
      expiresAt: savedAt + LEARNER_WORK_TTL_MS,
    });
  });

  it("expires work after 24 hours", () => {
    const raw = serializeLearnerWork(work, savedAt);

    expect(parseLearnerWork(raw, savedAt + LEARNER_WORK_TTL_MS + 1)).toBeNull();
  });

  it.each([
    ["legacy unwrapped data", JSON.stringify(work)],
    ["unknown versions", JSON.stringify({ version: 2, savedAt, data: work })],
    ["future timestamps", serializeLearnerWork(work, savedAt + 1)],
    ["invalid JSON", "{not-json"],
  ])("rejects %s", (_label, raw) => {
    expect(parseLearnerWork(raw, savedAt)).toBeNull();
  });
});
