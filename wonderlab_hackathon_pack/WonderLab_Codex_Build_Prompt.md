# WonderLab: Initial Codex Build Prompt

> Paste the prompt below into a **fresh primary Codex thread** opened in the repository where WonderLab should be built. Keep that thread as the main build thread so its `/feedback` session ID can be used in the Devpost submission.

---

## Copy From Here

You are the lead engineer, product designer, test engineer, and technical writer for a time-boxed OpenAI Build Week hackathon project called **WonderLab: Curiosity Quest**.

Build the working MVP in the current repository. Do not merely produce a plan or code snippets. Inspect the environment, create the project, implement the application, test it, document it, and leave it in a deployable state.

Use current official OpenAI documentation and current stable package documentation whenever an API or library detail may have changed. Prefer boring, reliable implementation choices over clever infrastructure. Do not expand scope beyond the requirements below.

---

# 1. Hackathon Context

This project is for the OpenAI Build Week **Education** track.

The final submission must visibly demonstrate:

- Meaningful, non-incidental use of GPT-5.6
- Meaningful use of Codex to build the product
- A working, coherent product experience
- A real education problem and audience
- A creative idea that differs from a generic AI tutor or homework helper
- A public demo that can be understood even if judges do not inspect the repository

Preserve this thread as the main Codex build session. Near submission, the user will run `/feedback` and submit the resulting session ID.

Create `docs/codex-contributions.md` and maintain it throughout the build. Record concrete examples of how Codex contributed to planning, architecture, implementation, testing, debugging, design, and documentation. Do not invent contributions that did not happen.

---

# 2. Product Definition

WonderLab is an AI curiosity studio for high-school and college learners, approximately age 13+.

Its core promise is:

> **Most AI ends curiosity with an answer. WonderLab turns it into a quest.**

A learner enters any question, chooses one of three distinct investigation routes, makes a prediction before receiving the main explanation, examines source-backed evidence, creates something under constraints, reflects on how their thinking changed, and receives a visual Curiosity Map plus an exportable Learning Trace.

The central product rule is:

> **The AI expands the space of discovery while the learner remains responsible for prediction, judgment, creation, and reflection.**

WonderLab is not:

- A general chatbot
- A homework answer generator
- A grading tool
- A generic Socratic tutor
- An infinite knowledge graph
- A teacher LMS or classroom dashboard
- A product for children under 13

Do not claim proven improvements in grades, retention, learning outcomes, or curiosity.

---

# 3. Canonical Demo

The canonical demo question is:

> **Could humans live underwater?**

The expected journey is:

1. The learner enters the question or selects it from a sample chip.
2. The learner chooses `High school` and `10 minutes`.
3. GPT-5.6 generates exactly three distinct routes, similar in spirit to:
   - Survive the Pressure
   - Design the Habitat
   - Protect the Ocean
4. The learner selects `Design the Habitat`.
5. The app asks the learner to predict which constraint will be hardest.
6. The learner submits an initial explanation.
7. The app reveals an Evidence Lens grounded through OpenAI web search.
8. The learner designs a 100-person habitat under several constraints.
9. The learner completes:
   - I used to think…
   - Now I think…
   - I still wonder…
10. GPT-5.6 returns specific feedback and exactly three next questions.
11. The Curiosity Map expands into a compact visual Learning Trace.
12. The learner can copy the Discovery Card as Markdown.

The map transformation after reflection is the primary visual “wow” moment.

---

# 4. Required Learning Loop

Implement this finite sequence:

> **SPARK → CHOOSE → PREDICT → INVESTIGATE → CREATE → REFLECT → BRANCH**

## Spark

Collect:

- Question, maximum 300 characters
- Learner level: `high_school`, `college`, or `curious_adult`
- Quest duration: `5`, `10`, or `15` minutes

Include at least three sample questions.

## Choose

Generate exactly three distinct route cards. Each route must include:

- ID
- Title
- Hook
- Thinking lens
- Activity type
- Estimated minutes
- Icon key

Routes must differ by method, not merely wording. At least one must involve creation, design, comparison, testing, or systems thinking.

## Predict

Before evidence is shown, require the learner to make a meaningful initial prediction, ranking, model, or choice.

After the learner attempts the prediction, provide:

- `Hint`
- `Explain now`

Do not trap the learner in endless Socratic questioning.

## Investigate

Use OpenAI web search through the Responses API.

Display two to four concise findings and label each as:

- `Evidence`
- `Inference`
- `Open Question`

Every `Evidence` item must reference one or more actual returned sources. Never fabricate or infer a URL. Render source links visibly.

## Create

Generate one browser-completable challenge aligned with the selected route. It should require a design, comparison, causal model, argument, proposal, or similar artifact under two to four constraints.

