# Release media manifest

> **Current proof note — July 19, 2026:** Code-only direct clean committed-worktree proof is `0bd5aef89ab4715477491b462c13be0c5978ac6b` (tree `4d6162e7a7632bba96f582818f44d98bbff956a0`): format/lint/typecheck; 46/596 Vitest; fixtures 145/145; build; initial bundle 464,236/113,930 (map 16,356/5,592; card 15,598/5,051; UI 31,954/10,643; seeded 21,224/6,904); Playwright 28/68; no-key 1/1 zero API; keyboard stress 5/5; audit 0; expected-only scans; diff and clean status. Default preflight is 13 PASS / 0 FAIL / 7 PENDING; strict release intentionally 0/9 without external evidence. The owner has adopted ReasonWeave despite its documented collision; CurioTrellis remains unadopted, no legal clearance is claimed, and final IP review is open. No secret read, live call, media, or provider action occurred. `acfdc37` is historical predecessor proof.

> **Current release-tooling note — July 19, 2026:** Exact checkpoint `90590b0fbd3379368f9fa0682a2d9f945c60ec2e` (tree `d17e3364be94d79c6bbf25eb2645309aff2de0d5`) adds the shared built-in-only pre-payment SRT/full-PNG contract described below. Focused proof passed 38/38 and the full unit suite passed 44 files / 529 tests; independent final review found no P0–P3. No provider request, secret read, narration, or media render occurred.

**Historical-ledger convention:** every later `acfdc37` reference preserves predecessor proof only; the current application checkpoint is `0bd5aef89ab4715477491b462c13be0c5978ac6b`.

That current source also has fresh no-hardlink/no-alternates clone proof (exact HEAD/tree, unique pack inode/link count 1, and `npm ci` adding 464 packages); keyboard stress 5/5 remains direct-worktree proof.

This manifest defines the deterministic **ReasonWeave** submission assets. The eight-image screenshot receipt `387ddebb63686ed373fdffc7d7cdd1cb7b167a4a` was captured from exact clean app source `aa64be1d200a21463e8ef187fa08e9f9800a8ffd`; three focused runs were byte-identical, including one post-source-commit run. That set, the `dac76a2` proof board, and the local `5814a13` capture/assembly remain historical evidence, with immutable selected provider artifacts retained at `10a058e`. The current release replaces those visual inputs with the receipt-bound `reasonweave-final-july19-r1` screenshots and rendered media described below. No fresh OpenAI/provider, narration, deployment, credentialed live-model, or public-upload action has occurred yet. The user-selected voice ID remains exactly `OZxMHsGaBmV5pjMIDIn0`; final-flow capture and capture-bound approval precede the one authorized paid narration call.

For a new current release, `config/release-identity.json` is the canonical identity source. It records the owner-adopted `ReasonWeave` / `reasonweave` submission choice, but that configuration does not legally clear the name. The source file's exact identity record is bound into new screenshot, media, paid-narration, and final-assembly receipts; historical receipts retain their original names and hashes.

