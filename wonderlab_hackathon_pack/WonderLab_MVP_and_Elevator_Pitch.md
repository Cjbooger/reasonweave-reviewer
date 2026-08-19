# WonderLab: MVP, Critique, and Elevator Pitch

> **Working title:** WonderLab: Curiosity Quest  
> **Track:** Education  
> **Primary audience:** Independent high-school and college learners, approximately age 13+  
> **Secondary audience:** Educators and parents who want a concise record of how a learner investigated an idea  
> **Hackathon objective:** Ship one polished, evidence-grounded learning loop that demonstrates meaningful use of Codex and GPT-5.6

---

## Executive Decision

WonderLab is worth building, but the original idea needs a narrower and more defensible shape for a short hackathon.

The strongest version is **not an AI tutor, homework helper, lesson planner, or infinite knowledge graph**. Those categories are crowded, difficult to differentiate, and prone to turning the learner into a passenger.

The refined product is:

> **WonderLab turns a learner's curiosity into a short, evidence-grounded quest in which the learner chooses a path, makes a prediction, examines evidence, creates something, reflects on what changed, and leaves with better questions.**

The product's central design rule is simple:

> **The AI expands the space of discovery while the learner keeps responsibility for prediction, judgment, creation, and reflection.**

This gives the project a clear educational purpose and a visually strong hackathon demo without overstating what a weekend prototype can prove.

---

# 1. Critique of the Original Concept

## What Was Strong

The original WonderLab concept had several genuinely strong ideas:

- It begins with something the learner already cares about rather than a prescribed lesson.
- It treats curiosity as a productive starting point, not a distraction from the curriculum.
- It encourages cross-disciplinary connections.
- It asks the learner to investigate and create rather than merely consume an answer.
- It ends with new questions, making curiosity visible as an evolving process.
- It can demonstrate capabilities that are difficult to reproduce with fixed educational software: adaptive framing, dynamic connections, evidence synthesis, and personalized follow-up.

Those ideas should remain. The flaws were mostly about scope, differentiation, safety, and proof.

## Critical Risks and Repairs

| Risk in the original concept | Why it weakens the project | Refined decision |
|---|---|---|
| It could look like another Socratic tutor | ChatGPT Study Mode and many tutoring products already guide learners with questions | Position WonderLab as a **curiosity-to-investigation studio**, not a tutor. It begins with an open curiosity, creates a finite inquiry experience, produces an artifact, and visualizes the learner's evolving thinking |
| The branching map could expand forever | Infinite exploration is difficult to build, hard to demo, expensive to run, and likely to become visually incoherent | Limit the MVP to one **5–10 minute Curiosity Quest**, three route choices, and roughly 6–10 map nodes |
| “Never give the answer” can become frustrating | Endless questions can feel evasive and may prevent legitimate explanation | Use **productive friction**: require a prediction or choice first, then reveal concise evidence. Include `Hint` and `Explain now` controls |
| The AI could hallucinate or overstate facts | An education product loses credibility immediately when its evidence is invented | Add an **Evidence Lens** using OpenAI web search, visible citations, and explicit labels for `Evidence`, `Inference`, and `Open Question` |
| The original concept lacked a measurable outcome | “It inspires curiosity” is an aspiration, not a hackathon proof point | Capture a **Learning Trace**: starting question, selected route, prediction, evidence considered, artifact or design, reflection, and new questions |
| The target learner was too broad | Designing simultaneously for young children, graduate students, and teachers would produce an inconsistent experience | Target high-school and college learners for the MVP. Let users choose `High school`, `College`, or `Curious adult` as a content-level preset |
| Young-user safety and privacy were unspecified | Open-ended AI interactions with minors require careful safeguards | Make the MVP 13+, anonymous, account-free, and data-minimal. Do not request names, schools, or personal profiles. Use moderation, age-appropriate disclosure, safe activity constraints, and local-only session persistence |
| “Learning styles” could creep into adaptation | Fixed visual/auditory/kinesthetic learning-style claims are not a sound product foundation | Adapt to **prior knowledge, available time, interest, and chosen activity type**, not claimed learning styles |
| The map could become the product instead of supporting learning | A visually impressive graph can still have little educational meaning | Every node must represent a learner action or justified concept: question, prediction, evidence, creation, reflection, or next question |
| A teacher dashboard would explode scope | Accounts, classes, rostering, analytics, and permissions are a second product | Provide one exportable **Discovery Card** or Learning Trace. A real educator dashboard is a post-hackathon feature |
| GPT use could appear superficial | One prompt that produces three questions would not demonstrate a non-trivial implementation | Use GPT-5.6 for structured route generation, adaptive quest planning, evidence-grounded synthesis, reflection feedback, and graph updates |
| The live demo could fail due to latency or web search | A failed or slow request could derail a short submission demo | Include a transparent, pre-seeded fallback quest for `Could humans live underwater?`, while keeping live generation as the primary path |
| The name may conflict with existing public uses | “WonderLab” is already used by organizations, including a science museum | Treat WonderLab as a working hackathon name. Use **WonderLab: Curiosity Quest** during the event and perform a proper naming review before commercialization |

