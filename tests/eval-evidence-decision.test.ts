import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import {
  buildSyntheticEvidenceApplication,
  buildSyntheticEvidenceDecision,
} from "@/evals/evidence-decision";
import { CANONICAL_EVAL_FIXTURE, EVAL_FIXTURES } from "@/evals/fixtures";
import { validateEvidenceDecisionGrounding as validateEvidenceDecisionGroundingContract } from "@/evals/validators";
import { validateEvidenceApplicationArtifact } from "@/lib/evidence-application";
import {
  evidenceApplicationSchema,
  evidenceBundleSchema,
  evidenceDecisionSchema,
} from "@/lib/schemas";
import type {
  EvidenceApplication,
  EvidenceBundle,
  EvidenceDecision,
  ReflectionResult,
} from "@/types/curiosity";

const seededApplication = evidenceApplicationSchema.parse(
  seededDemoJson.evidenceApplication,
);

function validateEvidenceDecisionGrounding(
  reflection: ReflectionResult,
  evidence: EvidenceBundle,
  decision: EvidenceDecision,
  application: EvidenceApplication = {
    ...seededApplication,
    evidenceItemId: decision.evidenceItemId,
  },
) {
  return validateEvidenceDecisionGroundingContract(
    reflection,
    evidence,
    decision,
    application,
  );
}

