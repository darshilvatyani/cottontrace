/**
 * Anomaly-detection layer.
 *
 * As the report specifies, AI here is an *assistant*, not an authority: it
 * scores records that look unusual and queues them for a human auditor.
 * The engine blends deterministic domain rules with robust statistics
 * (median / MAD z-scores over peer groups) and maps the deviation onto a
 * 0‒1 anomaly score with a logistic curve.
 */
import { prisma } from "@/lib/prisma";
import { LOT_TYPES, METRICS, lotMassKg, safeJson, type LotType } from "@/lib/domain";

export type Finding = {
  fingerprint: string;
  kind: string;
  score: number;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  lotId?: string | null;
  orgId?: string | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mad = (xs: number[]) => {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
};

/** Logistic mapping: |z| = 2 → 0.5, |z| = 3 → ~0.86, |z| = 4 → ~0.97 */
export const scoreFromZ = (z: number) => 1 / (1 + Math.exp(-(Math.abs(z) - 2) * 1.8));

export function severityOf(score: number) {
  if (score >= 0.9) return "CRITICAL";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  return "LOW";
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export async function detectAnomalies(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const lots = await prisma.lot.findMany({
    include: {
      parents: { include: { parent: { include: { events: true } } } },
      events: true,
      field: true,
      owner: true,
      documents: true,
      passport: true,
    },
  });

  // ── 1. Transformation yield (mass balance) ──────────────────────────────
  const transformed = lots.filter(
    (l) => l.parents.length && l.parents.every((p) => p.parent.type !== l.type) && LOT_TYPES[l.type as LotType].expectedYield,
  );
  const ratios = new Map<string, { lot: (typeof lots)[number]; ratio: number; massIn: number; massOut: number }[]>();
  for (const l of transformed) {
    const massIn = l.parents.reduce((s, p) => s + lotMassKg(p.parent, p.quantity), 0);
    const massOut = lotMassKg(l);
    if (!massIn) continue;
    const arr = ratios.get(l.type) ?? [];
    arr.push({ lot: l, ratio: massOut / massIn, massIn, massOut });
    ratios.set(l.type, arr);
  }
  for (const [type, arr] of ratios) {
    const def = LOT_TYPES[type as LotType];
    const expected = def.expectedYield!;
    const peers = arr.map((a) => a.ratio);
    const usePeers = peers.length >= 5;
    const centre = usePeers ? median(peers) : expected;
    const spread = usePeers ? Math.max(1.4826 * mad(peers), expected * 0.04) : expected * 0.07;
    for (const a of arr) {
      const z = (a.ratio - centre) / spread;
      const score = scoreFromZ(z);
      if (score < 0.5) continue;
      findings.push({
        fingerprint: `YIELD:${a.lot.id}`,
        kind: "YIELD_RATIO",
        score,
        lotId: a.lot.id,
        orgId: a.lot.creatorId,
        title: `${z > 0 ? "Unusually high" : "Unusually low"} ${def.label.toLowerCase()} yield`,
        detail: `${a.lot.code} converted ${a.massIn.toFixed(1)} kg of input into ${a.massOut.toFixed(1)} kg (${pct(a.ratio)}). The ${usePeers ? "peer median" : "expected"} yield is ${pct(centre)} — z = ${z.toFixed(2)}.`,
        evidence: { ratio: a.ratio, expected, centre, z, massIn: a.massIn, massOut: a.massOut, peers: peers.length },
      });
    }
  }

  // ── 2. Harvest productivity & quantity outliers ─────────────────────────
  for (const l of lots.filter((l) => l.type === "HARVEST_LOT" && l.field && !l.code.includes("-S"))) {
    const perHa = l.quantity / l.field!.areaHa;
    const z = (perHa - 1500) / 450; // seed-cotton benchmark for irrigated Indian farms
    if (z > 2) {
      findings.push({
        fingerprint: `YIELDHA:${l.id}`,
        kind: "QUANTITY_OUTLIER",
        score: scoreFromZ(z),
        lotId: l.id,
        orgId: l.creatorId,
        title: "Harvest exceeds plausible field productivity",
        detail: `${l.code} reports ${Math.round(perHa)} kg/ha from ${l.field!.name} (${l.field!.areaHa} ha). Typical irrigated yield is ~1,500 kg/ha — possible over-declaration or mixing with undeclared cotton.`,
        evidence: { perHa, areaHa: l.field!.areaHa, quantity: l.quantity, z },
      });
    }
  }

  // ── 3. Duplicate records ────────────────────────────────────────────────
  const originals = lots.filter((l) => !/-S\d+/.test(l.code));
  for (let i = 0; i < originals.length; i++) {
    for (let j = i + 1; j < originals.length; j++) {
      const a = originals[i];
      const b = originals[j];
      if (a.type !== b.type || a.creatorId !== b.creatorId) continue;
      if (Math.abs(a.quantity - b.quantity) > 1e-6 || a.attributes !== b.attributes) continue;
      if (Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) > 24 * 3600e3) continue;
      const [first, dup] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
      findings.push({
        fingerprint: `DUP:${first.id}:${dup.id}`,
        kind: "DUPLICATE_RECORD",
        score: 0.82,
        lotId: dup.id,
        orgId: dup.creatorId,
        title: "Possible duplicate lot registration",
        detail: `${dup.code} has identical type, quantity (${dup.quantity} ${dup.unit}) and attributes to ${first.code}, registered within 24 h by the same organisation.`,
        evidence: { original: first.code, duplicate: dup.code },
      });
    }
  }

  // ── 4. Re-used documents across unrelated lots ──────────────────────────
  const docs = await prisma.document.findMany({ where: { lotId: { not: null } }, include: { lot: true } });
  const byHash = new Map<string, typeof docs>();
  for (const d of docs) byHash.set(d.sha256, [...(byHash.get(d.sha256) ?? []), d]);
  for (const [hash, group] of byHash) {
    const lotCodes = [...new Set(group.map((d) => d.lot!.code))];
    if (lotCodes.length < 2) continue;
    findings.push({
      fingerprint: `DOC:${hash}`,
      kind: "DUPLICATE_DOCUMENT",
      score: 0.88,
      lotId: group[group.length - 1].lotId,
      orgId: group[group.length - 1].orgId,
      title: "Same certificate attached to multiple lots",
      detail: `A document with hash ${hash.slice(0, 16)}… (“${group[0].name}”) is attached to ${lotCodes.join(", ")}. Certificates are normally lot-specific.`,
      evidence: { sha256: hash, lots: lotCodes },
    });
  }

  // ── 5. Processing duration ──────────────────────────────────────────────
  const durations = new Map<string, { lot: (typeof lots)[number]; hours: number }[]>();
  for (const l of transformed) {
    const def = LOT_TYPES[l.type as LotType];
    const ready = Math.max(
      ...l.parents.map((p) => {
        const received = p.parent.events.filter((e) => e.type === "TRANSFER_RECEIVED" || e.type === LOT_TYPES[p.parent.type as LotType].verb);
        const t = received.length ? Math.max(...received.map((e) => e.occurredAt.getTime())) : p.parent.createdAt.getTime();
        return t;
      }),
    );
    const hours = (l.createdAt.getTime() - ready) / 3600e3;
    const arr = durations.get(l.type) ?? [];
    arr.push({ lot: l, hours });
    durations.set(l.type, arr);
    if (def.minHours && hours >= 0 && hours < def.minHours) {
      findings.push({
        fingerprint: `FAST:${l.id}`,
        kind: "PROCESS_DURATION",
        score: Math.min(0.95, 0.6 + (1 - hours / def.minHours) * 0.35),
        lotId: l.id,
        orgId: l.creatorId,
        title: `${def.label} produced implausibly fast`,
        detail: `${l.code} was recorded ${hours.toFixed(1)} h after its inputs became available; ${def.label.toLowerCase()} processing normally needs at least ${def.minHours} h.`,
        evidence: { hours, minHours: def.minHours },
      });
    }
  }
  for (const [type, arr] of durations) {
    if (arr.length < 4) continue;
    const m = median(arr.map((a) => a.hours));
    for (const a of arr) {
      if (a.hours > Math.max(72, m * 4)) {
        findings.push({
          fingerprint: `SLOW:${a.lot.id}`,
          kind: "PROCESS_DURATION",
          score: 0.55,
          lotId: a.lot.id,
          orgId: a.lot.creatorId,
          title: `Long processing delay for ${LOT_TYPES[type as LotType].label.toLowerCase()}`,
          detail: `${a.lot.code} took ${(a.hours / 24).toFixed(1)} days vs a median of ${(m / 24).toFixed(1)} days.`,
          evidence: { hours: a.hours, median: m },
        });
      }
    }
  }

  // ── 6. Missing events ───────────────────────────────────────────────────
  for (const l of lots) {
    if (l.type === "BALE" && !/-S\d+/.test(l.code)) {
      const tested = l.events.some((e) => e.type === "QUALITY_TEST") || l.documents.some((d) => d.kind === "LAB_REPORT");
      if (!tested && Date.now() - l.createdAt.getTime() > 12 * 3600e3)
        findings.push({
          fingerprint: `MISSING_QT:${l.id}`,
          kind: "MISSING_EVENT",
          score: 0.62,
          lotId: l.id,
          orgId: l.creatorId,
          title: "Bale has no quality test on record",
          detail: `${l.code} was pressed without an HVI quality test event or lab report. Grade and staple claims cannot be verified.`,
          evidence: { expected: "QUALITY_TEST" },
        });
    }
    if (l.type === "GARMENT_BATCH" && l.passport?.published) {
      const { certifiedUpstream } = await hasCertifiedAncestor(l.id);
      if (!certifiedUpstream)
        findings.push({
          fingerprint: `NOCERT:${l.id}`,
          kind: "MISSING_EVENT",
          score: 0.52,
          lotId: l.id,
          orgId: l.ownerId,
          title: "Published passport without any certification",
          detail: `Passport ${l.passport.publicId} is live but no lot in its genealogy has been certified by an auditor.`,
          evidence: {},
        });
    }
  }

  // ── 7. Stale transfers ──────────────────────────────────────────────────
  const stale = await prisma.transfer.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 5 * 86400e3) } },
    include: { lot: true, toOrg: true },
  });
  for (const t of stale) {
    const days = (Date.now() - t.createdAt.getTime()) / 86400e3;
    findings.push({
      fingerprint: `STALE:${t.id}`,
      kind: "STALE_TRANSFER",
      score: Math.min(0.9, 0.5 + days / 30),
      lotId: t.lotId,
      orgId: t.fromOrgId,
      title: "Shipment in transit for too long",
      detail: `${t.quantity} ${t.lot.unit} of ${t.lot.code} has awaited acceptance by ${t.toOrg.name} for ${days.toFixed(0)} days.`,
      evidence: { days },
    });
  }

  // ── 8. IoT sensor outliers ──────────────────────────────────────────────
  const devices = await prisma.device.findMany({ include: { readings: { orderBy: { recordedAt: "asc" } } } });
  for (const d of devices) {
    const byMetric = new Map<string, typeof d.readings>();
    for (const r of d.readings) byMetric.set(r.metric, [...(byMetric.get(r.metric) ?? []), r]);
    for (const [metric, rs] of byMetric) {
      if (rs.length < 8) continue;
      const vals = rs.map((r) => r.value);
      const m = median(vals);
      const s = Math.max(1.4826 * mad(vals), Math.abs(m) * 0.05, 0.5);
      const outliers = rs.map((r) => ({ r, z: (r.value - m) / s })).filter((x) => Math.abs(x.z) > 3.5 || !x.r.valid);
      if (!outliers.length) continue;
      const worst = outliers.reduce((a, b) => (Math.abs(b.z) > Math.abs(a.z) ? b : a));
      const meta = METRICS[metric];
      findings.push({
        fingerprint: `SENSOR:${d.id}:${metric}`,
        kind: "SENSOR_OUTLIER",
        score: Math.max(scoreFromZ(Math.min(Math.abs(worst.z), 8) * 0.8), worst.r.valid ? 0 : 0.8),
        lotId: d.lotId,
        orgId: d.orgId,
        title: `${meta?.label ?? metric} spike on ${d.name}`,
        detail: `${outliers.length} of ${rs.length} readings deviate strongly from the median of ${m.toFixed(1)} ${meta?.unit ?? ""}. Peak ${worst.r.value.toFixed(1)} ${meta?.unit ?? ""} at ${worst.r.recordedAt.toISOString().slice(0, 16).replace("T", " ")} (z = ${worst.z.toFixed(1)}).`,
        evidence: { device: d.code, metric, median: m, peak: worst.r.value, count: outliers.length },
      });
    }
  }

  return findings;
}

