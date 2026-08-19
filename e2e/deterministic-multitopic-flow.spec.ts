import { expect, test, type Page } from "@playwright/test";

import {
  DETERMINISTIC_TOPIC_EVALUATIONS,
  type DeterministicTopicEvaluation,
} from "../evals/deterministic-topic-fixtures";

const TOPIC_IDS = new Set([
  "dreams",
  "car-free-city",
  "earworms",
  "plant-communication",
  "fair-games",
  "school-food-waste",
]);

const TOPIC_EVALUATIONS = DETERMINISTIC_TOPIC_EVALUATIONS.filter((evaluation) =>
  TOPIC_IDS.has(evaluation.fixture.id),
);

const LEVEL_LABELS = {
  high_school: "High school",
  college: "College",
  curious_adult: "Curious adult",
} as const;

function learnerInputs(evaluation: DeterministicTopicEvaluation) {
  const { fixture } = evaluation;
  return {
    prediction: fixture.prediction,
    artifact: fixture.artifact,
    reflection: fixture.reflection,
  };
}

async function interceptDeterministicApis(
  page: Page,
  evaluation: DeterministicTopicEvaluation,
): Promise<string[]> {
  const calls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(path);
    const body = request.postDataJSON() as Record<string, unknown>;

    if (path === "/api/routes") {
      expect(body).toMatchObject({
        question: evaluation.fixture.question,
        level: evaluation.fixture.level,
        durationMinutes: evaluation.fixture.durationMinutes,
      });
      await route.fulfill({ json: { routes: evaluation.routes } });
      return;
    }

    if (path === "/api/quest") {
      expect(body).toMatchObject({
        question: evaluation.fixture.question,
        selectedRoute: { id: evaluation.routes[0].id },
      });
      await route.fulfill({ json: evaluation.quest });
      return;
    }

    if (path === "/api/evidence") {
      expect(body).toMatchObject({
        question: evaluation.fixture.question,
        prediction: evaluation.fixture.prediction,
        selectedRoute: { id: evaluation.routes[0].id },
      });
      await route.fulfill({ json: evaluation.evidence });
      return;
    }

    if (path === "/api/reflect") {
      expect(body).toMatchObject({
        question: evaluation.fixture.question,
        prediction: evaluation.fixture.prediction,
        artifact: evaluation.fixture.artifact,
        reflection: evaluation.fixture.reflection,
        evidenceDecision: evaluation.decision,
        evidenceApplication: evaluation.application,
      });
      await route.fulfill({ json: evaluation.reflection });
      return;
    }

    throw new Error(`Unexpected API request: ${path}`);
  });

  return calls;
}

