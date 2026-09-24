/**
 * Demo dataset — "Farm A → Gin A → Spinning Mill A → Knitting A → Dye House A → Garment Factory A → Brand A"
 * Every lot, transfer and certificate is created through the real smart contracts,
 * so the resulting ledger is fully verifiable. A handful of irregularities are
 * planted on purpose so the AI layer has something to find.
 *
 *   npm run db:seed   (locally)   ·   POST /api/setup   (on Vercel)
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { ensureGenesis, sha256, merkleRoot, canonical } from "@/lib/chain/ledger";
import {
  anchorDocument,
  anchorSensorBatch,
  certifyLot,
  createLot,
  publishPassport,
  recordEvent,
  respondTransfer,
  transferLot,
  type Actor,
} from "@/lib/chain/contracts";
import { ORG_TYPES, type OrgType } from "@/lib/domain";
import { simulateReadings } from "@/lib/iot";
import { runAnomalyScan } from "@/lib/ai/detector";
import { clearStorage, saveFile } from "@/lib/storage";

const PASSWORD = "cotton123";
let now = Date.now();
const D = (days: number, hour = 10, minute = 0) => {
  const d = new Date(now - days * 86400e3);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const ORGS = [
  { key: "NET", name: "CottonTrace Consortium", type: "AUDITOR", code: "NET-OPS", msp: "ConsortiumMSP", city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714, certs: [] },
  { key: "FARM_A", name: "Shivam Organic Farm", type: "FARM", code: "FARM-A", msp: "ShivamFarmMSP", city: "Rajkot", state: "Gujarat", lat: 22.2587, lng: 70.7729, certs: ["NPOP Organic", "Regenerative Agriculture Pilot"] },
  { key: "FARM_B", name: "Vidarbha Growers Collective", type: "FARM", code: "FARM-B", msp: "VidarbhaFarmMSP", city: "Yavatmal", state: "Maharashtra", lat: 20.3888, lng: 78.1204, certs: [] },
  { key: "GIN", name: "Kadi Ginning & Pressing Co.", type: "GIN", code: "GIN-A", msp: "KadiGinMSP", city: "Kadi", state: "Gujarat", lat: 23.2986, lng: 72.3317, certs: ["ISO 9001"] },
  { key: "SPIN", name: "Kovai Spinning Mills", type: "SPINNING_MILL", code: "SPIN-A", msp: "KovaiSpinMSP", city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558, certs: ["ISO 14001", "Organic Chain-of-Custody"] },
  { key: "WEAVE", name: "Noyyal Knit Fabrics", type: "WEAVING_UNIT", code: "KNIT-A", msp: "NoyyalKnitMSP", city: "Tiruppur", state: "Tamil Nadu", lat: 11.1085, lng: 77.3411, certs: ["Organic Chain-of-Custody"] },
  { key: "DYE", name: "Bhavani Natural Dye House", type: "DYEING_UNIT", code: "DYE-A", msp: "BhavaniDyeMSP", city: "Erode", state: "Tamil Nadu", lat: 11.341, lng: 77.7172, certs: ["Zero Liquid Discharge", "Restricted Substances Compliant"] },
  { key: "SEW", name: "Garden City Apparel", type: "GARMENT_FACTORY", code: "SEW-A", msp: "GardenCitySewMSP", city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946, certs: ["Social Compliance Audit", "Fair Wage Verified"] },
  { key: "BRAND", name: "Kapas & Co.", type: "BRAND", code: "BRAND-A", msp: "KapasBrandMSP", city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777, certs: [] },
  { key: "AUDIT", name: "IndiCert Textile Assurance", type: "AUDITOR", code: "AUDIT-A", msp: "IndiCertMSP", city: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.209, certs: ["Accredited Certification Body"] },
] as const;

const USERS = [
  { email: "admin@cottontrace.dev", name: "Aarav Mehta", org: "NET", role: "ADMIN" },
  { email: "farmer@cottontrace.dev", name: "Ramesh Patel", org: "FARM_A" },
  { email: "farmer2@cottontrace.dev", name: "Sunita Wankhede", org: "FARM_B" },
  { email: "gin@cottontrace.dev", name: "Hitesh Shah", org: "GIN" },
  { email: "spinner@cottontrace.dev", name: "Karthik Subramanian", org: "SPIN" },
  { email: "weaver@cottontrace.dev", name: "Lakshmi Narayanan", org: "WEAVE" },
  { email: "dyer@cottontrace.dev", name: "Senthil Kumar", org: "DYE" },
  { email: "factory@cottontrace.dev", name: "Priya Rao", org: "SEW" },
  { email: "brand@cottontrace.dev", name: "Ananya Kapoor", org: "BRAND" },
  { email: "auditor@cottontrace.dev", name: "Vikram Singh", org: "AUDIT" },
] as const;

type OrgKey = (typeof ORGS)[number]["key"];

async function reset() {
  // Children first
  await prisma.passport.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.device.deleteMany();
  await prisma.document.deleteMany();
  await prisma.traceEvent.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.lotLink.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.field.deleteMany();
  await prisma.ledgerTx.deleteMany();
  await prisma.block.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.demoBackup.deleteMany();
  await clearStorage();
}

let logger: (msg: string) => void = console.log;

async function quiet<T>(p: Promise<T>) {
  try {
    await p;
  } catch (e) {
    logger(`   ↳ rejected as expected: ${(e as Error).message}`);
  }
}

export async function seedDemo(log: (msg: string) => void = console.log) {
  logger = log;
  now = Date.now();
  log("🌱 Resetting database…");
  await reset();

  // ── Organisations & users ─────────────────────────────────────────────
  const org: Record<OrgKey, { id: string; type: OrgType; msp: string }> = {} as never;
  for (const o of ORGS) {
    const row = await prisma.organization.create({
      data: {
        name: o.name,
        type: o.type,
        code: o.code,
        mspId: o.msp,
        city: o.city,
        state: o.state,
        lat: o.lat,
        lng: o.lng,
        certifications: JSON.stringify(o.certs),
        createdAt: D(90),
      },
    });
    org[o.key] = { id: row.id, type: o.type as OrgType, msp: o.msp };
  }

  const hash = await hashPassword(PASSWORD);
  const actor: Record<OrgKey, Actor> = {} as never;
  for (const u of USERS) {
    const id = randomUUID();
    const o = org[u.org];
    const role = "role" in u ? u.role : ORG_TYPES[o.type].role;
    await prisma.user.create({
      data: { id, email: u.email, name: u.name, emailVerified: true, role, organizationId: o.id, createdAt: D(90) },
    });
    await prisma.account.create({
      data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash },
    });
    if (!actor[u.org]) actor[u.org] = { userId: id, orgId: o.id, orgType: o.type, msp: o.msp, role: role as Actor["role"] };
  }

  log("⛓  Genesis block…");
  await ensureGenesis(ORGS.map((o) => o.msp), D(90));

  // ── Fields ────────────────────────────────────────────────────────────
  const fieldA1 = await prisma.field.create({ data: { code: "F-A1", name: "North Plot", areaHa: 4.2, soilType: "Black cotton soil (Vertisol)", irrigation: "Drip", lat: 22.268, lng: 70.765, orgId: org.FARM_A.id } });
  const fieldA2 = await prisma.field.create({ data: { code: "F-A2", name: "Well Plot", areaHa: 2.8, soilType: "Black cotton soil (Vertisol)", irrigation: "Drip", lat: 22.251, lng: 70.781, orgId: org.FARM_A.id } });
  const fieldB1 = await prisma.field.create({ data: { code: "F-B1", name: "Kharif Field 7", areaHa: 5.0, soilType: "Medium black soil", irrigation: "Rain-fed + furrow", lat: 20.395, lng: 78.13, orgId: org.FARM_B.id } });

  // Device registry & raw readings are off-chain; they are created up front and anchored later.
  log("📡 IoT devices & readings…");
  const device = async (d: { code: string; name: string; hardware: string; metrics: string[]; org: OrgKey; lotKey?: string; fieldId?: string; days: number; every: number; endDaysAgo: number; spike?: boolean }) => {
    const o = ORGS.find((x) => x.key === d.org)!;
    const row = await prisma.device.create({
      data: {
        code: d.code,
        name: d.name,
        hardware: d.hardware,
        metrics: JSON.stringify(d.metrics),
        apiKey: `ctk_demo_${d.code.toLowerCase().replace(/-/g, "_")}`,
        topic: `cottontrace/${o.code.toLowerCase()}/${d.code.toLowerCase()}`,
        orgId: org[d.org].id,
        fieldId: d.fieldId ?? null,
        lastSeenAt: D(d.endDaysAgo, 18),
        createdAt: D(d.endDaysAgo + d.days),
      },
    });
    const count = Math.round((d.days * 24 * 60) / d.every);
    const readings = simulateReadings({ metrics: d.metrics, orgType: o.type, count, end: D(d.endDaysAgo, 18), intervalMin: d.every, spikeAt: d.spike ? Math.floor(count * 0.7) : null });
    await prisma.sensorReading.createMany({ data: readings.map((r) => ({ ...r, deviceId: row.id })) });
    return { row, readings };
  };
  /** Link a device (and its readings) to the lot it monitors once that lot exists. */
  const bindDevice = async (code: string, lotId: string) => {
    const dev = await prisma.device.update({ where: { code }, data: { lotId } });
    await prisma.sensorReading.updateMany({ where: { deviceId: dev.id }, data: { lotId } });
  };
  const farmProbe = await device({ code: "ESP-FARMA-001", name: "North Plot soil probe", hardware: "ESP32", metrics: ["SOIL_MOISTURE", "TEMPERATURE", "HUMIDITY", "WATER"], org: "FARM_A", fieldId: fieldA1.id, days: 50, every: 180, endDaysAgo: 25 });
  await device({ code: "ESP-FARMB-002", name: "Field 7 weather node", hardware: "ESP32", metrics: ["SOIL_MOISTURE", "TEMPERATURE"], org: "FARM_B", fieldId: fieldB1.id, days: 30, every: 180, endDaysAgo: 24, spike: true });
  await device({ code: "ESP-GIN-003", name: "Bale warehouse climate", hardware: "ESP32", metrics: ["TEMPERATURE", "HUMIDITY"], org: "GIN", days: 2, every: 60, endDaysAgo: 18 });
  await device({ code: "RPI-SPIN-004", name: "Ring frame RF-12 energy meter", hardware: "RASPBERRY_PI", metrics: ["ENERGY", "HUMIDITY"], org: "SPIN", days: 1, every: 30, endDaysAgo: 15 });
  await device({ code: "RPI-DYE-005", name: "Indigo vat line meter", hardware: "RASPBERRY_PI", metrics: ["WATER", "ENERGY", "TEMPERATURE"], org: "DYE", days: 1, every: 20, endDaysAgo: 9 });

  const doc = async (a: Actor, lotId: string, name: string, kind: string, body: string, at: Date) => {
    const bytes = Buffer.from(body);
    const storagePath = await saveFile(name, bytes, "text/plain");
    await anchorDocument(a, { lotId, name, kind, sha256: sha256(bytes), size: bytes.length, mimeType: "text/plain", storagePath }, { at });
  };
  const organicCert = `SCOPE CERTIFICATE — NPOP ORGANIC\nOperator: Shivam Organic Farm, Rajkot, Gujarat\nFields: F-A1 (4.2 ha), F-A2 (2.8 ha)\nCrop: Cotton (Shankar-6)\nValid: Kharif 2026\nIssued by: IndiCert Textile Assurance\nCertificate no.: IC-NPOP-26-01187\n`;

  // ── Everything below runs in chronological order so blocks read like a diary ──
  log("🌾 Farm: seed lots & cultivation…");
  const seed1 = (await createLot(actor.FARM_A, {
    type: "SEED_LOT", name: "Shankar-6 organic seed — North Plot", quantity: 18, season: "Kharif 2026", fieldId: fieldA1.id, inputs: [],
    attributes: { variety: "Shankar-6", supplier: "Gujarat State Seeds Corp.", germination: 92, organic: true, sowingDate: D(78).toISOString().slice(0, 10) },
  }, { at: D(80, 10) })).result;
  const seed2 = (await createLot(actor.FARM_A, {
    type: "SEED_LOT", name: "Shankar-6 organic seed — Well Plot", quantity: 12, season: "Kharif 2026", fieldId: fieldA2.id, inputs: [],
    attributes: { variety: "Shankar-6", supplier: "Gujarat State Seeds Corp.", germination: 90, organic: true, sowingDate: D(77).toISOString().slice(0, 10) },
  }, { at: D(80, 12) })).result;
  await bindDevice("ESP-FARMA-001", seed1.id);
  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "SOWING", title: "Sowing completed", data: { spacing: "90 × 60 cm", method: "Dibbling" } }, { at: D(78, 8) });
  await recordEvent(actor.FARM_A, { lotId: seed2.id, type: "SOWING", title: "Sowing completed", data: { spacing: "90 × 60 cm", method: "Dibbling" } }, { at: D(77, 8) });

  const seedB = { variety: "RCH-659 Bt", supplier: "Private hybrid dealer", germination: 88, organic: false, sowingDate: D(74).toISOString().slice(0, 10) };
  const seed3 = (await createLot(actor.FARM_B, {
    type: "SEED_LOT", name: "RCH-659 hybrid seed — Field 7", quantity: 22, season: "Kharif 2026", fieldId: fieldB1.id, inputs: [], attributes: seedB,
  }, { at: D(76, 10) })).result;
  await bindDevice("ESP-FARMB-002", seed3.id);
  // planted: duplicate registration two hours later
  await createLot(actor.FARM_B, {
    type: "SEED_LOT", name: "RCH-659 hybrid seed — Field 7", quantity: 22, season: "Kharif 2026", fieldId: fieldB1.id, inputs: [], attributes: seedB,
  }, { at: D(76, 12) });
  await recordEvent(actor.FARM_B, { lotId: seed3.id, type: "SOWING", title: "Sowing completed", data: { spacing: "120 × 45 cm", method: "Seed drill" } }, { at: D(74, 8) });

  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "IRRIGATION", title: "Drip irrigation cycle", data: { durationH: 6, source: "Borewell" } }, { at: D(66, 7) });
  await certifyLot(actor.AUDIT, { lotId: seed1.id, standard: "NPOP Organic — Scope Certificate", note: "Field inspection complete; soil residue test clean" }, { at: D(60, 15) });
  await doc(actor.AUDIT, seed1.id, "NPOP_Scope_Certificate_FarmA.txt", "CERTIFICATE", organicCert, D(60, 16));
  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "FERTILISER", title: "Vermicompost + jeevamrut applied", data: { input: "Organic", kgPerHa: 2500 } }, { at: D(58, 9) });
  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "IRRIGATION", title: "Drip irrigation cycle", data: { durationH: 6, source: "Borewell" } }, { at: D(52, 7) });
  await recordEvent(actor.FARM_B, { lotId: seed3.id, type: "FERTILISER", title: "Urea top-dressing", data: { input: "Synthetic", kgPerHa: 120 } }, { at: D(50, 9) });
  await recordEvent(actor.FARM_A, { lotId: seed2.id, type: "IRRIGATION", title: "Drip irrigation cycle", data: { durationH: 5, source: "Open well" } }, { at: D(45, 7) });
  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "IRRIGATION", title: "Drip irrigation cycle", data: { durationH: 6, source: "Borewell" } }, { at: D(40, 7) });
  await recordEvent(actor.FARM_A, { lotId: seed1.id, type: "IRRIGATION", title: "Drip irrigation cycle", data: { durationH: 4, source: "Borewell" } }, { at: D(31, 7) });

  log("🧺 Harvest…");
  const hrv1 = (await createLot(actor.FARM_A, {
    type: "HARVEST_LOT", name: "First picking — North Plot", quantity: 6100, season: "Kharif 2026", fieldId: fieldA1.id,
    inputs: [{ lotId: seed1.id, quantity: 18 }],
    attributes: { harvestDate: D(24).toISOString().slice(0, 10), picking: "Hand-picked", moisture: 8.5, trash: 2.1 },
  }, { at: D(24, 16) })).result;
  const hrv2 = (await createLot(actor.FARM_A, {
    type: "HARVEST_LOT", name: "First picking — Well Plot", quantity: 4000, season: "Kharif 2026", fieldId: fieldA2.id,
    inputs: [{ lotId: seed2.id, quantity: 6 }],
    attributes: { harvestDate: D(24).toISOString().slice(0, 10), picking: "Hand-picked", moisture: 8.9, trash: 2.4 },
  }, { at: D(24, 17) })).result;
  const leaves = farmProbe.readings.map((r) => sha256(canonical({ m: r.metric, v: r.value, t: r.recordedAt.toISOString() })));
  await anchorSensorBatch(actor.FARM_A, { deviceCode: "ESP-FARMA-001", count: leaves.length, merkleRoot: merkleRoot(leaves), from: farmProbe.readings[0].recordedAt, to: farmProbe.readings.at(-1)!.recordedAt }, { at: D(24, 19) });
  // planted: implausibly high yield per hectare
  const hrv3 = (await createLot(actor.FARM_B, {
    type: "HARVEST_LOT", name: "Main picking — Field 7", quantity: 13800, season: "Kharif 2026", fieldId: fieldB1.id,
    inputs: [{ lotId: seed3.id, quantity: 22 }],
    attributes: { harvestDate: D(23).toISOString().slice(0, 10), picking: "Hand-picked", moisture: 10.2, trash: 3.8 },
  }, { at: D(23, 15) })).result;

  log("🚚 Farm → Gin handoffs…");
  const t1 = (await transferLot(actor.FARM_A, { lotId: hrv1.id, toOrgId: org.GIN.id, quantity: 6100, note: "Truck GJ-03-AX-4471" }, { at: D(22, 9) })).result;
  const t2 = (await transferLot(actor.FARM_A, { lotId: hrv2.id, toOrgId: org.GIN.id, quantity: 4000, note: "Truck GJ-03-AX-4471" }, { at: D(22, 9, 20) })).result;
  const t3 = (await transferLot(actor.FARM_B, { lotId: hrv3.id, toOrgId: org.GIN.id, quantity: 9000, note: "Rail rake via Wardha" }, { at: D(22, 11) })).result;
  // planted: Farm B re-uses Farm A's organic certificate on its harvest
  await doc(actor.FARM_B, hrv3.id, "Organic_Certificate.txt", "CERTIFICATE", organicCert, D(22, 12));
  await respondTransfer(actor.GIN, { transferId: t1.id, action: "ACCEPT" }, { at: D(21, 10) });
  await respondTransfer(actor.GIN, { transferId: t2.id, action: "ACCEPT" }, { at: D(21, 10, 20) });
  const r3 = (await respondTransfer(actor.GIN, { transferId: t3.id, action: "ACCEPT" }, { at: D(21, 14) })).result;

  log("⚙️  Ginning…");
  await quiet(transferLot(actor.FARM_A, { lotId: "does-not-exist", toOrgId: org.GIN.id, quantity: 500 }, { at: D(20, 13) }));
  const bale1 = (await createLot(actor.GIN, {
    type: "BALE", name: "Organic lint — press run 14", quantity: 3535,
    inputs: [{ lotId: hrv1.id, quantity: 6100 }, { lotId: hrv2.id, quantity: 4000 }],
    attributes: { grade: "Shankar-6", staple: 29.5, micronaire: 4.1, strength: 29.8, moisture: 7.6, baleCount: 21 },
  }, { at: D(20, 15) })).result;
  await bindDevice("ESP-GIN-003", bale1.id);
  await quiet(createLot(actor.GIN, { type: "BALE", name: "Over-declared press run", quantity: 5000, inputs: [{ lotId: r3.lotId, quantity: 9000 }], attributes: { grade: "S-6" } }, { at: D(19, 9) }));
  await recordEvent(actor.GIN, { lotId: bale1.id, type: "QUALITY_TEST", title: "HVI test — all bales passed", data: { uhml: 29.5, mic: 4.1, strength: 29.8, sfi: 8.2 } }, { at: D(19, 11) });
  await doc(actor.GIN, bale1.id, "HVI_Lab_Report_press_run_14.txt", "LAB_REPORT", `HVI LAB REPORT\nPress run 14 — 21 bales\nUHML 29.5 mm | Mic 4.1 | Str 29.8 g/tex | SFI 8.2 | Rd 78 | +b 8.9\nResult: PASS\n`, D(19, 12));
  // planted: outturn far above physical norm & no quality test
  const bale2 = (await createLot(actor.GIN, {
    type: "BALE", name: "Conventional lint — press run 15", quantity: 3870,
    inputs: [{ lotId: r3.lotId, quantity: 9000 }],
    attributes: { grade: "J-34", staple: 27, micronaire: 4.6, strength: 27.1, moisture: 8.4, baleCount: 23 },
  }, { at: D(19, 16) })).result;

  log("🧵 Spinning…");
  const t4 = (await transferLot(actor.GIN, { lotId: bale1.id, toOrgId: org.SPIN.id, quantity: 3535 }, { at: D(18, 9) })).result;
  const t5 = (await transferLot(actor.GIN, { lotId: bale2.id, toOrgId: org.SPIN.id, quantity: 3870 }, { at: D(18, 9, 20) })).result;
  await certifyLot(actor.AUDIT, { lotId: bale1.id, standard: "Organic Content Standard — Transaction Certificate", note: "Segregated press run verified" }, { at: D(18, 16) });
  await respondTransfer(actor.SPIN, { transferId: t4.id, action: "ACCEPT" }, { at: D(17, 12) });
  await respondTransfer(actor.SPIN, { transferId: t5.id, action: "ACCEPT" }, { at: D(17, 12, 20) });
  const fib1 = (await createLot(actor.SPIN, {
    type: "FIBRE_LOT", name: "Organic mixing — laydown 88", quantity: 3290,
    inputs: [{ lotId: bale1.id, quantity: 3535 }],
    attributes: { mixing: "100% organic Shankar-6", blowroom: "Line B", cleaning: 93 },
  }, { at: D(16, 10) })).result;
  const yrn1 = (await createLot(actor.SPIN, {
    type: "YARN_LOT", name: "Ne 30s combed compact — organic", quantity: 2830,
    inputs: [{ lotId: fib1.id, quantity: 3290 }],
    attributes: { count: "Ne 30s", method: "Compact", tpi: 19.2, csp: 2650, machine: "Ring frame RF-12" },
  }, { at: D(15, 18) })).result;
  await bindDevice("RPI-SPIN-004", yrn1.id);
  await recordEvent(actor.SPIN, { lotId: yrn1.id, type: "QUALITY_TEST", title: "Uster evenness test", data: { um: 9.8, thin: 2, thick: 18, neps: 35 } }, { at: D(15, 20) });
  await doc(actor.SPIN, yrn1.id, "Uster_Test_Ne30_compact.txt", "LAB_REPORT", `USTER TESTER REPORT\nNe 30s compact combed\nU% 9.8 | Thin(-50%) 2 | Thick(+50%) 18 | Neps(+200%) 35 | CSP 2650\n`, D(15, 21));

  log("🧶 Knitting…");
  const t6 = (await transferLot(actor.SPIN, { lotId: yrn1.id, toOrgId: org.WEAVE.id, quantity: 2000, note: "400 cones" }, { at: D(14, 9) })).result;
  const r6 = (await respondTransfer(actor.WEAVE, { transferId: t6.id, action: "ACCEPT" }, { at: D(13, 11) })).result;
  await quiet(transferLot(actor.SPIN, { lotId: yrn1.id, toOrgId: org.BRAND.id, quantity: 100 }, { at: D(13, 16) }));
  const fab1 = (await createLot(actor.WEAVE, {
    type: "FABRIC_ROLL", name: "Single jersey 180 GSM — organic", quantity: 1900,
    inputs: [{ lotId: r6.lotId, quantity: 2000 }],
    attributes: { construction: "Single Jersey", gsm: 180, width: 180, length: 5860, machine: "Circular knitting machine 30in" },
  }, { at: D(12, 17) })).result;
  await quiet(certifyLot(actor.WEAVE, { lotId: fab1.id, standard: "Self-declared organic" }, { at: D(12, 19) }));

  log("🎨 Dyeing…");
  const t7 = (await transferLot(actor.WEAVE, { lotId: fab1.id, toOrgId: org.DYE.id, quantity: 1900 }, { at: D(11, 9) })).result;
  await respondTransfer(actor.DYE, { transferId: t7.id, action: "ACCEPT" }, { at: D(10, 9) });
  // remaining Farm B cotton — shipment that is never accepted (stale)
  await transferLot(actor.FARM_B, { lotId: hrv3.id, toOrgId: org.GIN.id, quantity: 4800, note: "Second rake" }, { at: D(9, 10) });
  const dye1 = (await createLot(actor.DYE, {
    type: "DYED_FABRIC", name: "Indigo Night — natural indigo vat", quantity: 1850,
    inputs: [{ lotId: fab1.id, quantity: 1900 }],
    attributes: { dyeClass: "Natural (indigo)", shade: "Indigo Night", shadeHex: "#27336b", waterL: 38000, energyKwh: 2600, fastness: "Grade 4-5" },
  }, { at: D(9, 18) })).result;
  await bindDevice("RPI-DYE-005", dye1.id);
  await recordEvent(actor.DYE, { lotId: dye1.id, type: "QUALITY_TEST", title: "Colour fastness & shrinkage test", data: { washFastness: "4-5", rubbing: "4", shrinkage: "3.1%" } }, { at: D(9, 20) });
  await doc(actor.DYE, dye1.id, "Dye_Recipe_and_Wastewater_Test.txt", "INSPECTION", `DYE RECIPE — INDIGO NIGHT\nNatural indigo 3.2% owf, fermentation vat, 6 dips\nWastewater: COD 118 mg/L, BOD 22 mg/L, pH 7.4 — within ZLD limits\n`, D(9, 21));

  log("👕 Garment manufacturing…");
  const t8 = (await transferLot(actor.DYE, { lotId: dye1.id, toOrgId: org.SEW.id, quantity: 1850 }, { at: D(8, 9) })).result;
  await respondTransfer(actor.SEW, { transferId: t8.id, action: "ACCEPT" }, { at: D(7, 10) });
  const gar1 = (await createLot(actor.SEW, {
    type: "GARMENT_BATCH", name: "The Everyday Indigo Tee", quantity: 7500,
    inputs: [{ lotId: dye1.id, quantity: 1850 }],
    attributes: { style: "Crew-neck T-shirt", sizes: "XS, S, M, L, XL", weightPerPiece: 0.19, qcPass: 97.8, stitching: "Twin-needle hem, taped shoulders" },
  }, { at: D(6, 18) })).result;
  await recordEvent(actor.SEW, { lotId: gar1.id, type: "QUALITY_TEST", title: "AQL 2.5 final inspection passed", data: { sampled: 315, defects: 4, aql: "2.5" } }, { at: D(6, 20) });
  await doc(actor.SEW, gar1.id, "Final_QC_Inspection_AQL.txt", "INSPECTION", `FINAL INSPECTION REPORT\nStyle: Crew-neck tee | Qty 7,500\nAQL 2.5 — sampled 315 — major 2, minor 2 — ACCEPTED\n`, D(6, 21));
  await certifyLot(actor.AUDIT, { lotId: gar1.id, standard: "Social & Environmental Compliance Audit", note: "Wages, working hours and chemical inventory reviewed" }, { at: D(5, 15) });

  // Farm A's second picking — still on the farm, ready for a live handoff demo
  await createLot(actor.FARM_A, {
    type: "HARVEST_LOT", name: "Second picking — Well Plot", quantity: 1650, season: "Kharif 2026", fieldId: fieldA2.id,
    inputs: [{ lotId: seed2.id, quantity: 6 }],
    attributes: { harvestDate: D(5).toISOString().slice(0, 10), picking: "Hand-picked", moisture: 9.1, trash: 2.6 },
  }, { at: D(5, 16) });

  log("🏷  Brand receives garments & publishes passport…");
  const t9 = (await transferLot(actor.SEW, { lotId: gar1.id, toOrgId: org.BRAND.id, quantity: 5000, note: "Retail allocation — AW26" }, { at: D(4, 9) })).result;
  const r9 = (await respondTransfer(actor.BRAND, { transferId: t9.id, action: "ACCEPT" }, { at: D(3, 12) })).result;
  await publishPassport(actor.BRAND, {
    lotId: r9.lotId,
    productName: "The Everyday Indigo Tee",
    style: "Crew-neck T-shirt · Regular fit",
    colorName: "Indigo Night",
    colorHex: "#27336b",
    sizes: "XS – XL",
    description: "A 180 GSM organic single-jersey tee, hand-picked in Saurashtra, spun in Coimbatore, knitted in Tiruppur and vat-dyed with natural indigo in Erode.",
    care: ["Machine wash cold, inside out", "Wash with similar colours", "Line dry in shade", "Warm iron on reverse", "Do not bleach"],
    endOfLife: "Return it to any Kapas & Co. store for fibre-to-fibre recycling. 100% cotton with no elastane, so it can be mechanically recycled or composted once the label is removed.",
  }, { at: D(2, 11), publicId: "KAPAS-TEE-001" });

  // More yarn on its way to the knitter — accept it live in the demo
  await transferLot(actor.SPIN, { lotId: yrn1.id, toOrgId: org.WEAVE.id, quantity: 500, note: "100 cones — repeat order" }, { at: D(1, 11) });

  log("🤖 Running anomaly scan…");
  const scan = await runAnomalyScan();
  const dupDoc = await prisma.anomaly.findFirst({ where: { kind: "DUPLICATE_DOCUMENT" } });
  if (dupDoc)
    await prisma.anomaly.update({
      where: { id: dupDoc.id },
      data: { status: "CONFIRMED", reviewNote: "Certificate belongs to Farm A. Farm B notified; organic claim withdrawn.", reviewedById: actor.AUDIT.userId, reviewedAt: D(1) },
    });

  const blocks = await prisma.block.count();
  log(`\n✅ Seeded ${blocks} blocks, ${await prisma.lot.count()} lots, ${scan.total} anomalies.`);
  log(`   Sign in with any demo account — password: ${PASSWORD}`);
  log(`   Public passport: /p/KAPAS-TEE-001\n`);
  return { blocks, lots: await prisma.lot.count(), anomalies: scan.total };
}

