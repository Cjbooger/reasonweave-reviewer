# Safety, privacy, and trust

ReasonWeave is an open-ended AI learning prototype for people age 13 and older. Its safety approach combines a narrow audience and product scope, data minimization, moderation, safe generation constraints, server validation, transparent evidence provenance, and calm recovery states.

The current `0bd5aef` checkpoint also has fresh no-hardlink/no-alternates clone proof (exact HEAD/tree, unique pack inode/link count 1, and `npm ci` adding 464 packages); keyboard stress 5/5 remains direct-worktree proof.

This document describes the implemented controls and their remaining proof requirements. A control is not considered fully verified merely because it appears here; credentialed model behavior, deployment configuration, production logs, and deployed adversarial review still require live evidence. A repository security review and bounded local regression proof are recorded below.

> **Current checkpoint supersession — July 19, 2026:** exact `0bd5aef89ab4715477491b462c13be0c5978ac6b` / tree `4d6162e7a7632bba96f582818f44d98bbff956a0` has direct clean committed-worktree proof: format/lint/typecheck, 46/596 Vitest, 145/145 fixtures, production build, bundle 464,236/113,930 initial, Playwright 28 pass/68 deliberate skip, no-key 1/1 zero API, keyboard stress 5/5, online/offline audit 0, expected-only reviewer/test/dev email and loopback scan matches, diff and clean status. No secret was read and no fresh provider, OpenAI, media, deployment, or publication action occurred. Default preflight is 13 PASS / 0 FAIL / 7 PENDING; strict release correctly remains 0/9 until external evidence exists. Earlier `acfdc37` current wording is superseded historical predecessor proof.

**Historical predecessor checkpoint:** exact source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` (tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`) passed direct-worktree and fresh no-hardlink/no-alternates-clone format/lint/typecheck, 44/509 Vitest, 145/145 fixtures, build/bundle budgets, serial Playwright 28/68, no-key Chromium 1/1 with zero API requests, online/offline audit 0, scans, diff check, and final clean status. Desktop and 390 × 844 implementation-worktree QA passed the compact evidence judgment and final Discovery Card without horizontal overflow, but temporary frames are not release capture or manual accessibility proof. Independent final education and release reviews found no P0–P3. No provider/Keychain secret read, OpenAI, media, deployment, publication, or submission action occurred.

Historical predecessor `5ddbac355e1ab90fa7e3a8533ca2cbf995c5ab57` (tree `b9632e2924dccfd13d26accb9aa029c2bfd86d3e`) retains its exact 464-package clean-install proof: format/lint/typecheck, 40 files / 467 tests, 142/142 fixtures, production build, authoritative serial Playwright 28/68 (96 total), no-key Chromium 1/1 with zero API requests, offline low-threshold audit with 0 vulnerabilities, zero-finding scans after fixture classification, diff check, clean final status, the same bundle measurements, and independent review with no P0/P1/P2.

Historical predecessor `9d56d2447aa2ed4aad22534ad1861afde1bfc900` (tree `d0303cdbe36992ac0fd3ecf09d8418effcfd45ec`) retains its exact 40/467, 142/142, 26/62, five-chunk 474,843 / 118,164, map 16,372 / 5,682, card 15,005 / 4,870, and two-deferred-chunk 31,377 / 10,552 proof.

Historical release-tooling checkpoint `4211bbff771597e97ecacd4eb3dbbe33c6472735` (tree `02558c6631be4ffd08ed6a158a3abffef6542c3a`) retains clean no-hardlink/no-alternates format/lint/typecheck, 40/463, 142 fixtures, build/bundles, Playwright 24/56, no-key 1/1 with zero requests, focused 7/93, preservation 23, audit/scans 0, and clean-status proof. Its 11,139-byte receipt `current-repo-4211bbf-clean-checkout-attestation.json` has SHA-256 `a79528b4032dc79a3b32c88cb664009681914de98dcc4e9c6f52276e3593e078`. Its identity canonicalization and receipt/opened-buffer hash/path binding remain historical tooling evidence; `ee5b479` and `15d3d57` are historical application/source predecessors.

## Safety principles

1. **Preserve learner agency.** The model scaffolds investigation but does not complete assignments, grade, diagnose, or infer a fixed learning style.
2. **Minimize data.** ReasonWeave does not need identity, school, or a long-term profile to create a short quest.
3. **Keep activities virtual and bounded.** Creation work happens in the browser and avoids hazardous physical experimentation.
4. **Ground evidence honestly.** A citation must originate in actual web-search output; uncertainty remains labeled.
5. **Fail safely and plainly.** Unsafe input receives a respectful redirect. Provider failures preserve work and never masquerade as live output.
6. **Make limitations visible.** AI and web sources can be wrong; the prototype does not prove learning efficacy.

