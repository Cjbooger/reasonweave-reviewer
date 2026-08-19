import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  discoveryCardProofPath,
  validatedExternalBaseUrl,
} from "./capture-inputs.mjs";
import {
  loadReleaseIdentity,
  releaseIdentityRecord,
} from "./release-identity.mjs";
import {
  SEEDED_COMPACT_EVIDENCE_NOTE,
  SEEDED_EVIDENCE_APPLICATION_ANCHOR,
  SEEDED_EVIDENCE_APPLICATION_CHOICE,
} from "./seeded-demo-inputs.mjs";

const OWNER = "wonderlab-seeded-demo-v1";
const OWNER_FILE = ".wonderlab-demo-output.json";
const MANIFEST_FILE = "capture-manifest.json";
const PRODUCT_TAKE_FILE = "product-take.webm";
const DURATION_TARGET_SECONDS = 142;
const VIEWPORT = { width: 1280, height: 720 };
const SEEDED_BADGE_TEXT = "SEEDED DEMO · PRE-GENERATED · NO LIVE AI";
const captureScriptPath = fileURLToPath(import.meta.url);

const prediction =
  "Pressure will be hardest because the structure must resist the ocean pushing on it continuously, and any crack could threaten everyone inside.";
const creation =
  "At 20 meters, I would use a surface-linked support module with regular deliveries and a detachable service dock. Aquarius shows that a small habitat can depend on surface power, air, and data, so I would not claim independence. The tradeoff is more reliable repairs and resupply, but dependence on surface infrastructure remains a risk.";
const evidenceDecisionNote = SEEDED_COMPACT_EVIDENCE_NOTE;
const evidenceApplicationChoice = SEEDED_EVIDENCE_APPLICATION_CHOICE;
const evidenceApplicationAnchor = SEEDED_EVIDENCE_APPLICATION_ANCHOR;
const reflections = {
  usedToThink:
    "I used to think pressure was the only serious obstacle because the ocean could crush the habitat.",
  nowThink:
    "Now I think maintenance, food, and redundant life support may be harder over time because every system depends on the others.",
  stillWonder:
    "I still wonder whether an underwater habitat could ever become mostly self-sufficient without harming the surrounding ecosystem.",
};
const selectedNextQuestion =
  "Which ecosystem signals should force the habitat to reduce or stop operations?";
const facilitatorRevisionPrompt =
  "What would make you revise that evidence decision or design choice?";
const facilitatorNonEvaluativeNote =
  "Optional discussion prompt—not a score or diagnosis.";

const milestonePlan = {
  spark: { targetSeconds: 0, deadlineSeconds: 6 },
  routes: { targetSeconds: 8, deadlineSeconds: 16 },
  prediction: { targetSeconds: 44, deadlineSeconds: 53 },
  evidence: { targetSeconds: 59, deadlineSeconds: 69 },
  creation: { targetSeconds: 80, deadlineSeconds: 92 },
  reflection: { targetSeconds: 100, deadlineSeconds: 110 },
  discovery: { targetSeconds: 114, deadlineSeconds: 120 },
  map: { targetSeconds: 127, deadlineSeconds: 132 },
  export: { targetSeconds: 135, deadlineSeconds: 141.5 },
  end: { targetSeconds: 142, deadlineSeconds: 145 },
};

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || "unknown";
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }

  return result.stdout;
}

function capturePort() {
  const raw = process.env.WONDERLAB_CAPTURE_PORT ?? "3107";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65_535) {
    throw new Error(
      "WONDERLAB_CAPTURE_PORT must be an integer between 1024 and 65535.",
    );
  }
  return value;
}

