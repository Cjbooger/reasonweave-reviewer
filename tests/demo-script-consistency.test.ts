import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SEEDED_COMPACT_EVIDENCE_NOTE,
  SEEDED_EVIDENCE_APPLICATION_ANCHOR,
  SEEDED_EVIDENCE_APPLICATION_CHOICE,
} from "../scripts/seeded-demo-inputs.mjs";

describe("demo script clipboard kit", () => {
  it("uses the canonical seeded evidence-to-design input", async () => {
    const script = await fs.readFile(
      path.resolve("docs/demo-script.md"),
      "utf8",
    );

    const clipboardSection = script.slice(
      script.indexOf("**Evidence → design**"),
      script.indexOf("**Creation**"),
    );

    expect(clipboardSection).toContain(
      `\`\`\`text\n${SEEDED_EVIDENCE_APPLICATION_CHOICE}\n\`\`\``,
    );
    expect(clipboardSection).toContain(
      `\`\`\`text\n${SEEDED_EVIDENCE_APPLICATION_ANCHOR}\n\`\`\``,
    );
    expect(clipboardSection).toContain(
      "This is a visible continuity check, not semantic grading",
    );
  });

  it("keeps the ten-minute capture and clipboard kit on the compact source-note path", async () => {
    const [script, capture] = await Promise.all([
      fs.readFile(path.resolve("docs/demo-script.md"), "utf8"),
      fs.readFile(path.resolve("scripts/capture-seeded-demo.mjs"), "utf8"),
    ]);

    const clipboardSection = script.slice(
      script.indexOf("**Evidence Decision**"),
      script.indexOf("**Evidence → design**"),
    );

    expect(clipboardSection).toContain(
      `\`\`\`text\n${SEEDED_COMPACT_EVIDENCE_NOTE}\n\`\`\``,
    );
    expect(script).toContain("one completion criterion");
    expect(capture).toContain('page.getByRole("textbox", {');
    expect(capture).toContain('name: "Source note"');
    expect(capture).toContain("exact: true");
    expect(capture).toContain(
      "await evidenceNoteField.fill(evidenceDecisionNote)",
    );
    expect(capture).toContain(
      "(await evidenceNoteField.inputValue()) !== evidenceDecisionNote",
    );
    expect(capture).not.toContain("Where does this source scope stop?");
  });

  it("does not advertise the legacy ElevenLabs take as runnable from current HEAD", async () => {
    const mediaGuide = await fs.readFile(
      path.resolve("docs/media/README.md"),
      "utf8",
    );

    expect(mediaGuide).toContain(
      "current HEAD intentionally rejects them: their legacy attempt receipt predates the canonical `releaseNarration` binding",
    );
    expect(mediaGuide).toContain(
      "Reproduce it only from a separate checkout of that historical checkpoint",
    );
    expect(mediaGuide).not.toContain(
      "WONDERLAB_CAPTURE_OUTPUT=output/playwright/reasonweave-demo-current",
    );
  });
});