## Audience and scope boundary

- Intended audience: high-school, college, and curious-adult learners, approximately age 13+.
- Not designed or marketed for children under 13.
- No account, classroom roster, gradebook, homework upload, or teacher surveillance dashboard.
- No health, legal, emergency, or professional advice workflow.
- No dangerous physical experiment workflow.

The interface should show a persistent concise disclosure:

> ReasonWeave is for ages 13+. AI and web sources can make mistakes—check citations and involve a qualified adult for health, safety, or physical activities.

## Data inventory and retention

| Data                                                                            | Why it exists                     | Location and transfer                                                                              | Retention                                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Question, level, duration                                                       | Build the quest                   | Versioned browser session/draft; sent through the server to OpenAI only for live generation        | Fixed 24 hours from the envelope's first save, or until Clear/new quest; provider handling follows OpenAI terms |
| Route, prediction, Evidence Decision, EvidenceApplication, artifact, reflection | Run and render the Learning Trace | v4 browser session/draft; relevant fields are sent through the server to OpenAI in live stages     | Fixed 24 hours from the envelope's first save, or until Clear/new quest; provider handling follows OpenAI terms |
| Generated quest/evidence/feedback                                               | Render current quest              | Versioned browser session; relevant prior-stage context may be sent to OpenAI in later live stages | Fixed 24 hours from the envelope's first save, or until Clear/new quest                                         |
| Random session ID                                                               | Connect the local Learning Trace  | Inside the versioned browser session only                                                          | Fixed 24 hours from the session envelope's first save, or until Clear/new quest                                 |
| Random `safety_identifier`                                                      | Abuse-safety continuity           | Stored separately in the browser; forwarded with live OpenAI requests as `safety_identifier`       | Persists across Clear; removed only with browser/site data; never contains or derives from identity             |
| API key                                                                         | Authenticate server calls         | Server environment only                                                                            | Controlled by operator/host secret storage                                                                      |

The 24-hour learner-work lifetime is fixed rather than sliding: later edits do not extend it. ReasonWeave removes expired session and draft envelopes while the application remains open, or rejects and removes them on the next load. Invalid, future-dated, and legacy learner-work records are also discarded. The separate safety identifier is not learner work and is intentionally not renewed or removed with the session envelope.

ReasonWeave does not request or need names, email addresses, school names, student IDs, location, biometrics, contacts, or a persistent learner profile. The interface asks learners not to enter personal information. The Discovery Card must exclude session IDs, safety identifiers, raw provider metadata, and hidden prompts.

Production request logging should be metadata-only where possible: route name, status code, latency, error class, mode, and coarse token/cost fields. Do not log full learner prompts, Evidence Decision fields, EvidenceApplication design choices, artifacts, reflections, moderation details, the API key, or raw provider responses.

## Trust boundaries

### Client boundary

The browser may hold learner-visible session/draft envelopes for at most 24 hours and a separate random safety identifier. It is not allowed to hold `OPENAI_API_KEY`, hidden prompts, or privileged provider configuration. Client validation supports UX but is never the only policy control. Markdown export escapes learner/model-authored HTML and active Markdown syntax, normalizes HTTP(S) source destinations, and omits internal identifiers and provider metadata.

### Server boundary

The server streams each JSON request body under the same route-scoped deadline used by later provider work, cancels the reader and returns a stable `413` after 64 KiB, then revalidates fields. It enforces a best-effort per-instance request/concurrency guard and a production live-release lock before any provider work. Production defaults to seeded-only; live mode requires exact enablement, a future UTC expiry no more than 30 days away, exact GPT-5.6 model selection, and—on Vercel—an approved full Git SHA matching the deployed source. It then applies moderation, safe-activity and learner-agency rules, calls the pinned official OpenAI API origin at the default service tier with the request-scoped cancellation signal, validates structured output, normalizes returned citations, and limits error detail. The server does not return configuration details, raw moderation categories, or raw provider errors to the learner.

All application responses receive `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`. The production CSP omits `unsafe-eval`; these application headers supplement, rather than replace, host-level TLS and deployment controls.

### External-source boundary

