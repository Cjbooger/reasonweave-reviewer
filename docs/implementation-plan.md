# ReasonWeave implementation plan

**Status:** current behavior checkpoint is exact source `0bd5aef89ab4715477491b462c13be0c5978ac6b` (tree `4d6162e7a7632bba96f582818f44d98bbff956a0`). A fresh no-hardlink/no-alternates clone (exact HEAD/tree, unique pack inode/link count 1; `npm ci` added 464 packages) passed format/lint/typecheck; 46 files / 596 Vitest tests; 145/145 fixtures; production build/bundle budgets; serial Playwright 28/68; no-key 1/1 zero API requests; online/offline audit 0; default preflight 13 PASS / 0 FAIL / 7 PENDING; scans, diff check, and final clean status. Keyboard stress 5/5 is direct-worktree proof. The current duration contract uses compact Source notes for 5- and 10-minute quests and expanded evidence-decision fields for 15-minute quests. Its positive five-minute allocation is choose 30s, predict 30s, investigate 1m, create 1m 30s, reflect 1m, and branch 30s; workloads are 2/1, 2–3/1–2, and 2–4/1–4 constraints/criteria respectively. The learner's creation anchor is a 2–8-word normalized phrase with at least two specific words, exactly repeated from the design move in the creation artifact as a continuity check, not a grade; valid older sessions migrate while incomplete pre-anchor sessions return to Create. Independent anchor, performance, and verifier reviews found no P0–P3. No OpenAI/provider/Keychain-secret/media/deployment/publication/submission action occurred. Exact owner-selected voice `OZxMHsGaBmV5pjMIDIn0` remains `user_selected_tts_only`; provider metadata/listening approval is unverified.

**Historical-ledger convention:** every later `acfdc37` reference preserves its exact predecessor proof only; it is never the current plan subject.
**Target:** one polished, deployable Education-category vertical slice  
**Hard submission deadline:** July 21, 2026 at 5:00 PM Pacific  
**Internal target:** July 21, 2026 at 12:00 PM Pacific

This plan translates the three source documents in `wonderlab_hackathon_pack/` into an executable build. It is a plan and evidence index, not a claim that unchecked work is complete.

## Product contract

Build one finite learning loop:

```text
SPARK → CHOOSE → PREDICT → INVESTIGATE → CREATE → REFLECT → BRANCH
```

The learner owns the question, route choice, prediction, explicit judgment of one sourced finding, a statement of what its exact linked sources establish and where their scope stops, a concrete design choice tied to that same finding, creation, and reflection. GPT-5.6 scaffolds routes, the quest, evidence synthesis, feedback, and next questions. The application must remain usable through a clearly labeled seeded underwater quest when live generation is unavailable.

### P0 outcome

A judge can understand the product within ten seconds and complete the canonical `Could humans live underwater?` journey without authentication. The experience must reveal its primary visual moment after reflection: a bounded Curiosity Map plus an exportable Discovery Card that reflects the learner's actual work.

### Deliberate exclusions

No authentication, database, teacher dashboard, LMS, grading, under-13 support, uploads, general chat, long-term profiles, social features, curriculum mapping, infinite branching, image generation, or dangerous physical experiments.

## Architecture

- **Client:** Next.js App Router and React. Owns screens, state transitions, fixed 24-hour browser persistence, accessible interaction, deterministic map layout, and hardened Markdown export.
- **Server:** Next.js route handlers. Own validation, the production live-release lock, moderation, pinned OpenAI client use, prompts, streamed request limits/deadlines, learner-agency redirects, structured-output parsing, citation normalization, and safe errors.
- **Model:** GPT-5.6 through the Responses API. All four structured calls set `text.verbosity` to `low`, preserve schemas/token ceilings/validators, and produce short semantic content rather than layout coordinates.
- **Evidence:** OpenAI web search. Only tool-returned URLs may become citations.
- **Fallback:** a complete pre-generated underwater session using the same state model and UI.
- **Validation:** Zod at network boundaries; deterministic validators and tests for cross-field invariants.
- **Persistence:** versioned browser `localStorage` session/draft envelopes with a fixed 24-hour lifetime; no server database.

