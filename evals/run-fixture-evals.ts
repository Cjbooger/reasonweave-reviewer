import seededDemoJson from "@/data/demo-underwater.json";
import { evidenceDecisionNarrative } from "@/lib/evidence-decision";
import { seededQuestForRoute } from "@/lib/seeded-demo";
import {
  curiositySessionSchema,
  evidenceApplicationSchema,
  evidenceBundleSchema,
  evidenceDecisionSchema,
  finalCuriosityMapSchema,
  questPlanSchema,
  reflectionResultSchema,
  routesResponseSchema,
  seededDemoSessionSchema,
} from "@/lib/schemas";
import type {
  CuriosityMap,
  EvidenceBundle,
  ExplorationRoute,
  QuestPlan,
  ReflectionResult,
} from "@/types/curiosity";

import {
  type EvaluationCheck,
  type EvaluationResult,
  failedDetails,
  validateCuriosityMap,
  validateEvidenceDecisionGrounding,
  validateEvidenceBundle,
  validateQuestPlan,
  validateReflectionResult,
  validateRoutes,
  validateTextSafety,
} from "./validators";
import { DETERMINISTIC_TOPIC_EVALUATIONS } from "./deterministic-topic-fixtures";

function singleCheck(
  name: string,
  id: string,
  passed: boolean,
  detail: string,
): EvaluationResult {
  const check: EvaluationCheck = { id, passed, detail };
  return { name, passed, checks: [check] };
}

function negativeControl(
  name: string,
  evaluation: EvaluationResult,
  expectedFailureId: string,
): EvaluationResult {
  const expectedCheck = evaluation.checks.find(
    (item) => item.id === expectedFailureId,
  );
  const passed = Boolean(expectedCheck && !expectedCheck.passed);
  return singleCheck(
    `negative-control:${name}`,
    `rejects-${expectedFailureId}`,
    passed,
    passed
      ? `Validator rejected the mutation through ${expectedFailureId}.`
      : `Validator did not reject the mutation through ${expectedFailureId}.`,
  );
}

function printEvaluation(evaluation: EvaluationResult): void {
  const marker = evaluation.passed ? "PASS" : "FAIL";
  process.stdout.write(`${marker} ${evaluation.name}\n`);
  for (const item of evaluation.checks) {
    if (!item.passed) {
      process.stdout.write(`  - ${item.id}: ${item.detail}\n`);
    }
  }
}

const SEEDED_TEN_MINUTE_COMPACT_SCOPES = {
  "design-habitat": {
    creationChallenge:
      "Make one evidence-driven design decision for a 100-person underwater habitat: choose a shallow operating depth and one surface-linked support strategy, then name one tradeoff.",
    constraints: [
      "Choose a shallow operating depth and one surface-linked support strategy.",
      "Use one Evidence Lens finding to explain the choice and name one tradeoff or unresolved risk.",
    ],
    completionCriteria: [
      "State the depth and support choice, the finding that informed it, and one tradeoff or unresolved risk.",
    ],
  },
  "protect-ocean": {
    creationChallenge:
      "Make one evidence-driven go, revise, or no-go decision for a 100-person underwater habitat: name one ecosystem risk, one measurable limit, and one tradeoff.",
    constraints: [
      "Use one Evidence Lens finding to connect the decision to the named risk.",
      "State one uncertainty that could change the decision.",
    ],
    completionCriteria: [
      "State the decision, risk and limit, source-grounded reason, and one uncertainty or tradeoff.",
    ],
  },
  "survive-pressure": {
    creationChallenge:
      "Make one evidence-driven design choice for a habitat at a chosen depth: name one pressure or access risk, one support response, and one tradeoff.",
    constraints: [
      "Use one Evidence Lens finding to connect the chosen depth to the risk.",
      "State one uncertainty that limits the model.",
    ],
    completionCriteria: [
      "State the depth, risk, response, evidence-grounded reason, and one tradeoff or uncertainty.",
    ],
  },
} as const;

function matchesSeededTenMinuteCompactScope(quest: QuestPlan): boolean {
  const expected =
    SEEDED_TEN_MINUTE_COMPACT_SCOPES[
      quest.routeId as keyof typeof SEEDED_TEN_MINUTE_COMPACT_SCOPES
    ];
  return Boolean(
    expected &&
    quest.creationChallenge === expected.creationChallenge &&
    JSON.stringify(quest.constraints) ===
      JSON.stringify(expected.constraints) &&
    JSON.stringify(quest.completionCriteria) ===
      JSON.stringify(expected.completionCriteria),
  );
}

const evaluations: EvaluationResult[] = [];
const seededParse = seededDemoSessionSchema.safeParse(seededDemoJson);