---

# 2. Final Product Definition

## One-Sentence Product Definition

**WonderLab is an AI curiosity studio that turns any learner question into a short, source-backed quest of prediction, investigation, creation, reflection, and new questions.**

## The Problem

Generative AI makes answers abundant. That is useful, but it creates an educational failure mode: the learner can obtain a polished explanation or finished assignment without performing the intellectually valuable work.

Traditional search answers, “What information exists?”

Generic AI tutoring often answers, “How can I help you reach the expected answer?”

WonderLab asks a different question:

> **How can AI help a learner turn an initial spark of curiosity into an active investigation while preserving human agency?**

## The Product Thesis

Curiosity becomes educationally valuable when it is converted into action:

1. The learner asks something meaningful to them.
2. The learner chooses what aspect to pursue.
3. The learner commits to a prediction or initial model.
4. The learner examines credible evidence.
5. The learner creates, designs, compares, or explains something.
6. The learner reflects on how their thinking changed.
7. The learner leaves with sharper questions.

WonderLab makes that process visible and repeatable.

---

# 3. The Core Learning Loop

## SPARK → CHOOSE → PREDICT → INVESTIGATE → CREATE → REFLECT → BRANCH

### 1. Spark

The learner enters a question such as:

> Could humans live underwater?

They also choose a lightweight context:

- Level: High school, College, or Curious adult
- Quest length: 5, 10, or 15 minutes

No account, biography, school name, or surveillance-flavored “personalization profile” is required.

### 2. Choose

GPT-5.6 generates exactly three distinct routes. The labels may adapt to the topic, but each route should represent a different kind of thinking:

- **Understand:** Build a mental model of the core system
- **Challenge:** Test an assumption or examine a tradeoff
- **Create:** Design or propose something under constraints

Example:

| Route | Learner-facing hook |
|---|---|
| Survive the Pressure | What would pressure do to people and habitats? |
| Build the Habitat | How would you design a city for 100 residents? |
| Protect the Ocean | Could humans live underwater without damaging the ecosystem? |

Choosing a route replaces a long intake interview. The learner expresses intent by selecting what interests them.

### 3. Predict

Before receiving the explanation, the learner must state an initial belief, rank options, make a forecast, or sketch a model.

Example:

> Which is the largest obstacle to a permanent underwater city: pressure, oxygen, food, energy, or psychology? Explain your first guess in one or two sentences.

This creates a visible “before” state.

### 4. Investigate

WonderLab presents a concise Evidence Lens with two to four source-backed findings. It does not dump an encyclopedia onto the screen and call that teaching.

Each item is explicitly labeled:

- **Evidence:** Supported by a cited source
- **Inference:** A reasonable conclusion drawn from evidence
- **Open Question:** Uncertain, debated, or unresolved

The learner may ask for a hint or a direct explanation, but only after making an initial prediction or choice.

### 5. Create

The learner completes a small artifact aligned to the selected route.

Examples:

- Design an underwater habitat for 100 people under four constraints
- Create a causal diagram showing why pressure changes habitat design
- Compare two energy systems and defend one
- Write a short policy for protecting the surrounding ecosystem
- Propose a test that could invalidate the learner's design

