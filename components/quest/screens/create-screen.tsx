"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  Clock3,
  ExternalLink,
  Info,
  ShieldCheck,
} from "lucide-react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";

import { EvidenceList, WorkspaceShell } from "@/components/quest/chrome";
import { parseCompactEvidenceNote } from "@/components/quest/evidence-note";
import { EVIDENCE_RELATIONSHIPS } from "@/components/quest/options";
import { clip } from "@/components/quest/presentation";
import type { EvidenceDecisionDraft } from "@/components/quest/types";
import {
  artifactAnchorWordCount,
  validateEvidenceApplicationArtifact,
} from "@/lib/evidence-application";
import {
  artifactSchema,
  evidenceApplicationSchema,
  evidenceDecisionSchema,
} from "@/lib/schemas";
import { usesCompactEvidenceDecision } from "@/lib/quest-time-budget";
import type {
  CuriositySession,
  EvidenceBundle,
  QuestPlan,
} from "@/types/curiosity";

const COMPACT_EVIDENCE_NOTE_MAX_LENGTH = 902;

interface CreateScreenProps {
  session: CuriositySession;
  quest: QuestPlan;
  evidence: EvidenceBundle;
  evidenceDecision: EvidenceDecisionDraft;
  setEvidenceDecision: Dispatch<SetStateAction<EvidenceDecisionDraft>>;
  compactEvidenceNote: string;
  setCompactEvidenceNote: Dispatch<SetStateAction<string>>;
  evidenceApplicationChoice: string;
  setEvidenceApplicationChoice: Dispatch<SetStateAction<string>>;
  artifactAnchor: string;
  setArtifactAnchor: Dispatch<SetStateAction<string>>;
  artifact: string;
  setArtifact: Dispatch<SetStateAction<string>>;
  creationReviewed: boolean;
  setCreationReviewed: Dispatch<SetStateAction<boolean>>;
  validation: string;
  setValidation: Dispatch<SetStateAction<string>>;
  evidenceItemRef: RefObject<HTMLSelectElement | null>;
  evidenceRelationshipRef: RefObject<HTMLInputElement | null>;
  compactEvidenceNoteRef: RefObject<HTMLTextAreaElement | null>;
  evidenceEstablishesRef: RefObject<HTMLTextAreaElement | null>;
  evidenceUnresolvedRef: RefObject<HTMLTextAreaElement | null>;
  evidenceImpactRef: RefObject<HTMLTextAreaElement | null>;
  artifactRef: RefObject<HTMLTextAreaElement | null>;
  evidenceApplicationRef: RefObject<HTMLTextAreaElement | null>;
  artifactAnchorRef: RefObject<HTMLInputElement | null>;
  creationReviewedRef: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
}

