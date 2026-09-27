import Link from "next/link";
import { Ban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { safeJson } from "@/lib/domain";
import { Card, CardHeader, Kicker, PageHeader, Stat } from "@/components/ui";
import { cn, dateFmt, timeAgo } from "@/lib/utils";
import { ChainVerifier } from "./chain-verifier";

export const metadata = { title: "Ledger Explorer" };

const CONTRACT_COLOR: Record<string, string> = {
  LotContract: "#25337a",
  TransferContract: "#d6a021",
  EventContract: "#56733a",
  CertificationContract: "#0f6b63",
  DocumentContract: "#5a3a7a",
  SensorContract: "#b5652b",
  PassportContract: "#1c1a16",
  _lifecycle: "#857d6e",
};

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ block?: string }> }) {
  const user = await requireMember();
  const sp = await searchParams;
  const [height, txCount, rejected, orgs, blocks] = await Promise.all([
    prisma.block.count(),
    prisma.ledgerTx.count({ where: { status: "VALID" } }),
    prisma.ledgerTx.findMany({ where: { status: "REJECTED" }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.organization.count(),
    prisma.block.findMany({ orderBy: { number: "desc" }, take: 40, include: { transactions: { select: { contract: true, fn: true } } } }),
  ]);
  const selectedNo = sp.block != null ? Number(sp.block) : blocks[0]?.number;
  const selected = selectedNo != null ? await prisma.block.findUnique({ where: { number: selectedNo }, include: { transactions: true } }) : null;
  const mspToOrg = new Map((await prisma.organization.findMany({ select: { mspId: true, name: true } })).map((o) => [o.mspId, o.name]));

  return (
    <div className="space-y-8">
      <PageHeader kicker="cotton-channel · permissioned ledger" title={<>The <em className="italic text-indigo">ledger</em>, block by block</>}>
        Chaincode validates every invocation, the orderer seals valid transactions into SHA-256-linked blocks, and anyone on
        the channel can recompute the chain to prove nothing was rewritten.
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Block height" value={height - 1} hint="genesis = #0" />
        <Stat label="Valid transactions" value={txCount} accent="#56733a" />
        <Stat label="Rejected invocations" value={rejected.length} accent="#b0412a" hint="blocked by smart contracts" />
        <Stat label="Channel members" value={orgs} accent="#d6a021" hint="MSP identities" />
      </div>

      <ChainVerifier isAdmin={user.role === "ADMIN"} />

      <Card className="overflow-hidden">
        <CardHeader kicker="latest 40 blocks · newest first" title="Chain" />
        <div className="overflow-x-auto px-5 py-6 scrollbar-none">
          <div className="flex w-max items-center">
            {blocks.map((b, i) => {
              const active = b.number === selectedNo;
              const c = CONTRACT_COLOR[b.transactions[0]?.contract ?? ""] ?? "#857d6e";
              return (
                <div key={b.number} className="flex items-center">
                  <Link
                    href={`/ledger?block=${b.number}`}
                    scroll={false}
                    className={cn(
                      "group relative w-[150px] rounded-2xl border p-3 transition hover:-translate-y-1",
                      active ? "border-ink bg-ink text-paper shadow-xl" : "border-line bg-paper/60 hover:border-ink-2",
                    )}
                  >
                    <div className="absolute inset-x-3 top-0 h-1 rounded-b" style={{ background: c }} />
                    <div className={cn("font-mono text-[10px] uppercase tracking-wider", active ? "text-turmeric" : "text-muted")}>Block</div>
                    <div className="font-display text-2xl leading-tight">#{b.number}</div>
                    <div className={cn("mt-1 truncate font-mono text-[10px]", active ? "text-paper/70" : "text-ink-2")}>{b.transactions[0]?.fn}</div>
                    <div className={cn("mt-2 font-mono text-[9.5px]", active ? "text-paper/50" : "text-muted")}>{b.hash.slice(0, 12)}…</div>
                  </Link>
                  {i < blocks.length - 1 && (
                    <svg width="34" height="20" className="shrink-0 text-madder"><path d="M0 10 C 10 2, 24 18, 34 10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {selected && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="overflow-hidden">
            <div className="weave px-6 py-5 text-paper">
              <Kicker className="text-paper/60">Block header</Kicker>
              <div className="font-display text-4xl">#{selected.number}</div>
              <div className="mt-1 text-sm text-paper/60">{dateFmt(selected.timestamp, true)} · {timeAgo(selected.timestamp)}</div>
            </div>
            <dl className="divide-y divide-line/60 text-sm">
              {[
                ["Block hash", selected.hash],
                ["Previous hash", selected.prevHash],
                ["Merkle root", selected.merkleRoot],
              ].map(([k, v]) => (
                <div key={k} className="px-6 py-3.5">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</dt>
                  <dd className="mt-1 break-all font-mono text-[11.5px] text-ink">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between px-6 py-3.5"><dt className="text-muted">Channel</dt><dd className="font-mono text-xs">{selected.channel}</dd></div>
              <div className="flex justify-between gap-4 px-6 py-3.5">
                <dt className="text-muted">Endorsed by</dt>
                <dd className="text-right font-mono text-xs">{safeJson<string[]>(selected.endorsers, []).join(", ")}</dd>
              </div>
              <div className="flex justify-between px-6 py-3.5">
                <dt className="text-muted">Navigate</dt>
                <dd className="flex gap-3 font-mono text-xs">
                  {selected.number > 0 && <Link className="text-indigo hover:underline" href={`/ledger?block=${selected.number - 1}`} scroll={false}>← #{selected.number - 1}</Link>}
                  {selected.number < height - 1 && <Link className="text-indigo hover:underline" href={`/ledger?block=${selected.number + 1}`} scroll={false}>#{selected.number + 1} →</Link>}
                </dd>
              </div>
            </dl>
          </Card>

          <div className="space-y-4">
            {selected.transactions.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: CONTRACT_COLOR[t.contract] ?? "#857d6e" }} />
                    <span className="font-mono text-sm">{t.contract}.<b>{t.fn}</b>()</span>
                  </div>
                  <span className="rounded-full bg-leaf-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-leaf">{t.status}</span>
                </div>
                <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
                  <div><Kicker>Tx hash</Kicker><div className="mt-1 break-all font-mono text-[11px]">{t.id}</div></div>
                  <div>
                    <Kicker>Submitter</Kicker>
                    <div className="mt-1 font-mono text-xs">{t.submitterMsp}</div>
                    <div className="text-xs text-muted">{mspToOrg.get(t.submitterMsp) ?? "Orderer"}</div>
                    {t.lotCode && <Link href={`/lots/${t.lotCode}`} className="mt-1 inline-block font-mono text-xs text-indigo hover:underline">{t.lotCode}</Link>}
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto border-t border-dashed border-line bg-paper/70 px-5 py-4 font-mono text-[11px] leading-relaxed text-ink-2">
                  {JSON.stringify(safeJson(t.args), null, 2)}
                </pre>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader kicker="endorsement failed · never committed" title="Rejected invocations" />
        <ul className="divide-y divide-line/60">
          {rejected.map((t) => (
            <li key={t.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <Ban size={16} className="hidden shrink-0 text-madder sm:block" />
              <span className="shrink-0 font-mono text-xs">{t.contract}.<b>{t.fn}</b></span>
              <span className="flex-1 text-sm text-madder">{t.reason}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted">{mspToOrg.get(t.submitterMsp) ?? t.submitterMsp} · {timeAgo(t.createdAt)}</span>
            </li>
          ))}
          {!rejected.length && <li className="px-5 py-6 text-sm text-muted">No rejected invocations.</li>}
        </ul>
      </Card>
    </div>
  );
}
