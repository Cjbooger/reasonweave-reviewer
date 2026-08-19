# Public-name migration runbook

This runbook coordinates a release-name change without rewriting WonderLab's historical proof or stable internal protocols. It is intentionally a migration, not a global search-and-replace.

The current public name, **ReasonWeave**, has a direct existing public-software collision. On July 19, 2026, the owner explicitly adopted ReasonWeave for this submission despite that documented risk. **CurioTrellis** remains an unadopted alternative that passed a July 18 practical knockout screen and July 19 time-sensitive recheck; neither name is legally cleared or guaranteed available. The exact compact USPTO Wordmark query returned no result, while broader `CURIO` and `TRELLIS` component results remain crowded; registry and search absence must not be treated as clearance. The `${PUBLIC_NAME}` and `${PUBLIC_SLUG}` placeholders below remain reusable migration templates, while the active values are `ReasonWeave` and `reasonweave`.

**Current checkpoint note:** `0bd5aef89ab4715477491b462c13be0c5978ac6b` / `4d6162e7a7632bba96f582818f44d98bbff956a0` is direct clean committed-worktree proof only. It introduced a versioned session migration and strict evidence-to-creation continuity anchor; no fresh provider, OpenAI, media, deployment, repository-sharing, or publication action occurred, and no Keychain secret was read.

`config/release-identity.json` is the source of truth for the owner-adopted release display name and canonical slug. Its current `ReasonWeave` value records the submission choice, not legal clearance. Release tooling records that file's path, SHA-256, display name, and slug in current screenshot, media, narration, and assembly evidence; do not hand-edit those records to simulate a rename.

## 1. Pre-migration decision gate

Do not begin the source migration until all of these are true:

- [x] The owner explicitly adopts `ReasonWeave` and `reasonweave` for this submission.
- [ ] The exact name is re-screened immediately before adoption because search, package, domain, app-store, and handle availability can change.
- [ ] The owner understands that this practical screen is not legal or trademark clearance.
- [ ] The checkout is clean and the starting commit is recorded.
- [ ] Publication, deployment, repository sharing, YouTube upload, and Devpost submission remain separately authorized external actions.

### Before current release evidence or a provider request

These are later gates, reached after the source migration; they are not prerequisites to making the first identity change:

- [ ] `config/release-identity.json` has been updated and committed in the clean source migration so `displayName` is `${PUBLIC_NAME}`, `slug` is the canonical `${PUBLIC_SLUG}`, and prior public names are retained only in `retiredDisplayNames` where appropriate.
- [ ] The deterministic source gate passes from that committed identity, and the checkout is clean.
- [ ] The final public narration script is frozen in the versioned SRT.
- [ ] `npm run media:render` accepts the strict caption and image contract and publishes the matching release-media receipt before any credentialed narration command runs.
- [ ] If the frozen narration changes, the owner explicitly authorizes one fresh paid ElevenLabs generation with exact voice ID `OZxMHsGaBmV5pjMIDIn0`.

The selected voice ID is already bound to the immutable historical narration at source `10a058e`. That existing audio says “ReasonWeave” and cannot be presented as current after a rename. Preserve it as historical evidence; do not overwrite it, splice it into renamed narration, or retry a failed provider call automatically.

## 2. Rename boundary

### Change current-facing product identity

Update every current user-, model-, reviewer-, or submission-facing name as one coordinated change:

