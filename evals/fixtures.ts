import type {
  EvidenceApplication,
  LearnerLevel,
  QuestDuration,
  ReflectionInput,
} from "@/types/curiosity";

interface WonderLabEvalFixtureShape {
  id: string;
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  prediction: string;
  artifact: string;
  evidenceApplication: Omit<EvidenceApplication, "evidenceItemId">;
  reflection: ReflectionInput;
}

/**
 * Ordinary, non-adversarial product-behavior fixtures from the authoritative
 * WonderLab build brief. The content is intentionally safe to print in a CI
 * report. Safety/boundary prompts belong in manual or access-controlled tests.
 */
export const EVAL_FIXTURES = [
  {
    id: "underwater-habitat",
    question: "Could humans live underwater?",
    level: "high_school",
    durationMinutes: 10,
    prediction:
      "Pressure will be the hardest constraint because the habitat structure must resist the surrounding ocean.",
    artifact:
      "I would place a modular habitat at a moderate depth, use surface solar plus tidal power, grow some food hydroponically, keep redundant air and repair systems, and reserve an ecological buffer. I would trade easy surface access for lower storm exposure, while accepting that redundancy increases material and maintenance needs.",
    evidenceApplication: {
      designChoice:
        "Because the finding adds a connected constraint, I will use a modular habitat with redundant systems and an ecological buffer.",
      artifactAnchor: "modular habitat",
    },
    reflection: {
      usedToThink:
        "Pressure was the only serious obstacle to living underwater.",
      nowThink:
        "Long-term maintenance, food, energy, and access form a connected system that may be harder than pressure alone.",
      stillWonder:
        "Could an underwater habitat ever become mostly self-sufficient?",
    },
  },
  {
    id: "dreams",
    question: "Why do we dream?",
    level: "high_school",
    durationMinutes: 10,
    prediction:
      "Dreams may help the brain combine recent memories with emotions, although they might not have one single function.",
    artifact:
      "I would compare three explanations—memory processing, emotion regulation, and by-product—using a table of predicted observations and evidence that could weaken each explanation. I would not treat dream content as a diagnosis.",
    evidenceApplication: {
      designChoice:
        "Because the finding does not support one dream function, I will compare memory processing with competing explanations.",
      artifactAnchor: "memory processing",
    },
    reflection: {
      usedToThink:
        "Every dream probably carried a hidden message with a specific meaning.",
      nowThink:
        "Several biological and psychological explanations can fit parts of the evidence without making every dream symbolic.",
      stillWonder:
        "Which dream findings can distinguish competing explanations rather than merely fit all of them?",
    },
  },
  {
    id: "car-free-city",
    question: "Could a city run without cars?",
    level: "college",
    durationMinutes: 15,
    prediction:
      "A dense city could reduce private cars sharply, but freight, disability access, and emergency travel would require carefully designed exceptions.",
    artifact:
      "My proposal combines frequent rail and buses, protected walking and cycling networks, neighborhood delivery hubs, accessible on-demand vehicles, and congestion pricing. I would evaluate travel time, cost, emissions, disability access, and delivery reliability rather than counting only cars removed.",
    evidenceApplication: {
      designChoice:
        "Because reliable alternatives matter, I will pair delivery hubs with accessible on-demand vehicles.",
      artifactAnchor: "delivery hubs",
    },
    reflection: {
      usedToThink:
        "Removing cars was mainly a matter of adding more public transit.",
      nowThink:
        "Land use, access, freight, street design, affordability, and service frequency have to change together.",
      stillWonder:
        "How can a car-light transition avoid displacing lower-income residents?",
    },
  },
  {
    id: "earworms",
    question: "Why do songs get stuck in our heads?",
    level: "high_school",
    durationMinutes: 5,
    prediction:
      "Short repeated musical patterns may be easy for memory to restart when attention is not occupied.",
    artifact:
      "I would build a causal model connecting repetition, familiarity, recent exposure, attention, and emotional salience, with attention as a separate pathway from repetition. Each arrow would be labeled as evidence-backed, plausible inference, or still uncertain.",
    evidenceApplication: {
      designChoice:
        "Because several factors can contribute, I will build a causal model instead of naming one cause.",
      artifactAnchor: "causal model",
    },
    reflection: {
      usedToThink:
        "A song got stuck only because I had heard it too many times.",
      nowThink:
        "Repetition matters, but memory cues, attention, familiarity, and musical structure may interact.",
      stillWonder:
        "Why do some repeated songs disappear while one particular phrase keeps returning?",
    },
  },
  {
    id: "plant-communication",
    question: "Can plants communicate?",
    level: "college",
    durationMinutes: 10,
    prediction:
      "Plants can transmit chemical or physical signals that affect other organisms, but calling every response communication may overstate intent.",
    artifact:
      "I would define communication before comparing airborne chemicals, root signals, and fungal-network claims. My comparison would use a barrier control and separate demonstrated signal and response from claims about purpose, awareness, or cooperation.",
    evidenceApplication: {
      designChoice:
        "Because intent remains uncertain, I will separate demonstrated signal and response from claims about purpose.",
      artifactAnchor: "demonstrated signal",
    },
    reflection: {
      usedToThink:
        "Plant communication meant plants were deliberately sending messages like animals do.",
      nowThink:
        "Signal, response, benefit, and intention are different claims that need different evidence.",
      stillWonder:
        "What experiment best separates a useful signal from an accidental chemical effect?",
    },
  },
  {
    id: "fair-games",
    question: "What makes a game fair?",
    level: "curious_adult",
    durationMinutes: 10,
    prediction:
      "A fair game gives players understandable rules and meaningful chances to respond, even when skill or starting roles are not identical.",
    artifact:
      "I would evaluate a sample game across rule clarity, symmetry, counterplay, hidden information, luck, accessibility, and comeback potential. I would add a counterplay option, then predict which player behavior the rule change would alter.",
    evidenceApplication: {
      designChoice:
        "Because fairness includes responses to advantages, I will evaluate counterplay alongside rule clarity.",
      artifactAnchor: "rule clarity",
    },
    reflection: {
      usedToThink:
        "Fairness meant every player started with exactly the same resources.",
      nowThink:
        "Asymmetry can still be fair when advantages, information, counterplay, and winning chances are intentionally balanced.",
      stillWonder:
        "How much randomness helps weaker players without making skill feel irrelevant?",
    },
  },
  {
    id: "living-computer",
    question: "Could we build a computer from living cells?",
    level: "college",
    durationMinutes: 15,
    prediction:
      "Living cells could implement simple sensing and logic, but speed, reliability, containment, and interfacing would limit a general-purpose computer.",
    artifact:
      "I would make a browser-only block diagram for a hypothetical biosensor: input signal, cellular logic gate, measurable output, error controls, and safe containment. I would compare it with silicon on speed, power, repair, reliability, and ethical oversight without proposing a wet-lab procedure.",
    evidenceApplication: {
      designChoice:
        "Because reliability and containment constrain the system, I will make the measurable output explicit.",
      artifactAnchor: "measurable output",
    },
    reflection: {
      usedToThink:
        "A biological computer would work like a normal laptop made from cells.",
      nowThink:
        "Cellular computing is better framed as specialized sensing and logic with very different constraints from silicon.",
      stillWonder:
        "Which real problems benefit enough from biological sensing to justify the extra uncertainty?",
    },
  },
  {
    id: "money",
    question: "Why do societies create money?",
    level: "high_school",
    durationMinutes: 10,
    prediction:
      "Money helps people exchange across time and with strangers because it provides a shared unit, store of value, and record of obligation.",
    artifact:
      "I would compare barter, commodity money, state currency, and digital ledgers using trust, divisibility, stability, portability, inclusion, and enforcement. My proposal would include a trust maintainer row explaining who records obligations and what happens when confidence fails.",
    evidenceApplication: {
      designChoice:
        "Because exchange depends on institutions, I will compare digital ledgers with other trust systems.",
      artifactAnchor: "digital ledgers",
    },
    reflection: {
      usedToThink: "Money was invented mainly because barter was inconvenient.",
      nowThink:
        "Money also coordinates trust, debt, value over time, institutions, and political authority.",
      stillWonder:
        "Can a currency remain stable when its users disagree about who should govern it?",
    },
  },
  {
    id: "relativity-time",
    question: "Is time the same everywhere?",
    level: "college",
    durationMinutes: 10,
    prediction:
      "Measured time differs slightly with relative motion and gravity, even though everyday differences are usually too small to notice.",
    artifact:
      "I would create a conceptual comparison among two stationary clocks, a fast-moving clock, and a clock at different gravitational altitude. I would give each clock a motion and gravity label, then state which differences are measured, which are observer-dependent, and which everyday intuition breaks down.",
    evidenceApplication: {
      designChoice:
        "Because measured clock rates depend on context, I will compare a clock at different gravitational altitude.",
      artifactAnchor: "different gravitational altitude",
    },
    reflection: {
      usedToThink:
        "Time passed identically everywhere and relativity only changed how events looked.",
      nowThink:
        "Clock rates themselves can differ with motion and gravity, and experiments can measure the difference.",
      stillWonder:
        "How do navigation systems combine motion and gravity corrections in practice?",
    },
  },
  {
    id: "school-food-waste",
    question: "How could a school reduce food waste?",
    level: "high_school",
    durationMinutes: 15,
    prediction:
      "Measuring which foods and serving sizes are discarded will reveal a few high-impact changes, but student choice and kitchen constraints will matter.",
    artifact:
      "My proposal uses anonymous aggregate waste categories, smaller default portions with free seconds, student taste feedback, menu forecasting, and safe donation or compost pathways. I would compare waste mass, meal participation, cost, and student satisfaction before and after a limited pilot.",
    evidenceApplication: {
      designChoice:
        "Because prevention must protect nutrition, I will pair smaller default portions with free seconds.",
      artifactAnchor: "smaller default portions",
    },
    reflection: {
      usedToThink:
        "The school could solve food waste by telling students to finish every meal.",
      nowThink:
        "Portion design, menu planning, choice, forecasting, operations, and disposal pathways all affect waste.",
      stillWonder:
        "Which intervention reduces waste without lowering nutrition or meal participation?",
    },
  },
] as const satisfies readonly WonderLabEvalFixtureShape[];

export type WonderLabEvalFixtureId = (typeof EVAL_FIXTURES)[number]["id"];

export interface WonderLabEvalFixture extends Omit<
  WonderLabEvalFixtureShape,
  "id"
> {
  id: WonderLabEvalFixtureId;
}

export const CANONICAL_EVAL_FIXTURE = EVAL_FIXTURES[0];