for (const evaluation of TOPIC_EVALUATIONS) {
  test(`offline complete editable journey: ${evaluation.fixture.id}`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "One desktop browser run per deterministic topic proves the complete editable journey.",
    );

    const providerRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/openai|api\.elevenlabs\.io/i.test(url.hostname)) {
        providerRequests.push(url.toString());
      }
    });
    const apiCalls = await interceptDeterministicApis(page, evaluation);
    const { prediction, artifact, reflection } = learnerInputs(evaluation);

    await page.goto("/");
    await page
      .getByRole("button", {
        name: LEVEL_LABELS[evaluation.fixture.level],
      })
      .click();
    await page
      .getByRole("button", {
        name: `${evaluation.fixture.durationMinutes} min`,
        exact: true,
      })
      .click();
    await page
      .getByLabel("What are you curious about?")
      .fill(evaluation.fixture.question);
    await page.getByRole("button", { name: /Generate 3 routes/i }).click();

    await expect(
      page.getByRole("heading", { name: "Three ways into your question." }),
    ).toBeVisible();
    await expect(page.locator(".route-card")).toHaveCount(3);
    await expect(page.getByRole("radio")).toHaveCount(3);
    await page.getByRole("radio", { name: evaluation.routes[0].title }).check();
    await page.getByRole("button", { name: /Build my quest/i }).click();

    await expect(
      page.getByRole("heading", { name: "Commit to a first model." }),
    ).toBeVisible();
    if (evaluation.fixture.durationMinutes === 5) {
      await expect(page.locator(".quest-budget-visible")).toHaveText(
        "Plan: choose 30s · predict 30s · investigate 1m · create 1m 30s · reflect 1m · branch 30s",
      );
    }
    await expect(page.locator(".evidence-list")).toHaveCount(0);
    await page.getByLabel("Your prediction").fill(prediction);
    await page.getByRole("button", { name: /Lock prediction/i }).click();

    await expect(
      page.getByRole("heading", { name: "Put your model under pressure." }),
    ).toBeVisible();
    await expect(page.getByText(prediction, { exact: true })).toBeVisible();
    await expect(page.locator(".evidence-list")).toHaveCount(0);
    await page
      .getByRole("button", { name: /Explain now with sources/i })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "See what holds. Build what follows.",
      }),
    ).toBeVisible();
    await expect(
      page.locator('.evidence-item[data-kind="evidence"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.evidence-item[data-kind="inference"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.evidence-item[data-kind="open_question"]'),
    ).toHaveCount(1);
    const source = page.locator(".source-link");
    await expect(source).toHaveCount(1);
    await expect(source).toHaveAttribute(
      "href",
      evaluation.evidence.sources[0].url,
    );
    await expect(source).toContainText(evaluation.evidence.sources[0].domain);

    const evidenceChoice = page.getByLabel("Choose one source-backed finding");
    await evidenceChoice.selectOption(evaluation.decision.evidenceItemId);
    const selectedSources = page.getByRole("list", {
      name: "Sources linked to the selected finding",
    });
    await expect(selectedSources).toContainText(
      evaluation.evidence.sources[0].title,
    );
    await expect(selectedSources).toContainText(
      evaluation.evidence.sources[0].domain,
    );
    await expect(selectedSources.getByRole("link")).toHaveAttribute(
      "href",
      evaluation.evidence.sources[0].url,
    );
    await page.getByRole("radio", { name: "Supports my prediction" }).check();
    if (evaluation.fixture.durationMinutes <= 10) {
      await expect(
        page.getByText(
          `${evaluation.fixture.durationMinutes}-minute ${evaluation.fixture.durationMinutes === 5 ? "quick" : "focused"} trace.`,
          { exact: true },
        ),
      ).toBeVisible();
      await page
        .getByRole("textbox", {
          name:
            evaluation.fixture.durationMinutes === 5
              ? "Quick source note"
              : "Source note",
        })
        .fill(
          [
            evaluation.decision.establishes,
            evaluation.decision.unresolved,
            evaluation.decision.impact,
          ].join("\n"),
        );
    } else {
      await page
        .getByLabel("What do the cited sources establish?")
        .fill(evaluation.decision.establishes);
      await page
        .getByLabel("Where does this source scope stop?")
        .fill(evaluation.decision.unresolved);
      await page
        .getByLabel("Why does that matter for your prediction?")
        .fill(evaluation.decision.impact);
    }
    await page
      .getByLabel("Finding → design choice")
      .fill(evaluation.application.designChoice);
    await page
      .getByLabel("Creation anchor phrase")
      .fill(evaluation.application.artifactAnchor ?? "");
    await page.getByLabel("Build your response in the browser").fill(artifact);
    await page
      .getByLabel(/I reviewed my response against every completion criterion/i)
      .check();
    await page.getByRole("button", { name: /Finish creation/i }).click();

    await expect(
      page.getByRole("heading", {
        name: "Make the change in your thinking visible.",
      }),
    ).toBeVisible();
    await page.getByLabel("I used to think…").fill(reflection.usedToThink);
    await page.getByLabel("Now I think…").fill(reflection.nowThink);
    await page.getByLabel("I still wonder…").fill(reflection.stillWonder);
    await page
      .getByRole("button", { name: /Reveal my Curiosity Map/i })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Your question became a visible reasoning trace.",
      }),
    ).toBeVisible();
    const finalMap = page.locator(".map-panel-full");
    await expect(finalMap.locator('g[role="listitem"]')).toHaveCount(9);
    await expect(
      finalMap.locator('g[role="listitem"][aria-label^="Next question:"]'),
    ).toHaveCount(3);
    await expect(
      page.getByRole("article", { name: "Discovery Card" }),
    ).toBeVisible();

    const selectedQuestion = evaluation.reflection.newQuestions[1];
    await page.getByRole("radio", { name: selectedQuestion }).check();
    await expect(
      page.getByRole("radio", { name: selectedQuestion }),
    ).toBeChecked();
    await expect(
      finalMap.locator('g[role="listitem"][aria-label^="My next question:"]'),
    ).toHaveCount(1);

    const copyMarkdown = page.getByRole("button", { name: /Copy Markdown/i });
    await expect(copyMarkdown).toBeEnabled();
    await copyMarkdown.click();
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain(evaluation.fixture.question);
    expect(markdown).toContain(prediction);
    expect(markdown).toContain(artifact);
    expect(markdown).toContain(reflection.usedToThink);
    expect(markdown).toContain(reflection.nowThink);
    expect(markdown).toContain(reflection.stillWonder);
    expect(markdown).toContain(selectedQuestion);

    expect(apiCalls).toEqual([
      "/api/routes",
      "/api/quest",
      "/api/evidence",
      "/api/reflect",
    ]);
    expect(providerRequests).toEqual([]);
  });
}

expect(TOPIC_EVALUATIONS).toHaveLength(6);