async function startOwnedCaptureServer({ root, port }) {
  const nextCli = path.join(
    root,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  await fs.access(nextCli);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logTail = "";
  let startError;
  let readyObserved = false;
  const child = spawn(
    process.execPath,
    [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        NEXT_PUBLIC_APP_URL: baseUrl,
        NEXT_TELEMETRY_DISABLED: "1",
        WONDERLAB_ALLOW_SEEDED_FALLBACK: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const remember = (chunk) => {
    logTail = `${logTail}${chunk.toString()}`.slice(-16_000);
    if (/\bReady in\b/i.test(logTail)) readyObserved = true;
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  child.once("error", (error) => {
    startError = error;
  });

  return {
    baseUrl,
    child,
    getLogTail: () => logTail.trim(),
    isReadyObserved: () => readyObserved,
    getStartError: () => startError,
  };
}

async function waitForCaptureApp(baseUrl, ownedServer) {
  const deadline = Date.now() + (ownedServer ? 60_000 : 15_000);
  let lastError;

  while (Date.now() < deadline) {
    const startError = ownedServer?.getStartError();
    if (startError) {
      throw new Error(
        `Unable to start the capture server: ${startError.message}`,
      );
    }
    if (ownedServer && ownedServer.child.exitCode !== null) {
      throw new Error(
        `The capture-owned Next server exited with status ${ownedServer.child.exitCode}. ${ownedServer.getLogTail()}`.trim(),
      );
    }
    if (ownedServer && !ownedServer.isReadyObserved()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(2_500),
      });
      const body = await response.text();
      if (response.ok && body.includes(releaseIdentity.displayName)) {
        if (ownedServer) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (ownedServer.child.exitCode !== null) continue;
        }
        return;
      }
      lastError = new Error(
        `Capture server returned ${response.status} without the canonical release app marker.`,
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const serverLog = ownedServer?.getLogTail();
  throw new Error(
    `${releaseIdentity.displayName} capture server was not ready at ${baseUrl}: ${lastError?.message ?? "timeout"}${serverLog ? `\n${serverLog}` : ""}`,
  );
}

async function stopOwnedCaptureServer(server) {
  if (!server || server.child.exitCode !== null) return;

  await new Promise((resolve, reject) => {
    const forceTimer = setTimeout(() => {
      server.child.kill("SIGKILL");
    }, 5_000);
    const finalTimer = setTimeout(() => {
      reject(
        new Error(
          `Capture-owned Next server did not exit after SIGTERM and SIGKILL. ${server.getLogTail()}`.trim(),
        ),
      );
    }, 8_000);
    server.child.once("close", () => {
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      resolve();
    });
    if (!server.child.kill("SIGTERM") && server.child.exitCode === null) {
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      reject(new Error("Unable to signal the capture-owned Next server."));
    }
  });
}

function normalizedRepoPath(value) {
  return value.split(path.sep).join("/");
}

function isStrictlyInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function pathExists(value) {
  try {
    await fs.lstat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644,
  });

  try {
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function readDirtyOverride() {
  const generic = process.env.ALLOW_DIRTY;
  const namespaced = process.env.WONDERLAB_CAPTURE_ALLOW_DIRTY;

  if (
    generic !== undefined &&
    namespaced !== undefined &&
    generic !== namespaced
  ) {
    throw new Error(
      "ALLOW_DIRTY and WONDERLAB_CAPTURE_ALLOW_DIRTY disagree. Set only one explicit override.",
    );
  }

  const raw = generic ?? namespaced;
  if (raw === undefined) return false;
  if (["1", "true"].includes(raw.toLowerCase())) return true;
  if (["0", "false"].includes(raw.toLowerCase())) return false;

  throw new Error(
    "ALLOW_DIRTY must be one of: 1, true, 0, or false (case-insensitive).",
  );
}

async function prepareOwnedOutputDirectory(root, outputDir) {
  const allowedOutputRoot = path.join(root, "output", "playwright");
  const requestedRelative = path.relative(allowedOutputRoot, outputDir);
  if (
    requestedRelative === "" ||
    requestedRelative === ".." ||
    requestedRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(requestedRelative)
  ) {
    throw new Error(
      `WONDERLAB_CAPTURE_OUTPUT must resolve to a subdirectory of ${allowedOutputRoot}.`,
    );
  }

  await fs.mkdir(allowedOutputRoot, { recursive: true });
  const allowedStat = await fs.lstat(allowedOutputRoot);
  if (allowedStat.isSymbolicLink() || !allowedStat.isDirectory()) {
    throw new Error(
      `${allowedOutputRoot} must be a real directory, not a symlink.`,
    );
  }

  const allowedRealPath = await fs.realpath(allowedOutputRoot);
  if (!isStrictlyInside(root, allowedRealPath)) {
    throw new Error(`${allowedOutputRoot} resolves outside the repository.`);
  }

  const outputAlreadyExists = await pathExists(outputDir);
  if (!outputAlreadyExists) await fs.mkdir(outputDir, { recursive: true });

  const outputStat = await fs.lstat(outputDir);
  if (outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
    throw new Error(`${outputDir} must be a real directory, not a symlink.`);
  }

  const outputRealPath = await fs.realpath(outputDir);
  if (!isStrictlyInside(allowedRealPath, outputRealPath)) {
    throw new Error(`${outputDir} resolves outside ${allowedOutputRoot}.`);
  }

  const ownerPath = path.join(outputDir, OWNER_FILE);
  if (await pathExists(ownerPath)) {
    let owner;
    try {
      owner = JSON.parse(await fs.readFile(ownerPath, "utf8"));
    } catch (error) {
      throw new Error(`${ownerPath} is not valid JSON: ${error.message}`);
    }

    if (owner.owner !== OWNER || owner.schemaVersion !== 1) {
      throw new Error(
        `${ownerPath} is not a valid ${OWNER} ownership marker. Refusing to write here.`,
      );
    }
    if (path.resolve(root, owner.outputDir ?? "") !== outputDir) {
      throw new Error(
        `${ownerPath} does not identify the configured capture directory.`,
      );
    }
  } else {
    const entries = await fs.readdir(outputDir);
    if (entries.length > 0) {
      throw new Error(
        `${outputDir} is non-empty but has no ${OWNER_FILE} ownership marker. Move it aside or choose a fresh capture directory.`,
      );
    }

    await writeJsonAtomic(ownerPath, {
      schemaVersion: 1,
      owner: OWNER,
      createdAt: new Date().toISOString(),
      outputDir: normalizedRepoPath(path.relative(root, outputDir)),
      relativeOutputPath: normalizedRepoPath(path.relative(root, outputDir)),
    });
  }

  return { allowedOutputRoot, ownerPath };
}

async function assertCanonicalTargetsAbsent(targets) {
  for (const target of targets) {
    if (await pathExists(target)) {
      throw new Error(
        `${target} already exists. Move the prior canonical capture aside before recording another take.`,
      );
    }
  }
}

async function settleClosures(items) {
  const results = await Promise.allSettled(items.map((item) => item.close()));
  return results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ label: items[index].label, reason: result.reason }]
      : [],
  );
}

async function bestEffortBrowserCleanup({ browser, context, page, warmPage }) {
  const failures = [];
  const pages = [
    warmPage && !warmPage.isClosed()
      ? { label: "warm-up page", close: () => warmPage.close() }
      : null,
    page && !page.isClosed()
      ? { label: "recording page", close: () => page.close() }
      : null,
  ].filter(Boolean);
  failures.push(...(await settleClosures(pages)));

  if (context) {
    failures.push(
      ...(await settleClosures([
        { label: "browser context", close: () => context.close() },
      ])),
    );
  }

  if (browser) {
    failures.push(
      ...(await settleClosures([
        { label: "browser", close: () => browser.close() },
      ])),
    );
  }

  return failures;
}

async function commitCaptureArtifacts({
  stagedFramesDir,
  stagedManifestPath,
  stagedProductPath,
  framesDir,
  manifestPath,
  productPath,
}) {
  let framesMoved = false;
  let productMoved = false;

  try {
    await fs.rename(stagedFramesDir, framesDir);
    framesMoved = true;
    await fs.rename(stagedProductPath, productPath);
    productMoved = true;
    await fs.rename(stagedManifestPath, manifestPath);
  } catch (error) {
    const rollback = [];
    if (productMoved) rollback.push(fs.rename(productPath, stagedProductPath));
    if (framesMoved) rollback.push(fs.rename(framesDir, stagedFramesDir));
    const rollbackResults = await Promise.allSettled(rollback);
    const rollbackFailures = rollbackResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (rollbackFailures.length > 0) {
      throw new AggregateError(
        [error, ...rollbackFailures],
        "Capture publication failed and could not be rolled back cleanly.",
      );
    }

    throw error;
  }
}

const initialCwd = process.cwd();
const externalBaseUrl = validatedExternalBaseUrl(
  process.env.WONDERLAB_CAPTURE_BASE_URL,
);
const root = await fs.realpath(
  runGit(initialCwd, ["rev-parse", "--show-toplevel"]).trim(),
);
const releaseIdentity = await loadReleaseIdentity({ root });
const ownsCaptureServer = !externalBaseUrl;
const ownedServerPort = ownsCaptureServer ? capturePort() : undefined;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${ownedServerPort}`;
const captureServerMode = ownsCaptureServer
  ? "capture_owned_next_dev"
  : "external_override";
const outputDir = path.resolve(
  root,
  process.env.WONDERLAB_CAPTURE_OUTPUT ?? "output/playwright/wonderlab-demo",
);
const framesDir = path.join(outputDir, "frames");
const manifestPath = path.join(outputDir, MANIFEST_FILE);
const finalVideoPath = path.join(outputDir, PRODUCT_TAKE_FILE);

await prepareOwnedOutputDirectory(root, outputDir);
await assertCanonicalTargetsAbsent([framesDir, manifestPath, finalVideoPath]);

const allowDirtyOverride = readDirtyOverride();
const fullSha = runGit(root, ["rev-parse", "HEAD"]).trim();
const shortSha = runGit(root, ["rev-parse", "--short", "HEAD"]).trim();
const dirtyStatus = runGit(root, [
  "status",
  "--porcelain=v1",
  "--untracked-files=all",
]);
const dirty = dirtyStatus.length > 0;
if (dirty && !allowDirtyOverride) {
  throw new Error(
    "Git worktree is dirty. Commit or stash the exact changes, or explicitly set ALLOW_DIRTY=true; the override and status will be recorded in the capture manifest.",
  );
}

const captureScriptHash = await hashFile(captureScriptPath);
const stagingDir = path.join(
  outputDir,
  `.capture-staging-${process.pid}-${randomUUID()}`,
);
const stagedFramesDir = path.join(stagingDir, "frames");
const stagedVideosDir = path.join(stagingDir, "videos");
const stagedProductPath = path.join(stagingDir, PRODUCT_TAKE_FILE);
const stagedManifestPath = path.join(stagingDir, MANIFEST_FILE);

let browser;
let context;
let warmPage;
let page;
let video;
let startedAt;
let videoLeadInSeconds;
let captureCommitted = false;
const capturedFrames = [];
const milestones = [];
const assertions = {
  openingDisclosuresVisible: false,
  seededLaunchVerified: false,
  evidenceDecisionRecorded: false,
  evidenceApplicationRecorded: false,
  artifactAnchorRecorded: false,
  creationReviewChecked: false,
  allReflectionFieldsShown: false,
  nextQuestionChoice: {
    selectedQuestion: selectedNextQuestion,
    checked: false,
    mapSelectedCount: 0,
    mapUnselectedCount: 0,
    discoveryCardIncludesSelected: false,
    markdownIncludesSelected: false,
  },
  mapNodeCount: 0,
  mapNodeMinimumOpacity: 0,
  mapNodesInViewport: false,
  finalChangeVisible: false,
  atAGlancePayoffVisible: false,
  selectedQuestionCloseupVisible: false,
  facilitatorPromptVisible: false,
  exportActionVisible: false,
  exportVerified: false,
  seededBadgeVisible: false,
};
let exportProof;
let ownedCaptureServer;
let captureServerStoppedBeforePublication = false;

function elapsedSeconds() {
  if (startedAt === undefined) {
    throw new Error("The product recording timer has not started.");
  }
  return (performance.now() - startedAt) / 1000;
}

async function waitUntil(seconds) {
  const remainingMilliseconds = (seconds - elapsedSeconds()) * 1000;
  if (remainingMilliseconds > 0) {
    await page.waitForTimeout(remainingMilliseconds);
  }
}

async function waitForInternalWindow(targetSeconds, deadlineSeconds, label) {
  await waitUntil(targetSeconds);
  const actualSeconds = elapsedSeconds();
  if (actualSeconds > deadlineSeconds) {
    throw new Error(
      `${label} missed its ${deadlineSeconds}s deadline at ${actualSeconds.toFixed(3)}s.`,
    );
  }
}

function completeMilestone(name) {
  const plan = milestonePlan[name];
  if (!plan) throw new Error(`Unknown capture milestone: ${name}`);
  if (milestones.some((milestone) => milestone.name === name)) {
    throw new Error(`Capture milestone ${name} was recorded more than once.`);
  }

  const actualSeconds = Number(elapsedSeconds().toFixed(3));
  const milestone = {
    name,
    targetSeconds: plan.targetSeconds,
    actualSeconds,
    deadlineSeconds: plan.deadlineSeconds,
  };
  milestones.push(milestone);

  if (actualSeconds > plan.deadlineSeconds) {
    throw new Error(
      `${name} missed its ${plan.deadlineSeconds}s deadline at ${actualSeconds.toFixed(3)}s.`,
    );
  }
}

async function frame(name, { settleMilliseconds = 550 } = {}) {
  const framePath = path.join(stagedFramesDir, `${name}.png`);
  if (settleMilliseconds > 0) {
    await page.waitForTimeout(settleMilliseconds);
  }
  await page.screenshot({
    path: framePath,
    animations: "allow",
  });
  capturedFrames.push({ name, stagedPath: framePath });
}

async function center(locator) {
  await locator.evaluate((element) =>
    element.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await page.waitForTimeout(700);
}

async function assertInViewport(locator, label) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (
    !box ||
    !viewport ||
    box.x < 0 ||
    box.y < 0 ||
    box.x + box.width > viewport.width ||
    box.y + box.height > viewport.height
  ) {
    throw new Error(`${label} is not fully visible in the recording viewport.`);
  }
}

function boxesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function assertSeededBadgePlacement() {
  const badge = page.locator('[data-wonderlab-seeded-provenance="true"]');
  const header = page.locator(".site-header");
  const badgeBox = await badge.boundingBox();
  const headerBox = await header.boundingBox();
  if (
    !badgeBox ||
    !headerBox ||
    badgeBox.y < 0 ||
    badgeBox.y + badgeBox.height > headerBox.y + 0.5
  ) {
    throw new Error(
      `The seeded provenance strip overlaps the ${releaseIdentity.displayName} application header.`,
    );
  }

  for (const [locator, label] of [
    [
      page.locator(".site-header .brand"),
      `${releaseIdentity.displayName} brand`,
    ],
    [page.locator(".site-header .progress-nav"), "quest progress navigation"],
    [page.locator(".site-header .header-actions"), "header actions"],
  ]) {
    const box = await locator.boundingBox();
    if (box && boxesOverlap(badgeBox, box)) {
      throw new Error(`The seeded provenance badge overlaps the ${label}.`);
    }
  }
}

async function installSeededBadge() {
  await page.evaluate((text) => {
    const style = document.createElement("style");
    style.dataset.wonderlabSeededProvenanceLayout = "true";
    style.textContent = `
      body { padding-top: 24px !important; }
      .site-header { top: 24px !important; }
    `;
    document.head.appendChild(style);

    const badge = document.createElement("div");
    badge.dataset.wonderlabSeededProvenance = "true";
    badge.setAttribute("role", "note");
    badge.setAttribute("aria-label", text);
    badge.textContent = text;
    Object.assign(badge.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "2147483647",
      width: "100%",
      height: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ffffff",
      background: "rgba(23, 50, 58, 0.94)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.28)",
      boxShadow: "0 2px 10px rgba(11, 28, 34, 0.18)",
      font: "700 10px/1.2 ui-sans-serif, system-ui, sans-serif",
      letterSpacing: "0.055em",
      pointerEvents: "none",
    });
    document.body.appendChild(badge);
  }, SEEDED_BADGE_TEXT);
}

async function fitAndAssertOpeningDisclosures() {
  const footer = page.locator(".screen-footer");
  const zoomLevels = [0.86, 0.82, 0.78, 0.74];
  let fitted = false;

  for (const zoom of zoomLevels) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
      window.scrollTo({ top: 0, behavior: "instant" });
    }, zoom);
    await page.waitForTimeout(100);

    try {
      await assertInViewport(footer, "The 13+ and AI/source disclosure");
      fitted = true;
      break;
    } catch {
      // Try the next deliberate capture zoom before failing the opening shot.
    }
  }

  if (!fitted) {
    throw new Error(
      "The opening shot could not fit the 13+ and AI/source disclosure in the 1280x720 viewport.",
    );
  }

  const footerText = (await footer.innerText()).replace(/\s+/g, " ").trim();
  if (
    !footerText.includes(`${releaseIdentity.displayName} is for ages 13+`) ||
    !footerText.includes("uses AI and web sources")
  ) {
    throw new Error(
      "The opening footer does not contain the required 13+ and AI/source disclosure.",
    );
  }

  const badge = page.locator('[data-wonderlab-seeded-provenance="true"]');
  await assertInViewport(badge, "The seeded demo provenance badge");
  await assertSeededBadgePlacement();
  assertions.openingDisclosuresVisible = true;
  assertions.seededBadgeVisible = true;
}

async function assertReflectionField(locator, expected, label) {
  if ((await locator.inputValue()) !== expected) {
    throw new Error(`${label} does not contain the seeded learner reflection.`);
  }
  await assertInViewport(locator, label);
}

async function readMapState() {
  const nodes = page.locator(".map-node-stage");
  const count = await nodes.count();
  const styles = await nodes.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        opacity: Number(style.opacity),
        display: style.display,
        visibility: style.visibility,
      };
    }),
  );
  const minimumOpacity =
    styles.length > 0
      ? Math.min(...styles.map((style) => style.opacity))
      : Number.NaN;

  if (
    count !== 9 ||
    styles.some(
      (style) =>
        !Number.isFinite(style.opacity) ||
        style.opacity <= 0.95 ||
        style.display === "none" ||
        style.visibility === "hidden",
    )
  ) {
    throw new Error(
      `Curiosity Map visibility failed: count=${count}, minimumOpacity=${minimumOpacity}.`,
    );
  }

  return { count, minimumOpacity };
}

async function readMapViewportState() {
  const viewport = page.viewportSize();
  const scrollBox = await page
    .locator("#curiosity-map .map-scroll")
    .boundingBox();
  const nodeBoxes = await page.locator(".map-node-stage").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }),
  );

  if (!viewport || !scrollBox || nodeBoxes.length !== 9) {
    return { allInViewport: false, nodeBoxes, scrollBox };
  }

  const allInViewport = nodeBoxes.every((box) => {
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    return (
      box.width > 0 &&
      box.height > 0 &&
      box.x >= 0 &&
      box.y >= 0 &&
      right <= viewport.width &&
      bottom <= viewport.height &&
      box.x >= scrollBox.x - 0.5 &&
      box.y >= scrollBox.y - 0.5 &&
      right <= scrollBox.x + scrollBox.width + 0.5 &&
      bottom <= scrollBox.y + scrollBox.height + 0.5
    );
  });

  return { allInViewport, nodeBoxes, scrollBox };
}

async function prepareNativeMapForRecording(map) {
  const overview = map.locator(".map-svg-overview");
  if ((await overview.count()) !== 1) {
    throw new Error(
      "The completed Curiosity Map is missing its native overview.",
    );
  }

  await overview.evaluate((element) =>
    element.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await page.evaluate(() => {
    const container = document.querySelector("#curiosity-map .map-scroll");
    if (container) {
      container.scrollTop = 0;
      container.scrollLeft =
        (container.scrollWidth - container.clientWidth) / 2;
    }
  });
  await page.waitForTimeout(120);
  await assertSeededBadgePlacement();
  await assertMapNodesInViewport();
}

async function assertMapNodesInViewport() {
  const state = await readMapViewportState();
  if (!state.allInViewport) {
    throw new Error(
      "All nine Curiosity Map nodes were not simultaneously visible in the recording viewport.",
    );
  }
}

function assertExportMarkdown(markdown, source) {
  const requiredFragments = [
    `# ${releaseIdentity.displayName} Learning Trace`,
    "## Initial prediction",
    prediction,
    "## Evidence Lens",
    "## Learner evidence decision",
    "Complicates the initial prediction",
    "What the cited sources do not settle (source scope)",
    ...evidenceDecisionNote.split("\n"),
    "## Evidence → design",
    evidenceApplicationChoice,
    evidenceApplicationAnchor,
    "FIU's Aquarius lab supports up to six crew",
    "Aquarius Reef Base Facilities and Vessels",
    "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
    creation,
    reflections.usedToThink,
    reflections.nowThink,
    reflections.stillWonder,
    "## My next question",
    selectedNextQuestion,
    "## Three next questions",
    "## Discuss this trace",
    facilitatorRevisionPrompt,
    facilitatorNonEvaluativeNote,
  ];
  const missing = requiredFragments.filter(
    (fragment) => !markdown.includes(fragment),
  );
  if (missing.length > 0) {
    throw new Error(
      `The ${source} export is missing ${missing.length} required learner-trace fragment(s).`,
    );
  }
}

