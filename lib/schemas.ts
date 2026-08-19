import { z } from "zod";

import {
  ARTIFACT_ANCHOR_MAX_CHARACTERS,
  ARTIFACT_ANCHOR_MAX_WORDS,
  ARTIFACT_ANCHOR_MIN_WORDS,
  artifactAnchorHasSpecificWords,
  artifactAnchorWordCount,
  validateEvidenceApplicationArtifact,
} from "@/lib/evidence-application";
import { validateRouteDiversity } from "@/lib/route-diversity";
import {
  isQuestTimeBudgetForDuration,
  questWorkloadLimitsFor,
  timeBudgetTotal,
} from "@/lib/quest-time-budget";
import {
  NEXT_QUESTION_IDS,
  SEEDED_FALLBACK_DISCLOSURE,
} from "@/types/curiosity";

const trimmedText = (minimum: number, maximum: number, label: string) =>
  z
    .string()
    .trim()
    .min(minimum, `${label} must be at least ${minimum} characters.`)
    .max(maximum, `${label} must be at most ${maximum} characters.`);

const uniqueStrings = (
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
) => {
  const normalized = values.map((value) =>
    value.trim().toLocaleLowerCase("en-US"),
  );
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({ code: "custom", message, path });
  }
};

export const learnerLevelSchema = z.enum([
  "high_school",
  "college",
  "curious_adult",
]);

export const questDurationSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
]);

export const questTimeBudgetSchema = z
  .object({
    totalMinutes: questDurationSchema,
    steps: z
      .object({
        choose: z.number().multipleOf(0.5).min(0.5).max(15),
        predict: z.number().multipleOf(0.5).min(0.5).max(15),
        investigate: z.number().multipleOf(0.5).min(0.5).max(15),
        create: z.number().multipleOf(0.5).min(0.5).max(15),
        reflect: z.number().multipleOf(0.5).min(0.5).max(15),
        branch: z.number().multipleOf(0.5).min(0.5).max(15),
      })
      .strict(),
  })
  .strict()
  .superRefine((budget, ctx) => {
    if (timeBudgetTotal(budget) !== budget.totalMinutes) {
      ctx.addIssue({
        code: "custom",
        message: "Quest time-budget steps must sum to the total minutes.",
        path: ["steps"],
      });
    }
    if (!isQuestTimeBudgetForDuration(budget, budget.totalMinutes)) {
      ctx.addIssue({
        code: "custom",
        message: "Quest time budget must use the canonical duration profile.",
        path: ["steps"],
      });
    }
  });

export const sessionModeSchema = z.enum(["live", "seeded_fallback"]);

export const questStepSchema = z.enum([
  "spark",
  "choose",
  "predict",
  "investigate",
  "create",
  "reflect",
  "branch",
]);

export const questionSchema = trimmedText(3, 300, "Question");

export const predictionSchema = trimmedText(10, 1_000, "Prediction");

export const artifactSchema = trimmedText(10, 5_000, "Learner artifact");

export const safetyIdentifierSchema = z
  .string()
  .trim()
  .min(8, "Anonymous safety identifier is missing.")
  .max(64, "Anonymous safety identifier is too long.")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Anonymous safety identifier contains unsupported characters.",
  );

export const thinkingLensSchema = z.enum([
  "understand",
  "challenge",
  "create",
  "compare",
  "systems",
]);

export const explorationRouteSchema = z
  .object({
    id: trimmedText(2, 64, "Route ID").regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Route ID must be a lowercase slug.",
    ),
    title: trimmedText(3, 60, "Route title"),
    hook: trimmedText(10, 180, "Route hook"),
    lens: thinkingLensSchema,
    activityType: trimmedText(3, 60, "Activity type"),
    estimatedMinutes: z.number().int().min(1).max(15),
    iconKey: trimmedText(2, 32, "Icon key").regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Icon key must be a lowercase slug.",
    ),
  })
  .strict();

export const routesResponseSchema = z
  .object({
    routes: z.tuple([
      explorationRouteSchema,
      explorationRouteSchema,
      explorationRouteSchema,
    ]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const result = validateRouteDiversity(value.routes);
    for (const issue of result.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: ["routes"],
      });
    }
  });

