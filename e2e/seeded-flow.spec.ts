import { spawnSync } from "node:child_process";

import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import releaseIdentity from "../config/release-identity.json";
import seededDemoJson from "../data/demo-underwater.json";
import {
  finalizeScreenshotOutput,
  prepareScreenshotOutput,
  type ScreenshotFilename,
  writeScreenshotOutput,
} from "../scripts/screenshot-output.mjs";
import {
  SEEDED_EVIDENCE_APPLICATION_ANCHOR,
  SEEDED_EVIDENCE_APPLICATION_CHOICE,
} from "../scripts/seeded-demo-inputs.mjs";

const APP_ORIGIN = "http://127.0.0.1:3000";
const SEEDED_QUESTION = "Could humans live underwater?";
const PUBLIC_NAME = releaseIdentity.displayName;
const PUBLIC_NAME_PATTERN = new RegExp(
  PUBLIC_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
const DISCOVERY_CARD_FILENAME = `${releaseIdentity.slug}-learning-trace.md`;

function gitOutput(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("Unable to verify the screenshot capture source.");
  }
  return result.stdout.trim();
}

const PREDICTION =
  "Pressure will be hardest because the structure must resist the ocean pushing on it continuously, and any crack could threaten everyone inside.";

const OCEAN_PREDICTION =
  "Continuous machinery noise will be hardest to control because it can spread beyond the habitat and affect animals before people notice the change.";

const CREATION =
  "At 20 meters, I would use a surface-linked support module with regular deliveries and a detachable service dock. Aquarius shows that a small habitat can depend on surface power, air, and data, so I would not claim independence. The tradeoff is more reliable repairs and resupply, but dependence on surface infrastructure remains a risk.";

const EVIDENCE_DECISION_ESTABLISHES =
  "The selected finding and its cited sources establish that Aquarius can support up to six crew while relying on surface power, air, and data.";
const EVIDENCE_DECISION_UNRESOLVED =
  "A 100-person habitat's safety and independence remain unresolved.";
const EVIDENCE_DECISION_IMPACT =
  "That complicates my pressure-first prediction because surface dependence is another major constraint.";
const EVIDENCE_DECISION_NOTE = [
  EVIDENCE_DECISION_ESTABLISHES,
  EVIDENCE_DECISION_UNRESOLVED,
  EVIDENCE_DECISION_IMPACT,
].join("\n");
const EVIDENCE_APPLICATION_CHOICE = SEEDED_EVIDENCE_APPLICATION_CHOICE;
const EVIDENCE_APPLICATION_ANCHOR = SEEDED_EVIDENCE_APPLICATION_ANCHOR;

const REFLECTION = {
  usedToThink:
    "I used to think pressure was the only serious obstacle because the ocean could crush the habitat.",
  nowThink:
    "Now I think maintenance, food, and redundant life support may be harder over time because every system depends on the others.",
  stillWonder:
    "I still wonder whether an underwater habitat could ever become mostly self-sufficient without harming the surrounding ecosystem.",
} as const;

async function fillEvidenceDecision(
  page: Page,
  options: {
    itemId?: string;
    establishes?: string;
    unresolved?: string;
    impact?: string;
    designChoice?: string;
    artifactAnchor?: string;
    relationship?: "supports" | "challenges" | "complicates";
    decisionLayout?: "compact" | "expanded";
  } = {},
): Promise<void> {
  const evidenceSelect = page.getByLabel("Choose one source-backed finding");
  if (options.itemId) await evidenceSelect.selectOption(options.itemId);
  else await evidenceSelect.selectOption({ index: 1 });
  const relationship = options.relationship ?? "complicates";
  const relationshipLabel = {
    supports: "Supports my prediction",
    challenges: "Challenges my prediction",
    complicates: "Complicates my prediction",
  }[relationship];
  await page.getByRole("radio", { name: relationshipLabel }).check();
  const establishes = options.establishes ?? EVIDENCE_DECISION_ESTABLISHES;
  const unresolved = options.unresolved ?? EVIDENCE_DECISION_UNRESOLVED;
  const impact = options.impact ?? EVIDENCE_DECISION_IMPACT;
  if (options.decisionLayout === "expanded") {
    await page
      .getByLabel("What do the cited sources establish?")
      .fill(establishes);
    await page
      .getByLabel("Where does this source scope stop?")
      .fill(unresolved);
    await page
      .getByLabel("Why does that matter for your prediction?")
      .fill(impact);
  } else {
    await page
      .getByRole("textbox", { name: "Source note" })
      .fill([establishes, unresolved, impact].join("\n"));
  }
  await page
    .getByLabel("Finding → design choice")
    .fill(options.designChoice ?? EVIDENCE_APPLICATION_CHOICE);
  await page
    .getByLabel("Creation anchor phrase")
    .fill(options.artifactAnchor ?? EVIDENCE_APPLICATION_ANCHOR);
}

function watchRuntime(page: Page): string[] {
  const problems: string[] = [];

  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });

  return problems;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectVisibleControlsWithinViewport(page: Page): Promise<void> {
  const clippedControls = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, input, textarea")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ??
            element.textContent?.trim().slice(0, 80) ??
            element.tagName,
          left: rect.left,
          right: rect.right,
        };
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1),
  );

  expect(clippedControls).toEqual([]);
}

async function expectFocusedControlInViewport(
  page: Page,
  control: Locator,
): Promise<void> {
  await expect(control).toBeFocused();
  await expect
    .poll(async () =>
      control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      }),
    )
    .toBe(true);
}

interface KeyboardFocusSnapshot {
  boxShadow: string;
  hasDiscernibleFocusShadow: boolean;
  focusVisible: boolean;
  intersectsViewport: boolean;
  outlineStyle: string;
  outlineWidth: number;
  signature: string;
}

async function activeKeyboardFocusSnapshot(
  page: Page,
): Promise<KeyboardFocusSnapshot> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected an active HTML element.");
    }

    const path: string[] = [];
    let current: HTMLElement | null = element;
    while (current && current !== document.body) {
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (candidate) => candidate.tagName === current?.tagName,
          )
        : [];
      const siblingIndex = siblings.indexOf(current) + 1;
      path.unshift(
        `${current.tagName.toLowerCase()}${current.id ? `#${current.id}` : `:nth-of-type(${siblingIndex})`}`,
      );
      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const focusShadowProbe = document.createElement("span");
    focusShadowProbe.style.boxShadow = "var(--shadow-focus)";
    document.body.append(focusShadowProbe);
    const focusBoxShadow = getComputedStyle(focusShadowProbe).boxShadow;
    focusShadowProbe.remove();
    const focusShadowLengths = [
      ...focusBoxShadow.matchAll(/(-?\d*\.?\d+)px/g),
    ].map((match) => Number.parseFloat(match[1]));
    const focusShadowSpread =
      focusShadowLengths.length === 4 ? focusShadowLengths[3] : 0;
    const focusShadowColorChannels = focusBoxShadow
      .match(/rgba?\(([^)]+)\)/)?.[1]
      .split(/[\s,/]+/)
      .filter(Boolean);
    const focusShadowAlpha =
      focusShadowColorChannels && focusShadowColorChannels.length >= 4
        ? Number.parseFloat(focusShadowColorChannels.at(-1) ?? "0")
        : 1;
    return {
      boxShadow: style.boxShadow,
      hasDiscernibleFocusShadow:
        style.boxShadow === focusBoxShadow &&
        focusBoxShadow !== "none" &&
        focusShadowSpread >= 2 &&
        focusShadowAlpha > 0,
      focusVisible: element.matches(":focus-visible"),
      intersectsViewport:
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      signature: path.join(" > "),
    };
  });
}

function expectDiscernibleKeyboardFocus(snapshot: KeyboardFocusSnapshot): void {
  expect(
    snapshot.intersectsViewport,
    `${snapshot.signature} must intersect the viewport while keyboard-focused.`,
  ).toBe(true);
  expect(
    snapshot.focusVisible,
    `${snapshot.signature} must match :focus-visible.`,
  ).toBe(true);
  expect(
    (snapshot.outlineStyle !== "none" && snapshot.outlineWidth >= 2) ||
      snapshot.hasDiscernibleFocusShadow,
    `${snapshot.signature} needs a >=2px non-none outline or the non-transparent >=2px focus-ring shadow token; received outline ${snapshot.outlineStyle} ${snapshot.outlineWidth}px and box-shadow ${snapshot.boxShadow}.`,
  ).toBe(true);
}

async function expectActiveDiscernibleKeyboardFocus(
  page: Page,
): Promise<KeyboardFocusSnapshot> {
  await expect
    .poll(async () => {
      const snapshot = await activeKeyboardFocusSnapshot(page);
      return {
        focusVisible: snapshot.focusVisible,
        hasFocusIndicator:
          (snapshot.outlineStyle !== "none" && snapshot.outlineWidth >= 2) ||
          snapshot.hasDiscernibleFocusShadow,
        intersectsViewport: snapshot.intersectsViewport,
      };
    })
    .toEqual({
      focusVisible: true,
      hasFocusIndicator: true,
      intersectsViewport: true,
    });
  const snapshot = await activeKeyboardFocusSnapshot(page);
  expectDiscernibleKeyboardFocus(snapshot);
  return snapshot;
}

async function expectKeyboardFocusedTarget(
  page: Page,
  control: Locator,
): Promise<void> {
  await expect(control).toBeFocused();
  await expectActiveDiscernibleKeyboardFocus(page);
}

async function pressKeyUntilFocused(
  page: Page,
  control: Locator,
  key: "Tab" | "Shift+Tab",
  maximumPresses = 24,
): Promise<void> {
  await expect(control).toBeAttached();
  const visited = new Set<string>();
  const initialFocus = await activeKeyboardFocusSnapshot(page);
  const traversal = [initialFocus.signature];
  await expectActiveDiscernibleKeyboardFocus(page);
  visited.add(initialFocus.signature);

  const initialDirection = await control.evaluate((target, traversalKey) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      throw new Error("Expected an active HTML element.");
    }
    const positiveTabIndexes = [
      ...document.querySelectorAll<HTMLElement>("[tabindex]"),
    ]
      .map((element) =>
        Number.parseInt(element.getAttribute("tabindex") ?? "0", 10),
      )
      .filter((tabIndex) => tabIndex > 0);
    const relation = active.compareDocumentPosition(target);
    return {
      positiveTabIndexCount: positiveTabIndexes.length,
      targetIsAhead:
        traversalKey === "Tab"
          ? Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)
          : Boolean(relation & Node.DOCUMENT_POSITION_PRECEDING),
    };
  }, key);
  expect(
    initialDirection.positiveTabIndexCount,
    "The keyboard-order proof assumes DOM order and therefore forbids positive tabindex values.",
  ).toBe(0);
  expect(
    initialDirection.targetIsAhead,
    `Keyboard traversal cannot reach its target with ${key} without wrapping the document.`,
  ).toBe(true);

  for (let press = 0; press < maximumPresses; press += 1) {
    await page.keyboard.press(key);
    const focused = await control.evaluate(
      (element) => element === document.activeElement,
    );
    if (focused) {
      await expectKeyboardFocusedTarget(page, control);
      return;
    }

    const snapshot = await expectActiveDiscernibleKeyboardFocus(page);
    const targetRemainsAhead = await control.evaluate(
      (target, traversalKey) => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return false;
        const relation = active.compareDocumentPosition(target);
        return traversalKey === "Tab"
          ? Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)
          : Boolean(relation & Node.DOCUMENT_POSITION_PRECEDING);
      },
      key,
    );
    if (!targetRemainsAhead) {
      throw new Error(
        `Keyboard traversal passed its target or wrapped the document before reaching it. Traversal: ${[...traversal, snapshot.signature].join(" -> ")}`,
      );
    }
    if (visited.has(snapshot.signature)) {
      throw new Error(
        `Keyboard traversal repeated ${snapshot.signature} before reaching its target. Traversal: ${[...traversal, snapshot.signature].join(" -> ")}`,
      );
    }
    visited.add(snapshot.signature);
    traversal.push(snapshot.signature);
  }

  throw new Error(
    `Keyboard focus did not reach ${await control.getAttribute("aria-label")} after ${maximumPresses} ${key} presses. Traversal: ${traversal.join(" -> ")}`,
  );
}

function cssDurationMilliseconds(value: string): number {
  const firstDuration = value.split(",")[0].trim();
  const numeric = Number.parseFloat(firstDuration);
  return firstDuration.endsWith("ms") ? numeric : numeric * 1_000;
}

