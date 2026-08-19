import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import {
  buildDiscoveryMarkdown,
  exportSessionToMarkdown,
} from "@/lib/export-markdown";
import {
  createCuriositySession,
  migrateStoredCuriositySession,
} from "@/lib/session-machine";
import { curiositySessionSchema, seededDemoSessionSchema } from "@/lib/schemas";

const seededDemo = seededDemoSessionSchema.parse(seededDemoJson);

describe("Discovery Card Markdown export", () => {
  it("exports the complete learner trace with associated source links", () => {
    const markdown = exportSessionToMarkdown(seededDemo);

    expect(markdown).toContain("# ReasonWeave Learning Trace");
    expect(markdown).toContain("## Initial prediction");
    expect(markdown).toContain("## Evidence Lens");
    expect(markdown).toContain(
      "[How does pressure change with ocean depth?](<https://oceanservice.noaa.gov/facts/pressure.html>)",
    );
    expect(markdown).toContain("## Creation");
    expect(markdown).toContain("## Evidence → design");
    expect(markdown).toContain(seededDemo.evidenceApplication!.designChoice);
    expect(markdown).toContain("## Learner evidence decision");
    expect(markdown).toContain("Complicates the initial prediction");
    expect(markdown).toContain(seededDemo.evidenceDecision!.establishes);
    expect(markdown).toContain(seededDemo.evidenceDecision!.unresolved);
    expect(markdown).toContain(
      "What the cited sources do not settle (source scope)",
    );
    expect(markdown).toContain(seededDemo.evidenceDecision!.impact);
    expect(markdown).toContain("FIU's Aquarius lab supports up to six crew");
    expect(markdown).toContain(
      "[Aquarius Reef Base Facilities and Vessels](<https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/>)",
    );
    expect(markdown).toContain("## Reflection");
    expect(markdown).toContain("## My next question");
    expect(markdown).toContain(seededDemo.reflectionResult!.newQuestions[2]);
    expect(markdown).toContain("## Three next questions");
    seededDemo.reflectionResult?.newQuestions.forEach((question) => {
      expect(markdown).toContain(question);
    });
    expect(markdown).toContain("## Discuss this trace");
    expect(markdown).toContain(
      "What would make you revise that evidence decision or design choice?",
    );
    expect(markdown).toContain(
      "Optional discussion prompt—not a score or diagnosis.",
    );
  });

  it("makes seeded fallback status explicit", () => {
    const markdown = buildDiscoveryMarkdown(seededDemo);

    expect(markdown).toContain("**Pre-generated demo:**");
    expect(markdown).toContain(seededDemo.seededDisclosure!);
  });

  it("exports the exact creation anchor as phrase continuity, not a grade", () => {
    const artifactAnchor =
      seededDemo.evidenceApplication!.artifactAnchor ?? "regular deliveries";
    const session = {
      ...seededDemo,
      evidenceApplication: {
        ...seededDemo.evidenceApplication!,
        artifactAnchor,
      },
    };

    const markdown = exportSessionToMarkdown(session);

    expect(markdown).toContain(
      "**Creation anchor (exact learner-selected phrase repeated in the design move and creation):**",
    );
    expect(markdown).toContain(`> ${artifactAnchor}`);
    expect(markdown).not.toMatch(/anchor score|semantic grade/i);
  });

  it("exports historical sessions without inventing a creation anchor", () => {
    const session = structuredClone(seededDemo);
    delete session.evidenceApplication!.artifactAnchor;

    const markdown = exportSessionToMarkdown(session);

    expect(markdown).not.toContain("Creation anchor");
    expect(markdown).toContain(session.evidenceApplication!.designChoice);
    expect(markdown).toContain(session.artifact!);
  });

  it("preserves every historical constraint and criterion in a migrated export", () => {
    const legacy = structuredClone(seededDemoJson);
    const historicalConstraints = [
      "A historical fourth independent design requirement.",
      "A historical fifth independent design requirement.",
    ];
    const historicalCriteria = [
      "A historical third independent completion target.",
      "A historical fourth independent completion target.",
    ];
    legacy.quest.constraints.push(...historicalConstraints);
    legacy.quest.completionCriteria.push(...historicalCriteria);
    delete (legacy.quest as { timeBudget?: unknown }).timeBudget;

    const migrated = curiositySessionSchema.parse(
      migrateStoredCuriositySession(legacy),
    );
    const markdown = exportSessionToMarkdown(migrated);

    for (const constraint of historicalConstraints) {
      expect(markdown).toContain(constraint);
    }
    for (const criterion of historicalCriteria) {
      expect(markdown).toContain(criterion);
    }
  });

  it("excludes private and implementation metadata", () => {
    const markdown = exportSessionToMarkdown(seededDemo);

    expect(markdown.includes(seededDemo.id)).toBe(false);
    expect(markdown.includes(seededDemo.createdAt)).toBe(false);
    expect(markdown.includes("selectedRouteId")).toBe(false);
    expect(markdown.includes("mapDeltas")).toBe(false);
    expect(markdown.includes("safetyIdentifier")).toBe(false);
  });

  it("does not export an unfinished session as a Discovery Card", () => {
    const unfinished = createCuriositySession(
      {
        question: "Can plants communicate?",
        level: "high_school",
        durationMinutes: 10,
      },
      { id: "unfinished-session", now: "2026-07-16T12:00:00.000Z" },
    );

    expect(() => exportSessionToMarkdown(unfinished)).toThrow(
      "available after the quest and reflection are complete",
    );
  });

  it("keeps learner and model text inert in permissive Markdown renderers", () => {
    const adversarial = structuredClone(seededDemo);
    adversarial.question = "<img src=x onerror=alert(1)>\n# False heading";
    adversarial.artifact =
      "![tracking](https://example.com/pixel)\n```html\n<script>alert(1)</script>\n```\n~~~html\n===\nsetext";
    adversarial.evidenceDecision!.impact =
      "This finding <script>alert(4)</script> complicates [my claim](javascript:alert(5)).";
    adversarial.evidenceApplication!.designChoice =
      "Because of [this](javascript:alert(6)), I chose <img src=x onerror=alert(7)>.";
    adversarial.reflectionResult!.specificFeedback =
      "[click me](javascript:alert(1)) | injected cell";
    adversarial.evidence!.sources[0] = {
      id: "hostile-source",
      title: "Hostile ] source",
      url: "https://example.com/a)\n<script>alert(3)</script>",
      domain: "example.com",
    };
    adversarial.evidence!.items[0].sourceIds = ["hostile-source"];

    const markdown = exportSessionToMarkdown(adversarial);

    expect(markdown).toContain("&lt;img src=x onerror=alert\\(1\\)&gt;");
    expect(markdown).toContain("\\# False heading");
    expect(markdown).toContain(
      "\\!\\[tracking\\]\\(https://example.com/pixel\\)",
    );
    expect(markdown).toContain("&lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(markdown).toContain(
      "This finding &lt;script&gt;alert\\(4\\)&lt;/script&gt; complicates \\[my claim\\]\\(javascript:alert\\(5\\)\\).",
    );
    expect(markdown).toContain(
      "Because of \\[this\\]\\(javascript:alert\\(6\\)\\), I chose &lt;img src=x onerror=alert\\(7\\)&gt;.",
    );
    expect(markdown).toContain("\\~\\~\\~html");
    expect(markdown).toContain("\\===");
    expect(markdown).toContain(
      "\\[click me\\]\\(javascript:alert\\(1\\)\\) \\| injected cell",
    );
    expect(markdown).toContain(
      "[Hostile \\] source](<https://example.com/a)%3Cscript%3Ealert(3)%3C/script%3E>)",
    );
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("![tracking]");
  });
});