evaluations.push(
  singleCheck(
    "seeded-demo-schema",
    "seeded-demo-parses",
    seededParse.success,
    seededParse.success
      ? "The canonical seeded session satisfies the production schema."
      : seededParse.error.issues
          .slice(0, 8)
          .map(
            (issue) => `${issue.path.join(".") || "fixture"}: ${issue.message}`,
          )
          .join("; "),
  ),
);

if (seededParse.success) {
  const session = seededParse.data;
  const compactScopeQuests = session.routes.map(seededQuestForRoute);
  evaluations.push(
    singleCheck(
      "seeded-ten-minute-compact-creation-scope",
      "seeded-compact-creation-scope",
      session.durationMinutes === 10 &&
        compactScopeQuests.every(matchesSeededTenMinuteCompactScope),
      "Every canonical and alternate seeded 10-minute quest is pinned to one focused evidence-driven decision, two constraints, and one completion criterion.",
    ),
  );
  const routeEvaluation = validateRoutes(session.routes);
  const questEvaluation = validateQuestPlan(
    session.quest as QuestPlan,
    session.durationMinutes,
  );
  const evidenceEvaluation = validateEvidenceBundle(
    session.evidence as EvidenceBundle,
  );
  const reflectionEvaluation = validateReflectionResult(
    session.reflectionResult as ReflectionResult,
    session.reflectionInput!,
    [
      session.prediction!,
      evidenceDecisionNarrative(session.evidenceDecision!),
      session.evidenceApplication!.designChoice,
      session.artifact!,
    ],
  );
  const decisionGroundingEvaluation = validateEvidenceDecisionGrounding(
    session.reflectionResult as ReflectionResult,
    session.evidence as EvidenceBundle,
    session.evidenceDecision!,
    session.evidenceApplication!,
  );
  const mapEvaluation = validateCuriosityMap(session.map as CuriosityMap);

  evaluations.push(
    routeEvaluation,
    questEvaluation,
    evidenceEvaluation,
    reflectionEvaluation,
    decisionGroundingEvaluation,
    mapEvaluation,
  );

  const missingRoute = session.routes.slice(0, 2) as ExplorationRoute[];
  evaluations.push(
    negativeControl(
      "two-routes",
      validateRoutes(missingRoute),
      "routes-exactly-three",
    ),
  );

  const duplicateConstraint = structuredClone(session.quest!);
  duplicateConstraint.constraints[1] = duplicateConstraint.constraints[0];
  evaluations.push(
    negativeControl(
      "duplicate-constraint",
      validateQuestPlan(duplicateConstraint, session.durationMinutes),
      "quest-unique-constraints",
    ),
  );

  const overloadedConstraints = structuredClone(session.quest!);
  overloadedConstraints.constraints.push(
    "Add a fourth independent requirement beyond the focused workload.",
    "Add a fifth independent requirement beyond the focused workload.",
  );
  evaluations.push(
    negativeControl(
      "ten-minute-constraint-workload",
      validateQuestPlan(overloadedConstraints, session.durationMinutes),
      "quest-constraint-count",
    ),
  );

  const overloadedCriteria = structuredClone(session.quest!);
  overloadedCriteria.completionCriteria.push(
    "Add a third completion target beyond the focused workload.",
    "Add a fourth completion target beyond the focused workload.",
  );
  evaluations.push(
    negativeControl(
      "ten-minute-criteria-workload",
      validateQuestPlan(overloadedCriteria, session.durationMinutes),
      "quest-completion-criteria",
    ),
  );

  const unsafeQuest = structuredClone(session.quest!);
  unsafeQuest.creationChallenge =
    "Build and test a pressure vessel at home, then record how much force it can withstand.";
  evaluations.push(
    negativeControl(
      "unsafe-physical-challenge",
      validateQuestPlan(unsafeQuest, session.durationMinutes),
      "no-unsafe-physical-instruction",
    ),
  );

  const orphanedEvidence = structuredClone(session.evidence!);
  const sourcedItem = orphanedEvidence.items.find(
    (item) => item.kind === "evidence",
  );
  if (sourcedItem) sourcedItem.sourceIds = ["missing-source"];
  evaluations.push(
    negativeControl(
      "orphaned-citation",
      validateEvidenceBundle(orphanedEvidence),
      "evidence-source-integrity",
    ),
  );

  const duplicateQuestions = structuredClone(session.reflectionResult!);
  duplicateQuestions.newQuestions[1] = duplicateQuestions.newQuestions[0];
  evaluations.push(
    negativeControl(
      "duplicate-next-question",
      validateReflectionResult(duplicateQuestions, session.reflectionInput!, [
        session.prediction!,
        session.artifact!,
      ]),
      "reflection-distinct-questions",
    ),
  );

  const genericFeedback = structuredClone(session.reflectionResult!);
  genericFeedback.specificFeedback = "Great job!";
  genericFeedback.changedThinking = "A completely unrelated generic summary.";
  evaluations.push(
    negativeControl(
      "generic-feedback",
      validateReflectionResult(genericFeedback, session.reflectionInput!, [
        session.prediction!,
        session.artifact!,
      ]),
      "reflection-specific-feedback",
    ),
  );

  const decisionIgnoringReflection = structuredClone(session.reflectionResult!);
  decisionIgnoringReflection.specificFeedback =
    "You moved from pressure as the only obstacle to a connected systems model involving maintenance, food, and redundant life support. Your habitat makes that change concrete through repair access and duplicate air and water loops.";
  decisionIgnoringReflection.changedThinking =
    "The learner shifted from pressure alone toward a connected model of long-term habitat reliability.";
  const generalGroundingWithoutDecision = validateReflectionResult(
    decisionIgnoringReflection,
    session.reflectionInput!,
    [session.prediction!, session.artifact!],
  );
  const decisionGroundingWithoutDecision = validateEvidenceDecisionGrounding(
    decisionIgnoringReflection,
    session.evidence as EvidenceBundle,
    session.evidenceDecision!,
    session.evidenceApplication!,
  );
  const missingRelationship = decisionGroundingWithoutDecision.checks.find(
    (item) => item.id === "reflection-decision-relationship",
  );
  evaluations.push(
    singleCheck(
      "negative-control:decision-ignored",
      "rejects-decision-ignored-despite-general-grounding",
      generalGroundingWithoutDecision.passed &&
        Boolean(missingRelationship && !missingRelationship.passed),
      "A response grounded in the artifact and reflection must still fail when it ignores the learner's Evidence Decision.",
    ),
  );

  const danglingMap = structuredClone(session.map!);
  danglingMap.edges[0].target = "missing-node";
  evaluations.push(
    negativeControl(
      "dangling-map-edge",
      validateCuriosityMap(danglingMap),
      "map-edge-integrity",
    ),
  );

  evaluations.push(
    negativeControl(
      "unsupported-efficacy-claim",
      validateTextSafety("outcome-claim", [
        "ReasonWeave is scientifically shown to improve grades and learning outcomes.",
      ]),
      "no-proven-outcome-claim",
    ),
  );
}

