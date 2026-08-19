"use client";

import { Check, Map, Trash2 } from "lucide-react";

import type { QuestStep } from "@/types/curiosity";

const STEPS: Array<{ id: QuestStep; label: string }> = [
  { id: "spark", label: "Spark" },
  { id: "choose", label: "Choose" },
  { id: "predict", label: "Predict" },
  { id: "investigate", label: "Investigate" },
  { id: "create", label: "Create" },
  { id: "reflect", label: "Reflect" },
  { id: "branch", label: "Branch" },
];

interface AppHeaderProps {
  step: QuestStep;
  hasLearnerWork: boolean;
  mapAvailable: boolean;
  onReset: () => void;
  onShowMap: () => void;
}

export function AppHeader({
  step,
  hasLearnerWork,
  mapAvailable,
  onReset,
  onShowMap,
}: AppHeaderProps) {
  const activeIndex = STEPS.findIndex((candidate) => candidate.id === step);
  const activeLabel = STEPS[activeIndex]?.label ?? "Quest";

  return (
    <header className="site-header">
      <button className="brand" type="button" onClick={onReset}>
        <span>Reason</span>
        <span className="brand-weave">Weave</span>
      </button>

      <nav className="progress-nav" aria-label="Quest progress">
        <ol className="progress-list">
          {STEPS.map((candidate, index) => {
            const state =
              index < activeIndex
                ? "complete"
                : index === activeIndex
                  ? "active"
                  : "upcoming";

            return (
              <li
                className="progress-item"
                data-state={state}
                aria-current={state === "active" ? "step" : undefined}
                key={candidate.id}
              >
                {candidate.label}
                {state === "complete" ? (
                  <span className="progress-check" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <span
        className="mobile-progress"
        aria-label={`${activeLabel}, step ${activeIndex + 1} of ${STEPS.length}`}
      >
        {activeLabel} <span aria-hidden="true">·</span> {activeIndex + 1}/
        {STEPS.length}
      </span>

      <div className="header-actions">
        <button
          className="header-action"
          type="button"
          aria-label="Show Curiosity Map"
          onClick={onShowMap}
          disabled={!mapAvailable}
        >
          <Map size={17} aria-hidden="true" />
          <span>My map</span>
        </button>
        <button
          className="header-action"
          type="button"
          aria-label="Clear session"
          onClick={onReset}
          disabled={!hasLearnerWork}
        >
          <Trash2 size={17} aria-hidden="true" />
          <span>Clear session</span>
        </button>
      </div>
    </header>
  );
}