> **Rename note — July 19, 2026:** The local release-candidate name changed from **WonderLab: Curiosity Quest** to **ReasonWeave**. A deeper screen later found a direct existing public-software use named **ReasonWeave Agent Suite**. The owner explicitly retained ReasonWeave for this submission on July 19 despite that documented collision; the choice must not be described as legal clearance. Original source-pack references, legacy `WONDERLAB_*` variables, ownership markers, and exact historical output paths remain unchanged for reproducibility. The `574abe1` capture is historical pre-ReasonWeave evidence; the latest completed local media capture is bound to `5814a13` and remains historical relative to current app checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`, with `10a058e` retained as immutable provider-artifact provenance. The `aa64be1` screenshot set is likewise historical.

| Asset                       | Dimensions | Source                                                                        | Intended use                         |
| --------------------------- | ---------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `technical-proof-board.png` | 1600 × 900 | `technical-proof-board.svg`                                                   | Narrated Codex/GPT-5.6 proof cut     |
| `youtube-thumbnail.png`     | 1280 × 720 | `scripts/render-release-media.mjs` + `docs/screenshots/discovery-desktop.jpg` | Public demo thumbnail                |
| `seeded-demo-badge.png`     | 360 × 72   | `scripts/render-release-media.mjs`                                            | Capture-badge visual reference       |
| `closing-card.png`          | 1280 × 720 | `scripts/render-release-media.mjs`                                            | Dedicated 2:42–2:54 closing frame    |
| `public/reasonweave-og.png` | 1280 × 720 | Byte-identical public copy of `youtube-thumbnail.png`                         | Application social-preview image     |
| `technical-proof-board.svg` | 1600 × 900 | Editable vector source                                                        | Proof-board revisions                |
| `seeded-demo-rehearsal.srt` | 2:54       | Immutable historical seeded narration                                         | Reproducibility only; not final copy |

Regenerate all four media PNGs plus the byte-identical public social-preview copy from the repository root:

```bash
npm run media:render
```

That unqualified command is preserved as historical documentation. The current renderer intentionally rejects it rather than writing into `docs/media/` or replacing `public/reasonweave-og.png`.

## Versioned current release media

With ReasonWeave owner-adopted, freeze the judge script and use one fresh media directory containing the committed current `technical-proof-board.svg` and a new versioned, newly timed, human-reviewed SRT. Commit those release inputs before generating the completed versioned screenshot directory and receipt, then render the media receipt before capturing the final flow. Preserve `docs/media/seeded-demo-rehearsal.srt` unchanged as historical evidence; do not silently repurpose it as the new script.

**Current release-media status — July 19, 2026:** `docs/media/reasonweave-final-july19-r1/` is the authoritative versioned set: a 39-cue, 288-word narration draft, its 1600 × 900 proof-board source, four deterministic PNG derivatives, and `release-media-receipt.json`. The `-r1` release ID avoids a Finder-rehydrated failed screenshot path without changing content. The shared release contract passes at exactly 174.000 seconds, with a 37-character maximum line and 150 maximum cue WPM. The receipt is authoritative for the exact screenshot source, identity record, input/output bytes and hashes, and public OG copy; every recorded hash must match the tracked file, and the thumbnail must be byte-identical to `public/reasonweave-og.png`. Full-size and approximately 320-pixel inspection plus independent review found no P0–P3 in the composition. Final-flow capture, capture-bound exact-voice approval, the one authorized paid narration call, assembly, human listening/caption approval, and public upload remain separate gates.

```bash
WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
WONDERLAB_RELEASE_SCREENSHOT=docs/screenshots/${PUBLIC_SLUG}-<release-id>/discovery-desktop.jpg \
WONDERLAB_PUBLIC_OG_OUTPUT=public/${PUBLIC_SLUG}-og.png \
  npm run media:render
```

All three variables are mandatory for rendering. The media and screenshot directories must use the same release-directory name, which must begin with the canonical config slug and a hyphen; the screenshot must be that directory's `discovery-desktop.jpg`. The public target must exactly be `public/<canonical-slug>-og.png`, not merely any `-og.png` filename. Before rendering, the shared provider-free release contract requires at least 20 sequential, contiguous SRT cues from exactly 0.000 through 174.000 seconds, 1.5–7 second cue durations, at most two 42-character lines per cue, and no cue above 185 WPM. The renderer verifies the complete screenshot owner/receipt/source/hash/identity chain, requires both committed text inputs to contain the canonical display name and no retired display name, reads inputs relative to inode-anchored directories, verifies the generated proof board is a 1600 × 900 PNG and the closing card is a 1280 × 720 PNG, stages only fixed outputs, and publishes with exclusive anchored writes. It writes `release-media-receipt.json` last, binding the identity record, screenshot evidence, ordered media hashes, and public OG hash. It never overwrites an existing media or public file. Successful cleanup removes only known files from the anchored staging directory without recursive deletion; a failed publication preserves staging evidence and any exclusively created partial outputs for manual reconciliation.

Narration and assembly select the same committed SRT, proof board, and closing card with `WONDERLAB_RELEASE_MEDIA_DIR`:

```bash
WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
  npm run demo:narrate -- --voice-id OZxMHsGaBmV5pjMIDIn0

WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
WONDERLAB_NARRATION_PROVIDER=elevenlabs \
  npm run demo:assemble
