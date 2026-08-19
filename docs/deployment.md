# Deployment and rollback runbook

**Historical-ledger convention:** `0bd5aef89ab4715477491b462c13be0c5978ac6b` is the current app checkpoint. Every later `acfdc37` reference preserves historical predecessor facts only.

ReasonWeave targets a Vercel-compatible Next.js deployment. This runbook is preparation, not deployment authorization. Do not create a remote, upload source, configure a live key, deploy, promote, or change repository visibility until the owner explicitly approves that external action.

> **Current checkpoint supersession — July 19, 2026:** exact `0bd5aef89ab4715477491b462c13be0c5978ac6b`, tree `4d6162e7a7632bba96f582818f44d98bbff956a0`, has direct clean committed-worktree proof only: format/lint/typecheck; 46/596 Vitest; 145/145 fixtures; production build (`/` plus four APIs); initial bundle 464,236/113,930, map 16,356/5,592, card 15,598/5,051, UI 31,954/10,643, seeded 21,224/6,904; Playwright 28/68; no-key 1/1 zero API; keyboard stress 5/5; audit 0; expected-only scans; diff and clean status. Default preflight is 13 PASS / 0 FAIL / 7 PENDING. Strict release is intentionally 0/9 because deployed/live/reviewer/media/public evidence does not exist. No provider, OpenAI, media, deployment, or publication action occurred; no Keychain secret was read. Earlier `acfdc37` current wording is historical predecessor evidence.