const questPlanBaseSchema = z
  .object({
    routeId: trimmedText(2, 64, "Route ID"),
    timeBudget: questTimeBudgetSchema,
    drivingQuestion: trimmedText(10, 240, "Driving question"),
    predictionPrompt: trimmedText(20, 360, "Prediction prompt"),
    investigationPrompt: trimmedText(15, 360, "Investigation prompt"),
    creationChallenge: trimmedText(20, 600, "Creation challenge"),
    constraints: z
      .array(trimmedText(5, 180, "Constraint"))
      .min(2)
      .max(4),
    completionCriteria: z
      .array(trimmedText(5, 180, "Completion criterion"))
      .min(1)
      .max(4),
    safetyNote: trimmedText(10, 280, "Safety note"),
    hint: trimmedText(10, 280, "Hint"),
  })
  .strict();

export const questPlanSchema = questPlanBaseSchema.superRefine((value, ctx) => {
  const workload = questWorkloadLimitsFor(value.timeBudget.totalMinutes);
  if (
    value.constraints.length < workload.constraints.min ||
    value.constraints.length > workload.constraints.max
  ) {
    ctx.addIssue({
      code: "custom",
      message: `${value.timeBudget.totalMinutes}-minute quests require ${
        workload.constraints.min === workload.constraints.max
          ? `exactly ${workload.constraints.min}`
          : `${workload.constraints.min}–${workload.constraints.max}`
      } constraints.`,
      path: ["constraints"],
    });
  }
  if (
    value.completionCriteria.length < workload.completionCriteria.min ||
    value.completionCriteria.length > workload.completionCriteria.max
  ) {
    ctx.addIssue({
      code: "custom",
      message: `${value.timeBudget.totalMinutes}-minute quests require ${
        workload.completionCriteria.min === workload.completionCriteria.max
          ? `exactly ${workload.completionCriteria.min}`
          : `${workload.completionCriteria.min}–${workload.completionCriteria.max}`
      } completion ${
        workload.completionCriteria.max === 1 ? "criterion" : "criteria"
      }.`,
      path: ["completionCriteria"],
    });
  }
  uniqueStrings(
    value.constraints,
    ctx,
    ["constraints"],
    "Quest constraints must be distinct.",
  );
  uniqueStrings(
    value.completionCriteria,
    ctx,
    ["completionCriteria"],
    "Completion criteria must be distinct.",
  );
});

/**
 * Storage-only compatibility path for learner records created before focused
 * duration limits were introduced. It is intentionally unavailable to quest
 * generation and transition schemas.
 */
const legacyStoredQuestSchema = questPlanBaseSchema
  .extend({ workloadProfile: z.literal("pre_time_budget") })
  .strict()
  .superRefine((value, ctx) => {
    uniqueStrings(
      value.constraints,
      ctx,
      ["constraints"],
      "Quest constraints must be distinct.",
    );
    uniqueStrings(
      value.completionCriteria,
      ctx,
      ["completionCriteria"],
      "Completion criteria must be distinct.",
    );
  });

export const sourceReferenceSchema = z
  .object({
    id: trimmedText(2, 64, "Source ID"),
    title: trimmedText(3, 180, "Source title"),
    url: z
      .string()
      .url("Source URL must be valid.")
      .refine((url) => /^https?:\/\//i.test(url), {
        message: "Source URL must use HTTP or HTTPS.",
      }),
    domain: trimmedText(3, 120, "Source domain"),
  })
  .strict()
  .superRefine((source, ctx) => {
    let hostname: string;
    try {
      hostname = new URL(source.url).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    const declaredDomain = source.domain
      .toLocaleLowerCase("en-US")
      .replace(/^www\./, "");

    if (
      hostname !== declaredDomain &&
      !hostname.endsWith(`.${declaredDomain}`)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Source domain must match the source URL.",
        path: ["domain"],
      });
    }
  });

export const evidenceKindSchema = z.enum([
  "evidence",
  "inference",
  "open_question",
]);

export const evidenceItemIdSchema = trimmedText(
  2,
  64,
  "Evidence item ID",
).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "Evidence item ID must be a lowercase slug.",
);

