import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const staticRoot = path.join(root, ".next");
const clientManifestPath = path.join(
  staticRoot,
  "server/app/page_client-reference-manifest.js",
);
const dynamicManifestPath = path.join(
  staticRoot,
  "server/app/page/react-loadable-manifest.json",
);

const MAX_INITIAL_RAW_BYTES = 475_000;
const MAX_INITIAL_GZIP_BYTES = 120_000;
const SEEDED_FIXTURE_MARKER = "demo-underwater-v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function summarize(files) {
  let rawBytes = 0;
  let gzipBytes = 0;

  for (const relativeFile of files) {
    const filePath = path.join(staticRoot, relativeFile);
    const [metadata, contents] = await Promise.all([
      stat(filePath),
      readFile(filePath),
    ]);
    rawBytes += metadata.size;
    gzipBytes += gzipSync(contents).byteLength;
  }

  return { rawBytes, gzipBytes };
}

const manifestSource = await readFile(clientManifestPath, "utf8");
const assignment = 'globalThis.__RSC_MANIFEST["/page"] = ';
const assignmentIndex = manifestSource.indexOf(assignment);
invariant(
  assignmentIndex >= 0,
  "Could not find the /page client manifest assignment. Run `npm run build` first.",
);
const jsonStart = assignmentIndex + assignment.length;
const jsonEnd = manifestSource.indexOf(";", jsonStart);
invariant(jsonEnd > jsonStart, "The /page client manifest is malformed.");

const clientManifest = JSON.parse(manifestSource.slice(jsonStart, jsonEnd));
const initialFiles = clientManifest.entryJSFiles?.["[project]/app/page"];
invariant(
  Array.isArray(initialFiles) && initialFiles.length > 0,
  "The /page initial client entry list is missing.",
);

const dynamicManifest = JSON.parse(await readFile(dynamicManifestPath, "utf8"));
const deferredFiles = [
  ...new Set(
    Object.values(dynamicManifest).flatMap((entry) => entry.files ?? []),
  ),
];
const clientJavaScriptFiles = (
  await readdir(path.join(staticRoot, "static/chunks"), { recursive: true })
)
  .filter((entry) => entry.endsWith(".js"))
  .map((entry) => path.join("static/chunks", entry));
invariant(
  deferredFiles.length >= 2,
  "Expected separate deferred chunks for the Curiosity Map and Discovery Card.",
);

async function findFeatureChunk(marker, label) {
  const matches = [];
  for (const file of deferredFiles) {
    const contents = await readFile(path.join(staticRoot, file), "utf8");
    if (contents.includes(marker)) matches.push(file);
  }
  invariant(
    matches.length === 1,
    `Expected exactly one deferred ${label} chunk; found ${matches.length}.`,
  );
  return matches[0];
}

async function findFilesWithMarker(files, marker) {
  const matches = [];
  for (const file of files) {
    const contents = await readFile(path.join(staticRoot, file), "utf8");
    if (contents.includes(marker)) matches.push(file);
  }
  return matches;
}

const [mapFile, cardFile] = await Promise.all([
  findFeatureChunk("Curiosity Map", "Curiosity Map"),
  findFeatureChunk("Copy Markdown", "Discovery Card"),
]);
invariant(
  mapFile !== cardFile,
  "Curiosity Map and Discovery Card must remain separate deferred chunks.",
);
const initialSet = new Set(initialFiles);
invariant(
  deferredFiles.every((file) => !initialSet.has(file)),
  "A deferred feature chunk was pulled back into the initial /page entry.",
);

const [initialSeededFixtureFiles, deferredSeededFixtureFiles] =
  await Promise.all([
    findFilesWithMarker(initialFiles, SEEDED_FIXTURE_MARKER),
    findFilesWithMarker(clientJavaScriptFiles, SEEDED_FIXTURE_MARKER),
  ]);
invariant(
  initialSeededFixtureFiles.length === 0,
  "The seeded demo fixture was pulled into the initial /page entry.",
);
invariant(
  deferredSeededFixtureFiles.length === 1,
  `Expected exactly one deferred seeded demo fixture chunk; found ${deferredSeededFixtureFiles.length}.`,
);
invariant(
  deferredSeededFixtureFiles[0] !== mapFile &&
    deferredSeededFixtureFiles[0] !== cardFile,
  "The seeded demo fixture must stay separate from the live deferred UI chunks.",
);

const [initial, map, card, deferred, seededDemo] = await Promise.all([
  summarize(initialFiles),
  summarize([mapFile]),
  summarize([cardFile]),
  summarize(deferredFiles),
  summarize(deferredSeededFixtureFiles),
]);

invariant(
  initial.rawBytes <= MAX_INITIAL_RAW_BYTES,
  `Initial /page JavaScript is ${initial.rawBytes} bytes; budget is ${MAX_INITIAL_RAW_BYTES}.`,
);
invariant(
  initial.gzipBytes <= MAX_INITIAL_GZIP_BYTES,
  `Initial /page JavaScript is ${initial.gzipBytes} gzip bytes; budget is ${MAX_INITIAL_GZIP_BYTES}.`,
);

console.log(
  `PASS initial /page JavaScript: ${initial.rawBytes} raw bytes, ${initial.gzipBytes} gzip bytes across ${initialFiles.length} chunks.`,
);
console.log(
  `PASS deferred Curiosity Map JavaScript: ${map.rawBytes} raw bytes, ${map.gzipBytes} gzip bytes.`,
);
console.log(
  `PASS deferred Discovery Card JavaScript: ${card.rawBytes} raw bytes, ${card.gzipBytes} gzip bytes.`,
);
console.log(
  `PASS deferred Curiosity Map + Discovery Card JavaScript: ${deferred.rawBytes} raw bytes, ${deferred.gzipBytes} gzip bytes across ${deferredFiles.length} UI chunks.`,
);
console.log(
  `PASS seeded demo fixture JavaScript: ${seededDemo.rawBytes} raw bytes, ${seededDemo.gzipBytes} gzip bytes in ${deferredSeededFixtureFiles[0]}.`,
);
