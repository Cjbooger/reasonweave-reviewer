# Devpost submission draft

## Project name

ReasonWeave

## Tagline

Make reasoning visible.

## Short description

ReasonWeave is a finite inquiry studio. The learner predicts before seeing evidence, then turns one cited finding into a decision: what it establishes, where its support stops, and how it changes their model. They choose a short creation anchor from that design move and use the exact phrase in what they make, making the evidence-to-creation connection visible without grading their idea. AI opens the inquiry; the learner owns those choices.

## The problem

Generative AI makes polished answers abundant. In education, that can remove the intellectual work that makes a question worth exploring: choosing a method, committing to a first model, evaluating sources, making something, and revising a belief.

ReasonWeave is for independent high-school and college learners age 13 and older. It is not a chatbot, homework writer, grading tool, or learner-profiling system. It is a finite studio for practicing agency around one real curiosity.

## The learner experience

The educational unit is visible, not inferred: **evidence → learner decision → design move → trace**.

Every quest follows one bounded loop:

**Spark -> Choose -> Predict -> Investigate -> Create -> Reflect -> Branch**

1. The learner asks a question and chooses a level and quest length.
2. In configured live mode, GPT-5.6 proposes exactly three methodologically different investigation routes.
3. The learner chooses a route and commits to a prediction before evidence appears.
4. In configured live mode, OpenAI web search grounds an Evidence Lens that visibly separates sourced **Evidence**, reasoned **Inference**, and an **Open Question**.
5. On five- and ten-minute quests, the learner uses one textarea with exactly three lines to record what one selected sourced finding establishes, where its scope stops, and how it changes the prediction. Fifteen-minute quests retain the three separate fields. At every duration, the learner makes the **supports**, **challenges**, or **complicates** relationship choice separately.
6. The learner turns that same finding into a concrete design choice, chooses a 2–8-word creation anchor with at least two specific words from it, and uses the exact phrase in a design, causal model, argument, comparison, or proposal under explicit constraints. The anchor checks continuity, not correctness.
7. The learner records “I used to think...,” “Now I think...,” and “I still wonder....” Those words remain distinct from AI synthesis and feedback.
8. In configured live mode, GPT-5.6 responds to the learner's actual evidence decision, creation, and reflection, then offers exactly three stronger questions.
9. The learner selects exactly one as **My next question**. That choice completes the already-visible finite Curiosity Map and unlocks the exportable Discovery Card; it never starts an automatic or recursive quest.

Application code enforces this sequence. The model cannot skip the prediction gate, invent a fourth route, grow an infinite graph, or unlock the final export early.

## The one thing judges should watch

In the underwater quest, watch one sourced finding travel through the product. The learner predicts first; chooses a finding; states what its sources establish and where their support stops; explains how it supports, challenges, or complicates the prediction; turns that same finding into a design choice; and sees the resulting change on the Curiosity Map and Discovery Card.

- In a verified live run, open one returned citation and use the route, evidence, and learner entries actually returned in that run.
- In the seeded reliability path, keep **Pre-generated demo** visible. The reviewed Aquarius sources are pre-generated content, not a current GPT-5.6 or web-search response.
- Pause on the evidence-to-design sentence, then on **At a glance**: **My evidence judgment** (supports, challenges, or complicates; why it mattered; and the source boundary), the selected finding and sources, design move, before-to-now change, and **My next question**.
- End on the copied Discovery Card. The finite journey stops there.

## Why this matters for Education

ReasonWeave does not try to imitate a teacher or keep a student talking forever. Five forms of learner agency are structural:

- prediction precedes explanation;
- sourced evidence is not visually conflated with inference, and the learner must judge one finding;
- the learner must explain how that selected finding shapes a design choice rather than leave it as passive reading;
- reflection records a before-and-after model in the learner's own words;
- branching stops after three questions instead of expanding into an infinite graph.

The result is not another AI answer. It is a portable trace of what the learner chose, thought, evaluated, made, changed, and still wonders.

## OpenAI technical differentiation

GPT-5.6 is not designed as a decorative chat layer. In configured live mode, the implemented integration gives it four finite roles: planning distinct routes, turning one route into a safe browser-completable quest, synthesizing web-grounded evidence, and giving feedback tied to the learner's actual reasoning.