| Surface                      | Required migration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package and release identity | Update `config/release-identity.json` first: it accepts only the canonical display name, derived lowercase slug, and distinct retired display names. Then change `name` in `package.json` and the matching root package identity in `package-lock.json` to `${PUBLIC_SLUG}`. Update current product naming in `LICENSE` and `THIRD_PARTY_NOTICES.md`; keep `private: true`.                                                                                                                                                                                                                                                                         |
| Page metadata                | Update `app/layout.tsx`: title, application name, descriptions, Open Graph/Twitter text, image path, and alt text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| App entry and visible UI     | Update `app/page.tsx`, `components/app-header.tsx`, the exported app component name if useful, and all visible strings in `components/wonderlab-app.tsx`, `components/curiosity-map.tsx`, and `components/discovery-card.tsx`. The component filename may stay stable unless renaming it improves clarity without widening risk.                                                                                                                                                                                                                                                                                                                    |
| Learner export               | Rename the download to `${PUBLIC_SLUG}-learning-trace.md`; update the heading, response label, footer, and fixed brand copy in `lib/export-markdown.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Runtime and safety copy      | Update current-facing errors, safety notices, learner-agency copy, and generated-response labels across `lib/`, including OpenAI request errors and moderation/reflection messages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Model instructions           | Update brand text in `lib/openai/prompts.ts` and its imports/tests. A symbol rename is optional; the prompt received by the model must use `${PUBLIC_NAME}`. Preserve structured-output schema identifiers described below.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Capture and media tooling    | Update current visible markers, expected export filename, render text, public social-image name, default new output directory, and current error copy in `scripts/capture-inputs.mjs`, `scripts/capture-seeded-demo.mjs`, `scripts/render-release-media.mjs`, and related assembly/reviewer scripts. Current release paths and visible render text derive from `config/release-identity.json`; do not duplicate a new name in a command or receipt. The renderer has no historical write default. Paid/current narration requires receipt-bound versioned media, and final assembly requires it unless the explicit historical-only escape is used. |
| Tests and evaluations        | Update assertions that intentionally inspect current-facing copy or filenames. Preserve fixtures whose old names are protocol, compatibility, provenance, or historical-test data. Add the normalized new name to the unsupported-efficacy guards in `lib/safety.ts` and `evals/validators.ts` while retaining both `reasonweave` and `wonderlab`; otherwise a branded unsupported claim could evade the guard.                                                                                                                                                                                                                                     |
| Judge-facing documents       | Update current product descriptions, headings, image alt text, demo narration, Devpost draft, deployment guide, and submission checklist. Clearly label every retained ReasonWeave reference as historical. Treat dated entries in `docs/codex-contributions.md` and old snapshot sections in `docs/media/README.md` and `docs/screenshots/README.md` as append-only evidence: add a new migration/current section instead of rewriting history.                                                                                                                                                                                                    |

At minimum, inventory current-facing occurrences in these tracked areas before editing:

```text
README.md
app/
components/
lib/
evals/
e2e/
tests/
scripts/
docs/
package.json
package-lock.json
```

### Preserve exact stable and historical identifiers

Do **not** rename these merely because they contain `wonderlab` or `reasonweave`:

- `wonderlab_hackathon_pack/` and its original build-prompt filenames.
- `WONDERLAB_*` environment variables, including live-release, evaluation, capture, and artifact-source controls.
- Browser compatibility keys such as `wonderlab.session.v4`, `wonderlab.drafts.v4`, `wonderlab.safety-id.v1`, and their legacy migration keys.
- Structured-output and persisted protocol identifiers such as `wonderlab_quest`, `wonderlab_routes`, `wonderlab_evidence`, `wonderlab_reflection`, and `wonderlab-live-evaluation`.
- The capture ownership marker `.wonderlab-demo-output.json` and owner value `wonderlab-seeded-demo-v1`.
- CSS hooks, private test hooks, TypeScript type names, and fixture identifiers when they are implementation-only and changing them adds risk without changing public identity.
- Original route-art filenames ending in `-wonderlab.webp`, their provenance records, and their recorded hashes.
- Exact historical commit hashes, receipt hashes, archive filenames, output paths, captions, screenshots, and media paths.
- Ignored provider artifacts under `output/playwright/reasonweave-demo-10a058e/` and the historical assembled candidate under `output/playwright/reasonweave-demo-5814a13/`.
- Historical repository-release and screenshot receipts whose hashes bind the old filenames or contents.

The immutable and historical tracked-file baseline is [public-name-preservation-baseline.sha256](public-name-preservation-baseline.sha256). Current release outputs are excluded: in particular, `public/${PUBLIC_SLUG}-og.png` is regenerated as current-facing metadata and is governed by the active versioned release-media receipt, which must bind it byte-for-byte to that release's thumbnail. Verify the preservation baseline before and after the migration:

```bash
shasum -a 256 -c docs/public-name-preservation-baseline.sha256
```

Never edit a hash-bound historical artifact and continue citing its old digest. A replaced current artifact gets a new path, source commit, receipt, and digest; the old artifact remains historical.

## 3. Source migration

1. Record the clean starting SHA. Update `config/release-identity.json` as the first current-release identity change, then create a dedicated product-name commit.
2. Verify the preservation baseline, then make the current-facing changes above without touching generated or historical proof.
3. Use an explicit allowlist for retained old-brand occurrences. Each retained `ReasonWeave` occurrence must be one of:
   - a clearly labeled historical statement;
   - an exact historical file/path/archive name;
   - a compatibility or adversarial-test fixture that deliberately covers the old name.
4. Re-run the old-name inventory after the edits. Investigate every unallowlisted match; do not rely on a count alone.
5. Commit the source migration before generating screenshots, captures, narration, or reviewer archives. The clean commit is the identity bound into all later receipts.

Suggested stale-brand inventory:

```bash
rg -n -i 'reasonweave|wonderlab' \
  README.md app components lib evals e2e tests scripts docs \
  package.json package-lock.json