async function chooseAndProveNextQuestion() {
  const nextQuestionRadio = page.getByRole("radio", {
    name: selectedNextQuestion,
    exact: true,
  });
  await nextQuestionRadio.check();
  if (!(await nextQuestionRadio.isChecked())) {
    throw new Error(
      "The selected learner next-question radio was not checked.",
    );
  }

  const map = page.locator(".map-panel-full");
  await page.waitForFunction(() => {
    const mapPanel = document.querySelector(".map-panel-full");
    return (
      mapPanel?.querySelectorAll(
        'g[role="listitem"][aria-label^="My next question:"]',
      ).length === 1 &&
      mapPanel.querySelectorAll(
        'g[role="listitem"][aria-label^="Next question:"]',
      ).length === 2
    );
  });
  const selectedMapCount = await map
    .locator('g[role="listitem"][aria-label^="My next question:"]')
    .count();
  const unselectedMapCount = await map
    .locator('g[role="listitem"][aria-label^="Next question:"]')
    .count();
  if (selectedMapCount !== 1 || unselectedMapCount !== 2) {
    throw new Error(
      `Next-question map state failed: selected=${selectedMapCount}, unselected=${unselectedMapCount}.`,
    );
  }

  const atAGlance = page.locator(".trace-at-a-glance");
  await atAGlance.waitFor({ state: "visible", timeout: 10_000 });
  if ((await atAGlance.count()) !== 1) {
    throw new Error(
      "The Discovery Card must contain exactly one At a glance summary.",
    );
  }
  const selectedQuestionRow = atAGlance.locator(".trace-row").filter({
    hasText: "My next question",
  });
  await selectedQuestionRow
    .getByText("My next question", { exact: true })
    .waitFor({ state: "visible", timeout: 5_000 });
  if (
    (await selectedQuestionRow.count()) !== 1 ||
    !(await selectedQuestionRow.locator("dd").innerText()).includes(
      selectedNextQuestion,
    )
  ) {
    throw new Error(
      "The At a glance summary does not show the selected learner next question.",
    );
  }

  assertions.nextQuestionChoice.checked = true;
  assertions.nextQuestionChoice.mapSelectedCount = selectedMapCount;
  assertions.nextQuestionChoice.mapUnselectedCount = unselectedMapCount;
  assertions.nextQuestionChoice.discoveryCardIncludesSelected = true;
}

