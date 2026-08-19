import { conciseUnresolvedClaim } from "@/lib/evidence-decision";
import type { CuriositySession, MapNodeKind } from "@/types/curiosity";

export interface MapFallbackItem {
  id: string;
  kind: MapNodeKind;
  label: string;
  reached: boolean;
}

const summarize = (value: string, maximum = 180): string => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
};

const EVIDENCE_RELATIONSHIP_LABELS = {
  supports: "Supports prediction",
  challenges: "Challenges prediction",
  complicates: "Complicates prediction",
} as const;

/**
 * Builds an independent text journey without invoking the SVG graph builder or
 * layout engine. It remains available if either visual-map stage fails.
 */
export function buildMapFallbackItems(
  session: CuriositySession,
): MapFallbackItem[] {
  const selectedRoute = session.routes.find(
    (route) => route.id === session.selectedRouteId,
  );
  const changedThinking =
    session.reflectionResult?.changedThinking ??
    session.reflectionInput?.nowThink;
  const nextQuestions = session.reflectionResult?.newQuestions ?? [];

  return [
    {
      id: "question",
      kind: "question",
      label: summarize(session.question),
      reached: true,
    },
    {
      id: "route",
      kind: "route",
      label: selectedRoute?.title ?? "Chosen route",
      reached: Boolean(selectedRoute),
    },
    {
      id: "prediction",
      kind: "prediction",
      label: session.prediction
        ? summarize(session.prediction)
        : "Your prediction",
      reached: Boolean(session.prediction),
    },
    {
      id: "evidence",
      kind: "evidence",
      label: session.evidenceDecision
        ? summarize(
            `${EVIDENCE_RELATIONSHIP_LABELS[session.evidenceDecision.relationship]} — Source boundary: ${conciseUnresolvedClaim(session.evidenceDecision.unresolved)}`,
          )
        : session.evidence
          ? summarize(session.evidence.conciseExplanation)
          : "Evidence Lens",
      reached: Boolean(session.evidenceDecision ?? session.evidence),
    },
    {
      id: "creation",
      kind: "creation",
      label: session.evidenceApplication
        ? summarize(session.evidenceApplication.designChoice)
        : session.artifact
          ? summarize(session.artifact)
          : "Your creation",
      reached: Boolean(session.artifact),
    },
    {
      id: "reflection",
      kind: "reflection",
      label: changedThinking
        ? summarize(changedThinking)
        : "How your model changed",
      reached: Boolean(changedThinking),
    },
    ...Array.from({ length: 3 }, (_, index): MapFallbackItem => ({
      id: `next-question-${index + 1}`,
      kind: "next_question",
      label: nextQuestions[index]
        ? summarize(nextQuestions[index])
        : `Next question ${index + 1}`,
      reached: Boolean(nextQuestions[index]),
    })),
  ];
}
