import { buildFinalCuriosityMap } from "@/lib/map";
import { questTimeBudgetFor } from "@/lib/quest-time-budget";
import { SEEDED_FALLBACK_DISCLOSURE } from "@/types/curiosity";
import type {
  CuriositySession,
  EvidenceApplication,
  EvidenceBundle,
  EvidenceDecision,
  ExplorationRoute,
  QuestPlan,
  ReflectionResult,
} from "@/types/curiosity";

import {
  EVAL_FIXTURES,
  type WonderLabEvalFixture,
  type WonderLabEvalFixtureId,
} from "./fixtures";

export type DeterministicTopicFixtureId = Exclude<
  WonderLabEvalFixtureId,
  "underwater-habitat"
>;

type DeterministicTopicFixture = WonderLabEvalFixture & {
  id: DeterministicTopicFixtureId;
};

interface TopicSpec {
  id: DeterministicTopicFixtureId;
  routes: readonly [
    readonly [string, string, ExplorationRoute["lens"], string],
    readonly [string, string, ExplorationRoute["lens"], string],
    readonly [string, string, ExplorationRoute["lens"], string],
  ];
  challenge: string;
  constraints: readonly [string, string] | readonly [string, string, string];
  evidence: readonly [string, string, string, string];
  inference: string;
  openQuestion: string;
  application: string;
  artifactAnchor: string;
  questions: readonly [string, string, string];
}