- `/api/routes` is configured to return exactly three diverse investigation methods;
- `/api/quest` is configured to create a bounded prediction and creation challenge;
- `/api/evidence` is configured to require OpenAI web search and accept only SDK-returned URL citations;
- `/api/reflect` is configured to produce specific feedback and exactly three next questions.

The Responses API uses Structured Outputs, with every result validated again by Zod. All four GPT-5.6 structured calls set `text.verbosity` to `low` while retaining their schemas, token ceilings, and validators. Application code - not the model - owns route count, prediction order, citation associations, map size, safe activity constraints, state transitions, timeout/retry behavior, and seeded/live provenance. Evidence claims may cite only URLs from a completed OpenAI `web_search_call`; `failed`, `in_progress`, and `searching` calls fail closed. Unsourced reasoning must appear as **Inference** or **Open Question**.

That division of labor is the product's technical thesis: GPT-5.6 expands the space of inquiry, while deterministic software preserves the learner's agency and the integrity of the trace.

Credentialed local validation was completed on July 20 with a test-only `gpt-5.6-terra` override and OpenAI web search, limited to the underwater-habitat and dreams fixtures. Both fixtures passed (126/126 checks), and the returned NOAA, CDC, PubMed, and NINDS sources were manually checked against the displayed sourced claims. This is narrow local integration and two-topic citation-support proof only: production remains configured for `gpt-5.6`, and the run does not establish deployed behavior, all-ten-topic quality, broad moderation calibration, or educational efficacy.

## Design

ReasonWeave uses an editorial science-studio interface rather than a chat transcript. Each stage has one clear job, a growing map keeps the finite journey visible, and the final reveal makes the learner's reasoning - not an AI avatar - the central visual artifact. A Replay trail control lets judges inspect the transformation again. The final card leads with a compact judge-readable payoff while preserving the full trace in a native disclosure.

## Potential impact

ReasonWeave addresses a concrete gap: learners need ways to use powerful AI without outsourcing the whole act of inquiry. A ten-minute pre-seminar or project-planning quest could produce a Discovery Card that an educator or parent can discuss without receiving a hidden chat transcript, grade, diagnosis, or permanent learner profile.

In the canonical seeded journey, the learner begins by predicting that pressure will be the hardest underwater-habitat constraint. A sourced finding about an operating undersea lab's dependence on surface support complicates that model. The learner responds with one focused design decision: a shallow habitat with surface-linked support and a detachable service dock, while naming continued surface dependence as the tradeoff. The learner then reflects on the habitat as a connected system rather than a single dominant constraint. That is a demonstrated product journey, not a claimed learning outcome.

We do not claim that this prototype improves grades, retention, curiosity, or any other educational outcome. Its demonstrated behavior is inspectable: it withholds evidence until a prediction exists, requires learner-authored judgment, creation, and reflection, and exports that trail instead of hiding it in a chat log. A consent-safe pilot plan for future validation is documented in `docs/learning-design.md`.

## Quality of idea

ReasonWeave is one connected mechanism, not a feature bundle: answer abundance becomes a prediction-first quest; a five- or ten-minute learner-authored source note makes source limits and learner judgment visible; source-to-design transfer makes application explicit; reflection exposes model change; and a bounded map turns the process into something the learner can own.

That is what separates it from chatbots, search summaries, homework helpers, and generic Socratic tutors.

## How Codex contributed

Codex helped turn a passive source summary into a tested learning rule: before the final trace unlocks, the learner must say what one source supports, where that support stops, and what they will design differently. Codex also helped implement and test the prediction gate, finite Branch selection, source and citation boundaries, accessible map fallback, and release checks. The dated operator record is in `docs/codex-contributions.md`.

## Challenges

- Preserving learner agency while still providing useful AI help.
- Associating evidence only with URLs actually returned by web search.
- Making generated content bounded, testable, and safe enough for a reliable demo.
- Building a visual map that is finite, personalized, keyboard-accessible, and recoverable without SVG.
- Keeping a polished seeded path without ever presenting it as a live model call.

## What we are proud of