```

The scan is a review queue, not a zero-match requirement. `wonderlab` protocol and provenance matches are expected. Current-facing `ReasonWeave` matches are not.

## 4. Deterministic source gate

Run these from the clean renamed source commit, in order:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run evals:fixtures
npm run build
npm run performance:bundle
npm run test:e2e
npm run test:e2e:no-key
npx playwright test e2e/seeded-flow.spec.ts --project=chromium \
  --grep 'the complete seeded quest is keyboard-operable from Spark through the final learning trace' \
  --repeat-each=5
git diff --check
```

Also repeat the tracked-file secret, private-path, email/PII, and unexpected-URL scans used by the release checklist. Treat a changed test count, fixture count, browser matrix, bundle size, or output filename as new evidence; do not copy old proof numbers forward.

## 5. Regenerate current release evidence

Use a fresh `${PUBLIC_SLUG}`-namespaced output directory. Do not reuse or replace a historical ReasonWeave directory.

1. Confirm that the clean product-name source commit retains the already implemented, tested brand-stable contracts for every release-artifact path:

   - `WONDERLAB_SCREENSHOT_OUTPUT`: a new real `docs/screenshots/${PUBLIC_SLUG}-<release-id>` child directory matching the canonical config slug.
   - `WONDERLAB_RELEASE_MEDIA_DIR`: a new real `docs/media/${PUBLIC_SLUG}-<release-id>` child directory matching that same slug. The renderer, paid narrator, and final assembler use its current proof board, SRT, thumbnail, badge, and closing card.
   - `WONDERLAB_RELEASE_SCREENSHOT`: exactly `docs/screenshots/${PUBLIC_SLUG}-<release-id>/discovery-desktop.jpg` for the matching release directory.
   - `WONDERLAB_PUBLIC_OG_OUTPUT`: exactly `public/${PUBLIC_SLUG}-og.png` for the canonical config slug.

   Screenshot capture requires a clean source, reserves exactly eight fixed files, writes only through verified inodes, and publishes a SHA/source/identity-bound receipt after final integrity checks. Rendering requires all three release variables, validates the complete matching screenshot receipt and eight hashes, requires the proof-board SVG and SRT to contain the canonical display name and no retired display name, then publishes `release-media-receipt.json` last. That media receipt binds the identity record, screenshot evidence, all source/rendered media hashes, and the exact public OG path/hash. Each contract rejects base directories, traversal, symlinks, historical targets, identity drift, and an existing non-owned destination. Do not generate release evidence until this code and its safe-path/rejection tests are committed, the deterministic source gate passes, and the checkout is clean.

2. Choose a stable `<release-id>` such as the release date; do not put the not-yet-known commit SHA into tracked path names. Create the new current `technical-proof-board.svg` and `seeded-demo-rehearsal.srt` inside `docs/media/${PUBLIC_SLUG}-<release-id>/`. Do not copy the old brand or old proof counts forward. Inspect the SRT and confirm that it says `${PUBLIC_NAME}`, explains Codex and GPT-5.6 accurately, and contains no unsupported live-model or deployment claim. The shared provider-free contract requires at least 20 sequential cues, a first start of `00:00:00,000`, contiguous cues, 1.5–7 second cue durations, no more than two lines or 42 characters per line, no more than 185 words per minute, and an exact final end of `00:02:54,000`. Commit only these release inputs and their documentation, run the applicable source checks, and require a clean checkout. Record this release-input SHA.

3. From the clean release-input SHA, regenerate all eight current implementation screenshots into the new/versioned directory, create a receipt bound to that SHA, and inspect desktop/mobile, focused card, and text-outline states:

   ```bash
   WONDERLAB_CAPTURE_SCREENSHOTS=true \
   WONDERLAB_SCREENSHOT_OUTPUT=docs/screenshots/${PUBLIC_SLUG}-<release-id> \
     npx playwright test e2e/seeded-flow.spec.ts --project=chromium \
       --grep 'the complete seeded quest preserves the learning gate and exports a nine-node trace'
   ```

   The historical JPGs bound to `aa64be1` / `387ddeb` must remain byte-identical. Commit only the new screenshot artifacts, receipt, and truthful documentation; require a clean checkout and record the screenshot-artifact SHA.

