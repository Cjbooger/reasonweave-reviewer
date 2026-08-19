import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";

import {
  cleanupAnchoredDirectory,
  createAnchoredChildDirectory,
  readAnchoredFiles,
  writeExclusiveAnchoredFile,
} from "./anchored-directory-ops.mjs";
import {
  assertDemoImageDimensions,
  parseDemoSrt,
  validateDemoCues,
} from "./demo-release-contract.mjs";
import {
  assertReleaseMediaDirectoryIdentity,
  RELEASE_MEDIA_FILES,
  RELEASE_MEDIA_RECEIPT_FILE,
  RELEASE_MEDIA_RENDER_OUTPUTS,
  resolveReleaseMediaPaths,
} from "./release-media-paths.mjs";
import {
  assertReleaseIdentityText,
  loadReleaseIdentity,
  releaseIdentityRecord,
} from "./release-identity.mjs";

const root = process.cwd();
const releaseBinding = await resolveReleaseMediaPaths({
  root,
  environment: process.env,
  mode: "render",
  requiredFiles: [
    RELEASE_MEDIA_FILES.proofBoardSvg,
    RELEASE_MEDIA_FILES.captions,
  ],
});
const mediaDir = releaseBinding.mediaDir;
const publicOgOutput = releaseBinding.publicOgOutput;
const stagedOgName = path.basename(publicOgOutput);
const renderedAssetNames = [...RELEASE_MEDIA_RENDER_OUTPUTS, stagedOgName];
const outputNames = [...renderedAssetNames, RELEASE_MEDIA_RECEIPT_FILE];
const stagingDir = path.join(
  mediaDir,
  `.wonderlab-media-staging-${process.pid}-${randomUUID()}`,
);
let operationError;
let stagingAnchor;
let stagedFiles;
const mediaDirectoryAnchor = {
  path: releaseBinding.mediaDir,
  realPath: releaseBinding.mediaReal,
  dev: releaseBinding.identity.dev,
  ino: releaseBinding.identity.ino,
  message: "The selected release-media directory changed during rendering.",
};

async function stageAsset(filename, content) {
  await writeExclusiveAnchoredFile({
    anchor: stagingAnchor,
    filename,
    content,
  });
}

async function publishRenderedAssets() {
  try {
    await assertReleaseIdentityUnchanged();
    for (const filename of RELEASE_MEDIA_RENDER_OUTPUTS) {
      await writeExclusiveAnchoredFile({
        anchor: mediaDirectoryAnchor,
        filename,
        content: stagedFiles[filename].content,
      });
    }
    await writeExclusiveAnchoredFile({
      anchor: releaseBinding.publicDirectoryAnchor,
      filename: stagedOgName,
      content: stagedFiles[stagedOgName].content,
    });
    await writeExclusiveAnchoredFile({
      anchor: mediaDirectoryAnchor,
      filename: RELEASE_MEDIA_RECEIPT_FILE,
      content: stagedFiles[RELEASE_MEDIA_RECEIPT_FILE].content,
    });
    await assertReleaseMediaDirectoryIdentity(releaseBinding);
    await assertReleaseIdentityUnchanged();
  } catch (error) {
    throw new AggregateError(
      [error],
      `Release-media publication stopped safely. Any exclusively created outputs and staged evidence at ${stagingDir} were preserved for manual reconciliation.`,
    );
  }
}

