export type AssignmentRequestKind = "learner_owned" | "submit_ready_completion";

export type AssignmentRequestSignal =
  | "answer_only"
  | "completion_format"
  | "deliverable"
  | "direct_request"
  | "explicit_outsourcing"
  | "inquiry"
  | "production"
  | "scaffolding"
  | "submission_context";

export interface AssignmentRequestClassification {
  kind: AssignmentRequestKind;
  signals: AssignmentRequestSignal[];
}

const DELIVERABLE_PATTERNS: readonly RegExp[] = [
  /\b(?:homework|schoolwork|assignment|coursework|worksheet|problem\s*set)\b/i,
  /\b(?:take[- ]home\s+)?(?:quiz|test|exam)\b/i,
  /\b(?:essays?|papers?|book\s+reports?|lab\s+reports?|research\s+reports?)\b/i,
  /\b(?:discussion\s+posts?|written\s+responses?|personal\s+statements?)\b/i,
  /\b(?:thesis\s+statements?|presentations?(?:\s+scripts?)?|speeches)\b/i,
  /\b(?:coding|programming|science\s+fair|class)\s+project\b/i,
  /\b(?:for|in)\s+(?:(?:my|the)\s+)?(?:class|course)\b/i,
  /\b(?:all|every|these|those|the\s+following)\s+(?:questions?|problems?)\b/i,
  /\b(?:questions?|problems?)\s+(?:number(?:s)?\s+)?\d+(?:\s*[-–]\s*\d+)?\b/i,
];

const PRODUCTION_PATTERNS: readonly RegExp[] = [
  /\b(?:write|draft|compose|generate|produce|provide|deliver|prepare|supply|rewrite|summari[sz]e|respond\s+to)\b/i,
  /\b(?:do|complete|finish|solve|answer|fill\s+out)\b/i,
  /\b(?:make|create|build)\b/i,
  /\b(?:give|tell|send)\s+me\s+(?:(?:the|a)\s+)?(?:answers?|solutions?)\b/i,
];

const DIRECT_REQUEST_PATTERNS: readonly RegExp[] = [
  /^(?:please\s+)?(?:write|draft|compose|generate|produce|provide|deliver|prepare|supply|rewrite|summari[sz]e|respond\s+to|make|create|build)\b/i,
  /^(?:please\s+)?(?:do|complete|finish|solve|answer|fill\s+out)\s+(?:(?:all|every|the|this|that|these|those|my|our)\s+)*(?:homework|schoolwork|assignment|coursework|worksheet|problem\s*set|questions?|problems?|quiz|test|exam|essay|paper|report|project)\b/i,
  /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:write|draft|compose|generate|produce|provide|deliver|prepare|supply|rewrite|summari[sz]e|respond\s+to|make|create|build)\b/i,
  /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:do|complete|finish|solve|answer|fill\s+out)\s+(?:(?:all|every|the|this|that|these|those|my|our)\s+)*(?:homework|schoolwork|assignment|coursework|worksheet|problem\s*set|questions?|problems?|quiz|test|exam|essay|paper|report|project)\b/i,
  /^(?:i\s+need|i\s+want)\s+you\s+to\s+(?:write|draft|compose|generate|produce|provide|deliver|prepare|supply|rewrite|summari[sz]e|respond\s+to|make|create|build)\b/i,
  /^(?:i\s+need|i\s+want)\s+you\s+to\s+(?:do|complete|finish|solve|answer|fill\s+out)\s+(?:(?:all|every|the|this|that|these|those|my|our)\s+)*(?:homework|schoolwork|assignment|coursework|worksheet|problem\s*set|questions?|problems?|quiz|test|exam|essay|paper|report|project)\b/i,
  /^(?:i\s+(?:need|want)|(?:please\s+)?(?:give|send)\s+me)\s+(?:(?:a|an|the|my)\s+)?(?:(?:full|complete|completed|finished|final)\s+|\d{2,5}[- ]word\s+|(?:three|four|five|3|4|5)[- ]paragraph\s+)*(?:essay|paper|report|assignment|discussion\s+post|written\s+response|presentation|speech|project)\b/i,
  /^(?:(?:a|an|the)\s+)?(?:(?:full|complete|completed|finished|final)\s+|\d{2,5}[- ]word\s+|(?:three|four|five|3|4|5)[- ]paragraph\s+)+(?:essay|paper|report|assignment|discussion\s+post|written\s+response|presentation|speech|project)\b/i,
  /^(?:complete|finish)\s+(?:all\s+of\s+)?(?:the\s+)?following\b/i,
  /\b(?:give|send)\s+me\s+(?:the\s+)?(?:answer|answers|finished|final|complete)\b/i,
  /^(?:please\s+)?(?:give|tell|send)\s+me\s+(?:(?:the|a)\s+)?(?:answers?|solutions?)\b/i,
  /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:give|tell|send)\s+me\s+(?:(?:the|a)\s+)?(?:answers?|solutions?)\b/i,
  /^(?:i\s+(?:need|want))\s+(?:(?:the|my)\s+)?(?:full|complete|completed|finished|final)\s+(?:homework|schoolwork|assignment|coursework|worksheet|problem\s*set)\b/i,
];