async function hasCertifiedAncestor(lotId: string) {
  let frontier = [lotId];
  const seen = new Set(frontier);
  while (frontier.length) {
    const lots = await prisma.lot.findMany({ where: { id: { in: frontier } }, select: { certified: true } });
    if (lots.some((l) => l.certified)) return { certifiedUpstream: true };
    const links = await prisma.lotLink.findMany({ where: { childId: { in: frontier } } });
    frontier = links.map((l) => l.parentId).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
  }
  return { certifiedUpstream: false };
}

/** Run detection and persist results. Reviewed findings keep their verdict. */
export async function runAnomalyScan() {
  const findings = await detectAnomalies();
  let created = 0;
  for (const f of findings) {
    const existing = await prisma.anomaly.findUnique({ where: { fingerprint: f.fingerprint } });
    const data = {
      kind: f.kind,
      score: Math.round(f.score * 1000) / 1000,
      severity: severityOf(f.score),
      title: f.title,
      detail: f.detail,
      evidence: JSON.stringify(f.evidence),
      lotId: f.lotId ?? null,
      orgId: f.orgId ?? null,
    };
    if (existing) await prisma.anomaly.update({ where: { id: existing.id }, data });
    else {
      await prisma.anomaly.create({ data: { ...data, fingerprint: f.fingerprint } });
      created++;
    }
  }
  return { total: findings.length, created };
}

export function evidenceOf(a: { evidence: string }) {
  return safeJson<Record<string, unknown>>(a.evidence);
}