```

The first command is a provider-free dry run unless `--generate` is explicitly added after the fresh capture-bound approval. Narration receipt-verifies and revalidates the SRT, proof board, and closing card through the same strict contract before credential access, output writes, or the provider path. Paid or credentialed narration requires this versioned directory and a valid, current `release-media-receipt.json`; it cannot use the historical media root. Final assembly likewise requires receipt-bound versioned media by default. `WONDERLAB_ASSEMBLE_ALLOW_HISTORICAL_MEDIA=true` is the explicit historical-only reproducibility escape: it may be used only without `WONDERLAB_RELEASE_MEDIA_DIR` and must never be used for a current release. Rendering has no historical write default.

The thumbnail uses the real rendered Discovery screenshot as its only product image. The render script creates a dimmed full-frame backdrop and a brighter deterministic crop of the actual map-and-Discovery-Card reasoning trace; it does not synthesize or redraw the product UI. Its refreshed overlay uses the canonical config display name, the promise **make reasoning visible**, the Education category, explicit **SEEDED DEMO** provenance, and the product loop through `BRANCH / MAP`.

The proof board's core headline and proof counts remain legible around 320 pixels wide. The 2:22–2:42 narrated proof cut should use this source-pixel crop plan so supporting copy is also readable:

| Time        | View                        | Source crop (`x, y, width, height`) |
| ----------- | --------------------------- | ----------------------------------- |
| 2:22–2:26   | Full board orientation      | Full 1600 × 900                     |
| 2:26–2:31   | Predict + evidence judgment | `45, 245, 760, 428`                 |
| 2:31–2:34.5 | Design + anchor + branch    | `795, 245, 760, 428`                |
| 2:34.5–2:38 | Learner safeguards          | `40, 439, 820, 461`                 |
| 2:38–2:42   | Concrete Codex story        | `780, 439, 800, 450`                |

Scale each crop to 1280 × 720. Do not replace “configured” or “when credentialed” language with a claim that a live model run occurred.

The current `reasonweave-final-july19-r1` thumbnail/social preview and technical proof board were rendered from the current receipt-bound inputs and inspected full size and at approximately 320 pixels wide. The `387ddeb` gallery receipt, `dac76a2` board, `5814a13` MP4, and `10a058e` provider artifacts remain immutable historical evidence; none supersedes the current visual inputs or proves a current narrated MP4.

None of these assets is evidence of a live GPT-5.6 call. The recorded video must still follow [the live or explicitly seeded track](../demo-script.md), and public upload remains a separate authorized gate.

## Local seeded rehearsal

The local rehearsal is generated from the real application and stays under an ignored `output/playwright/` directory; the MP4 is deliberately not committed or published. The latest completed historical candidate is `output/playwright/reasonweave-demo-5814a13/seeded-demo-rehearsal.mp4`; `fb4893c` is older because it predates the required Branch next-question selection.

Prerequisites:

- Node.js 20.9 or newer with the repository dependencies installed by `npm ci`.
- Git, with the command run from the project repository root at a committed checkpoint.
- The pinned Playwright Chromium browser installed with `npx playwright install chromium`.
- FFmpeg and FFprobe on `PATH`, with `libx264`, AAC, and `mov_text` encoders plus the core `apad`, `atempo`, `concat`, `loudnorm`, and `overlay` filters. The assembly does not require libass.
- For the default local rehearsal, macOS `say` with the `Samantha` voice; a sandboxed process needs permission to use the system voice service. The ElevenLabs provider path instead accepts the approved generated MP3 plus raw timestamps and can assemble wherever the listed FFmpeg prerequisites are available.

For a current release, run capture and final assembly from the clean repository root with the receipt-bound media directory; no separate development server is needed:

```bash
WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
  npm run demo:capture

WONDERLAB_CAPTURE_OUTPUT=output/playwright/${PUBLIC_SLUG}-demo-<source-sha> \
WONDERLAB_RELEASE_MEDIA_DIR=docs/media/${PUBLIC_SLUG}-<release-id> \
WONDERLAB_NARRATION_PROVIDER=elevenlabs \
  npm run demo:assemble