- The prediction gate is an application invariant, not a prompt suggestion.
- The Evidence Lens keeps evidence, inference, and uncertainty visibly distinct.
- The learner must explain how a selected finding shapes a design choice.
- The final map is generated from actual session state and has an accessible text outline.
- The complete fallback remains useful while being visibly honest about its provenance.
- The Discovery Card preserves the learner's words separately from AI synthesis and exports a finite reasoning trace.

## What we learned

The difficult part of educational AI is not generating more content. It is deciding which parts the model must never take away from the learner. Once those boundaries became state-machine rules - predict first, inspect sources, judge evidence, create, reflect, then stop - the experience became both more educational and more testable.

## What's next

The immediate next steps are signed-out deployment validation, deployment-level abuse protection, broader topic and moderation calibration, and consent-safe learner and educator walkthroughs. Accounts, grades, LMS features, analytics, and learner profiling remain intentional non-goals.

## Built with

Codex, GPT-5.6, OpenAI Responses API, OpenAI web search, OpenAI moderation, Structured Outputs, Next.js, React, TypeScript, Zod, Vitest, Playwright, and axe-core.

## Safety, privacy, and scope disclosures

- ReasonWeave is for learners age 13 and older and is not designed for children under 13.
- ReasonWeave uses AI and web sources to guide an investigation. AI can make mistakes. Learners should check cited sources and involve a qualified adult for health, safety, or physical activities.
- It collects no account, name, email, school, grade, or long-term learner profile and uses no database.
- Versioned session and draft data remains in the browser for a fixed maximum of 24 hours and can be cleared sooner. Expired work is removed while the app is open or on its next load.
- Live mode sends the relevant quest inputs through ReasonWeave's server to OpenAI. The seeded demo makes no live model request.
- A stable random browser identifier may be sent as `safety_identifier`; it is not derived from the learner's identity and is stored separately from expiring learner work.
- The initial question is limited to 3-300 characters. Learner inputs are moderated before model reuse where appropriate. Activities are browser-completable and exclude dangerous physical experimentation.
- The OpenAI API key stays server-side. ReasonWeave is designed not to log full learner content in production; deployed secret and logging verification remains a release gate.
- Public launch still requires distributed host-level rate limiting, an emergency deny path, restricted provider limits, configured OpenAI project budget alerts, and explicit enablement of the production live-generation release lock. With no shared durable usage counter, these are abuse/spend mitigations rather than an exact global dollar ceiling; keep the public app seeded-only if a true ceiling is required.
- The working title changed from WonderLab to ReasonWeave after a practical collision review. A deeper screen found a direct existing public-software use named **ReasonWeave Agent Suite**. The owner explicitly adopted **ReasonWeave** for this submission despite that documented collision. This decision is not legal clearance; complete the final repository, application, and video IP review before submission and do not describe the name as cleared.

## Operator appendix - refresh before submission

Keep this section out of the main judging narrative unless a form explicitly asks for verification details.

This is judge-facing copy, not a completion record. Replace every bracketed placeholder and recheck this appendix after the deployment-mode, video, repository-access, signed-out, and `/feedback` gates.

### Current repository and release identity

Current application checkpoint `8efdca49a34b95812fa638425cf4866a6b8b8b70` (tree `c3c33837a82f373b5005643e88a496f50f478461`) is the selected deployment code. It passed format/lint/typecheck; 46 files / 634 Vitest tests; 145/145 fixture checks; production build and bundle budgets; Playwright 28/68; and no-key 1/1 with zero API requests. It also closes the intermittent restored-Branch focus race. The final local video was recorded from `4a6cf0a1c75234ba0ed296b5dab1e80c2a63b627`; it demonstrates the same seeded learner flow and does not claim to be a byte-for-byte capture of the later hardening checkpoint.

The rendered flow includes semantic controls, keyboard-operable route choices, associated validation, reduced-motion behavior, forced-colors treatment, and an independent text outline for the SVG map. Automated accessibility and focused 320-pixel browser checks pass across the documented matrix. The current authoritative serial matrix covers the complete keyboard-only Spark → Branch journey; historical checkpoint `a08b1ee` retains the separate five-repeat Chromium stress result (5/5). Automated Chromium keyboard-only proof is closed. Human/manual keyboard and focus review, true browser 200% zoom/reflow, VoiceOver/NVDA/JAWS verification, and physical/manual Safari remain open.