test("maximum-length unbroken learner and model text remains readable without horizontal overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium", "mobile-chromium"].includes(testInfo.project.name),
    "Desktop Chromium and mobile Chromium cover the adversarial responsive widths.",
  );

  const session = structuredClone(seededDemoJson);
  session.question = `${"W".repeat(22)} ${"Q".repeat(277)}`;
  session.prediction = "P".repeat(1_000);
  session.evidenceDecision.establishes = "E".repeat(300);
  session.evidenceDecision.unresolved = "U".repeat(300);
  session.evidenceDecision.impact = "I".repeat(300);
  session.evidenceApplication.artifactAnchor = "long module";
  session.evidenceApplication.designChoice = `long module ${"L".repeat(388)}`;
  session.artifact = `long module ${"A".repeat(4_988)}`;
  session.reflectionInput.usedToThink = "B".repeat(800);
  session.reflectionInput.nowThink = "N".repeat(800);
  session.reflectionInput.stillWonder = "W".repeat(800);
  session.reflectionResult.specificFeedback = "F".repeat(800);
  session.reflectionResult.discoverySummary = "D".repeat(700);
  session.reflectionResult.changedThinking = "C".repeat(500);
  session.reflectionResult.keyTradeoff = "T".repeat(300);
  session.reflectionResult.newQuestions = [
    `${"X".repeat(239)}?`,
    `${"Y".repeat(239)}?`,
    `${"Z".repeat(239)}?`,
  ];
  session.reflectionResult.newQuestions.forEach((question, index) => {
    const node = session.map.nodes.find(
      (candidate) => candidate.id === `next-question-${index + 1}`,
    );
    if (!node) throw new Error("Expected all three next-question map nodes.");
    node.label = `${question.slice(0, 139)}…`;
  });

  await page.addInitScript((storedSession) => {
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: storedSession }),
    );
  }, session);

  const widths =
    testInfo.project.name === "mobile-chromium" ? [375, 320] : [1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Your question became a visible reasoning trace.",
      }),
    ).toBeVisible();
    const compactJudgment = page
      .getByRole("region", { name: "At a glance" })
      .locator(".trace-row")
      .filter({ hasText: "My evidence judgment" })
      .locator(".trace-value");
    await expect(compactJudgment).toContainText("Why it matters:");
    await expect(compactJudgment).toContainText("Source-scope boundary:");
    const compactJudgmentText = (await compactJudgment.innerText()).trim();
    expect(compactJudgmentText.length).toBeLessThanOrEqual(300);
    expect(compactJudgmentText.match(/…/g)).toHaveLength(2);
    if (testInfo.project.name === "mobile-chromium") {
      await page.getByRole("button", { name: "View map" }).click();
    }
    await expectNoHorizontalOverflow(page);
    await expectVisibleControlsWithinViewport(page);
    const mapLabelSpans = page.locator(".map-node-label tspan");
    await expect(mapLabelSpans.first()).toBeVisible();
    const mapLabels = await mapLabelSpans.allTextContents();
    expect(mapLabels.length).toBeGreaterThan(0);
    expect(
      Math.max(...mapLabels.map((label) => label.length)),
    ).toBeLessThanOrEqual(23);
    const labelBounds = await page
      .locator(".map-node-stage")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const card = node.querySelector<SVGGraphicsElement>(".map-node-card");
          const label =
            node.querySelector<SVGGraphicsElement>(".map-node-label");
          if (!card || !label) return null;
          const cardBox = card.getBBox();
          const labelBox = label.getBBox();
          return {
            label: node.getAttribute("aria-label"),
            cardLeft: cardBox.x,
            cardTop: cardBox.y,
            cardRight: cardBox.x + cardBox.width,
            cardBottom: cardBox.y + cardBox.height,
            labelLeft: labelBox.x,
            labelTop: labelBox.y,
            labelRight: labelBox.x + labelBox.width,
            labelBottom: labelBox.y + labelBox.height,
          };
        }),
      );
    expect(labelBounds).toHaveLength(9);
    for (const bounds of labelBounds) {
      expect(bounds).not.toBeNull();
      expect(
        bounds!.labelLeft,
        bounds!.label ?? "Curiosity Map label exceeds its card",
      ).toBeGreaterThanOrEqual(bounds!.cardLeft + 8);
      expect(
        bounds!.labelTop,
        bounds!.label ?? "Curiosity Map label exceeds its card",
      ).toBeGreaterThanOrEqual(bounds!.cardTop + 8);
      expect(
        bounds!.labelRight,
        bounds!.label ?? "Curiosity Map label exceeds its card",
      ).toBeLessThanOrEqual(bounds!.cardRight - 8);
      expect(
        bounds!.labelBottom,
        bounds!.label ?? "Curiosity Map label exceeds its card",
      ).toBeLessThanOrEqual(bounds!.cardBottom - 8);
    }
  }
});

interface MapHandoffCounters {
  focuses: number;
  scrolls: number;
}

async function installMapHandoffProbe(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    const counters = { focuses: 0, scrolls: 0 };
    Object.defineProperty(window, "__wonderlabMapHandoff", {
      configurable: true,
      value: counters,
    });
    document.addEventListener("focusin", (event) => {
      if ((event.target as HTMLElement | null)?.id === "curiosity-map") {
        counters.focuses += 1;
      }
    });
    const scrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (options) {
      if (this.id === "curiosity-map") counters.scrolls += 1;
      scrollIntoView.call(this, options);
    };
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
    );
  }, seededDemoJson);
}

async function readMapHandoffProbe(page: Page): Promise<MapHandoffCounters> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __wonderlabMapHandoff: MapHandoffCounters;
        }
      ).__wonderlabMapHandoff,
  );
}

async function holdMapChunk(page: Page): Promise<{
  blockedUrl: () => string;
  release: () => void;
}> {
  let releaseMapChunk = () => {};
  const mapChunkRelease = new Promise<void>((resolve) => {
    releaseMapChunk = resolve;
  });
  let blockedMapChunk = "";

  await page.route("**/*curiosity-map*.js", async (route) => {
    blockedMapChunk = route.request().url();
    await mapChunkRelease;
    await route.continue();
  });

  return {
    blockedUrl: () => blockedMapChunk,
    release: releaseMapChunk,
  };
}

test("a restored Branch focuses the real map once after its deferred chunk resolves", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium proves the deterministic deferred-map focus handoff.",
  );

  const mapChunk = await holdMapChunk(page);
  await installMapHandoffProbe(page);

  try {
    await page.goto("/");
    await expect(page.getByText("Drawing your Curiosity Map…")).toBeVisible();
    await expect.poll(mapChunk.blockedUrl).toContain("curiosity-map");
    await expect(page.locator("[data-screen-title]")).toBeFocused();
    expect(await readMapHandoffProbe(page)).toEqual({ focuses: 0, scrolls: 0 });
  } finally {
    mapChunk.release();
  }

  const map = page.locator("#curiosity-map");
  await expect(map).toBeVisible();
  await expect(map).toBeFocused();
  await expect
    .poll(() => readMapHandoffProbe(page))
    .toEqual({ focuses: 1, scrolls: 1 });

  const otherQuestion = page.getByRole("radio", {
    name: /how much food could 100 residents grow/i,
  });
  await otherQuestion.check();
  await expect(otherQuestion).toBeFocused();
  await expect
    .poll(() => readMapHandoffProbe(page))
    .toEqual({ focuses: 1, scrolls: 1 });
});

test("learner focus wins when the deferred Branch map resolves", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium proves the deterministic learner-focus guard.",
  );

  const mapChunk = await holdMapChunk(page);
  await installMapHandoffProbe(page);

  const otherQuestion = page.getByRole("radio", {
    name: /how much food could 100 residents grow/i,
  });
  try {
    await page.goto("/");
    await expect(page.getByText("Drawing your Curiosity Map…")).toBeVisible();
    await expect.poll(mapChunk.blockedUrl).toContain("curiosity-map");
    await otherQuestion.check();
    await expect(otherQuestion).toBeFocused();
    expect(await readMapHandoffProbe(page)).toEqual({ focuses: 0, scrolls: 0 });
  } finally {
    mapChunk.release();
  }

  const map = page.locator("#curiosity-map");
  await expect(map).toBeVisible();
  await expect(otherQuestion).toBeFocused();
  await expect(map).not.toBeFocused();
  await expect
    .poll(() => readMapHandoffProbe(page))
    .toEqual({ focuses: 0, scrolls: 0 });
});

test("a restored Reflect session preloads the Discovery Card before Branch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the deterministic deferred-card timing check.",
  );

  const restoredReflectSession: Record<string, unknown> =
    structuredClone(seededDemoJson);
  restoredReflectSession.step = "reflect";
  delete restoredReflectSession.reflectionInput;
  delete restoredReflectSession.reflectionResult;
  delete restoredReflectSession.selectedNextQuestionId;
  delete restoredReflectSession.map;

  let releaseCardChunk = () => {};
  const cardChunkRelease = new Promise<void>((resolve) => {
    releaseCardChunk = resolve;
  });
  let finishCardChunk = () => {};
  const cardChunkFinished = new Promise<void>((resolve) => {
    finishCardChunk = resolve;
  });
  let blockedCardChunk = "";
  await page.route("**/*discovery-card*.js", async (route) => {
    blockedCardChunk = route.request().url();
    await cardChunkRelease;
    await route.continue();
    finishCardChunk();
  });
  await page.addInitScript((session) => {
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
    );
  }, restoredReflectSession);

  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Make the change in your thinking visible.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/what evidence could make you revise/i),
    ).toBeVisible();
    await expect.poll(() => blockedCardChunk).toContain("discovery-card");
    await expect(
      page.getByRole("article", { name: "Discovery Card" }),
    ).toHaveCount(0);
  } finally {
    releaseCardChunk();
  }
  await cardChunkFinished;
});

test("a late seeded-demo chunk cannot overwrite a cleared Spark state", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the deterministic deferred-demo cancellation check.",
  );

  let releaseSeededDemo = () => {};
  const seededDemoRelease = new Promise<void>((resolve) => {
    releaseSeededDemo = resolve;
  });
  let blockedSeededDemo = "";
  await page.route("**/*seeded-demo*.js", async (route) => {
    blockedSeededDemo = route.request().url();
    await seededDemoRelease;
    await route.continue();
  });
  await page.addInitScript(() => {
    window.addEventListener(
      "reasonweave:seeded-demo-module-settled",
      () => {
        document.documentElement.dataset.seededDemoModuleSettled = "true";
      },
      { once: true },
    );
  });
  const question = page.getByLabel("What are you curious about?");

  try {
    await page.goto("/");
    await question.fill("How could a city stay cool without wasting water?");
    await page.getByRole("button", { name: /Try complete demo/i }).click();
    await expect.poll(() => blockedSeededDemo).toContain("seeded-demo");

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole("button", { name: "Clear session" }).click();
    await expect(question).toHaveValue("");
  } finally {
    releaseSeededDemo();
  }
  await expect(page.locator("html")).toHaveAttribute(
    "data-seeded-demo-module-settled",
    "true",
  );

  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toHaveCount(0);
  await expect(question).toHaveValue("");
});

test("the deferred Discovery Card reserves its mobile final-screen geometry", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The mobile project proves the deferred final-card height contract.",
  );
  const maximumExpectedSelectionShift = 16;

  await page.emulateMedia({ reducedMotion: "reduce" });

  const pendingBranchSession: Record<string, unknown> =
    structuredClone(seededDemoJson);
  delete pendingBranchSession.selectedNextQuestionId;

  let releaseCardChunk = () => {};
  const cardChunkRelease = new Promise<void>((resolve) => {
    releaseCardChunk = resolve;
  });
  let blockedCardChunk = "";

  await page.route("**/*discovery-card*.js", async (route) => {
    blockedCardChunk = route.request().url();
    await cardChunkRelease;
    await route.continue();
  });
  await page.addInitScript((session) => {
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
    );
  }, pendingBranchSession);

  await page.goto("/");
  await expect(page.locator(".map-panel-full")).toBeVisible();
  const pendingCard = page.locator(".discovery-card-pending");
  await expect(pendingCard).toBeVisible();
  await expect.poll(() => blockedCardChunk).toContain("discovery-card");

  const pendingGeometry = await pendingCard.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      documentTop: bounds.top + window.scrollY,
      height: bounds.height,
    };
  });

  try {
    const nextQuestionChoice = page.getByRole("radio", {
      name: /ecosystem signals should force the habitat/i,
    });
    await nextQuestionChoice.check();

    const loadingCard = page.locator(".discovery-card-loading");
    await expect(loadingCard).toBeVisible();
    const discoveryCardSlot = page.getByRole("region", {
      name: "Discovery Card",
    });
    await expect(discoveryCardSlot).toBeFocused();
    await expect
      .poll(async () =>
        discoveryCardSlot.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.top < window.innerHeight;
        }),
      )
      .toBe(true);
    const loadingGeometry = await loadingCard.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        documentTop: bounds.top + window.scrollY,
        height: bounds.height,
      };
    });
    expect(
      Math.abs(loadingGeometry.documentTop - pendingGeometry.documentTop),
    ).toBeLessThanOrEqual(maximumExpectedSelectionShift);
    expect(loadingGeometry.height).toBeGreaterThanOrEqual(
      pendingGeometry.height - 1,
    );
  } finally {
    releaseCardChunk();
  }

  const discoveryCard = page.getByRole("article", {
    name: "Discovery Card",
  });
  await expect(discoveryCard).toBeVisible();
  const finalGeometry = await discoveryCard.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      documentTop: bounds.top + window.scrollY,
      height: bounds.height,
    };
  });
  expect(
    Math.abs(finalGeometry.documentTop - pendingGeometry.documentTop),
  ).toBeLessThanOrEqual(maximumExpectedSelectionShift);
  expect(finalGeometry.height).toBeGreaterThanOrEqual(
    pendingGeometry.height - 1,
  );
});

