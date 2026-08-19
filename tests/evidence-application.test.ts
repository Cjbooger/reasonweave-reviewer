import { describe, expect, it } from "vitest";

import {
  artifactAnchorHasSpecificWords,
  artifactAnchorWordCount,
  suggestArtifactAnchor,
  validateEvidenceApplicationArtifact,
} from "@/lib/evidence-application";
import type { EvidenceApplication } from "@/types/curiosity";

const application = (
  artifactAnchor?: string,
  designChoice = "Because the evidence shows surface dependence, my design accepts regular deliveries for reliable maintenance.",
): EvidenceApplication => ({
  evidenceItemId: "aquarius-dependence",
  designChoice,
  artifactAnchor,
});

describe("evidence-to-creation artifact anchor", () => {
  it("matches an exact normalized token sequence across case and punctuation", () => {
    expect(
      validateEvidenceApplicationArtifact(
        application("ＲＥＧＵＬＡＲ deliveries"),
        "The service dock schedules regular-deliveries before supplies run low.",
      ),
    ).toEqual({ success: true });
  });

  it("rejects missing, too-short, and generic anchors", () => {
    expect(
      validateEvidenceApplicationArtifact(
        application(),
        "The plan includes regular deliveries.",
      ),
    ).toMatchObject({ success: false, field: "artifactAnchor" });
    expect(
      validateEvidenceApplicationArtifact(
        application("deliveries"),
        "The plan includes deliveries.",
      ),
    ).toMatchObject({ success: false, field: "artifactAnchor" });
    expect(
      validateEvidenceApplicationArtifact(
        application("the design", "The design follows the evidence."),
        "The design follows the evidence.",
      ),
    ).toMatchObject({ success: false, field: "artifactAnchor" });

    expect(artifactAnchorWordCount("regular deliveries")).toBe(2);
    expect(artifactAnchorHasSpecificWords("the design")).toBe(false);
    expect(artifactAnchorHasSpecificWords("design choice")).toBe(false);
    expect(artifactAnchorHasSpecificWords("selected finding")).toBe(false);
    expect(artifactAnchorHasSpecificWords("learner response")).toBe(false);
  });

  it("rejects an anchor absent from the evidence-driven design choice", () => {
    expect(
      validateEvidenceApplicationArtifact(
        application(
          "detachable service dock",
          "The design accepts regular deliveries for reliable maintenance.",
        ),
        "The habitat includes a detachable service dock.",
      ),
    ).toMatchObject({ success: false, field: "artifactAnchor" });
  });

  it("rejects an anchor absent from the learner artifact", () => {
    expect(
      validateEvidenceApplicationArtifact(
        application("regular deliveries"),
        "The habitat includes a detachable service dock for maintenance.",
      ),
    ).toMatchObject({ success: false, field: "artifact" });
  });

  it("suggests a short specific phrase already present in an artifact", () => {
    const artifact =
      "At 20 meters, the habitat uses regular deliveries and a detachable dock.";
    const anchor = suggestArtifactAnchor(artifact);

    expect(anchor).toBe("20 meters");
    expect(artifact).toContain(anchor);
    expect(artifactAnchorWordCount(anchor)).toBeGreaterThanOrEqual(2);
    expect(artifactAnchorHasSpecificWords(anchor)).toBe(true);
  });
});