```

The bare `npm run demo:assemble` command no longer selects a release and fails unless `WONDERLAB_ASSEMBLE_ALLOW_HISTORICAL_MEDIA=true` is explicitly set. That escape preserves reproducibility for immutable historical media; it does not produce a current release artifact.

`demo:capture` owns an isolated no-key Next development server from the recorded checkout on `127.0.0.1:3107` and stops it afterward. Set `WONDERLAB_CAPTURE_PORT` only if that port is unavailable. `WONDERLAB_CAPTURE_BASE_URL` remains an explicit non-release debugging override; release assembly rejects a capture that did not use the capture-owned server. This prevents a stale build or another checkout on an existing port from being attributed to the current commit.

The capture records the exact seeded 0:00–2:22 product sequence and twelve implementation frames, including separate top and bottom reflection proof plus a three-beat ending: the learner's before-and-now change, the selected **My next question** inside the Discovery Card, and the verified export result. It validates and hashes the actual clipboard or downloaded Discovery Card Markdown rather than trusting the UI success message. The 2:54 assembly contract keeps that product segment, uses the proof-board crop plan from 2:22–2:42, and holds the dedicated closing card from 2:42–2:54. Capture's fixed seeded provenance strip uses the same wording and color intent as `seeded-demo-badge.png` and remains visible throughout the product section; the closing card carries its own explicit seeded provenance. Captions are rendered as deterministic Sharp-generated cards, burned in with FFmpeg's core `overlay` filter, and also embedded as a `mov_text` subtitle track.

The immutable historical SRT contains 39 sequential, contiguous cues through exactly 174.000 seconds (2:54): 297 words, 1,949 joined-text characters, a 41-character maximum line, and a 150 WPM maximum cue. It remains reproducibility evidence and must not be used as the final judge-facing script. After the public name and judge script are locked, create/commit a new versioned, newly timed, human-reviewed SRT before screenshot capture and media rendering; the final product capture and capture-bound voice approval follow. Local historical assembly uses the macOS `Samantha` voice at 155 words per minute by default. The result remains a rehearsal—not a public upload, human narration approval, or live GPT-5.6/web-search proof.

On July 17, 2026, the owner confirmed a paid ElevenLabs plan, so the paid-plan licensing prerequisite is met. The narration key was loaded from an owner-configured macOS login Keychain entry and passed only into a native child-process environment; the key was never printed, placed in a process argument, or written to the repository. A credentialed `GET /v2/voices` returned the exact scoped denial `HTTP 401 / missing_permissions`. That establishes that the stored key is reachable but cannot provide current catalog metadata.

The owner explicitly selected and described `OZxMHsGaBmV5pjMIDIn0` as a female speaker; release tooling records the selected-voice exception as `user_selected_tts_only` after the exact observed `401 / missing_permissions` response. This scope cannot provider-verify current catalog metadata, name, gender, category, or a preview for that voice, so the selection is not `catalog_verified` and has no provider-preview or listening approval. The 735-byte capture-bound approval has SHA-256 `7ceb7988c3d694f8cd594dfe206f7b654ff01df1caff15312b2fd199da2c9c71`. Exactly one paid full TTS POST succeeded historically, with no probe or retry; its 1,321-byte receipt has SHA-256 `272eb699410d45a24e737e5bbe3313711c7e84aafe05cd1537b6f1d22631181b` and records the exact approval digest. The resulting fully decoded MP3 is 2,216,063 bytes, 138.437370 seconds, 44.1 kHz mono at 128 kbps (SHA-256 `b5cc1b58cb34377383e113ef87b1121580827a9cb55457b212d63574b3f6eca5`); raw timestamp alignment covers 1,949/1,949 characters (153,834 bytes; SHA-256 `1e653b7c1d295374a4f1be430f1f488fb5c1233b3e882c8fb41dc3e044b44ea3`). The historical George fallback and preview are stale evidence only; neither its preview nor any approval transfers to the selected voice. Every other voice, status, provider code, malformed response, timeout, redirect, or changed pinned value fails closed. The canonical escalated agent-key status exited 0 and reported configured after a metadata-only lookup located the login item label `Agent API Key: ELEVENLABS_API_KEY` under service `com.chadb.agent-keys`; no `-w`, secret read/print, or provider call occurred. The earlier sandboxed exit 1 is a historical false negative. No second paid call or other provider contact was made for current application checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`. Any future paid request also requires the matching current release-media receipt; it must not reuse this historical ReasonWeave narration after a rename.