See [architecture.md](architecture.md) for trust boundaries and request sequences.

## Implemented file structure

```text
app/
  api/{routes,quest,evidence,reflect}/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  app-header.tsx
  curiosity-map.tsx
  discovery-card.tsx
  wonderlab-app.tsx
lib/
  openai/{client,prompts,generate-routes,generate-quest,generate-evidence,generate-reflection}.ts
  api-errors.ts
  browser-storage.ts
  client-api.ts
  export-markdown.ts
  learner-agency.ts
  live-generation.ts
  map.ts
  map-layout.ts
  moderation.ts
  prose.ts
  request.ts
  route-diversity.ts
  safety.ts
  schemas.ts
  session-machine.ts
types/
  curiosity.ts
data/
  demo-underwater.json
evals/
  fixtures.ts
  validators.ts
  run-fixture-evals.ts
  live-report.ts
  run-live-evals.ts
tests/
  ...schema, state, layout, export, route-diversity, backend-boundary, and seeded-flow tests...
docs/
```

The application keeps the state machine, map layout, export, provider integration, and rendered UI in separate testable boundaries without adding authentication or a database.

## Data flow

1. The browser creates or restores a random anonymous session and safety identifier.
2. Spark validates a 3–300-character question, learner level, and duration and warns against personal information.
3. `POST /api/routes` moderates the input and returns exactly three validated, methodologically distinct routes.
4. The learner selects one route; `POST /api/quest` returns a prediction prompt, hint, investigation framing, canonical step-by-step time budget, and a safe duration-bound creation challenge: 5 minutes has exactly 2 constraints / 1 criterion, 10 minutes has 2–3 / 1–2, and 15 minutes has 2–4 / 1–4.
5. Evidence remains hidden until the learner records a meaningful prediction.
6. `POST /api/evidence` uses web search and returns two to four labeled items plus only citations from a completed `web_search_call`; failed, in-progress, and searching calls admit no citation.
7. In the five- and ten-minute paths, the learner uses one textarea with exactly three lines to record what a current source-backed Evidence item establishes, where its exact scope stops, and how it changes the prediction. The supports/challenges/complicates relationship remains a separate control. The compact note parses into the existing `establishes`, `unresolved`, and `impact` fields; the 15-minute path retains those three separate fields, so downstream `EvidenceDecision` and its schema remain unchanged. The canonical five-minute plan gives every required step positive time: choose 30s, predict 30s, investigate 1m, create 1m 30s, reflect 1m, and branch 30s.
8. The learner writes a 20–400-character `EvidenceApplication.designChoice` tied to that same exact finding. Changing the selected finding clears the link and creation self-check.
9. The learner creates an artifact and self-checks it against the visible completion criteria. The decision, application, and valid artifact are stored atomically before reflection becomes available.
10. The learner completes all three reflection fields; `POST /api/reflect` receives the bounded current Evidence Lens, Evidence Decision, EvidenceApplication, and artifact, revalidates the shared selected sourced item, moderates the evidence/source context and learner-authored text with other reused text, and returns specific feedback, a changed-thinking summary, and exactly three next questions.
11. The learner selects exactly one of those next questions. Only then does the client unlock the deterministic 6–10-node map, Discovery Card, and Markdown export, each showing it as `My next question`; no next quest starts automatically. On the first fresh Branch selection at widths of 930 CSS pixels or less, focus moves to the named Discovery Card region and keeps the deferred loading slot visible. Desktop and subsequent user selections retain radio focus; restored/already-selected paths do not auto-focus the card. The status reads **Card unlocked. Map updated.**
12. v4 session/draft envelopes keep a fixed original timestamp, are removed after 24 hours while open or on the next load, and can be cleared sooner; live generation still transmits entries through the server to OpenAI.
13. A typed failure preserves state and offers retry or the explicitly labeled seeded demo.