For the MVP, the artifact can be a structured text response. Image generation, file uploads, drawing canvases, and CAD are post-hackathon enhancements.

### 6. Reflect

The learner completes three prompts:

- **I used to think…**
- **Now I think…**
- **I still wonder…**

GPT-5.6 responds with specific, restrained feedback. It should identify what changed, where reasoning improved, and what uncertainty remains. It must not shower every response with empty praise.

### 7. Branch

The Curiosity Map updates to show:

- The starting question
- The route selected
- The learner's prediction
- Evidence considered
- The created artifact
- The reflection
- Two or three next questions

The experience ends with a **Discovery Card** that can be copied or exported as Markdown.

---

# 4. The Hackathon MVP

## MVP Promise

A learner can enter one curiosity and complete one evidence-grounded Curiosity Quest from beginning to end in less than ten minutes.

## P0 Features: Must Ship

1. **Curiosity input**
   - Question field
   - Level preset
   - Quest duration preset
   - Sample prompt chips

2. **Three adaptive route cards**
   - Distinct reasoning approaches
   - Short title, hook, activity type, and estimated time
   - Exactly one route selected

3. **Prediction gate**
   - Learner must make an initial prediction or choice before evidence is shown
   - `Hint` and `Explain now` remain available after the attempt

4. **Evidence Lens**
   - Uses OpenAI web search
   - Displays source-backed claims with clickable citations
   - Distinguishes evidence, inference, and open questions

5. **Creation challenge**
   - One small artifact or design response
   - Clear constraints and completion criteria

6. **Reflection**
   - “I used to think / Now I think / I still wonder”
   - Specific AI feedback

7. **Curiosity Map**
   - Compact, progressive visual map
   - Deterministic layout
   - No infinite expansion

8. **Discovery Card / Learning Trace**
   - Summarizes the learner's path and changed thinking
   - Copy or export as Markdown

9. **Safety and reliability**
   - 13+ disclosure
   - Input length limit
   - Moderation
   - Safe-activity constraints
   - Error handling and seeded demo fallback

10. **Hackathon evidence**
    - README explaining Codex and GPT-5.6 contributions
    - Small prompt/evaluation suite
    - Deployable public demo

## Explicit Non-Goals

The MVP will not include:

- Student accounts or authentication
- Teacher class management
- Rostering, grades, or LMS integrations
- Long-term learner profiles
- Under-13 users
- Homework uploads or answer grading
- Camera, voice, PDF, or image ingestion
- Collaborative multiplayer quests
- A general-purpose chatbot
- Infinite graph exploration
- Automatic curriculum alignment
- Claims that WonderLab improves grades, retention, or curiosity without evidence
- Physical experiments involving heat, electricity, pressure, chemicals, ingestion, bodily testing, weapons, or dangerous materials

These are not forgotten features. They are deliberately excluded so the core product can ship by the deadline.

---

# 5. The Demo-Defining Moment

## The “Wow” Moment

The learner begins with one broad question:

> Could humans live underwater?

After choosing a route, predicting the primary obstacle, inspecting evidence, and designing a habitat, the learner submits a reflection.

The single-node screen then transforms into a compact Curiosity Map that shows:

- What the learner initially believed
- What evidence changed or refined that belief
- What the learner created
- Which tradeoff they recognized
- What they still do not know
- Three sharper next questions

The final Discovery Card reads like evidence of thought, not a transcript of answers.

That transformation is the centerpiece of the submission video and screenshots.

---

# 6. Educational Value

WonderLab is designed around observable learner behaviors rather than unsupported claims of learning efficacy.

| Educational behavior | How the MVP supports it |
|---|---|
| Agency | The learner begins with their own question and chooses a route |
| Active participation | The learner predicts before receiving evidence |
| Metacognition | The reflection captures how thinking changed |
| Evidence literacy | Claims are sourced and separated from inference and uncertainty |
| Transfer and synthesis | The creation challenge requires applying evidence under constraints |
| Curiosity development | The session ends with sharper follow-up questions |
| Productive struggle | The app introduces friction before explanation but offers escape hatches |
| Visible process | The Curiosity Map and Learning Trace show the sequence of reasoning |

