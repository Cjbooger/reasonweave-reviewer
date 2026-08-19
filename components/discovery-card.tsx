"use client";

import {
  BookOpenCheck,
  BrainCircuit,
  Check,
  CircleHelp,
  Compass,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Lightbulb,
  MessageSquareText,
  PencilRuler,
  Scale,
  Search,
} from "lucide-react";
import Image from "next/image";
import { memo, type ReactNode, useMemo, useState } from "react";

import { exportSessionToMarkdown } from "@/lib/export-markdown";
import { getSelectedRoute } from "@/lib/session-machine";
import { isCanonicalUnderwaterQuestion } from "@/lib/topic-visuals";
import { NEXT_QUESTION_IDS } from "@/types/curiosity";
import type { CuriositySession } from "@/types/curiosity";

interface DiscoveryCardProps {
  session: CuriositySession;
}

function concise(value: string, maximum = 260): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

const COMPACT_JUDGMENT_IMPACT_MAXIMUM = 120;
const COMPACT_JUDGMENT_BOUNDARY_MAXIMUM = 100;

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

export const DiscoveryCard = memo(function DiscoveryCard({
  session,
}: DiscoveryCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const route = getSelectedRoute(session);
  const evidence = session.evidence;
  const evidenceDecision = session.evidenceDecision;
  const evidenceApplication = session.evidenceApplication;
  const artifactAnchor = evidenceApplication?.artifactAnchor?.trim();
  const reflection = session.reflectionResult;
  const selectedNextQuestionIndex = session.selectedNextQuestionId
    ? NEXT_QUESTION_IDS.indexOf(session.selectedNextQuestionId)
    : -1;
  const selectedNextQuestion =
    selectedNextQuestionIndex >= 0
      ? reflection?.newQuestions[selectedNextQuestionIndex]
      : undefined;
  const canExport = Boolean(
    route &&
    session.quest &&
    session.prediction &&
    evidence &&
    evidenceDecision &&
    evidenceApplication &&
    session.artifact &&
    session.reflectionInput &&
    reflection &&
    selectedNextQuestion,
  );
  const markdown = useMemo(
    () => (canExport ? exportSessionToMarkdown(session) : null),
    [canExport, session],
  );

  if (
    !route ||
    !session.quest ||
    !session.prediction ||
    !evidence ||
    !evidenceDecision ||
    !evidenceApplication ||
    !session.artifact ||
    !session.reflectionInput ||
    !reflection
  ) {
    return null;
  }

  const decidedEvidence = evidence.items.find(
    (item) => item.id === evidenceDecision.evidenceItemId,
  );
  const decidedSources = decidedEvidence
    ? decidedEvidence.sourceIds.flatMap((sourceId) => {
        const source = evidence.sources.find(
          (candidate) => candidate.id === sourceId,
        );
        return source ? [source] : [];
      })
    : [];
  const relationshipLabel = {
    supports: "Supports my prediction",
    challenges: "Challenges my prediction",
    complicates: "Complicates my prediction",
  }[evidenceDecision.relationship];

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await copyText(markdown);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2600);
    } catch {
      setCopyStatus("error");
    }
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reasonweave-learning-trace.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const journeyRows: Array<{
    label: string;
    value: string;
    icon: ReactNode;
    sources?: typeof evidence.sources;
  }> = [
    {
      label: "Question",
      value: session.question,
      icon: <Lightbulb size={17} />,
    },
    {
      label: "Route",
      value: `${route.title} — ${route.hook}`,
      icon: <BookOpenCheck size={17} />,
    },
    {
      label: "Quest question",
      value: session.quest.drivingQuestion,
      icon: <Compass size={17} />,
    },
    {
      label: "Prediction",
      value: session.prediction,
      icon: <BrainCircuit size={17} />,
    },
    {
      label: "Evidence",
      value: evidence.conciseExplanation,
      icon: <Search size={17} />,
    },
    {
      label: "Evidence decision",
      value: `Your judgment — ${relationshipLabel}. What the sources establish: ${evidenceDecision.establishes} Source-scope boundary: ${evidenceDecision.unresolved} Why it matters: ${evidenceDecision.impact}${
        decidedEvidence
          ? ` Chosen finding: ${concise(decidedEvidence.statement, 180)}`
          : ""
      }`,
      icon: <Scale size={17} />,
      sources: decidedSources,
    },
    {
      label: "Evidence → design",
      value: `${evidenceApplication.designChoice}${
        decidedEvidence
          ? ` Linked finding: ${concise(decidedEvidence.statement, 180)}`
          : ""
      }${
        artifactAnchor
          ? ` Learner-selected creation anchor: “${artifactAnchor}”.`
          : ""
      }`,
      icon: <PencilRuler size={17} />,
    },
    {
      label: "Creation",
      value: artifactAnchor
        ? `Creation anchor: “${artifactAnchor}”. ${concise(session.artifact)}`
        : concise(session.artifact),
      icon: <PencilRuler size={17} />,
    },
  ];
  const learnerRows = [
    {
      label: "Used to think",
      value: session.reflectionInput.usedToThink,
      icon: <MessageSquareText size={17} />,
    },
    {
      label: "Now I think",
      value: session.reflectionInput.nowThink,
      icon: <BrainCircuit size={17} />,
    },
    {
      label: "Still wonder",
      value: session.reflectionInput.stillWonder,
      icon: <CircleHelp size={17} />,
    },
    ...(selectedNextQuestion
      ? [
          {
            label: "My next question",
            value: selectedNextQuestion,
            icon: <GitBranch size={17} />,
          },
        ]
      : []),
  ];
  const reasonWeaveRows = [
    {
      label: "Synthesis",
      value: reflection.changedThinking,
      icon: <Check size={17} />,
    },
    {
      label: "Feedback",
      value: reflection.specificFeedback,
      icon: <MessageSquareText size={17} />,
    },
    {
      label: "Questions suggested",
      value: reflection.newQuestions
        .map((question) => `• ${question}`)
        .join(" "),
      icon: <GitBranch size={17} />,
    },
  ];
  const atAGlanceRows = [
    {
      label: "Before",
      value: session.reflectionInput.usedToThink,
      icon: <MessageSquareText size={17} />,
    },
    {
      label: "Now",
      value: session.reflectionInput.nowThink,
      icon: <BrainCircuit size={17} />,
    },
    {
      label: "Selected finding",
      value: decidedEvidence
        ? concise(decidedEvidence.statement, 220)
        : "No finding selected.",
      icon: <Search size={17} />,
      sources: decidedSources,
    },
    {
      label: "My evidence judgment",
      value: `${relationshipLabel}. Why it matters: ${concise(
        evidenceDecision.impact,
        COMPACT_JUDGMENT_IMPACT_MAXIMUM,
      )} Source-scope boundary: ${concise(
        evidenceDecision.unresolved,
        COMPACT_JUDGMENT_BOUNDARY_MAXIMUM,
      )}`,
      icon: <Scale size={17} />,
    },
    {
      label: "Design move",
      value: evidenceApplication.designChoice,
      icon: <PencilRuler size={17} />,
    },
    ...(artifactAnchor
      ? [
          {
            label: "Creation anchor",
            value: `“${artifactAnchor}” — exact phrase repeated in the design move and creation.`,
            icon: <PencilRuler size={17} />,
          },
        ]
      : []),
    ...(selectedNextQuestion
      ? [
          {
            label: "My next question",
            value: selectedNextQuestion,
            icon: <GitBranch size={17} />,
          },
        ]
      : []),
  ];

  return (
    <article className="discovery-card" aria-labelledby="discovery-card-title">
      <div className="discovery-card-heading">
        <div>
          <span className="field-help">Your portable learning trace</span>
          <h2 id="discovery-card-title">Discovery Card</h2>
        </div>
        {isCanonicalUnderwaterQuestion(session.question) ? (
          <Image
            className="habitat-miniature"
            src="/images/routes/habitat-cutaway-wonderlab.webp"
            alt="Technical cutaway illustration of an underwater habitat"
            width={240}
            height={148}
            loading="lazy"
          />
        ) : (
          <div
            className="discovery-neutral-mark"
            data-topic-visual="neutral-discovery"
            aria-hidden="true"
          >
            <span className="discovery-neutral-spark">
              <Lightbulb size={24} strokeWidth={1.8} />
            </span>
            <GitBranch size={30} strokeWidth={1.65} />
          </div>
        )}
      </div>

      <section
        className="at-a-glance trace-at-a-glance"
        aria-labelledby="at-a-glance-title"
      >
        <div className="trace-section-heading">
          <h3 id="at-a-glance-title">At a glance</h3>
          <span>Learner-owned summary</span>
        </div>
        <dl className="trace-list at-a-glance-list">
          {atAGlanceRows.map((row) => (
            <div className="trace-row" key={row.label}>
              <span className="trace-icon" aria-hidden="true">
                {row.icon}
              </span>
              <dt>{row.label}</dt>
              <dd>
                <span className="trace-value">{row.value}</span>
                {row.sources && row.sources.length > 0 ? (
                  <ul
                    className="source-list trace-source-list"
                    aria-label="Sources for the selected finding summary"
                  >
                    {row.sources.map((source) => (
                      <li key={source.id}>
                        <a
                          className="source-link trace-source-link"
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${source.title} — ${source.domain} (opens in a new tab)`}
                        >
                          <span>{source.title}</span>
                          <span className="source-domain">
                            · {source.domain}
                          </span>
                          <ExternalLink size={12} aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <details className="full-learning-trace">
        <summary>
          <span>Full learning trace</span>
          <span className="full-learning-trace-hint">
            Complete journey, reflection, and response
          </span>
        </summary>
        <div className="full-learning-trace-content">
          <dl className="trace-list">
            {journeyRows.map((row) => (
              <div className="trace-row" key={row.label}>
                <span className="trace-icon" aria-hidden="true">
                  {row.icon}
                </span>
                <dt>{row.label}</dt>
                <dd>
                  <span className="trace-value">{row.value}</span>
                  {row.sources && row.sources.length > 0 ? (
                    <ul
                      className="source-list trace-source-list"
                      aria-label="Sources for the selected finding"
                    >
                      {row.sources.map((source) => (
                        <li key={source.id}>
                          <a
                            className="source-link trace-source-link"
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${source.title} — ${source.domain} (opens in a new tab)`}
                          >
                            <span>{source.title}</span>
                            <span className="source-domain">
                              · {source.domain}
                            </span>
                            <ExternalLink size={12} aria-hidden="true" />
                            <span className="sr-only">
                              (opens in a new tab)
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <section
            className="trace-section"
            aria-labelledby="learner-reflection-title"
          >
            <div className="trace-section-heading">
              <h3 id="learner-reflection-title">Learner reflection</h3>
              <span>Your words</span>
            </div>
            <dl className="trace-list">
              {learnerRows.map((row) => (
                <div className="trace-row" key={row.label}>
                  <span className="trace-icon" aria-hidden="true">
                    {row.icon}
                  </span>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            className="trace-section"
            aria-labelledby="wonderlab-response-title"
          >
            <div className="trace-section-heading">
              <h3 id="wonderlab-response-title">ReasonWeave response</h3>
              <span>
                {session.mode === "seeded_fallback"
                  ? "Demo response · no live AI"
                  : "AI-generated"}
              </span>
            </div>
            <dl className="trace-list">
              {reasonWeaveRows.map((row) => (
                <div className="trace-row" key={row.label}>
                  <span className="trace-icon" aria-hidden="true">
                    {row.icon}
                  </span>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </details>

      <section
        className="trace-section trace-discussion"
        aria-labelledby="discuss-trace-title"
      >
        <div className="trace-section-heading">
          <h3 id="discuss-trace-title">Discuss this trace</h3>
          <span>Optional</span>
        </div>
        <p className="discussion-prompt">
          What would make you revise that evidence decision or design choice?
        </p>
        <p className="discussion-note">
          Optional discussion prompt—not a score or diagnosis.
        </p>
      </section>

      <div className="discovery-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={handleCopy}
          disabled={!markdown}
        >
          <Copy size={17} /> Copy Markdown
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={handleDownload}
          disabled={!markdown}
        >
          <Download size={17} /> Download .md
        </button>
        <div className="copy-status" role="status" aria-live="polite">
          {copyStatus === "copied" ? (
            <>
              <Check size={15} /> Copied — your trace is ready to share.
            </>
          ) : null}
          {copyStatus === "error"
            ? "Copy was blocked by the browser. Use Download instead."
            : null}
          {!selectedNextQuestion
            ? "Choose your next question above to finish this trace."
            : null}
        </div>
      </div>
    </article>
  );
});
