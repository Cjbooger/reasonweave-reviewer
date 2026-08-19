"use client";

import { BrainCircuit, CircleHelp, Search } from "lucide-react";

import { StatusBlocks, WorkspaceShell } from "@/components/quest/chrome";
import type { LoadingState, UiError } from "@/components/quest/types";
import type { CuriositySession, QuestPlan } from "@/types/curiosity";

export function InvestigateScreen({
  session,
  quest,
  showHint,
  loading,
  error,
  onToggleHint,
  onLoadEvidence,
  onRetry,
  onDemo,
}: {
  session: CuriositySession;
  quest: QuestPlan;
  showHint: boolean;
  loading: LoadingState | null;
  error: UiError | null;
  onToggleHint: () => void;
  onLoadEvidence: () => void;
  onRetry: () => void;
  onDemo?: () => void;
}) {
  return (
    <WorkspaceShell session={session}>
      <span className="field-help">Step 4 · Investigate</span>
      <h1 className="panel-title" data-screen-title tabIndex={-1}>
        Put your model under pressure.
      </h1>
      <p className="lede">{quest.investigationPrompt}</p>
      <div className="workspace-form">
        <div className="prediction-recap">
          <BrainCircuit size={18} />
          <strong>Your prediction</strong>
          <span>{session.prediction}</span>
        </div>
        <div className="help-actions">
          <button
            className="button button-quiet"
            type="button"
            onClick={onToggleHint}
            aria-controls="quest-hint"
            aria-expanded={showHint}
          >
            <CircleHelp size={16} /> Hint
          </button>
        </div>
        {showHint ? (
          <div className="hint-panel" id="quest-hint">
            <strong>Hint:</strong> {quest.hint}
          </div>
        ) : null}
        <div className="prompt-callout">
          <strong>Evidence Lens:</strong> ReasonWeave will separate sourced
          evidence, inference, and open questions. Every evidence claim must
          point to a returned source.
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={onLoadEvidence}
          disabled={Boolean(loading)}
        >
          <Search size={18} /> Explain now with sources
        </button>
        <StatusBlocks
          loading={loading}
          error={error}
          onRetry={onRetry}
          onDemo={onDemo}
        />
      </div>
    </WorkspaceShell>
  );
}