export const evidenceItemSchema = z
  .object({
    id: evidenceItemIdSchema,
    kind: evidenceKindSchema,
    statement: trimmedText(15, 420, "Evidence statement"),
    sourceIds: z.array(trimmedText(2, 64, "Source ID")).max(4),
  })
  .strict()
  .superRefine((item, ctx) => {
    uniqueStrings(
      item.sourceIds,
      ctx,
      ["sourceIds"],
      "An evidence item cannot cite the same source twice.",
    );

    if (item.kind === "evidence" && item.sourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Evidence items must cite at least one returned source.",
        path: ["sourceIds"],
      });
    }
  });

export const evidenceBundleSchema = z
  .object({
    items: z.array(evidenceItemSchema).min(2).max(4),
    sources: z.array(sourceReferenceSchema).min(1).max(8),
    conciseExplanation: trimmedText(20, 1_500, "Concise explanation"),
    uncertaintyNote: trimmedText(10, 400, "Uncertainty note").optional(),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    uniqueStrings(
      bundle.items.map((item) => item.id),
      ctx,
      ["items"],
      "Evidence item IDs must be unique.",
    );
    uniqueStrings(
      bundle.sources.map((source) => source.id),
      ctx,
      ["sources"],
      "Source IDs must be unique.",
    );

    const sourceIds = new Set(bundle.sources.map((source) => source.id));
    for (const [itemIndex, item] of bundle.items.entries()) {
      for (const [sourceIndex, sourceId] of item.sourceIds.entries()) {
        if (!sourceIds.has(sourceId)) {
          ctx.addIssue({
            code: "custom",
            message: `Evidence item references unknown source “${sourceId}”.`,
            path: ["items", itemIndex, "sourceIds", sourceIndex],
          });
        }
      }
    }

    if (!bundle.items.some((item) => item.kind === "evidence")) {
      ctx.addIssue({
        code: "custom",
        message:
          "An Evidence Lens must contain at least one sourced evidence item.",
        path: ["items"],
      });
    }
  });

export const evidenceRelationshipSchema = z.enum([
  "supports",
  "challenges",
  "complicates",
]);

export const evidenceDecisionSchema = z
  .object({
    evidenceItemId: evidenceItemIdSchema,
    relationship: evidenceRelationshipSchema,
    establishes: trimmedText(15, 300, "What the sources establish"),
    unresolved: trimmedText(15, 300, "What remains unresolved"),
    impact: trimmedText(15, 300, "Prediction impact"),
  })
  .strict();

export const evidenceApplicationSchema = z
  .object({
    evidenceItemId: evidenceItemIdSchema,
    designChoice: trimmedText(20, 400, "Evidence-to-design choice"),
    artifactAnchor: trimmedText(
      3,
      ARTIFACT_ANCHOR_MAX_CHARACTERS,
      "Creation anchor",
    )
      .refine((value) => {
        const wordCount = artifactAnchorWordCount(value);
        return (
          wordCount >= ARTIFACT_ANCHOR_MIN_WORDS &&
          wordCount <= ARTIFACT_ANCHOR_MAX_WORDS
        );
      }, `Creation anchor must contain ${ARTIFACT_ANCHOR_MIN_WORDS}–${ARTIFACT_ANCHOR_MAX_WORDS} words.`)
      .refine(
        artifactAnchorHasSpecificWords,
        "Creation anchor must contain at least two specific words.",
      )
      .optional(),
  })
  .strict();

export const reflectionInputSchema = z
  .object({
    usedToThink: trimmedText(5, 800, "I used to think"),
    nowThink: trimmedText(5, 800, "Now I think"),
    stillWonder: trimmedText(5, 800, "I still wonder"),
  })
  .strict();

const nextQuestionSchema = trimmedText(10, 240, "Next question").refine(
  (question) => question.endsWith("?"),
  "Next questions must use question form.",
);

export const nextQuestionIdSchema = z.enum(NEXT_QUESTION_IDS);

export const mapNodeKindSchema = z.enum([
  "question",
  "route",
  "prediction",
  "evidence",
  "creation",
  "reflection",
  "next_question",
]);