async function expectNoAutomatedAccessibilityViolations(
  page: Page,
  screenName: string,
): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({
      target: node.target.join(" "),
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  }));

  expect(
    violations,
    `${screenName} has automated WCAG A/AA violations`,
  ).toEqual([]);
}

async function captureSubmissionFrame(page: Page): Promise<Buffer> {
  await suppressCaptureCaret(page);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(100);
  return page.screenshot({
    type: "jpeg",
    quality: 88,
    animations: "disabled",
  });
}

async function captureSectionFrame(
  page: Page,
  selector: string,
  topOffset = 78,
): Promise<Buffer> {
  await suppressCaptureCaret(page);
  await waitForVisualCaptureReady(page);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const targetY = await page
      .locator(selector)
      .evaluate(
        (element, offset) =>
          Math.round(
            Math.min(
              Math.max(
                0,
                document.documentElement.scrollHeight - window.innerHeight,
              ),
              Math.max(
                0,
                element.getBoundingClientRect().top + window.scrollY - offset,
              ),
            ),
          ),
        topOffset,
      );
    await page.evaluate((nextY) => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, nextY);
    }, targetY);
    await page.waitForFunction(
      (nextY) => Math.abs(window.scrollY - nextY) <= 1,
      targetY,
    );
    await waitForVisualCaptureReady(page);
  }
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return false;
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight;
  }, selector);
  return page.screenshot({
    type: "jpeg",
    quality: 88,
    animations: "disabled",
  });
}

async function waitForVisualCaptureReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function captureElementFrame(
  page: Page,
  selector: string,
): Promise<Buffer> {
  await suppressCaptureCaret(page);
  const stickyHeader = page.locator(".site-header");
  await stickyHeader.evaluate((header) => {
    header.style.visibility = "hidden";
  });
  try {
    return await page.locator(selector).screenshot({
      type: "jpeg",
      quality: 88,
      animations: "disabled",
    });
  } finally {
    await stickyHeader.evaluate((header) => {
      header.style.removeProperty("visibility");
    });
  }
}

