"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { AppHeader } from "@/components/app-header";
import { apiError } from "@/components/quest/api-error";
import { AppFooter } from "@/components/quest/chrome";
import {
  formatCompactEvidenceNote,
  parseCompactEvidenceNote,
} from "@/components/quest/evidence-note";
import {
  createSafetyIdentifier,
  hasDraftLearnerWork,
  isProviderFreeBranch,
} from "@/components/quest/learner-work";
import {
  EMPTY_EVIDENCE_DECISION,
  EMPTY_REFLECTION,
  EVIDENCE_RELATIONSHIPS,
  DURATIONS,
  LEVELS,
} from "@/components/quest/options";
import { scrollBehavior } from "@/components/quest/presentation";
import { ChooseScreen } from "@/components/quest/screens/choose-screen";
import { CreateScreen } from "@/components/quest/screens/create-screen";
import {
  DiscoveryScreen,
  preloadDiscoveryCard,
} from "@/components/quest/screens/discovery-screen";
import { InvestigateScreen } from "@/components/quest/screens/investigate-screen";
import { PredictScreen } from "@/components/quest/screens/predict-screen";
import { ReflectScreen } from "@/components/quest/screens/reflect-screen";
import { SparkScreen } from "@/components/quest/screens/spark-screen";
import type {
  DraftState,
  EvidenceDecisionDraft,
  LoadingState,
  UiError,
} from "@/components/quest/types";
import {
  LEARNER_WORK_TTL_MS,
  readLearnerWork,
  serializeLearnerWork,
} from "@/lib/browser-storage";
import { postJson } from "@/lib/client-api";
import { validateEvidenceApplicationArtifact } from "@/lib/evidence-application";
import {
  artifactSchema,
  curiositySessionSchema,
  evidenceApplicationSchema,
  evidenceDecisionSchema,
  predictionSchema,
  questionSchema,
  reflectionInputSchema,
} from "@/lib/schemas";
import {
  createCuriositySession,
  getSelectedRoute,
  migrateStoredCuriositySession,
  transitionSession,
} from "@/lib/session-machine";
import { usesCompactEvidenceDecision } from "@/lib/quest-time-budget";
import type {
  CuriositySession,
  EvidenceBundle,
  LearnerLevel,
  NextQuestionId,
  QuestDuration,
  QuestPlan,
  ReflectionInput,
  ReflectionResult,
  RoutesResponse,
} from "@/types/curiosity";

const SESSION_STORAGE_KEY = "wonderlab.session.v4";
const DRAFT_STORAGE_KEY = "wonderlab.drafts.v4";
const SAFETY_STORAGE_KEY = "wonderlab.safety-id.v1";
const LEGACY_LEARNER_STORAGE_KEYS = [
  "wonderlab.session.v1",
  "wonderlab.drafts.v1",
  "wonderlab.session.v2",
  "wonderlab.drafts.v2",
  "wonderlab.session.v3",
  "wonderlab.drafts.v3",
] as const;

type SeededDemoModule = typeof import("@/lib/seeded-demo");

let seededDemoModulePromise: Promise<SeededDemoModule> | undefined;

function loadSeededDemoModule(): Promise<SeededDemoModule> {
  seededDemoModulePromise ??= import("@/lib/seeded-demo").catch((error) => {
    seededDemoModulePromise = undefined;
    throw error;
  });
  return seededDemoModulePromise;
}

interface ExpiryTimer {
  savedAt: number;
  timerId: number | null;
}

interface ReasonWeaveAppProps {
  allowSeededFallback?: boolean;
  liveGenerationAvailable?: boolean;
}

