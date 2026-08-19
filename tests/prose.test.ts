import { describe, expect, it } from "vitest";

import { quoteInline, quoteSentence } from "@/lib/prose";

describe("learner-authored prose formatting", () => {
  it("preserves inline learner punctuation", () => {
    expect(quoteInline("  I still wonder why?  ")).toBe(
      "“I still wonder why?”",
    );
  });

  it("adds one sentence mark when learner text has none", () => {
    expect(quoteSentence("Now I see a connected system")).toBe(
      "“Now I see a connected system.”",
    );
  });

  it.each([".", "!", "?", "…"])(
    "does not double an existing %s sentence mark",
    (mark) => {
      expect(quoteSentence(`This is my model${mark}`)).toBe(
        `“This is my model${mark}”`,
      );
    },
  );
});