async function suppressCaptureCaret(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (!document.querySelector("style[data-wonderlab-stable-capture]")) {
      const style = document.createElement("style");
      style.dataset.wonderlabStableCapture = "true";
      style.textContent = `
        * { caret-color: transparent !important; }
        button, a, input, textarea, select {
          transition: none !important;
        }
        textarea {
          resize: none !important;
          animation: none !important;
        }
        body { padding-bottom: 1200px !important; }
      `;
      document.head.appendChild(style);
    }
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement
    ) {
      active.blur();
    }
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test("the complete seeded quest preserves the learning gate and exports a nine-node trace", async ({
  page,
}, testInfo) => {
  const runtimeProblems = watchRuntime(page);
  const shouldCaptureSubmissionFrames =
    process.env.WONDERLAB_CAPTURE_SCREENSHOTS === "true" &&
    testInfo.project.name === "chromium";
  testInfo.setTimeout(shouldCaptureSubmissionFrames ? 600_000 : 180_000);
  const screenshotSourceSha = shouldCaptureSubmissionFrames
    ? gitOutput(["rev-parse", "HEAD"])
    : undefined;
  const screenshotOutput = shouldCaptureSubmissionFrames
    ? await prepareScreenshotOutput({
        root: process.cwd(),
        configuredOutput: process.env.WONDERLAB_SCREENSHOT_OUTPUT,
        sourceSha: screenshotSourceSha,
        sourceStatus: gitOutput([
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]),
      })
    : undefined;
  const storeScreenshot = async (
    filename: ScreenshotFilename,
    content: Buffer,
  ): Promise<void> => {
    if (!screenshotOutput) {
      throw new Error("Screenshot output was not prepared.");
    }
    await writeScreenshotOutput({
      binding: screenshotOutput,
      filename,
      content,
    });
  };

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const resetPrompts: string[] = [];
  let acceptReset = false;
  page.on("dialog", async (dialog) => {
    resetPrompts.push(dialog.message());
    if (acceptReset) await dialog.accept();
    else await dialog.dismiss();
  });
  await expect(page).toHaveURL(`${APP_ORIGIN}/`);
  await expect(page).toHaveTitle(PUBLIC_NAME_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await expect(page.locator(".route-card")).toHaveCount(0);
  const reducedMotionDuration = await page
    .locator(".screen")
    .evaluate((screen) => getComputedStyle(screen).animationDuration);
  expect(cssDurationMilliseconds(reducedMotionDuration)).toBeLessThanOrEqual(
    0.1,
  );
  await expectNoAutomatedAccessibilityViolations(page, "Spark");
  const skipLink = page.getByRole("link", { name: "Skip to quest" });
  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const sparkQuestion = page.getByLabel("What are you curious about?");
  const clearSession = page.getByRole("button", { name: "Clear session" });
  await expect(clearSession).toBeDisabled();
  await page.getByRole("button", { name: PUBLIC_NAME }).click();
  expect(resetPrompts).toEqual([]);
  await sparkQuestion.fill("Why do cities need parks?");
  await expect(clearSession).toBeEnabled();
  await clearSession.click();
  expect(resetPrompts).toEqual([
    "Start a new quest? Your current quest will be removed from this browser.",
  ]);
  await expect(sparkQuestion).toHaveValue("Why do cities need parks?");
  await expect(clearSession).toBeEnabled();
  acceptReset = true;
  await clearSession.click();
  expect(resetPrompts).toEqual([
    "Start a new quest? Your current quest will be removed from this browser.",
    "Start a new quest? Your current quest will be removed from this browser.",
  ]);
  await expect(sparkQuestion).toHaveValue("");
  await expect(clearSession).toBeDisabled();

  await page
    .getByRole("button", { name: "Could humans live underwater?" })
    .click();
  await expect(sparkQuestion).toHaveValue(SEEDED_QUESTION);
  if (shouldCaptureSubmissionFrames) {
    await storeScreenshot(
      "spark-desktop.jpg",
      await captureSubmissionFrame(page),
    );
  }

  await page.getByRole("button", { name: /Try complete demo/i }).click();

  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeVisible();
  await expect(page.getByText("Pre-generated demo").first()).toBeVisible();
  await expectNoAutomatedAccessibilityViolations(page, "Choose");
  if (shouldCaptureSubmissionFrames) {
    await storeScreenshot(
      "routes-desktop.jpg",
      await captureSubmissionFrame(page),
    );
  }

  const routeCards = page.locator(".route-card");
  const routeRadios = page.getByRole("radio");
  await expect(routeCards).toHaveCount(3);
  await expect(routeRadios).toHaveCount(3);
  await expect(routeCards.locator("img")).toHaveCount(3);
  await expect(
    routeCards.locator('[data-topic-visual="neutral-route"]'),
  ).toHaveCount(0);
  await expect(
    routeCards.getByRole("heading", { name: /Survive the Pressure/ }),
  ).toHaveCount(1);
  await expect(
    routeCards.getByRole("heading", { name: /Design the Habitat/ }),
  ).toHaveCount(1);
  await expect(
    routeCards.getByRole("heading", { name: /Protect the Ocean/ }),
  ).toHaveCount(1);
  expect(
    new Set(await routeCards.locator(".route-title").allTextContents()).size,
  ).toBe(3);

  const buildQuest = page.getByRole("button", { name: /Build my quest/i });
  await expect(buildQuest).toBeDisabled();

  const designRouteChoice = page.getByRole("radio", {
    name: "Design the Habitat",
  });
  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(routeRadios.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(designRouteChoice).toBeFocused();
  await expect(designRouteChoice).toHaveAttribute("aria-checked", "true");
  await expect(buildQuest).toBeEnabled();
  await buildQuest.click();

  await expect(
    page.getByRole("heading", { name: "Commit to a first model." }),
  ).toBeVisible();
  await expect(page.locator(".context-driving-question")).toContainText(
    "What would make a permanent underwater habitat viable for 100 people rather than merely survivable for a short visit?",
  );
  await expect(page.locator(".evidence-list")).toHaveCount(0);
  await expect(page.locator(".source-link")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Explain now with sources/i }),
  ).toHaveCount(0);
  await expectNoAutomatedAccessibilityViolations(page, "Predict");

  const predictionField = page.locator("#prediction-response");
  const lockPrediction = page.getByRole("button", {
    name: /Lock prediction/i,
  });
  await lockPrediction.click();
  await expect(page.locator("#prediction-response-error")).toBeVisible();
  await expect(predictionField).toHaveAttribute(
    "aria-describedby",
    "prediction-response-error",
  );
  await predictionField.fill(PREDICTION);
  if (shouldCaptureSubmissionFrames) {
    await storeScreenshot(
      "prediction-desktop.jpg",
      await captureSubmissionFrame(page),
    );
  }
  await lockPrediction.click();

  await expect(
    page.getByRole("heading", { name: "Put your model under pressure." }),
  ).toBeVisible();
  await expect(page.getByText(PREDICTION, { exact: true })).toBeVisible();
  await expect(page.locator(".evidence-list")).toHaveCount(0);
  await expect(page.locator(".source-link")).toHaveCount(0);

  const hint = page.getByRole("button", { name: "Hint" });
  await expect(hint).toHaveAttribute("aria-expanded", "false");
  await hint.click();
  await expect(hint).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#quest-hint")).toBeVisible();
  await expectNoAutomatedAccessibilityViolations(page, "Investigate");

  const explainWithSources = page.getByRole("button", {
    name: /Explain now with sources/i,
  });
  await expect(explainWithSources).toHaveCount(1);
  await explainWithSources.click();

  await expect(
    page.getByRole("heading", {
      name: "See what holds. Build what follows.",
    }),
  ).toBeVisible();
  await expect(
    page.locator('.evidence-item[data-kind="evidence"]'),
  ).toHaveCount(2);
  await expect(
    page.locator('.evidence-item[data-kind="inference"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.evidence-item[data-kind="open_question"]'),
  ).toHaveCount(1);

  const sourceLinks = page.locator(".source-link");
  await expect(sourceLinks).toHaveCount(3);
  await expect(sourceLinks.nth(0)).toHaveAttribute(
    "href",
    "https://oceanservice.noaa.gov/facts/pressure.html",
  );
  await expect(sourceLinks.nth(0)).toContainText("oceanservice.noaa.gov");
  await expect(sourceLinks.nth(0)).toHaveAccessibleName(
    /How does pressure change with ocean depth.*opens in a new tab/i,
  );
  await expect(sourceLinks.nth(1)).toHaveAttribute(
    "href",
    /environment\.fiu\.edu\/aquarius/,
  );
  await expect(sourceLinks.nth(2)).toHaveAttribute(
    "href",
    /nasa\.gov\/reference\/environmental-control-and-life-support-systems-eclss/,
  );
  await expect(
    page.getByText("What these sources do not settle:", { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "A complete response includes" }),
  ).toBeVisible();
  await expect(page.locator(".criteria-item")).toHaveCount(1);
  const evidenceDecisionSelect = page.getByLabel(
    "Choose one source-backed finding",
  );
  await expect(evidenceDecisionSelect.locator("option")).toHaveCount(3);
  await expect(
    evidenceDecisionSelect.locator('option[value="aquarius-dependence"]'),
  ).toHaveCount(1);
  await expect(
    evidenceDecisionSelect.locator('option[value="closed-loop-systems"]'),
  ).toHaveCount(0);
  await expectNoAutomatedAccessibilityViolations(page, "Create");

  const creationField = page.getByLabel("Build your response in the browser");
  const evidenceApplicationField = page.getByLabel("Finding → design choice");
  const creationAnchorField = page.getByLabel("Creation anchor phrase");
  expect(
    await page.locator(".evidence-application-panel").evaluate((panel) => {
      const creation = document.querySelector("#creation-response");
      return Boolean(
        creation &&
        (panel.compareDocumentPosition(creation) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
      );
    }),
  ).toBe(true);
  const finishCreation = page.getByRole("button", {
    name: /Finish creation/i,
  });
  await finishCreation.click();
  await expect(page.locator("#evidence-decision-error")).toContainText(
    "Choose one source-backed finding",
  );
  await expect(evidenceDecisionSelect).toHaveAttribute("aria-invalid", "true");
  await expectFocusedControlInViewport(page, evidenceDecisionSelect);

  await evidenceDecisionSelect.selectOption("aquarius-dependence");
  const complicates = page.getByRole("radio", {
    name: "Complicates my prediction",
  });
  await complicates.check();
  await finishCreation.click();
  const sourceNote = page.getByRole("textbox", { name: "Source note" });
  await expectFocusedControlInViewport(page, sourceNote);
  await expect(page.locator("#evidence-decision-error")).toContainText(
    "Write exactly three short lines",
  );
  await sourceNote.fill(
    [EVIDENCE_DECISION_ESTABLISHES, EVIDENCE_DECISION_UNRESOLVED].join("\n"),
  );
  await finishCreation.click();
  await expectFocusedControlInViewport(page, sourceNote);
  await expect(page.locator("#evidence-decision-error")).toContainText(
    "Write exactly three short lines",
  );
  await sourceNote.fill(EVIDENCE_DECISION_NOTE);
  await expect(complicates).toBeChecked();
  await finishCreation.click();
  await expect(page.locator("#creation-response-error")).toBeVisible();
  await expect(page.locator("#creation-response-error")).toContainText(
    "Evidence-to-design choice must be at least 20 characters",
  );
  await expectFocusedControlInViewport(page, evidenceApplicationField);
  await evidenceApplicationField.fill(EVIDENCE_APPLICATION_CHOICE);
  await creationAnchorField.fill(EVIDENCE_APPLICATION_ANCHOR);
  await evidenceDecisionSelect.selectOption("pressure-depth");
  await expect(evidenceApplicationField).toHaveValue("");
  await expect(creationAnchorField).toHaveValue("");
  await evidenceDecisionSelect.selectOption("aquarius-dependence");
  await evidenceApplicationField.fill(EVIDENCE_APPLICATION_CHOICE);
  await finishCreation.click();
  await expect(creationAnchorField).toHaveAttribute("aria-invalid", "true");
  await expectFocusedControlInViewport(page, creationAnchorField);
  await creationAnchorField.fill(EVIDENCE_APPLICATION_ANCHOR);
  if (shouldCaptureSubmissionFrames) {
    await storeScreenshot(
      "evidence-create-desktop.jpg",
      await captureElementFrame(page, ".evidence-application-panel"),
    );
  }
  await finishCreation.click();
  await expect(creationField).toHaveAttribute(
    "aria-describedby",
    "creation-response-error",
  );
  await expectFocusedControlInViewport(page, creationField);
  await creationField.fill(CREATION);
  await finishCreation.click();
  await expect(page.locator("#creation-response-error")).toContainText(
    "Review your creation against every completion criterion",
  );
  const creationReview = page.getByRole("checkbox", {
    name: /reviewed my response against every completion criterion/i,
  });
  await expect(creationReview).not.toBeChecked();
  await expectFocusedControlInViewport(page, creationReview);
  await creationReview.check();
  await finishCreation.click();

  await expect(
    page.getByRole("heading", {
      name: "Make the change in your thinking visible.",
    }),
  ).toBeVisible();
  const reflectionFields = page.locator(".reflection-field textarea");
  await expect(reflectionFields).toHaveCount(3);
  await expectNoAutomatedAccessibilityViolations(page, "Reflect");
  const revealMap = page.getByRole("button", {
    name: /Reveal my Curiosity Map/i,
  });
  await revealMap.click();
  await expect(page.locator("#reflection-response-error")).toBeVisible();
  await expect(reflectionFields.first()).toHaveAttribute(
    "aria-describedby",
    "reflection-response-error",
  );
  await page.getByLabel("I used to think…").fill(REFLECTION.usedToThink);
  await page.getByLabel("Now I think…").fill(REFLECTION.nowThink);
  await page.getByLabel("I still wonder…").fill(REFLECTION.stillWonder);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await revealMap.click();

  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Discovery Card" }),
  ).toBeVisible();
  const finalMap = page.locator(".map-panel-full");
  await expect(finalMap).toBeVisible();
  await expect(finalMap).toBeFocused();
  await expect
    .poll(async () =>
      finalMap.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }),
    )
    .toBe(true);
  await expect(finalMap.locator('g[role="listitem"]')).toHaveCount(9);
  await expect(finalMap.locator(".map-node-placeholder")).toHaveCount(0);
  await expect(finalMap.locator(".map-node-stage")).toHaveCount(9);
  await expect(finalMap.locator(".map-edge-stage")).toHaveCount(8);
  await expect(
    finalMap.locator('g[role="listitem"][aria-label^="Next question:"]'),
  ).toHaveCount(3);
  const copyMarkdown = page.getByRole("button", { name: /Copy Markdown/i });
  await expect(copyMarkdown).toBeDisabled();
  await expect(
    page.getByText(
      "Choose one branch to complete your portable learning trace.",
      { exact: true },
    ),
  ).toBeVisible();
  const nextQuestionChoice = page.getByRole("radio", {
    name: /ecosystem signals should force the habitat/i,
  });
  await nextQuestionChoice.check();
  await expect(nextQuestionChoice).toBeChecked();
  await expect(copyMarkdown).toBeEnabled();
  await expect(
    finalMap.locator('g[role="listitem"][aria-label^="My next question:"]'),
  ).toHaveCount(1);
  await expect(
    finalMap.locator('g[role="listitem"][aria-label^="Next question:"]'),
  ).toHaveCount(2);
  const atAGlance = page.getByRole("region", { name: "At a glance" });
  await expect(
    atAGlance.getByRole("heading", { name: "At a glance" }),
  ).toBeVisible();
  const compactJudgmentRow = atAGlance.locator(".trace-row").filter({
    hasText: "My evidence judgment",
  });
  await expect(compactJudgmentRow).toHaveCount(1);
  await expect(compactJudgmentRow.locator("dd")).toContainText(
    "Complicates my prediction",
  );
  await expect(compactJudgmentRow.locator("dd")).toContainText(
    EVIDENCE_DECISION_IMPACT,
  );
  await expect(compactJudgmentRow.locator("dd")).toContainText(
    EVIDENCE_DECISION_UNRESOLVED,
  );
  const fullLearningTrace = page.locator("details.full-learning-trace");
  await expect(fullLearningTrace).not.toHaveAttribute("open", "");
  await fullLearningTrace
    .getByText("Full learning trace", { exact: true })
    .click();
  await expect(fullLearningTrace).toHaveAttribute("open", "");
  const wonderLabResponse = page.locator(".trace-section").filter({
    has: page.getByRole("heading", { name: `${PUBLIC_NAME} response` }),
  });
  const feedbackRow = wonderLabResponse.locator(".trace-row").filter({
    has: page.getByText("Feedback", { exact: true }),
  });
  await expect(feedbackRow.locator("dd")).toContainText(
    "Your evidence judgment (complicates)",
  );
  await expect(feedbackRow.locator("dd")).toContainText(
    /Evidence used: FIU's Aquarius lab supports up to six crew/i,
  );
  await expect(feedbackRow.locator("dd")).toContainText(
    /100-person habitat's safety and independence remain unresolved/i,
  );
  await expect(feedbackRow.locator("dd")).toContainText(
    /Evidence-to-design link: Because Aquarius relies on surface systems/i,
  );
  await expect(feedbackRow.locator("dd")).toContainText(
    /Your creation: At 20 meters, I would use a surface-linked support module/i,
  );
  await expect(feedbackRow.locator("dd")).toContainText(
    /Still wondering: whether an underwater habitat could ever become mostly self-sufficient/i,
  );
  const discoveryCard = page.getByRole("article", { name: "Discovery Card" });
  const evidenceDecisionRow = discoveryCard.locator(".trace-row").filter({
    hasText: "Evidence decision",
  });
  await expect(evidenceDecisionRow).toHaveCount(1);
  await expect(
    evidenceDecisionRow.getByText("Evidence decision", { exact: true }),
  ).toBeVisible();
  await expect(evidenceDecisionRow.locator("dd")).toContainText(
    EVIDENCE_DECISION_ESTABLISHES,
  );
  await expect(evidenceDecisionRow.locator("dd")).toContainText(
    EVIDENCE_DECISION_UNRESOLVED,
  );
  await expect(evidenceDecisionRow.locator("dd")).toContainText(
    EVIDENCE_DECISION_IMPACT,
  );
  const evidenceApplicationRow = discoveryCard.locator(".trace-row").filter({
    hasText: "Evidence → design",
  });
  await expect(evidenceApplicationRow).toHaveCount(1);
  await expect(
    evidenceApplicationRow.getByText("Evidence → design", { exact: true }),
  ).toBeVisible();
  await expect(evidenceApplicationRow.locator("dd")).toContainText(
    EVIDENCE_APPLICATION_CHOICE,
  );
  const selectedQuestionRow = fullLearningTrace.locator(".trace-row").filter({
    has: page.getByText("My next question", { exact: true }),
  });
  await expect(selectedQuestionRow.locator("dd")).toContainText(
    "Which ecosystem signals should force the habitat",
  );
  await expect(
    page.getByText("Demo response · no live AI", { exact: true }),
  ).toBeVisible();
  const learnerChange = page.locator(".learner-change-band");
  await expect(
    learnerChange.getByText(REFLECTION.usedToThink, { exact: true }),
  ).toBeVisible();
  await expect(
    learnerChange.getByText(REFLECTION.nowThink, { exact: true }),
  ).toBeVisible();
  await expect(learnerChange.locator(".learner-still-wonders")).toContainText(
    REFLECTION.stillWonder,
  );
  await expect(
    page.getByRole("heading", { name: "Your change" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What the thread reveals" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pre-generated demo synthesis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /underwater habitat/i }),
  ).toBeVisible();

  await expect(
    finalMap.locator(
      'g[role="listitem"][aria-label*="Pressure will be hardest because the structure"]',
    ),
  ).toHaveCount(1);
  await expect(
    finalMap.locator(
      'g[role="listitem"][aria-label*="Complicates — Source boundary: A 100-person habitat\'s safety and independence"]',
    ),
  ).toHaveCount(1);
  await expect(
    finalMap.locator(
      'g[role="listitem"][aria-label*="Because Aquarius relies on surface systems"]',
    ),
  ).toHaveCount(1);
  await expect(
    finalMap.locator(
      'g[role="listitem"][aria-label*="Maintenance, food, and redundant life support may be… depends on the others"]',
    ),
  ).toHaveCount(1);
  await expect(
    finalMap.locator(
      'g[role="listitem"][aria-label="Prediction: Initial prediction"]',
    ),
  ).toHaveCount(0);

  await finalMap.evaluate((element) => {
    document.documentElement.style.scrollBehavior = "auto";
    element.scrollIntoView({ block: "center" });
  });
  await expect(finalMap).toHaveAttribute("data-reveal-cycle", "0");
  await finalMap.getByRole("button", { name: "Replay trail" }).click();
  await expect(finalMap).toHaveAttribute("data-reveal-cycle", "1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMapMotion = await finalMap
    .locator(".map-node-stage")
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(reducedMapMotion).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const normalMapMotion = await finalMap
    .locator(".map-node-stage")
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  const edgeMotion = await finalMap
    .locator(".map-edge-stage")
    .first()
    .evaluate((edge) => getComputedStyle(edge).animationName);
  const nodeRevealDelays = await finalMap
    .locator(".map-node-stage")
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationDelay),
    );
  expect(normalMapMotion).toBe("map-node-enter");
  expect(edgeMotion).toBe("map-edge-enter");
  expect(
    cssDurationMilliseconds(nodeRevealDelays.at(-1) ?? "0ms"),
  ).toBeGreaterThan(cssDurationMilliseconds(nodeRevealDelays[0] ?? "0ms"));
  await page.emulateMedia({ reducedMotion: "reduce" });

  const outlineIsMobileDefault = testInfo.project.name === "mobile-chromium";
  await expect(finalMap).toHaveAttribute("data-map-view", "responsive");
  const outlineButton = finalMap.getByRole("button", {
    name: outlineIsMobileDefault ? "View map" : "View text outline",
  });
  await expect(outlineButton).toHaveAttribute(
    "aria-controls",
    "curiosity-map-outline",
  );
  const mapOutline = finalMap.locator("#curiosity-map-outline");
  if (outlineIsMobileDefault) {
    await expect(mapOutline).toBeVisible();
    await expect(finalMap.locator(".map-scroll")).toBeHidden();
  } else {
    await expect(mapOutline).toBeHidden();
    await expect(finalMap.locator(".map-scroll")).toBeVisible();
    await outlineButton.click();
    await expect(finalMap).toHaveAttribute("data-map-view", "outline");
    await expect(mapOutline).toBeFocused();
  }
  await expect(finalMap.locator(".map-scroll")).toBeHidden();
  await expect(mapOutline.locator("li")).toHaveCount(9);
  await expect(
    finalMap
      .locator(".map-outline li")
      .filter({ hasText: `Starting question: ${SEEDED_QUESTION}` }),
  ).toBeVisible();
  await expect(
    finalMap.locator(".map-outline li").filter({
      hasText: "Pressure will be hardest because the structure",
    }),
  ).toBeVisible();
  await expect(
    finalMap.locator(".map-outline li").filter({
      hasText:
        "Complicates — Source boundary: A 100-person habitat's safety and independence",
    }),
  ).toBeVisible();
  await expect(
    finalMap.locator(".map-outline li").filter({
      hasText: "Because Aquarius relies on surface systems",
    }),
  ).toBeVisible();
  await finalMap.getByRole("button", { name: "View map" }).click();
  await expect(finalMap).toHaveAttribute("data-map-view", "map");
  await expect(finalMap.locator(".map-scroll")).toBeVisible();
  await expect(mapOutline).toBeHidden();
  if (outlineIsMobileDefault) {
    const mapScrollPosition = await finalMap
      .locator(".map-scroll")
      .evaluate((element) => ({
        actual: element.scrollLeft,
        centered: (element.scrollWidth - element.clientWidth) / 2,
      }));
    expect(mapScrollPosition.centered).toBeGreaterThan(0);
    expect(mapScrollPosition.actual).toBeCloseTo(mapScrollPosition.centered, 0);
  }
  await expect(
    finalMap.getByRole("button", { name: "View text outline" }),
  ).toBeFocused();
  await expectNoAutomatedAccessibilityViolations(page, "Discovery");

  if (testInfo.project.name === "mobile-chromium") {
    const traceLayout = await page
      .locator(".trace-row")
      .first()
      .evaluate((row) => {
        const label = row.querySelector("dt");
        const value = row.querySelector("dd");
        if (
          !(label instanceof HTMLElement) ||
          !(value instanceof HTMLElement)
        ) {
          throw new Error("Expected a trace label and value");
        }
        const labelBox = label.getBoundingClientRect();
        const valueBox = value.getBoundingClientRect();
        return {
          labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
          valueFontSize: Number.parseFloat(getComputedStyle(value).fontSize),
          labelBottom: labelBox.bottom,
          labelLeft: labelBox.left,
          valueTop: valueBox.top,
          valueLeft: valueBox.left,
        };
      });
    expect(traceLayout.labelFontSize).toBeGreaterThanOrEqual(14);
    expect(traceLayout.valueFontSize).toBeGreaterThanOrEqual(14);
    expect(traceLayout.valueTop).toBeGreaterThanOrEqual(
      traceLayout.labelBottom,
    );
    expect(
      Math.abs(traceLayout.valueLeft - traceLayout.labelLeft),
    ).toBeLessThan(1);
  }

  await copyMarkdown.click();
  await expect(
    page.getByText("Copied — your trace is ready to share.", { exact: true }),
  ).toBeVisible();

  let exportedMarkdown: string;
  if (testInfo.project.name === "webkit") {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download \.md/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(DISCOVERY_CARD_FILENAME);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    exportedMarkdown = Buffer.concat(chunks).toString("utf8");
  } else {
    exportedMarkdown = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
  }
  expect(exportedMarkdown).toContain(`# ${PUBLIC_NAME} Learning Trace`);
  expect(exportedMarkdown).toContain("## Initial prediction");
  expect(exportedMarkdown).toContain(PREDICTION);
  expect(exportedMarkdown).toContain("## Evidence Lens");
  expect(exportedMarkdown).toContain("## Learner evidence decision");
  expect(exportedMarkdown).toContain("Complicates the initial prediction");
  expect(exportedMarkdown).toContain(EVIDENCE_DECISION_ESTABLISHES);
  expect(exportedMarkdown).toContain(EVIDENCE_DECISION_UNRESOLVED);
  expect(exportedMarkdown).toContain(EVIDENCE_DECISION_IMPACT);
  expect(exportedMarkdown).toContain("## Evidence → design");
  expect(exportedMarkdown).toContain(EVIDENCE_APPLICATION_CHOICE);
  expect(exportedMarkdown).toContain(
    "FIU's Aquarius lab supports up to six crew",
  );
  expect(exportedMarkdown).toContain(
    "Aquarius Reef Base Facilities and Vessels",
  );
  expect(exportedMarkdown).toContain(
    "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
  );
  expect(exportedMarkdown).toContain(CREATION);
  expect(exportedMarkdown).toContain(REFLECTION.usedToThink);
  expect(exportedMarkdown).toContain(REFLECTION.nowThink);
  expect(exportedMarkdown).toContain(REFLECTION.stillWonder);
  expect(exportedMarkdown).toContain("## My next question");
  expect(exportedMarkdown).toContain(
    "Which ecosystem signals should force the habitat to reduce or stop operations?",
  );
  expect(exportedMarkdown).toContain("## Three next questions");

  if (shouldCaptureSubmissionFrames) {
    if (!screenshotOutput) {
      throw new Error("Screenshot output was not prepared.");
    }
    await page.setViewportSize({ width: 1440, height: 810 });
    await storeScreenshot(
      "discovery-desktop.jpg",
      await captureSectionFrame(page, ".discovery-grid", 42),
    );
    await page.setViewportSize({ width: 900, height: 900 });
    await page.locator("#main-content").focus();
    const stickyHeader = page.locator(".site-header");
    await stickyHeader.evaluate((header) => {
      header.style.visibility = "hidden";
    });
    await storeScreenshot(
      "discovery-card-desktop.jpg",
      await page.locator(".discovery-card").screenshot({
        type: "jpeg",
        quality: 88,
        animations: "disabled",
      }),
    );
    await stickyHeader.evaluate((header) => {
      header.style.removeProperty("visibility");
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await storeScreenshot(
      "discovery-mobile.jpg",
      await captureSectionFrame(page, ".discovery-card", 80),
    );
    await finalMap.getByRole("button", { name: "View text outline" }).click();
    const mobileMapOutline = finalMap.locator(".map-outline");
    const mobileCreation = mobileMapOutline
      .locator("li")
      .filter({ hasText: "Creation:" });
    await expect(mobileCreation).toBeAttached();
    const mobileSelectedQuestion = mobileMapOutline
      .locator("li")
      .filter({ hasText: "My next question:" });
    await expect(mobileSelectedQuestion).toBeVisible();
    await mobileMapOutline.evaluate((outline) => {
      const firstSuggestedQuestion = [...outline.querySelectorAll("li")].find(
        (item) => item.textContent?.trimStart().startsWith("Next question:"),
      );
      if (!firstSuggestedQuestion) {
        throw new Error("Expected a suggested next-question map item");
      }
      const itemBounds = firstSuggestedQuestion.getBoundingClientRect();
      const outlineBounds = outline.getBoundingClientRect();
      outline.scrollTop = Math.max(
        0,
        outline.scrollTop + itemBounds.top - outlineBounds.top - 8,
      );
    });
    await expect
      .poll(() =>
        mobileSelectedQuestion.evaluate((item) => {
          const outline = item.closest(".map-outline");
          if (!(outline instanceof HTMLElement)) return false;
          const itemBounds = item.getBoundingClientRect();
          const outlineBounds = outline.getBoundingClientRect();
          return (
            itemBounds.top >= outlineBounds.top &&
            itemBounds.bottom <= outlineBounds.bottom
          );
        }),
      )
      .toBe(true);
    await storeScreenshot(
      "discovery-mobile-trace.jpg",
      await captureSectionFrame(page, ".map-panel-full", 72),
    );
    await finalMap.getByRole("button", { name: "View map" }).click();
    await finalizeScreenshotOutput({
      root: process.cwd(),
      binding: screenshotOutput,
      endingSourceSha: gitOutput(["rev-parse", "HEAD"]),
      endingSourceStatus: gitOutput([
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ]),
    });
  }

  await expectNoHorizontalOverflow(page);
  expect(
    await page.evaluate(() =>
      Boolean(window.localStorage.getItem("wonderlab.session.v4")),
    ),
  ).toBe(true);
  const savedAtBeforeReload = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.session.v4") ?? "null",
    ) as { savedAt?: unknown } | null;
    window.localStorage.removeItem("wonderlab.drafts.v4");
    return stored?.savedAt;
  });

  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  const reloadedFullLearningTrace = page.locator("details.full-learning-trace");
  await reloadedFullLearningTrace
    .getByText("Full learning trace", {
      exact: true,
    })
    .click();
  await expect(reloadedFullLearningTrace).toHaveAttribute("open", "");
  await expect(
    page
      .locator(".discovery-card .trace-row")
      .filter({ hasText: "Evidence → design" })
      .locator("dd"),
  ).toContainText(EVIDENCE_APPLICATION_CHOICE);
  await expect(
    page.getByRole("radio", {
      name: /ecosystem signals should force the habitat/i,
    }),
  ).toBeChecked();
  const savedAtAfterReload = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.session.v4") ?? "null",
    ) as { savedAt?: unknown } | null;
    return stored?.savedAt;
  });
  expect(savedAtAfterReload).toBe(savedAtBeforeReload);
  const rebuiltDraftSavedAt = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.drafts.v4") ?? "null",
    ) as { savedAt?: unknown } | null;
    return stored?.savedAt;
  });
  expect(rebuiltDraftSavedAt).toBe(savedAtBeforeReload);
  await page.getByRole("button", { name: PUBLIC_NAME }).click();
  expect(resetPrompts).toEqual([
    "Start a new quest? Your current quest will be removed from this browser.",
    "Start a new quest? Your current quest will be removed from this browser.",
    "Start a new quest? Your current quest will be removed from this browser.",
  ]);
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await expect(sparkQuestion).toHaveValue("");
  await expect(clearSession).toBeDisabled();
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("wonderlab.session.v4"),
    ),
  ).toBeNull();
  expect(runtimeProblems).toEqual([]);
});