Do not require a file upload, purchase, special equipment, or dangerous physical activity.

## Reflect

Collect:

- `I used to think…`
- `Now I think…`
- `I still wonder…`

Generate concise, specific feedback that references the learner's actual statements. Avoid generic praise. Do not grade, diagnose, or infer a fixed learning style.

Generate exactly three strong next questions.

## Branch

Render a final Curiosity Map containing approximately 6–10 nodes:

- Starting question
- Selected route
- Prediction
- Evidence cluster
- Creation
- Reflection or changed model
- Three next questions

The graph is finite. Unselected routes may remain dimmed but must not recursively expand.

---

# 5. P0 Functional Requirements

The MVP must include:

1. Public landing page with clear one-sentence explanation
2. Question, level, and duration input
3. Three generated route cards
4. Prediction gate
5. Evidence Lens with clickable web citations
6. Creation challenge
7. Three-part reflection
8. Specific GPT-5.6 feedback
9. Compact visual Curiosity Map
10. Discovery Card copied/exported as Markdown
11. Anonymous local session persistence
12. Input moderation and safe-activity constraints
13. Loading, error, retry, and timeout states
14. Transparent seeded fallback for the underwater demo
15. Unit tests, a browser smoke test, and a small prompt evaluation suite
16. Complete README and hackathon documentation
17. Deployable configuration

---

# 6. Explicit Non-Goals

Do not build any of the following:

- Authentication or user accounts
- Database persistence
- Teacher class management
- Rostering, grades, or LMS integration
- Long-term learner profiling
- Under-13 support
- Homework or file upload
- Image, audio, camera, or PDF input
- General chat history
- Multiplayer or social features
- Curriculum standards mapping
- Infinite graph expansion
- Native mobile app
- Points, streaks, badges, or leaderboards
- Image generation
- Claims of proven pedagogical efficacy

If a requirement is ambiguous, choose the interpretation that produces the smallest coherent product.

---

# 7. Recommended Technical Stack

Use:

- Current stable Next.js with App Router
- TypeScript with strict mode
- React
- Tailwind CSS
- A small accessible component system such as shadcn/ui if it does not add friction
- Current official OpenAI Node SDK
- OpenAI Responses API
- Model set through `OPENAI_MODEL`, defaulting to `gpt-5.6`
- Structured Outputs using Zod and the current official SDK helper or JSON Schema pattern
- OpenAI `web_search` tool for evidence
- `@xyflow/react` for the map if current and stable; otherwise use deterministic SVG/CSS
- React state plus `localStorage`
- Vitest and React Testing Library
- One Playwright or equivalent browser smoke test
- Vercel-compatible deployment

Do not add a database or authentication provider.

Before implementing model calls, check the current official OpenAI documentation for:

- GPT-5.6 model usage
- Responses API
- Structured Outputs
- Web search citations/annotations
- Moderation
- `safety_identifier`

Use current supported syntax rather than relying on memory.

---

# 8. Environment Variables

