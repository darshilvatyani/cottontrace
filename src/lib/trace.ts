import { prisma } from "@/lib/prisma";
import { LOT_TYPES, lotMassKg, safeJson, type LotType } from "@/lib/domain";

const lotInclude = {
  owner: true,
  creator: true,
  field: true,
} as const;

export type LineageLot = Awaited<ReturnType<typeof loadLots>>[number];
export type LineageEdge = { from: string; to: string; quantity: number };

async function loadLots(ids: string[]) {
  return prisma.lot.findMany({ where: { id: { in: ids } }, include: lotInclude });
}

/** Walk parent/child links to build the material genealogy of a lot. */
export async function getLineage(lotId: string, dir: "up" | "down" | "both" = "both") {
  const ids = new Set<string>([lotId]);
  const edges = new Map<string, LineageEdge>();

  const walk = async (direction: "up" | "down") => {
    let frontier = [lotId];
    let depth = 0;
    while (frontier.length && depth < 20) {
      const links = await prisma.lotLink.findMany({
        where: direction === "up" ? { childId: { in: frontier } } : { parentId: { in: frontier } },
      });
      const next: string[] = [];
      for (const l of links) {
        edges.set(l.id, { from: l.parentId, to: l.childId, quantity: l.quantity });
        const other = direction === "up" ? l.parentId : l.childId;
        if (!ids.has(other)) {
          ids.add(other);
          next.push(other);
        }
      }
      frontier = next;
      depth++;
    }
  };

  if (dir !== "down") await walk("up");
  if (dir !== "up") await walk("down");

  const lots = await loadLots([...ids]);
  lots.sort(
    (a, b) =>
      LOT_TYPES[a.type as LotType].stageIndex - LOT_TYPES[b.type as LotType].stageIndex ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return { lots, edges: [...edges.values()] };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const GRID_KG_CO2_PER_KWH = 0.71; // India grid emission factor (CEA)
export const ROAD_KG_CO2_PER_TKM = 0.105;

/** Everything a Digital Product Passport needs about a garment's upstream journey. */
export async function getJourney(lotId: string) {
  const { lots, edges } = await getLineage(lotId, "up");
  const ids = lots.map((l) => l.id);
  const byId = new Map(lots.map((l) => [l.id, l]));
  const target = byId.get(lotId)!;

  // Share of each upstream lot that ended up in the target (mass-flow allocation).
  // Children are always created after their parents, so walk newest → oldest.
  const share = new Map<string, number>([[lotId, 1]]);
  for (const l of [...lots].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const f = share.get(l.id) ?? 0;
    for (const e of edges.filter((e) => e.to === l.id)) {
      const p = byId.get(e.from);
      if (!p) continue;
      share.set(p.id, (share.get(p.id) ?? 0) + (f * e.quantity) / p.quantity);
    }
  }
  const shareOf = (id: string) => Math.min(1, share.get(id) ?? 0);

  const [events, documents, readings] = await Promise.all([
    prisma.traceEvent.findMany({
      where: { lotId: { in: ids } },
      include: { org: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.document.findMany({ where: { lotId: { in: ids } }, include: { org: true }, orderBy: { createdAt: "asc" } }),
    prisma.sensorReading.groupBy({
      by: ["lotId", "metric"],
      where: { lotId: { in: ids }, valid: true },
      _sum: { value: true },
    }),
  ]);

  // Organisations touched, in stage order
  const orgs: { id: string; name: string; type: string; city: string; state: string; lat: number; lng: number; certifications: string[] }[] = [];
  for (const l of lots) {
    for (const o of [l.creator, l.owner]) {
      if (!orgs.find((x) => x.id === o.id))
        orgs.push({ id: o.id, name: o.name, type: o.type, city: o.city, state: o.state, lat: o.lat, lng: o.lng, certifications: safeJson<string[]>(o.certifications, []) });
    }
  }

  // Transport legs between organisations (mass allocated to this product)
  const legs: { from: (typeof orgs)[number]; to: (typeof orgs)[number]; km: number; kg: number }[] = [];
  const addLeg = (fromId: string, toId: string, kg: number) => {
    if (fromId === toId) return;
    const from = orgs.find((o) => o.id === fromId)!;
    const to = orgs.find((o) => o.id === toId)!;
    const existing = legs.find((l) => l.from.id === fromId && l.to.id === toId);
    if (existing) existing.kg += kg;
    else legs.push({ from, to, km: haversineKm(from, to) * 1.25, kg }); // 1.25 = road-distance factor
  };
  for (const e of edges) {
    const p = byId.get(e.from);
    const c = byId.get(e.to);
    if (!p || !c) continue;
    // Material physically moves from where the parent was made to where the child is made
    addLeg(p.creatorId, c.creatorId, lotMassKg(p, e.quantity) * shareOf(c.id));
  }
  if (target.ownerId !== target.creatorId) addLeg(target.creatorId, target.ownerId, lotMassKg(target));
  legs.sort((a, b) => {
    const order = (t: string) => ["FARM", "GIN", "SPINNING_MILL", "WEAVING_UNIT", "DYEING_UNIT", "GARMENT_FACTORY", "BRAND"].indexOf(t);
    return order(a.from.type) - order(b.from.type);
  });

  // Sustainability indicators
  let waterL = 0;
  let energyKwh = 0;
  for (const r of readings) {
    const v = (r._sum.value ?? 0) * shareOf(r.lotId!);
    if (r.metric === "WATER") waterL += v;
    if (r.metric === "ENERGY") energyKwh += v;
  }
  let organicKg = 0;
  let seedKg = 0;
  for (const l of lots) {
    const a = safeJson<Record<string, unknown>>(l.attributes);
    const f = shareOf(l.id);
    if (l.type === "DYED_FABRIC") {
      waterL += (Number(a.waterL) || 0) * f;
      energyKwh += (Number(a.energyKwh) || 0) * f;
    }
    if (l.type === "SEED_LOT") {
      seedKg += l.quantity * f;
      if (a.organic === true || a.organic === "true") organicKg += l.quantity * f;
    }
  }
  const transportKm = legs.reduce((s, l) => s + l.km, 0);
  const transportCo2 = legs.reduce((s, l) => s + (l.kg / 1000) * l.km * ROAD_KG_CO2_PER_TKM, 0);
  const energyCo2 = energyKwh * GRID_KG_CO2_PER_KWH;
  const pieces = target.type === "GARMENT_BATCH" ? target.quantity : 1;

  const certifications = events
    .filter((e) => e.type === "CERTIFIED")
    .map((e) => ({ ...safeJson<{ standard: string; note?: string }>(e.data), lot: byId.get(e.lotId)?.code, by: e.org.name, at: e.occurredAt }));

  return {
    target,
    lots,
    edges,
    events,
    documents,
    orgs,
    legs,
    certifications,
    share: Object.fromEntries(share),
    metrics: {
      pieces,
      waterL,
      energyKwh,
      transportKm,
      co2Kg: energyCo2 + transportCo2,
      perPiece: {
        waterL: waterL / pieces,
        energyKwh: energyKwh / pieces,
        co2Kg: (energyCo2 + transportCo2) / pieces,
      },
      organicPct: seedKg ? (organicKg / seedKg) * 100 : 0,
      stages: new Set(lots.map((l) => l.type)).size,
    },
  };
}

export type Journey = Awaited<ReturnType<typeof getJourney>>;
