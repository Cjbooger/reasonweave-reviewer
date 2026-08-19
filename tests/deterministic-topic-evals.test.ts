import { describe, expect, it } from "vitest";

import { EVAL_FIXTURES } from "@/evals/fixtures";
import {
  DETERMINISTIC_TOPIC_EVALUATIONS,
  type DeterministicTopicFixtureId,
} from "@/evals/deterministic-topic-fixtures";
import {
  validateCuriosityMap,
  validateEvidenceBundle,
  validateEvidenceDecisionGrounding,
  validateQuestPlan,
  validateReflectionResult,
  validateRoutes,
} from "@/evals/validators";
import {
  curiositySessionSchema,
  evidenceApplicationSchema,
  evidenceBundleSchema,
  evidenceDecisionSchema,
  finalCuriosityMapSchema,
  questPlanSchema,
  reflectionResultSchema,
  routesResponseSchema,
} from "@/lib/schemas";
import { validateEvidenceApplicationArtifact } from "@/lib/evidence-application";

const TOPIC_ANCHORS = {
  dreams: {
    route: /sleep|dream/i,
    challenge: /memory processing.*emotion regulation.*by-product/i,
    evidence: /dreaming.*memory.*emotion/i,
    source: /sleepfoundation\.org/i,
    question: /dream explanations|dream reports|by-product account/i,
  },
  "car-free-city": {
    route: /transit|freight|car-light/i,
    challenge: /mobility plan.*transit.*delivery hubs/i,
    evidence: /street space.*transit.*car dependence/i,
    source: /itdp\.org/i,
    question: /car-light|freight deliveries|accessibility measures/i,
  },
  earworms: {
    route: /repetition|song|memory loops/i,
    challenge: /repetition.*familiarity.*attention.*emotional salience/i,
    evidence: /earworms.*recent exposure.*repetition/i,
    source: /bps\.org\.uk/i,
    question: /musical features|earworm|familiar song/i,
  },
  "plant-communication": {
    route: /plant signals|fungal-network|signal/i,
    challenge: /plant signal.*measured response.*chemical effect/i,
    evidence: /plants.*chemical signals.*defenses/i,
    source: /nature\.com/i,
    question: /plant signaling|communication|fungal-network/i,
  },
  "fair-games": {
    route: /ruleset|player starts|rule/i,
    challenge: /game.*rule change.*player response/i,
    evidence: /game fairness.*rules.*counterplay/i,
    source: /gamelab\.mit\.edu/i,
    question: /counterplay|randomness|fair competition/i,
  },
  "living-computer": {
    route: /cellular|biosensor|substrates/i,
    challenge: /biosensor.*cellular logic.*containment/i,
    evidence: /living cells.*sense inputs.*outputs/i,
    source: /genome\.gov/i,
    question: /living-cell|biosensor|cellular device/i,
  },
  money: {
    route: /barter|currency|trust and debt/i,
    challenge: /barter.*commodity money.*state currency.*digital ledgers/i,
    evidence: /medium of exchange.*unit of account.*store of value/i,
    source: /federalreserveeducation\.org/i,
    question: /currency|digital ledgers|local currencies/i,
  },
  "relativity-time": {
    route: /clocks|reference frames|navigation/i,
    challenge: /stationary.*moving.*higher-altitude clocks/i,
    evidence: /relativity.*clock rates.*motion.*gravity/i,
    source: /nasa\.gov/i,
    question: /navigation timing|clock experiments|everyday clocks/i,
  },
  "school-food-waste": {
    route: /waste|cafeteria|portion/i,
    challenge: /waste categories.*portions.*student taste feedback/i,
    evidence: /food-waste prevention.*portioning.*menu planning/i,
    source: /epa\.gov/i,
    question: /waste category|portions|composting/i,
  },
} satisfies Record<
  DeterministicTopicFixtureId,
  Record<"route" | "challenge" | "evidence" | "source" | "question", RegExp>
>;

