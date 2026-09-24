// Core domain vocabulary shared by the UI, smart contracts, AI engine and seed script.

export type OrgType =
  | "FARM"
  | "GIN"
  | "SPINNING_MILL"
  | "WEAVING_UNIT"
  | "DYEING_UNIT"
  | "GARMENT_FACTORY"
  | "BRAND"
  | "AUDITOR";

export type Role =
  | "FARMER"
  | "GINNER"
  | "SPINNER"
  | "WEAVER"
  | "DYER"
  | "MANUFACTURER"
  | "BRAND"
  | "AUDITOR"
  | "ADMIN"
  | "PENDING";

export type LotType =
  | "SEED_LOT"
  | "HARVEST_LOT"
  | "BALE"
  | "FIBRE_LOT"
  | "YARN_LOT"
  | "FABRIC_ROLL"
  | "DYED_FABRIC"
  | "GARMENT_BATCH";

export const ORG_TYPES: Record<
  OrgType,
  { label: string; role: Role; short: string; color: string; blurb: string }
> = {
  FARM: { label: "Cotton Farm", role: "FARMER", short: "Farm", color: "#5B7B3A", blurb: "Registers seed, fields & harvests" },
  GIN: { label: "Ginning Unit", role: "GINNER", short: "Gin", color: "#C08A1E", blurb: "Separates lint & presses bales" },
  SPINNING_MILL: { label: "Spinning Mill", role: "SPINNER", short: "Spin", color: "#B5652B", blurb: "Blends fibre & spins yarn" },
  WEAVING_UNIT: { label: "Weaving / Knitting", role: "WEAVER", short: "Weave", color: "#8C3B2E", blurb: "Turns yarn into fabric rolls" },
  DYEING_UNIT: { label: "Dyeing & Finishing", role: "DYER", short: "Dye", color: "#2E3F8F", blurb: "Colours & finishes fabric" },
  GARMENT_FACTORY: { label: "Garment Factory", role: "MANUFACTURER", short: "Sew", color: "#5A3A7A", blurb: "Cuts, sews & inspects garments" },
  BRAND: { label: "Brand / Retailer", role: "BRAND", short: "Brand", color: "#1B1A17", blurb: "Publishes product passports" },
  AUDITOR: { label: "Auditor / Certifier", role: "AUDITOR", short: "Audit", color: "#0F6B63", blurb: "Verifies, certifies & reviews" },
};

export const ROLE_LABEL: Record<Role, string> = {
  FARMER: "Farmer",
  GINNER: "Ginner",
  SPINNER: "Spinner",
  WEAVER: "Weaver",
  DYER: "Dyer",
  MANUFACTURER: "Manufacturer",
  BRAND: "Brand Manager",
  AUDITOR: "Auditor",
  ADMIN: "Network Admin",
  PENDING: "Pending",
};

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "boolean" | "color";
  options?: string[];
  unit?: string;
  placeholder?: string;
  required?: boolean;
};

export type LotTypeDef = {
  label: string;
  plural: string;
  prefix: string;
  unit: "kg" | "pcs";
  org: OrgType;
  inputs: LotType[];
  verb: string; // event type emitted on creation
  expectedYield?: number; // output mass / input mass
  maxYield?: number; // hard smart-contract limit
  minHours?: number; // minimum plausible processing duration
  stageIndex: number;
  color: string;
  attributes: FieldDef[];
};