**Historical predecessor checkpoint:** exact source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` (tree `9b8ca0ebc03cc3b00f8f553d18b06297d253f274`) passed a fresh no-hardlink/no-alternates clone: npm ci 464 packages/audited 465 with 0 vulnerabilities; format/lint/typecheck; 44/509 Vitest; 145/145 fixtures; production build; serial Playwright 28/68; no-key Chromium 1/1 with zero API requests; online/offline audit 0; scans, diff check, and final clean status. Bundles were 458,996 raw / 112,371 gzip initial across six chunks; 16,372 / 5,682 map; 15,163 / 4,918 card; 31,535 / 10,600 two UI chunks; and 21,186 / 6,890 seeded demo. Desktop 1280 and mobile 390 rendered QA plus adversarial 1280/375/320 E2E passed without horizontal overflow; the card's **My evidence judgment** remained bounded while full text stayed available in disclosure/export. Independent final education and release reviews found no P0–P3. No provider/Keychain secret read, OpenAI, capture, media, deployment, publication, or submission action occurred. This proof does not authorize deployment.

Historical predecessor `5ddbac355e1ab90fa7e3a8533ca2cbf995c5ab57` (tree `b9632e2924dccfd13d26accb9aa029c2bfd86d3e`) retains its exact 40/467, 142/142, 28/68, no-key 1/1, six-chunk 453,691 / 110,997, map 16,372 / 5,682, card 15,005 / 4,870, two-UI-chunk 31,377 / 10,552, and separate seeded-demo 22,213 / 7,516 proof.

Historical predecessor `9d56d2447aa2ed4aad22534ad1861afde1bfc900` (tree `d0303cdbe36992ac0fd3ecf09d8418effcfd45ec`) retains its exact 40/467, 142/142, 26/62, five-chunk 474,843 / 118,164, map 16,372 / 5,682, card 15,005 / 4,870, and two-deferred-chunk 31,377 / 10,552 proof.

Historical release-tooling checkpoint `4211bbff771597e97ecacd4eb3dbbe33c6472735` (tree `02558c6631be4ffd08ed6a158a3abffef6542c3a`) retains clean no-hardlink/no-alternates format/lint/typecheck, 40/463, 142 fixtures, build/bundles, Playwright 24/56, no-key 1/1 with zero requests, focused 7/93, preservation 23, audit/scans 0, and clean-status proof. Its 11,139-byte receipt `current-repo-4211bbf-clean-checkout-attestation.json` has SHA-256 `a79528b4032dc79a3b32c88cb664009681914de98dcc4e9c6f52276e3593e078`. Its canonical identity and receipt/buffer binding remain historical tooling evidence; `ee5b479` and `15d3d57` are historical application/source predecessors.

Official operator references:

- [Vercel CLI deployment flow](https://vercel.com/docs/projects/deploy-from-cli)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel deploy command](https://vercel.com/docs/cli/deploy)
- [Vercel production rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
- [Vercel WAF rate limiting](https://vercel.com/kb/guide/add-rate-limiting-vercel)
- [Vercel WAF custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
- [Vercel rate-limiting counter scope](https://vercel.com/i/rate-limiting-algorithms)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [OpenAI project budgets and alerts](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
- [OpenAI Responses API request contract](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI rate-limit guidance](https://developers.openai.com/api/docs/guides/rate-limits)

## 1. Release blockers before any public preview

All of these are hard gates:

- Record the candidate commit SHA and confirm the working tree is clean.
- Run the complete local gate from a fresh clone.
- Create or confirm a private remote and grant access to `testing@devpost.com` and `build-week-event@openai.com`; verify both invitations before submission.
- Build the reviewer-facing repository from history that excludes the three removed, unverified JPEG route-art blobs, either through an explicitly approved history purge or a clean private submission-repository export. Keep the current credential-backed route-art provenance record with that repository.
- ReasonWeave replaced the original working title after a practical collision review on July 17, 2026. A deeper screen found a direct existing public-software use named **ReasonWeave Agent Suite**. The owner explicitly adopted ReasonWeave for this submission despite that documented collision; it is not legally cleared, and final IP review remains open. The exact-mark USPTO knockout result and domain signals do not override that risk or constitute legal advice.
- Use a dedicated OpenAI project and project-scoped key; never reuse a personal catch-all key.
- Configure the strictest practical OpenAI project budget, usage alerts, and operator notification path before exposing live generation. Treat these as soft monitoring thresholds: OpenAI project budgets do not stop requests after the threshold is exceeded.
- Add and verify a distributed deployment-level rate limit. The current in-process guard is useful locally but cannot coordinate across serverless instances and is not sufficient for a public launch. On Vercel, use a WAF **Rate Limit** action for all four generation endpoints and confirm the active plan supports it; if it does not, keep production seeded-only or choose a host that supplies an equivalent control.
- Add and verify an app/host-enforced spend circuit breaker if a true spending ceiling is required. Do not describe an OpenAI project budget alert as that circuit breaker. With the no-database constraint, Vercel's per-region counters plus soft OpenAI budgets cannot establish an exact global dollar ceiling; if an exact ceiling is mandatory, keep public production seeded-only or explicitly approve a small shared durable counter that stores only usage totals, never learner content.
- Keep `WONDERLAB_LIVE_GENERATION_ENABLED` absent or non-`true` until every live release gate passes. This server-only release lock prevents production from contacting OpenAI by default; because Vercel environment changes require a new deployment, it is not an emergency kill switch, distributed rate limiter, or automatic spending ceiling. Pre-stage a WAF **Deny** rule for the four generation POST routes and use that rule or immediate key revocation for emergency shutdown.
- Name the operator who can disable the key, pause the deployment, and perform rollback.
- Confirm that production logging does not record request bodies or full learner text.
- Confirm the application will remain free, signed-out, and unrestricted through August 5, 2026 at 5:00 PM Pacific under the current Official Rules; revalidate this on submission day.
- Complete a final repository, application, and video audit for third-party trademarks, copyrighted media, personal data, private URLs, and other unlicensed material.

If any gate is missing, keep the site local or run a private seeded-only preview. Do not describe it as production-verified.

## 2. Local preflight

Current exact source `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` has both direct-worktree and fresh no-hardlink/no-alternates clean-clone proof for the gates recorded above. The clone completed a 464-package `npm ci`; online/offline audits found 0 vulnerabilities, tracked/client scans passed, diff check passed, and final status was clean. Typecheck generated Next route types before running TypeScript, and ignored `next-env.d.ts` remained untracked after the production build. The four structured GPT-5.6 requests share explicit low-verbosity text defaults while retaining strict output schemas, token limits, and validators. Evidence requires a completed web-search tool call and rejects failed, in-progress, or searching calls. Duration-specific generation is schema-enforced for 5-, 10-, and 15-minute quests, while a storage-only compatibility marker preserves over-limit legacy work. No attestation generator or receipt was created. Seeded fixture/helpers activate only after explicit demo activation, and their late chunk cannot overwrite Clear or live state. The Discovery Card warms on entering/restoring Reflect with a Branch fallback retry; its revision-aware Reflect cue is non-persisted. Independent final education and release reviews found no P0–P3. On July 19, elevated metadata-only Keychain lookup and elevated canonical `agent-key status ELEVENLABS_API_KEY` exit 0 confirmed the login-Keychain item is configured; no `-w`, secret read/print, provider, OpenAI, deployment, capture, media, or publication action occurred. The earlier sandboxed exit-1 status was a false negative. Historical `035e820` retains its exact predecessor proof.

Historical exact source-level checkpoint `15d3d57f2290983a0b6164230c3d44e2ba3e8476` contains predecessor app `ee5b479cf7f5637506ce2b554a1bbe9d25f51572`: `npm ci` added 464 packages and audited 465 with 0 vulnerabilities; format/lint/typecheck, 39/454 tests, 142/142 fixtures, production build, Playwright 24/56, no-key Chromium 1/1 with zero requests, release 82, preservation 23/23, scans 0, and clean diff/final status passed. A standalone `npm audit` was not run after the approval service disconnected. Bundles were 474,773 raw / 118,133 gzip initial across five chunks; Curiosity Map 15,969 / 5,509; Discovery Card 15,005 / 4,870; deferred 30,974 / 10,379. Rendered 320×812 smoke found zero overflow or overlap, outline below toolbar, fitting controls in both directions, centered graphic, compact visible **View outline** named **View text outline**, and zero console errors. Ignored receipt `output/release/current-repo-15d3d57-clean-checkout-attestation.json` is 11,155 bytes with SHA-256 `ead8ccefdf2236b789f4b45d9f44f72666f0dced03215434fc67acd1bc5a83ac`. No provider, Keychain, live-model, deployment, media, or publication action occurred. This later historical documentation record is outside the attested subject. This proof does not authorize deployment, current screenshots/media, a live provider path, or public availability.

The historical application checkpoint `a08b1ee50451c8b5df41da1bea4ad2d79cd49a69` passed format/lint/typecheck, 33 test files / 388 tests, 142/142 fixtures, production build, the full Playwright matrix with 22 passes / 50 deliberate project-scoped skips, dedicated no-key Chromium (1/1), changed-file secret scan 0, and diff check. Its focused complete keyboard-only Spark → Branch journey passed a five-repeat Chromium stress run (5/5), closing the automated Chromium keyboard-only proof gate. The build retained bundle measurements of 470,655 raw / 116,946 gzip across five initial chunks; Curiosity Map 15,195 / 5,412; Discovery Card 15,005 / 4,870; and two deferred chunks 30,200 / 10,282. Exact whole-repository sources `d432c27f9c1518a048c0c1396c8daf9547ccdaf2`, `15d3d57f2290983a0b6164230c3d44e2ba3e8476`, and `4211bbff771597e97ecacd4eb3dbbe33c6472735` retain historical fresh no-hardlink checkout or release-tooling proof; `1980e09` is also a historical direct-worktree predecessor. Current screenshot/media, visual browser inspection, live-model, server-provider, and deployment proof remain open. Historical prior-source checkpoint `269a3f820746c9253a2d1aa897755714ad56d277` retains its desktop 1280/mobile 390 Browser inspection and deterministic source-scope evidence; those results do not transfer to the current application as visual inspection. Historical fresh-checkout/audit-0 checkpoint `e16eb48` and its 8,072-byte receipt remain predecessor evidence. The tracked screenshot receipt `387ddebb63686ed373fdffc7d7cdd1cb7b167a4a` remains historical `aa64be1` evidence. This does not authorize deployment or prove a live provider path.

From the exact candidate checkout:

```bash
git status --short
git rev-parse HEAD
npm run submission:preflight
npm ci
npm run verify
npm run format:check
npm run build
npm run performance:bundle
npm run test:e2e
npm run test:e2e:no-key
```

The default preflight is the local contract check and intentionally leaves seven external/manual gates `PENDING`. After the deployed app, full live evaluation, reviewer repository, final media, YouTube upload, Devpost entry, and `/feedback` session all exist, commit a bounded `config/final-release-evidence.json` as the only post-candidate source change and run:

```bash
npm run submission:preflight -- --release
```

Strict mode is a read-only verifier, not an evidence generator. It requires the evidence file to be tracked and byte-identical to `HEAD`; requires an earlier screenshot source, a later candidate containing only allowlisted screenshot/media/social-image outputs, and a final evidence-only descendant commit; hash-binds ignored live-evaluation, reviewer-audit, narration, capture, and assembly records; decodes the final MP4 and checks its streams, duration, loudness, captions, source hashes, and exact configured voice; and fails if any manual gate remains unverified. Do not hand-author partial receipts or use a limited live-eval run as release proof.

Expected evidence:

- clean status before and after the gate;
- lint and TypeScript pass;
- the candidate's deterministic suite and fixture evaluations pass, with the exact SHA and file/test counts recorded; current checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a` passed 509 serial tests across 44 files and 145/145 fixture evaluations in the main worktree and clean clone. Historical `035e820`, `5ddbac3`, `9d56d24`, `013f77a`, `ee5b479`, and `1980e09` retain predecessor gates. Historical application-safety checkpoint `1195c9d` passed 369 serial tests across 33 files; historical capture/assembly checkpoint `5814a13` passed 359 serial tests across 31 files, while the tracked proof board records exact historical application/screenshot checkpoint `dac76a2` with 356 tests across the same 31 files;
- typecheck runs `next typegen` before `tsc --noEmit`; generated route types pass and ignored `next-env.d.ts` remains absent from the tracked post-build diff;
- request-contract tests prove all four GPT-5.6 structured calls set `text.verbosity: "low"` without weakening schemas, `max_output_tokens`, or validators. Evidence requires a `web_search_call` whose status is `completed`; `failed`, `in_progress`, and `searching` states produce `CITATIONS_UNAVAILABLE` and fail closed after the bounded retry;
- production build contains `/` plus `/api/routes`, `/api/quest`, `/api/evidence`, and `/api/reflect`;
- the browser suite reports 28 passes with 68 deliberate project-scoped skips, including desktop/mobile responsive-map defaults, explicit view choice, centered mobile graphic, forced-colors, the focused keyboard-only journey, restored-map focus recovery, Reflect card preloading, and late-demo cancellation. These deterministic browser checks are not live-model or server-provider proof;
- streamed-body tests prove the shared route deadline, 64 KiB cancellation boundary, stable `413`, and split UTF-8 handling;
- fixed-lifetime browser-storage tests cover open-page/next-load expiry, invalid/future/legacy record removal, and the separate safety identifier;
- learner-agency tests redirect submit-ready assignment completion while preserving inquiry and scaffolding;
- Markdown export tests escape raw HTML/active Markdown, normalize source destinations, and omit private internals;
- production-mode `/` and `/api/routes` return CSP, Permissions-Policy, Referrer-Policy, `nosniff`, and frame-denial headers, and the app remains interactive under CSP;
- `.next/static` contains no `OPENAI_API_KEY`, key-shaped token, OpenAI SDK import, or server-only marker.
- the generation-guard regression rejects fresh over-limit session IDs before paid work without unbounded rejected-identifier growth; the exact application-checkpoint 20,000-identifier PoC records zero post-limit callbacks, bounded retained bytes, and both growth flags false;
- cross-field safety tests block pressure-vessel instructions split across fields while safe negated and virtual controls remain allowed; Evidence Decision tests require what the selected sources establish, exactly where their scope stops, and the relationship impact. They prove the complete ordered linked source list beside the fields and enforce the same-source Evidence → design transfer through storage, API/moderation, runtime checks, evaluations, map, Discovery Card, and export while clearing stale links/self-checks when evidence changes;
- final-screen tests prove the compact **At a glance** summary of Before, Now, selected finding and exact sources, and **My evidence judgment**—supports, challenges, or complicates; why it mattered; and the source boundary—followed by design move and selected next question; native **Full learning trace** disclosure retains the complete journey, learner reflection, and AI response while the facilitator prompt and export controls remain immediately visible. On the first Branch selection at widths up to 930px, the named Discovery Card region receives focus and remains visible through deferred loading; desktop and subsequent user selections retain radio focus, while restored/already-selected paths do not auto-focus the card. The status announces **Card unlocked. Map updated.**;
- source-scope output uses **Source-scope boundary** in the card, **What the cited sources do not settle (source scope)** in Markdown, and the intentionally shortened **Complicates** map prefix so the complete boundary fits. Source links include scroll margin so reverse keyboard traversal keeps the focus target visible;
- external demo capture rejects URLs containing credentials, query parameters, or fragments without reflecting them, and accepts only the fixed contained Discovery Card download filename.
- local narration tooling vendors its request in tracked code, rejects symlink escapes, validates all timings against MP3 duration, and gates paid generation on an exact clean capture plus a capture-approved voice. At `b386343`, paid-generation plus official CLI short-lived preview/catalog-approval/user-selected-approval artifact I/O is inode-anchored, with public identity checks before the attempt receipt, immediately before the POST, and after publication. Current `acfdc37` additionally binds the CLI to exact narration config SHA-256 `2107bc56c2b4b1bb6e0a1357cb9b90df566fd8a67c328fd65336ef73c04a3f82` and exact voice `OZxMHsGaBmV5pjMIDIn0`, and wraps exact-ID GET plus paid POST in final credential/config/HEAD/capture rechecks. Provider-free races prove fail-closed zero-call/zero-POST behavior. The owner-selected and owner-described female speaker path is `user_selected_tts_only`, without provider-verified catalog metadata, name, gender, category, provider preview, or listening approval. Historical George preview/approval evidence does not transfer. At clean source `10a058e`, exactly one paid full TTS POST succeeded with no probe or retry, yielding a fully decoded 138.437370-second MP3 and an approval-digest-bound attempt receipt; this does not establish owner/human approval for public release. On July 19, 2026, metadata-only lookup confirmed the Keychain item is configured; no `-w`, secret read/print, or provider call occurred. No second paid call or other new provider call was made for current application checkpoint `acfdc37`. A current public narration still requires this order: final public name and frozen judge script; a committed versioned/newly timed/human-reviewed SRT that preserves the historical SRT; screenshots and media receipt; final-flow capture; capture-bound exact-voice approval; then fresh paid-narration authorization where required. Catalog output and persisted receipts are allowlisted and exclude the key and provider-private account fields.