describe("deterministic required-topic evaluations", () => {
  it("covers every non-canonical required topic with topic-specific expected output", () => {
    expect(DETERMINISTIC_TOPIC_EVALUATIONS).toHaveLength(
      EVAL_FIXTURES.length - 1,
    );
    expect(
      new Set(DETERMINISTIC_TOPIC_EVALUATIONS.map((topic) => topic.fixture.id)),
    ).toEqual(new Set(EVAL_FIXTURES.slice(1).map((fixture) => fixture.id)));
  });

  it.each(DETERMINISTIC_TOPIC_EVALUATIONS)(
    "validates $fixture.id across all deterministic stages",
    (topic) => {
      expect(
        routesResponseSchema.safeParse({ routes: topic.routes }).success,
      ).toBe(true);
      expect(questPlanSchema.safeParse(topic.quest).success).toBe(true);
      expect(evidenceBundleSchema.safeParse(topic.evidence).success).toBe(true);
      expect(evidenceDecisionSchema.safeParse(topic.decision).success).toBe(
        true,
      );
      expect(
        evidenceApplicationSchema.safeParse(topic.application).success,
      ).toBe(true);
      expect(
        validateEvidenceApplicationArtifact(
          topic.application,
          topic.fixture.artifact,
        ).success,
      ).toBe(true);
      expect(topic.application.designChoice).not.toContain("Creation anchor:");
      expect(reflectionResultSchema.safeParse(topic.reflection).success).toBe(
        true,
      );
      expect(finalCuriosityMapSchema.safeParse(topic.map).success).toBe(true);
      expect(curiositySessionSchema.safeParse(topic.session).success).toBe(
        true,
      );

      expect(validateRoutes(topic.routes).passed).toBe(true);
      expect(
        validateQuestPlan(topic.quest, topic.fixture.durationMinutes).passed,
      ).toBe(true);
      expect(validateEvidenceBundle(topic.evidence).passed).toBe(true);
      expect(
        validateReflectionResult(topic.reflection, topic.fixture.reflection, [
          topic.fixture.prediction,
          topic.fixture.artifact,
          topic.application.designChoice,
        ]).passed,
      ).toBe(true);
      expect(
        validateEvidenceDecisionGrounding(
          topic.reflection,
          topic.evidence,
          topic.decision,
          topic.application,
        ).passed,
      ).toBe(true);
      expect(validateCuriosityMap(topic.map).passed).toBe(true);
    },
  );

  it("uses anchors authored in evidence-driven choices rather than artifact prefixes", () => {
    const dreams = DETERMINISTIC_TOPIC_EVALUATIONS.find(
      (topic) => topic.fixture.id === "dreams",
    );

    expect(dreams?.application.artifactAnchor).toBe("memory processing");
    expect(dreams?.application.designChoice).toContain("memory processing");
    expect(dreams?.fixture.artifact).toContain("memory processing");
  });

  it("keeps deterministic quest workload inside each duration budget", () => {
    for (const topic of DETERMINISTIC_TOPIC_EVALUATIONS) {
      const expected =
        topic.fixture.durationMinutes === 5
          ? { constraints: [2, 2], criteria: [1, 1] }
          : topic.fixture.durationMinutes === 10
            ? { constraints: [2, 3], criteria: [1, 2] }
            : { constraints: [2, 4], criteria: [1, 4] };
      expect(topic.quest.constraints.length).toBeGreaterThanOrEqual(
        expected.constraints[0],
      );
      expect(topic.quest.constraints.length).toBeLessThanOrEqual(
        expected.constraints[1],
      );
      expect(topic.quest.completionCriteria.length).toBeGreaterThanOrEqual(
        expected.criteria[0],
      );
      expect(topic.quest.completionCriteria.length).toBeLessThanOrEqual(
        expected.criteria[1],
      );
    }

    const fiveMinuteTopic = DETERMINISTIC_TOPIC_EVALUATIONS.find(
      (topic) => topic.fixture.durationMinutes === 5,
    );
    if (!fiveMinuteTopic) throw new Error("Expected a five-minute topic.");
    const overloadedFiveMinuteQuest = structuredClone(fiveMinuteTopic.quest);
    overloadedFiveMinuteQuest.constraints.push(
      "Add one extra constraint beyond the compact workload.",
    );
    expect(
      validateQuestPlan(overloadedFiveMinuteQuest, 5).checks.find(
        (check) => check.id === "quest-constraint-count",
      )?.passed,
    ).toBe(false);

    const tenMinuteTopic = DETERMINISTIC_TOPIC_EVALUATIONS.find(
      (topic) => topic.fixture.durationMinutes === 10,
    );
    if (!tenMinuteTopic) throw new Error("Expected a ten-minute topic.");
    const overloadedTenMinuteQuest = structuredClone(tenMinuteTopic.quest);
    overloadedTenMinuteQuest.completionCriteria.push(
      "Add a third completion target beyond the focused workload.",
      "Add a fourth completion target beyond the focused workload.",
    );
    expect(
      validateQuestPlan(overloadedTenMinuteQuest, 10).checks.find(
        (check) => check.id === "quest-completion-criteria",
      )?.passed,
    ).toBe(false);
  });

  it.each(DETERMINISTIC_TOPIC_EVALUATIONS)(
    "keeps $fixture.id outputs semantically topic-specific",
    (topic) => {
      const anchors = TOPIC_ANCHORS[topic.fixture.id];
      expect(
        topic.routes
          .flatMap((route) => [route.title, route.hook, route.activityType])
          .join(" "),
      ).toMatch(anchors.route);
      expect(topic.quest.creationChallenge).toMatch(anchors.challenge);
      expect(topic.evidence.items[0].statement).toMatch(anchors.evidence);
      expect(topic.evidence.sources[0].domain).toMatch(anchors.source);
      expect(topic.reflection.newQuestions.join(" ")).toMatch(anchors.question);
    },
  );
});