export const semanticMapDeltaSchema = z
  .object({
    nodeId: trimmedText(2, 64, "Map delta node ID"),
    kind: z.enum(["reflection", "next_question"]),
    label: trimmedText(3, 120, "Map delta label"),
    detail: trimmedText(3, 360, "Map delta detail").optional(),
    parentNodeId: trimmedText(2, 64, "Map delta parent ID"),
  })
  .strict();

export const reflectionResultSchema = z
  .object({
    specificFeedback: trimmedText(30, 800, "Specific feedback"),
    discoverySummary: trimmedText(20, 700, "Discovery summary"),
    changedThinking: trimmedText(15, 500, "Changed-thinking summary"),
    keyTradeoff: trimmedText(8, 300, "Key tradeoff").optional(),
    newQuestions: z.tuple([
      nextQuestionSchema,
      nextQuestionSchema,
      nextQuestionSchema,
    ]),
    mapDeltas: z.array(semanticMapDeltaSchema).min(1).max(4),
  })
  .strict()
  .superRefine((result, ctx) => {
    uniqueStrings(
      result.newQuestions,
      ctx,
      ["newQuestions"],
      "The three next questions must be distinct.",
    );
    uniqueStrings(
      result.mapDeltas.map((delta) => delta.nodeId),
      ctx,
      ["mapDeltas"],
      "Semantic map delta node IDs must be unique.",
    );
  });

export const curiosityMapNodeSchema = z
  .object({
    id: trimmedText(2, 64, "Map node ID"),
    kind: mapNodeKindSchema,
    label: trimmedText(2, 140, "Map node label"),
    detail: trimmedText(3, 500, "Map node detail").optional(),
  })
  .strict();

export const curiosityMapEdgeSchema = z
  .object({
    id: trimmedText(2, 64, "Map edge ID"),
    source: trimmedText(2, 64, "Map edge source"),
    target: trimmedText(2, 64, "Map edge target"),
    label: trimmedText(2, 80, "Map edge label").optional(),
  })
  .strict();

function validateMap(
  map: {
    nodes: Array<{ id: string; kind: string }>;
    edges: Array<{ id: string; source: string; target: string }>;
  },
  ctx: z.RefinementCtx,
) {
  uniqueStrings(
    map.nodes.map((node) => node.id),
    ctx,
    ["nodes"],
    "Map node IDs must be unique.",
  );
  uniqueStrings(
    map.edges.map((edge) => edge.id),
    ctx,
    ["edges"],
    "Map edge IDs must be unique.",
  );

  const nodeIds = new Set(map.nodes.map((node) => node.id));
  for (const [edgeIndex, edge] of map.edges.entries()) {
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: "custom",
        message: `Map edge references unknown source node “${edge.source}”.`,
        path: ["edges", edgeIndex, "source"],
      });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        message: `Map edge references unknown target node “${edge.target}”.`,
        path: ["edges", edgeIndex, "target"],
      });
    }
    if (edge.source === edge.target) {
      ctx.addIssue({
        code: "custom",
        message: "Map edges cannot connect a node to itself.",
        path: ["edges", edgeIndex],
      });
    }
  }
}

export const curiosityMapSchema = z
  .object({
    nodes: z.array(curiosityMapNodeSchema).min(1).max(10),
    edges: z.array(curiosityMapEdgeSchema).max(12),
  })
  .strict()
  .superRefine(validateMap);

const FINAL_NODE_COUNTS = {
  question: 1,
  route: 1,
  prediction: 1,
  evidence: 1,
  creation: 1,
  reflection: 1,
  next_question: 3,
} as const;

