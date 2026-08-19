import { describe, expect, it } from "vitest";

import {
  assignmentRedirectGuidance,
  classifyAssignmentRequest,
} from "@/lib/learner-agency";
import {
  buildEvidencePrompt,
  buildQuestPrompt,
  buildReflectionPrompt,
  buildRoutesPrompt,
} from "@/lib/openai/prompts";

const assignmentRequest = "Write my five-paragraph essay about ocean habitats.";

describe("assignment request classification", () => {
  it.each([
    "Write my five-paragraph essay about ocean habitats.",
    "Could you write a full research paper about photosynthesis?",
    "Please complete my homework assignment for me.",
    "Answer every question on this worksheet without explanation.",
    "Generate a lab report with citations and a works cited page.",
    "I need you to build my class project before the deadline.",
    "Rewrite my final essay so I can turn it in.",
    "Give me the answers only for this problem set.",
    "Hey, can you write an essay about the causes of World War I?",
    "I need a 1200-word paper about renewable energy.",
    "A five-paragraph essay on symbolism in the novel.",
    "Write a poem for my class.",
    "Answer questions 1-10 and give me only the final answers.",
    "Please supply a submission-ready essay.",
    "Provide the full homework response for submission.",
    "I need a ready-to-submit response for this worksheet.",
    "Can you provide a solution to every problem on my homework?",
    "Can you give me the solution to my homework?",
    "Give me a solution for my math assignment.",
    "Tell me the answers to this worksheet.",
    "I want the finished homework.",
    "Do my schoolwork for me.",
    "Just answer all the worksheet questions.",
    "Could you just answer every question on my homework?",
    "Can you simply write my essay about climate change?",
    "For my English class, write an essay about symbolism.",
    "Send me the completed paper.",
    "Can you do my essay?",
  ])("detects submit-ready completion: %s", (request) => {
    expect(classifyAssignmentRequest(request).kind).toBe(
      "submit_ready_completion",
    );
  });

  it.each([
    "How do essays persuade readers?",
    "How do I write an evidence-based essay?",
    "How can I write my essay without losing my own voice?",
    "Do essays need explicit conclusions?",
    "What makes a strong thesis statement?",
    "Why do teachers assign homework?",
    "Help me understand this quadratic equation.",
    "Help me brainstorm claims for my paper.",
    "Create an outline for my essay.",
    "Give me feedback on my draft report.",
    "Compare three possible thesis statements.",
    "Could you show me how to solve my homework problem?",
    "Can you write an outline for my essay?",
    "The assignment asks for five paragraphs. How should I approach it?",
    "Can you prepare practice questions for my exam?",
    "Create a study guide for my test.",
    "Can you provide an explanation of my homework problem?",
    "Please provide examples of strong essays.",
    "Make flashcards to help me study for my exam.",
    "Create a practice quiz so I can prepare for my test.",
    "Provide a worked example of a similar problem without solving my homework.",
    "Can you explain this homework problem for me?",
    "Could humans live underwater?",
  ])("preserves learner-owned inquiry or scaffolding: %s", (request) => {
    expect(classifyAssignmentRequest(request).kind).toBe("learner_owned");
  });

  it("requires multiple independent signals rather than one keyword", () => {
    const classification = classifyAssignmentRequest(
      "How do essays persuade readers?",
    );

    expect(classification.signals).toContain("deliverable");
    expect(classification.signals).toContain("inquiry");
    expect(classification.signals).not.toContain("direct_request");
    expect(classification.kind).toBe("learner_owned");
  });
});

describe("assignment redirect prompt boundary", () => {
  it("returns fixed guidance without copying learner text", () => {
    const guidance = assignmentRedirectGuidance(assignmentRequest);

    expect(guidance).toContain("LEARNER_AGENCY_REDIRECT");
    expect(guidance).toContain("build their own outline");
    expect(guidance).toContain("never supply submission-ready prose");
    expect(guidance).not.toContain(assignmentRequest);
  });

  it("adds the same redirect to every server-side generation stage", () => {
    const route = {
      id: "evidence-map",
      title: "Build an Evidence Map",
      hook: "Compare claims before choosing your own position.",
      lens: "compare",
      activityType: "evidence map",
      estimatedMinutes: 10,
      iconKey: "scales",
    };
    const prompts = [
      buildRoutesPrompt({
        question: assignmentRequest,
        level: "high_school",
        durationMinutes: 10,
      }),
      buildQuestPrompt({
        question: assignmentRequest,
        level: "high_school",
        durationMinutes: 10,
        selectedRoute: route,
      }),
      buildEvidencePrompt({
        question: assignmentRequest,
        level: "high_school",
        durationMinutes: 10,
        selectedRoute: route,
        prediction:
          "I predict evidence quality will shape the strongest claim.",
      }),
      buildReflectionPrompt({
        question: assignmentRequest,
        route,
        prediction:
          "I predict evidence quality will shape the strongest claim.",
        evidenceRelationship: "complicates",
        evidenceSummary: "The sources support different parts of the topic.",
        artifact: "I made an outline with a claim and evidence map.",
        reflection: {
          usedToThink: "I used to think one source was enough.",
          nowThink: "Now I think claims need different kinds of support.",
          stillWonder: "I still wonder which counterclaim is strongest.",
        },
      }),
    ];

    for (const prompt of prompts) {
      expect(prompt).toContain("LEARNER_AGENCY_REDIRECT");
      expect(prompt).toContain("write the substantive response themselves");
    }
  });

  it("does not add assignment language to a curiosity about essays", () => {
    const prompt = buildRoutesPrompt({
      question: "How do essays persuade readers?",
      level: "high_school",
      durationMinutes: 10,
    });

    expect(prompt).not.toContain("LEARNER_AGENCY_REDIRECT");
  });
});