async function proveExport() {
  const discoveryCard = page.locator(".discovery-card");
  await discoveryCard.getByRole("button", { name: /Copy Markdown/i }).click();
  const copyStatus = discoveryCard.locator(".copy-status");
  let clipboardFailure;

  try {
    await copyStatus
      .getByText(/Copied — your trace is ready to share/i)
      .waitFor({
        state: "visible",
        timeout: 2_500,
      });
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    assertExportMarkdown(markdown, "clipboard");
    assertions.nextQuestionChoice.markdownIncludesSelected = true;
    return {
      method: "clipboard",
      statusText: (await copyStatus.innerText()).replace(/\s+/g, " ").trim(),
      bytes: Buffer.byteLength(markdown),
      sha256: createHash("sha256").update(markdown).digest("hex"),
    };
  } catch (error) {
    clipboardFailure = error;
  }

  try {
    const downloadPromise = page.waitForEvent("download", { timeout: 5_000 });
    await discoveryCard.getByRole("button", { name: /Download \.md/i }).click();
    const download = await downloadPromise;
    const suggestedFilename = download.suggestedFilename();
    const proofPath = discoveryCardProofPath(
      stagingDir,
      suggestedFilename,
      `${releaseIdentity.slug}-learning-trace.md`,
    );
    await download.saveAs(proofPath);
    const markdown = await fs.readFile(proofPath, "utf8");
    assertExportMarkdown(markdown, "downloaded Discovery Card");
    assertions.nextQuestionChoice.markdownIncludesSelected = true;

    return {
      method: "download",
      suggestedFilename,
      bytes: (await fs.stat(proofPath)).size,
      sha256: await hashFile(proofPath),
    };
  } catch (downloadFailure) {
    throw new AggregateError(
      [clipboardFailure, downloadFailure].filter(Boolean),
      "Neither clipboard nor download produced a verifiable Discovery Card export.",
    );
  }
}