export const finalCuriosityMapSchema = curiosityMapSchema.superRefine(
  (map, ctx) => {
    if (map.nodes.length !== 9) {
      ctx.addIssue({
        code: "custom",
        message: "A completed Curiosity Map must contain exactly 9 nodes.",
        path: ["nodes"],
      });
    }
    if (map.edges.length !== 8) {
      ctx.addIssue({
        code: "custom",
        message: "A completed Curiosity Map must contain exactly 8 edges.",
        path: ["edges"],
      });
    }

    for (const [kind, expectedCount] of Object.entries(FINAL_NODE_COUNTS)) {
      const actualCount = map.nodes.filter((node) => node.kind === kind).length;
      if (actualCount !== expectedCount) {
        ctx.addIssue({
          code: "custom",
          message: `A completed Curiosity Map requires ${expectedCount} ${kind} node(s); received ${actualCount}.`,
          path: ["nodes"],
        });
      }
    }

    const questionNode = map.nodes.find((node) => node.kind === "question");
    if (!questionNode) return;

    const reachable = new Set([questionNode.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of map.edges) {
        if (reachable.has(edge.source) && !reachable.has(edge.target)) {
          reachable.add(edge.target);
          changed = true;
        }
      }
    }

    if (reachable.size !== map.nodes.length) {
      ctx.addIssue({
        code: "custom",
        message:
          "Every completed map node must be reachable from the starting question.",
        path: ["edges"],
      });
    }
  },
);

export const routesRequestSchema = z
  .object({
    question: questionSchema,
    level: learnerLevelSchema,
    durationMinutes: questDurationSchema,
    safetyIdentifier: safetyIdentifierSchema,
  })
  .strict();

export const questRequestSchema = z
  .object({
    question: questionSchema,
    level: learnerLevelSchema,
    durationMinutes: questDurationSchema,
    selectedRoute: explorationRouteSchema,
    safetyIdentifier: safetyIdentifierSchema,
  })
  .strict();

export const evidenceRequestSchema = z
  .object({
    question: questionSchema,
    selectedRoute: explorationRouteSchema,
    prediction: predictionSchema,
    level: learnerLevelSchema,
    durationMinutes: questDurationSchema,
    safetyIdentifier: safetyIdentifierSchema,
  })
  .strict();

export const reflectRequestSchema = z
  .object({
    question: questionSchema,
    route: explorationRouteSchema,
    prediction: predictionSchema,
    evidence: evidenceBundleSchema,
    evidenceDecision: evidenceDecisionSchema,
    evidenceApplication: evidenceApplicationSchema,
    artifact: artifactSchema,
    reflection: reflectionInputSchema,
    safetyIdentifier: safetyIdentifierSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    // This is an internal-consistency check over client-supplied context, not
    // server-attested provenance. Shared/graded records would need a signed
    // evidence capability or another server-side trust boundary.
    const selectedEvidence = request.evidence.items.find(
      (item) => item.id === request.evidenceDecision.evidenceItemId,
    );
    if (
      !selectedEvidence ||
      selectedEvidence.kind !== "evidence" ||
      selectedEvidence.sourceIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "The learner evidence decision must reference a source-backed finding in the submitted Evidence Lens.",
        path: ["evidenceDecision", "evidenceItemId"],
      });
    }
    if (
      request.evidenceApplication.evidenceItemId !==
      request.evidenceDecision.evidenceItemId
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "The evidence-to-design link must reference the finding the learner judged.",
        path: ["evidenceApplication", "evidenceItemId"],
      });
    }
    const applicationArtifact = validateEvidenceApplicationArtifact(
      request.evidenceApplication,
      request.artifact,
    );
    if (!applicationArtifact.success) {
      ctx.addIssue({
        code: "custom",
        message:
          applicationArtifact.message ??
          "The creation must visibly carry the evidence-driven design move.",
        path:
          applicationArtifact.field === "artifact"
            ? ["artifact"]
            : ["evidenceApplication", "artifactAnchor"],
      });
    }
  });

const STEP_INDEX = {
  spark: 0,
  choose: 1,
  predict: 2,
  investigate: 3,
  create: 4,
  reflect: 5,
  branch: 6,
} as const;

