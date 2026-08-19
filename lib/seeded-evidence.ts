import seededDemoJson from "@/data/demo-underwater.json";
import { evidenceBundleSchema } from "@/lib/schemas";
import type { EvidenceBundle, ExplorationRoute } from "@/types/curiosity";

export type SeededEvidenceRouteId =
  "survive-pressure" | "design-habitat" | "protect-ocean";

const PRESSURE_EVIDENCE = evidenceBundleSchema.parse({
  items: [
    {
      id: "pressure-with-depth",
      kind: "evidence",
      statement:
        "NOAA reports that ocean pressure increases by one atmosphere for about every 10 meters of depth.",
      sourceIds: ["noaa-pressure"],
    },
    {
      id: "aquarius-depth-and-entry",
      kind: "evidence",
      statement:
        "FIU's Aquarius lab operates 63 feet below the surface with a wet porch, two pressure locks, and a surface-linked life-support buoy.",
      sourceIds: ["fiu-aquarius"],
    },
    {
      id: "depth-system-coupling",
      kind: "inference",
      statement:
        "Together, those facts suggest that choosing a greater depth changes more than wall strength: it also changes entry, repair access, and the support systems needed to keep the habitat usable.",
      sourceIds: ["noaa-pressure", "fiu-aquarius"],
    },
    {
      id: "pressure-route-unknown",
      kind: "open_question",
      statement:
        "At what depth would protection from surface hazards stop being worth the added pressure and slower emergency access for a 100-person habitat?",
      sourceIds: [],
    },
  ],
  sources: [
    {
      id: "noaa-pressure",
      title: "How does pressure change with ocean depth?",
      url: "https://oceanservice.noaa.gov/facts/pressure.html",
      domain: "oceanservice.noaa.gov",
    },
    {
      id: "fiu-aquarius",
      title: "Aquarius Reef Base Facilities and Vessels",
      url: "https://environment.fiu.edu/aquarius/working-with-aquarius/facilities-vessels/",
      domain: "environment.fiu.edu",
    },
  ],
  conciseExplanation:
    "Depth is a systems decision, not just a shell calculation. Pressure rises predictably, while Aquarius shows that an operating habitat also needs pressure-managed entry, limited crew space, emergency reserves, and a reliable surface connection.",
  uncertaintyNote:
    "These sources describe pressure and one six-person research habitat; they do not identify a safe or practical depth for a permanent community of 100.",
} satisfies EvidenceBundle);

const HABITAT_EVIDENCE = evidenceBundleSchema.parse(seededDemoJson.evidence);

const ECOSYSTEM_EVIDENCE = evidenceBundleSchema.parse({
  items: [
    {
      id: "ocean-sound-effects",
      kind: "evidence",
      statement:
        "NOAA Fisheries explains that human-caused ocean sound can displace animals and disrupt feeding, breeding, nursing, and communication, depending on the sound, duration, and location.",
      sourceIds: ["noaa-ocean-sound"],
    },
    {
      id: "water-discharge-controls",
      kind: "evidence",
      statement:
        "In U.S. waters, EPA says point-source discharge permits set pollutant limits and include monitoring and reporting requirements.",
      sourceIds: ["epa-npdes-basics"],
    },
    {
      id: "ecosystem-stop-rules",
      kind: "inference",
      statement:
        "An underwater settlement would therefore need baseline measurements for sound and water quality, plus public thresholds that trigger reduced operations or shutdown when conditions worsen.",
      sourceIds: ["noaa-ocean-sound", "epa-npdes-basics"],
    },
    {
      id: "ecosystem-site-unknowns",
      kind: "open_question",
      statement:
        "Which species, habitats, currents, and existing sound levels at a proposed site should determine its actual water-quality and noise stop thresholds?",
      sourceIds: [],
    },
  ],
  sources: [
    {
      id: "noaa-ocean-sound",
      title: "Understanding Sound in the Ocean",
      url: "https://www.fisheries.noaa.gov/insight/understanding-sound-ocean",
      domain: "fisheries.noaa.gov",
    },
    {
      id: "epa-npdes-basics",
      title: "NPDES Permit Basics",
      url: "https://www.epa.gov/npdes/npdes-permit-basics",
      domain: "epa.gov",
    },
  ],
  conciseExplanation:
    "Protecting the ocean requires measurable operating limits, not a promise to be careful. Sound can alter animal behavior, and wastewater controls need explicit limits and monitoring. The difficult part is setting site-specific thresholds before construction and agreeing what happens when they are crossed.",
  uncertaintyNote:
    "These sources establish real sound and discharge risks, but they cannot predict impacts without a proposed site, design, species survey, and environmental baseline.",
} satisfies EvidenceBundle);

const EVIDENCE_BY_ROUTE_ID: Readonly<
  Record<SeededEvidenceRouteId, EvidenceBundle>
> = {
  "survive-pressure": PRESSURE_EVIDENCE,
  "design-habitat": HABITAT_EVIDENCE,
  "protect-ocean": ECOSYSTEM_EVIDENCE,
};

function isSeededEvidenceRouteId(
  routeId: string,
): routeId is SeededEvidenceRouteId {
  return routeId in EVIDENCE_BY_ROUTE_ID;
}

/**
 * Selects the reviewed, route-specific Evidence Lens for the canonical demo.
 * The function is deterministic and performs no mutation or I/O.
 */
export function seededEvidenceForRoute(
  route: Pick<ExplorationRoute, "id">,
): EvidenceBundle {
  if (!isSeededEvidenceRouteId(route.id)) {
    throw new Error(`No seeded Evidence Lens exists for route "${route.id}".`);
  }

  return EVIDENCE_BY_ROUTE_ID[route.id];
}