4. From the clean screenshot-artifact SHA, render and inspect the current release visuals from the new screenshot and committed media source:

   ```bash
   WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
   WONDERLAB_RELEASE_SCREENSHOT=docs/screenshots/${PUBLIC_SLUG}-<release-id>/discovery-desktop.jpg \
   WONDERLAB_PUBLIC_OG_OUTPUT=public/${PUBLIC_SLUG}-og.png \
     npm run media:render
   ```

   Before rendering or publishing a receipt, `media:render` applies the same strict SRT contract used by narration and assembly. It then creates the current proof-board PNG, YouTube thumbnail, seeded-demo badge, closing card, social preview, and receipt without overwriting historical files, and verifies the proof board is exactly 1600 × 900 and the closing card is exactly 1280 × 720 before publication. Confirm that `release-media-receipt.json` records the canonical identity, matching screenshot evidence, ordered media hashes, and exact public OG hash; then verify that app metadata points to the new social-image path. The historical `seeded-demo-badge.png` and `favicon.svg` are brand-neutral and may remain in place only if visual inspection confirms they remain appropriate and their baseline hashes are unchanged. Commit only the new rendered media, receipt, and truthful documentation; require a clean checkout and record the media-artifact SHA.

5. Use the clean media-artifact SHA in every capture, approval, narration, and assembly command below. Capture the final seeded flow into a fresh directory:

   ```bash
   WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
     npm run demo:capture
   ```

   Confirm the capture contains the final evidence-decision headings, exact source-scope boundary, same-finding Evidence → design transfer, selected next question, current export filename, current brand, and no stale generated cards.

6. Reconfirm that the narration text derived from the committed frozen SRT exactly matches the owner-reviewed script.

7. After the owner has authorized the exact selected-voice verification and frozen script, confirm the Keychain entry without retrieving its value. Bind the selected voice to this exact fresh capture:

   ```bash
   agent-key status ELEVENLABS_API_KEY
   WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
     npm run demo:voices -- \
       --approve-user-selected-voice OZxMHsGaBmV5pjMIDIn0 \
       --confirm-user-selected-voice
   ```

   This writes the capture-bound `user_selected_tts_only` approval after a credentialed exact-ID verification GET. It does not claim catalog metadata, a provider preview, or listening approval.

8. Run a provider-free narration dry run against the new SRT. The narrator revalidates the receipt-bound SRT, proof board, and closing card through the same strict contract before credential access, dry-run output, or the provider path. A paid or credentialed narration request requires the versioned release directory and its valid `release-media-receipt.json`; it cannot fall back to historical media:

   ```bash
   WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
   WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
     npm run demo:narrate -- --voice-id OZxMHsGaBmV5pjMIDIn0
   ```

9. Only after the dry run matches the approved frozen script, allow at most one paid TTS POST through the Keychain wrapper already enforced by the project:

   ```bash
   WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
   WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
     npm run demo:narrate -- --voice-id OZxMHsGaBmV5pjMIDIn0 --generate
   ```

   This uses `eleven_multilingual_v2`, `mp3_44100_128`, and the with-timestamps endpoint. The official path may make another credentialed exact-ID verification GET immediately before the paid POST; record the approval GET, pre-POST GET, and paid POST separately. Never expose the key in an argument, log, browser bundle, or repository file. On any provider error, preserve the non-sensitive attempt receipt, report only the status/classification, and stop. Do not retry automatically.

   The published attempt must repeat the exact canonical `releaseNarration` record from `config/release-narration.json`, including its config path and hash, provider, voice ID, and verification mode. Final assembly rejects a missing, altered, extended, or legacy record before probing the MP3; never retrofit that record into an older receipt.

10. Assemble from the same exact capture, current media directory, receipt, and narration. Final assembly requires the versioned receipt-bound directory by default:

```bash
WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
WONDERLAB_NARRATION_PROVIDER=elevenlabs \
  npm run demo:assemble
```

`WONDERLAB_ASSEMBLE_ALLOW_HISTORICAL_MEDIA=true` is the only escape to assemble with the immutable historical `docs/media/` root. It is for historical-only reproducibility, cannot be combined with `WONDERLAB_RELEASE_MEDIA_DIR`, and is never a release path.

11. Verify the final MP4 with full decode, duration, dimensions, codecs, audio loudness/peak, burned and embedded captions, caption line length/WPM, source and artifact hashes, and a frame-by-frame visual review. A human must listen to the whole narration and explicitly approve it for public release.

12. Refresh the sanitized reviewer package from the exact final clean source. Exclude keys, `.env` files, ignored provider artifacts, historical unverified route-art blobs, private paths, loopback URLs, and large generated binaries unless the package contract explicitly requires them.

## 6. Final clean-checkout proof

