import seededDemoJson from "@/data/demo-underwater.json";
import { seededEvidenceForRoute } from "@/lib/seeded-evidence";
import { seededDemoSessionSchema } from "@/lib/schemas";
import { buildSeededReflection } from "@/lib/seeded-reflection";
import type { ExplorationRoute, QuestPlan } from "@/types/curiosity";

// This module is loaded only by the explicit demo path. Keeping the fixture
// and its provider-free helpers together prevents a normal live quest from
// downloading or parsing the full scripted journey.
export const seededDemo = seededDemoSessionSchema.parse(seededDemoJson);

export function seededQuestForRoute(route: ExplorationRoute): QuestPlan {
  const seededQuest = seededDemo.quest as QuestPlan;
  if (route.id === seededQuest.routeId) return seededQuest;

  if (route.lens === "challenge") {
    return {
      ...seededQuest,
      routeId: route.id,
      drivingQuestion:
        "When would an underwater settlement help people, and when would its ecological cost make it a bad idea?",
      predictionPrompt:
        "Predict which ecosystem risk would be hardest to control—continuous sound, wastewater discharge, or physical habitat disturbance—and explain what should count as a deal-breaker.",
      investigationPrompt:
        "Test your prediction against evidence about ocean sound, water-discharge controls, and the site-specific questions those sources cannot answer.",
      creationChallenge:
        "Make one evidence-driven go, revise, or no-go decision for a 100-person underwater habitat: name one ecosystem risk, one measurable limit, and one tradeoff.",
      constraints: [
        "Use one Evidence Lens finding to connect the decision to the named risk.",
        "State one uncertainty that could change the decision.",
      ],
      completionCriteria: [
        "State the decision, risk and limit, source-grounded reason, and one uncertainty or tradeoff.",
      ],
      hint: "A strong environmental rule names both the signal to measure and the action triggered when its limit is crossed.",
    };
  }

  return {
    ...seededQuest,
    routeId: route.id,
    drivingQuestion:
      "How do pressure, access, and system failure change as an underwater habitat moves deeper?",
    predictionPrompt:
      "Choose a depth range for an underwater habitat and predict which failure becomes more difficult there. Explain the causal chain behind your choice.",
    investigationPrompt:
      "Compare your causal model with evidence about ocean pressure, pressure-managed entry, and surface-linked support in an operating undersea lab.",
    creationChallenge:
      "Make one evidence-driven design choice for a habitat at a chosen depth: name one pressure or access risk, one support response, and one tradeoff.",
    constraints: [
      "Use one Evidence Lens finding to connect the chosen depth to the risk.",
      "State one uncertainty that limits the model.",
    ],
    completionCriteria: [
      "State the depth, risk, response, evidence-grounded reason, and one tradeoff or uncertainty.",
    ],
    hint: "Start with pressure increasing with depth, then ask what that changes about walls, entrances, repairs, and escape time.",
  };
}

export { buildSeededReflection, seededEvidenceForRoute };
