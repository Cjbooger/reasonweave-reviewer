import { describe, expect, it } from "vitest";

import {
  evidenceDecisionGroundingIssues,
  reflectionQualityIssues,
} from "@/lib/reflection-quality";

const learnerText = [
  "I predicted pressure resistance would dominate every design choice.",
  "My habitat uses a reinforced shell, redundant life support, and modular living spaces.",
  "I used to think one constraint would decide the entire design.",
  "Now I think several connected constraints shape a workable habitat.",
  "I still wonder how emergency planning would change the layout.",
];

describe("reflection grounding boundary", () => {
  it("requires independent grounding in feedback and changed-thinking text", () => {
    expect(
      reflectionQualityIssues(
        {
          specificFeedback:
            "Your design shows careful thought about the topic and presents a detailed response.",
          changedThinking:
            "Your design shifted from an early idea toward a more complete view.",
          newQuestions: [
            "Which evidence would challenge the current design?",
            "What tradeoff deserves another comparison?",
            "How could the learner test the strongest assumption?",
          ],
        },
        learnerText,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("specific feedback"),
        expect.stringContaining("changed-thinking synthesis"),
      ]),
    );
  });

  it("accepts a grounded before-and-after synthesis with question-form branches", () => {
    expect(
      reflectionQualityIssues(
        {
          specificFeedback:
            "Your habitat links redundant life support with emergency planning instead of treating pressure as the only constraint.",
          changedThinking:
            "Your model shifted from pressure alone toward several connected habitat constraints.",
          newQuestions: [
            "Which habitat systems need physically separate backups?",
            "How would emergency access change the module layout?",
            "What evidence would set an acceptable maintenance interval?",
          ],
        },
        learnerText,
      ),
    ).toEqual([]);
  });
});