for (const topic of DETERMINISTIC_TOPIC_EVALUATIONS) {
  const prefix = `topic:${topic.fixture.id}`;
  const productionParses = [
    ["routes", routesResponseSchema.safeParse({ routes: topic.routes })],
    ["quest", questPlanSchema.safeParse(topic.quest)],
    ["evidence", evidenceBundleSchema.safeParse(topic.evidence)],
    ["decision", evidenceDecisionSchema.safeParse(topic.decision)],
    ["application", evidenceApplicationSchema.safeParse(topic.application)],
    ["reflection", reflectionResultSchema.safeParse(topic.reflection)],
    ["map", finalCuriosityMapSchema.safeParse(topic.map)],
    ["session", curiositySessionSchema.safeParse(topic.session)],
  ] as const;
  evaluations.push(
    ...productionParses.map(([stage, parsed]) =>
      singleCheck(
        `${prefix}:schema:${stage}`,
        `production-schema-${stage}`,
        parsed.success,
        parsed.success
          ? `The expected ${stage} output satisfies its production schema.`
          : parsed.error.issues
              .slice(0, 4)
              .map(
                (issue) => `${issue.path.join(".") || stage}: ${issue.message}`,
              )
              .join("; "),
      ),
    ),
    { ...validateRoutes(topic.routes), name: `${prefix}:routes` },
    {
      ...validateQuestPlan(topic.quest, topic.fixture.durationMinutes),
      name: `${prefix}:quest`,
    },
    { ...validateEvidenceBundle(topic.evidence), name: `${prefix}:evidence` },
    {
      ...validateReflectionResult(topic.reflection, topic.fixture.reflection, [
        topic.fixture.prediction,
        topic.fixture.artifact,
        topic.application.designChoice,
      ]),
      name: `${prefix}:reflection`,
    },
    {
      ...validateEvidenceDecisionGrounding(
        topic.reflection,
        topic.evidence,
        topic.decision,
        topic.application,
      ),
      name: `${prefix}:evidence-decision`,
    },
    { ...validateCuriosityMap(topic.map), name: `${prefix}:map` },
  );
}

for (const evaluation of evaluations) printEvaluation(evaluation);

const passed = evaluations.filter((evaluation) => evaluation.passed).length;
const failed = evaluations.length - passed;
process.stdout.write(
  `\nFixture evaluation summary: ${passed} passed, ${failed} failed, ${evaluations.length} total.\n`,
);

if (failed > 0) {
  for (const evaluation of evaluations.filter((item) => !item.passed)) {
    for (const detail of failedDetails(evaluation)) {
      process.stderr.write(`${evaluation.name}: ${detail}\n`);
    }
  }
  process.exitCode = 1;
}
