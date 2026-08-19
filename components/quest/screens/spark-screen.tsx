"use client";

import {
  ArrowRight,
  Building2,
  Compass,
  FlaskConical,
  Info,
  LockKeyhole,
  Music2,
  Waves,
} from "lucide-react";
import type { ReactNode } from "react";

import { StatusBlocks } from "@/components/quest/chrome";
import { DURATIONS, LEVELS } from "@/components/quest/options";
import type { LoadingState, UiError } from "@/components/quest/types";
import type { LearnerLevel, QuestDuration } from "@/types/curiosity";

const SAMPLE_QUESTIONS: Array<{
  question: string;
  icon: ReactNode;
}> = [
  {
    question: "Could humans live underwater?",
    icon: <Waves size={16} />,
  },
  {
    question: "Why do songs get stuck in our heads?",
    icon: <Music2 size={16} />,
  },
  {
    question: "Could a city work without cars?",
    icon: <Building2 size={16} />,
  },
];

export function SparkScreen({
  question,
  level,
  durationMinutes,
  validation,
  loading,
  error,
  liveGenerationAvailable,
  onQuestion,
  onLevel,
  onDuration,
  onLive,
  onDemo,
  onRetry,
}: {
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  validation: string;
  loading: LoadingState | null;
  error: UiError | null;
  liveGenerationAvailable: boolean;
  onQuestion: (value: string) => void;
  onLevel: (value: LearnerLevel) => void;
  onDuration: (value: QuestDuration) => void;
  onLive: () => void;
  onDemo?: () => void;
  onRetry: () => void;
}) {
  const demoOnly = !liveGenerationAvailable && Boolean(onDemo);
  const explorationUnavailable = !liveGenerationAvailable && !onDemo;
  const formDisabled = Boolean(loading) || demoOnly || explorationUnavailable;

  return (
    <section className="screen spark-screen" aria-labelledby="spark-title">
      <div className="spark-content">
        <div className="spark-copy">
          <span className="mode-note">
            <Compass size={15} /> For independent learners 13+ · source-backed
            quests
          </span>
          <h1
            className="display-title"
            id="spark-title"
            data-screen-title
            tabIndex={-1}
          >
            Make your reasoning visible.
          </h1>
          <div className="coral-stroke" aria-hidden="true" />
          <p className="lede">
            Most AI gives you an answer. ReasonWeave holds evidence back until
            you predict, then helps you test, build, reflect, and choose the
            next thread.
          </p>
          <aside
            className="spark-branch-preview"
            aria-labelledby="spark-gate-title"
          >
            <div className="preview-gate">
              <span className="preview-node" aria-hidden="true">
                ?
              </span>
              <div>
                <span className="preview-kicker">Prediction first</span>
                <p className="preview-gate-title" id="spark-gate-title">
                  Evidence stays locked until you predict.
                </p>
              </div>
            </div>
            <ol
              className="preview-trail"
              aria-label="ReasonWeave prediction-first reasoning thread"
            >
              <li className="preview-step" data-state="question">
                <span className="preview-step-node" aria-hidden="true">
                  1
                </span>
                <span>Question</span>
              </li>
              <li className="preview-step" data-state="prediction">
                <span className="preview-step-node" aria-hidden="true">
                  2
                </span>
                <span>Your prediction</span>
              </li>
              <li className="preview-step" data-state="locked">
                <span className="preview-step-node" aria-hidden="true">
                  <LockKeyhole size={14} strokeWidth={2.2} />
                </span>
                <span>Source evidence</span>
              </li>
            </ol>
            <p className="preview-trail-note">
              One visible thread: prediction → evidence judgment → design →
              reflection → your next question.
            </p>
          </aside>
        </div>

        <form
          className="spark-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (demoOnly) onDemo?.();
            else if (liveGenerationAvailable) onLive();
          }}
        >
          <div className="question-field">
            <label className="field-label" htmlFor="spark-question">
              What are you curious about?
              <span className="field-help">
                3–300 characters · no personal info
              </span>
            </label>
            <textarea
              className="text-area question-textarea"
              id="spark-question"
              name="question"
              autoComplete="off"
              value={question}
              maxLength={300}
              placeholder="Ask a question worth chasing…"
              onChange={(event) => onQuestion(event.target.value)}
              disabled={formDisabled}
              aria-describedby={validation ? "spark-question-error" : undefined}
              aria-invalid={Boolean(validation)}
            />
            <span className="character-count">{question.length}/300</span>
          </div>
          {validation ? (
            <p
              className="validation-message"
              id="spark-question-error"
              role="alert"
            >
              <Info size={14} /> {validation}
            </p>
          ) : null}

          <ul className="sample-list" aria-label="Sample questions">
            {SAMPLE_QUESTIONS.map((sample) => (
              <li key={sample.question}>
                <button
                  className="sample-button"
                  type="button"
                  onClick={() => onQuestion(sample.question)}
                  disabled={formDisabled}
                >
                  <span className="sample-icon" aria-hidden="true">
                    {sample.icon}
                  </span>
                  {sample.question}
                </button>
              </li>
            ))}
          </ul>

          <div className="selector-block">
            <span className="field-label" id="level-label">
              Learner level
            </span>
            <div
              className="segment-control"
              role="group"
              aria-labelledby="level-label"
            >
              {LEVELS.map((option) => (
                <button
                  className="segment-button"
                  type="button"
                  aria-pressed={level === option.value}
                  onClick={() => onLevel(option.value)}
                  disabled={formDisabled}
                  key={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="selector-block">
            <span className="field-label" id="duration-label">
              Quest length
            </span>
            <div
              className="segment-control"
              role="group"
              aria-labelledby="duration-label"
            >
              {DURATIONS.map((duration) => (
                <button
                  className="segment-button"
                  type="button"
                  aria-pressed={durationMinutes === duration}
                  onClick={() => onDuration(duration)}
                  disabled={formDisabled}
                  key={duration}
                >
                  {duration} min
                </button>
              ))}
            </div>
            <p className="duration-guidance" aria-live="polite">
              {durationMinutes === 5 ? (
                <>
                  <strong>Quick trace:</strong> the same reasoning loop with one
                  compact, three-line source note.
                </>
              ) : durationMinutes === 10 ? (
                <>
                  <strong>Focused trace:</strong> a compact source note and a
                  focused creation.
                </>
              ) : (
                <>
                  <strong>Deep trace:</strong> more room for tradeoffs,
                  creation, and reflection.
                </>
              )}
            </p>
          </div>

          {demoOnly ? (
            <p className="live-unavailable" role="status">
              Live exploration is unavailable in this release. Start the
              complete, pre-generated demo to see the full learning journey.
            </p>
          ) : null}
          {explorationUnavailable ? (
            <p className="live-unavailable" role="status">
              Exploration is unavailable in this release. Live generation and
              the pre-generated demo are not enabled.
            </p>
          ) : null}
          <div className="spark-actions" data-single={!onDemo || demoOnly}>
            {liveGenerationAvailable ? (
              <button
                className="button button-primary"
                type="submit"
                disabled={Boolean(loading)}
              >
                Generate 3 routes <ArrowRight size={18} />
              </button>
            ) : null}
            {onDemo ? (
              <button
                className={`button ${demoOnly ? "button-primary" : "button-secondary"}`}
                type={demoOnly ? "submit" : "button"}
                onClick={demoOnly ? undefined : onDemo}
                disabled={Boolean(loading)}
              >
                <FlaskConical size={18} /> Try complete demo
              </button>
            ) : null}
          </div>

          <StatusBlocks
            loading={loading}
            error={error}
            onRetry={onRetry}
            onDemo={onDemo}
          />
        </form>
      </div>
    </section>
  );
}
