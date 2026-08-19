"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  CircleHelp,
  Clock3,
  GitBranch,
  Lightbulb,
  PencilRuler,
  Search,
} from "lucide-react";
import Image from "next/image";
import type { KeyboardEvent } from "react";

import { ContextBar, StatusBlocks } from "@/components/quest/chrome";
import { formatLens, routeImage } from "@/components/quest/presentation";
import type { LoadingState, UiError } from "@/components/quest/types";
import { isCanonicalUnderwaterQuestion } from "@/lib/topic-visuals";
import type { CuriositySession, ExplorationRoute } from "@/types/curiosity";

function NeutralRouteVisual({ route }: { route: ExplorationRoute }) {
  const icon = (() => {
    switch (route.lens) {
      case "challenge":
        return <CircleHelp size={38} strokeWidth={1.7} />;
      case "create":
        return <PencilRuler size={38} strokeWidth={1.7} />;
      case "compare":
        return <Search size={38} strokeWidth={1.7} />;
      case "systems":
        return <GitBranch size={38} strokeWidth={1.7} />;
      case "understand":
        return <BrainCircuit size={38} strokeWidth={1.7} />;
    }
  })();

  return (
    <div
      className="route-neutral-visual"
      data-lens={route.lens}
      data-topic-visual="neutral-route"
      aria-hidden="true"
    >
      <span className="route-neutral-orbit route-neutral-orbit-wide" />
      <span className="route-neutral-orbit route-neutral-orbit-tight" />
      <span className="route-neutral-node route-neutral-node-left" />
      <span className="route-neutral-node route-neutral-node-right" />
      <span className="route-neutral-icon">{icon}</span>
    </div>
  );
}

export function ChooseScreen({
  session,
  loading,
  error,
  onSelect,
  onContinue,
  onRetry,
  onDemo,
}: {
  session: CuriositySession;
  loading: LoadingState | null;
  error: UiError | null;
  onSelect: (routeId: string) => void;
  onContinue: () => void;
  onRetry: () => void;
  onDemo?: () => void;
}) {
  const moveRouteFocus = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (loading) return;

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onSelect(session.routes[index].id);
      return;
    }

    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % session.routes.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + session.routes.length) % session.routes.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = session.routes.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextRoute = session.routes[nextIndex];
    onSelect(nextRoute.id);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`route-option-${nextRoute.id}`)
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <section className="screen" aria-labelledby="choose-title">
      <ContextBar session={session} />
      <div className="choose-content">
        <div className="choose-intro">
          <div>
            <span className="field-help">
              Step 2 · Choose a method, not an answer
            </span>
            <h1
              className="section-title"
              id="choose-title"
              data-screen-title
              tabIndex={-1}
            >
              Three ways into your question.
            </h1>
          </div>
          <p className="choose-guidance">
            Each route changes what you do with the question. Pick the method
            that makes you most curious—not the one that sounds easiest.
          </p>
          <div className="question-context-box">
            <Lightbulb size={24} className="coral-mark" />
            {session.question}
          </div>
        </div>

        <div
          className="route-grid"
          role="radiogroup"
          aria-label="Investigation routes"
        >
          {session.routes.map((route, index) => {
            const selected = route.id === session.selectedRouteId;
            return (
              <article
                className="route-card"
                data-selected={selected}
                id={`route-option-${route.id}`}
                key={route.id}
                role="radio"
                aria-checked={selected}
                aria-disabled={Boolean(loading)}
                aria-describedby={`route-hook-${route.id}`}
                aria-labelledby={`route-title-${route.id}`}
                tabIndex={
                  !loading &&
                  (selected || (!session.selectedRouteId && index === 0))
                    ? 0
                    : -1
                }
                onClick={() => {
                  if (!loading) onSelect(route.id);
                }}
                onKeyDown={(event) => moveRouteFocus(event, index)}
              >
                <div className="route-heading">
                  <span className="route-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="route-title" id={`route-title-${route.id}`}>
                    {route.title}
                  </h2>
                </div>
                <p className="route-hook" id={`route-hook-${route.id}`}>
                  {route.hook}
                </p>
                <div className="route-visual">
                  {isCanonicalUnderwaterQuestion(session.question) ? (
                    <Image
                      src={routeImage(route, index)}
                      alt=""
                      width={720}
                      height={480}
                      sizes="(max-width: 600px) calc(100vw - 2.5rem), (max-width: 930px) 40vw, 30vw"
                      priority={index === 0}
                    />
                  ) : (
                    <NeutralRouteVisual route={route} />
                  )}
                </div>
                <dl className="route-meta">
                  <div className="route-meta-row">
                    <dt>
                      <BrainCircuit size={14} /> Thinking lens
                    </dt>
                    <dd>{formatLens(route.lens)}</dd>
                  </div>
                  <div className="route-meta-row">
                    <dt>
                      <PencilRuler size={14} /> Activity
                    </dt>
                    <dd>{route.activityType}</dd>
                  </div>
                  <div className="route-meta-row">
                    <dt>
                      <Clock3 size={14} /> Time
                    </dt>
                    <dd>About {route.estimatedMinutes} min</dd>
                  </div>
                </dl>
                <span
                  className="route-choice-label"
                  data-selected={selected}
                  aria-hidden="true"
                >
                  {selected ? (
                    <>
                      <Check size={18} /> Selected
                    </>
                  ) : (
                    <>
                      Choose this route <ArrowRight size={18} />
                    </>
                  )}
                </span>
              </article>
            );
          })}
        </div>

        <div className="choose-footer-row">
          <div className="button-row">
            <span>Exactly three distinct approaches—no endless branching.</span>
            <button
              className="button button-primary"
              type="button"
              disabled={!session.selectedRouteId || Boolean(loading)}
              onClick={onContinue}
            >
              Build my quest <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <StatusBlocks
          loading={loading}
          error={error}
          onRetry={onRetry}
          onDemo={onDemo}
        />
      </div>
    </section>
  );
}