export function ReasonWeaveApp({
  allowSeededFallback = true,
  liveGenerationAvailable = true,
}: ReasonWeaveAppProps) {
  const [session, setSession] = useState<CuriositySession | null>(null);
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<LearnerLevel>("high_school");
  const [durationMinutes, setDurationMinutes] = useState<QuestDuration>(10);
  const [prediction, setPrediction] = useState("");
  const [evidenceDecision, setEvidenceDecision] =
    useState<EvidenceDecisionDraft>(EMPTY_EVIDENCE_DECISION);
  const [compactEvidenceNote, setCompactEvidenceNote] = useState("");
  const [evidenceApplicationChoice, setEvidenceApplicationChoice] =
    useState("");
  const [artifactAnchor, setArtifactAnchor] = useState("");
  const [artifact, setArtifact] = useState("");
  const [creationReviewed, setCreationReviewed] = useState(false);
  const [reflection, setReflection] =
    useState<ReflectionInput>(EMPTY_REFLECTION);
  const [validation, setValidation] = useState("");
  const [loading, setLoading] = useState<LoadingState | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [safetyIdentifier, setSafetyIdentifier] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const evidenceItemRef = useRef<HTMLSelectElement>(null);
  const evidenceRelationshipRef = useRef<HTMLInputElement>(null);
  const compactEvidenceNoteRef = useRef<HTMLTextAreaElement>(null);
  const evidenceEstablishesRef = useRef<HTMLTextAreaElement>(null);
  const evidenceUnresolvedRef = useRef<HTMLTextAreaElement>(null);
  const evidenceImpactRef = useRef<HTMLTextAreaElement>(null);
  const artifactRef = useRef<HTMLTextAreaElement>(null);
  const evidenceApplicationRef = useRef<HTMLTextAreaElement>(null);
  const artifactAnchorRef = useRef<HTMLInputElement>(null);
  const creationReviewedRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const restoredBranchFocusRef = useRef(false);
  const sessionSavedAtRef = useRef<number | null>(null);
  const draftSavedAtRef = useRef<number | null>(null);
  const draftSnapshotRef = useRef<DraftState>({
    question,
    level,
    durationMinutes,
    prediction,
    evidenceDecision,
    compactEvidenceNote,
    evidenceApplicationChoice,
    artifactAnchor,
    artifact,
    reflection,
  });
  const draftWriteTimerRef = useRef<number | null>(null);
  const sessionExpiryTimerRef = useRef<ExpiryTimer | null>(null);
  const draftExpiryTimerRef = useRef<ExpiryTimer | null>(null);

  const cancelExpiryTimer = useCallback((target: "session" | "draft") => {
    const timerRef =
      target === "session" ? sessionExpiryTimerRef : draftExpiryTimerRef;
    if (timerRef.current?.timerId != null) {
      window.clearTimeout(timerRef.current.timerId);
    }
    timerRef.current = null;
  }, []);

  const clearInMemoryLearnerWork = useCallback(() => {
    restoredBranchFocusRef.current = false;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
      draftWriteTimerRef.current = null;
    }
    cancelExpiryTimer("session");
    cancelExpiryTimer("draft");
    draftSnapshotRef.current = {
      ...draftSnapshotRef.current,
      question: "",
      prediction: "",
      evidenceDecision: { ...EMPTY_EVIDENCE_DECISION },
      compactEvidenceNote: "",
      evidenceApplicationChoice: "",
      artifactAnchor: "",
      artifact: "",
      reflection: { ...EMPTY_REFLECTION },
    };
    sessionSavedAtRef.current = null;
    draftSavedAtRef.current = null;
    setSession(null);
    setQuestion("");
    setPrediction("");
    setEvidenceDecision(EMPTY_EVIDENCE_DECISION);
    setCompactEvidenceNote("");
    setEvidenceApplicationChoice("");
    setArtifactAnchor("");
    setArtifact("");
    setCreationReviewed(false);
    setReflection(EMPTY_REFLECTION);
    setLoading(null);
    setError(null);
    setValidation("");
    setShowHint(false);
  }, [cancelExpiryTimer]);

  const expireLearnerWork = useCallback(() => {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // In-memory expiry still enforces the learner-work lifetime.
    } finally {
      clearInMemoryLearnerWork();
    }
  }, [clearInMemoryLearnerWork]);

  const scheduleExpiry = useCallback(
    (savedAt: number, target: "session" | "draft") => {
      const timerRef =
        target === "session" ? sessionExpiryTimerRef : draftExpiryTimerRef;
      if (timerRef.current?.savedAt === savedAt) return;
      if (timerRef.current?.timerId != null) {
        window.clearTimeout(timerRef.current.timerId);
      }

      const remaining = savedAt + LEARNER_WORK_TTL_MS - Date.now();
      if (remaining <= 0) {
        expireLearnerWork();
        return;
      }

      const timerId = window.setTimeout(() => {
        expireLearnerWork();
      }, remaining);
      timerRef.current = { savedAt, timerId };
    },
    [expireLearnerWork],
  );

  const flushDraft = useCallback(() => {
    if (!hydratedRef.current) return;
    const pending = draftSnapshotRef.current;
    if (!hasDraftLearnerWork(pending)) {
      draftSavedAtRef.current = null;
      cancelExpiryTimer("draft");
      try {
        if (window.localStorage.getItem(DRAFT_STORAGE_KEY) !== null) {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        // The in-memory empty state still wins when storage is unavailable.
      }
      return;
    }

    try {
      const now = Date.now();
      const savedAt =
        draftSavedAtRef.current ?? sessionSavedAtRef.current ?? now;
      draftSavedAtRef.current = savedAt;
      if (now - savedAt > LEARNER_WORK_TTL_MS) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        scheduleExpiry(savedAt, "draft");
        return;
      }

      const serialized = serializeLearnerWork(pending, savedAt);
      if (window.localStorage.getItem(DRAFT_STORAGE_KEY) !== serialized) {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
      }
      scheduleExpiry(savedAt, "draft");
    } catch {
      // The app remains fully usable when storage is unavailable.
    }
  }, [cancelExpiryTimer, scheduleExpiry]);

  const flushPendingDraft = useCallback(() => {
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
      draftWriteTimerRef.current = null;
    }
    flushDraft();
  }, [flushDraft]);

  useLayoutEffect(() => {
    draftSnapshotRef.current = {
      question,
      level,
      durationMinutes,
      prediction,
      evidenceDecision,
      compactEvidenceNote,
      evidenceApplicationChoice,
      artifactAnchor,
      artifact,
      reflection,
    };
  }, [
    artifact,
    artifactAnchor,
    compactEvidenceNote,
    durationMinutes,
    evidenceDecision,
    evidenceApplicationChoice,
    level,
    prediction,
    question,
    reflection,
  ]);

  const abortActiveRequest = useCallback(() => {
    const request = activeRequestRef.current;
    activeRequestRef.current = null;
    request?.abort();
  }, []);

  const beginRequest = useCallback(() => {
    const previousRequest = activeRequestRef.current;
    activeRequestRef.current = null;
    previousRequest?.abort();
    const request = new AbortController();
    activeRequestRef.current = request;
    return request;
  }, []);

  const isCurrentRequest = useCallback(
    (request: AbortController) =>
      activeRequestRef.current === request && !request.signal.aborted,
    [],
  );

  const finishRequest = useCallback((request: AbortController) => {
    if (activeRequestRef.current !== request) return;
    activeRequestRef.current = null;
    setLoading(null);
  }, []);

  useEffect(() => abortActiveRequest, [abortActiveRequest]);

  useEffect(() => {
    if (session?.step !== "reflect") return;
    // The learner still needs to write their reflection, so warm the final
    // export chunk before their first Branch selection can reveal it.
    preloadDiscoveryCard();
  }, [session?.step]);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is an external
     browser store; this one-time effect intentionally hydrates client state. */
  useEffect(() => {
    if (hydratedRef.current) return;

    try {
      for (const key of LEGACY_LEARNER_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }

      const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const storedSession = readLearnerWork<unknown>(savedSession);
        const parsed = curiositySessionSchema.safeParse(
          migrateStoredCuriositySession(storedSession?.data),
        );
        if (
          parsed.success &&
          !(
            !liveGenerationAvailable &&
            parsed.data.mode === "live" &&
            !isProviderFreeBranch(parsed.data)
          )
        ) {
          restoredBranchFocusRef.current = parsed.data.step === "branch";
          sessionSavedAtRef.current = storedSession!.savedAt;
          setSession(parsed.data);
          setQuestion(parsed.data.question);
          setLevel(parsed.data.level);
          setDurationMinutes(parsed.data.durationMinutes);
          setPrediction(parsed.data.prediction ?? "");
          setEvidenceDecision(
            parsed.data.evidenceDecision ?? EMPTY_EVIDENCE_DECISION,
          );
          setCompactEvidenceNote(
            usesCompactEvidenceDecision(parsed.data.durationMinutes) &&
              parsed.data.evidenceDecision
              ? formatCompactEvidenceNote(parsed.data.evidenceDecision)
              : "",
          );
          setEvidenceApplicationChoice(
            parsed.data.evidenceApplication?.designChoice ?? "",
          );
          setArtifactAnchor(
            parsed.data.evidenceApplication?.artifactAnchor ?? "",
          );
          setArtifact(parsed.data.artifact ?? "");
          setReflection(parsed.data.reflectionInput ?? EMPTY_REFLECTION);
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }

      const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const storedDraft = readLearnerWork<Partial<DraftState>>(savedDraft);
        const draft = storedDraft?.data;
        if (draft && storedDraft) {
          draftSavedAtRef.current = storedDraft.savedAt;
          if (typeof draft.question === "string") setQuestion(draft.question);
          if (LEVELS.some((option) => option.value === draft.level)) {
            setLevel(draft.level as LearnerLevel);
          }
          if (DURATIONS.includes(draft.durationMinutes as QuestDuration)) {
            setDurationMinutes(draft.durationMinutes as QuestDuration);
          }
          if (typeof draft.prediction === "string") {
            setPrediction(draft.prediction);
          }
          if (
            draft.evidenceDecision &&
            typeof draft.evidenceDecision.evidenceItemId === "string" &&
            (draft.evidenceDecision.relationship === "" ||
              EVIDENCE_RELATIONSHIPS.some(
                ({ value }) => value === draft.evidenceDecision?.relationship,
              )) &&
            typeof draft.evidenceDecision.establishes === "string" &&
            typeof draft.evidenceDecision.unresolved === "string" &&
            typeof draft.evidenceDecision.impact === "string"
          ) {
            setEvidenceDecision(draft.evidenceDecision);
            if (
              usesCompactEvidenceDecision(
                draft.durationMinutes as QuestDuration,
              )
            ) {
              setCompactEvidenceNote(
                typeof draft.compactEvidenceNote === "string"
                  ? draft.compactEvidenceNote
                  : formatCompactEvidenceNote(draft.evidenceDecision),
              );
            }
          }
          if (typeof draft.evidenceApplicationChoice === "string") {
            setEvidenceApplicationChoice(draft.evidenceApplicationChoice);
          }
          if (typeof draft.artifactAnchor === "string") {
            setArtifactAnchor(draft.artifactAnchor);
          }
          if (typeof draft.artifact === "string") setArtifact(draft.artifact);
          if (
            draft.reflection &&
            typeof draft.reflection.usedToThink === "string" &&
            typeof draft.reflection.nowThink === "string" &&
            typeof draft.reflection.stillWonder === "string"
          ) {
            setReflection(draft.reflection);
          }
        } else {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }

      const savedSafetyIdentifier =
        window.localStorage.getItem(SAFETY_STORAGE_KEY);
      const identifier = savedSafetyIdentifier || createSafetyIdentifier();
      window.localStorage.setItem(SAFETY_STORAGE_KEY, identifier);
      setSafetyIdentifier(identifier);
    } catch {
      setSafetyIdentifier(createSafetyIdentifier());
    } finally {
      hydratedRef.current = true;
      setHydrated(true);
    }
  }, [liveGenerationAvailable]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    const syncLearnerWorkRemoval = (event: StorageEvent) => {
      if (
        event.storageArea !== window.localStorage ||
        event.newValue !== null ||
        (event.key !== SESSION_STORAGE_KEY && event.key !== DRAFT_STORAGE_KEY)
      ) {
        return;
      }
      clearInMemoryLearnerWork();
    };

    window.addEventListener("storage", syncLearnerWorkRemoval);
    return () => window.removeEventListener("storage", syncLearnerWorkRemoval);
  }, [clearInMemoryLearnerWork, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const now = Date.now();
      if (session) {
        const savedAt =
          sessionSavedAtRef.current ?? draftSavedAtRef.current ?? now;
        sessionSavedAtRef.current = savedAt;
        if (now - savedAt <= LEARNER_WORK_TTL_MS) {
          const serialized = serializeLearnerWork(session, savedAt);
          if (window.localStorage.getItem(SESSION_STORAGE_KEY) !== serialized) {
            window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
          }
          scheduleExpiry(savedAt, "session");
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          scheduleExpiry(savedAt, "session");
        }
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionSavedAtRef.current = null;
        cancelExpiryTimer("session");
      }
    } catch {
      // The app remains fully usable when storage is unavailable.
    }
  }, [cancelExpiryTimer, hydrated, scheduleExpiry, session]);

  useEffect(() => {
    if (!hydrated) return;
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
    }
    const timerId = window.setTimeout(() => {
      if (draftWriteTimerRef.current !== timerId) return;
      draftWriteTimerRef.current = null;
      flushDraft();
    }, 300);
    draftWriteTimerRef.current = timerId;

    return () => {
      if (draftWriteTimerRef.current === timerId) {
        window.clearTimeout(timerId);
        draftWriteTimerRef.current = null;
      }
    };
  }, [
    artifact,
    artifactAnchor,
    compactEvidenceNote,
    durationMinutes,
    evidenceDecision,
    evidenceApplicationChoice,
    flushDraft,
    hydrated,
    level,
    prediction,
    question,
    reflection,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const flushHiddenDraft = () => {
      if (document.visibilityState === "hidden") flushPendingDraft();
    };

    window.addEventListener("pagehide", flushPendingDraft);
    document.addEventListener("visibilitychange", flushHiddenDraft);
    return () => {
      window.removeEventListener("pagehide", flushPendingDraft);
      document.removeEventListener("visibilitychange", flushHiddenDraft);
    };
  }, [flushPendingDraft, hydrated]);

  useEffect(
    () => () => {
      if (draftWriteTimerRef.current !== null) {
        window.clearTimeout(draftWriteTimerRef.current);
      }
      cancelExpiryTimer("session");
      cancelExpiryTimer("draft");
    },
    [cancelExpiryTimer],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (session?.step === "branch") {
        if (!restoredBranchFocusRef.current) return;
        restoredBranchFocusRef.current = false;

        // The deferred map owns the final focus handoff once it mounts. Until
        // then, keep a restored Branch on its stable screen heading instead of
        // leaving focus timing-dependent on the hydration frame.
        if (document.querySelector("#curiosity-map")) return;
      }

      const heading = document.querySelector<HTMLElement>(
        "[data-screen-title]",
      );
      heading?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: scrollBehavior(),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session?.step]);

  const ensureSafetyIdentifier = useCallback(() => {
    if (safetyIdentifier) return safetyIdentifier;
    const next = createSafetyIdentifier();
    setSafetyIdentifier(next);
    try {
      window.localStorage.setItem(SAFETY_STORAGE_KEY, next);
    } catch {
      // A per-tab anonymous identifier still provides request consistency.
    }
    return next;
  }, [safetyIdentifier]);

  const clearStatus = () => {
    setError(null);
    setValidation("");
  };

  const showCreationValidation = (
    message: string,
    target: HTMLElement | null,
  ) => {
    setValidation(message);
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      target?.focus({ preventScroll: true });
    });
  };

  const startDemo = useCallback(async () => {
    if (!allowSeededFallback) return;
    abortActiveRequest();
    clearStatus();
    setLoading({
      stage: "routes",
      message: "Opening the complete pre-generated demo…",
    });
    const request = beginRequest();
    try {
      const { seededDemo } = await loadSeededDemoModule();
      if (process.env.NODE_ENV !== "production") {
        window.dispatchEvent(
          new Event("reasonweave:seeded-demo-module-settled"),
        );
      }
      if (!isCurrentRequest(request)) return;
      const base = createCuriositySession({
        question: seededDemo.question,
        level: seededDemo.level,
        durationMinutes: seededDemo.durationMinutes,
        mode: "seeded_fallback",
      });
      const ready = transitionSession(base, {
        type: "ROUTES_GENERATED",
        routes: seededDemo.routes,
      });
      setQuestion(seededDemo.question);
      setLevel(seededDemo.level);
      setDurationMinutes(seededDemo.durationMinutes);
      setPrediction("");
      setEvidenceDecision(EMPTY_EVIDENCE_DECISION);
      setCompactEvidenceNote("");
      setEvidenceApplicationChoice("");
      setArtifactAnchor("");
      setArtifact("");
      setCreationReviewed(false);
      setReflection(EMPTY_REFLECTION);
      setSession(ready);
    } catch {
      if (isCurrentRequest(request)) {
        setError({
          title: "The demo did not open",
          message:
            "The pre-generated demo could not finish loading. Open it again to retry.",
          retryStage: "routes",
          retryable: false,
        });
      }
    } finally {
      finishRequest(request);
    }
  }, [
    abortActiveRequest,
    allowSeededFallback,
    beginRequest,
    finishRequest,
    isCurrentRequest,
  ]);

  const generateRoutes = useCallback(async () => {
    const parsed = questionSchema.safeParse(question);
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? "Add a question first.");
      return;
    }

    flushPendingDraft();
    clearStatus();
    setLoading({
      stage: "routes",
      message: "Finding three genuinely different ways into your question…",
    });
    const request = beginRequest();
    try {
      const result = await postJson<RoutesResponse>(
        "/api/routes",
        {
          question: parsed.data,
          level,
          durationMinutes,
          safetyIdentifier: ensureSafetyIdentifier(),
        },
        {
          signal: request.signal,
        },
      );
      if (!isCurrentRequest(request)) return;
      const base = createCuriositySession({
        question: parsed.data,
        level,
        durationMinutes,
        mode: "live",
      });
      setSession(
        transitionSession(base, {
          type: "ROUTES_GENERATED",
          routes: result.routes,
        }),
      );
    } catch (caught) {
      if (isCurrentRequest(request)) setError(apiError(caught, "routes"));
    } finally {
      finishRequest(request);
    }
  }, [
    beginRequest,
    durationMinutes,
    ensureSafetyIdentifier,
    finishRequest,
    flushPendingDraft,
    isCurrentRequest,
    level,
    question,
  ]);

  const chooseRoute = (routeId: string) => {
    if (!session || session.step !== "choose") return;
    clearStatus();
    setSession(transitionSession(session, { type: "ROUTE_SELECTED", routeId }));
  };

  const loadQuest = useCallback(async () => {
    if (!session || session.step !== "choose") return;
    const selectedRoute = getSelectedRoute(session);
    if (!selectedRoute) {
      setValidation("Choose one route before building the quest.");
      return;
    }

    clearStatus();
    setLoading({
      stage: "quest",
      message: "Turning that method into a focused, browser-safe challenge…",
    });
    const request = beginRequest();
    try {
      const quest =
        session.mode === "seeded_fallback"
          ? (await loadSeededDemoModule()).seededQuestForRoute(selectedRoute)
          : await postJson<QuestPlan>(
              "/api/quest",
              {
                question: session.question,
                level: session.level,
                durationMinutes: session.durationMinutes,
                selectedRoute,
                safetyIdentifier: ensureSafetyIdentifier(),
              },
              {
                signal: request.signal,
              },
            );
      if (!isCurrentRequest(request)) return;
      setSession(transitionSession(session, { type: "QUEST_LOADED", quest }));
      setPrediction("");
      setEvidenceDecision(EMPTY_EVIDENCE_DECISION);
      setCompactEvidenceNote("");
      setEvidenceApplicationChoice("");
      setArtifactAnchor("");
      setShowHint(false);
    } catch (caught) {
      if (isCurrentRequest(request)) setError(apiError(caught, "quest"));
    } finally {
      finishRequest(request);
    }
  }, [
    beginRequest,
    ensureSafetyIdentifier,
    finishRequest,
    isCurrentRequest,
    session,
  ]);

  const submitPrediction = () => {
    if (!session || session.step !== "predict") return;
    const parsed = predictionSchema.safeParse(prediction);
    if (!parsed.success) {
      setValidation(
        parsed.error.issues[0]?.message ??
          "Make a meaningful prediction first.",
      );
      return;
    }
    clearStatus();
    setSession(
      transitionSession(session, {
        type: "PREDICTION_SUBMITTED",
        prediction: parsed.data,
      }),
    );
  };

  const loadEvidence = useCallback(async () => {
    if (!session || session.step !== "investigate" || !session.prediction)
      return;
    const selectedRoute = getSelectedRoute(session);
    if (!selectedRoute) return;

    clearStatus();
    setLoading({
      stage: "evidence",
      message:
        session.mode === "seeded_fallback"
          ? "Opening the pre-generated Evidence Lens…"
          : "Searching the web and connecting claims to returned sources…",
    });
    const request = beginRequest();
    try {
      const evidence =
        session.mode === "seeded_fallback"
          ? (await loadSeededDemoModule()).seededEvidenceForRoute(selectedRoute)
          : await postJson<EvidenceBundle>(
              "/api/evidence",
              {
                question: session.question,
                selectedRoute,
                prediction: session.prediction,
                level: session.level,
                durationMinutes: session.durationMinutes,
                safetyIdentifier: ensureSafetyIdentifier(),
              },
              {
                signal: request.signal,
              },
            );
      if (!isCurrentRequest(request)) return;
      setSession(
        transitionSession(session, { type: "EVIDENCE_LOADED", evidence }),
      );
      setEvidenceDecision(EMPTY_EVIDENCE_DECISION);
      setCompactEvidenceNote("");
      setEvidenceApplicationChoice("");
      setArtifactAnchor("");
    } catch (caught) {
      if (isCurrentRequest(request)) setError(apiError(caught, "evidence"));
    } finally {
      finishRequest(request);
    }
  }, [
    beginRequest,
    ensureSafetyIdentifier,
    finishRequest,
    isCurrentRequest,
    session,
  ]);

  const submitArtifact = () => {
    if (!session || session.step !== "create") return;
    const selectedEvidence = session.evidence?.items.find(
      (item) => item.id === evidenceDecision.evidenceItemId,
    );
    if (
      !selectedEvidence ||
      selectedEvidence.kind !== "evidence" ||
      selectedEvidence.sourceIds.length === 0
    ) {
      showCreationValidation(
        "Choose one source-backed finding from this Evidence Lens before you continue.",
        evidenceItemRef.current,
      );
      return;
    }
    if (!evidenceDecision.relationship) {
      showCreationValidation(
        "Decide whether the finding supports, challenges, or complicates your prediction.",
        evidenceRelationshipRef.current,
      );
      return;
    }
    let decisionForSubmission = evidenceDecision;
    if (usesCompactEvidenceDecision(session.durationMinutes)) {
      const compactNote = parseCompactEvidenceNote(compactEvidenceNote);
      if (!compactNote.success) {
        showCreationValidation(
          compactNote.message,
          compactEvidenceNoteRef.current,
        );
        return;
      }
      decisionForSubmission = {
        ...evidenceDecision,
        ...compactNote.data,
      };
    } else {
      if (evidenceDecision.establishes.trim().length < 15) {
        showCreationValidation(
          "State what the selected finding and its cited sources establish (at least 15 characters).",
          evidenceEstablishesRef.current,
        );
        return;
      }
      if (evidenceDecision.unresolved.trim().length < 15) {
        showCreationValidation(
          "State where the cited source scope stops: separate what it directly supports from your inference or a question it cannot answer (at least 15 characters).",
          evidenceUnresolvedRef.current,
        );
        return;
      }
      if (evidenceDecision.impact.trim().length < 15) {
        showCreationValidation(
          "Explain why that evidence boundary matters for your prediction (at least 15 characters).",
          evidenceImpactRef.current,
        );
        return;
      }
    }
    const parsedDecision = evidenceDecisionSchema.safeParse(
      decisionForSubmission,
    );
    if (!parsedDecision.success) {
      showCreationValidation(
        parsedDecision.error.issues[0]?.message ??
          "Choose a source-backed finding, decide how it relates to your prediction, and separate what its cited sources directly support from your inference or a question they cannot answer.",
        evidenceItemRef.current,
      );
      return;
    }
    const parsedApplication = evidenceApplicationSchema.safeParse({
      evidenceItemId: parsedDecision.data.evidenceItemId,
      designChoice: evidenceApplicationChoice,
      artifactAnchor,
    });
    if (!parsedApplication.success) {
      const firstIssue = parsedApplication.error.issues[0];
      const anchorIssue = firstIssue?.path[0] === "artifactAnchor";
      showCreationValidation(
        firstIssue?.message ??
          "Link the selected finding to one concrete choice in your creation.",
        anchorIssue
          ? artifactAnchorRef.current
          : evidenceApplicationRef.current,
      );
      return;
    }
    const parsed = artifactSchema.safeParse(artifact);
    if (!parsed.success) {
      showCreationValidation(
        parsed.error.issues[0]?.message ??
          "Build out your response before reflecting.",
        artifactRef.current,
      );
      return;
    }
    const applicationArtifact = validateEvidenceApplicationArtifact(
      parsedApplication.data,
      parsed.data,
    );
    if (!applicationArtifact.success) {
      showCreationValidation(
        applicationArtifact.message ??
          "Carry one exact phrase from your evidence-driven design move into the creation.",
        applicationArtifact.field === "artifact"
          ? artifactRef.current
          : artifactAnchorRef.current,
      );
      return;
    }
    if (!creationReviewed) {
      showCreationValidation(
        "Review your creation against every completion criterion before you continue.",
        creationReviewedRef.current,
      );
      return;
    }
    clearStatus();
    setEvidenceDecision(parsedDecision.data);
    setSession(
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: parsed.data,
        evidenceDecision: parsedDecision.data,
        evidenceApplication: parsedApplication.data,
      }),
    );
  };

  const submitReflection = useCallback(async () => {
    if (
      !session ||
      session.step !== "reflect" ||
      !session.prediction ||
      !session.evidence ||
      !session.evidenceDecision ||
      !session.evidenceApplication ||
      !session.artifact
    ) {
      return;
    }
    const selectedRoute = getSelectedRoute(session);
    if (!selectedRoute) return;
    const parsed = reflectionInputSchema.safeParse(reflection);
    if (!parsed.success) {
      setValidation(
        parsed.error.issues[0]?.message ??
          "Complete all three reflection prompts.",
      );
      return;
    }

    clearStatus();
    setLoading({
      stage: "reflection",
      message:
        "Tracing the specific change in your thinking and opening three branches…",
    });
    const request = beginRequest();
    try {
      const result =
        session.mode === "seeded_fallback"
          ? (await loadSeededDemoModule()).buildSeededReflection(
              selectedRoute,
              parsed.data,
              session.artifact,
              session.evidence,
              session.evidenceDecision,
              session.evidenceApplication,
            )
          : await postJson<ReflectionResult>(
              "/api/reflect",
              {
                question: session.question,
                route: selectedRoute,
                prediction: session.prediction,
                evidence: session.evidence,
                evidenceDecision: session.evidenceDecision,
                evidenceApplication: session.evidenceApplication,
                artifact: session.artifact,
                reflection: parsed.data,
                safetyIdentifier: ensureSafetyIdentifier(),
              },
              {
                signal: request.signal,
              },
            );
      if (!isCurrentRequest(request)) return;
      setSession(
        transitionSession(session, {
          type: "REFLECTION_COMPLETED",
          reflectionInput: parsed.data,
          reflectionResult: result,
        }),
      );
    } catch (caught) {
      if (isCurrentRequest(request)) {
        setError(apiError(caught, "reflection"));
      }
    } finally {
      finishRequest(request);
    }
  }, [
    beginRequest,
    ensureSafetyIdentifier,
    finishRequest,
    isCurrentRequest,
    reflection,
    session,
  ]);

  const retry = () => {
    switch (error?.retryStage) {
      case "routes":
        void generateRoutes();
        break;
      case "quest":
        void loadQuest();
        break;
      case "evidence":
        void loadEvidence();
        break;
      case "reflection":
        void submitReflection();
        break;
    }
  };

  const reset = () => {
    if (hasLearnerWork) {
      const confirmed = window.confirm(
        "Start a new quest? Your current quest will be removed from this browser.",
      );
      if (!confirmed) return;
    }
    restoredBranchFocusRef.current = false;
    abortActiveRequest();
    draftSnapshotRef.current = {
      question: "",
      level,
      durationMinutes,
      prediction: "",
      evidenceDecision: { ...EMPTY_EVIDENCE_DECISION },
      compactEvidenceNote: "",
      evidenceApplicationChoice: "",
      artifactAnchor: "",
      artifact: "",
      reflection: { ...EMPTY_REFLECTION },
    };
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
      draftWriteTimerRef.current = null;
    }
    cancelExpiryTimer("session");
    cancelExpiryTimer("draft");
    setSession(null);
    setQuestion("");
    setPrediction("");
    setEvidenceDecision(EMPTY_EVIDENCE_DECISION);
    setCompactEvidenceNote("");
    setEvidenceApplicationChoice("");
    setArtifactAnchor("");
    setArtifact("");
    setCreationReviewed(false);
    setReflection(EMPTY_REFLECTION);
    setLoading(null);
    setError(null);
    setValidation("");
    setShowHint(false);
    sessionSavedAtRef.current = null;
    draftSavedAtRef.current = null;
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      for (const key of LEGACY_LEARNER_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Reset still succeeds in memory if storage is blocked.
    }
  };

  const showMap = () => {
    const map = document.querySelector<HTMLElement>("#curiosity-map");
    map?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    map?.focus({ preventScroll: true });
  };

  const selectNextQuestion = (nextQuestionId: NextQuestionId) => {
    if (!session || session.step !== "branch") return;
    clearStatus();
    setSession(
      transitionSession(session, {
        type: "NEXT_QUESTION_SELECTED",
        nextQuestionId,
      }),
    );
  };

  const step = session?.step ?? "spark";
  const quest = session?.quest;
  const hasLearnerWork = Boolean(
    session ||
    question.trim() ||
    prediction.trim() ||
    evidenceDecision.evidenceItemId ||
    evidenceDecision.relationship ||
    evidenceDecision.establishes.trim() ||
    evidenceDecision.unresolved.trim() ||
    evidenceDecision.impact.trim() ||
    compactEvidenceNote.trim() ||
    evidenceApplicationChoice.trim() ||
    artifactAnchor.trim() ||
    artifact.trim() ||
    reflection.usedToThink.trim() ||
    reflection.nowThink.trim() ||
    reflection.stillWonder.trim(),
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to quest
      </a>
      <AppHeader
        step={step}
        hasLearnerWork={hasLearnerWork}
        mapAvailable={Boolean(session && session.step !== "choose")}
        onReset={reset}
        onShowMap={showMap}
      />
      <main className="main-shell" id="main-content" tabIndex={-1}>
        {!session ? (
          <SparkScreen
            question={question}
            level={level}
            durationMinutes={durationMinutes}
            validation={validation}
            loading={loading}
            error={error}
            liveGenerationAvailable={liveGenerationAvailable}
            onQuestion={(value) => {
              setQuestion(value);
              setValidation("");
              setError(null);
            }}
            onLevel={setLevel}
            onDuration={setDurationMinutes}
            onLive={() => void generateRoutes()}
            onDemo={allowSeededFallback ? startDemo : undefined}
            onRetry={retry}
          />
        ) : null}

        {session?.step === "choose" ? (
          <ChooseScreen
            session={session}
            loading={loading}
            error={error}
            onSelect={chooseRoute}
            onContinue={() => void loadQuest()}
            onRetry={retry}
            onDemo={allowSeededFallback ? startDemo : undefined}
          />
        ) : null}

        {session?.step === "predict" && quest ? (
          <PredictScreen
            session={session}
            quest={quest}
            prediction={prediction}
            validation={validation}
            onPrediction={(value) => {
              setPrediction(value);
              setValidation("");
            }}
            onSubmit={submitPrediction}
          />
        ) : null}

        {session?.step === "investigate" && quest && session.prediction ? (
          <InvestigateScreen
            session={session}
            quest={quest}
            showHint={showHint}
            loading={loading}
            error={error}
            onToggleHint={() => setShowHint((visible) => !visible)}
            onLoadEvidence={() => void loadEvidence()}
            onRetry={retry}
            onDemo={allowSeededFallback ? startDemo : undefined}
          />
        ) : null}

        {session?.step === "create" && quest && session.evidence ? (
          <CreateScreen
            session={session}
            quest={quest}
            evidence={session.evidence}
            evidenceDecision={evidenceDecision}
            setEvidenceDecision={setEvidenceDecision}
            compactEvidenceNote={compactEvidenceNote}
            setCompactEvidenceNote={setCompactEvidenceNote}
            evidenceApplicationChoice={evidenceApplicationChoice}
            setEvidenceApplicationChoice={setEvidenceApplicationChoice}
            artifactAnchor={artifactAnchor}
            setArtifactAnchor={setArtifactAnchor}
            artifact={artifact}
            setArtifact={setArtifact}
            creationReviewed={creationReviewed}
            setCreationReviewed={setCreationReviewed}
            validation={validation}
            setValidation={setValidation}
            evidenceItemRef={evidenceItemRef}
            evidenceRelationshipRef={evidenceRelationshipRef}
            compactEvidenceNoteRef={compactEvidenceNoteRef}
            evidenceEstablishesRef={evidenceEstablishesRef}
            evidenceUnresolvedRef={evidenceUnresolvedRef}
            evidenceImpactRef={evidenceImpactRef}
            artifactRef={artifactRef}
            evidenceApplicationRef={evidenceApplicationRef}
            artifactAnchorRef={artifactAnchorRef}
            creationReviewedRef={creationReviewedRef}
            onSubmit={submitArtifact}
          />
        ) : null}

        {session?.step === "reflect" && session.artifact && session.evidence ? (
          <ReflectScreen
            session={session}
            reflection={reflection}
            validation={validation}
            loading={loading}
            error={error}
            onReflection={(value) => {
              setReflection(value);
              setValidation("");
            }}
            onSubmit={() => void submitReflection()}
            onRetry={retry}
            onDemo={allowSeededFallback ? startDemo : undefined}
          />
        ) : null}

        {session?.step === "branch" ? (
          <DiscoveryScreen
            session={session}
            onReset={reset}
            onSelectNextQuestion={selectNextQuestion}
          />
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}