export const LOT_TYPES: Record<LotType, LotTypeDef> = {
  SEED_LOT: {
    label: "Seed Lot",
    plural: "Seed lots",
    prefix: "SEED",
    unit: "kg",
    org: "FARM",
    inputs: [],
    verb: "REGISTERED",
    stageIndex: 0,
    color: "#7A8B3E",
    attributes: [
      { key: "variety", label: "Variety", type: "text", placeholder: "e.g. Shankar-6", required: true },
      { key: "supplier", label: "Seed supplier", type: "text", placeholder: "e.g. GSSC Seeds" },
      { key: "germination", label: "Germination rate", type: "number", unit: "%" },
      { key: "organic", label: "Organic seed", type: "boolean" },
      { key: "sowingDate", label: "Sowing date", type: "date" },
    ],
  },
  HARVEST_LOT: {
    label: "Harvest Lot",
    plural: "Harvest lots",
    prefix: "HRV",
    unit: "kg",
    org: "FARM",
    inputs: ["SEED_LOT"],
    verb: "HARVESTED",
    stageIndex: 1,
    color: "#5B7B3A",
    attributes: [
      { key: "harvestDate", label: "Harvest date", type: "date", required: true },
      { key: "picking", label: "Picking method", type: "select", options: ["Hand-picked", "Machine-picked"] },
      { key: "moisture", label: "Moisture", type: "number", unit: "%" },
      { key: "trash", label: "Trash content", type: "number", unit: "%" },
    ],
  },
  BALE: {
    label: "Cotton Bale",
    plural: "Bales",
    prefix: "BALE",
    unit: "kg",
    org: "GIN",
    inputs: ["HARVEST_LOT"],
    verb: "GINNED",
    expectedYield: 0.35,
    maxYield: 0.45,
    minHours: 2,
    stageIndex: 2,
    color: "#C08A1E",
    attributes: [
      { key: "grade", label: "Grade", type: "select", options: ["S-6", "J-34", "MCU-5", "DCH-32", "Shankar-6"] },
      { key: "staple", label: "Staple length", type: "number", unit: "mm" },
      { key: "micronaire", label: "Micronaire", type: "number" },
      { key: "strength", label: "Strength", type: "number", unit: "g/tex" },
      { key: "moisture", label: "Moisture", type: "number", unit: "%" },
      { key: "baleCount", label: "Number of bales", type: "number" },
    ],
  },
  FIBRE_LOT: {
    label: "Fibre Lot",
    plural: "Fibre lots",
    prefix: "FIB",
    unit: "kg",
    org: "SPINNING_MILL",
    inputs: ["BALE"],
    verb: "MIXED",
    expectedYield: 0.93,
    maxYield: 1.0,
    minHours: 1,
    stageIndex: 3,
    color: "#D09A5B",
    attributes: [
      { key: "mixing", label: "Mixing / blend recipe", type: "text", placeholder: "e.g. 100% S-6" },
      { key: "blowroom", label: "Blowroom line", type: "text" },
      { key: "cleaning", label: "Cleaning efficiency", type: "number", unit: "%" },
    ],
  },
  YARN_LOT: {
    label: "Yarn Lot",
    plural: "Yarn lots",
    prefix: "YRN",
    unit: "kg",
    org: "SPINNING_MILL",
    inputs: ["FIBRE_LOT"],
    verb: "SPUN",
    expectedYield: 0.86,
    maxYield: 0.98,
    minHours: 4,
    stageIndex: 4,
    color: "#B5652B",
    attributes: [
      { key: "count", label: "Yarn count", type: "select", options: ["Ne 20s", "Ne 30s", "Ne 40s", "Ne 60s"] },
      { key: "method", label: "Spinning method", type: "select", options: ["Ring (combed)", "Ring (carded)", "Compact", "Open-end"] },
      { key: "tpi", label: "Twist", type: "number", unit: "TPI" },
      { key: "csp", label: "CSP", type: "number" },
      { key: "machine", label: "Machine", type: "text" },
    ],
  },
  FABRIC_ROLL: {
    label: "Fabric Roll",
    plural: "Fabric rolls",
    prefix: "FAB",
    unit: "kg",
    org: "WEAVING_UNIT",
    inputs: ["YARN_LOT"],
    verb: "WOVEN",
    expectedYield: 0.95,
    maxYield: 1.0,
    minHours: 3,
    stageIndex: 5,
    color: "#8C3B2E",
    attributes: [
      { key: "construction", label: "Construction", type: "select", options: ["Single Jersey", "Rib", "Interlock", "Plain weave", "Twill"] },
      { key: "gsm", label: "GSM", type: "number", unit: "g/m²" },
      { key: "width", label: "Width", type: "number", unit: "cm" },
      { key: "length", label: "Length", type: "number", unit: "m" },
      { key: "machine", label: "Machine", type: "text" },
    ],
  },
  DYED_FABRIC: {
    label: "Dyed Fabric",
    plural: "Dyed fabric",
    prefix: "DYE",
    unit: "kg",
    org: "DYEING_UNIT",
    inputs: ["FABRIC_ROLL"],
    verb: "DYED",
    expectedYield: 0.97,
    maxYield: 1.03,
    minHours: 3,
    stageIndex: 6,
    color: "#2E3F8F",
    attributes: [
      { key: "dyeClass", label: "Dye class", type: "select", options: ["Reactive", "Vat", "Natural (indigo)", "Natural (madder)", "Pigment"] },
      { key: "shade", label: "Shade name", type: "text", placeholder: "e.g. Indigo Night" },
      { key: "shadeHex", label: "Shade colour", type: "color" },
      { key: "waterL", label: "Water used", type: "number", unit: "L" },
      { key: "energyKwh", label: "Energy used", type: "number", unit: "kWh" },
      { key: "fastness", label: "Colour fastness", type: "select", options: ["Grade 3", "Grade 4", "Grade 4-5", "Grade 5"] },
    ],
  },
  GARMENT_BATCH: {
    label: "Garment Batch",
    plural: "Garment batches",
    prefix: "GAR",
    unit: "pcs",
    org: "GARMENT_FACTORY",
    inputs: ["DYED_FABRIC", "FABRIC_ROLL"],
    verb: "MANUFACTURED",
    expectedYield: 0.8,
    maxYield: 0.95,
    minHours: 6,
    stageIndex: 7,
    color: "#5A3A7A",
    attributes: [
      { key: "style", label: "Style", type: "text", placeholder: "e.g. Crew-neck T-shirt", required: true },
      { key: "sizes", label: "Size run", type: "text", placeholder: "S, M, L, XL" },
      { key: "weightPerPiece", label: "Weight per piece", type: "number", unit: "kg" },
      { key: "qcPass", label: "QC pass rate", type: "number", unit: "%" },
      { key: "stitching", label: "Stitching", type: "text", placeholder: "Twin-needle hem" },
    ],
  },
};