export const curiositySessionSchema = z
  .object({
    id: trimmedText(3, 128, "Session ID"),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    question: questionSchema,
    level: learnerLevelSchema,
    durationMinutes: questDurationSchema,
    routes: z.array(explorationRouteSchema).max(3),
    selectedRouteId: trimmedText(2, 64, "Selected route ID").optional(),
    quest: z.union([questPlanSchema, legacyStoredQuestSchema]).optional(),
    prediction: predictionSchema.optional(),
    evidence: evidenceBundleSchema.optional(),
    evidenceDecision: evidenceDecisionSchema.optional(),
    evidenceApplication: evidenceApplicationSchema.optional(),
    artifact: artifactSchema.optional(),
    reflectionInput: reflectionInputSchema.optional(),
    reflectionResult: reflectionResultSchema.optional(),
    selectedNextQuestionId: nextQuestionIdSchema.optional(),
    map: curiosityMapSchema.optional(),
    mode: sessionModeSchema,
    seededDisclosure: z.string().optional(),
    step: questStepSchema,
  })
  .strict()
  .superRefine((session, ctx) => {
    const stepIndex = STEP_INDEX[session.step];

    if (Date.parse(session.updatedAt) < Date.parse(session.createdAt)) {
      ctx.addIssue({
        code: "custom",
        message: "Session updatedAt cannot be earlier than createdAt.",
        path: ["updatedAt"],
      });
    }

    if (session.mode === "seeded_fallback") {
      if (session.seededDisclosure !== SEEDED_FALLBACK_DISCLOSURE) {
        ctx.addIssue({
          code: "custom",
          message:
            "Seeded fallback sessions must carry the exact demo disclosure.",
          path: ["seededDisclosure"],
        });
      }
    } else if (session.seededDisclosure !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Live sessions cannot be labeled as seeded fallback content.",
        path: ["seededDisclosure"],
      });
    }

    if (stepIndex >= STEP_INDEX.choose) {
      if (session.routes.length !== 3) {
        ctx.addIssue({
          code: "custom",
          message: "Choose and later steps require exactly 3 routes.",
          path: ["routes"],
        });
      } else {
        const diversity = validateRouteDiversity(session.routes);
        for (const issue of diversity.issues) {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: ["routes"],
          });
        }
      }
    }

    if (session.selectedRouteId !== undefined) {
      if (
        !session.routes.some((route) => route.id === session.selectedRouteId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Selected route ID must reference one of the three routes.",
          path: ["selectedRouteId"],
        });
      }
    }

    if (
      session.quest &&
      session.quest.timeBudget.totalMinutes !== session.durationMinutes
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Quest time budget must match the selected quest duration.",
        path: ["quest", "timeBudget", "totalMinutes"],
      });
    }

    if (stepIndex >= STEP_INDEX.predict) {
      if (!session.selectedRouteId) {
        ctx.addIssue({
          code: "custom",
          message: "Predict and later steps require a selected route.",
          path: ["selectedRouteId"],
        });
      }
      if (!session.quest) {
        ctx.addIssue({
          code: "custom",
          message: "Predict and later steps require a quest plan.",
          path: ["quest"],
        });
      }
    }

    if (
      session.quest &&
      session.selectedRouteId &&
      session.quest.routeId !== session.selectedRouteId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Quest plan must belong to the selected route.",
        path: ["quest", "routeId"],
      });
    }

    if (session.evidenceDecision) {
      const selectedEvidence = session.evidence?.items.find(
        (item) => item.id === session.evidenceDecision?.evidenceItemId,
      );
      if (
        !selectedEvidence ||
        selectedEvidence.kind !== "evidence" ||
        selectedEvidence.sourceIds.length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "The learner evidence decision must reference a source-backed evidence item in the current Evidence Lens.",
          path: ["evidenceDecision", "evidenceItemId"],
        });
      }
    }

    if (
      session.evidenceApplication &&
      session.evidenceApplication.evidenceItemId !==
        session.evidenceDecision?.evidenceItemId
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "The learner's evidence-to-design link must reference their selected evidence finding.",
        path: ["evidenceApplication", "evidenceItemId"],
      });
    }

    if (
      session.selectedNextQuestionId !== undefined &&
      session.step !== "branch"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "A next question can only be selected during the Branch step.",
        path: ["selectedNextQuestionId"],
      });
    }

    if (
      session.selectedNextQuestionId &&
      session.reflectionResult &&
      session.map
    ) {
      const selectedNode = session.map.nodes.find(
        (node) => node.id === session.selectedNextQuestionId,
      );
      const selectedEdge = session.map.edges.find(
        (edge) =>
          edge.source === "reflection" &&
          edge.target === session.selectedNextQuestionId,
      );

      if (!selectedNode || selectedNode.kind !== "next_question") {
        ctx.addIssue({
          code: "custom",
          message:
            "The selected next question must reference its generated Curiosity Map node.",
          path: ["selectedNextQuestionId"],
        });
      }
      if (selectedEdge?.label !== "I’ll explore next") {
        ctx.addIssue({
          code: "custom",
          message:
            "The selected next-question edge must record the learner's commitment.",
          path: ["map", "edges"],
        });
      }
    }

    const requiredByStep: Array<{
      from: keyof typeof STEP_INDEX;
      value: unknown;
      path: string;
      message: string;
    }> = [
      {
        from: "investigate",
        value: session.prediction,
        path: "prediction",
        message:
          "Evidence cannot be investigated before a prediction is submitted.",
      },
      {
        from: "create",
        value: session.evidence,
        path: "evidence",
        message: "Create and later steps require an Evidence Lens.",
      },
      {
        from: "reflect",
        value: session.evidenceDecision,
        path: "evidenceDecision",
        message:
          "Reflect and later steps require the learner's evidence decision.",
      },
      {
        from: "reflect",
        value: session.evidenceApplication,
        path: "evidenceApplication",
        message: "Reflect and later steps require an evidence-to-design link.",
      },
      {
        from: "reflect",
        value: session.artifact,
        path: "artifact",
        message: "Reflect and later steps require a learner-created artifact.",
      },
      {
        from: "branch",
        value: session.reflectionInput,
        path: "reflectionInput",
        message: "Branch requires all three learner reflection fields.",
      },
      {
        from: "branch",
        value: session.reflectionResult,
        path: "reflectionResult",
        message:
          "Branch requires specific reflection feedback and next questions.",
      },
      {
        from: "branch",
        value: session.map,
        path: "map",
        message: "Branch requires a completed Curiosity Map.",
      },
    ];

    for (const requirement of requiredByStep) {
      if (
        stepIndex >= STEP_INDEX[requirement.from] &&
        requirement.value === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message: requirement.message,
          path: [requirement.path],
        });
      }
    }

    if (session.step === "branch" && session.map) {
      const finalMap = finalCuriosityMapSchema.safeParse(session.map);
      if (!finalMap.success) {
        for (const issue of finalMap.error.issues) {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: ["map", ...issue.path],
          });
        }
      }
    }
  });