export function CreateScreen({
  session,
  quest,
  evidence,
  evidenceDecision,
  setEvidenceDecision,
  compactEvidenceNote,
  setCompactEvidenceNote,
  evidenceApplicationChoice,
  setEvidenceApplicationChoice,
  artifactAnchor,
  setArtifactAnchor,
  artifact,
  setArtifact,
  creationReviewed,
  setCreationReviewed,
  validation,
  setValidation,
  evidenceItemRef,
  evidenceRelationshipRef,
  compactEvidenceNoteRef,
  evidenceEstablishesRef,
  evidenceUnresolvedRef,
  evidenceImpactRef,
  artifactRef,
  evidenceApplicationRef,
  artifactAnchorRef,
  creationReviewedRef,
  onSubmit,
}: CreateScreenProps) {
  const usesCompactDecision = usesCompactEvidenceDecision(
    session.durationMinutes,
  );
  const compactEvidenceNoteResult = usesCompactDecision
    ? parseCompactEvidenceNote(compactEvidenceNote)
    : null;
  const compactEvidenceLineCount = compactEvidenceNote
    .split(/\r?\n/)
    .filter((line) => line.trim()).length;
  const effectiveEvidenceDecision =
    compactEvidenceNoteResult?.success === true
      ? { ...evidenceDecision, ...compactEvidenceNoteResult.data }
      : evidenceDecision;
  const parsedEvidenceDecision = evidenceDecisionSchema.safeParse(
    effectiveEvidenceDecision,
  );
  const selectedEvidenceForDecision = evidence.items.find(
    (item) => item.id === evidenceDecision.evidenceItemId,
  );
  const selectedEvidenceSources = selectedEvidenceForDecision
    ? selectedEvidenceForDecision.sourceIds.flatMap((sourceId) => {
        const source = evidence.sources.find(
          (candidate) => candidate.id === sourceId,
        );
        return source ? [source] : [];
      })
    : [];
  const evidenceDecisionItemIsValid = Boolean(
    evidence.items.some(
      (item) =>
        item.id === evidenceDecision.evidenceItemId &&
        item.kind === "evidence" &&
        item.sourceIds.length > 0,
    ),
  );
  const evidenceRelationshipIsValid = EVIDENCE_RELATIONSHIPS.some(
    ({ value }) => value === evidenceDecision.relationship,
  );
  const evidenceEstablishesIsValid =
    evidenceDecision.establishes.trim().length >= 15 &&
    evidenceDecision.establishes.trim().length <= 300;
  const evidenceUnresolvedIsValid =
    evidenceDecision.unresolved.trim().length >= 15 &&
    evidenceDecision.unresolved.trim().length <= 300;
  const evidenceImpactIsValid =
    evidenceDecision.impact.trim().length >= 15 &&
    evidenceDecision.impact.trim().length <= 300;
  const evidenceDecisionIsValid = Boolean(
    parsedEvidenceDecision.success &&
    evidenceDecisionItemIsValid &&
    (!usesCompactDecision || compactEvidenceNoteResult?.success),
  );
  const parsedArtifact = artifactSchema.safeParse(artifact);
  const artifactIsValid = parsedArtifact.success;
  const parsedEvidenceApplication = evidenceApplicationSchema.safeParse({
    evidenceItemId: evidenceDecision.evidenceItemId,
    designChoice: evidenceApplicationChoice,
    artifactAnchor,
  });
  const evidenceApplicationIsValid = parsedEvidenceApplication.success;
  const evidenceApplicationArtifactValidation =
    parsedEvidenceApplication.success && parsedArtifact.success
      ? validateEvidenceApplicationArtifact(
          parsedEvidenceApplication.data,
          parsedArtifact.data,
        )
      : null;
  const firstEvidenceApplicationIssue = !parsedEvidenceApplication.success
    ? parsedEvidenceApplication.error.issues[0]
    : null;
  const evidenceDecisionHasError = Boolean(
    validation && !evidenceDecisionIsValid,
  );
  const artifactHasError = Boolean(
    validation &&
    evidenceDecisionIsValid &&
    evidenceApplicationIsValid &&
    (!artifactIsValid ||
      (artifactIsValid &&
        evidenceApplicationArtifactValidation?.field === "artifact")),
  );
  const evidenceApplicationHasError = Boolean(
    validation &&
    evidenceDecisionIsValid &&
    !evidenceApplicationIsValid &&
    firstEvidenceApplicationIssue?.path[0] !== "artifactAnchor",
  );
  const artifactAnchorHasError = Boolean(
    validation &&
    evidenceDecisionIsValid &&
    ((!evidenceApplicationIsValid &&
      firstEvidenceApplicationIssue?.path[0] === "artifactAnchor") ||
      (evidenceApplicationIsValid &&
        artifactIsValid &&
        evidenceApplicationArtifactValidation?.field === "artifactAnchor")),
  );
  const creationReviewHasError = Boolean(
    validation &&
    evidenceDecisionIsValid &&
    evidenceApplicationIsValid &&
    artifactIsValid &&
    evidenceApplicationArtifactValidation?.success &&
    !creationReviewed,
  );

  return (
    <WorkspaceShell session={session}>
      <span className="field-help">Evidence Lens · Then create</span>
      <h1 className="panel-title" data-screen-title tabIndex={-1}>
        See what holds. Build what follows.
      </h1>
      <EvidenceList evidence={evidence} />

      <form
        className="workspace-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <section
          className="evidence-decision-panel"
          data-depth={usesCompactDecision ? "quick" : "full"}
          aria-labelledby="evidence-decision-title"
        >
          <div className="evidence-decision-heading">
            <div>
              <span className="field-help">Your evidence decision</span>
              <h2 id="evidence-decision-title">
                What does the evidence do to your prediction?
              </h2>
            </div>
            <span className="evidence-decision-owner">
              <BrainCircuit size={15} aria-hidden="true" /> Your judgment · not
              AI grading
            </span>
          </div>
          <p className="evidence-decision-intro">
            {usesCompactDecision
              ? "Choose one source-backed finding and its relationship to your prediction. Then capture all three judgments in one compact note: what the sources show, where their scope stops, and why that matters."
              : "Choose one source-backed finding, name its relationship to your prediction, and explain what the selected finding and its cited sources directly support, where their scope stops, and why that matters in your own words."}
          </p>
          {usesCompactDecision ? (
            <div className="quick-quest-cue">
              <Clock3 size={18} aria-hidden="true" />
              <p>
                <strong>
                  {session.durationMinutes}-minute{" "}
                  {session.durationMinutes === 5 ? "quick" : "focused"} trace.
                </strong>{" "}
                Use one clear line for each judgment, then make one
                evidence-driven design move.
              </p>
            </div>
          ) : null}

          <div className="evidence-decision-fields">
            <label
              className="evidence-decision-field"
              htmlFor="evidence-decision-item"
            >
              <span className="evidence-decision-label">
                <span aria-hidden="true">01</span>
                Choose one source-backed finding
              </span>
              <select
                className="evidence-decision-select"
                id="evidence-decision-item"
                name="evidence-decision-item"
                autoComplete="off"
                ref={evidenceItemRef}
                value={evidenceDecision.evidenceItemId}
                onChange={(event) => {
                  setEvidenceDecision((current) => ({
                    ...current,
                    evidenceItemId: event.target.value,
                  }));
                  setEvidenceApplicationChoice("");
                  setArtifactAnchor("");
                  setCreationReviewed(false);
                  setValidation("");
                }}
                aria-describedby={
                  evidenceDecisionHasError && !evidenceDecisionItemIsValid
                    ? "evidence-decision-error"
                    : undefined
                }
                aria-invalid={
                  evidenceDecisionHasError && !evidenceDecisionItemIsValid
                }
              >
                <option value="">Select a finding…</option>
                {evidence.items
                  .filter(
                    (item) =>
                      item.kind === "evidence" && item.sourceIds.length > 0,
                  )
                  .map((item, index) => (
                    <option value={item.id} key={item.id}>
                      {`Finding ${index + 1} — ${clip(item.statement, 140)}`}
                    </option>
                  ))}
              </select>
            </label>

            {selectedEvidenceSources.length > 0 ? (
              <section
                className="evidence-decision-field"
                aria-labelledby="selected-evidence-sources-title"
              >
                <span
                  className="evidence-decision-label"
                  id="selected-evidence-sources-title"
                >
                  Cited source scope
                </span>
                <ul
                  className="source-list"
                  aria-label="Sources linked to the selected finding"
                >
                  {selectedEvidenceSources.map((source) => (
                    <li key={source.id}>
                      <a
                        className="source-link"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${source.title} — ${source.domain} (opens in a new tab)`}
                      >
                        <span>{source.title}</span>
                        <span className="source-domain">· {source.domain}</span>
                        <ExternalLink size={12} aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <fieldset
              className="evidence-relationship-field"
              aria-describedby={
                evidenceDecisionHasError && !evidenceRelationshipIsValid
                  ? "evidence-decision-error"
                  : undefined
              }
              aria-invalid={
                evidenceDecisionHasError && !evidenceRelationshipIsValid
              }
            >
              <legend className="evidence-decision-label">
                <span aria-hidden="true">02</span>
                How does it relate to your prediction?
              </legend>
              <div className="evidence-relationship-options">
                {EVIDENCE_RELATIONSHIPS.map((option, index) => (
                  <label
                    className="evidence-relationship-option"
                    data-selected={
                      evidenceDecision.relationship === option.value
                    }
                    key={option.value}
                  >
                    <input
                      type="radio"
                      ref={index === 0 ? evidenceRelationshipRef : undefined}
                      name="evidence-relationship"
                      value={option.value}
                      checked={evidenceDecision.relationship === option.value}
                      onChange={() => {
                        setEvidenceDecision((current) => ({
                          ...current,
                          relationship: option.value,
                        }));
                        setValidation("");
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {usesCompactDecision ? (
              <>
                <ol
                  className="compact-evidence-guide"
                  id="compact-evidence-guide"
                  aria-label="Quick source note line order"
                >
                  <li>What the cited sources show</li>
                  <li>Where their source scope stops</li>
                  <li>Why that matters for your prediction</li>
                </ol>
                <label
                  className="evidence-decision-field"
                  htmlFor="compact-evidence-note"
                >
                  <span className="evidence-decision-label">
                    <span aria-hidden="true">03</span>
                    {session.durationMinutes === 5
                      ? "Quick source note"
                      : "Source note"}
                  </span>
                  <textarea
                    className="text-area evidence-decision-reason compact-evidence-note"
                    id="compact-evidence-note"
                    name="compact-evidence-note"
                    autoComplete="off"
                    ref={compactEvidenceNoteRef}
                    value={compactEvidenceNote}
                    maxLength={COMPACT_EVIDENCE_NOTE_MAX_LENGTH}
                    placeholder={
                      "1. The sources show…\n2. Their scope stops at…\n3. This matters because…"
                    }
                    onChange={(event) => {
                      setCompactEvidenceNote(event.target.value);
                      setValidation("");
                    }}
                    aria-describedby={`compact-evidence-guide compact-evidence-note-help${
                      evidenceDecisionHasError &&
                      !compactEvidenceNoteResult?.success
                        ? " evidence-decision-error"
                        : ""
                    }`}
                    aria-invalid={
                      evidenceDecisionHasError &&
                      !compactEvidenceNoteResult?.success
                    }
                  />
                </label>
                <div
                  className="evidence-decision-meta"
                  id="compact-evidence-note-help"
                >
                  <span>
                    Exactly 3 non-empty lines · 15–300 characters each
                  </span>
                  <span className="character-count">
                    {compactEvidenceLineCount}/3 lines ·{" "}
                    {compactEvidenceNote.length}/
                    {COMPACT_EVIDENCE_NOTE_MAX_LENGTH}
                  </span>
                </div>
              </>
            ) : (
              <>
                <label
                  className="evidence-decision-field"
                  htmlFor="evidence-decision-establishes"
                >
                  <span className="evidence-decision-label">
                    <span aria-hidden="true">03</span>
                    What do the cited sources establish?
                  </span>
                  <textarea
                    className="text-area evidence-decision-reason"
                    id="evidence-decision-establishes"
                    name="evidence-decision-establishes"
                    autoComplete="off"
                    ref={evidenceEstablishesRef}
                    value={evidenceDecision.establishes}
                    maxLength={300}
                    placeholder="State only what this finding and its cited sources support…"
                    onChange={(event) => {
                      setEvidenceDecision((current) => ({
                        ...current,
                        establishes: event.target.value,
                      }));
                      setValidation("");
                    }}
                    aria-describedby={`evidence-decision-establishes-help${
                      evidenceDecisionHasError && !evidenceEstablishesIsValid
                        ? " evidence-decision-error"
                        : ""
                    }`}
                    aria-invalid={
                      evidenceDecisionHasError && !evidenceEstablishesIsValid
                    }
                  />
                </label>
                <div
                  className="evidence-decision-meta"
                  id="evidence-decision-establishes-help"
                >
                  <span>15–300 characters · source-bounded claim</span>
                  <span className="character-count">
                    {evidenceDecision.establishes.length}/300
                  </span>
                </div>

                <label
                  className="evidence-decision-field"
                  htmlFor="evidence-decision-unresolved"
                >
                  <span className="evidence-decision-label">
                    <span aria-hidden="true">04</span>
                    Where does this source scope stop?
                  </span>
                  <textarea
                    className="text-area evidence-decision-reason"
                    id="evidence-decision-unresolved"
                    name="evidence-decision-unresolved"
                    autoComplete="off"
                    ref={evidenceUnresolvedRef}
                    value={evidenceDecision.unresolved}
                    maxLength={300}
                    placeholder="Separate what this source directly supports from your inference or a question it cannot answer…"
                    onChange={(event) => {
                      setEvidenceDecision((current) => ({
                        ...current,
                        unresolved: event.target.value,
                      }));
                      setValidation("");
                    }}
                    aria-describedby={`evidence-decision-unresolved-help${
                      evidenceDecisionHasError && !evidenceUnresolvedIsValid
                        ? " evidence-decision-error"
                        : ""
                    }`}
                    aria-invalid={
                      evidenceDecisionHasError && !evidenceUnresolvedIsValid
                    }
                  />
                </label>
                <div
                  className="evidence-decision-meta"
                  id="evidence-decision-unresolved-help"
                >
                  <span>
                    Separate what this source directly supports from your
                    inference or a question it cannot answer.
                  </span>
                  <span className="character-count">
                    {evidenceDecision.unresolved.length}/300
                  </span>
                </div>

                <label
                  className="evidence-decision-field"
                  htmlFor="evidence-decision-impact"
                >
                  <span className="evidence-decision-label">
                    <span aria-hidden="true">05</span>
                    Why does that matter for your prediction?
                  </span>
                  <textarea
                    className="text-area evidence-decision-reason"
                    id="evidence-decision-impact"
                    name="evidence-decision-impact"
                    autoComplete="off"
                    ref={evidenceImpactRef}
                    value={evidenceDecision.impact}
                    maxLength={300}
                    placeholder="Explain why that boundary supports, challenges, or complicates your prediction…"
                    onChange={(event) => {
                      setEvidenceDecision((current) => ({
                        ...current,
                        impact: event.target.value,
                      }));
                      setValidation("");
                    }}
                    aria-describedby={`evidence-decision-impact-help${
                      evidenceDecisionHasError && !evidenceImpactIsValid
                        ? " evidence-decision-error"
                        : ""
                    }`}
                    aria-invalid={
                      evidenceDecisionHasError && !evidenceImpactIsValid
                    }
                  />
                </label>
                <div
                  className="evidence-decision-meta"
                  id="evidence-decision-impact-help"
                >
                  <span>15–300 characters · use your own reasoning</span>
                  <span className="character-count">
                    {evidenceDecision.impact.length}/300
                  </span>
                </div>
              </>
            )}
          </div>

          {evidenceDecisionHasError ? (
            <p
              className="validation-message"
              id="evidence-decision-error"
              role="alert"
            >
              <Info size={14} /> {validation}
            </p>
          ) : null}
        </section>

        <span className="field-help">Step 5 · Creation challenge</span>
        <div className="prompt-callout">
          <strong>Your challenge:</strong> {quest.creationChallenge}
        </div>
        <h2 className="field-label">Design constraints</h2>
        <ol className="constraint-list">
          {quest.constraints.map((constraint, index) => (
            <li className="constraint-item" key={constraint}>
              <span className="constraint-index">{index + 1}</span>
              <span>{constraint}</span>
            </li>
          ))}
        </ol>
        <h2 className="field-label">A complete response includes</h2>
        <ul className="criteria-list">
          {quest.completionCriteria.map((criterion) => (
            <li className="criteria-item" key={criterion}>
              <span className="constraint-index" aria-hidden="true">
                <Check size={15} strokeWidth={2.5} />
              </span>
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
        <section
          className="evidence-application-panel"
          aria-labelledby="evidence-application-title"
        >
          <span className="field-help">
            Evidence → design · commit before you build
          </span>
          <h2 id="evidence-application-title">
            Choose the evidence-driven move you will build.
          </h2>
          <p>
            Commit to one concrete design move that follows from the
            source-backed finding you judged, then make it visible in your
            creation below.
          </p>
          {selectedEvidenceForDecision ? (
            <blockquote className="evidence-application-finding">
              <strong>Selected finding:</strong>{" "}
              {selectedEvidenceForDecision.statement}
            </blockquote>
          ) : null}
          <label className="field-label" htmlFor="evidence-application-choice">
            Finding → design choice
            <span className="field-help">20–400 characters</span>
          </label>
          <textarea
            className="text-area evidence-application-choice"
            id="evidence-application-choice"
            name="evidence-application-choice"
            autoComplete="off"
            ref={evidenceApplicationRef}
            value={evidenceApplicationChoice}
            maxLength={400}
            placeholder="Because this finding shows…, I chose to…"
            onChange={(event) => {
              setEvidenceApplicationChoice(event.target.value);
              setCreationReviewed(false);
              setValidation("");
            }}
            aria-describedby={`evidence-application-help${
              evidenceApplicationHasError ? " creation-response-error" : ""
            }`}
            aria-invalid={evidenceApplicationHasError}
          />
          <div
            className="evidence-decision-meta"
            id="evidence-application-help"
          >
            <span>Your reasoning · not an AI-generated link</span>
            <span className="character-count">
              {evidenceApplicationChoice.length}/400
            </span>
          </div>
          {evidenceApplicationHasError ? (
            <p
              className="validation-message"
              id="creation-response-error"
              role="alert"
            >
              <Info size={14} /> {validation}
            </p>
          ) : null}
          <label
            className="field-label"
            htmlFor="artifact-anchor"
            style={{ marginTop: "1rem" }}
          >
            Creation anchor phrase
            <span className="field-help">
              2–8 words · carry it into your creation
            </span>
          </label>
          <input
            className="text-input"
            id="artifact-anchor"
            name="artifact-anchor"
            type="text"
            autoComplete="off"
            ref={artifactAnchorRef}
            value={artifactAnchor}
            maxLength={80}
            placeholder="regular deliveries"
            style={{ minHeight: "2.9rem", padding: "0.7rem 0.85rem" }}
            onChange={(event) => {
              setArtifactAnchor(event.target.value);
              setCreationReviewed(false);
              setValidation("");
            }}
            aria-describedby={`artifact-anchor-help${
              artifactAnchorHasError ? " creation-response-error" : ""
            }`}
            aria-invalid={artifactAnchorHasError}
          />
          <div className="evidence-decision-meta" id="artifact-anchor-help">
            <span>
              Copy a short phrase exactly from the design move above, then
              repeat it in your creation. This checks continuity, not quality or
              correctness.
            </span>
            <span className="character-count">
              {artifactAnchorWordCount(artifactAnchor)} words
            </span>
          </div>
          {artifactAnchorHasError ? (
            <p
              className="validation-message"
              id="creation-response-error"
              role="alert"
            >
              <Info size={14} /> {validation}
            </p>
          ) : null}
        </section>
        <label className="field-label" htmlFor="creation-response">
          Build your response in the browser
          <span className="field-help">10–5,000 characters</span>
        </label>
        <textarea
          className="text-area text-area-large"
          id="creation-response"
          name="creation-response"
          autoComplete="off"
          ref={artifactRef}
          value={artifact}
          maxLength={5000}
          placeholder="Create your design, model, recommendation, comparison, or argument here…"
          onChange={(event) => {
            setArtifact(event.target.value);
            setCreationReviewed(false);
            setValidation("");
          }}
          aria-describedby={
            artifactHasError ? "creation-response-error" : undefined
          }
          aria-invalid={artifactHasError}
        />
        <div className="field-label">
          <span className="field-help">
            Build the move you committed to; name your tradeoffs.
          </span>
          <span className="character-count">{artifact.length}/5000</span>
        </div>
        <fieldset
          className="creation-self-check"
          aria-describedby={
            creationReviewHasError
              ? "creation-response-error"
              : "creation-self-check-help"
          }
          aria-invalid={creationReviewHasError}
        >
          <legend>Learner self-check</legend>
          <p id="creation-self-check-help">
            This is your review, not an AI grade. Check that your response uses
            the evidence and meets every criterion above.
          </p>
          <label className="creation-review-control">
            <input
              type="checkbox"
              ref={creationReviewedRef}
              checked={creationReviewed}
              onChange={(event) => {
                setCreationReviewed(event.target.checked);
                setValidation("");
              }}
            />
            <span>
              I reviewed my response against every completion criterion.
            </span>
          </label>
        </fieldset>
        {validation &&
        evidenceDecisionIsValid &&
        !evidenceApplicationHasError &&
        !artifactAnchorHasError ? (
          <p
            className="validation-message"
            id="creation-response-error"
            role="alert"
          >
            <Info size={14} /> {validation}
          </p>
        ) : null}
        <div className="safety-note">
          <ShieldCheck size={16} /> {quest.safetyNote}
        </div>
        <div className="button-row">
          <button className="button button-primary" type="submit">
            Finish creation <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