test("the complete seeded quest is keyboard-operable from Spark through the final learning trace", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused provider-free keyboard traversal check.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const sparkHeading = page.getByRole("heading", {
    name: "Make your reasoning visible.",
  });
  await expectKeyboardFocusedTarget(page, sparkHeading);

  const brand = page.getByRole("button", { name: PUBLIC_NAME });
  const skipLink = page.getByRole("link", { name: "Skip to quest" });
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, brand);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, skipLink);
  await page.keyboard.press("Enter");
  await expectKeyboardFocusedTarget(page, page.locator("#main-content"));

  const sparkQuestion = page.getByLabel("What are you curious about?");
  await pressKeyUntilFocused(page, sparkQuestion, "Tab");
  await page.keyboard.type("A temporary keyboard-entered question");
  await expect(sparkQuestion).toHaveValue(
    "A temporary keyboard-entered question",
  );

  const underwaterPreset = page.getByRole("button", {
    name: SEEDED_QUESTION,
  });
  await pressKeyUntilFocused(page, underwaterPreset, "Tab");
  await page.keyboard.press("Enter");
  await expect(sparkQuestion).toHaveValue(SEEDED_QUESTION);

  const collegeLevel = page.getByRole("button", { name: "College" });
  await pressKeyUntilFocused(page, collegeLevel, "Tab");
  await page.keyboard.press("Enter");
  await expect(collegeLevel).toHaveAttribute("aria-pressed", "true");

  const fifteenMinutes = page.getByRole("button", { name: "15 min" });
  await pressKeyUntilFocused(page, fifteenMinutes, "Tab");
  await page.keyboard.press("Enter");
  await expect(fifteenMinutes).toHaveAttribute("aria-pressed", "true");

  const completeDemo = page.getByRole("button", {
    name: "Try complete demo",
  });
  await pressKeyUntilFocused(page, completeDemo, "Tab");
  await page.keyboard.press("Enter");

  const chooseHeading = page.getByRole("heading", {
    name: "Three ways into your question.",
  });
  await expectKeyboardFocusedTarget(page, chooseHeading);
  const firstRoute = page.getByRole("radio", { name: "Survive the Pressure" });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, firstRoute);
  const designRoute = page.getByRole("radio", { name: "Design the Habitat" });
  await page.keyboard.press("ArrowRight");
  await expectKeyboardFocusedTarget(page, designRoute);
  await expect(designRoute).toHaveAttribute("aria-checked", "true");
  await expectNoHorizontalOverflow(page);
  await expectVisibleControlsWithinViewport(page);
  const buildQuest = page.getByRole("button", { name: /Build my quest/i });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, buildQuest);
  await page.keyboard.press("Enter");

  const predictHeading = page.getByRole("heading", {
    name: "Commit to a first model.",
  });
  await expectKeyboardFocusedTarget(page, predictHeading);
  const predictionField = page.getByRole("textbox", {
    name: /Your prediction/i,
  });
  await pressKeyUntilFocused(page, predictionField, "Tab");
  await page.keyboard.type(PREDICTION);
  await expect(predictionField).toHaveValue(PREDICTION);
  const lockPrediction = page.getByRole("button", {
    name: /Lock prediction/i,
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, lockPrediction);
  await page.keyboard.press("Enter");

  const investigateHeading = page.getByRole("heading", {
    name: "Put your model under pressure.",
  });
  await expectKeyboardFocusedTarget(page, investigateHeading);
  const hint = page.getByRole("button", { name: "Hint" });
  await pressKeyUntilFocused(page, hint, "Tab");
  await page.keyboard.press("Space");
  await expect(hint).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#quest-hint")).toBeVisible();
  const explainWithSources = page.getByRole("button", {
    name: /Explain now with sources/i,
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, explainWithSources);
  await page.keyboard.press("Enter");

  const createHeading = page.getByRole("heading", {
    name: "See what holds. Build what follows.",
  });
  await expectKeyboardFocusedTarget(page, createHeading);
  const evidenceList = page.locator(".evidence-list");
  const pressureSource = evidenceList.getByRole("link", {
    name: /How does pressure change with ocean depth.*opens in a new tab/i,
  });
  const aquariusSource = evidenceList.getByRole("link", {
    name: /Aquarius Reef Base Facilities and Vessels.*opens in a new tab/i,
  });
  const lifeSupportSource = evidenceList.getByRole("link", {
    name: /Environmental Control and Life Support Systems.*opens in a new tab/i,
  });
  await expect(pressureSource).toHaveAttribute(
    "href",
    "https://oceanservice.noaa.gov/facts/pressure.html",
  );
  await expect(aquariusSource).toHaveAttribute(
    "href",
    "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
  );
  await expect(lifeSupportSource).toHaveAttribute(
    "href",
    "https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/",
  );
  await pressKeyUntilFocused(page, pressureSource, "Tab");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, aquariusSource);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, lifeSupportSource);

  const evidenceSelect = page.getByLabel("Choose one source-backed finding");
  await pressKeyUntilFocused(page, evidenceSelect, "Tab");
  await page.keyboard.type("Finding 2");
  await expect(evidenceSelect).toHaveValue("aquarius-dependence");

  const scopedAquariusSource = page
    .getByRole("list", { name: "Sources linked to the selected finding" })
    .getByRole("link", {
      name: "Aquarius Reef Base Facilities and Vessels — environment.fiu.edu (opens in a new tab)",
    });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, scopedAquariusSource);
  await expect(scopedAquariusSource).toHaveAttribute(
    "href",
    "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
  );

  const supportsPrediction = page.getByRole("radio", {
    name: "Supports my prediction",
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, supportsPrediction);
  await page.keyboard.press("ArrowRight");
  await expectActiveDiscernibleKeyboardFocus(page);
  await page.keyboard.press("ArrowRight");
  const complicatesPrediction = page.getByRole("radio", {
    name: "Complicates my prediction",
  });
  await expectKeyboardFocusedTarget(page, complicatesPrediction);
  await expect(complicatesPrediction).toBeChecked();

  const sourceNote = page.getByRole("textbox", { name: "Source note" });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, sourceNote);
  await page.keyboard.type(EVIDENCE_DECISION_ESTABLISHES);
  await page.keyboard.press("Enter");
  await page.keyboard.type(EVIDENCE_DECISION_UNRESOLVED);
  await page.keyboard.press("Enter");
  await page.keyboard.type(EVIDENCE_DECISION_IMPACT);

  const designChoice = page.getByLabel("Finding → design choice");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, designChoice);
  await page.keyboard.type(EVIDENCE_APPLICATION_CHOICE);
  const creationAnchor = page.getByLabel("Creation anchor phrase");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, creationAnchor);
  await page.keyboard.type(EVIDENCE_APPLICATION_ANCHOR);
  const creationField = page.getByLabel("Build your response in the browser");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, creationField);
  await page.keyboard.type(CREATION);
  const creationReview = page.getByRole("checkbox", {
    name: /reviewed my response against every completion criterion/i,
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, creationReview);
  await page.keyboard.press("Space");
  await expect(creationReview).toBeChecked();
  const finishCreation = page.getByRole("button", {
    name: /Finish creation/i,
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, finishCreation);
  await page.keyboard.press("Enter");

  const reflectHeading = page.getByRole("heading", {
    name: "Make the change in your thinking visible.",
  });
  await expectKeyboardFocusedTarget(page, reflectHeading);
  const usedToThink = page.getByLabel("I used to think…");
  await pressKeyUntilFocused(page, usedToThink, "Tab");
  await page.keyboard.type(REFLECTION.usedToThink);
  const nowThink = page.getByLabel("Now I think…");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, nowThink);
  await page.keyboard.type(REFLECTION.nowThink);
  const stillWonder = page.getByLabel("I still wonder…");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, stillWonder);
  await page.keyboard.type(REFLECTION.stillWonder);
  const revealMap = page.getByRole("button", {
    name: /Reveal my Curiosity Map/i,
  });
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, revealMap);
  await page.keyboard.press("Enter");

  const finalMap = page.locator(".map-panel-full");
  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  await expectKeyboardFocusedTarget(page, finalMap);

  const selectedQuestion = page.getByRole("radio", {
    name: "Which ecosystem signals should force the habitat to reduce or stop operations?",
  });
  const newQuestion = page.getByRole("button", { name: "New question" });
  const showMap = page.getByRole("button", { name: "Show Curiosity Map" });
  const clearSession = page.getByRole("button", { name: "Clear session" });
  const replayTrail = finalMap.getByRole("button", { name: "Replay trail" });
  const textOutline = finalMap.getByRole("button", {
    name: "View text outline",
  });
  const mapGraphic = finalMap.getByRole("region", {
    name: "Scrollable Curiosity Map graphic",
  });
  const selectedSource = page.locator(".trace-at-a-glance").getByRole("link", {
    name: "Aquarius Reef Base Facilities and Vessels — environment.fiu.edu (opens in a new tab)",
  });
  const fullLearningTrace = page.locator("details.full-learning-trace");
  const fullLearningTraceSummary = fullLearningTrace.locator("summary");
  const fullTraceSource = fullLearningTrace.getByRole("link", {
    name: "Aquarius Reef Base Facilities and Vessels — environment.fiu.edu (opens in a new tab)",
  });
  const copyMarkdown = page.getByRole("button", { name: "Copy Markdown" });
  const downloadMarkdown = page.getByRole("button", { name: "Download .md" });

  await page.keyboard.press("Shift+Tab");
  const nextQuestionRadios = page.getByRole("radio");
  await expect
    .poll(() =>
      nextQuestionRadios.evaluateAll((radios) =>
        radios.some((radio) => radio === document.activeElement),
      ),
    )
    .toBe(true);
  await expectActiveDiscernibleKeyboardFocus(page);
  for (let move = 0; move < 3; move += 1) {
    if (
      await selectedQuestion.evaluate(
        (element) => element === document.activeElement,
      )
    ) {
      break;
    }
    await page.keyboard.press("ArrowRight");
    await expectActiveDiscernibleKeyboardFocus(page);
  }
  await expectKeyboardFocusedTarget(page, selectedQuestion);
  if (!(await selectedQuestion.isChecked())) await page.keyboard.press("Space");
  await expect(selectedQuestion).toBeChecked();
  await expect(selectedQuestion).toHaveAccessibleName(
    "Which ecosystem signals should force the habitat to reduce or stop operations?",
  );
  await expect(replayTrail).toHaveAccessibleName("Replay trail");
  await expect(textOutline).toHaveAccessibleName("View text outline");
  await expect(mapGraphic).toHaveAccessibleName(
    "Scrollable Curiosity Map graphic",
  );
  await expect(selectedSource).toHaveAttribute(
    "href",
    "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
  );
  await expect(fullLearningTrace).not.toHaveAttribute("open", "");
  await expect(copyMarkdown).toBeEnabled();
  await expect(downloadMarkdown).toBeEnabled();
  await expectVisibleControlsWithinViewport(page);

  // Reverse traversal reaches the contextual reset first, then the persistent
  // header actions, so a learner can recover or reorient without a mouse.
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, newQuestion);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, clearSession);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, showMap);

  await pressKeyUntilFocused(page, selectedQuestion, "Tab", 4);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, replayTrail);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, textOutline);
  await page.keyboard.press("Enter");
  const mapOutline = finalMap.getByRole("region", {
    name: "Curiosity Map text outline",
  });
  await expectKeyboardFocusedTarget(page, mapOutline);
  await expect(mapOutline.locator("li")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expectKeyboardFocusedTarget(page, textOutline);
  await expect(finalMap).toHaveAttribute("data-map-view", "map");
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, mapGraphic);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, selectedSource);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, fullLearningTraceSummary);
  await page.keyboard.press("Enter");
  await expect(fullLearningTrace).toHaveAttribute("open", "");

  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, fullTraceSource);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, copyMarkdown);
  await expect(
    page.getByRole("heading", { name: "Discuss this trace" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "What would make you revise that evidence decision or design choice?",
      { exact: true },
    ),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Copied — your trace is ready to share.", { exact: true }),
  ).toBeVisible();
  const keyboardExport = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(keyboardExport).toContain(
    "**What the cited sources do not settle (source scope):**",
  );
  expect(keyboardExport).toContain(EVIDENCE_DECISION_UNRESOLVED);
  await page.keyboard.press("Tab");
  await expectKeyboardFocusedTarget(page, downloadMarkdown);
  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(DISCOVERY_CARD_FILENAME);

  // Reverse through the final-card actions to prove the disclosure and source
  // remain reachable in both directions.
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, copyMarkdown);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, fullTraceSource);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, fullLearningTraceSummary);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardFocusedTarget(page, selectedSource);
  expect(runtimeProblems).toEqual([]);
});