const EXPLICIT_OUTSOURCING_PATTERNS: readonly RegExp[] = [
  /\b(?:for\s+me|on\s+my\s+behalf)\b/i,
];

const SUBMISSION_CONTEXT_PATTERNS: readonly RegExp[] = [
  /\b(?:ready[- ]to[- ]submit|submission[- ]ready|turn\s+in|hand\s+in)\b/i,
  /\b(?:submit|submission)\s+(?:it|this|the\s+(?:essay|paper|report|assignment|project))\b/i,
  /\b(?:due\s+(?:today|tomorrow|tonight)|before\s+(?:class|the\s+deadline))\b/i,
  /\b(?:match|follow|meet)\s+(?:this|the|my)\s+rubric\b/i,
];

const COMPLETION_FORMAT_PATTERNS: readonly RegExp[] = [
  /\b(?:full|complete|completed|finished|final)\s+(?:homework|schoolwork|essay|paper|report|assignment|coursework|worksheet|problem\s*set|response|presentation|speech|project)\b/i,
  /\b\d{2,5}[- ]word(?:s)?\b/i,
  /\b(?:three|four|five|3|4|5)[- ]paragraph\b/i,
  /\b(?:with|include)\s+(?:in[- ]text\s+)?citations?\s+and\s+(?:a\s+)?(?:bibliography|works\s+cited)\b/i,
];

const ANSWER_ONLY_PATTERNS: readonly RegExp[] = [
  /\b(?:answers?\s+only|just\s+(?:give|send|tell)\s+me\s+the\s+answers?)\b/i,
  /\b(?:without|no)\s+(?:an\s+)?explanation\b/i,
  /\bfill\s+in\s+(?:all\s+)?(?:the\s+)?answers?\b/i,
];

const SCAFFOLDING_PATTERNS: readonly RegExp[] = [
  /\bhelp\s+me\s+(?:understand|brainstorm|plan|outline|organize|revise|review|critique|check|research)\b/i,
  /\b(?:write|draft|make|create|build|give\s+me)\s+(?:an?\s+)?(?:outline|plan|checklist|evidence\s+map|question\s+list)\b/i,
  /\b(?:prepare|create|make|provide|generate|give\s+me)\s+(?:an?\s+|some\s+)?(?:practice\s+(?:questions?|problems?)|study\s+guides?|examples?|explanations?)\b/i,
  /\b(?:prepare|create|make|provide|generate|give\s+me)\s+(?:an?\s+|some\s+)?(?:flashcards?|practice\s+(?:quiz|quizzes|tests?)|worked\s+examples?)\b/i,
  /\b(?:feedback|comments?|critique|review)\s+(?:on|of)\s+(?:my|this|the)\b/i,
  /\b(?:explain|show|teach)\s+me\s+how\b/i,
  /\b(?:brainstorm|suggest|compare|list)\s+(?:\d+\s+|some\s+|several\s+)?(?:possible\s+)?(?:claims?|thesis\s+(?:ideas|statements?)|research\s+questions?)\b/i,
  /\b(?:how\s+(?:should|can|do)\s+i|where\s+should\s+i)\s+(?:begin|start|approach|plan|organize|research)\b/i,
  /\b(?:steps|guidance|tips)\s+(?:for|on)\s+(?:planning|outlining|researching|revising|organizing)\b/i,
];

const INQUIRY_PATTERNS: readonly RegExp[] = [
  /^(?:how|why|what|when|where|who)\b/i,
  /^(?:is|are|was|were|do|does|did|can|could|would|should)\b/i,
  /^(?:help\s+me\s+understand|explain|compare|investigate|explore)\b/i,
];

