import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { ORG_TYPES, ROLE_LABEL, safeJson, type OrgType, type Role } from "@/lib/domain";
import { Card, Kicker, PageHeader } from "@/components/ui";
import { OrgIcon } from "@/components/stage-icon";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Network" };

export default async function NetworkPage() {
  const user = await requireMember();
  const orgs = await prisma.organization.findMany({
    include: { users: true, _count: { select: { ownedLots: true, createdLots: true, devices: true } } },
    orderBy: { createdAt: "asc" },
  });
  const txByMsp = await prisma.ledgerTx.groupBy({ by: ["submitterMsp"], _count: true, _max: { createdAt: true }, where: { status: "VALID" } });
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <PageHeader kicker="cotton-channel membership" title={<>Who&apos;s on the <em className="italic text-indigo">channel</em></>}>
        Each organisation holds its own ledger identity (MSP). Every transaction is signed by one of these identities, so
        responsibility for every record is always attributable.
      </PageHeader>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {orgs.map((o) => {
          const d = ORG_TYPES[o.type as OrgType];
          const tx = txByMsp.find((t) => t.submitterMsp === o.mspId);
          const certs = safeJson<string[]>(o.certifications, []);
          return (
            <Card key={o.id} className="stitch overflow-hidden" style={{ color: d.color }}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl text-paper" style={{ background: d.color }}>
                    <OrgIcon type={o.type} size={22} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{o.code}</span>
                </div>
                <div className="mt-4 font-display text-2xl leading-tight text-ink">{o.name}</div>
                <div className="text-sm text-muted">{d.label} · {o.city}, {o.state}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-ink">
                  <div className="rounded-xl bg-paper-2 py-2"><div className="font-display text-xl">{o._count.createdLots}</div><div className="text-[10px] text-muted">lots made</div></div>
                  <div className="rounded-xl bg-paper-2 py-2"><div className="font-display text-xl">{tx?._count ?? 0}</div><div className="text-[10px] text-muted">txs signed</div></div>
                  <div className="rounded-xl bg-paper-2 py-2"><div className="font-display text-xl">{o._count.devices}</div><div className="text-[10px] text-muted">devices</div></div>
                </div>
                {certs.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {certs.map((c) => <span key={c} className="rounded-full bg-teal-soft px-2 py-0.5 text-[10.5px] font-semibold text-teal">{c}</span>)}
                  </div>
                )}
                <div className="mt-4 border-t border-dashed border-line pt-3 text-ink">
                  <Kicker>MSP identity</Kicker>
                  <div className="font-mono text-xs">{o.mspId}</div>
                  {tx?._max.createdAt && <div className="mt-1 text-xs text-muted">last signed {timeAgo(tx._max.createdAt)}</div>}
                </div>
                {isAdmin && o.users.length > 0 && (
                  <div className="mt-4 space-y-1 text-ink">
                    <Kicker>Members</Kicker>
                    {o.users.map((u) => (
                      <div key={u.id} className="flex justify-between text-xs"><span>{u.name}</span><span className="text-muted">{ROLE_LABEL[u.role as Role]} · {u.email}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
