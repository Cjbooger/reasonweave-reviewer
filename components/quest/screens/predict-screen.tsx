"use client";

import { ArrowRight, Info } from "lucide-react";
import type { FormEvent } from "react";

import { WorkspaceShell } from "@/components/quest/chrome";
import type { CuriositySession, QuestPlan } from "@/types/curiosity";

export function PredictScreen({
  session,
  quest,
  prediction,
  validation,
  onPrediction,
  onSubmit,
}: {
  session: CuriositySession;
  quest: QuestPlan;
  prediction: string;
  validation: string;
  onPrediction: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <WorkspaceShell session={session}>
      <span className="field-help">
        Step 3 · Predict before seeing evidence
      </span>
      <h1 className="panel-title" data-screen-title tabIndex={-1}>
        Commit to a first model.
      </h1>
      <p className="lede">
        A prediction gives the evidence something to push against. You are not
        being graded; you are making your starting point visible.
      </p>
      <form
        className="workspace-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="prompt-callout">
          <strong>Your prompt:</strong> {quest.predictionPrompt}
        </div>
        <label className="field-label" htmlFor="prediction-response">
          Your prediction
          <span className="field-help">At least 10 characters</span>
        </label>
        <textarea
          className="text-area text-area-large"
          id="prediction-response"
          name="prediction"
          autoComplete="off"
          value={prediction}
          maxLength={1000}
          placeholder="My first model is… because…"
          onChange={(event) => onPrediction(event.target.value)}
          aria-describedby={
            validation ? "prediction-response-error" : undefined
          }
          aria-invalid={Boolean(validation)}
        />
        <div className="field-label">
          <span className="field-help">
            Make a choice, ranking, or causal claim.
          </span>
          <span className="character-count">{prediction.length}/1000</span>
        </div>
        {validation ? (
          <p
            className="validation-message"
            id="prediction-response-error"
            role="alert"
          >
            <Info size={14} /> {validation}
          </p>
        ) : null}
        <div className="button-row">
          <button className="button button-primary" type="submit">
            Lock prediction <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