const TOPIC_SPECS: readonly TopicSpec[] = [
  {
    id: "dreams",
    routes: [
      [
        "Compare explanations",
        "Compare memory, emotion, and by-product predictions.",
        "compare",
        "comparison table",
      ],
      [
        "Map sleep evidence",
        "Map which sleep findings each explanation must account for.",
        "understand",
        "evidence map",
      ],
      [
        "Design a fair test",
        "Design a study that could separate two dream explanations.",
        "create",
        "study design",
      ],
    ],
    challenge:
      "Create a browser table that compares memory processing, emotion regulation, and by-product explanations with one possible disconfirming observation for each.",
    constraints: [
      "Use all three explanations.",
      "Label observations as evidence or uncertainty.",
      "Do not make personal meaning claims from dream content.",
    ],
    evidence: [
      "Sleep research links dreaming with memory and emotion processing, but no single function explains every dream.",
      "Sleep Foundation",
      "https://www.sleepfoundation.org/dreams",
      "sleepfoundation.org",
    ],
    inference:
      "Different dream patterns may reflect more than one brain process.",
    openQuestion:
      "Which measured finding would distinguish memory processing from emotion regulation?",
    application:
      "I will keep a memory processing column separate from emotion and by-product predictions so one observation cannot prove every explanation.",
    artifactAnchor: "memory processing",
    questions: [
      "Which sleep-stage findings most clearly separate competing dream explanations?",
      "How do researchers test dream reports without assuming hidden meanings?",
      "What evidence would make a by-product account less plausible?",
    ],
  },
  {
    id: "car-free-city",
    routes: [
      [
        "Compare travel systems",
        "Compare trips by transit, freight, walking, and emergency access.",
        "compare",
        "mobility comparison",
      ],
      [
        "Map street tradeoffs",
        "Map how land use, affordability, and access interact.",
        "systems",
        "systems map",
      ],
      [
        "Design a transition",
        "Design a car-light neighborhood pilot with exceptions.",
        "create",
        "transition proposal",
      ],
    ],
    challenge:
      "Create a browser-only neighborhood mobility plan that shows transit, delivery hubs, accessible trips, and emergency routes.",
    constraints: [
      "Include freight and emergency travel.",
      "Name an accessibility accommodation.",
      "Compare travel time, cost, and emissions.",
    ],
    evidence: [
      "Cities that shift street space toward transit and active travel can reduce car dependence when reliable alternatives are available.",
      "Institute for Transportation and Development Policy",
      "https://www.itdp.org/",
      "itdp.org",
    ],
    inference:
      "A car-light plan will fail if it counts removed cars but ignores affordable access.",
    openQuestion: "How can a transition protect residents from displacement?",
    application:
      "I will add accessible on-demand vehicles and delivery hubs to my transit map instead of treating every trip as the same.",
    artifactAnchor: "delivery hubs",
    questions: [
      "Which car-light policies protect lower-income residents from displacement?",
      "How should freight deliveries be timed in a dense car-light district?",
      "What accessibility measures best complement frequent transit?",
    ],
  },
  {
    id: "earworms",
    routes: [
      [
        "Build a causal model",
        "Model repetition, familiarity, attention, and emotion.",
        "create",
        "causal diagram",
      ],
      [
        "Compare song features",
        "Compare repeated phrases with attention and memory cues.",
        "compare",
        "feature comparison",
      ],
      [
        "Trace memory loops",
        "Trace how recent exposure can restart a musical phrase.",
        "understand",
        "memory trace",
      ],
    ],
    challenge:
      "Create a causal diagram that links repetition, familiarity, attention, and emotional salience to an earworm.",
    constraints: [
      "Use at least four labeled factors.",
      "Mark one link as uncertain.",
      "Do not claim one cause explains every song.",
    ],
    evidence: [
      "Earworms are commonly associated with recent exposure, repetition, familiarity, and situations with unoccupied attention.",
      "British Psychological Society",
      "https://www.bps.org.uk/psychologist/why-do-songs-get-stuck-your-head",
      "bps.org.uk",
    ],
    inference:
      "A repeated phrase may return more easily when attention has few competing tasks.",
    openQuestion: "Why does one repeated phrase persist while another fades?",
    application:
      "I will draw attention as a separate pathway from repetition so my model can show why familiar songs do not always return.",
    artifactAnchor: "separate pathway from repetition",
    questions: [
      "Which musical features make a short phrase easier to restart mentally?",
      "How does divided attention change the chance of an earworm?",
      "Why can a familiar song disappear after repeated listening?",
    ],
  },
  {
    id: "plant-communication",
    routes: [
      [
        "Define the claim",
        "Separate signal, response, benefit, and intention.",
        "challenge",
        "claim audit",
      ],
      [
        "Compare plant signals",
        "Compare airborne chemicals, roots, and fungal-network claims.",
        "compare",
        "signal comparison",
      ],
      [
        "Design a controls test",
        "Design a browser experiment diagram with control groups.",
        "create",
        "experiment diagram",
      ],
    ],
    challenge:
      "Create a browser experiment diagram that separates a plant signal, a measured response, and an accidental chemical effect.",
    constraints: [
      "Include a control condition.",
      "Separate response from intention.",
      "Name one alternative explanation.",
    ],
    evidence: [
      "Plants can release chemical signals that alter defenses in nearby plants or attract organisms, while intent remains a separate claim.",
      "Nature Education",
      "https://www.nature.com/scitable/knowledge/library/plant-communication-13254163/",
      "nature.com",
    ],
    inference:
      "A useful response does not by itself show that a plant intended to send a message.",
    openQuestion:
      "What control best separates signaling from an accidental chemical effect?",
    application:
      "I will place a barrier control in my diagram so a nearby plant response can be compared with exposure to the suspected chemical.",
    artifactAnchor: "barrier control",
    questions: [
      "Which controls best separate plant signaling from shared environmental stress?",
      "When does a signal-response pattern justify calling it communication?",
      "How do fungal-network claims differ from direct chemical signaling?",
    ],
  },
  {
    id: "fair-games",
    routes: [
      [
        "Audit a ruleset",
        "Audit clarity, counterplay, luck, and accessibility.",
        "challenge",
        "fairness audit",
      ],
      [
        "Compare player starts",
        "Compare symmetrical and asymmetrical starting roles.",
        "compare",
        "start-state comparison",
      ],
      [
        "Prototype a rule",
        "Prototype one rule change and predict player responses.",
        "create",
        "rule prototype",
      ],
    ],
    challenge:
      "Create a browser scorecard for a sample game and propose one rule change with a predicted player response.",
    constraints: [
      "Assess rule clarity and counterplay.",
      "Include luck or hidden information.",
      "Consider an accessibility impact.",
    ],
    evidence: [
      "Game fairness can depend on understandable rules, meaningful choices, counterplay, and balanced opportunities rather than identical starting resources.",
      "MIT Game Lab",
      "https://gamelab.mit.edu/",
      "gamelab.mit.edu",
    ],
    inference:
      "An asymmetrical role can be fair if players can understand and answer its advantages.",
    openQuestion:
      "How much randomness preserves surprise without making skill irrelevant?",
    application:
      "I will add a visible counterplay option to the stronger starting role so the scorecard tests response opportunities, not just equal resources.",
    artifactAnchor: "counterplay option",
    questions: [
      "How can a game measure counterplay without removing strategic asymmetry?",
      "When does randomness help newer players without erasing skill?",
      "Which accessibility choices change what fair competition means?",
    ],
  },
  {
    id: "living-computer",
    routes: [
      [
        "Compare substrates",
        "Compare cellular sensing and silicon computing constraints.",
        "compare",
        "substrate comparison",
      ],
      [
        "Map a biosensor",
        "Map input, cellular logic, output, and containment.",
        "systems",
        "biosensor system map",
      ],
      [
        "Design safe logic",
        "Design a conceptual cellular logic diagram without lab steps.",
        "create",
        "logic diagram",
      ],
    ],
    challenge:
      "Create a browser-only block diagram for a hypothetical biosensor with input, cellular logic, measurable output, error controls, and containment.",
    constraints: [
      "Do not propose wet-lab procedures.",
      "Compare speed and reliability with silicon.",
      "Include an error-control or containment boundary.",
    ],
    evidence: [
      "Synthetic biology can use living cells to sense inputs and produce measurable outputs, but reliability and containment constrain applications.",
      "National Human Genome Research Institute",
      "https://www.genome.gov/about-genomics/policy-issues/Synthetic-Biology",
      "genome.gov",
    ],
    inference:
      "Living-cell computing may fit specialized sensing better than general-purpose computing.",
    openQuestion:
      "Which problem benefits enough from biological sensing to justify extra uncertainty?",
    application:
      "I will make the measurable output and containment boundary explicit in my biosensor block diagram before comparing it with silicon speed.",
    artifactAnchor: "measurable output",
    questions: [
      "Which sensing tasks are uniquely suited to living-cell logic?",
      "How could a biosensor communicate uncertainty to a human operator?",
      "What containment boundary is appropriate for a conceptual cellular device?",
    ],
  },
  {
    id: "money",
    routes: [
      [
        "Compare exchange systems",
        "Compare barter, commodity money, currency, and ledgers.",
        "compare",
        "exchange comparison",
      ],
      [
        "Map trust and debt",
        "Map institutions, obligations, and trust failures.",
        "systems",
        "trust system map",
      ],
      [
        "Design a local currency",
        "Design a fictional currency and its trust rules.",
        "create",
        "currency proposal",
      ],
    ],
    challenge:
      "Create a browser comparison of barter, commodity money, state currency, and digital ledgers, including who maintains trust.",
    constraints: [
      "Compare portability and stability.",
      "Name an inclusion risk.",
      "Explain one trust failure.",
    ],
    evidence: [
      "Money serves as a medium of exchange, unit of account, and store of value when people accept shared rules and institutions.",
      "Federal Reserve Education",
      "https://www.federalreserveeducation.org/",
      "federalreserveeducation.org",
    ],
    inference:
      "Money coordinates obligations among strangers as well as making barter easier.",
    openQuestion:
      "How can a currency remain stable when users disagree about governance?",
    application:
      "I will include a trust-maintainer row in my comparison so each exchange system shows who records obligations and what happens when confidence fails.",
    artifactAnchor: "trust maintainer row",
    questions: [
      "Which institutions make a currency credible during a trust crisis?",
      "How do digital ledgers change inclusion and enforcement tradeoffs?",
      "Why do communities sometimes prefer local currencies?",
    ],
  },
  {
    id: "relativity-time",
    routes: [
      [
        "Compare clocks",
        "Compare stationary, moving, and higher-altitude clocks.",
        "compare",
        "clock comparison",
      ],
      [
        "Map reference frames",
        "Map which observations depend on motion and gravity.",
        "understand",
        "reference-frame map",
      ],
      [
        "Design a navigation model",
        "Design a conceptual timing-correction model for navigation.",
        "create",
        "timing model",
      ],
    ],
    challenge:
      "Create a browser comparison of stationary, moving, and higher-altitude clocks, labeling measured differences and observer-dependent descriptions.",
    constraints: [
      "Include motion and gravity.",
      "Separate measured clock rates from everyday intuition.",
      "Use no numerical calculation requirement.",
    ],
    evidence: [
      "Relativity predicts and experiments measure differences in clock rates caused by relative motion and gravity.",
      "NASA",
      "https://science.nasa.gov/universe/what-is-relativity/",
      "nasa.gov",
    ],
    inference:
      "Navigation systems need timing corrections because tiny clock differences accumulate.",
    openQuestion:
      "How do navigation systems combine motion and gravity corrections?",
    application:
      "I will give each clock a motion and gravity label so my navigation model shows why measured timing differences can accumulate.",
    artifactAnchor: "motion and gravity label",
    questions: [
      "How are motion and gravity corrections combined in navigation timing?",
      "Which clock experiments make relativistic time differences easiest to observe?",
      "Why do everyday clocks seem synchronized despite measurable differences?",
    ],
  },
  {
    id: "school-food-waste",
    routes: [
      [
        "Measure the waste",
        "Compare discarded foods, portions, and participation.",
        "understand",
        "waste audit",
      ],
      [
        "Design a pilot",
        "Design a limited portion and menu-feedback pilot.",
        "create",
        "pilot proposal",
      ],
      [
        "Map cafeteria systems",
        "Map kitchen forecasts, student choice, donation, and compost.",
        "systems",
        "cafeteria system map",
      ],
    ],
    challenge:
      "Create a browser pilot plan that compares anonymous waste categories, smaller default portions, free seconds, and student taste feedback.",
    constraints: [
      "Use aggregate rather than personal data.",
      "Track waste mass and meal participation.",
      "Protect nutrition and kitchen practicality.",
    ],
    evidence: [
      "Food-waste prevention works best when measurement, portioning, menu planning, and recovery options are considered together.",
      "U.S. Environmental Protection Agency",
      "https://www.epa.gov/recycle/reducing-wasted-food-home",
      "epa.gov",
    ],
    inference:
      "A smaller default portion may reduce waste only if students can easily take free seconds.",
    openQuestion:
      "Which intervention reduces waste without lowering nutrition or participation?",
    application:
      "I will pair smaller default portions with free seconds and track participation so the pilot does not reduce waste by leaving students hungry.",
    artifactAnchor: "smaller default portions",
    questions: [
      "Which anonymous waste category best identifies a high-impact menu change?",
      "How can a school protect nutrition while testing smaller default portions?",
      "When should donation or composting follow prevention efforts?",
    ],
  },
];