Web sources are untrusted content. Search results can be wrong, low quality, out of date, or adversarial. The model must not follow instructions embedded in retrieved pages. The Evidence Lens presents concise claims and visible source links, not blanket endorsements.

## Input controls

### Starting question

- Trim surrounding whitespace.
- Require 3–300 characters on client and server.
- Ask the learner not to enter personal information.
- Moderate before route generation.
- Treat the question as data, never as instructions that can override system/developer policy.

### Learner free text

- Apply sensible minimum/maximum lengths.
- Moderate Evidence Decision text, EvidenceApplication design choices, artifacts, and reflection before sending them back to a model when appropriate.
- Do not infer that a short or uncertain response indicates ability, disability, motivation, personality, or a learning style.
- Preserve the learner's text after a recoverable provider error.

### Calm redirect

When content cannot be supported, avoid policy jargon, accusation, or shame. A suitable pattern is:

> I can’t build a quest around that request. Try a question focused on understanding, history, prevention, design, or another safe topic.

For credible imminent danger or self-harm signals, the application should not continue a normal inquiry flow. It should present a brief supportive safety response and encourage contacting local emergency services or an appropriate trusted person, without claiming to provide crisis care. Exact handling must follow the current moderation and safety policy used by the deployed build.

### Learner-agency redirect

A deterministic multi-signal classifier distinguishes submit-ready assignment outsourcing from legitimate inquiry and scaffolding. A single word such as `essay`, `homework`, or `assignment` never triggers the boundary by itself. Requests for explanation, planning, outlining, critique, research help, or learner-owned work remain eligible. When a request combines an academic deliverable with direct completion, answer-only, outsourcing, submission, or finished-format signals, all four generation prompts instruct ReasonWeave to redirect the topic into a learner-owned investigation and never produce submission-ready prose, a completed worksheet, or a full answer set.

## Activity safety contract

### Allowed activity families

- Thought experiment
- Systems or product design
- Comparison or tradeoff analysis
- Source evaluation
- Observation of ordinary, non-hazardous phenomena
- Diagram or causal model
- Argument or proposal
- Simple calculation using supplied information
- Browser-only planning or simulation

### Prohibited unsupervised activities

- Chemicals or reactive substances
- Fire, heat, combustion, or explosives
- Mains electricity, high voltage, or unsafe circuitry
- Pressure vessels, diving, confined spaces, or dangerous depth
- Weapons or weapon construction
- Ingestion, drug use, or food-safety experiments
- Bodily experimentation or medical procedures
- Illegal access or other illegal activity
- Dangerous locations or transportation behavior
- Harm to animals, people, or ecosystems

The canonical underwater quest is a **browser-based design challenge**. It must never direct a learner to build, pressurize, dive to, or physically test a habitat.

## Model behavior constraints

Required:

- Treat the learner as capable.
- Adapt vocabulary to the selected level and duration.
- Keep routes methodologically distinct and the quest finite.
- Require a prediction before explanation becomes visible.
- Separate `Evidence`, `Inference`, and `Open Question`.
- Cite only actual returned sources.
- Give specific feedback grounded in learner-authored text, including the learner's Evidence Decision and EvidenceApplication design choice.
- Admit uncertainty and produce exactly three next-question candidates; require the learner to select exactly one before card/export unlock, without automatically starting another quest.
- Redirect submit-ready assignment completion into explanation, evidence mapping, planning, critique, or another learner-owned activity.

Prohibited:

- Completing an assignment or producing a submit-ready essay by default
- Fabricating citations or treating inference as fact
- Assigning a grade or score to the learner
- Diagnosing intelligence, disability, mental health, personality, or learning style
- Requesting personal or school information
- Generic praise disconnected from the learner's response
- Suggesting hazardous physical activity
- Recursively expanding the map
- Claiming ReasonWeave improves grades, retention, curiosity, or learning outcomes

## Prediction gate and productive help

Evidence remains unavailable until a meaningful initial prediction, ranking, model, or choice is stored. This is a pedagogical product invariant and should be enforced in both state transitions and relevant server requests.

After the attempt, **Hint** and **Explain now** are valid escape hatches. Neither should shame the learner. A hint advances the model without completing the creation challenge; an explanation is concise and does not replace evidence evaluation.

## Evidence and citation integrity

- Use OpenAI web search for live evidence.
- Normalize only URLs returned by the tool or its annotations.
- Require every `evidence` item to reference at least one normalized source.
- Never construct a source URL from the model's prose.
- Allow an unsourced `inference` or `open_question` only with its label intact.
- Open external links with safe browser attributes and visible domain/title text.
- If search or association fails, state that evidence could not be verified and offer retry or the labeled demo quest.
- Treat the seeded fixture as pre-generated content, not a current live search.