For catalog-backed and pinned-preview modes, `npm run demo:voices -- --preview-voice <id>` stores a bounded MP3 plus a capture-SHA-bound fingerprint/digest record under the ignored take directory. Listen to that local preview, then bind the selection with `npm run demo:voices -- --approve-voice <id> --confirm-preview-reviewed`. The selected TTS-only path deliberately has no preview: bind the exact owner-provided ID with `npm run demo:voices -- --approve-user-selected-voice OZxMHsGaBmV5pjMIDIn0 --confirm-user-selected-voice`. That record proves explicit selection, exact-ID denial, and capture binding; it does not claim provider metadata or that the voice has already been heard. At `b386343`, these official short-lived CLI preview/catalog-approval/user-selected-approval artifacts are inode-anchored against parent swaps. Validate the exact 1,949-character, 297-word narration plan without a network request using `npm run demo:narrate -- --voice-id OZxMHsGaBmV5pjMIDIn0`. Credentialed commands refuse to load the Keychain secret into dirty, untracked, or uncommitted voice tooling. The paid `--generate` path requires the applicable capture-bound approval, performs exactly one allowed pre-POST verification, rechecks the clean source and approval binding, and writes an exclusive attempt receipt before its single TTS POST: `npm run demo:narrate -- --voice-id OZxMHsGaBmV5pjMIDIn0 --generate`. Sensitive paid-generation reads and writes are likewise relative to an inode-checked anchored narration directory, with public-output identity checks before the receipt, immediately before the POST, and after publication. It never uses TTS as a probe. An ambiguous timeout or failed response retains that receipt and blocks a blind paid retry until provider history is reviewed.

For a current paid narration, that command also requires `WONDERLAB_RELEASE_MEDIA_DIR` to select a versioned directory whose `release-media-receipt.json` matches the current canonical identity, screenshot evidence, SRT, and source. The paid attempt receipt repeats that identity and media-receipt binding. A missing, stale, altered, or historical media root fails before a provider request.

Assemble narration generated for the same current capture with `WONDERLAB_NARRATION_PROVIDER=elevenlabs npm run demo:assemble`. The immutable `reasonweave-demo-10a058e` artifacts remain historical evidence, but current HEAD intentionally rejects them: their legacy attempt receipt predates the canonical `releaseNarration` binding. Do not point `WONDERLAB_ELEVENLABS_ARTIFACT_SOURCE` at that directory for a current capture, even when the old narration text happens to match.

The successful `5814a13` reuse belongs to its exact historical release contract. Reproduce it only from a separate checkout of that historical checkpoint and its contemporaneous instructions; current tooling must fail closed instead of retroactively treating the old receipt as current provenance. For the final release, freeze the public name and script, commit the newly timed SRT and receipt-bound media, capture the exact final HEAD, approve `OZxMHsGaBmV5pjMIDIn0` against that capture, and generate a new attempt only if its narration differs or the hardened release contract requires a new capture-bound receipt. Generated preview files (when applicable), approval, attempt, audio, and raw-timestamp artifacts stay ignored under their original capture path. The configured model is `eleven_multilingual_v2`.

The convenience `demo:voices` and `demo:narrate -- --generate` launchers expect an operator-only secret-manager adapter that is intentionally not shipped in the repository. A reviewer using another secret manager may invoke the underlying scripts with `--credentialed-request` after securely injecting `ELEVENLABS_API_KEY` into that child process. Seeded capture, tests, fixture evaluations, build, and bundle verification require no ElevenLabs credential, so reviewer reproduction does not depend on the local adapter or paid provider access.

Capture, voice approval, paid narration, and assembly bind their release evidence to the exact clean commit, confine output beneath `output/playwright/`, and require the legacy WonderLab ownership marker before replacing anything. Move an existing canonical output directory aside before recording again so a passing take cannot be overwritten silently. Dirty-tree overrides exist only for explicitly non-release smoke work and are recorded in the manifests.