export interface DeterministicTopicEvaluation {
  fixture: DeterministicTopicFixture;
  routes: [ExplorationRoute, ExplorationRoute, ExplorationRoute];
  quest: QuestPlan;
  evidence: EvidenceBundle;
  decision: EvidenceDecision;
  application: EvidenceApplication;
  reflection: ReflectionResult;
  map: ReturnType<typeof buildFinalCuriosityMap>;
  session: CuriositySession;
}

function fixtureFor(id: TopicSpec["id"]): DeterministicTopicFixture {
  const fixture = EVAL_FIXTURES.find((item) => item.id === id);
  if (!fixture) throw new Error(`Missing evaluation fixture: ${id}`);
  return { ...fixture, id };
}

function buildTopicEvaluation(spec: TopicSpec): DeterministicTopicEvaluation {
  const fixture = fixtureFor(spec.id);
  const routes = spec.routes.map(
    ([title, hook, lens, activityType], index) => ({
      id: `${fixture.id}-${index + 1}`,
      title,
      hook,
      lens,
      activityType,
      estimatedMinutes: Math.min(fixture.durationMinutes, 15),
      iconKey: ["compass", "layers", "sparkles"][index],
    }),
  ) as [ExplorationRoute, ExplorationRoute, ExplorationRoute];
  const quest: QuestPlan = {
    routeId: routes[0].id,
    timeBudget: questTimeBudgetFor(fixture.durationMinutes),
    drivingQuestion: fixture.question,
    predictionPrompt: `Before investigating, predict which part of your idea about ${fixture.question.toLocaleLowerCase("en-US")} is most important and explain why.`,
    investigationPrompt: `Use your route to compare evidence, inference, and uncertainty about ${fixture.question.toLocaleLowerCase("en-US")}.`,
    creationChallenge: spec.challenge,
    constraints: [...spec.constraints].slice(
      0,
      fixture.durationMinutes === 5
        ? 2
        : fixture.durationMinutes === 10
          ? 3
          : 4,
    ),
    completionCriteria: [
      "Show a clear claim, evidence boundary, and one tradeoff.",
    ],
    safetyNote:
      "Keep this as a browser-based reasoning activity; do not treat it as medical, legal, or technical instruction.",
    hint: "Start by turning one assumption from your prediction into a labeled comparison.",
  };
  const evidence: EvidenceBundle = {
    items: [
      {
        id: "finding",
        kind: "evidence",
        statement: spec.evidence[0],
        sourceIds: ["source"],
      },
      {
        id: "inference",
        kind: "inference",
        statement: spec.inference,
        sourceIds: [],
      },
      {
        id: "open-question",
        kind: "open_question",
        statement: spec.openQuestion,
        sourceIds: [],
      },
    ],
    sources: [
      {
        id: "source",
        title: spec.evidence[1],
        url: spec.evidence[2],
        domain: spec.evidence[3],
      },
    ],
    conciseExplanation: `This topic separates one sourced finding from an inference and an open question about ${fixture.question.toLocaleLowerCase("en-US")}.`,
    uncertaintyNote:
      "The cited finding is a starting point; it does not settle every causal or design question.",
  };
  const decision: EvidenceDecision = {
    evidenceItemId: "finding",
    relationship: "supports",
    establishes: spec.evidence[0],
    unresolved: fixture.reflection.stillWonder,
    impact: spec.application,
  };
  const application: EvidenceApplication = {
    evidenceItemId: "finding",
    designChoice: spec.application,
    artifactAnchor: spec.artifactAnchor,
  };
  const reflection: ReflectionResult = {
    specificFeedback: `You marked this finding as evidence that supports your prediction: ${spec.evidence[0]} Your reason keeps ${fixture.reflection.stillWonder} unresolved. Your evidence-to-design link is concrete: ${spec.application}`,
    discoverySummary: `Your ${fixture.question.toLocaleLowerCase("en-US")} model now joins a sourced finding, a bounded inference, and a practical design choice.`,
    changedThinking: `You moved from "${fixture.reflection.usedToThink}" to "${fixture.reflection.nowThink}".`,
    keyTradeoff:
      "Your artifact weighs a practical design choice against the limits named in the evidence.",
    newQuestions: [...spec.questions] as [string, string, string],
    mapDeltas: [
      {
        nodeId: "reflection",
        kind: "reflection",
        label: "Changed model",
        detail: fixture.reflection.nowThink,
        parentNodeId: "creation",
      },
      ...spec.questions.map((label, index) => ({
        nodeId: `next-question-${index + 1}`,
        kind: "next_question" as const,
        label,
        parentNodeId: "reflection",
      })),
    ],
  };
  const session: CuriositySession = {
    id: `deterministic-${fixture.id}`,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    question: fixture.question,
    level: fixture.level,
    durationMinutes: fixture.durationMinutes,
    routes,
    selectedRouteId: routes[0].id,
    quest,
    prediction: fixture.prediction,
    evidence,
    evidenceDecision: decision,
    evidenceApplication: application,
    artifact: fixture.artifact,
    reflectionInput: fixture.reflection,
    reflectionResult: reflection,
    selectedNextQuestionId: "next-question-1",
    mode: "seeded_fallback",
    seededDisclosure: SEEDED_FALLBACK_DISCLOSURE,
    step: "branch",
  };
  const map = buildFinalCuriosityMap(session);
  const completedSession: CuriositySession = { ...session, map };
  return {
    fixture,
    routes,
    quest,
    evidence,
    decision,
    application,
    reflection,
    map,
    session: completedSession,
  };
}

export const DETERMINISTIC_TOPIC_EVALUATIONS =
  TOPIC_SPECS.map(buildTopicEvaluation);