describe("evidence-decision grounding boundary", () => {
  const relationships = ["supports", "challenges", "complicates"] as const;
  const context = {
    relationship: "complicates" as const,
    reason:
      "The pressure finding matters, but it does not resolve linked maintenance constraints.",
    selectedFinding:
      "Water pressure increases as depth increases below the ocean surface.",
    designChoice:
      "Water pressure and linked maintenance constraints shape the habitat design.",
  };

  it("rejects output that is grounded elsewhere but ignores the learner judgment", () => {
    expect(
      evidenceDecisionGroundingIssues(
        {
          specificFeedback:
            "Your habitat connects redundant air loops with emergency planning.",
          discoverySummary:
            "The proposal combines several habitat systems into one plan.",
          changedThinking:
            "Your model shifted from one idea toward several connected needs.",
          keyTradeoff:
            "More redundancy requires additional space and maintenance.",
          newQuestions: ["What should the learner test next?"],
        },
        context,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("complicates"),
        expect.stringContaining("selected finding"),
      ]),
    );
  });

  it("does not treat an unrelated learner action as relationship attribution", () => {
    expect(
      evidenceDecisionGroundingIssues(
        {
          specificFeedback:
            "You selected a habitat route, and this finding complicates the pressure prediction because water pressure increases with ocean depth and linked maintenance constraints remain unresolved.",
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "The model shifted from pressure alone toward linked maintenance constraints.",
          keyTradeoff:
            "Shallower depth reduces pressure but changes surface access.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        context,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("learner's recorded complicates"),
      ]),
    );
  });

  it("accepts output that attributes the learner's relationship and grounds it without grading", () => {
    expect(
      evidenceDecisionGroundingIssues(
        {
          specificFeedback:
            "Your decision complicates the pressure-first model because increasing depth and linked maintenance constraints must be considered together.",
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "Your model shifted from pressure alone toward several linked constraints.",
          keyTradeoff:
            "Shallower depth reduces pressure but changes surface access.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        context,
      ),
    ).toEqual([]);
  });

  it("requires feedback to ground the learner's evidence-to-design transfer", () => {
    const designContext = {
      ...context,
      designChoice:
        "A detachable service dock separates repair work from living quarters.",
    };
    const output = {
      specificFeedback:
        "Your decision complicates the pressure-first model because increasing depth and linked maintenance constraints must be considered together.",
      discoverySummary:
        "Pressure and maintenance shape the habitat as one connected system.",
      changedThinking:
        "Your model shifted from pressure alone toward several linked constraints.",
      keyTradeoff: "Surface access changes the maintenance model.",
      newQuestions: ["Which depth best balances those constraints?"],
    };

    expect(evidenceDecisionGroundingIssues(output, designContext)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("evidence-to-design link"),
      ]),
    );
    expect(
      evidenceDecisionGroundingIssues(
        {
          ...output,
          specificFeedback: `${output.specificFeedback} Your detachable service dock separates repair work from living quarters.`,
        },
        designContext,
      ),
    ).toEqual([]);
  });

  it.each([
    "You chose “supports.”",
    "The learner marked “supports.”",
    "You selected “supports” as the relationship.",
    "You framed the selected finding as supporting your prediction.",
    "You identified the finding as supporting your prediction.",
  ])("accepts direct learner relationship attribution: %s", (attribution) => {
    expect(
      evidenceDecisionGroundingIssues(
        {
          specificFeedback: `${attribution} Water pressure increases with ocean depth, while linked maintenance constraints remain unresolved.`,
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "The model shifted from pressure alone toward linked maintenance constraints.",
          keyTradeoff:
            "Shallower depth reduces pressure and changes surface access.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        { ...context, relationship: "supports" },
      ),
    ).toEqual([]);
  });

  it.each([
    "You did not choose “supports.”",
    "The learner never marked “supports.”",
  ])(
    "does not treat negated direct attribution as preserving the choice: %s",
    (attribution) => {
      const issues = evidenceDecisionGroundingIssues(
        {
          specificFeedback: `${attribution} Water pressure increases with ocean depth, while linked maintenance constraints remain unresolved.`,
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "The model shifted from pressure alone toward linked maintenance constraints.",
          keyTradeoff:
            "Shallower depth reduces pressure and changes surface access.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        { ...context, relationship: "supports" },
      );

      expect(issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining("learner's recorded supports"),
          expect.stringContaining("silently rewrite"),
        ]),
      );
    },
  );

  it.each([
    ["supports", "challenges"],
    ["challenges", "supports"],
    ["complicates", "does not complicate"],
  ] as const)(
    "rejects a silent rewrite of the learner's %s choice as %s",
    (relationship, rewrittenRelationship) => {
      expect(
        evidenceDecisionGroundingIssues(
          {
            specificFeedback: `The pressure finding ${rewrittenRelationship} the initial prediction. Water pressure at increasing ocean depth and linked maintenance constraints remain central to the response.`,
            discoverySummary:
              "Pressure and maintenance shape the habitat as one connected system.",
            changedThinking:
              "The model shifted from pressure alone toward linked maintenance constraints.",
            keyTradeoff:
              "Shallower depth reduces pressure but changes surface access.",
            newQuestions: ["Which depth best balances those constraints?"],
          },
          { ...context, relationship },
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`learner's recorded ${relationship}`),
          expect.stringContaining("silently rewrite"),
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
    "rejects an unattributed negation of the learner's %s choice: %s",
    (relationship, negativePhrase) => {
      expect(
        evidenceDecisionGroundingIssues(
          {
            specificFeedback: `The pressure finding ${negativePhrase} the initial prediction. Water pressure at increasing ocean depth and linked maintenance constraints remain central to the response.`,
            discoverySummary:
              "Pressure and maintenance shape the habitat as one connected system.",
            changedThinking:
              "The model shifted from pressure alone toward linked maintenance constraints.",
            keyTradeoff:
              "Shallower depth reduces pressure but changes surface access.",
            newQuestions: ["Which depth best balances those constraints?"],
          },
          { ...context, relationship },
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`learner's recorded ${relationship}`),
          expect.stringContaining("silently rewrite"),
        ]),
      );
    },
  );

  it.each([
    ["supports", "does not support"],
    ["challenges", "never challenges"],
    ["complicates", "no longer complicates"],
  ] as const)(
    "allows an attributed, calibrated reconsideration of a %s choice",
    (relationship, contradiction) => {
      expect(
        evidenceDecisionGroundingIssues(
          {
            specificFeedback: `Your evidence decision ${relationship} the pressure-first model because water pressure increases with ocean depth and linked maintenance constraints remain unresolved. However, the same finding ${contradiction} the initial prediction under a narrower reading, so the relationship label may need reconsideration.`,
            discoverySummary:
              "Pressure and maintenance shape the habitat as one connected system.",
            changedThinking:
              "The model shifted from pressure alone toward linked maintenance constraints.",
            keyTradeoff:
              "Shallower depth reduces pressure but changes surface access.",
            newQuestions: ["Which depth best balances those constraints?"],
          },
          { ...context, relationship },
        ),
      ).toEqual([]);
    },
  );

  it.each([
    ["supports", "challenges", "may be better classified as challenging"],
    ["challenges", "supports", "may be better classified as supporting"],
    ["complicates", "does not complicate", "does not complicate"],
  ] as const)(
    "accepts calibrated correction while preserving a contradictory %s choice",
    (relationship, reasonRelationship, responseRelationship) => {
      const issues = evidenceDecisionGroundingIssues(
        {
          specificFeedback: `You recorded the finding as “${relationship}.” However, water pressure increasing with ocean depth ${responseRelationship} the pressure prediction, so the relationship label may need reconsideration alongside linked maintenance constraints.`,
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "The model shifted from pressure alone toward linked maintenance constraints.",
          keyTradeoff:
            "Shallower depth reduces pressure but changes surface access.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        {
          ...context,
          relationship,
          reason: `The finding ${reasonRelationship} the pressure prediction because linked maintenance constraints remain unresolved.`,
        },
      );

      expect(issues).toEqual([]);
    },
  );

  it("rejects unconditional endorsement when the learner reason clearly contradicts its recorded label", () => {
    const issues = evidenceDecisionGroundingIssues(
      {
        specificFeedback:
          "You recorded the finding as “supports.” Water pressure increasing with ocean depth supports the pressure prediction, while linked maintenance constraints remain unresolved.",
        discoverySummary:
          "Pressure and maintenance shape the habitat as one connected system.",
        changedThinking:
          "The model shifted from pressure alone toward linked maintenance constraints.",
        keyTradeoff:
          "Shallower depth reduces pressure but changes surface access.",
        newQuestions: ["Which depth best balances those constraints?"],
      },
      {
        ...context,
        relationship: "supports",
        reason:
          "The finding challenges the pressure prediction because linked maintenance constraints remain unresolved.",
      },
    );

    expect(issues).toEqual([
      expect.stringContaining("unconditionally endorsing"),
    ]);
  });

  it("does not accept unrelated tension language as a calibrated relationship correction", () => {
    const issues = evidenceDecisionGroundingIssues(
      {
        specificFeedback:
          "You recorded the finding as “supports.” Water pressure increasing with ocean depth supports the pressure prediction, while linked maintenance constraints create tension between cost and repair access.",
        discoverySummary:
          "Pressure and maintenance shape the habitat as one connected system.",
        changedThinking:
          "The model shifted from pressure alone toward linked maintenance constraints.",
        keyTradeoff:
          "Shallower depth reduces pressure but changes surface access.",
        newQuestions: ["Which depth best balances those constraints?"],
      },
      {
        ...context,
        relationship: "supports",
        reason:
          "The finding challenges the pressure prediction because linked maintenance constraints remain unresolved.",
      },
    );

    expect(issues).toEqual([
      expect.stringContaining("unconditionally endorsing"),
    ]);
  });

  it("does not let an unrelated global contrast calibrate an unconditional correction", () => {
    const issues = evidenceDecisionGroundingIssues(
      {
        specificFeedback:
          "You chose “supports.” Water pressure increases with ocean depth. The finding challenges the pressure prediction because linked maintenance constraints remain unresolved.",
        discoverySummary:
          "Pressure and maintenance shape the habitat as one connected system.",
        changedThinking:
          "The model shifted from pressure alone toward linked maintenance constraints.",
        keyTradeoff:
          "Shallower depth reduces pressure but changes surface access.",
        newQuestions: ["Which depth best balances those constraints?"],
      },
      {
        ...context,
        relationship: "supports",
        reason:
          "The finding challenges the pressure prediction because linked maintenance constraints remain unresolved.",
      },
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("silently rewrite"),
        expect.stringContaining("unconditionally endorsing"),
      ]),
    );
  });

  it("accepts modal calibration in the sentence that states the relationship conflict", () => {
    expect(
      evidenceDecisionGroundingIssues(
        {
          specificFeedback:
            "You chose “supports.” Water pressure increases with ocean depth. The finding appears to challenge the pressure prediction because linked maintenance constraints remain unresolved.",
          discoverySummary:
            "Pressure and maintenance shape the habitat as one connected system.",
          changedThinking:
            "The model shifted from pressure alone toward linked maintenance constraints.",
          keyTradeoff:
            "Shallower depth changes surface access and pressure exposure.",
          newQuestions: ["Which depth best balances those constraints?"],
        },
        {
          ...context,
          relationship: "supports",
          reason:
            "The finding challenges the pressure prediction because linked maintenance constraints remain unresolved.",
        },
      ),
    ).toEqual([]);
  });

  it.each(relationships)(
    "accepts an attributed %s relationship when no deterministic conflict is present",
    (relationship) => {
      expect(
        evidenceDecisionGroundingIssues(
          {
            specificFeedback: `Your decision ${relationship} the pressure-first model because water pressure increases with ocean depth while linked maintenance constraints remain unresolved.`,
            discoverySummary:
              "Pressure and maintenance shape the habitat as one connected system.",
            changedThinking:
              "The model shifted from pressure alone toward linked maintenance constraints.",
            keyTradeoff:
              "Shallower depth reduces pressure but changes surface access.",
            newQuestions: ["Which depth best balances those constraints?"],
          },
          { ...context, relationship },
        ),
      ).toEqual([]);
    },
  );

  it.each([
    {
      reason:
        "The finding supports the pressure prediction, but challenges remain for linked maintenance constraints.",
      feedback:
        "Your evidence decision supports the pressure prediction because water pressure increases with ocean depth, while challenges remain for linked maintenance constraints.",
    },
    {
      reason:
        "The finding supports the pressure prediction but does not support a claim about ecosystem health.",
      feedback:
        "Your evidence decision supports the pressure prediction because water pressure increases with ocean depth. It does not support a claim about ecosystem health, which remains separate from linked maintenance constraints.",
    },
  ])(
    "does not mistake different-object nuance for a contradiction: $reason",
    ({ reason, feedback }) => {
      expect(
        evidenceDecisionGroundingIssues(
          {
            specificFeedback: feedback,
            discoverySummary:
              "Pressure and maintenance shape the habitat as one connected system.",
            changedThinking:
              "The model shifted from pressure alone toward linked maintenance constraints.",
            keyTradeoff:
              "Shallower depth reduces pressure but changes surface access.",
            newQuestions: ["Which depth best balances those constraints?"],
          },
          { ...context, relationship: "supports", reason },
        ),
      ).toEqual([]);
    },
  );
});