describe("live-eval synthetic evidence decision", () => {
  const relationships = ["supports", "challenges", "complicates"] as const;

  function groundedReflection(
    relationship: (typeof relationships)[number],
    interpretation = "",
  ): ReflectionResult {
    return {
      ...seededDemoJson.reflectionResult,
      specificFeedback: `You recorded the Aquarius lab finding as “${relationship}.” ${interpretation} Its surface buoy supplies power, air, and data, so surface support can rival pressure.`,
      changedThinking:
        "The learner shifted from pressure alone toward surface support, maintenance, and connected habitat reliability.",
    } as ReflectionResult;
  }

  it("references the first current source-backed finding with three independent judgments", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = buildSyntheticEvidenceDecision(evidence);
    const selected = evidence.items.find(
      (item) => item.id === decision.evidenceItemId,
    );

    expect(evidenceDecisionSchema.safeParse(decision).success).toBe(true);
    expect(selected).toMatchObject({ kind: "evidence" });
    expect(selected?.sourceIds.length).toBeGreaterThan(0);
    expect(decision.impact).toContain("initial prediction");
    expect(decision.impact).not.toContain(selected?.statement);
  });

  it("links the synthetic design choice to the exact judged finding", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = buildSyntheticEvidenceDecision(evidence);
    const application = buildSyntheticEvidenceApplication(
      decision,
      CANONICAL_EVAL_FIXTURE.evidenceApplication,
    );

    expect(evidenceApplicationSchema.safeParse(application).success).toBe(true);
    expect(application.evidenceItemId).toBe(decision.evidenceItemId);
    expect(application).toMatchObject({
      ...CANONICAL_EVAL_FIXTURE.evidenceApplication,
      evidenceItemId: decision.evidenceItemId,
    });
    expect(application.artifactAnchor).toBe("modular habitat");
    expect(
      validateEvidenceApplicationArtifact(
        application,
        CANONICAL_EVAL_FIXTURE.artifact,
      ).success,
    ).toBe(true);
  });

  it("keeps every live-eval fixture's authored anchor valid in its artifact", () => {
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      evidenceItemId: "finding",
    });
    for (const fixture of EVAL_FIXTURES) {
      const application = buildSyntheticEvidenceApplication(
        decision,
        fixture.evidenceApplication,
      );

      expect(
        validateEvidenceApplicationArtifact(application, fixture.artifact),
        fixture.id,
      ).toEqual({ success: true });
    }
  });

  it("evaluates the evidence-to-design link independently from general grounding", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse(
      seededDemoJson.evidenceDecision,
    );
    const application = evidenceApplicationSchema.parse(
      seededDemoJson.evidenceApplication,
    );
    const grounded = validateEvidenceDecisionGrounding(
      seededDemoJson.reflectionResult as ReflectionResult,
      evidence,
      decision,
      application,
    );
    expect(
      grounded.checks.find(
        (check) => check.id === "reflection-application-grounding",
      )?.passed,
    ).toBe(true);

    const ignoresApplication = {
      ...seededDemoJson.reflectionResult,
      specificFeedback:
        "You marked this finding as complicating your prediction because the cited source leaves scale unresolved.",
      changedThinking:
        "The learner shifted from one idea toward a broader view of long-term constraints.",
    } as ReflectionResult;
    expect(
      validateEvidenceDecisionGrounding(
        ignoresApplication,
        evidence,
        decision,
        application,
      ).checks.find((check) => check.id === "reflection-application-grounding")
        ?.passed,
    ).toBe(false);
  });

  it("rejects an invalid bundle with no source-backed finding", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const withoutSourcedFinding = {
      ...evidence,
      items: evidence.items.map((item) => ({
        ...item,
        kind: "inference" as const,
        sourceIds: [],
      })),
    };

    expect(() => buildSyntheticEvidenceDecision(withoutSourcedFinding)).toThrow(
      "source-backed evidence finding",
    );
  });

  it("requires the relationship, selected finding, and learner judgments independently", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse(
      seededDemoJson.evidenceDecision,
    );
    const grounded = validateEvidenceDecisionGrounding(
      seededDemoJson.reflectionResult as ReflectionResult,
      evidence,
      decision,
    );
    expect(grounded.passed).toBe(true);

    const ignoresDecision = {
      ...seededDemoJson.reflectionResult,
      specificFeedback:
        "Your habitat connects maintenance, food, and duplicate air and water loops instead of treating pressure as the only long-term problem.",
      changedThinking:
        "The learner shifted from pressure alone toward a connected model of habitat reliability.",
      keyTradeoff:
        "Greater redundancy improves resilience but increases maintenance demands.",
    } as ReflectionResult;
    const ignored = validateEvidenceDecisionGrounding(
      ignoresDecision,
      evidence,
      decision,
    );

    expect(ignored.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reflection-decision-relationship",
          passed: false,
        }),
        expect.objectContaining({
          id: "reflection-decision-finding-grounding",
          passed: false,
        }),
      ]),
    );
  });

  it("independently rejects attribution borrowed from an unrelated learner action", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse(
      seededDemoJson.evidenceDecision,
    );
    const reflection = {
      ...seededDemoJson.reflectionResult,
      specificFeedback:
        "You selected a habitat route, and the Aquarius finding complicates the initial prediction. Its surface buoy supplies power, air, and data, so surface support can rival pressure.",
      changedThinking:
        "The learner shifted from pressure alone toward surface support, maintenance, and connected habitat reliability.",
    } as ReflectionResult;

    expect(
      validateEvidenceDecisionGrounding(reflection, evidence, decision).checks,
    ).toContainEqual(
      expect.objectContaining({
        id: "reflection-decision-relationship",
        passed: false,
      }),
    );
  });

  it.each(relationships)(
    "independently accepts an attributed %s relationship",
    (relationship) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship,
      });

      const evaluation = validateEvidenceDecisionGrounding(
        groundedReflection(relationship),
        evidence,
        decision,
      );

      expect(evaluation.passed).toBe(true);
    },
  );

  it.each([
    "You chose “supports.”",
    "The learner marked “supports.”",
    "You selected “supports” as the relationship.",
  ])(
    "independently accepts direct learner relationship attribution: %s",
    (attribution) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship: "supports",
      });
      const reflection = {
        ...groundedReflection("supports"),
        specificFeedback: `${attribution} The Aquarius lab finding uses a surface buoy to supply power, air, and data, so surface support can rival pressure.`,
      } as ReflectionResult;

      expect(
        validateEvidenceDecisionGrounding(reflection, evidence, decision)
          .passed,
      ).toBe(true);
    },
  );

  it.each([
    "You did not choose “supports.”",
    "The learner never marked “supports.”",
  ])("independently rejects negated direct attribution: %s", (attribution) => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      relationship: "supports",
    });
    const reflection = {
      ...groundedReflection("supports"),
      specificFeedback: `${attribution} The Aquarius lab finding uses a surface buoy to supply power, air, and data, so surface support can rival pressure.`,
    } as ReflectionResult;

    expect(
      validateEvidenceDecisionGrounding(reflection, evidence, decision).checks,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reflection-decision-relationship",
          passed: false,
        }),
        expect.objectContaining({
          id: "reflection-decision-no-silent-rewrite",
          passed: false,
        }),
      ]),
    );
  });

  it.each([
    ["supports", "challenges"],
    ["challenges", "supports"],
    ["complicates", "does not complicate"],
  ] as const)(
    "independently rejects a silent rewrite of %s as %s",
    (relationship, rewrittenRelationship) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship,
      });

      const evaluation = validateEvidenceDecisionGrounding(
        {
          ...seededDemoJson.reflectionResult,
          specificFeedback: `The Aquarius lab finding ${rewrittenRelationship} the initial prediction. Its surface buoy supplies power, air, and data, so surface support can rival pressure.`,
          changedThinking:
            "The learner shifted from pressure alone toward surface support, maintenance, and connected habitat reliability.",
        } as ReflectionResult,
        evidence,
        decision,
      );

      expect(evaluation.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "reflection-decision-relationship",
            passed: false,
          }),
          expect.objectContaining({
            id: "reflection-decision-no-silent-rewrite",
            passed: false,
          }),
          expect.objectContaining({
            id: "reflection-decision-finding-grounding",
            passed: true,
          }),
          expect.objectContaining({
            id: "reflection-decision-reason-grounding",
            passed: true,
          }),
        ]),
      );
    },
  );

  it.each([
    ["supports", "does not support"],
    ["challenges", "doesn't challenge"],
    ["complicates", "is not strongly complicated by"],
    ["supports", "never supports"],
    ["challenges", "no longer challenges"],
    ["complicates", "fails to complicate"],
    ["supports", "cannot support"],
    ["challenges", "can't challenge"],
  ] as const)(
    "independently rejects unattributed negation of %s: %s",
    (relationship, negativePhrase) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship,
      });
      const reflection = {
        ...seededDemoJson.reflectionResult,
        specificFeedback: `The Aquarius lab finding ${negativePhrase} the initial prediction. Its surface buoy supplies power, air, and data, so surface support can rival pressure.`,
        changedThinking:
          "The learner shifted from pressure alone toward surface support, maintenance, and connected habitat reliability.",
      } as ReflectionResult;

      const evaluation = validateEvidenceDecisionGrounding(
        reflection,
        evidence,
        decision,
      );

      expect(evaluation.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "reflection-decision-relationship",
            passed: false,
          }),
          expect.objectContaining({
            id: "reflection-decision-no-silent-rewrite",
            passed: false,
          }),
          expect.objectContaining({
            id: "reflection-decision-finding-grounding",
            passed: true,
          }),
          expect.objectContaining({
            id: "reflection-decision-reason-grounding",
            passed: true,
          }),
        ]),
      );
    },
  );

  it.each([
    ["supports", "does not support"],
    ["challenges", "never challenges"],
    ["complicates", "no longer complicates"],
  ] as const)(
    "independently accepts attributed, calibrated reconsideration of %s",
    (relationship, contradiction) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship,
      });
      const reflection = groundedReflection(
        relationship,
        `However, the Aquarius finding ${contradiction} the initial prediction under a narrower reading, so the relationship label may need reconsideration.`,
      );

      expect(
        validateEvidenceDecisionGrounding(reflection, evidence, decision)
          .passed,
      ).toBe(true);
    },
  );

  it.each([
    [
      "supports",
      "challenges",
      "However, the evidence may be better classified as challenging the pressure prediction, so the relationship label may need reconsideration.",
    ],
    [
      "challenges",
      "supports",
      "However, the evidence may be better classified as supporting the pressure prediction, so the relationship label may need reconsideration.",
    ],
    [
      "complicates",
      "does not complicate",
      "However, the evidence does not complicate the pressure prediction, so the relationship label may need reconsideration.",
    ],
  ] as const)(
    "independently accepts calibrated correction of a contradictory %s decision",
    (relationship, reasonRelationship, interpretation) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship,
        impact: `The finding ${reasonRelationship} the pressure prediction because surface support can rival pressure.`,
      });
      const reflection = groundedReflection(relationship, interpretation);

      const evaluation = validateEvidenceDecisionGrounding(
        reflection,
        evidence,
        decision,
      );

      expect(evaluation.passed).toBe(true);
    },
  );

  it("independently rejects unconditional endorsement of a clearly contradictory learner reason", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      relationship: "supports",
      impact:
        "The finding challenges the pressure prediction because surface support can rival pressure.",
    });
    const reflection = groundedReflection(
      "supports",
      "The finding supports the initial pressure prediction.",
    );

    const evaluation = validateEvidenceDecisionGrounding(
      reflection,
      evidence,
      decision,
    );

    expect(evaluation.checks).toContainEqual(
      expect.objectContaining({
        id: "reflection-decision-conflict-calibration",
        passed: false,
      }),
    );
  });

  it("independently rejects unrelated tension language as conflict calibration", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      relationship: "supports",
      impact:
        "The finding challenges the pressure prediction because surface support can rival pressure.",
    });
    const reflection = groundedReflection(
      "supports",
      "The finding supports the initial pressure prediction, while maintenance creates tension between cost and repair access.",
    );

    expect(
      validateEvidenceDecisionGrounding(reflection, evidence, decision).checks,
    ).toContainEqual(
      expect.objectContaining({
        id: "reflection-decision-conflict-calibration",
        passed: false,
      }),
    );
  });

  it("independently rejects an unconditional correction despite an unrelated global contrast", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      relationship: "supports",
      impact:
        "The finding challenges the pressure prediction because surface support can rival pressure.",
    });
    const reflection = {
      ...groundedReflection(
        "supports",
        "The Aquarius finding challenges the initial pressure prediction.",
      ),
      keyTradeoff:
        "Surface support improves access but adds maintenance dependencies.",
    } as ReflectionResult;

    expect(
      validateEvidenceDecisionGrounding(reflection, evidence, decision).checks,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reflection-decision-no-silent-rewrite",
          passed: false,
        }),
        expect.objectContaining({
          id: "reflection-decision-conflict-calibration",
          passed: false,
        }),
      ]),
    );
  });

  it("independently accepts modal calibration in the relationship-conflict sentence", () => {
    const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
    const decision = evidenceDecisionSchema.parse({
      ...seededDemoJson.evidenceDecision,
      relationship: "supports",
      impact:
        "The finding challenges the pressure prediction because surface support can rival pressure.",
    });
    const reflection = {
      ...groundedReflection(
        "supports",
        "The Aquarius finding appears to challenge the initial pressure prediction.",
      ),
      keyTradeoff:
        "Surface support adds maintenance dependencies and improves access.",
    } as ReflectionResult;

    expect(
      validateEvidenceDecisionGrounding(reflection, evidence, decision).passed,
    ).toBe(true);
  });

  it.each([
    {
      reason:
        "The finding supports the pressure prediction, but challenges remain for maintenance.",
      interpretation:
        "Your evidence decision supports the pressure prediction, but challenges remain for maintenance.",
    },
    {
      reason:
        "The finding supports the pressure prediction but does not support a claim about ecosystem health.",
      interpretation:
        "Your evidence decision supports the pressure prediction. It does not support a claim about ecosystem health.",
    },
  ])(
    "independently allows nuanced different-object language: $reason",
    ({ reason, interpretation }) => {
      const evidence = evidenceBundleSchema.parse(seededDemoJson.evidence);
      const decision = evidenceDecisionSchema.parse({
        ...seededDemoJson.evidenceDecision,
        relationship: "supports",
        impact: reason,
      });
      const reflection = groundedReflection("supports", interpretation);

      expect(
        validateEvidenceDecisionGrounding(reflection, evidence, decision)
          .passed,
      ).toBe(true);
    },
  );
});