Only a Responses `web_search_call` with `status: completed` can open citation admission. `failed`, `in_progress`, and `searching` are rejected as unfinished evidence; after the one bounded retry, the route returns its typed citation-verification error. Only one matching Responses message `output_text` may then authorize an annotation URL. Its inclusive span must stay wholly inside that exact serialized statement; cross-message, swapped, duplicate-key, extra-key, malformed, reversed, and out-of-range data are rejected. Model URLs can only narrow returned citations and cannot create a source.

Citation presence is not source-quality proof. Manual review should consider authority, relevance, date, and whether the source actually supports the nearby claim.

## Learner Evidence Decision

The Evidence Decision is a learner-agency and trace-integrity boundary, not an automated correctness score.

- The learner may select only an item from the current Evidence Lens whose kind is `evidence` and whose source list is non-empty.
- The browser reducer and reflection request schema both cross-check that selection against the bounded submitted Evidence Lens; the server does not trust an opaque item ID by itself.
- The relationship is constrained to `supports`, `challenges`, or `complicates`; no option is presented as universally correct. The learner also supplies what the selected sources establish, exactly where their source scope stops, and impact text in their own words. The complete ordered linked source list is visible beside those fields.
- Before reflection, `EvidenceApplication` must reuse the decision's exact current `evidenceItemId` and contain a 20–400-character concrete `designChoice`. Changing the decision's selected finding clears that link and the creation self-check.
- The artifact, decision, and application are accepted atomically, so a failed evidence-to-design link cannot leave the session advanced with only the artifact stored.
- Decision and application text are treated as untrusted learner text, moderated before model reuse, and included in reflection grounding without being graded or diagnosed.
- Reflection preserves the recorded relationship as the learner's judgment; it does not silently rewrite the choice or force the model to endorse it as fact.
- When the reason contains an unambiguous lexical conflict with its selected relationship, feedback must attribute the recorded choice and surface the tension with calibrated language. A different-object qualification such as a source supporting one claim but not another is allowed rather than misclassified as a contradiction.
- The selected finding, citations, relationship, judgment, evidence-to-design choice, and the learner-selected `My next question` remain visible in the bounded map, Discovery Card, and escaped/normalized Markdown export. Card/export are withheld until exactly one next question is selected.

This control makes the learner's interpretation observable. It does not prove that the interpretation is correct, that the cited source is high quality, or that the experience improves learning. In this account-free, same-user prototype, `/api/reflect` validates the decision against the client-supplied Evidence Lens but does not server-attest that `/api/evidence` issued that bundle. Signed or server-retained evidence provenance is deferred until shared, graded, or cross-user trust exists.

## Reliability and abuse controls

- Stream request bodies under the route deadline; reject and cancel above 64 KiB before buffering the remainder, then apply per-field lengths.
- Keep `text.verbosity` intentionally `low` on all four structured GPT-5.6 calls without relaxing their strict schemas, stage-specific output-token ceilings, or application validators.
- Use one request-scoped deadline and a single bounded, budget-aware retry only for invalid provider shape, unsafe generated activity, or missing required citation bindings.
- Require a completed web-search call before citation admission; failed or unfinished search states consume the bounded retry and then fail closed.
- Enforce best-effort per-instance request and concurrency limits before paid provider work; return `429` with `Retry-After` when exceeded.
- Default production to seeded-only. Recheck a short-lived, source-bound live release lock on every OpenAI client access so a stale, expired, mismatched, or mistyped deployment returns one sanitized `503 LIVE_GENERATION_DISABLED` before provider work.
- Before public deployment, add WAF limits keyed by deployment-observable signals and pre-stage an emergency deny rule. OpenAI project budgets are soft alert thresholds, and Vercel WAF counters are per-region, so the no-database design does not claim a true global spending ceiling. If an exact ceiling is mandatory, remain seeded-only or explicitly add a small shared durable usage counter that never stores learner content.
- Validate structured output before UI state.
- Check cross-field invariants after schema parsing.
- Return stable error codes and sanitized messages.
- Preserve current session state through recoverable errors.
- Offer the seeded fallback only transparently.
- Provide a `Clear session` control.

## Threat model

