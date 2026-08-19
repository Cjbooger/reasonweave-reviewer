"use client";

import {
  Activity,
  Clock3,
  ExternalLink,
  FlaskConical,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef } from "react";

import {
  compactTimeAllocation,
  timeBudgetAccessibleName,
} from "@/components/quest/presentation";
import { questTimeBudgetFor } from "@/lib/quest-time-budget";
import { getSelectedRoute } from "@/lib/session-machine";
import type {
  CuriositySession,
  EvidenceBundle,
  EvidenceKind,
} from "@/types/curiosity";

import type { LoadingState, UiError } from "./types";

export const CuriosityMapView = dynamic(
  () =>
    import("@/components/curiosity-map").then(
      (module) => module.CuriosityMapView,
    ),
  {
    loading: () => (
      <div className="deferred-panel-loading" role="status">
        Drawing your Curiosity Map…
      </div>
    ),
  },
);

export function AppFooter() {
  return (
    <footer className="screen-footer">
      ReasonWeave is for ages 13+. It uses AI and web sources to guide an
      investigation. AI can make mistakes. Check cited sources and involve a
      qualified adult for health, safety, or physical activities. Work is stored
      locally in this browser and removed after 24 hours while open, or the next
      time ReasonWeave opens. Live generation sends your entries to OpenAI. Do
      not enter personal information; clear your session before leaving a shared
      device.
    </footer>
  );
}

export function StatusBlocks({
  loading,
  error,
  onRetry,
  onDemo,
}: {
  loading: LoadingState | null;
  error: UiError | null;
  onRetry: () => void;
  onDemo?: () => void;
}) {
  const errorPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    const frame = window.requestAnimationFrame(() => {
      errorPanelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [error]);

  return (
    <>
      {loading ? (
        <div className="loading-panel" role="status" aria-live="polite">
          <p className="loading-row">
            <span className="loading-spinner" aria-hidden="true" />
            {loading.message}
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          className="error-panel"
          ref={errorPanelRef}
          role="alert"
          tabIndex={-1}
        >
          <p className="error-title">
            <TriangleAlert size={19} aria-hidden="true" /> {error.title}
          </p>
          <p className="error-message">{error.message}</p>
          {error.retryable || onDemo ? (
            <div className="button-row">
              {error.retryable ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={onRetry}
                >
                  Try again
                </button>
              ) : null}
              {onDemo ? (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={onDemo}
                >
                  <FlaskConical size={17} /> Open complete demo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function ContextBar({ session }: { session: CuriositySession }) {
  const route = getSelectedRoute(session);
  const timeBudget =
    session.quest?.timeBudget ?? questTimeBudgetFor(session.durationMinutes);

  return (
    <div className="context-bar">
      <div className="context-anchor">
        <div className="context-question">
          <Sparkles className="coral-mark" size={20} aria-hidden="true" />
          <span>{session.question}</span>
        </div>
        {session.quest ? (
          <p className="context-driving-question">
            <strong>Quest question:</strong> {session.quest.drivingQuestion}
          </p>
        ) : null}
      </div>
      {route ? (
        <div className="context-route">
          Route <strong>{route.title}</strong>
        </div>
      ) : null}
      <div className="context-actions">
        <span className="sr-only">{timeBudgetAccessibleName(timeBudget)}</span>
        <span className="quest-depth-note quest-duration-note">
          <Clock3 size={15} aria-hidden="true" /> {session.durationMinutes} min
          ·{" "}
          {session.durationMinutes === 5
            ? "quick trace"
            : session.durationMinutes === 10
              ? "focused trace"
              : "deep trace"}
        </span>
        <span
          className="quest-depth-note quest-budget-visible"
          aria-hidden="true"
        >
          Plan: choose {compactTimeAllocation(timeBudget.steps.choose)} ·
          predict {compactTimeAllocation(timeBudget.steps.predict)} ·
          investigate {compactTimeAllocation(timeBudget.steps.investigate)} ·
          create {compactTimeAllocation(timeBudget.steps.create)} · reflect{" "}
          {compactTimeAllocation(timeBudget.steps.reflect)} · branch{" "}
          {compactTimeAllocation(timeBudget.steps.branch)}
        </span>
        <span className="mode-note">
          {session.mode === "seeded_fallback" ? (
            <>
              <FlaskConical size={15} /> Pre-generated demo
            </>
          ) : (
            <>
              <Activity size={15} /> Live GPT-5.6 quest
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  session,
  children,
}: {
  session: CuriositySession;
  children: ReactNode;
}) {
  return (
    <section className="screen">
      <ContextBar session={session} />
      <div className="workspace-content">
        <div className="workspace-main">{children}</div>
        <aside className="workspace-map-column" aria-label="Quest map preview">
          <CuriosityMapView session={session} />
        </aside>
      </div>
    </section>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceBundle }) {
  const sourceById = new Map(
    evidence.sources.map((source) => [source.id, source]),
  );
  const labels: Record<EvidenceKind, string> = {
    evidence: "Evidence",
    inference: "Inference",
    open_question: "Open Question",
  };

  return (
    <>
      <ol className="evidence-list">
        {evidence.items.map((item, index) => (
          <li className="evidence-item" data-kind={item.kind} key={item.id}>
            <span className="evidence-index" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3 className="evidence-kind">{labels[item.kind]}</h3>
              <p className="evidence-statement">{item.statement}</p>
              {item.sourceIds.length > 0 ? (
                <ul
                  className="source-list"
                  aria-label="Sources for this finding"
                >
                  {item.sourceIds.map((sourceId) => {
                    const source = sourceById.get(sourceId);
                    if (!source) return null;
                    return (
                      <li key={source.id}>
                        <a
                          className="source-link"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{source.title}</span>
                          <span className="source-domain" aria-hidden="true">
                            · {source.domain}
                          </span>
                          <span className="sr-only">(opens in a new tab)</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="lede">{evidence.conciseExplanation}</p>
      {evidence.uncertaintyNote ? (
        <p className="uncertainty-note">
          <Info size={15} />
          <span>
            <strong>What these sources do not settle:</strong>{" "}
            {evidence.uncertaintyNote}
          </span>
        </p>
      ) : null}
    </>
  );
}
