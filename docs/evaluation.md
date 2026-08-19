# Evaluation strategy

ReasonWeave evaluates whether the product behaves according to its contract and makes the learner's reasoning visible. It does **not** use model-output checks, user completion, or a small demo to claim improved learning, grades, retention, or curiosity.

> **Credentialed local integration checkpoint — July 20, 2026:** exact code commit `8c2dda942332259d1a82ea94cbed1457d0e27dd1` (tree `d27c4e18feae6cf5974546ea9b4c3114b943ec3c`) passed format, lint, typecheck, 46 Vitest files / 634 tests, 145/145 deterministic fixture checks, and the Next.js production build. A cost-limited local run used the test-only `gpt-5.6-terra` override for the canonical underwater topic plus dreams and passed 2/2 fixtures and 126/126 checks. Reviewable ignored report: `output/evals/live-eval-2026-07-20T15-14-17-646Z.json`. The two Evidence Lenses contained 186 and 211 rendered words, three items and two resolved sources each, and zero unresolved source IDs. Every displayed sourced claim was manually checked against the returned NOAA, CDC, PubMed, or NINDS page. The key stayed in ignored `.env.local`; neither the runner nor report read, printed, or retained it. This is narrow credentialed local behavior proof, not deployed GPT-5.6 Sol proof, broad ten-topic live validation, source-truth automation, or educational-efficacy evidence. Production defaults and release predicates remain pinned to `gpt-5.6`.

The same checkpoint preserves annotation-bound citation admission and adds a fail-closed Responses compatibility path for structured web-search output that contains no URL annotations. The fallback is available only when there is exactly one matching output-text block, every web search completed, the model-declared URLs exactly match provider-returned `web_search_call.action.sources`, and serialized item ranges resolve. Any annotation ambiguity, invented URL, mixed search status, duplicate/invalid declaration, or unresolved Evidence item still fails closed. User-facing quest, evidence, and reflection prose now rejects clipped or unfinished model output through the bounded retry; rendered Evidence is capped at 450 visible words; sourced facts are separated from uncited inference; and reflection validation requires the learner's recorded relationship, source boundary, impact, design link, artifact, and reflection without grading or diagnosis.

Historical predecessor `0bd5aef` also has fresh no-hardlink/no-alternates clone proof (exact HEAD/tree, unique pack inode/link count 1, and `npm ci` adding 464 packages); keyboard stress 5/5 remains direct-worktree proof.

> **Historical predecessor — July 19, 2026:** direct clean committed-worktree proof for exact `0bd5aef89ab4715477491b462c13be0c5978ac6b` (tree `4d6162e7a7632bba96f582818f44d98bbff956a0`) passed format/lint/typecheck, 46/596 Vitest, 145/145 fixtures, production build, bundle 464,236/113,930 initial (map 16,356/5,592; card 15,598/5,051; UI 31,954/10,643; seeded 21,224/6,904), 28/68 Playwright, no-key 1/1 zero API, keyboard stress 5/5, online/offline audit 0, expected-only scans, diff and clean status. The strengthened strict release verifier accepts no self-attested live success: it binds target origin, validates fixture/check structure and anchor capture, recomputes voice approval digest, compares decoded embedded subtitles to receipt-bound SRT, and enforces freshness/causal ordering and GitHub reviewer remote binding. Default preflight: 13 PASS / 0 FAIL / 7 PENDING; strict release intentionally 0/9 with no external evidence. Earlier `acfdc37` current wording is historical predecessor evidence.

**Historical predecessor proof:** exact checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` (tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`) passed direct-worktree and fresh no-hardlink/no-alternates-clone format/lint/typecheck, normal serial Vitest at 44 files / 509 tests, 145/145 fixtures, production build and bundle budgets, authoritative serial Playwright at 28 passes / 68 deliberate project-scoped skips, no-key Chromium 1/1 with zero API requests, online and offline audit 0, scans, diff check, and final clean status. Initial JavaScript measured 458,996 raw / 112,371 gzip across six chunks; Curiosity Map was 16,372 / 5,682; Discovery Card 15,163 / 4,918; two UI chunks total 31,535 / 10,600; and the seeded-demo chunk was 21,186 / 6,890. Desktop and 390 × 844 implementation-worktree QA passed the compact evidence judgment and final Discovery Card with no horizontal overflow; temporary frames are not release proof or manual accessibility evidence. Independent final education and release reviews found no P0–P3. No provider/Keychain secret read, OpenAI, media, deployment, publication, or submission action occurred. `035e820`, `9f7e53f`, `5ddbac3`, `9d56d24`, `013f77a`, `4211bbf`, `ee5b479`, and `15d3d57` retain historical predecessor proof and receipts.