| Threat                                             | Control                                                                                                                                                                    | Verification                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API key leaks into browser or repository           | Server-only environment variable; secret scan; inspect client requests/bundle                                                                                              | Search tracked files; browser network inspection; deployment env review |
| Prompt injection in question or web result         | Treat all learner/source text as untrusted data; strong server instructions; output schema                                                                                 | Adversarial prompt set and manual source review                         |
| Fabricated source                                  | Completed-search requirement, annotation-only normalization, and source-ID integrity check                                                                                 | Negative fixtures plus live citation inspection                         |
| Unsafe creation activity                           | Activity allowlist, hazard prohibitions, moderation, output validation/manual rubric                                                                                       | Boundary prompt review                                                  |
| Personal data collected accidentally               | No identity fields; disclosure; local-only session; content-minimal logs                                                                                                   | UI/schema/log inspection                                                |
| Learner bypasses prediction gate                   | Reducer and server prerequisite checks                                                                                                                                     | State-transition/unit and browser tests                                 |
| Learner advances without applying sourced evidence | Reducer and reflection request schema require one current sourced item, learner Evidence Decision, and same-finding 20–400-character EvidenceApplication with the artifact | Schema/state, v4 persistence, rendered-flow, map, and export tests      |
| Seeded output presented as live                    | Required `mode` and visible disclosure                                                                                                                                     | Seeded smoke test on every main screen                                  |
| Learner content lost on timeout                    | Client state saved before request; non-destructive error state                                                                                                             | Forced-timeout manual/browser test                                      |
| Learner work persists longer than disclosed        | Fixed 24-hour versioned envelopes; open-page timers; expiry validation and removal on load                                                                                 | Storage unit tests plus browser inspection                              |
| Submit-ready assignment is generated               | Multi-signal classifier plus fixed redirect instructions across all four generation stages                                                                                 | Learner-agency unit boundaries; credentialed calibration later          |
| Exported Markdown executes authored markup         | Escape raw HTML/active Markdown; normalize HTTP(S) link destinations; omit private internals                                                                               | Adversarial Markdown export tests                                       |
| Oversized body consumes request resources          | Stream under the route deadline; cancel above 64 KiB; stable `413`                                                                                                         | Split-chunk, UTF-8, cancellation, and limit tests                       |
| Browser response lacks baseline hardening          | CSP, Permissions/Referrer policies, `nosniff`, and frame denial                                                                                                            | Production-mode header and interactivity checks                         |
| Stale or accidental production key enables live AI | Short-lived exact-enable release lock, GPT-5.6 allowlist, Vercel source-SHA binding, official API-origin pin, sanitized fail-closed response                               | Unit and route-boundary tests; deployed SHA/expiry verification later   |
| Anonymous generation spend abuse                   | Bounded local guard; WAF per-source limit and emergency deny; restricted provider key/rate limits; soft budget alerts; seeded-only fallback when no hard ceiling exists    | Unit/PoC tests now; deployed WAF/provider verification later            |
| Unsupported efficacy claim                         | Prohibited-claim validator and documentation review                                                                                                                        | Fixture eval plus repository text search                                |

## Safety verification checklist