## Atomic build sequence

Each item has an independent evidence gate. Status should be changed only after the named evidence exists.

|   # | Work item                                                                                            | Current state                                                                                                                                                                                                                                                                                                                     |
| --: | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Establish strict Next.js project, environment contract, and documentation skeleton                   | Implemented; `0bd5aef` is current local app/judge-story proof, while `acfdc37`, `035e820`, `5ddbac3`, `9d56d24`, `013f77a`, `4211bbf`, `ee5b479`, `15d3d57`, `1980e09`, and `7d01c9b` retain historical evidence                                                                                                                  |
|   2 | Define schemas, types, session reducer/store, and seeded underwater data                             | Schema/state tests pass; completed session reload/resume and clearing pass                                                                                                                                                                                                                                                        |
|   3 | Build the complete fixture-driven Spark-to-Branch UI                                                 | Implemented and proved at `acfdc37`: duration-aware compact/expanded source work, evidence/decision boundaries, selected-next-question gate, explicit-demo lazy fixture, Reflect card warmup, Branch retry, revision-aware cue, payoff, and full-trace disclosure                                                                 |
|   4 | Add moderation, server-only OpenAI client, and route generation                                      | Implemented; credentialed moderation and route generation not run                                                                                                                                                                                                                                                                 |
|   5 | Add quest planning and enforce the prediction gate                                                   | Implemented; unit and rendered empty-prediction gate checks pass                                                                                                                                                                                                                                                                  |
|   6 | Add the Evidence Lens, normalized citations, Evidence Decision, and same-finding EvidenceApplication | Implemented and deterministically proved, including complete ordered linked sources, field 04 source-scope teaching, and boundary transfer; credentialed live citation association not run                                                                                                                                        |
|   7 | Add creation, three-part reflection, feedback, and next questions                                    | Reflection returns exactly three candidates; exactly one learner choice is required before card/export; compact payoff and full trace both retain the learner chain; no auto next quest                                                                                                                                           |
|   8 | Add deterministic Curiosity Map, outline fallback, and Markdown export                               | Final trace/export preserve learner judgment, source scope, design, and `My next question`; `acfdc37` retains the warm-card/revision-aware flow, while `035e820`, `5ddbac3`, `9d56d24`, `013f77a`, and `aa64be1` retain historical performance/recovery/mobile/geometry proof                                                     |
|   9 | Harden timeout, retry, fallback, persistence, safety, and accessibility                              | Implemented; the focused complete Chromium keyboard-only Spark → Branch journey passed 5/5 stress runs at `a08b1ee`; human/manual keyboard review, 200% zoom, real AT, and physical Safari remain open                                                                                                                            |
|  10 | Run deterministic tests, fixture evals, browser smoke, and limited live evals                        | Exact `acfdc37` proof passed a 464-package install, 44/509 tests, 145/145 checks, build/bundle budgets, authoritative serial 28-pass/68-skip Playwright (96 total), no-key Chromium 1/1 with zero API requests, online/offline audit/scans/diff/final-clean gates, and independent review; credentialed live evals remain pending |
|  11 | Deploy and verify from a clean browser and second viewport/network                                   | Not deployed or externally verified                                                                                                                                                                                                                                                                                               |
|  12 | Capture screenshots, record the public narrated video, complete Devpost, and run `/feedback`         | 8 historical ReasonWeave JPGs are bound to `387ddeb` from clean `aa64be1`; `5814a13` media with immutable `10a058e` narration is older-source; final name, current capture/media receipt, fresh capture-bound paid-call approval, human listen approval, public video, Devpost, and `/feedback` remain                            |

## Delivery phases

### Phase 1 — fixture-first vertical slice