The MVP does **not** claim to prove improved learning outcomes. It demonstrates a defensible educational interaction and creates data that could support later research.

---

# 7. Differentiation

## WonderLab Is Not Study Mode

| Conventional study/tutoring mode | WonderLab |
|---|---|
| Begins with assigned material or a known problem | Begins with an open curiosity |
| Guides toward a target answer | Guides through an investigation |
| Primarily conversational | Structured, visual, and artifact-driven |
| Measures task completion or correctness | Captures a trace of changing understanding |
| Often stays within one subject | Encourages justified cross-disciplinary connections |
| Ends when the question is answered | Ends with a creation and better questions |

## WonderLab Is Not a Search Engine

Search retrieves information. WonderLab sequences human actions around information: choose, predict, evaluate, create, and reflect.

## WonderLab Is Not an Answer Generator

The product never treats the final explanation as the sole output. Its valuable artifact is the learner's **Learning Trace**.

## WonderLab Is Not an Infinite AI Playground

The quest has a clear beginning, bounded middle, and visible completion state. This matters for both educational coherence and demo reliability.

---

# 8. Hackathon Alignment

The current OpenAI Build Week judging criteria weight four areas equally. WonderLab is designed to show evidence in each category.

| Judging area | WonderLab evidence |
|---|---|
| Technological implementation | Codex-built application; GPT-5.6 structured generation across multiple stages; OpenAI web search with citations; moderation; schema validation; test/evaluation suite; resilient demo fallback |
| Design | One coherent end-to-end journey; polished route cards; progressive Evidence Lens; visible stepper; compact Curiosity Map; exportable Discovery Card |
| Potential impact | Addresses a recognizable education problem: AI can complete intellectual work instead of supporting it; serves learners and produces a useful trace for educators or parents |
| Quality of idea | Reframes AI from answer machine to curiosity infrastructure; differentiates through prediction-first interaction, evidence labeling, creation, and visible changes in thinking |

The project should emphasize **meaningful** use of both Codex and GPT-5.6:

- Codex is used to plan, implement, test, debug, document, and prepare the submission.
- GPT-5.6 powers distinct adaptive behaviors that would be difficult to reproduce with static templates.
- OpenAI web search grounds evidence and exposes citations.
- Structured outputs turn model behavior into reliable product state rather than an uncontrolled chat transcript.

---

# 9. Success Criteria

## Product Success

The MVP is successful when a first-time learner can:

1. Understand the product within ten seconds.
2. Enter or select a curiosity.
3. Choose among three genuinely different routes.
4. Make a prediction before seeing evidence.
5. Read concise, cited evidence.
6. Complete a creation challenge.
7. Reflect on how their thinking changed.
8. View and export a meaningful Learning Trace.

## Technical Success

- The primary demo path works from a deployed URL without authentication.
- API keys never reach the browser.
- All model outputs used by the UI conform to validated schemas.
- Evidence items display valid source links or are explicitly marked as inference/open question.
- Failure states are readable and recoverable.
- A seeded fallback can reproduce the main demo flow if a live call fails.
- Lint, type-checking, unit tests, and the core smoke test pass.

## Submission Success

- The demo video is public, narrated, and under three minutes.
- The README explicitly explains what Codex built and where GPT-5.6 is essential.
- The repository includes setup, sample data, testing instructions, and a license if public.
- The main Codex build thread is preserved and its `/feedback` session ID is submitted.
- The Devpost entry clearly identifies the Education track and the learner problem.

---

# 10. Elevator Pitches

## Tagline

> **Most AI ends curiosity with an answer. WonderLab turns it into a quest.**

## Product Promise

> **Leave with something you made and a better question than the one you started with.**

## 10-Second Pitch

> WonderLab turns any learner question into a short, source-backed quest where the learner predicts, investigates, creates, and reflects instead of simply receiving an answer.

## 30-Second Pitch

