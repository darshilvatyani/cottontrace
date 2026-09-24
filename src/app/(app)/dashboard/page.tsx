import Link from "next/link";
import { ArrowRight, ArrowLeftRight, Plus, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hasNetworkView, requireMember } from "@/lib/session";
import { LOT_ORDER, LOT_TYPES, ORG_TYPES, ROLE_LABEL, lotTypesForOrg, type OrgType, type Role } from "@/lib/domain";
import { ButtonLink, Card, CardHeader, Empty, Kicker, Stat } from "@/components/ui";
import { LotTag } from "@/components/lot-tag";
import { ActivityFeed } from "@/components/activity-feed";
import { ActivityArea, StageBars } from "@/components/charts";
import { LotIcon } from "@/components/stage-icon";
import { fmt, msAgo, timeAgo } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function Dashboard() {
  const user = await requireMember();
  const org = user.organization;
  const network = hasNetworkView(user);
  const scope = network ? {} : { OR: [{ ownerId: org.id }, { creatorId: org.id }] };
  const since = msAgo(45 * 86400e3);

  const [myLots, incoming, byType, events, eventsForChart, myTxs, openAnomalies, rejected, passports] = await Promise.all([
    prisma.lot.findMany({ where: { ownerId: org.id, status: { in: ["ACTIVE", "IN_TRANSIT"] } }, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.transfer.findMany({ where: { toOrgId: org.id, status: "PENDING" }, include: { lot: true, fromOrg: true }, orderBy: { createdAt: "desc" } }),
    prisma.lot.groupBy({ by: ["type"], _count: true, where: scope }),
    prisma.traceEvent.findMany({
      where: network ? {} : { OR: [{ orgId: org.id }, { lot: { ownerId: org.id } }] },
      include: { org: true, lot: true },
      orderBy: { occurredAt: "desc" },
      take: 9,
    }),
    prisma.traceEvent.findMany({ where: { occurredAt: { gte: since }, ...(network ? {} : { orgId: org.id }) }, select: { occurredAt: true } }),
    prisma.ledgerTx.count({ where: { submitterMsp: org.mspId, status: "VALID" } }),
    prisma.anomaly.findMany({ where: { status: "OPEN", ...(network ? {} : { orgId: org.id }) }, orderBy: { score: "desc" }, take: 4, include: { lot: true } }),
    prisma.ledgerTx.count({ where: { status: "REJECTED", ...(network ? {} : { submitterMsp: org.mspId }) } }),
    prisma.passport.count({ where: { published: true } }),
  ]);

  const stockKg = myLots.filter((l) => l.unit === "kg").reduce((s, l) => s + l.available, 0);
  const stockPcs = myLots.filter((l) => l.unit === "pcs").reduce((s, l) => s + l.available, 0);
  const stageData = LOT_ORDER.map((t) => ({ label: LOT_TYPES[t].prefix, value: byType.find((b) => b.type === t)?._count ?? 0, color: LOT_TYPES[t].color }));

  const days: { day: string; events: number }[] = [];
  for (let i = 44; i >= 0; i--) {
    const d = msAgo(i * 86400e3);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), events: eventsForChart.filter((e) => e.occurredAt.toISOString().slice(0, 10) === key).length });
  }

  const creatable = lotTypesForOrg(org.type as OrgType);
  const hour = msAgo(0).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Kicker>{ROLE_LABEL[user.role as Role]} · {ORG_TYPES[org.type as OrgType]?.label} · {org.city}</Kicker>
          <h1 className="mt-2 font-display text-5xl tracking-tight">
            {greeting}, <em className="italic text-indigo">{user.name.split(" ")[0]}</em>.
          </h1>
          <p className="mt-2 text-ink-2">
            {incoming.length
              ? `${incoming.length} shipment${incoming.length > 1 ? "s are" : " is"} waiting for you to accept.`
              : network
                ? "Here is the state of the whole cotton-channel today."
                : "Your material is flowing — nothing awaits your signature."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {creatable.map((t) => (
            <ButtonLink key={t} href={`/lots/new?type=${t}`} variant={t === creatable[0] ? "primary" : "outline"}>
              <Plus size={15} /> New {LOT_TYPES[t].label.toLowerCase()}
            </ButtonLink>
          ))}
          {user.role === "AUDITOR" && <ButtonLink href="/insights"><Sparkles size={15} /> Review anomalies</ButtonLink>}
          {user.role === "BRAND" && <ButtonLink href="/passports">Manage passports <ArrowRight size={15} /></ButtonLink>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {network ? (
          <>
            <Stat label="Lots on the network" value={fmt(byType.reduce((s, b) => s + b._count, 0))} hint="across all stages" accent="#25337a" />
            <Stat label="Open anomalies" value={openAnomalies.length} hint="awaiting human review" accent="#b0412a" />
            <Stat label="Contract rejections" value={rejected} hint="invalid invocations blocked" accent="#d6a021" />
            <Stat label="Live passports" value={passports} hint="scannable by consumers" accent="#0f6b63" />
          </>
        ) : (
          <>
            <Stat label="Active lots held" value={myLots.length} hint={`${fmt(stockKg)} kg${stockPcs ? ` · ${fmt(stockPcs)} pcs` : ""} in stock`} accent="#25337a" />
            <Stat label="Incoming handoffs" value={incoming.length} hint="pending your acceptance" accent="#d6a021" />
            <Stat label="Your ledger txs" value={myTxs} hint={`signed as ${org.mspId}`} accent="#56733a" />
            <Stat label="Flags on your records" value={openAnomalies.length} hint={rejected ? `${rejected} rejected invocations` : "no rejected invocations"} accent="#b0412a" />
          </>
        )}
      </div>

      {incoming.length > 0 && (
        <Card className="overflow-hidden border-turmeric/50 bg-turmeric-soft/60">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-turmeric text-ink"><ArrowLeftRight size={22} /></span>
            <div className="flex-1">
              <div className="font-display text-xl">Material is waiting at your gate</div>
              <div className="text-sm text-ink-2">
                {incoming.slice(0, 3).map((t) => `${t.quantity} ${t.lot.unit} of ${t.lot.code} from ${t.fromOrg.name}`).join(" · ")}
              </div>
            </div>
            <ButtonLink href="/transfers" variant="ink">Review handoffs <ArrowRight size={15} /></ButtonLink>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">On your rail</h2>
              <Link href="/lots" className="text-sm font-semibold text-indigo hover:underline">All lots →</Link>
            </div>
            {myLots.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myLots.map((l) => (
                  <LotTag key={l.id} lot={l} compact />
                ))}
              </div>
            ) : (
              <Empty title="No material on hand" action={creatable[0] ? <ButtonLink href={`/lots/new?type=${creatable[0]}`}><Plus size={15} /> Register your first lot</ButtonLink> : undefined}>
                {creatable.length ? "Register a lot or accept an incoming handoff to get started." : "Lots you hold will appear here."}
              </Empty>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader kicker={network ? "network" : "your organisation"} title="Lots by stage" />
              <div className="p-4">
                <StageBars data={stageData} />
              </div>
            </Card>
            <Card>
              <CardHeader kicker="last 45 days" title="Traceability events" />
              <div className="p-4">
                <ActivityArea data={days} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader kicker="production line" title="Seed → cloth pipeline" />
            <div className="flex gap-2 overflow-x-auto p-5 scrollbar-none">
              {LOT_ORDER.map((t, i) => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-[104px] shrink-0 rounded-xl border border-line bg-paper/60 p-3 text-center">
                    <div className="mx-auto grid size-9 place-items-center rounded-full" style={{ background: `${LOT_TYPES[t].color}1c`, color: LOT_TYPES[t].color }}>
                      <LotIcon type={t} size={18} />
                    </div>
                    <div className="mt-2 font-display text-2xl">{stageData[i].value}</div>
                    <div className="text-[10.5px] leading-tight text-muted">{LOT_TYPES[t].plural}</div>
                  </div>
                  {i < LOT_ORDER.length - 1 && <span className="font-mono text-xs text-line">──</span>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader kicker={network ? "network-wide" : "your trail"} title="Recent activity" action={<Link href="/ledger" className="text-xs font-semibold text-indigo hover:underline">Ledger →</Link>} />
            <div className="px-4 py-2">
              {events.length ? <ActivityFeed events={events} /> : <p className="py-8 text-center text-sm text-muted">No events yet.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader kicker="AI assistance" title="Needs a second look" action={<Link href="/insights" className="text-xs font-semibold text-indigo hover:underline">Insights →</Link>} />
            <div className="divide-y divide-line/70">
              {openAnomalies.length ? (
                openAnomalies.map((a) => (
                  <Link key={a.id} href="/insights" className="flex items-start gap-3 px-5 py-3.5 hover:bg-paper/60">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0 text-madder" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <div className="text-xs text-muted">{a.lot?.code ?? "—"} · {timeAgo(a.createdAt)}</div>
                    </div>
                    <span className="font-mono text-sm font-bold text-madder">{a.score.toFixed(2)}</span>
                  </Link>
                ))
              ) : (
                <div className="flex items-center gap-3 px-5 py-6 text-sm text-ink-2">
                  <ShieldCheck className="text-teal" size={20} /> Nothing unusual detected in your records.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
