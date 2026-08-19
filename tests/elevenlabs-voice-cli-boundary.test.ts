import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots: string[] = [];
const selectedVoiceId = "OZxMHsGaBmV5pjMIDIn0";
const catalogVoiceId = "voice_alpha";

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) =>
        fs.rm(temporaryRoot, { recursive: true, force: true }),
      ),
  );
});

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function preloadSource() {
  return [
    'const fs = require("node:fs");',
    'const fsPromises = require("node:fs/promises");',
    'const path = require("node:path");',
    'const { syncBuiltinESMExports } = require("node:module");',
    "const fixtureRoot = process.cwd();",
    "const publicOutput = path.resolve(process.cwd(), process.env.WONDERLAB_CAPTURE_OUTPUT);",
    "const parkedOutput = `${publicOutput}-parked`;",
    "const outsideCapture = path.resolve(process.env.SWAP_OUTSIDE_CAPTURE);",
    'const outsideNarration = path.join(outsideCapture, "elevenlabs");',
    "const fetchLog = path.resolve(process.env.FETCH_LOG_PATH);",
    "const stateLog = path.resolve(process.env.STATE_LOG_PATH);",
    "const state = { swapped: false, mutated: false, opens: [], writes: [], links: [] };",
    "const persist = () => fs.writeFileSync(stateLog, JSON.stringify(state));",
    "const classify = (filePath) => {",
    "  const actual = fs.realpathSync(filePath);",
    '  const anchoredRoot = `${fs.realpathSync(path.join(parkedOutput, "elevenlabs"))}${path.sep}`;',
    "  const outsideRoot = `${fs.realpathSync(outsideNarration)}${path.sep}`;",
    '  if (actual === anchoredRoot.slice(0, -1) || actual.startsWith(anchoredRoot)) return "anchored";',
    '  if (actual === outsideRoot.slice(0, -1) || actual.startsWith(outsideRoot)) return "outside";',
    '  return "other";',
    "};",
    "const swap = () => {",
    "  if (state.swapped) return;",
    "  fs.mkdirSync(outsideNarration, { recursive: true });",
    "  fs.renameSync(publicOutput, parkedOutput);",
    "  fs.symlinkSync(outsideCapture, publicOutput);",
    "  state.swapped = true;",
    "  persist();",
    "};",
    "const mutateCredentialBoundary = () => {",
    "  if (state.mutated) return;",
    '  if (process.env.SWAP_TRIGGER === "config-during-anchor") {',
    '    fs.appendFileSync(path.join(fixtureRoot, "config", "release-narration.json"), " ");',
    '  } else if (process.env.SWAP_TRIGGER === "source-during-anchor") {',
    '    fs.appendFileSync(path.join(fixtureRoot, "scripts", "elevenlabs-voice-catalog.mjs"), "\\n");',
    "  } else {",
    "    return;",
    "  }",
    "  state.mutated = true;",
    "  persist();",
    "};",
    "persist();",
    "globalThis.fetch = async (url, init = {}) => {",
    '  const method = init.method || "GET";',
    "  const requested = new URL(String(url));",
    "  fs.appendFileSync(fetchLog, `${JSON.stringify({ method, url: requested.href })}\\n`);",
    '  if (requested.origin === "https://api.elevenlabs.io" && requested.pathname === "/v2/voices") {',
    '    if (process.env.FAKE_PROVIDER_MODE === "user-selected") {',
    '      if (process.env.SWAP_TRIGGER === "exact-get") swap();',
    '      return { ok: false, status: 401, json: async () => ({ detail: { status: "missing_permissions" } }) };',
    "    }",
    "    return {",
    "      ok: true,",
    "      status: 200,",
    "      json: async () => ({",
    "        voices: [{",
    `          voice_id: ${JSON.stringify(catalogVoiceId)},`,
    '          name: "Warm Narrator",',
    '          category: "premade",',
    '          description: "A warm educational narrator.",',
    '          labels: { accent: "American", age: "middle aged", gender: "female", use_case: "narration" },',
    '          preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/voice_alpha/preview.mp3",',
    "        }],",
    "        has_more: false,",
    "      }),",
    "    };",
    "  }",
    '  if (requested.origin === "https://storage.googleapis.com" && requested.pathname === "/eleven-public-prod/premade/voices/voice_alpha/preview.mp3") {',
    "    const audio = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);",
    "    return {",
    "      ok: true,",
    "      status: 200,",
    "      headers: {",
    '        get: (name) => name === "content-length" ? String(audio.length) : name === "content-type" ? "audio/mpeg" : null,',
    "      },",
    "      arrayBuffer: async () => audio,",
    "    };",
    "  }",
    "  throw new Error(`UNEXPECTED_FAKE_FETCH ${method} ${requested.origin}${requested.pathname}`);",
    "};",
    "const originalMkdir = fsPromises.mkdir.bind(fsPromises);",
    "fsPromises.mkdir = async (directory, ...args) => {",
    '  if (path.basename(path.resolve(directory)) === "elevenlabs") mutateCredentialBoundary();',
    "  return originalMkdir(directory, ...args);",
    "};",
    "const originalOpen = fsPromises.open.bind(fsPromises);",
    "fsPromises.open = async (filePath, ...args) => {",
    "  const basename = path.basename(filePath);",
    '  const lockTrigger = process.env.SWAP_TRIGGER === "lock" && basename === ".voice-mode-transition.lock";',
    '  const approvalTrigger = process.env.SWAP_TRIGGER === "approval-temp" && basename.startsWith(".approved-voice.json-");',
    "  if (!state.swapped && (lockTrigger || approvalTrigger)) swap();",
    "  const handle = await originalOpen(filePath, ...args);",
    "  if (state.swapped) {",
    "    const location = classify(filePath);",
    "    state.opens.push({ basename, location });",
    "    persist();",
    "    const originalWriteFile = handle.writeFile.bind(handle);",
    "    handle.writeFile = async (...writeArgs) => {",
    "      state.writes.push({ basename, location });",
    "      persist();",
    "      return originalWriteFile(...writeArgs);",
    "    };",
    "  }",
    "  return handle;",
    "};",
    "const originalLink = fsPromises.link.bind(fsPromises);",
    "fsPromises.link = async (source, destination) => {",
    "  const result = await originalLink(source, destination);",
    "  if (state.swapped) {",
    "    state.links.push({ basename: path.basename(destination), location: classify(destination) });",
    "    persist();",
    "  }",
    "  return result;",
    "};",
    "syncBuiltinESMExports();",
    "",
  ].join("\n");
}

