import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { actorOf, requireMember } from "@/lib/session";
import { getLineage } from "@/lib/trace";
import { verifyLotRecord } from "@/lib/chain/ledger";
import {
  EVENT_LABEL,
  LOT_ORDER,
  LOT_TYPES,
  MANUAL_EVENTS,
  METRICS,
  ORG_TYPES,
  TRANSFER_ROUTES,
  lotMassKg,
  safeJson,
  type LotType,
  type OrgType,
} from "@/lib/domain";
import { Badge, Card, CardHeader, Hash, Kicker, Stamp } from "@/components/ui";
import { GenealogyGraph } from "@/components/genealogy-graph";
import { SensorChart } from "@/components/charts";
import { LotIcon, OrgIcon } from "@/components/stage-icon";
import { STATUS_TONE } from "@/components/lot-tag";
import { cn, dateFmt, fmt } from "@/lib/utils";
import { LotActions } from "./lot-actions";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: (await params).code };
}

export default async function LotPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireMember();
  const lot = await prisma.lot.findUnique({
    where: { code: decodeURIComponent(code) },
    include: {
      owner: true,
      creator: true,
      field: true,
      createdBy: true,
      passport: true,
      events: { include: { org: true, user: true }, orderBy: { occurredAt: "desc" } },
      documents: { include: { org: true }, orderBy: { createdAt: "desc" } },
      anomalies: { orderBy: { score: "desc" } },
      devices: true,
      transfers: { where: { status: "PENDING" }, include: { toOrg: true } },
    },
  });
  if (!lot) notFound();

  const def = LOT_TYPES[lot.type as LotType];
  const attrs = safeJson<Record<string, unknown>>(lot.attributes);
  const actor = actorOf(user);

  const [lineage, verification, txs, receivers, readings] = await Promise.all([
    getLineage(lot.id, "both"),
    verifyLotRecord(lot),
    prisma.ledgerTx.findMany({ where: { lotCode: lot.code }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.organization.findMany({ where: { type: { in: TRANSFER_ROUTES[lot.type as LotType] }, id: { not: user.organization.id } }, orderBy: { name: "asc" } }),
    prisma.sensorReading.findMany({ where: { lotId: lot.id }, orderBy: { recordedAt: "asc" }, take: 600 }),
  ]);

  const isOwner = lot.ownerId === user.organization.id;
  const isAuditor = actor.orgType === "AUDITOR" || user.role === "ADMIN";
  const nextTypes = LOT_ORDER.filter((t) => LOT_TYPES[t].inputs.includes(lot.type as LotType) && LOT_TYPES[t].org === actor.orgType);
  const massOf = new Map(lineage.lots.map((l) => [l.id, l]));

  const metricsSeen = [...new Set(readings.map((r) => r.metric))];

  return (
    <div className="space-y-6">
      <Link href="/lots" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> All lots
      </Link>

      {/* ── Hero tag ── */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card" style={{ clipPath: "polygon(36px 0, 100% 0, 100% 100%, 36px 100%, 0 calc(100% - 36px), 0 36px)" }}>
          <div className="absolute inset-y-0 left-0 flex w-14 items-center justify-center" style={{ background: def.color }}>
            <div className="eyelet scale-125" />
          </div>
          <div className="py-7 pl-20 pr-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: def.color }}>{def.label}</span>
              <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", STATUS_TONE[lot.status])}>● {lot.status.replace("_", " ")}</span>
              {lot.certified && <Stamp className="ml-1">Certified</Stamp>}
            </div>
            <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">{lot.code}</h1>
            <div className="mt-1 font-display text-2xl text-ink-2">{lot.name}</div>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div>
                <Kicker>Available</Kicker>
                <div className="mt-1 font-display text-3xl">{fmt(lot.available, 2)} <span className="text-base text-muted">{lot.unit}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <div className="h-full rounded-full" style={{ width: `${(lot.available / lot.quantity) * 100}%`, background: def.color }} />
                </div>
                <div className="mt-1 text-xs text-muted">of {fmt(lot.quantity, 2)} {lot.unit} · {fmt(lotMassKg(lot), 0)} kg</div>
              </div>
              <div>
                <Kicker>Current owner</Kicker>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-paper-2" style={{ color: ORG_TYPES[lot.owner.type as OrgType]?.color }}><OrgIcon type={lot.owner.type} size={17} /></span>
                  <div>
                    <div className="text-sm font-semibold leading-tight">{lot.owner.name}</div>
                    <div className="text-xs text-muted">{lot.owner.city}, {lot.owner.state}</div>
                  </div>
                </div>
              </div>
              <div>
                <Kicker>Created</Kicker>
                <div className="mt-1.5 text-sm font-semibold">{dateFmt(lot.createdAt, true)}</div>
                <div className="text-xs text-muted">by {lot.creator.name}{lot.createdBy ? ` · ${lot.createdBy.name}` : ""}</div>
                {lot.field && <div className="mt-1 text-xs text-muted">Field {lot.field.name} · {lot.field.areaHa} ha</div>}
              </div>
            </div>
          </div>
        </div>

        <Card className={cn("relative overflow-hidden p-6", verification.ok ? "" : "border-madder/50")}>
          <div className="flex items-start justify-between">
            <div>
              <Kicker>Ledger integrity</Kicker>
              <div className="mt-1 font-display text-2xl">{verification.ok ? "Record matches the chain" : "Record does not match"}</div>
            </div>
            {verification.ok ? <ShieldCheck size={34} className="text-teal" /> : <ShieldX size={34} className="text-madder" />}
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {verification.ok
              ? "Identity, type and quantity recomputed against the committed transaction payload."
              : verification.reason}
          </p>
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Block</dt><dd className="font-mono">{"blockNumber" in verification && verification.blockNumber != null ? <Link className="text-indigo hover:underline" href={`/ledger?block=${verification.blockNumber}`}>#{verification.blockNumber}</Link> : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Tx hash</dt><dd><Hash value={lot.txHash} /></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Endorser</dt><dd className="font-mono text-xs">{lot.creator.mspId}</dd></div>
            {lot.passport && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Passport</dt>
                <dd><Link href={`/p/${lot.passport.publicId}`} target="_blank" className="inline-flex items-center gap-1 font-mono text-xs text-indigo hover:underline">{lot.passport.publicId} <ExternalLink size={11} /></Link></dd>
              </div>
            )}
          </dl>
          {lot.transfers.length > 0 && (
            <div className="mt-5 rounded-xl bg-turmeric-soft px-3 py-2 text-xs text-[#7a5a10]">
              In transit: {lot.transfers.map((t) => `${t.quantity} ${lot.unit} → ${t.toOrg.name}`).join(", ")}
            </div>
          )}
        </Card>
      </div>

      <LotActions
        lot={{ id: lot.id, code: lot.code, type: lot.type, status: lot.status, available: lot.available, unit: lot.unit }}
        canOwn={isOwner}
        canAttach={isOwner || lot.creatorId === user.organization.id || isAuditor}
        canCertify={isAuditor && !lot.certified}
        canPassport={isOwner && lot.type === "GARMENT_BATCH" && ["BRAND", "GARMENT_FACTORY"].includes(actor.orgType)}
        hasPassport={!!lot.passport}
        receivers={receivers.map((o) => ({ id: o.id, name: o.name, type: o.type, city: o.city }))}
        events={isOwner ? (MANUAL_EVENTS[lot.type as LotType] ?? []) : []}
        nextTypes={nextTypes}
      />

      {/* ── Genealogy ── */}
      <Card>
        <CardHeader
          kicker={`${lineage.lots.length} lots · ${lineage.edges.length} transformations`}
          title="Material genealogy"
          action={<span className="hidden text-xs text-muted md:block">Ribbon width = mass · hover to trace · click to open</span>}
        />
        <div className="p-4">
          <GenealogyGraph
            currentId={lot.id}
            nodes={lineage.lots.map((l) => ({ id: l.id, code: l.code, type: l.type, name: l.name, quantity: l.quantity, unit: l.unit, owner: l.owner.name, massKg: lotMassKg(l) }))}
            edges={lineage.edges.map((e) => ({ ...e, massKg: lotMassKg(massOf.get(e.from)!, e.quantity) }))}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader kicker="spec sheet" title="Recorded attributes" />
            <dl className="grid grid-cols-2 gap-px bg-line/60">
              {def.attributes.map((a) => {
                const v = attrs[a.key];
                return (
                  <div key={a.key} className="bg-card px-5 py-3.5">
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{a.label}</dt>
                    <dd className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
                      {a.type === "color" && typeof v === "string" && <span className="size-4 rounded-full ring-2 ring-line" style={{ background: v }} />}
                      {v === undefined || v === "" ? <span className="text-muted">—</span> : a.type === "boolean" ? (v ? "Yes" : "No") : `${v}${a.unit && a.unit !== "%" ? ` ${a.unit}` : a.unit ?? ""}`}
                    </dd>
                  </div>
                );
              })}
              {lot.season && (
                <div className="bg-card px-5 py-3.5">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Season</dt>
                  <dd className="mt-1 text-[15px] font-semibold">{lot.season}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader kicker="off-chain · hash on-chain" title="Documents" action={<Link href="/documents" className="text-xs font-semibold text-indigo hover:underline">Verify →</Link>} />
            {lot.documents.length ? (
              <ul className="divide-y divide-line/60">
                {lot.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText size={18} className="shrink-0 text-indigo" />
                    <div className="min-w-0 flex-1">
                      <a href={`/api/documents/${d.id}`} className="block truncate text-sm font-semibold hover:underline">{d.name}</a>
                      <div className="text-xs text-muted">{d.kind.replace("_", " ").toLowerCase()} · {d.org.name} · {dateFmt(d.createdAt)}</div>
                    </div>
                    <Hash value={d.sha256} n={8} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No documents anchored to this lot.</p>
            )}
          </Card>

          {metricsSeen.length > 0 && (
            <Card>
              <CardHeader kicker={`${lot.devices.map((d) => d.code).join(", ") || "linked sensors"}`} title="IoT measurements" />
              <div className="space-y-4 p-4">
                {metricsSeen.map((m) => {
                  const series = readings.filter((r) => r.metric === m);
                  return (
                    <div key={m}>
                      <div className="mb-1 flex justify-between px-1 text-xs">
                        <span className="font-semibold">{METRICS[m]?.label}</span>
                        <span className="font-mono text-muted">{series.length} readings</span>
                      </div>
                      <SensorChart height={120} color={METRICS[m]?.color ?? "#25337a"} unit={METRICS[m]?.unit ?? ""} data={series.map((r) => ({ t: dateFmt(r.recordedAt), v: r.value, flagged: !r.valid }))} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {lot.anomalies.length > 0 && (
            <Card className="border-madder/40">
              <CardHeader kicker="AI assistance" title="Flags on this lot" />
              <ul className="divide-y divide-line/60">
                {lot.anomalies.map((a) => (
                  <li key={a.id} className="flex gap-3 px-5 py-3.5">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0 text-madder" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{a.title}</span>
                        <Badge tone={a.status === "CONFIRMED" ? "madder" : a.status === "DISMISSED" ? "neutral" : "turmeric"}>{a.status.toLowerCase()} · {a.score.toFixed(2)}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-2">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader kicker={`${lot.events.length} events`} title="Lot timeline" />
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[29px] top-6 border-l-2 border-dotted" style={{ borderColor: `${def.color}66` }} />
              {lot.events.map((e) => {
                const data = safeJson<Record<string, unknown>>(e.data);
                return (
                  <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                    <span className="relative z-10 mt-1 grid size-[18px] shrink-0 place-items-center rounded-full border-2 bg-card" style={{ borderColor: def.color }}>
                      <span className="size-1.5 rounded-full" style={{ background: def.color }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">{e.title}</span>
                        <span className="font-mono text-[10.5px] text-muted">{dateFmt(e.occurredAt, true)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        <span className="font-mono uppercase tracking-wider" style={{ color: def.color }}>{EVENT_LABEL[e.type] ?? e.type}</span> · {e.org.name}{e.user ? ` · ${e.user.name}` : ""}
                      </div>
                      {Object.keys(data).filter((k) => !["inputs", "transferId", "documentId"].includes(k)).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(data)
                            .filter(([k, v]) => !["inputs", "transferId", "documentId", "sha256"].includes(k) && v !== "" && typeof v !== "object")
                            .map(([k, v]) => (
                              <span key={k} className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2">{k}: {String(v)}</span>
                            ))}
                        </div>
                      )}
                      {e.txHash && <div className="mt-1.5"><Hash value={e.txHash} n={12} /></div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader kicker="chaincode invocations" title="Ledger transactions" action={<Link href="/ledger" className="text-xs font-semibold text-indigo hover:underline">Explorer →</Link>} />
            <ul className="divide-y divide-line/60">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", t.status === "VALID" ? "bg-leaf" : "bg-madder")} />
                  <span className="font-mono text-xs">{t.contract}.<b>{t.fn}</b></span>
                  <span className="ml-auto font-mono text-[11px] text-muted">{t.blockNumber != null ? `#${t.blockNumber}` : "rejected"}</span>
                  <Hash value={t.id} n={6} />
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-5 py-4 text-xs text-muted">
            <LotIcon type={lot.type} size={20} style={{ color: def.color }} />
            Lot identity is globally unique on the cotton-channel and is referenced by every downstream product made from it.
          </div>
        </div>
      </div>
    </div>
  );
}