test("the Protect the Ocean route remains coherent through sourced evidence on mobile", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This is the focused mobile project smoke.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/");
  await expect(page).toHaveTitle(PUBLIC_NAME_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  const mobileProgress = page.locator(".mobile-progress");
  await expect(mobileProgress).toBeVisible();
  await expect(mobileProgress).toHaveText("Spark · 1/7");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Try complete demo/i }).click();
  await expect(mobileProgress).toHaveText("Choose · 2/7");
  await expect(page.locator(".route-card")).toHaveCount(3);

  const oceanRoute = page.locator(".route-card").filter({
    has: page.getByRole("heading", { name: "Protect the Ocean" }),
  });
  await oceanRoute.scrollIntoViewIfNeeded();
  await oceanRoute.locator(".route-visual").click();
  await expect(oceanRoute).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: /Build my quest/i }),
  ).toBeEnabled();

  const routeBox = await oceanRoute.boundingBox();
  const viewport = page.viewportSize();
  expect(routeBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(routeBox!.x).toBeGreaterThanOrEqual(0);
  expect(routeBox!.x + routeBox!.width).toBeLessThanOrEqual(
    viewport!.width + 1,
  );

  await page.getByRole("button", { name: /Build my quest/i }).click();
  await expect(mobileProgress).toHaveText("Predict · 3/7");
  const [workspaceMainBox, workspaceMapBox] = await Promise.all([
    page.locator(".workspace-main").boundingBox(),
    page.locator(".workspace-map-column").boundingBox(),
  ]);
  expect(workspaceMainBox).not.toBeNull();
  expect(workspaceMapBox).not.toBeNull();
  expect(workspaceMainBox!.y).toBeLessThan(workspaceMapBox!.y);
  await expect(
    page.getByText(/continuous sound, wastewater discharge/i),
  ).toBeVisible();
  await page.locator("#prediction-response").fill(OCEAN_PREDICTION);
  await page.getByRole("button", { name: /Lock prediction/i }).click();

  await expect(
    page.getByText(/evidence about ocean sound, water-discharge controls/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /Explain now with sources/i }).click();

  await expect(
    page.getByRole("heading", { name: "See what holds. Build what follows." }),
  ).toBeVisible();
  await expect(
    page
      .locator(".evidence-statement")
      .filter({ hasText: /human-caused ocean sound can displace animals/i }),
  ).toBeVisible();
  await expect(
    page.locator(".evidence-statement").filter({
      hasText: /point-source discharge permits set pollutant limits/i,
    }),
  ).toBeVisible();
  await expect(
    page.locator('.evidence-item[data-kind="evidence"]'),
  ).toHaveCount(2);
  await expect(
    page.locator('.evidence-item[data-kind="inference"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.evidence-item[data-kind="open_question"]'),
  ).toHaveCount(1);

  const ecosystemSourceUrls = await page
    .locator(".source-link")
    .evaluateAll((links) =>
      [
        ...new Set(links.map((link) => (link as HTMLAnchorElement).href)),
      ].sort(),
    );
  expect(ecosystemSourceUrls).toEqual(
    [
      "https://www.epa.gov/npdes/npdes-permit-basics",
      "https://www.fisheries.noaa.gov/insight/understanding-sound-ocean",
    ].sort(),
  );
  await expectNoAutomatedAccessibilityViolations(
    page,
    "Protect the Ocean evidence",
  );
  await expectNoHorizontalOverflow(page);
  expect(runtimeProblems).toEqual([]);
});

test("the Survive the Pressure route remains coherent through sourced evidence in Firefox", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "firefox",
    "This is the focused Firefox route-coherence smoke.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Try complete demo/i }).click();

  const pressureRoute = page.locator(".route-card").filter({
    has: page.getByRole("heading", { name: "Survive the Pressure" }),
  });
  await pressureRoute.click();
  await page.getByRole("button", { name: /Build my quest/i }).click();

  await expect(
    page.getByText(/Choose a depth range for an underwater habitat/i),
  ).toBeVisible();
  await page
    .locator("#prediction-response")
    .fill(
      "At 20 meters, pressure-managed entry and slower repair access will create a more dangerous failure chain than wall strength alone.",
    );
  await page.getByRole("button", { name: /Lock prediction/i }).click();

  await expect(
    page.getByText(/pressure-managed entry, and surface-linked support/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /Explain now with sources/i }).click();

  await expect(
    page
      .locator(".evidence-statement")
      .filter({ hasText: /ocean pressure increases by one atmosphere/i }),
  ).toBeVisible();
  await expect(
    page
      .locator(".evidence-statement")
      .filter({ hasText: /wet porch, two pressure locks/i }),
  ).toBeVisible();
  const pressureSourceUrls = await page
    .locator(".source-link")
    .evaluateAll((links) =>
      [
        ...new Set(links.map((link) => (link as HTMLAnchorElement).href)),
      ].sort(),
    );
  expect(pressureSourceUrls).toEqual(
    [
      "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
      "https://oceanservice.noaa.gov/facts/pressure.html",
    ].sort(),
  );
  await expect(page.locator('.source-link[href*="nasa.gov"]')).toHaveCount(0);
  await expectNoAutomatedAccessibilityViolations(
    page,
    "Survive the Pressure evidence",
  );
  expect(runtimeProblems).toEqual([]);
});