Create `.env.example` with:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
NEXT_PUBLIC_APP_URL=http://localhost:3000
WONDERLAB_ALLOW_SEEDED_FALLBACK=true
```

The OpenAI API key must remain server-side. Never expose it through a `NEXT_PUBLIC_` variable, browser bundle, client log, or generated artifact.

---

# 9. Suggested API Boundaries

Implement server routes equivalent to:

- `POST /api/routes`
- `POST /api/quest`
- `POST /api/evidence`
- `POST /api/reflect`

## `/api/routes`

Input:

- Question
- Level
- Duration
- Anonymous safety identifier

Output:

- Exactly three validated route objects

## `/api/quest`

Input:

- Question
- Level
- Duration
- Selected route

Output:

- Driving question
- Prediction prompt
- Investigation framing
- Creation challenge
- Two to four constraints
- Completion criteria
- Safety note
- Hint

## `/api/evidence`

Input:

- Question
- Selected route
- Learner prediction
- Level
- Duration

Output:

- Two to four evidence/inference/open-question items
- Normalized source list using actual web-search annotations
- Concise explanation
- Optional uncertainty note

## `/api/reflect`

Input:

- Question
- Route
- Prediction
- Evidence summary
- Learner artifact
- Three reflection fields

Output:

- Specific feedback
- Discovery summary
- Changed-thinking summary
- Optional key tradeoff
- Exactly three next questions
- Semantic map deltas

Validate all request and response payloads with Zod. Return typed, user-readable errors.

---

# 10. Data Model

Create clear TypeScript types or Zod-inferred types for:

- `CuriositySession`
- `ExplorationRoute`
- `QuestPlan`
- `SourceReference`
- `EvidenceItem`
- `EvidenceBundle`
- `ReflectionInput`
- `ReflectionResult`
- `CuriosityMapNode`
- `CuriosityMapEdge`
- `CuriosityMap`

A session should track:

- ID and timestamps
- Question, level, and duration
- Routes and selected route
- Quest plan
- Prediction
- Evidence
- Artifact
- Reflection input/result
- Map
- Mode: `live` or `seeded_fallback`

Do not ask the model for pixel coordinates. Generate semantic nodes/edges, then compute positions deterministically in the client.

---

# 11. AI Behavior Rules

Create reusable server-side prompt templates with these requirements.

## Required

- Treat the learner as capable.
- Preserve learner agency.
- Require prediction before explanation.
- Adapt complexity to the selected level.
- Keep text concise and UI-friendly.
- Generate routes that are methodologically distinct.
- Separate evidence, inference, and uncertainty.
- Use citations only when actually returned by web search.
- Keep activities safe and browser-completable.
- Give feedback grounded in the learner's actual words.
- End with exactly three non-trivial next questions.
- Admit uncertainty.

## Prohibited

- Completing a school assignment for the learner
- Producing an essay by default
- Fabricating sources
- Presenting inference as fact
- Generic praise-only feedback
- Assigning grades
- Diagnosing intelligence, disability, personality, or learning style
- Requesting personal or school information
- Suggesting dangerous physical experiments
- Claiming the product improves educational outcomes
- Infinite branching

Use a low or medium reasoning setting where appropriate and keep outputs short enough for a responsive demo. Do not add complexity solely to advertise model capability.

---

# 12. Safety and Privacy

Implement the following:

- 13+ disclosure
- Plain-language AI disclosure
- Initial input limit of 300 characters
- Input moderation before route generation
- Moderation of learner free text before sending it back to model endpoints when appropriate
- Stable anonymous `safety_identifier` generated and stored locally
- No names, emails, schools, accounts, or personal profile collection
- No database
- `Clear session` control
- No logging of full learner content in production

Safe activity types include:

- Thought experiment
- Design challenge
- Comparison
- Source evaluation
- Observation of ordinary safe phenomena
- Diagram
- Argument
- Causal model
- Simple calculation

Disallow unsupervised activities involving:

- Chemicals
- Fire or heat
- Electricity
- Pressure vessels
- Weapons
- Ingestion
- Bodily experimentation
- Illegal activity
- Dangerous locations
- Harm to animals or ecosystems

Display this disclosure in concise form:

> WonderLab uses AI and web sources to guide an investigation. AI can make mistakes. Check cited sources and involve a qualified adult for health, safety, or physical activities.

---

# 13. UX Direction

The product should feel like a premium curiosity and science studio.

Use:

- Spacious composition
- Strong typography
- Clear step progression
- Distinct route cards
- Compact evidence cards
- Visible citation links
- Restrained animation
- A readable, cinematic Curiosity Map reveal
- Responsive behavior
- Accessible focus states
- Reduced-motion support

Avoid:

- A generic full-screen chatbot
- Childish cartoon visuals
- Neon AI-gradient overload
- Dense dashboards
- Fake points or streaks
- Long walls of generated prose
- Confetti

Suggested screens:

1. Landing / Spark
2. Route Selection
3. Quest Workspace with stepper and compact map
4. Discovery view with expanded map and Discovery Card

The final map transformation after reflection should be the most visually memorable interaction.

---

# 14. Seeded Fallback

Create `data/demo-underwater.json` containing a complete, polished sample session for:

> Could humans live underwater?

The fallback must allow the entire canonical flow to run without live API access.

Requirements:

- It must be clearly labeled as a pre-generated demo.
- It must not pretend to be a live response.
- It should load only after an API failure or an explicit `Use demo quest` action.
- It should exercise the same UI components and state transitions as live mode.
- It should include valid public source URLs checked during development.

Also implement a text-outline fallback if the graph component fails.

---

# 15. Testing and Evaluation

Set up scripts such as:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run evals:fixtures
npm run evals:live
```

The exact names may differ, but document them.

## Deterministic Tests

Cover:

- Zod schemas
- State transitions
- Route uniqueness validator
- Map node/edge integrity
- Deterministic layout
- Markdown export
- Seeded full-flow smoke test

## Prompt Evaluation Fixtures

Use at least these topics:

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

Validate:

- Exactly three routes
- Route diversity
- Prediction before explanation
- Safe creation challenge
- Correct citation association
- Evidence/inference/open-question labels
- Specific reflection feedback
- Exactly three next questions
- No grades, diagnoses, or unsupported efficacy claims
- Response length suitable for UI

The evaluation suite measures product behavior, not learning efficacy.

---

# 16. Documentation Requirements

Create and maintain:

- `README.md`
- `docs/architecture.md`
- `docs/safety.md`
- `docs/evaluation.md`
- `docs/codex-contributions.md`
- `docs/demo-script.md`
- `docs/submission-checklist.md`
- `docs/implementation-plan.md`

