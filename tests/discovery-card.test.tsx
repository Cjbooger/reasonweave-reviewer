import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoveryCard } from "@/components/discovery-card";
import seededDemoJson from "@/data/demo-underwater.json";
import { seededDemoSessionSchema } from "@/lib/schemas";

describe("Discovery Card evidence trace", () => {
  it("links the learner's selected finding to its visible source", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    render(<DiscoveryCard session={session} />);

    const atAGlance = screen.getByRole("region", { name: "At a glance" });
    expect(
      within(atAGlance).getByText(session.reflectionInput!.usedToThink),
    ).toBeVisible();
    expect(
      within(atAGlance).getByText(session.reflectionInput!.nowThink),
    ).toBeVisible();
    const compactJudgmentLabel = within(atAGlance).getByText(
      "My evidence judgment",
      { selector: "dt" },
    );
    const compactJudgmentRow = compactJudgmentLabel.closest(".trace-row");
    expect(compactJudgmentRow).not.toBeNull();
    expect(
      within(compactJudgmentRow as HTMLElement).getByText(
        /Complicates my prediction/,
      ),
    ).toBeVisible();
    expect(
      within(compactJudgmentRow as HTMLElement).getByText(
        new RegExp(
          session.evidenceDecision!.impact.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      ),
    ).toBeVisible();
    expect(
      within(compactJudgmentRow as HTMLElement).getByText(
        new RegExp(
          session.evidenceDecision!.unresolved.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      ),
    ).toBeVisible();
    expect(
      within(atAGlance).getByText(session.evidenceApplication!.designChoice),
    ).toBeVisible();
    const selectedFinding = session.evidence!.items.find(
      (item) => item.id === session.evidenceDecision!.evidenceItemId,
    );
    expect(selectedFinding).toBeDefined();
    expect(
      within(atAGlance).getByText(selectedFinding!.statement),
    ).toBeVisible();
    const summarySources = within(atAGlance).getByRole("list", {
      name: "Sources for the selected finding summary",
    });
    expect(
      within(summarySources).getByText(
        "Aquarius Reef Base Facilities and Vessels",
      ),
    ).toBeVisible();

    const fullTrace = screen
      .getByText("Full learning trace")
      .closest("details");
    expect(fullTrace).not.toBeNull();
    fireEvent.click(fullTrace!.querySelector("summary") as HTMLElement);

    const decisionLabel = within(fullTrace as HTMLElement).getByText(
      "Evidence decision",
      {
        selector: "dt",
      },
    );
    const decisionRow = decisionLabel.closest(".trace-row");
    expect(decisionRow).not.toBeNull();

    const row = within(decisionRow as HTMLElement);
    expect(
      row.getByText(
        /The selected finding and its cited sources establish that Aquarius can support up to six crew/,
      ),
    ).toBeInTheDocument();
    expect(
      row.getByText(
        /A 100-person habitat's safety and independence remain unresolved/,
      ),
    ).toBeInTheDocument();
    expect(
      row.getByText(/FIU's Aquarius lab supports up to six crew/),
    ).toBeInTheDocument();

    const sourceList = row.getByRole("list", {
      name: "Sources for the selected finding",
    });
    expect(
      within(sourceList).getByText("Aquarius Reef Base Facilities and Vessels"),
    ).toBeVisible();
    expect(within(sourceList).getByText(/environment\.fiu\.edu/)).toBeVisible();

    const sourceLink = within(sourceList).getByRole("link", {
      name: /Aquarius Reef Base Facilities and Vessels.*environment\.fiu\.edu.*opens in a new tab/i,
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
    );
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(sourceList).getAllByRole("link")).toHaveLength(1);

    const applicationLabel = screen.getByText("Evidence → design", {
      selector: "dt",
    });
    const applicationRow = applicationLabel.closest(".trace-row");
    expect(applicationRow).not.toBeNull();
    expect(
      within(applicationRow as HTMLElement).getByText(
        new RegExp(
          session.evidenceApplication!.designChoice.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      ),
    ).toBeVisible();
    expect(
      within(applicationRow as HTMLElement).getByText(
        /Linked finding: FIU's Aquarius lab supports up to six crew/,
      ),
    ).toBeVisible();

    const nextQuestionLabel = within(fullTrace as HTMLElement).getByText(
      "My next question",
      {
        selector: "dt",
      },
    );
    const nextQuestionRow = nextQuestionLabel.closest(".trace-row");
    expect(nextQuestionRow).not.toBeNull();
    expect(
      within(nextQuestionRow as HTMLElement).getByText(
        session.reflectionResult!.newQuestions[2],
      ),
    ).toBeVisible();

    const response = within(fullTrace as HTMLElement).getByRole("region", {
      name: "ReasonWeave response",
    });
    const feedbackLabel = within(response).getByText("Feedback", {
      selector: "dt",
    });
    const feedbackRow = feedbackLabel.closest(".trace-row");
    expect(feedbackRow).not.toBeNull();
    expect(
      within(feedbackRow as HTMLElement).getByText(
        /Your evidence judgment \(complicates\).*Your creation: At 20 meters, I would use a surface-linked support module/,
      ),
    ).toBeVisible();
  });

  it("derives the compact evidence judgment from the active learner session", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const changedSession = {
      ...session,
      evidenceDecision: {
        ...session.evidenceDecision!,
        relationship: "challenges" as const,
        impact:
          "This challenges my pressure-first prediction because repair access now looks like the tighter limit.",
      },
    };

    render(<DiscoveryCard session={changedSession} />);

    const atAGlance = screen.getByRole("region", { name: "At a glance" });
    const judgmentLabel = within(atAGlance).getByText("My evidence judgment", {
      selector: "dt",
    });
    const judgmentRow = judgmentLabel.closest(".trace-row");
    expect(judgmentRow).not.toBeNull();
    expect(
      within(judgmentRow as HTMLElement).getByText(/Challenges my prediction/),
    ).toBeVisible();
    expect(
      within(judgmentRow as HTMLElement).getByText(
        /This challenges my pressure-first prediction because repair access now looks like the tighter limit\./,
      ),
    ).toBeVisible();
    expect(
      within(judgmentRow as HTMLElement).queryByText(
        /Complicates my prediction/,
      ),
    ).not.toBeInTheDocument();
  });

  it("bounds the compact judgment while preserving the full learner wording", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const impact = "I".repeat(300);
    const unresolved = "U".repeat(300);
    const changedSession = {
      ...session,
      evidenceDecision: {
        ...session.evidenceDecision!,
        impact,
        unresolved,
      },
    };

    render(<DiscoveryCard session={changedSession} />);

    const atAGlance = screen.getByRole("region", { name: "At a glance" });
    const judgmentLabel = within(atAGlance).getByText("My evidence judgment", {
      selector: "dt",
    });
    const judgmentRow = judgmentLabel.closest(".trace-row");
    expect(judgmentRow).not.toBeNull();
    const compactText = within(judgmentRow as HTMLElement)
      .getByText(/Why it matters:/)
      .textContent?.trim();
    expect(compactText?.length).toBeLessThanOrEqual(300);
    expect(compactText?.match(/…/g)).toHaveLength(2);

    fireEvent.click(screen.getByText("Full learning trace"));
    const fullTrace = document.querySelector("details.full-learning-trace");
    expect(fullTrace).not.toBeNull();
    expect(
      within(fullTrace as HTMLElement).getByText(
        new RegExp(`I{${impact.length}}`),
      ),
    ).toBeVisible();
    expect(
      within(fullTrace as HTMLElement).getByText(
        new RegExp(`U{${unresolved.length}}`),
      ),
    ).toBeVisible();
  });

  it("exposes an optional, non-evaluative facilitator prompt", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    render(<DiscoveryCard session={session} />);

    const discussion = screen.getByRole("region", {
      name: "Discuss this trace",
    });
    expect(
      within(discussion).getByText(
        "What would make you revise that evidence decision or design choice?",
      ),
    ).toBeVisible();
    expect(
      within(discussion).getByText(
        "Optional discussion prompt—not a score or diagnosis.",
      ),
    ).toBeVisible();
  });

  it("shows the exact learner-selected creation anchor without presenting a score", () => {
    const parsed = seededDemoSessionSchema.parse(seededDemoJson);
    const artifactAnchor =
      parsed.evidenceApplication!.artifactAnchor ?? "regular deliveries";
    const session = {
      ...parsed,
      evidenceApplication: {
        ...parsed.evidenceApplication!,
        artifactAnchor,
      },
    };

    render(<DiscoveryCard session={session} />);

    const atAGlance = screen.getByRole("region", { name: "At a glance" });
    const anchorLabel = within(atAGlance).getByText("Creation anchor", {
      selector: "dt",
    });
    const anchorRow = anchorLabel.closest(".trace-row");
    expect(anchorRow).not.toBeNull();
    expect(
      within(anchorRow as HTMLElement).getByText(
        `“${artifactAnchor}” — exact phrase repeated in the design move and creation.`,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByText("Full learning trace"));
    const evidenceToDesignLabel = screen.getByText("Evidence → design", {
      selector: "dt",
    });
    expect(
      within(
        evidenceToDesignLabel.closest(".trace-row") as HTMLElement,
      ).getByText(
        new RegExp(`Learner-selected creation anchor: “${artifactAnchor}”`),
      ),
    ).toBeVisible();
    const creationLabel = screen.getByText("Creation", { selector: "dt" });
    expect(
      within(creationLabel.closest(".trace-row") as HTMLElement).getByText(
        new RegExp(`Creation anchor: “${artifactAnchor}”`),
      ),
    ).toBeVisible();
    expect(screen.queryByText(/anchor score/i)).not.toBeInTheDocument();
  });

  it("keeps historical sessions without a creation anchor readable", () => {
    const parsed = seededDemoSessionSchema.parse(seededDemoJson);
    const session = structuredClone(parsed);
    delete session.evidenceApplication!.artifactAnchor;

    render(<DiscoveryCard session={session} />);

    expect(
      screen.queryByText("Creation anchor", { selector: "dt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(session.evidenceApplication!.designChoice),
    ).toBeVisible();
  });
});