function normalizeRequest(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:hey|hi|hello|please)\b[\s,!:.]*)+/i, "")
    .replace(/^(?:(?:just|simply)\b[\s,!:.]*)+/i, "")
    .replace(
      /^((?:can|could|would|will)\s+you)\s+(?:(?:please|just|simply)\s+)+/i,
      "$1 ",
    )
    .replace(
      /^(?:for|in)\s+(?:my|the)\s+(?:(?:[a-z][\w-]*)\s+){0,3}(?:class|course)\s*[:,;-]\s*/i,
      "",
    );
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Classifies only requests that combine an academic deliverable with signals
 * that the learner wants ReasonWeave to produce the finished work. Questions
 * about assignments, requests for explanation, and explicit scaffolding remain
 * learner-owned. Multiple independent signals are required so a word such as
 * "essay" or "homework" can never trigger the boundary by itself.
 */
export function classifyAssignmentRequest(
  rawRequest: string,
): AssignmentRequestClassification {
  const request = normalizeRequest(rawRequest);
  const signals: AssignmentRequestSignal[] = [];

  const signalChecks: ReadonlyArray<
    [AssignmentRequestSignal, readonly RegExp[]]
  > = [
    ["deliverable", DELIVERABLE_PATTERNS],
    ["production", PRODUCTION_PATTERNS],
    ["direct_request", DIRECT_REQUEST_PATTERNS],
    ["explicit_outsourcing", EXPLICIT_OUTSOURCING_PATTERNS],
    ["submission_context", SUBMISSION_CONTEXT_PATTERNS],
    ["completion_format", COMPLETION_FORMAT_PATTERNS],
    ["answer_only", ANSWER_ONLY_PATTERNS],
    ["scaffolding", SCAFFOLDING_PATTERNS],
    ["inquiry", INQUIRY_PATTERNS],
  ];

  for (const [signal, patterns] of signalChecks) {
    if (matchesAny(request, patterns)) signals.push(signal);
  }

  const has = (signal: AssignmentRequestSignal) => signals.includes(signal);

  if (!has("deliverable")) {
    return { kind: "learner_owned", signals };
  }

  const hardCompletionDemand =
    has("submission_context") ||
    has("answer_only") ||
    (has("explicit_outsourcing") &&
      (has("production") || has("direct_request") || has("completion_format")));

  if (hardCompletionDemand) {
    return { kind: "submit_ready_completion", signals };
  }

  // An outline, critique, explanation, or plan is the desired redirect, unless
  // the same request also explicitly demands finished or answer-only work.
  if (has("scaffolding")) {
    return { kind: "learner_owned", signals };
  }

  // Method questions such as "How do I write an essay?" remain valid. Direct
  // requests addressed to the assistant ("Could you write...") do not receive
  // this exception.
  if (has("inquiry") && !has("direct_request")) {
    return { kind: "learner_owned", signals };
  }

  const completionScore =
    (has("production") ? 1 : 0) +
    (has("direct_request") ? 2 : 0) +
    (has("explicit_outsourcing") ? 2 : 0) +
    (has("submission_context") ? 2 : 0) +
    (has("completion_format") ? 2 : 0) +
    (has("answer_only") ? 2 : 0);

  return {
    kind: completionScore >= 3 ? "submit_ready_completion" : "learner_owned",
    signals,
  };
}

const ASSIGNMENT_REDIRECT = `LEARNER_AGENCY_REDIRECT
The starting text asks ReasonWeave to produce work that could be submitted as an assignment. Do not provide, promise, or polish a finished submission or an answer-only solution.

Treat the underlying topic as a curiosity and redirect the learner into work they own:
- investigate a focused question and compare evidence;
- choose and defend their own claim or method;
- build their own outline, evidence map, argument map, or completion checklist;
- write the substantive response themselves during the Create step.

Routes, hints, evidence, and feedback may scaffold the process, but must never supply submission-ready prose, complete a worksheet, or solve the entire assignment.
END_LEARNER_AGENCY_REDIRECT`;

/** Returns a fixed server-prompt boundary without echoing learner text. */
export function assignmentRedirectGuidance(question: string): string {
  return classifyAssignmentRequest(question).kind === "submit_ready_completion"
    ? ASSIGNMENT_REDIRECT
    : "";
}