Current automated forced-colors, reduced-motion, responsive-overflow, and semantic-role/name checks are green. Historical checkpoint `a08b1ee` closed the complete automated Chromium keyboard-only Spark → Branch journey with its 5/5 stress pass; current `acfdc37` passed the authoritative serial 28/68 matrix. Before release, manually review keyboard-only operation and focus visibility through Spark → Branch, true browser 200% zoom/reflow, real VoiceOver/NVDA/JAWS behavior, and physical/manual Safari. Preserve the results with the exact deployed SHA.

Run limited live evaluations only after the key is stored in ignored local environment state and the application server is running. Use two terminals for a local run.

Terminal A:

```bash
npm run dev
```

Terminal B:

```bash
WONDERLAB_EVAL_LIMIT=2 npm run evals:live
```

To evaluate an authorized preview instead, target its immutable URL explicitly:

```bash
WONDERLAB_EVAL_BASE_URL=https://<immutable-preview-url> WONDERLAB_EVAL_LIMIT=2 npm run evals:live
```

After the recommended two-topic check passes, an authorized broader run may increase `WONDERLAB_EVAL_LIMIT` or omit it to evaluate all fixtures. A skipped live evaluation is not a pass.

Every completed invocation writes an allowlisted report under `output/evals/live-eval-<UTC-timestamp>.json`. Preserve the exact path and review it before sharing. A no-key invocation may validly prove the report/error path and secret allowlist, but it is still a failed or skipped credentialed evaluation—not evidence of GPT-5.6 or web-search behavior. A credentialed pass requires successful stage outputs, source associations, map checks, and manual review of the returned evidence.