async function cliFixture(outputName: string, voiceId = selectedVoiceId) {
  const fixtureRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "reasonweave-voice-cli-boundary-"),
  );
  temporaryRoots.push(fixtureRoot);
  await fs.mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, "config"), { recursive: true });
  for (const script of [
    "elevenlabs-voice-catalog.mjs",
    "list-elevenlabs-premade-voices.mjs",
    "release-narration.mjs",
  ]) {
    await fs.copyFile(
      path.join(root, "scripts", script),
      path.join(fixtureRoot, "scripts", script),
    );
  }
  await fs.writeFile(
    path.join(fixtureRoot, "config", "release-narration.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        provider: "elevenlabs",
        voiceId,
        verificationMode: "user_selected_tts_only",
      },
      null,
      2,
    )}\n`,
  );
  const preload = "fake-voice-provider-and-swap.cjs";
  await fs.writeFile(path.join(fixtureRoot, preload), preloadSource());
  await fs.writeFile(path.join(fixtureRoot, ".gitignore"), "output/\n");
  git(fixtureRoot, ["init", "--quiet"]);
  git(fixtureRoot, ["config", "user.email", "tests@example.invalid"]);
  git(fixtureRoot, ["config", "user.name", "ReasonWeave tests"]);
  git(fixtureRoot, ["add", "."]);
  git(fixtureRoot, ["commit", "--quiet", "-m", "fixture"]);
  const sourceSha = git(fixtureRoot, ["rev-parse", "HEAD"]);
  const relativeOutputPath = `output/playwright/${outputName}`;
  const outputDir = path.join(fixtureRoot, relativeOutputPath);
  const narrationDir = path.join(outputDir, "elevenlabs");
  const logDir = path.join(fixtureRoot, "output", "race-test-logs");
  const outsideCapture = path.join(
    fixtureRoot,
    "output",
    `outside-${outputName}`,
  );
  await fs.mkdir(narrationDir, { recursive: true });
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, ".wonderlab-demo-output.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      owner: "wonderlab-seeded-demo-v1",
      outputDir: relativeOutputPath,
      relativeOutputPath,
    })}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, "capture-manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      source: { fullSha: sourceSha, dirty: false },
    })}\n`,
  );
  return {
    fixtureRoot,
    logDir,
    narrationDir,
    outputDir,
    outputName,
    outsideCapture,
    preload,
  };
}

