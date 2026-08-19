import { expect, test } from "@playwright/test";

import seededDemoJson from "../data/demo-underwater.json";
import {
  createCuriositySession,
  transitionSession,
} from "../lib/session-machine";
import { seededDemoSessionSchema } from "../lib/schemas";

function buildUnfinishedLiveSession() {
  const seededSession = seededDemoSessionSchema.parse(seededDemoJson);
  const quest = seededSession.quest;
  const route = seededSession.routes.find(
    (candidate) => candidate.id === quest?.routeId,
  );
  if (!route || !quest) throw new Error("Expected a seeded quest route.");

  let session = createCuriositySession(
    {
      question: seededSession.question,
      level: seededSession.level,
      durationMinutes: seededSession.durationMinutes,
      mode: "live",
    },
    { id: "restored-live-session", now: "2026-07-18T12:00:00.000Z" },
  );
  session = transitionSession(session, {
    type: "ROUTES_GENERATED",
    routes: seededSession.routes,
    at: "2026-07-18T12:01:00.000Z",
  });
  session = transitionSession(session, {
    type: "ROUTE_SELECTED",
    routeId: route.id,
    at: "2026-07-18T12:02:00.000Z",
  });
  return transitionSession(session, {
    type: "QUEST_LOADED",
    quest,
    at: "2026-07-18T12:03:00.000Z",
  });
}

test("the no-key judge path clears an unfinished live session and starts the complete demo without API requests", async ({
  page,
}) => {
  let apiRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests += 1;
  });

  const restoredLiveSession = buildUnfinishedLiveSession();
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: storedSession }),
    );
  }, restoredLiveSession);

  await page.goto("/");
  await expect(
    page.getByText(/live exploration is unavailable in this release/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /generate 3 routes/i }),
  ).toHaveCount(0);
  await expect(page.getByLabel("What are you curious about?")).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("wonderlab.session.v4")),
    )
    .toBeNull();
  expect(apiRequests).toBe(0);

  const demo = page.getByRole("button", { name: /try complete demo/i });
  await demo.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeVisible();
  expect(apiRequests).toBe(0);
});
