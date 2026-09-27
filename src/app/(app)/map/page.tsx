import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { ORG_TYPES, lotMassKg, type OrgType } from "@/lib/domain";
import { haversineKm } from "@/lib/trace";
import { Card, CardHeader, Kicker, PageHeader } from "@/components/ui";
import { SupplyMap, type MapFlow } from "@/components/supply-map";
import { OrgIcon } from "@/components/stage-icon";
import { fmt } from "@/lib/utils";

export const metadata = { title: "Supply Map" };

export default async function MapPage() {
  await requireMember();
  const [orgs, transfers, lotCounts] = await Promise.all([
    prisma.organization.findMany({ where: { code: { not: "NET-OPS" } } }),
    prisma.transfer.findMany({ where: { status: { in: ["ACCEPTED", "PENDING"] } }, include: { lot: true } }),
    prisma.lot.groupBy({ by: ["ownerId"], _count: true, where: { status: { in: ["ACTIVE", "IN_TRANSIT"] } } }),
  ]);

  const flowMap = new Map<string, MapFlow & { count: number }>();
  for (const t of transfers) {
    const key = `${t.fromOrgId}>${t.toOrgId}>${t.status}`;
    const kg = lotMassKg(t.lot, t.quantity);
    const f = flowMap.get(key) ?? { from: t.fromOrgId, to: t.toOrgId, kg: 0, count: 0, pending: t.status === "PENDING" };
    f.kg += kg;
    f.count++;
    flowMap.set(key, f);
  }
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const flows = [...flowMap.values()].map((f) => ({
    ...f,
    label: `${byId.get(f.from)?.name} → ${byId.get(f.to)?.name}: ${fmt(f.kg)} kg in ${f.count} shipment${f.count > 1 ? "s" : ""}${f.pending ? " (in transit)" : ""}`,
  }));
  const totalKm = flows.reduce((s, f) => s + haversineKm(byId.get(f.from)!, byId.get(f.to)!) * 1.25, 0);

  return (
    <div className="space-y-6">
      <PageHeader kicker="GIS · supply-chain geography" title={<>From the black soil of <em className="italic text-indigo">Saurashtra</em> to the shelf</>}>
        Every organisation on the channel, and every handoff between them. Ribbon thickness is mass moved; dashed ribbons
        are shipments still awaiting acceptance.
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <SupplyMap
          height={620}
          nodes={orgs.map((o) => ({ id: o.id, name: o.name, type: o.type, city: `${o.city}, ${o.state}`, lat: o.lat, lng: o.lng, color: ORG_TYPES[o.type as OrgType].color, label: ORG_TYPES[o.type as OrgType].short.slice(0, 2).toUpperCase() }))}
          flows={flows}
        />
        <div className="space-y-4">
          <Card className="p-5">
            <Kicker>Network footprint</Kicker>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div><div className="font-display text-3xl">{orgs.length}</div><div className="text-xs text-muted">sites</div></div>
              <div><div className="font-display text-3xl">{fmt(totalKm)}</div><div className="text-xs text-muted">road-km of routes</div></div>
            </div>
          </Card>
          <Card>
            <CardHeader kicker="legend" title="Sites" />
            <ul className="divide-y divide-line/60">
              {orgs.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full text-paper" style={{ background: ORG_TYPES[o.type as OrgType].color }}>
                    <OrgIcon type={o.type} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.name}</div>
                    <div className="text-xs text-muted">{o.city} · {ORG_TYPES[o.type as OrgType].label}</div>
                  </div>
                  <span className="font-mono text-xs text-muted">{lotCounts.find((l) => l.ownerId === o.id)?._count ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