Implement the entire journey with validated seeded data before making live model behavior a dependency. This proves navigation, learner agency, map semantics, and export while exercising accessible semantics and visual hierarchy.

### Phase 2 — live intelligence

Add moderation and the four server boundaries in dependency order: routes, quest, evidence, reflection. Keep structured outputs short and validate every response. Use a real key only from server-side environment state.

### Phase 3 — visual trace and resilience

Complete the map transformation, text outline, export, local persistence, timeout/retry flow, and transparent seeded fallback. This phase creates the demo-defining moment and protects it from API failure.

### Phase 4 — proof and submission

Historical predecessor app/judge-story subject `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` passed a 464-package install: format/lint/typecheck; 44 files / 509 tests; 145/145 fixtures; build and bundle budgets; authoritative serial Playwright 28/68 (96 total); no-key 1/1 with zero API requests; online/offline audit/scans/diff/final-clean gates; and independent final education and release review with no P0–P3. It retains `14b210f`'s strict low-verbosity request contract, adds schema-enforced 5/10/15-minute workloads with lossless legacy compatibility, aligns the seeded demo to a credible compact creation, and binds release narration to exact voice `OZxMHsGaBmV5pjMIDIn0`. Historical `035e820` remains seeded-feedback grounding proof and `5ddbac3` remains exact historical performance proof. No OpenAI/provider/media/deployment/publication action occurred. After the public name and judge script are frozen, preserve the historical SRT and create/commit a new versioned, human-reviewed SRT before screenshot capture and media rendering. Then capture the final flow, bind approval for the exact owner-selected voice to that capture, and allow at most one paid TTS POST. Afterward, run the limited live evaluation, deploy, obtain owner/human narration approval, create the private remote, grant and verify reviewer access, publish and verify the public video, and complete Devpost, `/feedback`, and the evidence checklist.

## Risks and mitigations

| Risk                                        | Impact                                | Mitigation and proof                                                                                                                                                |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope expands into an education platform    | Core journey remains unfinished       | Treat P0 and non-goals as binding; reject features that do not strengthen choose/predict/evaluate/create/reflect                                                    |
| Product resembles a generic tutor           | Weak Quality of Idea score            | Lead with learner-originated curiosity, creation, bounded visual trace, and next questions                                                                          |
| Invalid model output breaks UI              | Demo failure                          | Structured outputs, server validation, cross-field validators, retry once, typed errors, seeded fallback                                                            |
| Web search produces weak/missing citations  | Trust failure                         | Only normalize returned annotations; show verification failure rather than inventing a source                                                                       |
| Learner sees evidence but never applies it  | Product becomes answer delivery       | Require one current sourced finding, learner Evidence Decision, and same-finding 20–400-character concrete design choice before reflection                          |
| API key/credits unavailable                 | Live flow blocked                     | Build and verify the full seeded path; add the key later through `.env.local`/host secrets                                                                          |
| Anonymous public endpoints are abused       | Unexpected spend and degraded service | Production live-generation release lock defaults off; per-instance guard, distributed limits, app/host circuit breaker, and soft OpenAI budget alerts before launch |
| Latency exceeds demo tolerance              | Poor Design/Implementation score      | Short outputs, explicit progress, abort timeout, retry, and intentional fallback action                                                                             |
| Unsafe activity or personal content appears | Learner harm and trust failure        | Moderation, safe-activity allowlist, prohibited hazards, no profile collection, calm redirects                                                                      |
| Map is decorative or unreadable             | Visual idea loses educational meaning | Every node maps to session evidence; cap nodes; deterministic desktop/mobile layout; outline fallback                                                               |
| Feedback is generic                         | Weak educational value                | Require lexical/concept grounding in learner text and manually review weak/uncertain responses                                                                      |
| Submission media is late or incomplete      | Judges cannot evaluate the project    | Record after the stable vertical slice; use a timed script; target submission at noon, not 5 PM                                                                     |