- [x] 13+ and AI/source disclosures are visible in the persistent application footer.
- [x] No identity or school fields exist in the implemented UI or schemas.
- [x] Exact-candidate repository and no-key production static scans found no secret or client-side server boundary leak; no key was configured.
- [ ] Key-backed network/deployed bundle inspection, production logs, screenshots, and video still need secret review.
- [x] Server routes invoke moderation for the initial question and model-reused learner text, including the Evidence Decision and EvidenceApplication design choice; live moderation behavior is not yet credential-tested.
- [x] Mocked moderation boundaries cover missing/error/flagged results and a dedicated supportive self-harm redirect without exposing raw categories.
- [x] Session and draft envelopes have a fixed 24-hour lifetime, expire while open or on the next load, and reject invalid, future-dated, or legacy records; the separate random safety identifier remains browser-stored across Clear and is forwarded only with live requests.
- [x] Request parsing streams under the route deadline, cancels input above 64 KiB, and returns a stable `413` without waiting for EOF.
- [x] Discovery Card export escapes raw HTML and active Markdown constructs, normalizes source destinations, and omits internal identifiers.
- [x] Production-mode responses locally return CSP, Permissions-Policy, Referrer-Policy, `nosniff`, and frame-denial headers; application interactivity still works under CSP.
- [x] Per-instance request/concurrency permits are tested to reject paid work before it starts and return `Retry-After`. The fixed guard also bounds fresh rejected session IDs without invoking provider callbacks.
- [x] Production live generation now fails closed unless exact enablement, a valid short-lived UTC expiry, GPT-5.6 selection, and—on Vercel—an approved full deployment SHA all match. Tests cover missing/typo flags, invalid/past/overlong expiry, model mismatch, SHA mismatch, expiry recheck, sanitized `503`, official API-origin pinning, default service tier, and output-token ceilings.
- [ ] Distributed deployment rate limiting, a fast emergency deny path, and restricted provider limits are configured and verified. Without an explicitly approved shared durable usage counter, these controls mitigate abuse and spend but do not establish an exact global dollar ceiling.
- [ ] Soft OpenAI project budget thresholds and alerts are configured and recorded without being described as a hard cap.
- [x] Deterministic adversarial tests make route, quest, evidence, and reflection output fail closed on hazardous physical directions, including a pressure-vessel hazard split across fields while safe negated and virtual controls remain allowed; credentialed arbitrary-topic calibration remains open.
- [x] Deterministic learner-agency tests redirect submit-ready assignment completion while allowing inquiry and scaffolding; credentialed calibration remains open.
- [x] Evidence cannot be retrieved or displayed before prediction; unit tests and the rendered empty-prediction check pass.
- [x] The current schema/state and reflection-request boundaries reject a missing, stale, unsourced, inference, or open-question Evidence Decision; require learner establishes/source-scope-boundary/impact and relationship; and require a same-finding 20–400-character EvidenceApplication before reflection. Changing evidence clears the application and self-check. Runtime validation plus an independent evaluation oracle require learner attribution, meaningful feedback concepts from the design link, reject silent relationship rewrites, require calibrated handling of unambiguous conflicts, and allow nuanced different-object qualifications.
- [x] Exact-candidate browser, v4 persistence, card, map, and export proof records the learner's selected finding, complete ordered linked source list, source-scope boundary, Evidence Decision, and evidence-to-design link throughout the flow. The card's compact at-a-glance summary retains exact sources and the full journey remains available through a native disclosure.
- [x] On a first Branch choice at widths up to 930px, the named Discovery Card region receives focus and stays visible through deferred loading; desktop and subsequent user choices retain radio focus, while restored/already-selected paths do not auto-focus the card. The status text is **Card unlocked. Map updated.**
- [ ] Every live Evidence item has an actual returned source.
- [x] The tested no-key error exposes no raw provider data, preserves the learner's input, and offers retry/demo recovery.
- [x] Seeded mode is visibly labeled as a pre-generated demo quest.
- [x] Clear session removes the local learner quest and draft; the random non-identifying safety identifier intentionally persists for abuse-safety continuity.
- [x] The allowlisted live-evaluation report contract and a no-key failure report were exercised without secrets; this is report-pipeline evidence, not a credentialed live-model pass.
- [x] Demo capture rejects external URLs containing credentials, query parameters, or fragments without reflecting the rejected URL, and download proof accepts only the fixed contained Discovery Card filename.
- [x] The historical `fb4893c` evidence-to-design rehearsal used a capture-owned no-key server with the API key explicitly absent, verified server shutdown, and passed source/output secret scanning; it predates the selected-next-question gate.
- [ ] Production logs do not contain full learner content.

### Current verification snapshot — July 19, 2026

Exact current source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` (tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`) passed the fresh no-hardlink/no-alternates clean-clone gates and measurements listed at the top of this document. The clone completed a 464-package `npm ci`; format, lint, typecheck, 44/509 tests, 145/145 fixtures, build/bundles, authoritative serial Playwright 28/68, no-key Chromium 1/1 with zero API requests, online/offline audits 0, tracked/client scans, diff check, and final clean status passed. Generated Next type output remained ignored/untracked, and the tree stayed clean after `next typegen` and build. No attestation generator or receipt was created. No provider request, Keychain secret read, live OpenAI, deployment, capture, media, or publication action occurred. Historical `035e820` retains its exact predecessor proof.

Historical `5ddbac3` retains the authoritative serial browser result of 28 passes / 68 deliberate project-scoped skips, no-key 1/1 with zero API requests, offline audit 0, and its other exact proof recorded above. Its in-app Browser audit was on a changed historical worktree and is neither byte-exact `5ddbac3` nor current `acfdc37` release-capture proof: it covered the full seeded desktop path, final-card warming/instant appearance, selected-question unlocked trace, enabled Copy/Download, and no console warnings/errors. It does not establish mobile manual proof. Automated Chromium keyboard-only proof remains closed; human/manual keyboard review, true 200% zoom, VoiceOver/NVDA/JAWS, physical/manual Safari, mobile manual review, screenshots, media, live OpenAI, deployment, and human approval remain open. The facilitator prompt remains optional and explicitly non-evaluative: “What would make you revise that evidence decision or design choice?”