## 3. Create and link the Vercel project

After explicit authorization, either import the approved private repository in the Vercel dashboard or use Vercel CLI **54.17.2 or later** from the repository root. Confirm the installed version before relying on deployment dry runs:

```bash
vercel --version
```

Then link the project:

```bash
vercel link
```

Confirm that Vercel detects Next.js and the repository root. Keep the Vercel project private to the authorized team. Do not enable any option that exposes repository source publicly.

Before uploading, Vercel CLI 54.17.2 or later can inspect the deployment manifest without creating a deployment:

```bash
vercel deploy --dry
```

Review included files, largest files, framework detection, and ignored paths. `.env.local`, `.env`, concept exports, test artifacts, and unrelated files must not appear.

## 4. Configure environment variables

Use Vercel Project Settings → Environment Variables or its equivalent encrypted secret UI. Do not put the key on a command line, in shell history, source, a screenshot, or a checked-in file.

| Variable                               | Preview                                                                        | Production                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `OPENAI_API_KEY`                       | Separate restricted key, or omit for seeded                                    | Dedicated project-scoped server secret                                |
| `OPENAI_MODEL`                         | `gpt-5.6`                                                                      | `gpt-5.6`                                                             |
| `NEXT_PUBLIC_APP_URL`                  | Exact preview URL when stable                                                  | Exact signed-out production URL                                       |
| `WONDERLAB_ALLOW_SEEDED_FALLBACK`      | `true`                                                                         | `true`                                                                |
| `WONDERLAB_LIVE_GENERATION_ENABLED`    | `false` until live gates pass; then exact `true`                               | `false` until live gates pass; then exact `true`                      |
| `WONDERLAB_LIVE_GENERATION_EXPIRES_AT` | Empty while seeded-only; then a future UTC timestamp no more than 30 days away | Future UTC timestamp shortly after judging, no more than 30 days away |
| `WONDERLAB_LIVE_RELEASE_SHA`           | Full approved 40-character preview SHA when live                               | Full approved 40-character production SHA                             |