export const seededDemoSessionSchema = curiositySessionSchema.superRefine(
  (session, ctx) => {
    if (
      session.quest &&
      "workloadProfile" in session.quest &&
      session.quest.workloadProfile === "pre_time_budget"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "The seeded demo fixture cannot use a legacy workload profile.",
        path: ["quest", "workloadProfile"],
      });
    }
    if (session.mode !== "seeded_fallback") {
      ctx.addIssue({
        code: "custom",
        message: "The seeded demo fixture must use seeded_fallback mode.",
        path: ["mode"],
      });
    }
    if (session.step !== "branch") {
      ctx.addIssue({
        code: "custom",
        message: "The seeded demo fixture must contain the complete flow.",
        path: ["step"],
      });
    }
    if (session.question !== "Could humans live underwater?") {
      ctx.addIssue({
        code: "custom",
        message:
          "The seeded fixture must use the canonical underwater question.",
        path: ["question"],
      });
    }
    if (!session.selectedNextQuestionId) {
      ctx.addIssue({
        code: "custom",
        message:
          "The seeded demo fixture must include the learner's next-question choice.",
        path: ["selectedNextQuestionId"],
      });
    }
    if (session.evidenceApplication && session.artifact) {
      const applicationArtifact = validateEvidenceApplicationArtifact(
        session.evidenceApplication,
        session.artifact,
      );
      if (!applicationArtifact.success) {
        ctx.addIssue({
          code: "custom",
          message:
            applicationArtifact.message ??
            "The seeded creation must visibly carry its evidence-driven design move.",
          path:
            applicationArtifact.field === "artifact"
              ? ["artifact"]
              : ["evidenceApplication", "artifactAnchor"],
        });
      }
    }
  },
);