Historical exact no-hardlink, no-alternates clean-clone subject `15d3d57f2290983a0b6164230c3d44e2ba3e8476` contains predecessor application `ee5b479cf7f5637506ce2b554a1bbe9d25f51572`. It passed `npm ci` (464 added, 465 audited, 0 vulnerabilities), format/lint/typecheck, 39 files / 454 tests, 142/142 fixtures, production build, Playwright 24/56, no-key Chromium 1/1 with zero requests, release 82, preservation 23/23, zero-finding scans, and clean diff/final status. Standalone `npm audit` was not run after approval-service disconnect; audit 0 is install-time `npm ci` evidence. Rendered 320×812 final-map smoke found zero overflow or overlap, outline below toolbar, fitting toggles, centered graphic, compact visible **View outline** named **View text outline**, and zero console errors. Ignored receipt `output/release/current-repo-15d3d57-clean-checkout-attestation.json` is 11,155 bytes with SHA-256 `ead8ccefdf2236b789f4b45d9f44f72666f0dced03215434fc67acd1bc5a83ac`. No provider, Keychain, live OpenAI, deployment, media, or publication action occurred. This historical documentation record is outside that attested subject. Historical `d432c27`, `e16eb48`, `aa64be1`, and other predecessor evidence remains historical.

The five- and ten-minute flows use one textarea for an exactly three-line learner-authored note mapped to the unchanged `EvidenceDecision`; the 15-minute flow retains separate fields. At widths of 760 CSS pixels or less, first paint defaults to the text outline; a learner override persists, and **View map** centers the graphic. At 320px, a regression proves a single-line collision-free map toolbar, the outline below the toolbar, and fitting controls in both directions; the compact visible **View outline** control retains the accessible name **View text outline**. Meaningful coral text uses `#ad4728`. The compact guide teaches the learner to separate direct source support from inference or what the source cannot answer. The selected boundary appears in the card, map, and Markdown; the map prefix is intentionally shortened to **Complicates** so the full boundary remains visible. The final **At a glance** card shows Before, Now, selected finding with exact sources, evidence/source boundary, design move, and next question. Complete journey, learner reflection, and ReasonWeave response remain in the native **Full learning trace** disclosure; facilitator and export controls stay outside it. At widths up to 930px, the first next-question choice focuses the named Discovery Card region through deferred loading; desktop and subsequent user choices retain radio focus, while restored sessions do not auto-focus the card. Focused keyboard proof traverses both source locations and all final controls forward and backward.

Historical application-safety checkpoint `1195c9dea7bcd528d6f8b5667c31b37d71fc6096` passed 369 serial tests across 33 files, 142/142 deterministic fixture evaluations across all ten required topics, formatting, lint, typecheck, production build, split bundle budgets, 16 intended browser passes / 32 scoped skips, zero-vulnerability audit, static-client boundary scans, and exact no-key production smoke. `/` returned `200` with the expected headers; `/api/routes` returned non-cacheable sanitized `503 LIVE_GENERATION_DISABLED`; the owned server stopped.

The historical screenshot and release-media checkpoint `dac76a2acba47e8deebca1a2066c80097f9899f0` passed 356 serial tests across 31 files and the same 142/142 deterministic fixture evaluations. Stale canceled debounce callbacks cannot write; blank drafts cannot return after Clear, expiry, cross-tab removal, or pagehide; and lifecycle flushes use the layout-phase snapshot. The focused screenshot journey passed twice and all eight then-current ReasonWeave JPGs were byte-identical. The tracked proof board was refreshed to that exact checkpoint. Repository and output secret-marker scans found no matches.