## Acceptance gates

### Product

- A first-time user understands the promise within ten seconds.
- Full Spark-to-Branch flow completes for the seeded demo and at least five live topics when credentials are available.
- Exactly three route cards; prediction before evidence; two to four labeled findings; one source-backed Evidence Decision (direct support, source-scope boundary, impact, relationship) with its complete ordered linked source list; same-finding 20–400-character EvidenceApplication; safe creation; three-part reflection; specific feedback; exactly three next-question candidates followed by exactly one learner choice.
- Map contains real session semantics, including the learner's Evidence Decision, source-scope boundary, evidence-to-design link, and `My next question`, and remains finite; Discovery Card/Markdown export unlock only after that choice and never auto-start another quest. The card's **At a glance** payoff stays compact, the complete trace stays available in a native disclosure, and facilitator/export controls stay visible. The first fresh Branch selection at widths up to 930px focuses the named card region through deferred loading; desktop and subsequent user choices retain radio focus, while restored/already-selected paths do not auto-focus the card.

### Trust and safety

- API key is server-only and absent from browser bundles/logs/artifacts.
- Production defaults to seeded-only; live OpenAI calls require exact enablement, a future UTC expiry no more than 30 days away, GPT-5.6 selection, and—on Vercel—an approved full Git SHA matching the deployed source.
- Input and relevant free text are moderated.
- Evidence URLs originate only from actual web-search output.
- 13+ and AI/source disclosures are visible.
- No database, identity collection, content-rich production logs, dangerous activity, grade, diagnosis, or efficacy claim.

### Engineering

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

`npm run evals:live` is a separate credentialed gate. For the first credentialed check, run the application in Terminal A and run `WONDERLAB_EVAL_LIMIT=2 npm run evals:live` in Terminal B. A skipped live run is not a pass.

### Submission

- Deployed URL works without sign-in or payment.
- Reviewer-facing history excludes the removed, unverified route-art JPEG blobs through an approved purge or clean export.
- Private repository access is shared with `testing@devpost.com` and `build-week-event@openai.com` if the repository remains private, and both invitations are verified.
- Build-period eligibility is backed by timestamped Git/Codex evidence, and the README includes setup, sample data, testing instructions, Codex acceleration/key decisions, and GPT-5.6 use.
- Resolve the direct existing public-software use named **ReasonWeave Agent Suite** or adopt and re-screen a distinct replacement name; then complete broader trademark, domain, and handle clearance plus the final repository/application/video IP audit.
- The deployed app remains free, signed-out, and unrestricted through August 5, 2026 at 5:00 PM Pacific; recheck the controlling Official Rules on submission day.
- Public YouTube video is narrated, under three minutes, and explicitly explains Codex and GPT-5.6.
- Entry addresses all four equally weighted judging criteria: **Technological Implementation, Design, Potential Impact, and Quality of Idea**. Technological Implementation is the first tie-breaker.
- `/feedback` is run in the preserved primary Codex thread and the session ID is recorded.
- Archive the exact submitted entry and do not alter fields or media after the deadline except for a narrow organizer-permitted IP, PII, or inappropriate-material correction.

## Verified release-candidate snapshot

Current source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`, tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`, passed a fresh 464-package no-hardlink/no-alternates clone: format/lint/typecheck; 44 test files / 509 tests; 145/145 fixtures; production build; initial bundle 458,996 raw / 112,371 gzip across six chunks; Curiosity Map 16,372 / 5,682; Discovery Card 15,163 / 4,918; two UI chunks 31,535 / 10,600; separately lazy seeded-demo 21,186 / 6,890; authoritative serial Playwright 28 passes / 68 deliberate project-scoped skips (96 total); dedicated no-key Chromium 1/1 with zero API requests; tracked/client scans; diff check; final clean status; and online/offline audits with 0 vulnerabilities. Independent final education and release reviews found no P0–P3. No attestation generator or receipt was created. No OpenAI/provider/media/deployment/publication action occurred. Historical `035e820` retains its seeded-feedback proof, and historical `5ddbac3` retains its exact performance proof. Automated Chromium keyboard-only proof remains historical `a08b1ee` evidence, while human/manual keyboard review, true 200% zoom, VoiceOver/NVDA/JAWS, and physical/manual Safari remain open.