function runVoiceCli({
  fixture,
  args,
  fakeProviderMode,
  swapTrigger,
  logName,
}: {
  fixture: Awaited<ReturnType<typeof cliFixture>>;
  args: string[];
  fakeProviderMode: "catalog" | "preview" | "user-selected";
  swapTrigger:
    | "approval-temp"
    | "config-during-anchor"
    | "exact-get"
    | "lock"
    | "never"
    | "source-during-anchor";
  logName: string;
}) {
  const fetchLog = path.join(fixture.logDir, `${logName}-fetch.jsonl`);
  const stateLog = path.join(fixture.logDir, `${logName}-state.json`);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/list-elevenlabs-premade-voices.mjs",
      "--credentialed-request",
      ...args,
    ],
    {
      cwd: fixture.fixtureRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ELEVENLABS_API_KEY: "offline-test-key",
        FAKE_PROVIDER_MODE: fakeProviderMode,
        FETCH_LOG_PATH: fetchLog,
        NODE_OPTIONS: `--require ./${fixture.preload}`,
        STATE_LOG_PATH: stateLog,
        SWAP_OUTSIDE_CAPTURE: fixture.outsideCapture,
        SWAP_TRIGGER: swapTrigger,
        WONDERLAB_CAPTURE_OUTPUT: `output/playwright/${fixture.outputName}`,
      },
      timeout: 15_000,
    },
  );
  return { fetchLog, result, stateLog };
}