> Generative AI can give students polished answers before they have done any meaningful thinking. WonderLab takes the opposite approach. A learner starts with something they are genuinely curious about, chooses one of three investigation paths, makes a prediction, examines cited evidence, creates a small artifact, and reflects on how their thinking changed. The result is a visual Curiosity Map and Learning Trace that show the learning process, not just the final answer.

## 60-Second Pitch

> AI has made answers nearly free, but education is not the production of answers. The valuable work is choosing what matters, forming a hypothesis, evaluating evidence, creating something, and revising your thinking. WonderLab is an AI curiosity studio for high-school and college learners. A learner enters any question, such as “Could humans live underwater?” GPT-5.6 generates three distinct exploration routes. The learner chooses one, commits to a prediction, and then receives concise, source-backed evidence. They use that evidence to complete a design or creation challenge and reflect on what changed. WonderLab turns the session into a visual Curiosity Map and exportable Learning Trace. Most AI ends curiosity with an answer. WonderLab turns it into a quest while keeping the human responsible for the thinking.

## Judge-Facing Pitch

> WonderLab demonstrates how GPT-5.6 can support education without replacing the learner's intellectual work. It combines structured adaptive generation, live web-grounded evidence, reflection feedback, and a visual learning trace in one complete product experience. The learner supplies the curiosity, prediction, judgment, and creation. The model supplies scaffolding, connections, evidence synthesis, and productive next questions.

## Devpost Short Description

> WonderLab is an AI curiosity studio for high-school and college learners. Instead of answering a question immediately, it turns that question into a short, evidence-grounded quest. Learners choose an exploration route, make a prediction, examine cited evidence, complete a creation challenge, and reflect on how their thinking changed. GPT-5.6 adapts the quest and generates a compact visual Curiosity Map, while OpenAI web search grounds factual claims. The final Learning Trace shows what the learner believed, considered, created, changed, and still wonders. WonderLab uses AI to amplify curiosity while preserving human agency.

## Demo Opening Line

> “AI can now finish a student's work in seconds. We built WonderLab to make the student do the part that actually matters.”

## Demo Closing Line

> “WonderLab does not measure how quickly AI reached an answer. It shows how a learner's question became evidence, creation, reflection, and a better question.”

---

# 11. Naming Recommendation

`WonderLab` is memorable and fits the concept, but it is already used publicly by other organizations. For the hackathon, use:

> **WonderLab: Curiosity Quest**

Before continuing commercially, perform a proper product-name and trademark review. Possible future alternatives include:

- Curiosity Quest
- WonderTrail
- QuestionForge
- Branchpoint
- Spark Atlas
- Inquiry Lab

The hackathon should not spend critical build hours on an extensive naming exercise.

---

# 12. Immediate Administrative Notes

- The requested **$100 benefit is for Codex credits, not OpenAI API usage**. A funded API account or separate API credits are still required for the deployed GPT-5.6 experience.
- Create the Devpost submission as a draft early to avoid last-minute administrative risk.
- Start the main implementation in one primary Codex thread and preserve it for the required `/feedback` session ID.
- Keep the project free and accessible to judges through the judging period.
- Record the demo once the core app is stable, then continue improving the product without delaying the submission assets.

---

# 13. Official References

These sources should be checked again before final submission because hackathon and platform requirements can change.

- OpenAI Build Week overview: <https://openai.devpost.com/>
- Official rules: <https://openai.devpost.com/rules>
- Build Week resources: <https://openai.devpost.com/resources>
- Build Week FAQ: <https://openai.devpost.com/details/faqs>
- OpenAI Study Mode: <https://openai.com/index/chatgpt-study-mode/>
- OpenAI on the AI education opportunity: <https://openai.com/index/ai-education-opportunity/>
- OpenAI API documentation: <https://developers.openai.com/api/docs/>
- OpenAI safety best practices: <https://platform.openai.com/docs/guides/safety-best-practices>

---

## Final Build Recommendation

Build **one excellent Curiosity Quest** from spark to Discovery Card. Do not build a platform, curriculum engine, class dashboard, social network, or complex graph infrastructure.

The strongest version of WonderLab makes one claim and proves it on screen:

> **AI can increase the amount of thinking a learner does instead of reducing it.**