Historical checkpoint `a08b1ee50451c8b5df41da1bea4ad2d79cd49a69` was prior local application proof: clean-main-worktree format/lint/typecheck; 33 test files / 388 tests; 142/142 fixtures; production build; initial bundle 470,655 raw / 116,946 gzip across five chunks; Curiosity Map 15,195 / 5,412; Discovery Card 15,005 / 4,870; two deferred chunks 30,200 / 10,282; regular Playwright 22 passes / 50 deliberate project-scoped skips; dedicated no-key Chromium 1/1; focused complete Chromium keyboard-only Spark → Branch journey 5/5 stress runs; changed-file secret scan 0; and diff check. Automated Chromium keyboard-only proof is closed as historical evidence; human/manual keyboard review, true 200% zoom, VoiceOver/NVDA/JAWS, and physical/manual Safari remain open. The later historical whole-repository `7d01c9b` clean-checkout/audit proof closes those exact source-level gates without replacing remaining screenshot, media, live-model, deployment, or manual-browser gates. Screenshot receipt `387ddebb63686ed373fdffc7d7cdd1cb7b167a4a` binds eight historical images to `aa64be1`, not current source. Preserve `dac76a2`, historical fresh-checkout/audit evidence `e16eb48`, historical predecessor `269a3f820746c9253a2d1aa897755714ad56d277`, media `5814a13`/`10a058e`, and reviewer archive source `1023992`. The completed reviewer release `output/release/reasonweave-reviewer-1023992.tar.gz` is older-source evidence pending refresh after the public-name decision. External owner gates remain open.

Narration-tooling checkpoint `b386343` leaves the application UI checkpoint unchanged and hardens the future paid-generation pass. Inode-anchored official CLI I/O contains parent-directory swaps for short-lived preview/catalog-approval/user-selected-approval artifacts as well as paid-generation artifacts; deliberate public identity checks stop before a paid POST when the expected capture path changes, and the official CLI's subsequent continuity check fails closed. Three provider-free actual-child-CLI regressions cover exact-ID GET, preview lock, and catalog-approval temporary publication. Final-tree proof passed 34 files / 394 tests, 142/142 fixtures, production build and bundle budgets, full Playwright 22/50, no-key Chromium 1/1, focused voice suites 44/44, secret scan 0, and diff check. Independent review found no P0/P1/P2. The narrow accepted residual is pure Node's non-atomic final check-to-network micro-window; this does not claim hardening for arbitrary direct library callers. It made no Keychain, ElevenLabs, OpenAI, narration, or media call/change.

Verified on July 17, 2026 Pacific Time at exact ReasonWeave repository/app, screenshot, and tracked release-media checkpoint `dac76a2acba47e8deebca1a2066c80097f9899f0`:

- `npm run verify` passed format, lint, typecheck, 31 serial test files / 356 tests, and 142/142 fixture evaluations across all ten required topics with production schemas and negative controls.
- `npm run format:check` and the production build passed.
- Full Playwright passed 16 intended checks with 32 scoped skips across Chromium, Firefox, WebKit, and mobile Chromium.
- From exact clean application checkpoint `dac76a2`, the focused screenshot journey passed twice; all 8 resulting ReasonWeave JPGs regenerated byte-for-byte.
- Initial JavaScript measured 468,746 raw / 116,364 gzip across five chunks; two deferred feature chunks measured 26,724 raw / 9,595 gzip. The map is deferred from initial load and the Discovery Card remains separate for the branch experience.
- Production `/` returned `200` with CSP, Permissions Policy, Referrer Policy, `nosniff`, and frame denial. No-key `/api/routes` returned calm `503` with `no-store`.
- Repository and `.next/static` scans returned no secret, server-only, or OpenAI SDK marker.