export const LOT_ORDER: LotType[] = [
  "SEED_LOT",
  "HARVEST_LOT",
  "BALE",
  "FIBRE_LOT",
  "YARN_LOT",
  "FABRIC_ROLL",
  "DYED_FABRIC",
  "GARMENT_BATCH",
];

/** Which organisation types may receive a lot of a given type. */
export const TRANSFER_ROUTES: Record<LotType, OrgType[]> = {
  SEED_LOT: ["FARM"],
  HARVEST_LOT: ["GIN"],
  BALE: ["SPINNING_MILL"],
  FIBRE_LOT: ["SPINNING_MILL"],
  YARN_LOT: ["WEAVING_UNIT"],
  FABRIC_ROLL: ["DYEING_UNIT", "GARMENT_FACTORY"],
  DYED_FABRIC: ["GARMENT_FACTORY"],
  GARMENT_BATCH: ["BRAND"],
};

/** Stages shown on public journeys (seed → cloth). */
export const JOURNEY_STAGES = [
  { key: "FARM", title: "Seed & Farm", lot: ["SEED_LOT", "HARVEST_LOT"] as LotType[] },
  { key: "GIN", title: "Ginning", lot: ["BALE"] as LotType[] },
  { key: "SPINNING_MILL", title: "Spinning", lot: ["FIBRE_LOT", "YARN_LOT"] as LotType[] },
  { key: "WEAVING_UNIT", title: "Knitting", lot: ["FABRIC_ROLL"] as LotType[] },
  { key: "DYEING_UNIT", title: "Dyeing", lot: ["DYED_FABRIC"] as LotType[] },
  { key: "GARMENT_FACTORY", title: "Garment", lot: ["GARMENT_BATCH"] as LotType[] },
];

export const EVENT_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  SOWING: "Sowing",
  IRRIGATION: "Irrigation",
  FERTILISER: "Fertiliser applied",
  HARVESTED: "Harvested",
  GINNED: "Ginned",
  MIXED: "Blended",
  SPUN: "Spun",
  WOVEN: "Knitted / woven",
  DYED: "Dyed & finished",
  MANUFACTURED: "Manufactured",
  QUALITY_TEST: "Quality test",
  TRANSFER_SENT: "Transfer sent",
  TRANSFER_RECEIVED: "Transfer received",
  SPLIT: "Split",
  CERTIFIED: "Certified",
  DOCUMENT_ANCHORED: "Document anchored",
  PASSPORT_PUBLISHED: "Passport published",
  OBSERVATION: "Observation",
};

/** Manual events an owner may record against a lot, by lot type. */
export const MANUAL_EVENTS: Partial<Record<LotType, string[]>> = {
  SEED_LOT: ["SOWING", "IRRIGATION", "FERTILISER", "OBSERVATION"],
  HARVEST_LOT: ["QUALITY_TEST", "OBSERVATION"],
  BALE: ["QUALITY_TEST", "OBSERVATION"],
  FIBRE_LOT: ["QUALITY_TEST", "OBSERVATION"],
  YARN_LOT: ["QUALITY_TEST", "OBSERVATION"],
  FABRIC_ROLL: ["QUALITY_TEST", "OBSERVATION"],
  DYED_FABRIC: ["QUALITY_TEST", "OBSERVATION"],
  GARMENT_BATCH: ["QUALITY_TEST", "OBSERVATION"],
};

export const DOC_KINDS = ["CERTIFICATE", "LAB_REPORT", "INSPECTION", "PHOTO", "INVOICE", "OTHER"] as const;

export const METRICS: Record<string, { label: string; unit: string; min: number; max: number; color: string }> = {
  TEMPERATURE: { label: "Temperature", unit: "°C", min: -10, max: 60, color: "#B5412B" },
  HUMIDITY: { label: "Humidity", unit: "%", min: 0, max: 100, color: "#2E3F8F" },
  SOIL_MOISTURE: { label: "Soil moisture", unit: "%", min: 0, max: 100, color: "#5B7B3A" },
  WATER: { label: "Water flow", unit: "L", min: 0, max: 5000, color: "#0F6B63" },
  ENERGY: { label: "Energy", unit: "kWh", min: 0, max: 800, color: "#C08A1E" },
};

/** Mass of a lot in kg (garments convert via weight-per-piece). */
export function lotMassKg(lot: { type: string; quantity: number; attributes: string | Record<string, unknown> }, qty = lot.quantity) {
  if (lot.type !== "GARMENT_BATCH") return qty;
  const attrs = typeof lot.attributes === "string" ? safeJson(lot.attributes) : lot.attributes;
  const w = Number(attrs?.weightPerPiece) || 0.18;
  return qty * w;
}

export function safeJson<T = Record<string, unknown>>(s: string | null | undefined, fallback?: T): T {
  if (!s) return (fallback ?? {}) as T;
  try {
    return JSON.parse(s) as T;
  } catch {
    return (fallback ?? {}) as T;
  }
}

export function lotTypesForOrg(org: OrgType): LotType[] {
  return LOT_ORDER.filter((t) => LOT_TYPES[t].org === org);
}