The README must include:

- Product overview
- Education problem
- Core learning loop
- Canonical demo
- Screenshots placeholder section
- Architecture
- Setup
- Environment variables
- Test commands
- Seeded fallback instructions
- Safety/privacy decisions
- Known limitations
- Explicit Codex contribution summary
- Explicit GPT-5.6 contribution summary
- Web-search/citation explanation
- Deployed demo and video placeholders
- License

Do not overstate what was built or tested.

---

# 17. Execution Protocol

Proceed in this order.

## Phase 1: Inspect and Plan

1. Inspect the current repository and environment.
2. Determine whether the app should be initialized or adapted.
3. Verify current official OpenAI API patterns.
4. Create `docs/implementation-plan.md` with:
   - Architecture
   - File structure
   - Data flow
   - Build sequence
   - Risks
   - Acceptance checks
5. Create a concise task checklist of approximately 8–12 atomic implementation items.

Do not stop after planning. Begin implementation immediately unless a required secret or destructive decision blocks progress.

## Phase 2: Build a Fixture-Driven Vertical Slice

1. Build the complete static journey with fixture data.
2. Implement schemas and session state.
3. Ensure the full experience is navigable before adding live model calls.

## Phase 3: Add Live Intelligence

1. Moderation and route generation
2. Quest generation and prediction gate
3. Web-grounded Evidence Lens
4. Reflection feedback and next questions

Validate all outputs.

## Phase 4: Add the Visual Trace

1. Curiosity Map
2. Discovery Card
3. Markdown export
4. Seeded fallback and text fallback

## Phase 5: Test and Harden

1. Run lint, typecheck, unit tests, and browser smoke test.
2. Run fixture evaluations.
3. Run limited live evaluations if an API key is available.
4. Fix the highest-impact defects.
5. Verify API-key secrecy and citation integrity.

## Phase 6: Document and Prepare for Submission

1. Complete README and docs.
2. Add demo script and screenshot checklist.
3. Add deployment instructions.
4. Update `docs/codex-contributions.md` with factual contributions.
5. Leave clear placeholders for deployed URL, public video, and `/feedback` session ID.

---

# 18. Git and Change Discipline

If the repository is under Git:

- Inspect status before changing files.
- Do not overwrite unrelated user work.
- Make intentional commits at meaningful milestones if credentials and repository settings permit.
- Suggested milestones:
  1. Project skeleton and fixture flow
  2. Live route/quest/evidence APIs
  3. Reflection/map/export
  4. Tests, safety, docs, and deployment prep
- Use descriptive commit messages.
- Keep the project history useful for hackathon verification.

Do not push, publish, or perform destructive external actions without explicit authorization. Local implementation, testing, and documentation should proceed autonomously.

---

# 19. Decision Rules

When uncertain:

1. Prefer the smallest implementation that satisfies the product requirement.
2. Prefer a complete flow over an extra feature.
3. Prefer official APIs over custom plumbing.
4. Prefer deterministic UI logic over model-generated layout.
5. Prefer visible citations over unsupported prose.
6. Prefer a safe browser-based activity over a physical experiment.
7. Prefer one strong screen over three mediocre screens.
8. Prefer honest limitations over marketing claims.

Only stop for user input when:

- An API key or external secret is required and unavailable
- A destructive operation is necessary
- An external publish/deploy action requires authorization
- Existing repository state creates a genuine conflict that cannot be resolved safely

For ordinary implementation choices, choose a sensible default, document it, and continue.

---

# 20. Final Acceptance Checklist

Before declaring the MVP complete, verify:

- [ ] Public-facing flow is understandable without explanation
- [ ] Canonical demo completes live
- [ ] Canonical demo completes in seeded fallback mode
- [ ] Exactly three distinct routes are generated
- [ ] Prediction is required before evidence
- [ ] Evidence citations are real and clickable
- [ ] Evidence/inference/open-question categories are visible
- [ ] Creation challenge is safe and finite
- [ ] Reflection feedback is specific
- [ ] Exactly three next questions are generated
- [ ] Curiosity Map is readable and bounded
- [ ] Discovery Card exports as Markdown
- [ ] No API key reaches the browser
- [ ] 13+ and AI disclosures are visible
- [ ] Moderation and safe-activity constraints work
- [ ] Lint passes
- [ ] Type checking passes
- [ ] Unit tests pass
- [ ] Browser smoke test passes
- [ ] README setup works from a clean clone
- [ ] Codex and GPT-5.6 contributions are explicitly documented
- [ ] Demo and submission documents are ready

Begin by inspecting the repository, verifying the current official OpenAI integration patterns, creating the implementation plan, and then building the fixture-driven vertical slice.

## End Copy