test("draft persistence debounces input and flushes pending work on pagehide", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused storage instrumentation for this check.",
  );

  await page.goto("/");
  await page.getByRole("button", { name: /Try complete demo/i }).click();
  await page.getByRole("radio", { name: "Design the Habitat" }).click();
  await page.getByRole("button", { name: /Build my quest/i }).click();
  await expect(
    page.getByRole("heading", { name: "Commit to a first model." }),
  ).toBeVisible();
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const target = window as typeof window & {
      __wonderlabStorageWrites?: string[];
    };
    const originalSetItem = Storage.prototype.setItem;
    target.__wonderlabStorageWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (key === "wonderlab.session.v4" || key === "wonderlab.drafts.v4") {
        target.__wonderlabStorageWrites?.push(key);
      }
      return originalSetItem.call(this, key, value);
    };
  });
  const debounceClockStart = await page.evaluate(() => Date.now());
  await page.clock.install({ time: debounceClockStart });
  await page.clock.pauseAt(debounceClockStart);

  const predictionField = page.locator("#prediction-response");
  await predictionField.fill(`${PREDICTION} Temporary ending.`);
  await page.clock.runFor(150);
  await predictionField.fill(PREDICTION);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __wonderlabStorageWrites?: string[] })
          .__wonderlabStorageWrites,
    ),
  ).toEqual([]);

  await page.clock.runFor(200);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __wonderlabStorageWrites?: string[] })
          .__wonderlabStorageWrites,
    ),
  ).toEqual([]);

  await page.clock.runFor(160);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __wonderlabStorageWrites?: string[] })
          .__wonderlabStorageWrites,
    ),
  ).toEqual(["wonderlab.drafts.v4"]);

  await page.evaluate(() => {
    (
      window as typeof window & { __wonderlabStorageWrites?: string[] }
    ).__wonderlabStorageWrites = [];
  });
  await predictionField.fill(`${PREDICTION} One more linked risk.`);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __wonderlabStorageWrites?: string[] })
          .__wonderlabStorageWrites,
    ),
  ).toEqual(["wonderlab.drafts.v4"]);
  const storedDraft = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.drafts.v4") ?? "null",
    ) as { data?: { prediction?: string } } | null;
    return stored?.data?.prediction;
  });
  expect(storedDraft).toContain("One more linked risk.");
});

test("incompatible legacy learner storage is removed without clearing the anonymous safety ID", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused storage migration check.",
  );

  await page.addInitScript(() => {
    for (const key of [
      "wonderlab.session.v1",
      "wonderlab.drafts.v1",
      "wonderlab.session.v2",
      "wonderlab.drafts.v2",
      "wonderlab.session.v3",
      "wonderlab.drafts.v3",
    ]) {
      window.localStorage.setItem(key, '{"legacy":true}');
    }
    window.localStorage.setItem("wonderlab.safety-id.v1", "safety_legacy_123");
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        legacyKeys: Object.keys(window.localStorage).filter((key) =>
          /^wonderlab\.(?:session|drafts)\.v[123]$/.test(key),
        ),
        safetyId: window.localStorage.getItem("wonderlab.safety-id.v1"),
      })),
    )
    .toEqual({
      legacyKeys: [],
      safetyId: "safety_legacy_123",
    });
});

test("the 24-hour timer clears rendered learner work while preserving the anonymous safety ID", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused near-expiry timer check.",
  );

  const safetyIdentifier = "wl_expiry_test_123";
  await page.clock.install({ time: new Date("2026-07-17T12:00:00Z") });
  await page.addInitScript(
    ({ session, safetyId }) => {
      window.localStorage.setItem(
        "wonderlab.session.v4",
        JSON.stringify({
          version: 1,
          savedAt: Date.now() - 24 * 60 * 60 * 1_000 + 60_000,
          data: session,
        }),
      );
      window.localStorage.setItem("wonderlab.safety-id.v1", safetyId);
    },
    { session: seededDemoJson, safetyId: safetyIdentifier },
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Discovery Card" }),
  ).toBeVisible();

  await page.clock.fastForward(60_001);
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Discovery Card" }),
  ).toHaveCount(0);
  const retained = await page.evaluate(() => ({
    session: window.localStorage.getItem("wonderlab.session.v4"),
    draft: window.localStorage.getItem("wonderlab.drafts.v4"),
    safety: window.localStorage.getItem("wonderlab.safety-id.v1"),
  }));
  expect(retained).toEqual({
    session: null,
    draft: null,
    safety: safetyIdentifier,
  });
});

test("Clear synchronizes across tabs without resurrecting stale learner work", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused cross-tab storage event check.",
  );

  await page.goto("/");
  await page.evaluate((session) => {
    window.localStorage.setItem(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
    );
  }, seededDemoJson);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto(APP_ORIGIN);
  await expect(
    secondPage.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  const secondSafetyIdentifier = await secondPage.evaluate(() =>
    window.localStorage.getItem("wonderlab.safety-id.v1"),
  );

  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await page.getByRole("button", { name: "New question" }).click();
  await expect(
    secondPage.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeVisible();
  await secondPage.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await secondPage.waitForTimeout(400);

  const synchronized = await secondPage.evaluate(() => ({
    session: window.localStorage.getItem("wonderlab.session.v4"),
    draft: window.localStorage.getItem("wonderlab.drafts.v4"),
    safety: window.localStorage.getItem("wonderlab.safety-id.v1"),
  }));
  expect(synchronized).toEqual({
    session: null,
    draft: null,
    safety: secondSafetyIdentifier,
  });
  await secondPage.close();
});

test("a non-underwater live question uses topic-neutral route visuals", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "One desktop render proves the question-aware art boundary.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/routes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        routes: [
          {
            id: "trace-earworm",
            title: "Trace the Earworm",
            hook: "Map how repetition, attention, and memory cues can turn a short musical phrase into a recurring mental loop.",
            lens: "understand",
            activityType: "causal loop map",
            estimatedMinutes: 8,
            iconKey: "memory",
          },
          {
            id: "compare-triggers",
            title: "Compare the Triggers",
            hook: "Contrast when the same song sticks or fades by changing context, familiarity, and recent exposure.",
            lens: "compare",
            activityType: "controlled comparison",
            estimatedMinutes: 9,
            iconKey: "compare",
          },
          {
            id: "design-thought-test",
            title: "Design an Unsticking Test",
            hook: "Create a browser-based thought experiment that challenges one explanation without claiming a clinical treatment.",
            lens: "create",
            activityType: "thought experiment",
            estimatedMinutes: 10,
            iconKey: "experiment",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("What are you curious about?")
    .fill("Why do songs get stuck in our heads?");
  await page.getByRole("button", { name: /Generate 3 routes/i }).click();

  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeVisible();
  await expect(page.locator('[data-topic-visual="neutral-route"]')).toHaveCount(
    3,
  );
  await expect(page.locator(".route-neutral-icon svg")).toHaveCount(3);
  await expect(
    page.locator('.route-visual img[src*="/images/routes/"]'),
  ).toHaveCount(0);
  if (process.env.WONDERLAB_CAPTURE_TOPIC_VISUALS === "true") {
    await page.screenshot({
      path: "/tmp/wonderlab-neutral-routes.png",
      animations: "disabled",
    });
  }
  await expectNoAutomatedAccessibilityViolations(
    page,
    "Non-underwater route chooser",
  );
  await expectNoHorizontalOverflow(page);
  expect(runtimeProblems).toEqual([]);
});

test("clear and timeout recovery preserve the learner's current live work", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "One deterministic browser proves cancellation, timeout, and retry state.",
  );

  const runtimeProblems = watchRuntime(page);
  const recoveryRoutes = [
    {
      id: "map-movement",
      title: "Map the Movement",
      hook: "Build a causal map of how people, goods, and services move through a city.",
      lens: "understand",
      activityType: "causal map",
      estimatedMinutes: 15,
      iconKey: "map",
    },
    {
      id: "redesign-street",
      title: "Redesign the Street",
      hook: "Create a street plan that balances access, safety, commerce, and public space.",
      lens: "create",
      activityType: "systems design",
      estimatedMinutes: 15,
      iconKey: "blueprint",
    },
    {
      id: "test-tradeoffs",
      title: "Test the Tradeoffs",
      hook: "Compare who benefits and what becomes harder under three transport choices.",
      lens: "compare",
      activityType: "comparison matrix",
      estimatedMinutes: 15,
      iconKey: "scales",
    },
  ];
  const recoveryQuest = {
    routeId: "map-movement",
    timeBudget: {
      totalMinutes: 15,
      steps: {
        choose: 2,
        predict: 2,
        investigate: 3,
        create: 5,
        reflect: 2,
        branch: 1,
      },
    },
    drivingQuestion:
      "How could a city move people and goods well without depending on private cars?",
    predictionPrompt:
      "Predict which transport change would have the largest effect and explain the causal chain behind your choice.",
    investigationPrompt:
      "Compare your prediction with evidence about access, safety, and how streets are used.",
    creationChallenge:
      "Create a concise street redesign that balances access, safety, commerce, and public space, then defend its main tradeoff.",
    constraints: [
      "Name one change to street space.",
      "Connect the change to a specific access or safety effect.",
    ],
    completionCriteria: [
      "The proposal names a concrete intervention.",
      "The tradeoff uses evidence and remains explicit.",
    ],
    safetyNote:
      "Keep this as a browser-based planning exercise; do not enter traffic or test a street intervention yourself.",
    hint: "Trace who can reach which destinations before and after the proposed change.",
  };
  const recoveryEvidence = {
    items: [
      {
        id: "access-pattern",
        kind: "evidence",
        statement:
          "Street design changes can alter how safely people reach daily destinations.",
        sourceIds: ["transport-source"],
      },
      {
        id: "local-tradeoff",
        kind: "open_question",
        statement:
          "Which groups would gain or lose convenient access under the proposed redesign?",
        sourceIds: [],
      },
    ],
    sources: [
      {
        id: "transport-source",
        title: "Transportation and access planning overview",
        url: "https://www.transportation.gov/mission/health/complete-streets",
        domain: "transportation.gov",
      },
    ],
    conciseExplanation:
      "The evidence makes access and safety measurable, while the local distribution of benefits remains a question to test.",
    uncertaintyNote:
      "A general source cannot determine the effects of one specific street without local data.",
  };
  const recoveryReflection = {
    specificFeedback:
      "Your street redesign connects safer access with an explicit tradeoff instead of treating car removal as an automatic benefit.",
    discoverySummary:
      "The proposal became a testable access model rather than a simple argument for or against cars.",
    changedThinking:
      "Your model shifted from one transport change toward comparing access, safety, and distribution together.",
    keyTradeoff:
      "Reallocating street space can improve some trips while making other deliveries or journeys harder.",
    newQuestions: [
      "Which destinations should remain reachable within fifteen minutes?",
      "How would the redesign affect people with limited mobility?",
      "What local evidence would reveal an unfair access tradeoff?",
    ],
    mapDeltas: [
      {
        nodeId: "reflection",
        kind: "reflection",
        label: "Access, safety, and distribution now form one model",
        detail:
          "The redesign became a testable comparison of who gains and who loses access.",
        parentNodeId: "creation",
      },
      {
        nodeId: "next-1",
        kind: "next_question",
        label: "Which destinations should remain nearby?",
        parentNodeId: "reflection",
      },
    ],
  };

  await page.addInitScript(
    ({ evidence, quest, reflectionResult, routes }) => {
      const originalFetch = window.fetch.bind(window);
      const pendingResponses = new Map<string, () => void>();
      let routeCalls = 0;
      let firstRouteAborted = false;

      Object.defineProperty(window, "__wonderlabRouteCalls", {
        configurable: true,
        get: () => routeCalls,
      });
      Object.defineProperty(window, "__wonderlabFirstRouteAborted", {
        configurable: true,
        get: () => firstRouteAborted,
      });
      Object.defineProperty(window, "__wonderlabReleaseResponse", {
        configurable: true,
        value: (path: string) => {
          const release = pendingResponses.get(path);
          if (!release) return false;
          pendingResponses.delete(path);
          release();
          return true;
        },
      });

      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? new URL(input, window.location.href)
            : new URL(input instanceof Request ? input.url : input.toString());
        const jsonResponse = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        const holdResponse = (path: string, body: unknown) =>
          new Promise<Response>((resolve) => {
            pendingResponses.set(path, () => resolve(jsonResponse(body)));
          });

        if (url.pathname === "/api/quest") {
          const requestBody = JSON.parse(String(init?.body ?? "{}")) as {
            selectedRoute?: { id?: string };
          };
          return holdResponse(url.pathname, {
            ...quest,
            routeId: requestBody.selectedRoute?.id ?? quest.routeId,
          });
        }

        if (url.pathname === "/api/evidence") {
          return holdResponse(url.pathname, evidence);
        }

        if (url.pathname === "/api/reflect") {
          return holdResponse(url.pathname, reflectionResult);
        }

        if (url.pathname !== "/api/routes") return originalFetch(input, init);

        routeCalls += 1;
        const response = () => jsonResponse({ routes });

        if (routeCalls === 1) {
          return new Promise<Response>((_resolve, reject) => {
            const abort = () => {
              firstRouteAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            };
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener("abort", abort, { once: true });
          });
        }

        if (routeCalls === 2) {
          return new Promise<Response>((_resolve, reject) => {
            const abort = () =>
              reject(new DOMException("Aborted", "AbortError"));
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener("abort", abort, { once: true });
          });
        }

        return Promise.resolve(response());
      }) as typeof window.fetch;
    },
    {
      evidence: recoveryEvidence,
      quest: recoveryQuest,
      reflectionResult: recoveryReflection,
      routes: recoveryRoutes,
    },
  );

  await page.goto("/");
  const question = page.getByLabel("What are you curious about?");
  const clearSession = page.getByRole("button", { name: "Clear session" });

  await question.fill("Why do cities need parks?");
  await page.getByRole("button", { name: /Generate 3 routes/i }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(question).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "High school" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "10 min" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Try complete demo" }),
  ).toBeDisabled();
  const resetConfirmation = await clearSession.evaluate((button) => {
    const originalConfirm = window.confirm;
    let message = "";
    window.confirm = (nextMessage) => {
      message = nextMessage ?? "";
      return true;
    };

    try {
      (button as HTMLElement).click();
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    } finally {
      window.confirm = originalConfirm;
    }

    return message;
  });
  expect(resetConfirmation).toBe(
    "Start a new quest? Your current quest will be removed from this browser.",
  );
  await expect(question).toHaveValue("");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __wonderlabFirstRouteAborted: boolean })
          .__wonderlabFirstRouteAborted,
    ),
  ).toBe(true);
  await page.waitForTimeout(420);
  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("wonderlab.session.v4"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("wonderlab.drafts.v4"),
    ),
  ).toBeNull();

  const timeoutClockStart = await page.evaluate(() => Date.now());
  await page.clock.install({ time: timeoutClockStart });
  await page.clock.pauseAt(timeoutClockStart);
  await question.fill("Could a city run without cars?");
  const college = page.getByRole("button", { name: "College" });
  const fifteenMinutes = page.getByRole("button", { name: "15 min" });
  await college.click();
  await fifteenMinutes.click();
  await page.getByRole("button", { name: /Generate 3 routes/i }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __wonderlabRouteCalls: number })
            .__wonderlabRouteCalls,
      ),
    )
    .toBe(2);
  await page.clock.fastForward(32_001);
  await page.clock.resume();

  const timeoutErrorPanel = page.locator(".error-panel");
  await expect(timeoutErrorPanel).toContainText(
    "That request took too long. Your work is saved—try again or use the demo quest.",
  );
  await expect(timeoutErrorPanel).toBeFocused();
  await expect(question).toHaveValue("Could a city run without cars?");
  await expect(college).toHaveAttribute("aria-pressed", "true");
  await expect(fifteenMinutes).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open complete demo" }),
  ).toBeVisible();

  const savedDraft = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.drafts.v4") ?? "null",
    ) as { data?: unknown } | null;
    return stored?.data ?? null;
  });
  expect(savedDraft).toMatchObject({
    question: "Could a city run without cars?",
    level: "college",
    durationMinutes: 15,
  });

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(
    page.getByText("Could a city run without cars?", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __wonderlabRouteCalls: number })
          .__wonderlabRouteCalls,
    ),
  ).toBe(3);

  const firstRoute = page.getByRole("radio").first();
  await firstRoute.click();
  const buildQuest = page.getByRole("button", { name: /Build my quest/i });
  await buildQuest.click();
  await expect(firstRoute).toBeDisabled();
  await expect(buildQuest).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        (path) =>
          (
            window as unknown as {
              __wonderlabReleaseResponse: (nextPath: string) => boolean;
            }
          ).__wonderlabReleaseResponse(path),
        "/api/quest",
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", { name: "Commit to a first model." }),
  ).toBeVisible();

  await page
    .locator("#prediction-response")
    .fill(
      "I predict reallocating one car lane will improve local access if deliveries and mobility needs stay explicit.",
    );
  await page.getByRole("button", { name: /Lock prediction/i }).click();
  const explainWithSources = page.getByRole("button", {
    name: /Explain now with sources/i,
  });
  await expect(explainWithSources).toHaveCount(1);
  await explainWithSources.click();
  await expect(explainWithSources).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        (path) =>
          (
            window as unknown as {
              __wonderlabReleaseResponse: (nextPath: string) => boolean;
            }
          ).__wonderlabReleaseResponse(path),
        "/api/evidence",
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", { name: "See what holds. Build what follows." }),
  ).toBeVisible();
  await fillEvidenceDecision(page, {
    decisionLayout: "expanded",
    relationship: "supports",
    impact:
      "This sourced finding supports my prediction because it makes the access and safety tradeoff measurable instead of assuming every traveler benefits equally.",
    designChoice:
      "Because the finding makes access and safety measurable, my design preserves delivery access and tests disabled riders' reach.",
    artifactAnchor: "delivery access",
  });
  await page
    .locator("#creation-response")
    .fill(
      "Convert one lane into a protected transit and cycling corridor, preserve timed delivery access, and measure whether disabled riders can reach key destinations more reliably.",
    );
  await page
    .getByLabel(/I reviewed my response against every completion criterion/i)
    .check();
  await page.getByRole("button", { name: /Finish creation/i }).click();
  await page
    .locator("#reflection-usedToThink")
    .fill("I used to think removing cars automatically improved every trip.");
  await page
    .locator("#reflection-nowThink")
    .fill(
      "Now I think access and safety must be compared for different people.",
    );
  await page
    .locator("#reflection-stillWonder")
    .fill("I still wonder which local evidence would reveal unfair tradeoffs.");
  const revealMap = page.getByRole("button", {
    name: /Reveal my Curiosity Map/i,
  });
  await revealMap.click();
  await expect(page.locator("#reflection-usedToThink")).toBeDisabled();
  await expect(page.locator("#reflection-nowThink")).toBeDisabled();
  await expect(page.locator("#reflection-stillWonder")).toBeDisabled();
  await expect(revealMap).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        (path) =>
          (
            window as unknown as {
              __wonderlabReleaseResponse: (nextPath: string) => boolean;
            }
          ).__wonderlabReleaseResponse(path),
        "/api/reflect",
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  expect(runtimeProblems).toEqual([]);
});

