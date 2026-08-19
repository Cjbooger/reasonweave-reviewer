"use client";

import { GitBranch, Info } from "lucide-react";
import type { FormEvent } from "react";

import { StatusBlocks, WorkspaceShell } from "@/components/quest/chrome";
import type { LoadingState, UiError } from "@/components/quest/types";
import type { CuriositySession, ReflectionInput } from "@/types/curiosity";

const REFLECTION_FIELDS = [
  ["usedToThink", "I used to think…"],
  ["nowThink", "Now I think…"],
  ["stillWonder", "I still wonder…"],
] as const;

export function ReflectScreen({
  session,
  reflection,
  validation,
  loading,
  error,
  onReflection,
  onSubmit,
  onRetry,
  onDemo,
}: {
  session: CuriositySession;
  reflection: ReflectionInput;
  validation: string;
  loading: LoadingState | null;
  error: UiError | null;
  onReflection: (value: ReflectionInput) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onDemo?: () => void;
}) {
  return (
    <WorkspaceShell session={session}>
      <span className="field-help">Step 6 · Reflect</span>
      <h1 className="panel-title" data-screen-title tabIndex={-1}>
        Make the change in your thinking visible.
      </h1>
      <p className="lede">
        This is not a grade. Contrast your starting model, then name what
        remains open and what evidence could make you revise.
      </p>
      <form
        className="workspace-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="reflection-grid">
          {REFLECTION_FIELDS.map(([field, label]) => (
            <div className="reflection-field" key={field}>
              <label className="field-label" htmlFor={`reflection-${field}`}>
                {label}
              </label>
              <textarea
                className="text-area"
                id={`reflection-${field}`}
                name={`reflection-${field}`}
                autoComplete="off"
                value={reflection[field]}
                maxLength={800}
                disabled={Boolean(loading)}
                onChange={(event) =>
                  onReflection({ ...reflection, [field]: event.target.value })
                }
                aria-describedby={
                  validation ? "reflection-response-error" : undefined
                }
                aria-invalid={Boolean(validation)}
              />
            </div>
          ))}
        </div>
        {validation ? (
          <p
            className="validation-message"
            id="reflection-response-error"
            role="alert"
          >
            <Info size={14} /> {validation}
          </p>
        ) : null}
        <div className="prompt-callout">
          <strong>What happens next:</strong> ReasonWeave will reference your
          actual statements, render a finite nine-node map, and open exactly
          three stronger questions.
        </div>
        <button
          className="button button-primary"
          type="submit"
          disabled={Boolean(loading)}
        >
          <GitBranch size={18} /> Reveal my Curiosity Map
        </button>
        <StatusBlocks
          loading={loading}
          error={error}
          onRetry={onRetry}
          onDemo={onDemo}
        />
      </form>
    </WorkspaceShell>
  );
}