Historical predecessor `9f7e53fd0ebcc40b60f61fab6b1ab3aa52fd31e3` (tree `1e52dcc8f53c7cf9f4f5e3b2ae886297973b21dd`) remains historical proof: 40/470, 142/142, 28/68, no-key 1/1, 453,691 / 110,997 across six chunks, map 16,372 / 5,682, card 15,005 / 4,870, two UI chunks 31,377 / 10,552, and the separate seeded-demo chunk 22,213 / 7,516.

Historical predecessor `5ddbac355e1ab90fa7e3a8533ca2cbf995c5ab57` (tree `b9632e2924dccfd13d26accb9aa029c2bfd86d3e`) remains unchanged historical proof: 40/467, 142/142, 28/68, no-key 1/1, 453,691 / 110,997 across six chunks, map 16,372 / 5,682, card 15,005 / 4,870, two UI chunks 31,377 / 10,552, and the separate seeded-demo chunk 22,213 / 7,516.

Historical predecessor `9d56d2447aa2ed4aad22534ad1861afde1bfc900` (tree `d0303cdbe36992ac0fd3ecf09d8418effcfd45ec`) remains unchanged historical proof: 40/467, 142/142, 26/62, 474,843 / 118,164 across five chunks, map 16,372 / 5,682, card 15,005 / 4,870, and two deferred chunks 31,377 / 10,552.

## Evaluation layers