async function assertReleaseIdentityUnchanged() {
  const currentIdentity = await loadReleaseIdentity({ root });
  if (
    JSON.stringify(releaseIdentityRecord(currentIdentity)) !==
    JSON.stringify(releaseIdentityRecord(releaseBinding.releaseIdentity))
  ) {
    throw new Error(
      "The release identity changed during media rendering. Refusing a mixed-identity release.",
    );
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function contentRecord(recordPath, content, extra = {}) {
  return {
    ...extra,
    path: recordPath,
    bytes: content.length,
    sha256: sha256(content),
  };
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

await assertReleaseMediaDirectoryIdentity(releaseBinding);
stagingAnchor = await createAnchoredChildDirectory({
  parentAnchor: mediaDirectoryAnchor,
  directoryName: path.basename(stagingDir),
  message: "The release-media staging directory changed during rendering.",
});

try {
  await assertReleaseMediaDirectoryIdentity(releaseBinding);
  const mediaInputs = await readAnchoredFiles({
    anchor: mediaDirectoryAnchor,
    filenames: [
      RELEASE_MEDIA_FILES.proofBoardSvg,
      RELEASE_MEDIA_FILES.captions,
    ],
  });
  const screenshotInputs = await readAnchoredFiles({
    anchor: releaseBinding.screenshotDirectoryAnchor,
    filenames: ["discovery-desktop.jpg"],
  });
  const discoveryInput = screenshotInputs["discovery-desktop.jpg"];
  const expectedDiscovery = releaseBinding.screenshotEvidence.releaseScreenshot;
  if (
    discoveryInput.bytes !== expectedDiscovery.bytes ||
    createHash("sha256").update(discoveryInput.content).digest("hex") !==
      expectedDiscovery.sha256
  ) {
    throw new Error(
      "The anchored discovery screenshot no longer matches its release receipt.",
    );
  }
  const releaseName = releaseBinding.releaseIdentity.displayName;
  const escapedReleaseName = escapeXml(releaseName);
  for (const filename of [
    RELEASE_MEDIA_FILES.proofBoardSvg,
    RELEASE_MEDIA_FILES.captions,
  ]) {
    assertReleaseIdentityText({
      content: mediaInputs[filename].content.toString("utf8"),
      label: `Release media input ${filename}`,
      identity: releaseBinding.releaseIdentity,
    });
  }
  validateDemoCues(
    parseDemoSrt(
      mediaInputs[RELEASE_MEDIA_FILES.captions].content.toString("utf8"),
    ),
  );

  const proofBoardPng = await sharp(
    mediaInputs[RELEASE_MEDIA_FILES.proofBoardSvg].content,
  )
    .png()
    .toBuffer();
  await assertDemoImageDimensions({
    content: proofBoardPng,
    width: 1600,
    height: 900,
    label: "proof board",
  });
  await stageAsset(RELEASE_MEDIA_FILES.proofBoardPng, proofBoardPng);

  const seededDemoBadge = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="72" viewBox="0 0 360 72">
  <defs>
    <filter id="shadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#041f32" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="5" y="5" width="350" height="62" rx="31" fill="#fbf8f1" stroke="#9b3f24" stroke-width="2"/>
    <circle cx="40" cy="36" r="16" fill="#f4d8cc"/>
    <circle cx="40" cy="36" r="7" fill="#b94f2f"/>
    <text x="68" y="44" fill="#7f321f" font-family="Arial, sans-serif" font-size="23" font-weight="900" letter-spacing="1.8">SEEDED DEMO</text>
  </g>
</svg>
`);

  const seededDemoBadgePng = await sharp(seededDemoBadge)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await stageAsset(RELEASE_MEDIA_FILES.badge, seededDemoBadgePng);

  const closingCard = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <filter id="shadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#00111d" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="1280" height="720" fill="#041f32"/>
  <path d="M0 162 C260 92 430 220 690 145 C920 78 1090 182 1280 122" fill="none" stroke="#6fb8b4" stroke-opacity="0.14" stroke-width="2"/>
  <path d="M0 570 C260 500 490 640 760 550 C980 478 1130 594 1280 538" fill="none" stroke="#e96e45" stroke-opacity="0.13" stroke-width="2"/>

  <g filter="url(#shadow)">
    <rect x="62" y="48" width="378" height="42" rx="21" fill="#c7e3df"/>
    <text x="85" y="76" fill="#05575d" font-family="Arial, sans-serif" font-size="18" font-weight="850" letter-spacing="1.6">OPENAI BUILD WEEK · EDUCATION</text>
  </g>

  <g filter="url(#shadow)">
    <rect x="928" y="48" width="290" height="42" rx="21" fill="#fbf8f1"/>
    <text x="1073" y="76" text-anchor="middle" fill="#9b3f24" font-family="Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="1.3">SEEDED DEMO REHEARSAL</text>
  </g>

  <text x="62" y="170" fill="#fbf8f1" font-family="Georgia, serif" font-size="72" font-weight="700" letter-spacing="-1.6">${escapedReleaseName}</text>
  <rect x="64" y="198" width="100" height="7" rx="3.5" fill="#e96e45"/>

  <text x="62" y="308" fill="#fbf8f1" font-family="Georgia, serif" font-size="54" font-weight="700">Most AI gives you an answer.</text>
  <text x="62" y="378" fill="#d9eeea" font-family="Georgia, serif" font-size="54" font-weight="700">${escapedReleaseName} makes thinking visible.</text>

  <text x="65" y="457" fill="#c7e3df" font-family="Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="0.5">PREDICT → JUDGE EVIDENCE → APPLY → CREATE → REFLECT → BRANCH</text>

  <g filter="url(#shadow)">
    <rect x="62" y="515" width="1156" height="124" rx="18" fill="#fbf8f1"/>
    <text x="640" y="570" text-anchor="middle" fill="#0b2435" font-family="Arial, sans-serif" font-size="19" font-weight="850" letter-spacing="1.8">KEEP THE HUMAN RESPONSIBLE</text>
    <text x="640" y="609" text-anchor="middle" fill="#08747a" font-family="Georgia, serif" font-size="31" font-weight="700">for the thinking.</text>
  </g>

  <text x="640" y="687" text-anchor="middle" fill="#9ecbc7" font-family="Arial, sans-serif" font-size="16">Local seeded rehearsal · not a live-model claim · credentialed evaluation remains an open gate</text>
</svg>
`);

  const closingCardPng = await sharp(closingCard)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await assertDemoImageDimensions({
    content: closingCardPng,
    width: 1280,
    height: 720,
    label: "closing card",
  });
  await stageAsset(RELEASE_MEDIA_FILES.closingCard, closingCardPng);

  const thumbnailOverlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="left-shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#041f32" stop-opacity="1"/>
      <stop offset="0.50" stop-color="#041f32" stop-opacity="0.98"/>
      <stop offset="0.56" stop-color="#041f32" stop-opacity="0.28"/>
      <stop offset="0.64" stop-color="#041f32" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottom-shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0.70" stop-color="#041f32" stop-opacity="0"/>
      <stop offset="1" stop-color="#041f32" stop-opacity="0.82"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#041f32" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="1280" height="720" fill="url(#left-shade)"/>
  <rect width="650" height="720" fill="url(#bottom-shade)"/>

  <g filter="url(#shadow)">
    <rect x="54" y="48" width="382" height="42" rx="21" fill="#c7e3df"/>
    <text x="77" y="76" fill="#05575d" font-family="Arial, sans-serif" font-size="18" font-weight="800" letter-spacing="1.7">OPENAI BUILD WEEK · EDUCATION</text>
  </g>

  <g filter="url(#shadow)">
    <rect x="1028" y="48" width="200" height="42" rx="21" fill="#fbf8f1"/>
    <text x="1128" y="76" text-anchor="middle" fill="#9b3f24" font-family="Arial, sans-serif" font-size="20" font-weight="900" letter-spacing="1.5">SEEDED DEMO</text>
  </g>

  <text x="54" y="158" fill="#fbf8f1" font-family="Georgia, serif" font-size="63" font-weight="700" letter-spacing="-2">${escapedReleaseName}</text>
  <text x="58" y="194" fill="#d9eeea" font-family="Arial, sans-serif" font-size="20" font-weight="850" letter-spacing="3">VISIBLE REASONING STUDIO</text>
  <rect x="56" y="214" width="84" height="7" rx="3.5" fill="#e96e45"/>

  <text x="54" y="292" fill="#fbf8f1" font-family="Arial, sans-serif" font-size="52" font-weight="900" letter-spacing="-1.5">MAKE THINKING</text>
  <text x="54" y="352" fill="#fbf8f1" font-family="Arial, sans-serif" font-size="52" font-weight="900" letter-spacing="-1.5">VISIBLE.</text>

  <text x="58" y="418" fill="#d9eeea" font-family="Arial, sans-serif" font-size="24" font-weight="650">Predict. Judge evidence. Apply it.</text>
  <text x="58" y="457" fill="#d9eeea" font-family="Arial, sans-serif" font-size="24" font-weight="650">Create. Reflect. Leave with questions.</text>

  <g filter="url(#shadow)">
    <rect x="54" y="564" width="568" height="106" rx="14" fill="#fbf8f1"/>
    <text x="82" y="608" fill="#0b2435" font-family="Arial, sans-serif" font-size="19" font-weight="850" letter-spacing="0.4">PREDICT → JUDGE → APPLY → CREATE</text>
    <text x="82" y="646" fill="#0b2435" font-family="Arial, sans-serif" font-size="19" font-weight="850" letter-spacing="0.4">REFLECT → BRANCH / MAP</text>
  </g>

  <text x="674" y="101" fill="#fbf8f1" font-family="Arial, sans-serif" font-size="20" font-weight="900" letter-spacing="1.4">THE LEARNER'S REASONING TRACE</text>
  <rect x="640" y="110" width="590" height="552" rx="25" fill="none" stroke="#fbf8f1" stroke-width="3" stroke-opacity="0.94"/>
</svg>
`);

  const discoveryFrame = await sharp(discoveryInput.content)
    .resize(1280, 720, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  const dimmedDiscovery = await sharp(discoveryFrame)
    .modulate({ brightness: 0.34, saturation: 0.78 })
    .blur(1.2)
    .png()
    .toBuffer();

  const nextQuestionCrop = await sharp(discoveryFrame)
    .extract({ left: 700, top: 220, width: 530, height: 500 })
    .resize(560, 520, {
      fit: "contain",
      background: "#06283b",
    })
    .modulate({ brightness: 1.04, saturation: 0.96 })
    .png()
    .toBuffer();

  const thumbnail = await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 4,
      background: "#041f32",
    },
  })
    .composite([
      { input: dimmedDiscovery, left: 0, top: 0 },
      { input: nextQuestionCrop, left: 655, top: 126 },
      { input: thumbnailOverlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await stageAsset(RELEASE_MEDIA_FILES.thumbnail, thumbnail);
  await stageAsset(stagedOgName, thumbnail);

  await assertReleaseMediaDirectoryIdentity(releaseBinding);
  await assertReleaseIdentityUnchanged();
  const renderedAssets = await readAnchoredFiles({
    anchor: stagingAnchor,
    filenames: renderedAssetNames,
  });
  const mediaContent = {
    [RELEASE_MEDIA_FILES.proofBoardSvg]:
      mediaInputs[RELEASE_MEDIA_FILES.proofBoardSvg].content,
    [RELEASE_MEDIA_FILES.captions]:
      mediaInputs[RELEASE_MEDIA_FILES.captions].content,
    ...Object.fromEntries(
      RELEASE_MEDIA_RENDER_OUTPUTS.map((filename) => [
        filename,
        renderedAssets[filename].content,
      ]),
    ),
  };
  const releaseMediaReceipt = {
    schemaVersion: 1,
    kind: "wonderlab-release-media-receipt",
    generatedAt: new Date().toISOString(),
    releaseDirectory: releaseBinding.releaseDirectory,
    releaseIdentity: releaseIdentityRecord(releaseBinding.releaseIdentity),
    screenshotEvidence: releaseBinding.screenshotEvidence,
    mediaFiles: Object.values(RELEASE_MEDIA_FILES).map((filename) =>
      contentRecord(
        `${releaseBinding.relativeMediaDir}/${filename}`,
        mediaContent[filename],
        { filename },
      ),
    ),
    publicOg: contentRecord(
      releaseBinding.relativePublicOgOutput,
      renderedAssets[stagedOgName].content,
    ),
  };
  await stageAsset(
    RELEASE_MEDIA_RECEIPT_FILE,
    Buffer.from(`${JSON.stringify(releaseMediaReceipt, null, 2)}\n`),
  );
  stagedFiles = await readAnchoredFiles({
    anchor: stagingAnchor,
    filenames: outputNames,
  });
  await publishRenderedAssets();
} catch (error) {
  operationError = error;
} finally {
  if (!operationError && stagedFiles) {
    try {
      await cleanupAnchoredDirectory({
        parentAnchor: mediaDirectoryAnchor,
        directoryAnchor: stagingAnchor,
        expectedFiles: outputNames.map((filename) => ({
          filename,
          dev: stagedFiles[filename].dev,
          ino: stagedFiles[filename].ino,
        })),
      });
      await assertReleaseMediaDirectoryIdentity(releaseBinding);
    } catch (cleanupError) {
      operationError = new AggregateError(
        [cleanupError],
        `Release-media publication completed, but anchored cleanup or final identity verification failed. Inspect ${stagingDir} and the exclusive outputs before continuing.`,
      );
    }
  }
}

if (operationError) throw operationError;
console.log(
  `Rendered ${RELEASE_MEDIA_RENDER_OUTPUTS.join(", ")} in ${releaseBinding.relativeMediaDir} and ${releaseBinding.relativePublicOgOutput}`,
);