The current deterministic gate exercises the learner-owned chain prediction → Evidence Decision (all relationship choices plus what the sources establish, where their exact scope stops, and impact) → same-finding EvidenceApplication → creation → reflection → exactly one selected next question, v4 persistence, reflection request, Curiosity Map, Discovery Card, and Markdown export across all ten required fixture topics. The complete ordered linked source list appears beside the decision fields; the selected source-scope boundary persists into card, map, and Markdown. The map relationship prefix is intentionally shortened to **Complicates** so the complete boundary fits. The app retains the persistence protections first proved at `7497901`. The final artifacts label the choice `My next question`, and card/export remain unavailable before it. The Discovery Card's **At a glance** summary exposes Before, Now, the selected finding and exact sources, and **My evidence judgment**—supports, challenges, or complicates; why it mattered; and the boundary—before design move and next question; complete journey/reflection/AI output remains in native **Full learning trace** disclosure, while the optional non-evaluative facilitator prompt and export actions stay visible. On the first fresh Branch selection at widths up to 930px, the named Discovery Card region receives focus while its stable deferred slot remains visible; desktop and later user choices retain radio focus, while restored/already-selected paths do not auto-focus the card. Focused forward/reverse keyboard proof and source scroll margin cover the remaining controls and links. Feedback validators require meaningful concepts from the learner's design link. Current app updates are not represented in the historical `5814a13` candidate, which reuses immutable `10a058e` narration artifacts; no second paid provider call occurred. The exact owner-selected and owner-described female speaker remains `OZxMHsGaBmV5pjMIDIn0`, while provider catalog name/gender/category metadata and owner/human listening approval remain unverified.

## Verified historical local rehearsal snapshot

The evidence-to-design seeded rehearsal was clean-captured and assembled at exact commit `fb4893cf9287231c00e1b98e7756fe4af7dd1796` into ignored output `output/playwright/wonderlab-demo-fb4893c/`. It records the learner's Evidence Decision, same-source EvidenceApplication, all nine map nodes, and an actual 6,499-byte Discovery Card export. The 174.000-second MP4 is 13,950,748 bytes at SHA-256 `746ca60a4a03c1c5ca6e8d6d53c320089e0dd80fbe229e16dfbfc971888406a0`.

Its 39 captions are burned in and embedded, with a maximum 42-character line and 150 WPM. The Samantha local rehearsal voice measures -15.7 LUFS integrated / -2.7 dBFS true peak. The whole-timeline contact sheet and critical proof segment were visually inspected. Capture and assembly states were clean, no API key was passed, the owned no-key server stopped, and the output secret-marker scan found no matches. This rehearsal predates `0662d8d`'s selected-next-question upgrade; later clean `5814a13` capture/assembly proof supersedes it while reusing immutable narration artifacts from `10a058e`, but is itself historical relative to current app/judge-story source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`. The earlier `2a95bcf` rehearsal also remains historical media evidence and predates EvidenceApplication.

Historical checkpoints remain useful evidence, but they are not current ReasonWeave release proof. Still unverified: human/manual keyboard review through Spark → Branch, true browser 200% zoom/reflow, real VoiceOver/NVDA/JAWS, physical/manual Safari, credentialed GPT-5.6/web-search quality and citation links, deployment-level distributed limits/spend controls, key-backed network/deployed-bundle inspection, production logging, collision-free public naming, fresh paid-narration authorization after any rename, reviewer-hosted access, deployment, owner/human narration approval, public YouTube video, Devpost, and `/feedback`. The detailed release ledger is [submission-checklist.md](submission-checklist.md).