test("a successful empty route response preserves work and recovers through the seeded demo", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the focused empty-response recovery check.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/routes", async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.goto("/");

  const question = page.getByLabel("What are you curious about?");
  const college = page.getByRole("button", { name: "College" });
  const fifteenMinutes = page.getByRole("button", { name: "15 min" });

  await question.fill("How could cities stay cool without wasting water?");
  await college.click();
  await fifteenMinutes.click();
  await page.getByRole("button", { name: /Generate 3 routes/i }).click();

  const errorPanel = page.locator(".error-panel");
  await expect(errorPanel).toContainText("That step did not finish");
  await expect(errorPanel).toContainText(
    `${PUBLIC_NAME} received an empty response. Please try again.`,
  );
  await expect(errorPanel).toBeFocused();
  await expect(question).toHaveValue(
    "How could cities stay cool without wasting water?",
  );
  await expect(college).toHaveAttribute("aria-pressed", "true");
  await expect(fifteenMinutes).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  const openDemo = page.getByRole("button", {
    name: "Open complete demo",
  });
  await expect(openDemo).toBeVisible();

  const savedDraft = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem("wonderlab.drafts.v4") ?? "null",
    ) as { data?: unknown } | null;
    return stored?.data ?? null;
  });
  expect(savedDraft).toMatchObject({
    question: "How could cities stay cool without wasting water?",
    level: "college",
    durationMinutes: 15,
  });

  await openDemo.click();
  await expect(
    page.getByRole("heading", { name: "Three ways into your question." }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(
    page.getByText("Pre-generated demo", { exact: true }).first(),
  ).toBeVisible();
  expect(runtimeProblems).toEqual([]);
});

test("the seeded journey stays operable in forced colors at a 320px reflow width", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium provides the forced-colors emulation used by this focused check.",
  );

  const runtimeProblems = watchRuntime(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await page.goto("/");

  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
  await expectVisibleControlsWithinViewport(page);

  const question = page.getByLabel("What are you curious about?");
  await expect(
    page.getByRole("heading", { name: "Make your reasoning visible." }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(question).toBeFocused();
  const questionFocusStyle = await question.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(questionFocusStyle.outlineStyle).not.toBe("none");
  expect(questionFocusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

  const collegeLevel = page.getByRole("button", { name: "College" });
  await collegeLevel.click();
  await expect(collegeLevel).toHaveAttribute("aria-pressed", "true");
  const pressedSegmentStyle = await collegeLevel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(pressedSegmentStyle.outlineStyle).not.toBe("none");
  expect(pressedSegmentStyle.outlineWidth).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: /Try complete demo/i }).click();
  await expectNoHorizontalOverflow(page);
  await expectVisibleControlsWithinViewport(page);

  const habitatRoute = page.locator(".route-card").filter({
    has: page.getByRole("heading", { name: "Design the Habitat" }),
  });
  await habitatRoute.click();
  const selectedRouteStyle = await habitatRoute.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderTopWidth: Number.parseFloat(style.borderTopWidth),
      borderTopStyle: style.borderTopStyle,
    };
  });
  expect(selectedRouteStyle.borderTopStyle).not.toBe("none");
  expect(selectedRouteStyle.borderTopWidth).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: /Build my quest/i }).click();
  await page.locator("#prediction-response").fill(PREDICTION);
  await page.getByRole("button", { name: /Lock prediction/i }).click();
  await page.getByRole("button", { name: /Explain now with sources/i }).click();

  await expect(
    page.getByRole("heading", { name: "See what holds. Build what follows." }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleControlsWithinViewport(page);
  await expectNoAutomatedAccessibilityViolations(page, "Forced colors Create");

  await fillEvidenceDecision(page);
  await page.getByLabel("Build your response in the browser").fill(CREATION);
  await page
    .getByRole("checkbox", {
      name: /reviewed my response against every completion criterion/i,
    })
    .check();
  await page.getByRole("button", { name: /Finish creation/i }).click();

  await page.getByLabel("I used to think…").fill(REFLECTION.usedToThink);
  await page.getByLabel("Now I think…").fill(REFLECTION.nowThink);
  await page.getByLabel("I still wonder…").fill(REFLECTION.stillWonder);
  await page.getByRole("button", { name: /Reveal my Curiosity Map/i }).click();

  await expect(
    page.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    }),
  ).toBeVisible();
  const finalMap = page.locator(".map-panel-full");
  const mapOutline = finalMap.locator("#curiosity-map-outline");
  await expect(finalMap).toBeVisible();
  await expect(mapOutline).toBeVisible();
  await expect(finalMap.locator(".map-legend")).toBeHidden();
  const mapHeaderGeometry = await finalMap.evaluate((panel) => {
    const toolbar = panel.querySelector<HTMLElement>(".map-toolbar");
    const title = panel.querySelector<HTMLElement>(".map-title");
    const actions = panel.querySelector<HTMLElement>(".map-toolbar-actions");
    const outline = panel.querySelector<HTMLElement>(".map-outline");
    const firstItem = outline?.querySelector<HTMLElement>("li");
    if (!toolbar || !title || !actions || !outline || !firstItem) {
      throw new Error("Expected complete narrow Curiosity Map geometry.");
    }

    const toolbarBox = toolbar.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const outlineBox = outline.getBoundingClientRect();
    const firstItemBox = firstItem.getBoundingClientRect();
    const titleLineHeight = Number.parseFloat(
      getComputedStyle(title).lineHeight,
    );
    const titleActionsOverlap =
      Math.min(titleBox.right, actionsBox.right) >
        Math.max(titleBox.left, actionsBox.left) &&
      Math.min(titleBox.bottom, actionsBox.bottom) >
        Math.max(titleBox.top, actionsBox.top);

    return {
      actionsBottom: actionsBox.bottom,
      firstItemTop: firstItemBox.top,
      outlineTop: outlineBox.top,
      titleActionsOverlap,
      titleBottom: titleBox.bottom,
      titleHeight: titleBox.height,
      titleLineHeight,
      toolbarBottom: toolbarBox.bottom,
    };
  });
  expect(mapHeaderGeometry.titleHeight).toBeLessThanOrEqual(
    mapHeaderGeometry.titleLineHeight + 1,
  );
  expect(mapHeaderGeometry.titleActionsOverlap).toBe(false);
  expect(mapHeaderGeometry.outlineTop).toBeGreaterThanOrEqual(
    mapHeaderGeometry.toolbarBottom - 1,
  );
  expect(mapHeaderGeometry.firstItemTop).toBeGreaterThanOrEqual(
    mapHeaderGeometry.outlineTop,
  );
  expect(mapHeaderGeometry.titleBottom).toBeLessThanOrEqual(
    mapHeaderGeometry.outlineTop + 1,
  );
  expect(mapHeaderGeometry.actionsBottom).toBeLessThanOrEqual(
    mapHeaderGeometry.outlineTop + 1,
  );
  await finalMap.getByRole("button", { name: "View map" }).click();
  await expect(
    finalMap.getByRole("button", { name: "View text outline" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleControlsWithinViewport(page);
  await expectNoAutomatedAccessibilityViolations(
    page,
    "Forced colors Discovery",
  );

  if (process.env.WONDERLAB_CAPTURE_FORCED_COLORS === "true") {
    await page.screenshot({
      path: "/tmp/wonderlab-forced-colors-320.png",
      fullPage: true,
      animations: "disabled",
    });
  }

  expect(runtimeProblems).toEqual([]);
});