async function readFetches(fetchLog: string) {
  return (await fs.readFile(fetchLog, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { method: string; url: string });
}

async function readState(stateLog: string) {
  return JSON.parse(await fs.readFile(stateLog, "utf8")) as {
    swapped: boolean;
    mutated: boolean;
    opens: { basename: string; location: string }[];
    writes: { basename: string; location: string }[];
    links: { basename: string; location: string }[];
  };
}

async function entries(directory: string): Promise<string[]> {
  return fs.readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
}

function expectFixedCatalogGet(fetch: { method: string; url: string }) {
  const url = new URL(fetch.url);
  expect(fetch.method).toBe("GET");
  expect(url.origin).toBe("https://api.elevenlabs.io");
  expect(url.pathname).toBe("/v2/voices");
}

function expectContainedState(state: Awaited<ReturnType<typeof readState>>) {
  expect(state.swapped).toBe(true);
  expect(state.opens.some(({ location }) => location === "outside")).toBe(
    false,
  );
  expect(state.writes.some(({ location }) => location === "outside")).toBe(
    false,
  );
  expect(state.links.some(({ location }) => location === "outside")).toBe(
    false,
  );
}

function expectFinalContinuityFailure(result: ReturnType<typeof spawnSync>) {
  const output = `${result.stdout}${result.stderr}`;
  expect(result.status).not.toBe(0);
  expect(output).toMatch(/public capture output changed/i);
  expect(output).not.toContain("offline-test-key");
}

describe("credentialed ElevenLabs voice CLI parent-swap boundary", () => {
  it("rejects a noncanonical voice before the credentialed provider path", async () => {
    const fixture = await cliFixture("canonical-voice");
    const { fetchLog, result } = runVoiceCli({
      fixture,
      args: [
        "--approve-user-selected-voice",
        "voice_alpha",
        "--confirm-user-selected-voice",
      ],
      fakeProviderMode: "user-selected",
      swapTrigger: "never",
      logName: "canonical-voice",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "must match the canonical release narration voice",
    );
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed when the public capture swaps during the exact-ID user-selected GET", async () => {
    const fixture = await cliFixture("user-selected-get-swap");
    const { fetchLog, result, stateLog } = runVoiceCli({
      fixture,
      args: [
        "--approve-user-selected-voice",
        selectedVoiceId,
        "--confirm-user-selected-voice",
      ],
      fakeProviderMode: "user-selected",
      swapTrigger: "exact-get",
      logName: "user-selected",
    });
    const fetches = await readFetches(fetchLog);
    const state = await readState(stateLog);

    expectFinalContinuityFailure(result);
    expect(fetches).toHaveLength(1);
    expectFixedCatalogGet(fetches[0]);
    expect(new URL(fetches[0].url).searchParams.getAll("voice_ids")).toEqual([
      selectedVoiceId,
    ]);
    expectContainedState(state);
    await expect(
      fs.lstat(fixture.outputDir).then((metadata) => metadata.isSymbolicLink()),
    ).resolves.toBe(true);
    await expect(
      entries(path.join(fixture.outsideCapture, "elevenlabs")),
    ).resolves.toEqual([]);

    const parkedNarration = path.join(
      `${fixture.outputDir}-parked`,
      "elevenlabs",
    );
    const parkedEntries = await entries(parkedNarration);
    expect(parkedEntries).toEqual([]);
  });

  it.each([
    ["config", "config-during-anchor"],
    ["source", "source-during-anchor"],
  ] as const)(
    "rejects a %s mutation during artifact anchoring before the exact-ID fetch",
    async (kind, swapTrigger) => {
      const fixture = await cliFixture(`anchor-${kind}-mutation`);
      const { fetchLog, result, stateLog } = runVoiceCli({
        fixture,
        args: [
          "--approve-user-selected-voice",
          selectedVoiceId,
          "--confirm-user-selected-voice",
        ],
        fakeProviderMode: "user-selected",
        swapTrigger,
        logName: `anchor-${kind}`,
      });
      const state = await readState(stateLog);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain(
        "Refusing to load ElevenLabs credentials into a dirty or untracked Git tree",
      );
      expect(output).not.toContain("offline-test-key");
      expect(state).toMatchObject({ mutated: true, swapped: false });
      await expect(fs.access(fetchLog)).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(entries(fixture.narrationDir)).resolves.toEqual([]);
    },
  );

  it("rejects canonical preview mode for the same voice before any provider fetch", async () => {
    const fixture = await cliFixture("preview-mode-mismatch");
    const { fetchLog, result, stateLog } = runVoiceCli({
      fixture,
      args: ["--preview-voice", selectedVoiceId],
      fakeProviderMode: "preview",
      swapTrigger: "never",
      logName: "preview-mode-mismatch",
    });
    const state = await readState(stateLog);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "verification mode user_selected_tts_only permits only --approve-user-selected-voice",
    );
    expect(output).not.toContain("offline-test-key");
    expect(state).toMatchObject({ mutated: false, swapped: false });
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects canonical premade approval mode for the same voice before any provider fetch", async () => {
    const fixture = await cliFixture("premade-mode-mismatch");
    const { fetchLog, result, stateLog } = runVoiceCli({
      fixture,
      args: ["--approve-voice", selectedVoiceId, "--confirm-preview-reviewed"],
      fakeProviderMode: "catalog",
      swapTrigger: "never",
      logName: "premade-mode-mismatch",
    });
    const state = await readState(stateLog);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "verification mode user_selected_tts_only permits only --approve-user-selected-voice",
    );
    expect(output).not.toContain("offline-test-key");
    expect(state).toMatchObject({ mutated: false, swapped: false });
    await expect(fs.access(fetchLog)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