After all tracked source, documentation, screenshots, and release images are committed:

1. Clone the exact final SHA into a fresh temporary directory.
2. Run `npm ci`, then run the complete deterministic source gate again.
3. Run `npm audit --audit-level=high` and the full tracked/client credential scans.
4. Verify the capture/media/reviewer receipts against their recorded source commits and hashes, then verify `docs/public-name-preservation-baseline.sha256` again.
5. Require a clean final status and record a new attestation. Do not reuse `7d01c9b` or any earlier receipt as proof of the renamed release.

## 7. Acceptance matrix

| Requirement             | Pass condition                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current public identity | UI, metadata, model prompts, learner export, current errors, screenshots, media, README, demo script, and Devpost draft use `${PUBLIC_NAME}`.                                                                                                                                                                                                        |
| Historical integrity    | Old names appear only in clearly labeled historical/provenance or compatibility contexts; recorded artifacts and hashes are unchanged.                                                                                                                                                                                                               |
| Stable protocols        | `WONDERLAB_*`, `wonderlab.*`, `wonderlab_*`, capture ownership, schema, and route-art provenance identifiers still work without migration or data loss.                                                                                                                                                                                              |
| Output segregation      | Every current screenshot, media directory, social image, receipt, narration, video, and reviewer archive is bound to the canonical identity record and its slug; no historical path is overwritten.                                                                                                                                                  |
| Voice                   | Exact voice ID is `OZxMHsGaBmV5pjMIDIn0`; capture-bound approval and pre-POST verification GETs are recorded separately; paid narration is bound to the current media receipt and final source. There is at most one successful paid TTS POST per approved frozen script, with valid timestamps, full decode, and explicit human listening approval. |
| Product proof           | Format, lint, types, unit/integration tests, ten-topic fixtures, build, bundle budgets, both browser matrices, and clean-checkout proof pass on the renamed final source.                                                                                                                                                                            |
| Accessibility           | Keyboard flow, visible focus, reduced motion, forced colors, true browser 200% zoom/reflow, physical/manual Safari, and assistive-technology checks are honestly recorded.                                                                                                                                                                           |
| Safety and privacy      | No secret, private path, personal notification, learner data, internal URL, or unsupported outcome/live/deployment claim appears in tracked source or public media.                                                                                                                                                                                  |
| External release        | Deployment, reviewer access, signed-out app/video/repository checks, YouTube, Devpost, and `/feedback` are completed only with their separate owner authorizations.                                                                                                                                                                                  |

## 8. Stop conditions

Stop and report rather than improvising if:

- the final name develops a direct collision or the owner has not adopted it;
- the checkout is dirty at capture or paid-generation time;
- the narration script changes after approval;
- a stale current-facing `ReasonWeave` match cannot be classified safely;
- any provider request fails or its output cannot be fully validated;
- a receipt, hash, source SHA, or capture directory does not agree;
- a secret, private path, PII item, unsupported claim, or unexpected external URL is found;
- the public video reaches three minutes or more after platform processing;
- final links cannot be verified signed out.

## 9. Commit and release order

1. Product-name and tested path-parameterization source migration commit.
2. Deterministic verification record.
3. Frozen proof-board SVG/SRT release-input commit.
4. Screenshot artifact/receipt commit generated from the clean release-input SHA.
5. Rendered-media artifact/receipt commit generated from the clean screenshot SHA.
6. Clean seeded capture from the exact media-artifact SHA.
7. At most one explicitly authorized paid narration generation for the frozen script.
8. Assembly, full technical media validation, and human listening approval.
9. Current judge-facing docs and reviewer-package commit.
10. Fresh clean-checkout proof and final receipt.
11. Separately authorized deployment, reviewer sharing, public upload, Devpost entry, `/feedback`, and submission.

If step 7 succeeds and a later step fails, keep the anchored provider artifacts and repair only the downstream step. Reuse the verified audio only when the canonical `releaseNarration` record, derived narration text, release-media receipt, and their hashes remain exact and current tooling accepts the attempt. The tooling accepts only fingerprinted, exact repair transitions: the original five-file assembly-timeline repair, or that same repair plus this runbook and the preservation-baseline scope correction; partial or additional changes fail closed. When assembly uses those unchanged artifacts from a different owned capture directory, set `WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE=${PUBLIC_SLUG}-demo-<provider-source-sha>` to that relative child of `output/playwright`; never point it at legacy `reasonweave-demo-10a058e`. If any binding changed, stop instead of retrofitting the receipt or making a blind retry. Do not make another paid request merely to obtain a cleaner workflow.