`OPENAI_API_KEY` and all `WONDERLAB_LIVE_*` variables must never use a `NEXT_PUBLIC_` prefix. Variables with that prefix are browser-visible by design and require a rebuild when changed. In production, a configured key is intentionally insufficient by itself: the server refuses every OpenAI call unless the enabled flag is exactly `true`, `OPENAI_MODEL` resolves exactly to `gpt-5.6`, the UTC expiry is still in the future and no more than 30 days away, and—on Vercel—the approved full SHA matches `VERCEL_GIT_COMMIT_SHA`. Enable Vercel system environment variables so that source binding is available. The SDK pins `https://api.openai.com/v1`, disables transport retries and logging, and requests the default service tier.

In live mode, the application sends the relevant question, route, prediction, artifact, reflection, and prior-stage context through the server to OpenAI. The random `safety_identifier` is stored separately in the browser and forwarded with live requests for abuse-safety continuity; it must never encode identity. Confirm the configured OpenAI project's data-handling terms before enabling the key. The seeded path remains available without a key.

After changing an environment variable, create a new deployment. Do not print secret values while troubleshooting.

### No-database host control profile

Before enabling the release lock, configure and record a Vercel production WAF rule for `POST ^/api/(routes|quest|evidence|reflect)$`. Start with 12 requests per 10 minutes per source, return `429`, and use a 10-minute persistent action when the active plan supports it. Four requests complete one normal quest, so this baseline permits three complete quests per source in ten minutes. Prefer an IP-plus-JA4 counting key when available; never trust the browser-supplied safety identifier as the distributed key because it is rotatable.

