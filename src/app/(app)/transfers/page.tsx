import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { LOT_TYPES, type LotType } from "@/lib/domain";
import { Badge, Card, Empty, Hash, Kicker, PageHeader } from "@/components/ui";
import { LotIcon, OrgIcon } from "@/components/stage-icon";
import { dateFmt, fmt, timeAgo } from "@/lib/utils";
import { TransferButtons } from "./transfer-buttons";

export const metadata = { title: "Handoffs" };

const TONE = { PENDING: "turmeric", ACCEPTED: "leaf", REJECTED: "madder", CANCELLED: "neutral" } as const;

export default async function TransfersPage() {
  const user = await requireMember();
  const orgId = user.organization.id;
  const include = { lot: true, fromOrg: true, toOrg: true, createdBy: true } as const;
  const [incoming, outgoing, history] = await Promise.all([
    prisma.transfer.findMany({ where: { toOrgId: orgId, status: "PENDING" }, include, orderBy: { createdAt: "desc" } }),
    prisma.transfer.findMany({ where: { fromOrgId: orgId, status: "PENDING" }, include, orderBy: { createdAt: "desc" } }),
    prisma.transfer.findMany({
      where: { OR: [{ fromOrgId: orgId }, { toOrgId: orgId }], status: { not: "PENDING" } },
      include,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader kicker="TransferContract" title={<>Handoffs at the <em className="italic text-indigo">factory gate</em></>}>
        Ownership only changes when the receiver signs for the material. Partial shipments automatically split the lot
        into a linked child lot, so the genealogy never breaks.
      </PageHeader>

      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-display text-2xl">Waiting for your signature</h2>
          <span className="font-mono text-sm text-muted">{incoming.length}</span>
        </div>
        {incoming.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {incoming.map((t) => (
              <Waybill key={t.id} t={t} direction="in" />
            ))}
          </div>
        ) : (
          <Empty title="Nothing at the gate">Incoming shipments from upstream partners will appear here for you to accept or reject.</Empty>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-display text-2xl">In transit from you</h2>
            <span className="font-mono text-sm text-muted">{outgoing.length}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {outgoing.map((t) => (
              <Waybill key={t.id} t={t} direction="out" />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 font-display text-2xl">History</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Lot</th>
                  <th className="px-3 py-3">From → To</th>
                  <th className="px-3 py-3 text-right">Quantity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Dispatched</th>
                  <th className="px-5 py-3">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-paper/50">
                    <td className="px-5 py-3">
                      <Link href={`/lots/${t.lot.code}`} className="flex items-center gap-2 font-mono text-xs font-bold hover:text-indigo">
                        <LotIcon type={t.lot.type} size={16} style={{ color: LOT_TYPES[t.lot.type as LotType].color }} /> {t.lot.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{t.fromOrg.name} <span className="text-muted">→</span> {t.toOrg.name}</td>
                    <td className="px-3 py-3 text-right font-mono">{fmt(t.quantity, 1)} {t.lot.unit}</td>
                    <td className="px-3 py-3"><Badge tone={TONE[t.status as keyof typeof TONE]}>{t.status.toLowerCase()}</Badge></td>
                    <td className="px-3 py-3 text-muted">{dateFmt(t.createdAt)}</td>
                    <td className="px-5 py-3"><Hash value={t.txHash} n={6} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.length && <p className="px-5 py-8 text-center text-sm text-muted">No completed handoffs yet.</p>}
        </Card>
      </section>
    </div>
  );
}

type T = Awaited<ReturnType<typeof prisma.transfer.findMany<{ include: { lot: true; fromOrg: true; toOrg: true; createdBy: true } }>>>[number];

function Waybill({ t, direction }: { t: T; direction: "in" | "out" }) {
  const def = LOT_TYPES[t.lot.type as LotType];
  const whole = Math.abs(t.quantity - t.lot.quantity) < 1e-6;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-dashed border-line bg-paper/60 px-5 py-2.5">
        <Kicker>Waybill · {t.id.slice(-8).toUpperCase()}</Kicker>
        <span className="font-mono text-[10px] text-muted">{timeAgo(t.createdAt)}</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${def.color}1a`, color: def.color }}>
            <LotIcon type={t.lot.type} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/lots/${t.lot.code}`} className="font-mono text-sm font-bold hover:text-indigo">{t.lot.code}</Link>
            <div className="truncate text-sm text-ink-2">{t.lot.name}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl leading-none">{fmt(t.quantity, 1)}</div>
            <div className="text-xs text-muted">{t.lot.unit} {whole ? "· whole lot" : "· partial (split)"}</div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <OrgIcon type={t.fromOrg.type} size={16} className="shrink-0 text-muted" />
            <span className="truncate">{t.fromOrg.name}</span>
          </div>
          <svg width="60" height="12" className="shrink-0 text-madder"><path d="M0 6 H54 M48 1 L55 6 L48 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" className="thread-flow" /></svg>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate">{t.toOrg.name}</span>
            <OrgIcon type={t.toOrg.type} size={16} className="shrink-0 text-muted" />
          </div>
        </div>
        {t.note && <div className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-xs text-ink-2">“{t.note}”</div>}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Hash value={t.txHash} />
          <TransferButtons id={t.id} direction={direction} />
        </div>
      </div>
    </div>
  );
}