### Verified local proof

Exact application checkpoint `8efdca49a34b95812fa638425cf4866a6b8b8b70` passed the committed-tree checks listed above. The bounded live run was performed against the preceding live-integration checkpoint `8c2dda942332259d1a82ea94cbed1457d0e27dd1`: two synthetic topics, 2/2 fixtures, and 126/126 checks passed with a test-only `gpt-5.6-terra` override; the report excludes keys and hidden server data, and its four source domains were manually reviewed. No broader or deployed live-model claim is made. The 2:54 final MP4 remains bound to exact media source `4a6cf0a1c75234ba0ed296b5dab1e80c2a63b627`, reuses the already-paid narration artifacts without another provider request, and is uploaded to YouTube with checks complete while public visibility remains pending. The primary Codex `/feedback` session is `019f6b0d-f183-7c92-9573-3a10df19e958`. Deployment, final IP review, the second reviewer-access confirmation, Devpost submission, and signed-out public-link verification remain open.

Historical application checkpoint `a08b1ee50451c8b5df41da1bea4ad2d79cd49a69` passed format/lint/typecheck, 33 test files / 388 tests, 142/142 fixture evaluations, production build, the full Playwright matrix with 22 passes / 50 deliberate project-scoped skips, dedicated no-key Chromium (1/1), a changed-file credential-pattern scan with 0 findings, and diff check. Its focused complete keyboard-only Spark → Branch journey passed a five-repeat Chromium stress run (5/5), closing automated Chromium keyboard-only proof. The build retained bundle measurements of 470,655 raw / 116,946 gzip across five initial chunks; Curiosity Map 15,195 / 5,412; Discovery Card 15,005 / 4,870; and two deferred chunks 30,200 / 10,282. Historical whole-repository source `7d01c9b6270101a2cf702fe594af9301fee6046d` passed its fresh-checkout/audit gate: 464 installed packages, 34/394 tests, 142/142 fixtures, build/bundles, Playwright 22/50, no-key 1/1, audit 0, scans 0, and clean final status. No current release screenshot/media refresh, live OpenAI/web-search, server-side provider path, or deployment is claimed. Historical prior-source checkpoint `269a3f820746c9253a2d1aa897755714ad56d277` retains its source-scope journeys and desktop/mobile Browser inspection; those results are historical only. Screenshot, media, and reviewer refreshes remain pending after the public-name decision. `aa64be1` / `387ddebb63686ed373fdffc7d7cdd1cb7b167a4a` remain historical screenshot evidence. Historical proof board `dac76a2`, media `5814a13`/`10a058e`, and reviewer release `1023992` remain preserved as older-source artifacts.

