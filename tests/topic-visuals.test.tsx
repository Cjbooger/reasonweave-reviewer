import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoveryCard } from "@/components/discovery-card";
import seededDemoJson from "@/data/demo-underwater.json";
import { seededDemoSessionSchema } from "@/lib/schemas";
import {
  CANONICAL_UNDERWATER_QUESTION,
  isCanonicalUnderwaterQuestion,
} from "@/lib/topic-visuals";
import type { CuriositySession } from "@/types/curiosity";

describe("question-aware visuals", () => {
  it("recognizes only the normalized canonical underwater question", () => {
    expect(isCanonicalUnderwaterQuestion(CANONICAL_UNDERWATER_QUESTION)).toBe(
      true,
    );
    expect(
      isCanonicalUnderwaterQuestion("  could humans   LIVE underwater?  "),
    ).toBe(true);
    expect(isCanonicalUnderwaterQuestion("Could humans live on Mars?")).toBe(
      false,
    );
    expect(
      isCanonicalUnderwaterQuestion("Why do songs get stuck in our heads?"),
    ).toBe(false);
  });

  it("replaces the underwater Discovery thumbnail for another live topic", () => {
    const underwater = seededDemoSessionSchema.parse(seededDemoJson);
    const otherTopic: CuriositySession = {
      ...underwater,
      question: "Why do songs get stuck in our heads?",
      mode: "live",
      seededDisclosure: undefined,
    };

    const { container, rerender } = render(
      <DiscoveryCard session={underwater} />,
    );
    expect(
      screen.getByRole("img", { name: /underwater habitat/i }),
    ).toHaveAttribute("loading", "lazy");
    expect(
      container.querySelector('[data-topic-visual="neutral-discovery"]'),
    ).not.toBeInTheDocument();

    rerender(<DiscoveryCard session={otherTopic} />);

    expect(
      screen.queryByRole("img", { name: /underwater habitat/i }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-topic-visual="neutral-discovery"]'),
    ).toBeInTheDocument();
  });
});