Pre-stage a second rule for the same method/path set that can be switched from **Log** to **Deny**. This is the fast emergency stop that leaves `/` and the seeded demo online; key revocation is the provider-side stop. Verify both behaviors without paid provider work before enabling live mode. Vercel documents rate-limit counters as per-region, so neither rule proves an exact global spend cap.

In the dedicated OpenAI project, permit only the required Responses and Moderations operations, allow only GPT-5.6, set the lowest practical model rate limits, configure a small initial soft monthly budget plus multiple alert thresholds, and name the alert/key-rotation owner. Record actual usage after the two canonical live runs. OpenAI project budgets remain monitoring thresholds and do not halt requests.

## 5. Create and verify a preview

This command uploads code and therefore requires explicit authorization:

```bash
vercel deploy --logs
```

Record the immutable preview URL and deployment ID, then verify in a signed-out browser:

1. Landing copy, 13+ notice, AI/source disclosure, seeded provenance, `3–300 characters · no personal info` input guidance, and the “up to 24 hours” browser-retention disclosure are visible.
2. The seeded canonical journey completes once at desktop and mobile widths.
3. With a configured preview key, the canonical live journey completes twice.
4. Every live Evidence item has a returned source link; open each link and confirm the claim/source association manually.
5. Prediction remains locked before evidence, creation self-review is required, all three reflection fields survive, and the map plus normalized/escaped Markdown export match the current run without internal identifiers.
6. Session and draft envelopes retain one fixed first-save timestamp, disappear at 24 hours while open or on the next load, and are removed by Clear; the separate safety identifier survives Clear until site data is cleared.
7. A submit-ready assignment request is redirected into learner-owned inquiry while ordinary topic questions, explanation, planning, outlining, and critique remain usable.
8. A controlled oversized streamed body receives the stable `413` within the shared route deadline without waiting for the sender to finish; do not use learner data for this check.
9. Forced timeout, retry, Clear session, and seeded recovery preserve or remove state as intended.
10. Browser Network and Sources inspection exposes no key, authorization header, hidden prompt, server stack, or server-only module; confirm only the documented live entries and random safety identifier cross the OpenAI boundary.
11. `/` and representative API responses include the expected CSP, Permissions-Policy, Referrer-Policy, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`; the production CSP excludes `unsafe-eval`, and normal interaction still works.
12. Function logs contain status/latency metadata only—not learner question, prediction, artifact, reflection, prompt, response, or API key.
13. Controlled tests confirm that the distributed rate limit and emergency deny path reject over-limit requests without affecting an unrelated learner session. If an explicitly approved shared durable usage counter is added, verify its hard-cap behavior separately. Confirm that soft OpenAI project budget thresholds, alerts, and recipients are configured; do not incur spend merely to trigger an alert.
14. No browser console error, framework overlay, broken layout, or horizontal overflow appears.

If the preview fails any item, do not promote it. Fix locally, create a new checkpoint, and repeat the clean-clone gate.

## 6. Production promotion

Only after preview sign-off and explicit owner approval, create a production-scoped candidate without assigning the production domain:

```bash
vercel deploy --prod --skip-domain --logs
```

Record its immutable deployment URL and repeat the signed-out landing, seeded journey, canonical live journey, citation, retention, learner-agency, request-size, export, security-header, secret-boundary, log-redaction, desktop/mobile, rate-limit, emergency-deny, and any explicitly approved durable-usage-cap checks against that exact candidate. If it passes, promote that verified deployment rather than creating another build:

```bash
vercel promote <verified-production-candidate-id-or-url>
```

Immediately repeat the highest-risk signed-out health, secret, citation, log-redaction, and live-flow checks against the production domain. Record the exact commit SHA, deployment ID, production URL, check time, operator, and result in [submission-checklist.md](submission-checklist.md).

Do not place the production URL into README, Devpost, or the video description until it works signed out and the checklist evidence is recorded.

## 7. Rollback and key containment

Before promotion, confirm the Vercel plan and record an eligible last known-good production deployment. Hobby can roll back only to the immediately previous production deployment; Pro and Enterprise can target an eligible earlier production deployment by URL. If the available plan cannot reach the recorded target, do not promote.

If production shows a secret exposure, learner-content logging, unsafe activity, broken live flow, bad citations, runaway spend, or a release-blocking UI defect:

1. Disable or rotate the OpenAI project key if compromise or uncontrolled spend is possible.
2. Use the rollback command supported by the active plan.

   Hobby, to the immediately previous production deployment:

   ```bash
   vercel rollback
   ```

   Pro or Enterprise, to a recorded eligible production deployment:

   ```bash
   vercel rollback <known-good-deployment-id-or-url>
   ```

3. Run `vercel rollback status`, then confirm the production domain serves the expected known-good deployment.
4. Re-run the signed-out health, secret, log, seeded, and live checks that apply.
5. Record the incident, rollback deployment ID, key action, and verification result. Do not silently redeploy the failed build.

If no known-good live deployment exists, take the live deployment offline rather than falling back to an unverified public state.

## 8. Required release record

Before submission, preserve:

- final Git commit SHA;
- private repository URL and verified access for `testing@devpost.com` and `build-week-event@openai.com`;
- clean reviewer-facing history with the removed unverified JPEG blobs excluded;
- `docs/route-art-provenance.json`, trusted source-credential validation, and derivative hashes;
- resolution of the direct ReasonWeave software-name collision or a distinct re-screened replacement, followed by broader trademark/domain/handle clearance;
- final repository/application/video IP audit result;
- Vercel project and deployment IDs;
- signed-out production URL;
- environment-variable names and scopes, never values;
- OpenAI project name, budget/alert confirmation, and key-rotation owner;
- distributed rate-limit test result;
- emergency-deny result and, if implemented, the explicitly approved shared durable usage-cap result;
- live-evaluation result plus the exact allowlisted JSON report path/hash; label a no-key failure report as report-pipeline evidence only;
- two canonical live-flow results and one seeded-flow result;
- manually opened citation URLs and reviewer notes;
- client-bundle/network secret scan result;
- 24-hour session/draft retention and separate safety-identifier verification;
- 64 KiB streamed-body/deadline verification;
- learner-agency redirect and allowed-scaffolding verification;
- normalized/escaped Markdown export verification;
- deployed security-header and CSP-interactivity verification;
- production log-redaction result;
- rollback target and rollback operator;
- public YouTube URL, Devpost URL, and primary Codex `/feedback` session ID;
- availability owner and confirmation that the free signed-out app will remain online through August 5, 2026 at 5:00 PM Pacific, as revalidated on submission day;
- archived copy of the exact submitted fields, links, images, repository state, and video;
- confirmation that submitted fields/media will not change after the deadline except for a narrow organizer-permitted IP, PII, or inappropriate-material correction.

Until those artifacts exist, deployment and submission remain unverified.
