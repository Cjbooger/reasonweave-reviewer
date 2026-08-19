"use client";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  FlaskConical,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect } from "react";

import { CuriosityMapView } from "@/components/quest/chrome";
import { NEXT_QUESTION_IDS } from "@/types/curiosity";
import type { CuriositySession, NextQuestionId } from "@/types/curiosity";

const DiscoveryCard = dynamic(
  () =>
    import("@/components/discovery-card").then(
      (module) => module.DiscoveryCard,
    ),
  {
    loading: () => (
      <div
        className="deferred-panel-loading discovery-card-loading"
        role="status"
      >
        Preparing your portable learning trace…
      </div>
    ),
  },
);

export function preloadDiscoveryCard(): void {
  void import("@/components/discovery-card").catch(() => undefined);
}

export function DiscoveryScreen({
  session,
  onReset,
  onSelectNextQuestion,
}: {
  session: CuriositySession;
  onReset: () => void;
  onSelectNextQuestion: (nextQuestionId: NextQuestionId) => void;
}) {
  useEffect(() => {
    // The learner still has to choose a branch before this renders, so fetch
    // its chunk while they review the final synthesis and questions.
    preloadDiscoveryCard();
  }, []);

  const result = session.reflectionResult;
  if (!result) return null;

  return (
    <section className="screen" aria-labelledby="branch-title">
      <div className="discovery-content">
        <div className="discovery-header">
          <div>
            <span className="field-help">
              Step 7 · Branch with better questions
            </span>
            <h1
              className="section-title"
              id="branch-title"
              data-screen-title
              tabIndex={-1}
            >
              Your question became a visible reasoning trace.
            </h1>
            <p className="lede">
              You did not just collect an answer. You made a model, tested it,
              and changed it.
            </p>
          </div>
          <div className="discovery-header-actions">
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
            <button
              className="button button-secondary"
              type="button"
              onClick={onReset}
            >
              <Sparkles size={17} /> New question
            </button>
          </div>
        </div>

        <div className="changed-band learner-change-band">
          <div className="changed-heading">
            <BrainCircuit size={28} className="coral-mark" />
            <h2>Your change</h2>
          </div>
          <div className="learner-change-copy">
            <div className="learner-shift-grid">
              <div>
                <span className="learner-shift-label">Before</span>
                <p>{session.reflectionInput?.usedToThink}</p>
              </div>
              <ArrowRight className="learner-shift-arrow" aria-hidden="true" />
              <div>
                <span className="learner-shift-label">Now</span>
                <p>{session.reflectionInput?.nowThink}</p>
              </div>
            </div>
            <p className="learner-still-wonders">
              <strong>Still wondering:</strong>{" "}
              {session.reflectionInput?.stillWonder}
            </p>
          </div>
        </div>

        <section
          className="wonderlab-synthesis-band"
          aria-labelledby="wonderlab-synthesis-title"
        >
          <div className="wonderlab-synthesis-heading">
            <div>
              <span className="field-help">ReasonWeave synthesis</span>
              <h2 id="wonderlab-synthesis-title">What the thread reveals</h2>
            </div>
            <span className="mode-note">
              {session.mode === "seeded_fallback"
                ? "Pre-generated demo synthesis"
                : "GPT-5.6 synthesis"}
            </span>
          </div>
          <p className="discovery-summary">{result.discoverySummary}</p>
          <p>{result.changedThinking}</p>
          {result.keyTradeoff ? (
            <p>
              <strong>Key tradeoff:</strong> {result.keyTradeoff}
            </p>
          ) : null}
        </section>

        <fieldset
          className="next-question-choice"
          aria-describedby="next-question-choice-help next-question-choice-status"
        >
          <legend className="next-question-choice-heading">
            <span className="field-help">Your next move · learner choice</span>
            <span>Which question will you carry forward?</span>
          </legend>
          <p id="next-question-choice-help">
            ReasonWeave suggests three branches. You choose the one worth
            pursuing—no score, no automatic next quest, and no endless AI chain.
          </p>
          <div className="next-question-choice-grid">
            {result.newQuestions.map((question, index) => {
              const nextQuestionId = NEXT_QUESTION_IDS[index];
              const selected =
                session.selectedNextQuestionId === nextQuestionId;

              return (
                <label
                  className={`next-question-option${selected ? " next-question-option-selected" : ""}`}
                  key={nextQuestionId}
                >
                  <input
                    type="radio"
                    name="next-question-choice"
                    value={nextQuestionId}
                    checked={selected}
                    onChange={() => {
                      if (
                        !session.selectedNextQuestionId &&
                        window.innerWidth <= 930
                      ) {
                        document
                          .querySelector<HTMLElement>(".discovery-card-slot")
                          ?.focus();
                      }
                      onSelectNextQuestion(nextQuestionId);
                    }}
                  />
                  <span
                    className="next-question-option-mark"
                    aria-hidden="true"
                  >
                    {selected ? <Check size={17} /> : index + 1}
                  </span>
                  <span>{question}</span>
                </label>
              );
            })}
          </div>
          <p
            className="next-question-choice-status"
            id="next-question-choice-status"
            role="status"
            aria-live="polite"
          >
            {session.selectedNextQuestionId
              ? "Card unlocked. Map updated."
              : "Choose one branch to complete your portable learning trace."}
          </p>
        </fieldset>

        <div className="discovery-grid">
          <CuriosityMapView session={session} full />
          <div
            className="discovery-card-slot"
            role="region"
            aria-label="Discovery Card"
            tabIndex={-1}
          >
            {session.selectedNextQuestionId ? (
              <DiscoveryCard session={session} />
            ) : (
              <article
                className="discovery-card discovery-card-pending"
                aria-labelledby="discovery-card-pending-title"
              >
                <div className="discovery-card-heading">
                  <div>
                    <span className="field-help">
                      Your portable learning trace
                    </span>
                    <h2 id="discovery-card-pending-title">Discovery Card</h2>
                  </div>
                  <LockKeyhole size={28} aria-hidden="true" />
                </div>
                <p>
                  Choose the question you will carry forward to complete this
                  trace. Your map stays finite; the choice belongs to you.
                </p>
                <div className="discovery-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    disabled
                  >
                    Copy Markdown
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled
                  >
                    Download .md
                  </button>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