- Historical clean application-safety checkpoint `1195c9d`, application checkpoint `2747950`, and `aa64be1` retain their documented prior gates. Historical `e16eb48` retains its 33/387, 142/142, audit-0, 21/47, no-key, and old-bundle receipt. Exact whole-repository source `7d01c9b6270101a2cf702fe594af9301fee6046d` is the later clean-checkout/audit proof: 464 installed, 34/394, 142/142, audit 0, build/bundles, 22/50, no-key 1/1, scans 0, and final clean status. Its ignored 7,906-byte receipt `current-repo-7d01c9b-clean-checkout-attestation.json` has SHA-256 `285d16e2598f25bc2e2c47230dbdd9b91fbb7ba56e58dbc816903c238b0b1e56`.
- Exact repository/app checkpoint `dac76a2acba47e8deebca1a2066c80097f9899f0` passed format, lint, typecheck, production build, 31 serial test files / 356 tests, and the full 16-pass / 32-intentional-skip Playwright matrix. Initial JavaScript measured 468,746 raw / 116,364 gzip bytes across five chunks; two deferred feature chunks measured 26,724 raw / 9,595 gzip. The map is deferred from initial load, while the separate Discovery Card chunk is needed only in the branch experience.
- The deterministic evaluation suite passed 142/142 checks across all ten required topics, parsing topic-specific outputs with production schemas and retaining known-invalid negative controls. This is no-key contract proof, not live model-quality proof.
- Historical JPGs from `dac76a2` retain their original two-run receipt. `aa64be1` / receipt `387ddebb63686ed373fdffc7d7cdd1cb7b167a4a` remain the historical screenshot source and receipt; refresh is pending after the public-name decision. They are seeded-flow proof, not evidence of a live model call.
- The tracked technical proof board records historical `dac76a2` counts; the thumbnail and social preview were regenerated from the map-first hero and are byte-identical. The `5814a13` MP4 uses that board and is historical relative to selected application checkpoint `8efdca49a34b95812fa638425cf4866a6b8b8b70`. Reviewer package `52aa3d8` is previous and superseded; `reasonweave-reviewer-1023992.tar.gz` is a completed older-source reviewer release. Reviewer refresh and the second access grant remain pending the final documentation checkpoint.
- The local narrated candidate is bound to clean source `5814a1373a68caf41e3ee49fa311821300bbdc1b` (31 files / 359 tests). Its 174-second, 1280 x 720 MP4 passed full decode and has SHA-256 `57d517746709d986bf38cfc87a9d2072b114da12cbdc2b951e8d8300a5c01312`; it reuses immutable `10a058e` provider artifacts verbatim without a second provider request. It is local technical evidence, not a human-approved or public video.
- The owner selected ElevenLabs voice ID `OZxMHsGaBmV5pjMIDIn0` and describes it as a female speaker. Exactly one paid full TTS POST succeeded with no probe or retry, and no second paid call or other new provider call occurred for this source upgrade. The scoped key could not retrieve catalog metadata or a provider preview, so the voice remains labeled `user_selected_tts_only`; its provider name, gender, category, metadata, and preview are not verified. No owner/human approval for public release is claimed.
- The historical automated-rehearsal SRT remains immutable. After the final public name and frozen judge script are locked, create/commit a new versioned, newly timed, human-reviewed judge-facing SRT before screenshot capture and media rendering. Capture the final flow afterward, then bind the selected-voice approval to that capture before any fresh paid narration request.
- Exact security, provenance, historical-checkpoint, and media receipts remain in `docs/submission-checklist.md`, `docs/codex-contributions.md`, `docs/asset-provenance.md`, and `docs/media/README.md`.

### Required external gates

- Verify the chosen public deployment mode: validate seeded-only behavior if live generation stays disabled, or separately validate deployed GPT-5.6, citations, moderation, and host controls if it is enabled. Do not generalize the bounded two-topic local run.
- Deploy, verify server-side secret handling and production logging, and complete the full quest from a free signed-out public session.
- Add deployment-level rate/spend controls and keep the app free of charge and without restriction from July 22, 2026 at 10:00 AM Pacific through August 5, 2026 at 5:00 PM Pacific, as revalidated on submission day.
- Complete human/manual keyboard and focus review, true browser 200% zoom/reflow, VoiceOver/NVDA/JAWS, physical/manual Safari, and consent-safe usability validation. Automated Chromium keyboard-only proof is closed; no educational-efficacy claim may be added without evidence.
- Human-review the local narration, then publish and verify a public narrated YouTube demo under three minutes.
- Share an approved reviewer-facing repository that excludes removed source-unrecorded JPEG history; if private, verify access for `testing@devpost.com` and `build-week-event@openai.com`.
- Verify the reviewer repository is either public with relevant licensing or private with both required invitations, and that its README includes setup, sample data, testing instructions, Codex acceleration/key decisions, and GPT-5.6 use.
- Complete the final repository/application/video IP audit for the owner-adopted **ReasonWeave** name; the decision to retain it despite the documented collision is not legal clearance.
- Create the Devpost entry, record the final submission SHA, and add the primary Codex `/feedback` session ID.
- Archive the exact submitted fields, links, images, repository state, and video. After the deadline, do not edit the submitted entry except for a narrow organizer-permitted IP, PII, or inappropriate-material correction.

## Links

- Live app: [PUBLIC URL - pending authorized deployment and signed-out verification]
- Public narrated demo: [YOUTUBE URL - pending human approval, upload, and public verification]
- Repository/access instructions: [SANITIZED PRIVATE REPOSITORY URL - verify reviewer access]
- Primary Codex feedback session ID: [SESSION ID - pending]
- Final commit: [SHA - pending]