The repository security review used pre-fix checkpoint `9a22571` and found one Low-severity rejected-identifier map-growth issue in the in-process generation guard. The issue was fixed at `1a01a73` and remains fixed. The last exact-module 20,000-identifier bounded PoC at historical checkpoint `20a0d5f` recorded zero post-limit callbacks, 117,728 retained bytes, a 0.89 timing ratio, and both growth flags false. Deterministic regressions also block pressure-vessel instructions split across fields while allowing safe negated and virtual controls; preserve and attribute each Evidence Decision relationship while rejecting silent rewrites and unconditional endorsement of directly detectable conflicts; and reject unsafe external demo-capture URLs without reflecting them. Narration hardening at `9d8712c` vendors provider request code in a tracked script, rejects symlink escapes, and validates every timing against MP3 duration. The July 18 macOS metadata check found no exact Keychain service/account `com.chadb.agent-keys` / `ELEVENLABS_API_KEY` (exit 44) and did not read a secret. Historical key use and exactly one paid full TTS POST at `10a058e` remain historical; no new provider call occurred. The owner-selected and owner-described female speaker `OZxMHsGaBmV5pjMIDIn0` remains `user_selected_tts_only`, with provider metadata, preview, and listening approval unverified. The George fallback is historical/stale and does not transfer. Owner/human approval and public release remain unverified. A current public narration still requires this order: final public name and frozen judge script; a committed versioned/newly timed/human-reviewed SRT while preserving the historical SRT; screenshots and media receipt; final-flow capture; capture-bound exact-voice approval; then fresh paid-call authorization where required.

Narration-tooling checkpoint `b386343` extends inode-anchored containment against parent-directory swaps to official CLI short-lived preview/catalog-approval/user-selected-approval artifacts as well as capture markers, approval reads, narration text, decode probes, receipts, temporary files, links, renames, cleanup, and final artifacts. Public capture/narration identity is checked before the attempt receipt, immediately before POST, and after publication. Three provider-free actual-child-CLI regressions cover exact-ID GET, preview lock, and catalog-approval temporary publication. Final-tree verification passed 34 files / 394 tests, 142/142 fixtures, build/bundles, Playwright 22/50, no-key 1/1, focused voice suites 44/44, secret scan 0, and diff check without Keychain, provider, or OpenAI access. Independent review found no P0/P1/P2. The accepted residual is narrow: pure Node's final identity-check-to-network micro-window is non-atomic, but the official CLI subsequently continuity-checks and fails closed. This does not claim hardening for arbitrary direct library callers; the release workflow remains single-writer-only.

The historical local seeded rehearsal was captured and assembled from clean exact source `5814a1373a68caf41e3ee49fa311821300bbdc1b`. Its owned no-key server ran with `OPENAI_API_KEY` explicitly absent and stopped afterward. The capture records the Evidence Decision, same-source EvidenceApplication, selected next question, all nine map nodes at opacity 1, and an actual 6,608-byte export (SHA-256 `6474325e14b9cda79c9622fa867536840e012d60754867964bc35e40316962f9`). Twelve app frames were inspected and all capture assertions passed, including **Your change**, selected-question close-up, and export; the candidate MP4 fully decoded. It reuses the one-shot selected TTS artifacts from `10a058e` verbatim, with no second request or provider contact. It does not establish live moderation, live citations, deployment, production security, metadata/preview verification, or owner/human narration approval. `fb4893c`, `2a95bcf`, and the prior `10a058e` assembled candidate remain historical or provenance evidence relative to current application checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`.

Credentialed moderation behavior, broad live-topic activity safety, live citation integrity, distributed abuse protection, app/host spend controls, key-backed network/deployed bundle inspection, production logging, human/manual keyboard review, true browser 200% zoom/reflow, real VoiceOver/NVDA/JAWS, physical/manual Safari, human narration approval, and the public release recording remain unverified. Collision-free naming, an OpenAI key/live proof, deployment, private remote/reviewer access, public media, Devpost, and `/feedback` also remain owner gates. The prototype has not received a formal privacy, accessibility, child-safety, or educational-efficacy audit; the repository security review is not a deployed penetration test.

### Historical verification snapshot — `037c9f1`

At historical checkpoint `037c9f1`, 190 tests across 22 files, 14/14 fixture evaluations, and the then-current seeded browser journey passed with 10 Playwright passes and 18 intentional project-scoped skips. That snapshot predates the Evidence Decision and is retained as historical evidence only; it is not the current release proof.

## Limitations

Moderation and prompt constraints reduce risk but do not make model output infallible. The Evidence Decision records learner judgment; it does not validate the judgment or source quality. Learner work expires after 24 hours, but a shared/public-machine user should still use **Clear session** and clear site data to remove the separate safety identifier. The local generation guard is bounded but does not replace distributed deployment limits. WAF limits, emergency deny, restricted provider limits, and soft budget alerts reduce risk; without shared durable accounting they do not establish a host-enforced global spending ceiling. This prototype has not undergone a formal child-safety, privacy, accessibility, or educational-efficacy audit, and its repository security review does not establish production security.