| Layer                 | Network/key        | What it establishes                                                                                   | What it does not establish                         |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Unit and schema tests | No                 | Parsing, state guards, Evidence Decision/Application integrity, layout/export logic, local invariants | Live provider behavior or visual quality           |
| Fixture evaluations   | No                 | Seeded session integrity and validator ability to catch known failures                                | Arbitrary-topic generation quality                 |
| Browser smoke test    | No for seeded path | A user can complete the actual rendered flow                                                          | Broad accessibility or browser coverage            |
| Live evaluations      | Yes                | Current local/deployed API outputs satisfy structural/product checks across topics                    | Learning efficacy or perfect future model behavior |
| Manual rubric         | Sometimes          | Educational usefulness, evidence clarity, agency, safety, and visual coherence                        | Statistical efficacy                               |

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:e2e:no-key
npm run evals:fixtures
npm run format:check
npm run build
```

`npm run typecheck` generates Next route types before TypeScript validation. The generated `next-env.d.ts` remains ignored and must not dirty the tracked tree after build.

## Verified release-candidate record

On July 19, 2026, exact current checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` (tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`) passed the direct-worktree and fresh no-hardlink/no-alternates-clone gates: 44 test files / 509 tests, 145/145 fixtures, serial Playwright 28/68, no-key 1/1 with zero requests, online/offline audits 0, scans/diff/final-clean, and independent final education and release review with no P0–P3. Typecheck ran `next typegen` before `tsc --noEmit`, route types generated successfully, and ignored `next-env.d.ts` remained absent from the tracked post-build diff. Request-contract coverage proves all four structured GPT-5.6 calls use `text.verbosity: "low"` without changing strict schemas, `max_output_tokens`, or validators. The Evidence call accepts only a completed `web_search_call`; `failed`, `in_progress`, and `searching` statuses yield `CITATIONS_UNAVAILABLE` and fail closed after the bounded retry. Duration-specific workloads are schema-enforced for 5-, 10-, and 15-minute quests, and the storage-only compatibility marker preserves over-limit legacy work without weakening new generation. Initial JavaScript measured 458,996 raw / 112,371 gzip across six chunks; map 16,372 / 5,682; card 15,163 / 4,918; two UI chunks 31,535 / 10,600; and the separate seeded-demo chunk 21,186 / 6,890. Seeded fixture/helpers load only after explicit demo activation and late resolution cannot overwrite Clear/live state. The Discovery Card warms on entering/restoring Reflect with a Branch fallback retry, and its revision-aware Reflect cue is non-persisted. Seeded feedback labels and grounds the learner's evidence judgment, selected evidence, unresolved boundary, evidence-to-design link, actual creation, and still-wonder within 800 characters. Desktop and 390 × 844 implementation-worktree QA passed with no horizontal overflow, but temporary frames are not release proof. No attestation generator/receipt, OpenAI/provider/media/deployment/publication action, or Keychain secret read occurred. Historical `035e820`, `9f7e53f`, `5ddbac3`, `9d56d24`, `013f77a`, and `15d3d57` proof do not attest the current tree. Screenshot, media, live API, deployment, provider, and manual-browser gates remain open.

The current source-scope contract shows the selected finding's complete ordered linked source list beside the decision fields. Field 04 asks **Where does this source scope stop?** and explains, “Separate what this source directly supports from your inference or a question it cannot answer.” The selected boundary persists into the card, map, and Markdown export. On Branch, **At a glance** shows Before, Now, the selected finding and exact sources, the source boundary, the design move, and **My next question**. The complete journey, learner reflection, and ReasonWeave response remain available in the native **Full learning trace** disclosure; the facilitator prompt and export actions remain immediately visible. Seeded fixture/helpers activate only when the learner explicitly starts the demo; a late chunk is revision-gated so it cannot overwrite Clear or live state. The card warms on entering or restoring Reflect, retries from Branch if needed, and uses a revision-aware non-persisted Reflect cue.

The following automated results were reproduced directly and in a fresh no-hardlink/no-alternates clone at exact checkpoint `9d56d2447aa2ed4aad22534ad1861afde1bfc900` on July 18, 2026 Pacific Time. No attestation generator or receipt was created. The technical proof board and local narrated capture/assembly candidate `5814a13` use older app evidence; the capture reuses immutable provider artifacts from `10a058e`:

| Check                       | Result      | Evidence                                                                                               |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Deterministic gates         | Passed      | Format, lint, typecheck, 40 test files / 467 tests, and 142/142 fixture evaluations passed             |
| `npm run format:check`      | Passed      | Repository files matched the configured Prettier style                                                 |
| Production build            | Passed      | Next.js production build and configured bundle budgets passed                                          |
| Full Playwright matrix      | Passed      | 26 intended passes; 62 deliberate project-scoped skips                                                 |
| Dedicated no-key Chromium   | Passed      | 1 intended pass with zero API requests                                                                 |
| Clean clone/install/audit   | Passed      | 464-package `npm ci`; offline audit 0; network audit not run; final status clean; no receipt generated |
| Changed-file/boundary scans | Passed      | 0 credential-like strings; 0 `.next/static` boundary findings                                          |
| `git diff --check`          | Passed      | Current source diff contained no whitespace errors                                                     |
| Screenshot/media refresh    | Pending     | `aa64be1` / `387ddeb` and `5814a13` remain historical pending the public-name decision                 |
| `npm run evals:live`        | **Not run** | No `OPENAI_API_KEY` was configured                                                                     |
| Deployment/manual live gate | **Not run** | No public deployment or credentialed canonical run exists                                              |

The historical exact clean application-safety checkpoint `1195c9dea7bcd528d6f8b5667c31b37d71fc6096` passed format, lint, typecheck, 33 test files / 369 tests, 142/142 fixture checks, production build, split feature-bundle budgets, 16 intended Playwright passes / 32 deliberate scoped skips, zero-vulnerability audit, and static-client secret/server-boundary scans. Exact production smoke returned `200` plus the expected headers for `/` and non-cacheable sanitized `503 LIVE_GENERATION_DISABLED` for a synthetic no-key `/api/routes` request. This checkpoint does not replace the exact `dac76a2` screenshot/proof-board evidence or `5814a13` media evidence, and it is not a credentialed live-model or deployed-app claim.

The Playwright flow starts a non-reused server with seeded mode forced. Its complete Spark-to-Branch journeys cover Chromium, Firefox, WebKit, and mobile Chromium. Focused checks exercise route-specific evidence, recovery from cancellation/timeout/empty responses, topic-neutral visuals, narrow forced-colors behavior, the Evidence Decision's sourced-item restriction, complete ordered source list, source-scope field, same-finding 20–400-character EvidenceApplication, required exactly-one next-question selection after reflection, v4 persistence, and card/map/export rendering. Card and export stay unavailable until the learner chooses one question; final artifacts label it `My next question`, and no next quest begins automatically. The current authoritative serial matrix covers the complete keyboard-only traversal from Spark through Branch, audits each intermediate focus stop, and verifies discernible focus through the compact summary, sources, full-trace disclosure, and export controls. Historical checkpoint `a08b1ee` retains the separate 5/5 consecutive stress result. Automated axe checks cover the tested stages and focused screens. These checks close the automated Chromium keyboard-only proof, not human/manual keyboard review, true browser 200% zoom/reflow, verification with VoiceOver, NVDA, or JAWS, or physical/manual Safari review.

The pre-fix security review at `9a22571` found one Low-severity generation-guard issue: new rejected identifiers could grow the in-memory session map. The fix landed in `1a01a73` and remains present. The last exact-module 20,000-identifier PoC at `20a0d5f` invoked zero callbacks after the limit, retained 117,728 bytes, produced a flat 0.89 timing ratio, and reported `persistentGrowth: false` / `scanGrowth: false` (`NOT CONFIRMED`). The current checkpoint retains the `7497901` persistence protections against stale canceled debounce writes and blank-draft resurrection after Clear, expiry, cross-tab changes, or pagehide. It also covers cross-field safety scanning, localized calibration of direct, negated, and opposing relationship language through separate runtime and evaluation implementations, hardened external capture URLs and suggested filenames, and the selected-next-question gate.

Earlier checkpoints `3610690`, `c9b53f7`, `e59e2d2`, `037c9f1`, `20a0d5f`, `5e1d348`, `0e0547e`, `0662d8d`, `05ec5b1`, `ae3df74`, `7497901`, `1195c9d`, `2747950`, `dac76a2`, `aa64be1`, `e16eb48`, `269a3f820746c9253a2d1aa897755714ad56d277`, and `a08b1ee50451c8b5df41da1bea4ad2d79cd49a69` retain historical proof. `aa64be1` and receipt `387ddeb` remain the historical screenshot source. `5814a13` is a completed clean capture/assembly checkpoint (31 files / 359 tests) using the older `dac76a2` proof board, and `10a058e` remains immutable provider-artifact provenance. The completed reviewer release source is older clean commit `1023992fd3f61cd5c8ea40815fa2d28fdfb6522e`; `52aa3d8` is previous and superseded.

Pre-ledger sanitized history-free package `reasonweave-reviewer-3456135.tar.gz` is bound to exact clean source `3456135fd7f3df6bcbf8e7addd93beaef8b4ecee`: 174 tar entries / 152 tracked files, 3,373,738 bytes, SHA-256 `2b599db065fc5ff626affff1947ce61607e402e1ecf1cc9bda8d00217eb77dfe`. File parity, isolated install, zero-vulnerability live audit, format/lint/typecheck, 33 files / 369 tests, 142/142 fixtures, production build, split bundle budgets, archive/static-client scans, 16 browser passes / 32 scoped skips, and exact fail-closed production smoke passed. Its internal ledger predates this proof, so it is packaging evidence rather than the reviewer-facing artifact; do not share it.

Reviewer package `reasonweave-reviewer-1023992.tar.gz` is a completed release artifact from older source, not current `acfdc37` app. Its isolated extraction installed 464 packages with `npm ci`, `npm audit` found 0 vulnerabilities, format/lint/typecheck passed, tests passed 33 files / 386 tests, fixtures passed 142/142, production build and bundle budgets passed, scans found 0, the browser matrix recorded 16 passes and 32 deliberate scoped skips, the no-key test passed once, production `/` returned `200`, valid `/api/routes` returned non-cacheable `503`, the server stopped, and provider calls remained 0. Previous `reasonweave-reviewer-52aa3d8.tar.gz` is historical packaging evidence only; do not share it as the release source. Human/manual keyboard review, true browser 200% zoom/reflow, VoiceOver/NVDA/JAWS verification, physical/manual Safari review, canonical live source inspection, key-backed network/deployed-bundle inspection, public/live/human approval, reviewer hosting/access, and production logging remain unverified external owner gates.

## Historical local media rehearsal

The evidence-to-design seeded rehearsal at `fb4893c` remains historical proof that predates `0662d8d`'s selected-next-question upgrade; `574abe1` also predates the ReasonWeave rebrand, and `2a95bcf` predates EvidenceApplication. The local media capture and assembly from clean `5814a1373a68caf41e3ee49fa311821300bbdc1b` under ignored `output/playwright/reasonweave-demo-5814a13/` is also completed historical evidence relative to current app checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`; its provider artifacts are reused verbatim from `reasonweave-demo-10a058e`. It is local evidence, not a repository or public-video deliverable.

| Check                       | Verified result                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Final local file            | 174.000 seconds / 2:54; 1280 × 720; H.264 video, AAC audio, embedded `mov_text`; 13,950,748 bytes                                              |
| Video integrity             | Full decode passed; output hash matched SHA-256 `746ca60a4a03c1c5ca6e8d6d53c320089e0dd80fbe229e16dfbfc971888406a0`                             |
| Product capture             | All 10 milestone windows passed; 10 application frames; Evidence Decision and EvidenceApplication recorded; 9 fully visible map nodes          |
| Markdown export             | Actual clipboard path verified; 6,499 bytes; SHA-256 `d27ad977f8d2db75e88c660994c865e72a1cf92430602f74b827a6989d3435c6`                        |
| Caption contract            | 39 cues, burned in and embedded; 42-character maximum line; 150 WPM maximum pacing                                                             |
| Audio contract              | Samantha local rehearsal voice; -15.7 LUFS integrated; -2.7 dBFS true peak                                                                     |
| Visual review               | Whole-timeline contact sheet, evidence/create/reflection/discovery/map/card milestones, and the critical proof segment were visually inspected |
| Credential/server boundary  | No API key passed to the owned no-key server; server stopped before publication                                                                |
| Source/artifact cleanliness | Capture and assembly source states were clean; output secret-marker scan found no matches                                                      |

The completed historical local candidate passed all capture assertions, 12-frame review, nine-node opacity proof, export/hash checks, and assembly full decode. The 174.000-second MP4 is 15,527,159 bytes (SHA-256 `57d517746709d986bf38cfc87a9d2072b114da12cbdc2b951e8d8300a5c01312`) with -16.9 LUFS integrated and -2 dBFS true peak. It reuses the one-shot selected TTS artifacts from `10a058e`; no second paid call or other provider contact occurred. The owner selected voice `OZxMHsGaBmV5pjMIDIn0` and describes it as a female speaker, but provider catalog name, gender, category, metadata, preview, and full human listening approval remain unverified. The historical SRT remains immutable. After the final public name and judge script are frozen, create/commit a new versioned, newly timed, human-reviewed SRT before screenshots and media rendering; capture the final flow afterward and bind exact-voice approval to that capture before any paid request. The candidate predates current app checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`. A public YouTube video, live GPT-5.6/web-search behavior, deployment, and signed-out public-link checks remain unverified.

Run live evaluation only after a server is running with a securely configured key. Use two terminals and begin with the recommended two-topic limit:

Terminal A:

```bash
npm run dev
```

Terminal B:

```bash
WONDERLAB_EVAL_LIMIT=2 npm run evals:live
```

Supported live-eval environment variables:

| Variable                    | Default                 | Meaning                                               |
| --------------------------- | ----------------------- | ----------------------------------------------------- |
| `WONDERLAB_EVAL_BASE_URL`   | `http://localhost:3000` | Application origin under test                         |
| `WONDERLAB_EVAL_LIMIT`      | all fixtures            | Positive integer limiting topics for a low-cost check |
| `WONDERLAB_EVAL_TIMEOUT_MS` | `45000`                 | Per-request timeout                                   |

The live runner calls the application's server routes; it does not read or print `OPENAI_API_KEY`. A missing server, missing key, or provider failure is reported as a failure/skip condition, never silently converted into a live pass.

Every completed live-eval invocation writes a reviewable JSON artifact to:

```text
output/evals/live-eval-<UTC-timestamp>.json
```

`output/` is gitignored. The runner prints the exact report path after the summary. Each report includes the synthetic fixture question, learner level, duration, synthetic prediction/artifact/reflection input, per-stage duration and status, all returned routes, the selected route, quest, evidence with explicit item-to-source associations, reflection result, finite map summary, every automated check, fixture pass/fail, and aggregate run counts. If a route, quest, evidence, reflection, or map stage fails, the report retains all earlier successful outputs and records the failed stage, sanitized error evidence, and unrun later stages.

The report contract is intentionally allowlisted. It never receives or writes API keys, request headers, evaluation safety identifiers, hidden prompts/server instructions, error stacks, or process-environment secrets. Only the origin portion of `WONDERLAB_EVAL_BASE_URL` is recorded; URL credentials, paths, and query strings are excluded. Reports contain the ordinary synthetic fixture inputs from `evals/fixtures.ts`, not real learner data. Review the local artifact before sharing it outside the private judging workflow.

## Fixture prompt set

The evaluation input set contains the ten required ordinary topics:

1. Could humans live underwater?
2. Why do we dream?
3. Could a city run without cars?
4. Why do songs get stuck in our heads?
5. Can plants communicate?
6. What makes a game fair?
7. Could we build a computer from living cells?
8. Why do societies create money?
9. Is time the same everywhere?
10. How could a school reduce food waste?

Each fixture provides a learner level, duration, a plausible prediction, a browser-completable artifact, and three reflection fields. Because live evidence IDs and claims do not exist until search returns, a credentialed runner must choose one returned source-backed `evidence` item and construct a synthetic learner Evidence Decision plus same-finding EvidenceApplication for the API-contract check. That synthetic learner trace verifies plumbing and model grounding only; it does not stand in for a real learner's judgment or establish educational value. These inputs drive live route → quest → evidence → reflection checks without storing graphic safety content in reports.

At `dac76a2`, the no-key runner passed 142/142 deterministic checks. It covers all ten topics with concise topic-specific expected outputs parsed through the production route, quest, evidence, reflection, decision/application, map, and completed-session schemas, then exercises independent validators and known-invalid negative controls. This is broad deterministic contract coverage, not a credentialed model-quality result.

The canonical seeded session in `data/demo-underwater.json` is also parsed and evaluated. It must be a complete `branch`-stage `seeded_fallback` session with a visible seeded disclosure, 2 Evidence items, 1 Inference, 1 Open Question, and a coherent map.

## Automated validators

### Routes

- Exactly three routes
- Unique IDs and normalized titles
- At least two distinct lenses
- At least one design/create/compare/test/systems-oriented route
- Non-empty, UI-bounded fields
- Plausible positive estimated time

### Quest plan

- Prediction prompt is present and asks for an initial commitment
- Creation challenge is present and browser-completable
- Two to four distinct constraints
- Completion criteria, safety note, and hint are present
- The browser-safety language scan includes the learner-visible `safetyNote`, not only prompts and constraints
- No prohibited hazardous activity language
- No default assignment-completion or grading behavior

### Evidence

- Two to four items
- Kinds limited to `evidence`, `inference`, and `open_question`
- Every `evidence` item has at least one source ID
- Every referenced source ID resolves to a returned source
- Source URLs parse as HTTP(S)
- No duplicate source URL
- Concise, UI-suitable total length with a hard 450-word rendered-lens ceiling for live output

### Learner Evidence Decision

- References an item in the current Evidence Lens
- Referenced item is kind `evidence` and has at least one resolved source
- Displays the selected finding's complete ordered linked source list beside the decision fields, with each title, domain, and destination preserved
- Relationship is exactly `supports`, `challenges`, or `complicates`
- Learner judgment records establishes, unresolved, and impact fields trimmed to 15–300 characters plus a `supports`/`challenges`/`complicates` relationship to the prediction
- Missing, stale, unsourced, inference, or open-question references cannot advance to reflection
- `EvidenceApplication` reuses that exact current `evidenceItemId` and has a trimmed 20–400-character concrete `designChoice`; changing the selected evidence clears the application and creation self-check
- Decision and application survive v4 session/draft restore and appear in the Discovery Card, map, and Markdown export with the selected finding, exact sources, and source boundary
- Reflection output must preserve and attribute the learner's recorded relationship rather than silently substitute the model's classification

The UI asks the learner to state what cited sources establish, answer **Where does this source scope stop?**, and explain how the finding affects their prediction, then to use that same finding in one concrete design choice. The field guidance says, “Separate what this source directly supports from your inference or a question it cannot answer.” The persisted schema key remains `unresolved`; the learner-facing contract is explicitly source scope. Automated validation enforces item/decision/application integrity and the 20–400-character design choice; it does not semantically prove that the learner covered each idea or that a cited claim is true.

These checks prove structural consistency within the submitted Evidence Lens bundle; they do not prove that `/api/evidence` issued it. Server-attested or signed provenance is intentionally deferred for this account-free, same-user prototype until a shared, graded, or cross-user trust boundary exists.

### Reflection

- Specific feedback and changed-thinking summary are non-empty
- Exactly three distinct next questions
- Exactly one learner-selected next question before card/export unlock; the map, card, and Markdown export label it `My next question`
- No automatic next quest after selection
- **At a glance** presents Before, Now, the selected finding and exact sources, the source boundary, design move, and selected next question
- The complete journey, learner reflection, and ReasonWeave response remain available in the native **Full learning trace** disclosure while the facilitator prompt and export actions stay visible
- Feedback shares meaningful concepts with learner-authored input, including the EvidenceApplication design link
- Feedback may respectfully question a learner relationship, but it must first attribute the recorded choice and use calibrated language; an unambiguous reason/label conflict cannot receive unconditional endorsement
- Seeded feedback labels and grounds the learner's evidence judgment, selected evidence, unresolved boundary, evidence-to-design link, actual creation, and still-wonder in <=800 characters
- Canonical fixture, unit, Discovery Card, serial E2E, and shared `evidenceDecisionGroundingIssues` coverage enforce this grounding behavior
- Direct relationship checks are object-sensitive: tension about maintenance or lack of support for a separate ecosystem claim does not negate support for the learner's prediction
- No grade, diagnosis, fixed-learning-style claim, or unsupported efficacy claim
- No generic praise-only response

### Curiosity Map

- Required semantic node kinds are present
- Approximately 6–10 nodes
- Exactly three next-question nodes in the final map
- Unique node/edge IDs
- Every edge source and target exists
- No self-edge or disconnected semantic node
- Final evidence-to-design trace represents the learner's relationship, source boundary, and design choice without increasing the bounded node count

### Cross-cutting text

- No dangerous physical-activity instruction
- No claim of proven educational outcomes
- No diagnosis or grading language
- Learner-visible output remains within practical UI bounds

Automated heuristics are intentionally conservative and imperfect. A validator failure identifies review work; a validator pass is not a truth or source-quality guarantee.

## Fixture runner design

`evals/run-fixture-evals.ts` performs three tasks without a network call:

1. parses and validates the real seeded underwater session with the production schema;
2. parses concise, topic-specific expected route, quest, evidence, reflection, decision, application, map, and completed-session outputs for the other nine required fixtures with the production schemas, then applies the independent evaluation validators;
3. mutates valid data into known-invalid cases and confirms the validators reject them.

This makes the deterministic suite useful even before a key is available. A fixture suite that only validates hand-authored good examples could pass because the validator never catches anything; negative-control checks protect against that failure mode.

## Live runner design

For each selected topic, `evals/run-live-evals.ts`:

1. posts the fixture question, level, duration, and an evaluation-only anonymous safety identifier to `/api/routes`;
2. validates exactly three routes and chooses a route with a creation/systems lens when available;
3. posts that route to `/api/quest` and validates the prediction/challenge plan;
4. posts the fixture prediction to `/api/evidence` and validates labels and citation associations;
5. selects one current sourced Evidence item, records a synthetic learner Evidence Decision (establishes, unresolved, impact, relationship) and same-finding 20–400-character EvidenceApplication, then posts evidence, decision, application, artifact, and reflection to `/api/reflect` and validates specificity and exactly three next-question candidates;
6. selects exactly one candidate and validates the finite Curiosity Map/card/export summary and `My next question` label;
7. writes the timestamped JSON evidence report, prints criterion-level pass/fail details, and exits nonzero if any topic fails.

The runner is deliberately sequential by default to reduce rate spikes and make failures attributable. `WONDERLAB_EVAL_LIMIT=2` is the recommended first credentialed check.

## Manual review rubric

Rate each complete quest from 1 (poor) to 5 (excellent):

| Dimension              | Review question                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route distinctiveness  | Do the three routes use genuinely different methods rather than synonyms?                                                                             |
| Educational usefulness | Does the sequence require meaningful learner action?                                                                                                  |
| Evidence clarity       | Are claims concise, understandable, and visibly distinguished from inference/open questions?                                                          |
| Source support         | Does each cited source actually support the nearby evidence claim?                                                                                    |
| Evidence judgment      | Can the learner select one sourced finding, inspect its exact sources, bound their scope, classify its relationship, and apply it to a design choice? |
| Challenge quality      | Is the creation task relevant, achievable, constrained, and safe?                                                                                     |
| Learner agency         | Does the learner choose, predict, judge, create, and reflect?                                                                                         |
| Feedback specificity   | Does feedback respond to the actual prediction/artifact/reflection without empty praise?                                                              |
| Next-question quality  | Are the three questions nontrivial, distinct, and useful continuations?                                                                               |
| Safety                 | Is content age-appropriate and free of hazardous directions, grading, or diagnosis?                                                                   |
| Visual coherence       | Does the rendered quest remain legible on desktop and mobile?                                                                                         |

Record short evidence notes, not just scores. A score without the exact observed output is difficult to debug.

## Release gates

### Deterministic gate

Historical predecessor checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` passed the deterministic gate at 44/509, 145/145, build with initial JavaScript 458,996 raw / 112,371 gzip across six chunks, serial Playwright 28/68, no-key 1/1 with zero requests, online/offline audit 0, scans/diff/final-clean, and no P0–P3. The tracked scan found no credential-like values; fake/blank Playwright configuration and `.env.example` are expected, and provider/key markers are absent from the client. Typecheck generated Next route types before TypeScript and left ignored `next-env.d.ts` out of the tracked build diff. Request-contract, duration-workload, migration-preservation, demo-consistency, and release-boundary tests passed. Desktop and mobile implementation-worktree QA passed with no horizontal overflow, but temporary frames are not release proof. This is historical deterministic contract proof, not live OpenAI or citation-quality proof.

Historical application checkpoints `0e0547e`, `0662d8d`, `ae3df74`, `7497901`, `aa64be1`, `e16eb48`, `269a3f820746c9253a2d1aa897755714ad56d277`, `a08b1ee`, `830ad96`, `1980e09`, `d432c27`, `ee5b479`, `15d3d57`, `4211bbf`, and `013f77a` retain their documented narrower proof and exact receipts. Historical predecessor `5ddbac355e1ab90fa7e3a8533ca2cbf995c5ab57` retains its exact 40/467, 142/142, 28/68, bundle, no-key, audit, scan, diff, and clean-status results. Historical predecessor checkpoint `9d56d2447aa2ed4aad22534ad1861afde1bfc900` (tree `d0303cdbe36992ac0fd3ecf09d8418effcfd45ec`) passed direct-worktree and fresh no-hardlink/no-alternates-clone gates: format, lint, typecheck, normal serial Vitest 40/467, 142/142 fixtures, build, authoritative serial Playwright 26/62, no-key Chromium 1/1 with zero requests, tracked/client scans 0 after blank/dummy Playwright-fixture classification, diff check, and final clean status. The clone completed the 464-package `npm ci`; offline `npm audit --offline --audit-level=low` found 0 vulnerabilities, while network audit was not run. No attestation generator or receipt was created. Bundles measured 474,843 / 118,164 initial, 16,372 / 5,682 map, 15,005 / 4,870 Discovery Card, and 31,377 / 10,552 deferred across two chunks. Independent review found no P0/P1/P2. No provider, key, live-model, deployment, media, or publication action occurred. Human/manual keyboard review, true browser 200% zoom/reflow, VoiceOver/NVDA/JAWS, and physical/manual Safari remain open; screenshots and proof board remain historical `aa64be1`/`dac76a2` evidence.

A historical fresh temporary checkout independently reproduced exact `e16eb48`: 464-package install; format/lint/typecheck; 33 files / 387 tests; 142/142 fixtures; audit 0; build; zero-finding secret/client scans; 21 Playwright passes / 47 deliberate skips; and one no-key pass all succeeded, and the checkout ended clean. Its historical bundles measured 469,563 raw / 116,742 gzip initial, 15,190 / 5,404 map, 12,827 / 4,611 card, and 28,017 / 10,015 deferred. Ignored receipt `output/release/current-app-e16eb48-clean-checkout-attestation.json` is 8,072 bytes with SHA-256 `8f771bbc346c4e5e99bfd5b4ee9972f85420313219054e55656f23170349cc83`. This remains historical predecessor evidence. `d432c27`, `15d3d57`, and `4211bbff` retain historical no-hardlink whole-repository/release-tooling proof; `ee5b479` is a historical application predecessor.

The deterministic gate includes the learner-owned chain prediction → Evidence Decision with exact sources and source-scope boundary → same-finding evidence-to-design link → creation → reflection → exactly one selected `My next question` → compact summary and full trace, plus v4 persistence, calibrated reflection request, map, card, and export. The 2:54 local rehearsal at clean capture/assembly checkpoint `fb4893c` demonstrates the earlier evidence-to-design chain, including the EvidenceApplication and actual 6,499-byte clipboard export, but predates the selected-next-question upgrade. It is historical local seeded proof only; clean `5814a13` supplies the completed capture/assembly candidate documented above, which is itself historical relative to current app checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`. The earlier `2a95bcf` rehearsal also predates EvidenceApplication.

### Credentialed gate

At least the canonical topic and a varied subset of ordinary prompts must pass live. Inspect every canonical source link manually. If no key is available, mark this gate **not run**, not passed.

The July 20, 2026 local credentialed check satisfies this narrow gate for the canonical underwater topic and dreams at code commit `8c2dda9`: 2/2 fixtures, 126/126 checks, and all four displayed source links manually reviewed. It deliberately used the cost-controlled Terra test override and does not substitute for the deployment gate or a production-default Sol run.

### Deployment gate

From a clean browser:

- complete the canonical live flow twice;
- complete the explicit seeded flow once;
- test a mobile viewport and keyboard navigation;
- manually test full end-to-end keyboard-only operation and focus visibility, true browser 200% zoom/reflow, VoiceOver/NVDA/JAWS behavior, and physical Safari;
- force one provider failure and confirm state preservation;
- inspect browser requests/bundles for secret leakage;
- verify every displayed canonical citation.

### Repository and submission gate

- Exclude the removed, unverified route-art JPEG blobs from reviewer-facing history through an approved purge or clean repository export.
- Preserve `docs/route-art-provenance.json`, which binds the shipped WebPs to source PNGs whose Content Credentials validated as trusted.
- Resolve the direct existing public-software use named **ReasonWeave Agent Suite** or adopt and re-screen a distinct replacement name; then complete broader trademark, domain, and handle clearance plus a final repository/application/video IP audit.
- If the repository remains private, verify access for `testing@devpost.com` and `build-week-event@openai.com`.
- Confirm the project was built within the July 13–21 Submission Period with timestamped Git/Codex evidence, and verify the README includes setup, sample data, testing instructions, Codex acceleration/key decisions, and GPT-5.6 use.
- Confirm the deployed app is free, signed-out, and unrestricted through August 5, 2026 at 5:00 PM Pacific; recheck the controlling Official Rules on submission day.

## Reporting format

Reports should state:

- checkout/commit identifier;
- date and environment;
- exact command;
- topics tested;
- passed, failed, and skipped counts;
- criterion-level failures;
- whether a real API key and live web search were used;
- unresolved manual-review findings.

Never describe a seeded or mocked result as live, and never describe a narrow topic check as broad production validation.