try {
  await fs.mkdir(stagedFramesDir, { recursive: true });
  await fs.mkdir(stagedVideosDir, { recursive: true });

  if (ownsCaptureServer) {
    ownedCaptureServer = await startOwnedCaptureServer({
      root,
      port: ownedServerPort,
    });
  }
  await waitForCaptureApp(baseUrl, ownedCaptureServer);

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
    permissions: ["clipboard-read", "clipboard-write"],
    recordVideo: {
      dir: stagedVideosDir,
      size: VIEWPORT,
    },
  });

  warmPage = await context.newPage();
  await warmPage.goto(baseUrl, { waitUntil: "networkidle" });
  await warmPage.evaluate(() => document.fonts.ready);
  const warmCloseFailures = await settleClosures([
    { label: "warm-up page", close: () => warmPage.close() },
  ]);
  if (warmCloseFailures.length > 0) {
    throw new AggregateError(
      warmCloseFailures.map((failure) => failure.reason),
      "The warmed capture page did not close cleanly.",
    );
  }
  warmPage = undefined;

  const captureStartedAt = new Date().toISOString();
  const videoLeadInStartedAt = performance.now();
  page = await context.newPage();
  page.setDefaultTimeout(12_000);
  video = page.video();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await installSeededBadge();
  await fitAndAssertOpeningDisclosures();
  videoLeadInSeconds = Number(
    ((performance.now() - videoLeadInStartedAt) / 1000).toFixed(3),
  );
  if (videoLeadInSeconds < 0 || videoLeadInSeconds > 10) {
    throw new Error(
      `Recording lead-in ${videoLeadInSeconds}s is outside the 0–10s assembly window.`,
    );
  }
  startedAt = performance.now();
  await frame("01-spark");
  completeMilestone("spark");

  await waitUntil(3.5);
  const sparkQuestion = page.getByLabel("What are you curious about?");
  const canonicalSample = page.getByRole("button", {
    name: "Could humans live underwater?",
  });
  if (
    !(await sparkQuestion.isDisabled()) ||
    !(await canonicalSample.isDisabled()) ||
    (await sparkQuestion.inputValue()) !== ""
  ) {
    throw new Error(
      "The no-key Spark state must keep live-question controls disabled and empty.",
    );
  }
  await assertInViewport(
    page.locator(".screen-footer"),
    "The 13+ and AI/source disclosure in the no-key Spark state",
  );

  await waitUntil(milestonePlan.routes.targetSeconds);
  await page.getByRole("button", { name: "Try complete demo" }).click();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(100);
  await assertSeededBadgePlacement();
  await page
    .getByRole("heading", { name: "Three ways into your question." })
    .waitFor();
  if (
    (await page.locator(".question-context-box").innerText()).trim() !==
    "Could humans live underwater?"
  ) {
    throw new Error(
      "The complete seeded demo did not load the canonical underwater question.",
    );
  }
  assertions.seededLaunchVerified = true;
  await frame("02-routes");
  completeMilestone("routes");

  await waitForInternalWindow(28, 35, "route selection");
  const designRoute = page.getByRole("radio", {
    name: /Design the Habitat/i,
  });
  await designRoute.click();
  await page.waitForTimeout(1_800);
  await page.getByRole("button", { name: /Build my quest/i }).click();
  await page
    .getByRole("heading", { name: "Commit to a first model." })
    .waitFor();
  const predictionField = page.locator("#prediction-response");
  await predictionField.waitFor({ state: "visible" });

  await waitUntil(milestonePlan.prediction.targetSeconds);
  await predictionField.pressSequentially(prediction, { delay: 18 });
  if ((await predictionField.inputValue()) !== prediction) {
    throw new Error("The learner prediction was not recorded exactly.");
  }
  await frame("03-prediction");
  await page.getByRole("button", { name: /Lock prediction/i }).click();
  completeMilestone("prediction");

  await waitUntil(milestonePlan.evidence.targetSeconds);
  await page.getByRole("button", { name: /Explain now with sources/i }).click();
  await page
    .getByRole("heading", { name: "See what holds. Build what follows." })
    .waitFor();
  await page.locator("#evidence-decision-item").waitFor({ state: "visible" });
  await frame("04-evidence");
  await center(page.locator(".source-link").first());
  completeMilestone("evidence");

  await waitUntil(70);
  const evidenceDecisionSelect = page.locator("#evidence-decision-item");
  await evidenceDecisionSelect.selectOption("aquarius-dependence");
  const selectedSourceScope = page.getByRole("list", {
    name: "Sources linked to the selected finding",
  });
  const selectedSourceLink = selectedSourceScope.getByRole("link", {
    name: /Aquarius Reef Base Facilities and Vessels.*environment\.fiu\.edu.*opens in a new tab/i,
  });
  await selectedSourceLink.waitFor({ state: "visible" });
  if (
    (await selectedSourceLink.count()) !== 1 ||
    (await selectedSourceLink.getAttribute("href")) !==
      "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/"
  ) {
    throw new Error(
      "The selected finding did not expose its exact cited source scope.",
    );
  }
  const complicatesPrediction = page.getByRole("radio", {
    name: "Complicates my prediction",
  });
  await complicatesPrediction.check();
  const evidenceNoteField = page.getByRole("textbox", {
    name: "Source note",
    exact: true,
  });
  await evidenceNoteField.fill(evidenceDecisionNote);
  if (
    (await evidenceDecisionSelect.inputValue()) !== "aquarius-dependence" ||
    !(await complicatesPrediction.isChecked()) ||
    (await evidenceNoteField.inputValue()) !== evidenceDecisionNote
  ) {
    throw new Error("The learner evidence decision was not recorded.");
  }
  assertions.evidenceDecisionRecorded = true;
  await center(page.locator(".evidence-decision-panel"));
  await page.waitForTimeout(2_000);

  await waitUntil(milestonePlan.creation.targetSeconds);
  const creationField = page.locator("#creation-response");
  await center(creationField);
  await creationField.fill(creation);
  await page.waitForTimeout(1_200);
  const evidenceApplicationField = page.locator("#evidence-application-choice");
  await evidenceApplicationField.fill(evidenceApplicationChoice);
  const artifactAnchorField = page.locator("#artifact-anchor");
  await artifactAnchorField.fill(evidenceApplicationAnchor);
  if (
    (await evidenceApplicationField.inputValue()) !==
      evidenceApplicationChoice ||
    (await artifactAnchorField.inputValue()) !== evidenceApplicationAnchor
  ) {
    throw new Error(
      "The learner evidence-to-design link and creation anchor were not recorded.",
    );
  }
  assertions.evidenceApplicationRecorded = true;
  assertions.artifactAnchorRecorded = true;
  await center(page.locator(".evidence-application-panel"));
  const creationReview = page.getByLabel(
    /I reviewed my response against every completion criterion/i,
  );
  await creationReview.check();
  if (!(await creationReview.isChecked())) {
    throw new Error("The learner creation self-review was not checked.");
  }
  assertions.creationReviewChecked = true;
  await frame("05-creation");
  completeMilestone("creation");

  await waitForInternalWindow(97, 103, "reflection transition");
  await page.getByRole("button", { name: /Finish creation/i }).click();
  await page
    .getByRole("heading", {
      name: "Make the change in your thinking visible.",
    })
    .waitFor();
  await page.locator("#reflection-usedToThink").waitFor({ state: "visible" });

  await waitUntil(milestonePlan.reflection.targetSeconds);
  const usedToThinkField = page.locator("#reflection-usedToThink");
  const nowThinkField = page.locator("#reflection-nowThink");
  const stillWonderField = page.locator("#reflection-stillWonder");
  await usedToThinkField.fill(reflections.usedToThink);
  await nowThinkField.fill(reflections.nowThink);
  await stillWonderField.fill(reflections.stillWonder);

  await center(nowThinkField);
  await assertReflectionField(
    usedToThinkField,
    reflections.usedToThink,
    "Used to think reflection",
  );
  await assertReflectionField(
    nowThinkField,
    reflections.nowThink,
    "Now I think reflection",
  );
  await frame("06-reflection-top");

  await waitUntil(105);
  await center(stillWonderField);
  await assertReflectionField(
    stillWonderField,
    reflections.stillWonder,
    "Still wonder reflection",
  );
  await frame("06-reflection-bottom");
  assertions.allReflectionFieldsShown = true;
  completeMilestone("reflection");

  await waitUntil(milestonePlan.discovery.targetSeconds);
  await page.getByRole("button", { name: /Reveal my Curiosity Map/i }).click();
  await page
    .getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    })
    .waitFor();
  await page.locator("#curiosity-map").waitFor({ state: "visible" });
  const changedModelHeading = page.getByRole("heading", {
    name: "Your change",
    exact: true,
  });
  await center(changedModelHeading);
  await assertInViewport(
    changedModelHeading,
    "The learner's before-and-now payoff",
  );
  await frame("07-discovery");
  assertions.finalChangeVisible = true;
  completeMilestone("discovery");

  await waitForInternalWindow(118, 122, "map replay start");
  const map = page.locator("#curiosity-map");
  await prepareNativeMapForRecording(map);
  await assertMapNodesInViewport();
  await map.getByRole("button", { name: /Replay trail/i }).click();
  await page.waitForTimeout(8_500);
  const mapStateBeforeFrame = await readMapState();
  await assertMapNodesInViewport();
  await frame("08-map");
  const mapStateAfterFrame = await readMapState();
  await assertMapNodesInViewport();
  assertions.mapNodeCount = mapStateAfterFrame.count;
  assertions.mapNodeMinimumOpacity = Math.min(
    mapStateBeforeFrame.minimumOpacity,
    mapStateAfterFrame.minimumOpacity,
  );
  assertions.mapNodesInViewport = true;
  await waitUntil(milestonePlan.map.targetSeconds);
  completeMilestone("map");

  await waitUntil(128);
  await chooseAndProveNextQuestion();

  await frame("09-branch-choice");
  await readMapState();

  await waitUntil(133);
  const selectedQuestionRow = page
    .locator(".trace-at-a-glance .trace-row")
    .filter({ hasText: "My next question" });
  await center(selectedQuestionRow);
  await assertInViewport(
    selectedQuestionRow,
    "The At a glance summary's learner-selected next question",
  );
  await frame("10-discovery-card-reflection");
  assertions.atAGlancePayoffVisible = true;
  assertions.selectedQuestionCloseupVisible = true;

  const discussion = page.getByRole("region", {
    name: "Discuss this trace",
    exact: true,
  });
  const discussionPrompt = discussion.getByText(facilitatorRevisionPrompt, {
    exact: true,
  });
  const discussionNote = discussion.getByText(facilitatorNonEvaluativeNote, {
    exact: true,
  });
  await center(discussion);
  await assertInViewport(discussionPrompt, "The Discuss this trace prompt");
  await assertInViewport(discussionNote, "The Discuss this trace note");
  await frame("10-discuss-trace");
  assertions.facilitatorPromptVisible = true;

  await waitUntil(milestonePlan.export.targetSeconds);
  const discoveryActions = page.locator(".discovery-actions");
  await center(discoveryActions);
  await assertInViewport(discoveryActions, "The Discovery Card export actions");
  exportProof = await proveExport();
  await assertInViewport(discoveryActions, "The verified export result");
  await frame("11-export");
  assertions.exportActionVisible = true;
  assertions.exportVerified = true;
  await readMapState();
  await assertInViewport(
    page.locator('[data-wonderlab-seeded-provenance="true"]'),
    "The persistent seeded provenance badge",
  );
  completeMilestone("export");

  await waitUntil(milestonePlan.end.targetSeconds);
  completeMilestone("end");

  const expectedMilestones = Object.keys(milestonePlan);
  if (
    milestones.length !== expectedMilestones.length ||
    milestones.some(
      (milestone, index) => milestone.name !== expectedMilestones[index],
    )
  ) {
    throw new Error(
      "The capture did not record every required milestone in order.",
    );
  }

  const closeFailures = await bestEffortBrowserCleanup({
    browser,
    context,
    page,
    warmPage,
  });
  if (closeFailures.length > 0) {
    throw new AggregateError(
      closeFailures.map((failure) => failure.reason),
      `Capture cleanup failed: ${closeFailures
        .map((failure) => failure.label)
        .join(", ")}.`,
    );
  }
  browser = undefined;
  context = undefined;
  page = undefined;

  if (ownsCaptureServer) {
    await stopOwnedCaptureServer(ownedCaptureServer);
    ownedCaptureServer = undefined;
    captureServerStoppedBeforePublication = true;
  }

  if (!video)
    throw new Error("Playwright did not create a product-take video.");
  const rawVideoPath = await video.path();
  await fs.rename(rawVideoPath, stagedProductPath);

  const endingFullSha = runGit(root, ["rev-parse", "HEAD"]).trim();
  const endingDirtyStatus = runGit(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const endingCaptureScriptHash = await hashFile(captureScriptPath);
  const endingReleaseIdentity = await loadReleaseIdentity({ root });
  if (
    endingFullSha !== fullSha ||
    endingDirtyStatus !== dirtyStatus ||
    endingCaptureScriptHash !== captureScriptHash ||
    JSON.stringify(releaseIdentityRecord(endingReleaseIdentity)) !==
      JSON.stringify(releaseIdentityRecord(releaseIdentity))
  ) {
    throw new Error(
      "Repository source changed during the recording. Refusing to publish a mixed-source canonical take.",
    );
  }

  const productStat = await fs.stat(stagedProductPath);
  const productSha256 = await hashFile(stagedProductPath);
  const frameOutputs = [];
  for (const capturedFrame of capturedFrames) {
    const stat = await fs.stat(capturedFrame.stagedPath);
    frameOutputs.push({
      name: capturedFrame.name,
      path: normalizedRepoPath(
        path.relative(root, path.join(framesDir, `${capturedFrame.name}.png`)),
      ),
      bytes: stat.size,
      sha256: await hashFile(capturedFrame.stagedPath),
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "seeded_fallback",
    source: {
      fullSha,
      shortSha,
      dirty,
      dirtyStatus,
      allowDirtyOverride,
    },
    releaseIdentity: releaseIdentityRecord(releaseIdentity),
    baseUrl,
    server: {
      mode: captureServerMode,
      owned: ownsCaptureServer,
      baseUrl,
      openAiKeyProvidedToOwnedServer: false,
      stoppedBeforePublication: captureServerStoppedBeforePublication,
    },
    viewport: VIEWPORT,
    durationTargetSeconds: DURATION_TARGET_SECONDS,
    videoLeadInSeconds,
    milestones,
    inputs: {
      captureScript: {
        path: normalizedRepoPath(path.relative(root, captureScriptPath)),
        sha256: captureScriptHash,
      },
      releaseIdentity: releaseIdentityRecord(releaseIdentity),
    },
    outputs: {
      productTake: {
        path: normalizedRepoPath(path.relative(root, finalVideoPath)),
        bytes: productStat.size,
        sha256: productSha256,
      },
      frames: frameOutputs,
    },
    assertions,
    provenance: {
      persistentInProductBadge: true,
      badgeText: SEEDED_BADGE_TEXT,
      captureStartedAt,
      mapLayout: "native_final_overview",
    },
    exportProof,
    publicationStatus: "recorded_not_published",
  };

  await writeJsonAtomic(stagedManifestPath, manifest);
  await commitCaptureArtifacts({
    stagedFramesDir,
    stagedManifestPath,
    stagedProductPath,
    framesDir,
    manifestPath,
    productPath: finalVideoPath,
  });
  captureCommitted = true;
  await fs.rm(stagingDir, { recursive: true, force: true });

  console.log(`Recorded ${finalVideoPath}`);
  console.log(`Wrote ${manifestPath}`);
} finally {
  const cleanupFailures = await bestEffortBrowserCleanup({
    browser,
    context,
    page,
    warmPage,
  });
  for (const failure of cleanupFailures) {
    console.warn(`Cleanup warning (${failure.label}): ${failure.reason}`);
  }

  try {
    await stopOwnedCaptureServer(ownedCaptureServer);
  } catch (error) {
    console.warn(`Cleanup warning (capture server): ${error.message}`);
  }

  if (!captureCommitted) {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}