The ignored capture directory remains a trusted, single-writer local release surface. At `b386343`, official CLI preview/catalog approval/user-selected approval and paid-generation artifact I/O are inode-anchored against parent swaps. Provider-free actual-child-CLI regressions cover exact-ID GET, preview lock, and catalog-approval temporary publication; independent review found no P0/P1/P2. The accepted residual is narrow: pure Node cannot make the final public-identity check and the following network operation atomic, but the official CLI's subsequent continuity check fails closed. This does not claim hardening for arbitrary direct library callers. Do not run capture, approval, or paid generation alongside other writers, and use a private trusted workstation for the release pass.

### Historical media verification snapshot — `5814a13`

The fresh capture used the owned no-key server, passed all capture assertions, and visually inspected 12 app frames, including **Your change**, selected-question close-up, and export. It verified nine map nodes with minimum opacity 1. The 142.600-second VP8 WebM product take is 1280 × 720, 11,757,776 bytes (SHA-256 `963f3252c2fe7793c839b054603e59dca969ca7d4fe82d4a3ebfbe52514e5c21`); capture-manifest SHA-256 is `ced476026046e2591a9f2702d01a3ee62a492c3ca95892701cfa28c1ee231b2b`. The actual 6,608-byte export has SHA-256 `6474325e14b9cda79c9622fa867536840e012d60754867964bc35e40316962f9`. No key was passed and the owned server stopped.

The assembled candidate is 174.000 seconds, 1280 × 720 H.264 with AAC stereo 48 kHz and `mov_text`: 15,527,159 bytes (SHA-256 `57d517746709d986bf38cfc87a9d2072b114da12cbdc2b951e8d8300a5c01312`), rehearsal-manifest SHA-256 `972e126bf0f8760a3611abc27990251ebf64c880e7d78d676c8dfe2277be842e`. It has 39 burned-in and embedded captions (41-character maximum line; 150 WPM maximum), includes Codex and GPT-5.6, measures -16.9 LUFS and -2 dBFS, and passed full decode. It reuses the exact user-selected `OZxMHsGaBmV5pjMIDIn0` provider artifacts verbatim from `reasonweave-demo-10a058e`, without a second request or provider contact; metadata, preview, and human approval remain unverified. This technical local result is not a public upload, deployed run, or live-model claim.

### Historical verification snapshot — `fb4893c`

The evidence-to-design automated rehearsal was captured and assembled from clean exact commit `fb4893cf9287231c00e1b98e7756fe4af7dd1796`. Capture used its owned no-key server with `OPENAI_API_KEY` explicitly absent, and verified that the server stopped afterward. The real-application product sequence produced ten review frames, a nine-node map, an Evidence Decision, a required learner evidence-to-design choice tied to the same finding, all required milestones, and a verified 6,499-byte Discovery Card export.

The assembled artifact is 174.000 seconds (2:54), 1280 × 720 H.264 video with AAC audio and a `mov_text` subtitle track. It contains 39 burned-in and embedded captions, with a 42-character maximum line and 150 WPM maximum cue. The local Samantha rehearsal voice measured −15.7 LUFS integrated loudness and −2.7 dBFS true peak. The MP4 is 13,950,748 bytes with SHA-256 `746ca60a4a03c1c5ca6e8d6d53c320089e0dd80fbe229e16dfbfc971888406a0`; the 11,007,093-byte product take has SHA-256 `5e266be13e931e522bc4051d5a59b87d76ab1e2fd714e1f38ae6e7d54881d3c0`; the 6,499-byte export has SHA-256 `d27ad977f8d2db75e88c660994c865e72a1cf92430602f74b827a6989d3435c6`.

Capture and assembly both recorded clean source state. Full decode, input/output hash validation, and a secret scan passed. A 35-frame whole-timeline contact sheet sampled every five seconds plus 13 critical timeline frames were visually inspected. These checks establish historical reproducible local seeded rehearsal evidence only: this take predates the Branch selection and does not prove the current flow. The clean `5814a13` candidate documented above supersedes it as the latest completed local media proof, but remains historical relative to current app checkpoint `acfdc37c3bc3e13fefc24d8fdb2c82b214b38f5a`. Neither take establishes a full human audio listen, human narration approval, public YouTube upload, signed-out playback, a credentialed GPT-5.6/web-search or moderation run, deployment, reviewer access, usability/efficacy validation, IP/name clearance, or a feedback ID.
