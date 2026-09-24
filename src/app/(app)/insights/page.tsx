import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasNetworkView, requireMember } from "@/lib/session";
import { safeJson } from "@/lib/domain";
import { Card, CardHeader, Kicker, PageHeader, Stat } from "@/components/ui";
import { ScoreBars } from "@/components/charts";
import { cn, timeAgo } from "@/lib/utils";
import { ReviewControls, ScanButton } from "./insight-controls";

export const metadata = { title: "AI Insights" };

const KIND_LABEL: Record<string, string> = {
  YIELD_RATIO: "Yield ratio",
  QUANTITY_OUTLIER: "Quantity outlier",
  DUPLICATE_RECORD: "Duplicate record",
  DUPLICATE_DOCUMENT: "Re-used document",
  PROCESS_DURATION: "Processing time",
  MISSING_EVENT: "Missing event",
  STALE_TRANSFER: "Stale shipment",
  SENSOR_OUTLIER: "Sensor outlier",
};
const SEV_COLOR: Record<string, string> = { LOW: "#d6a021", MEDIUM: "#d07a2a", HIGH: "#b0412a", CRITICAL: "#7a2a1a" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireMember();
  const sp = await searchParams;
  const status = sp.status ?? "OPEN";
  const network = hasNetworkView(user);
  const base = network ? {} : { orgId: user.organization.id };
  const [all, list] = await Promise.all([
    prisma.anomaly.findMany({ where: base, select: { status: true, score: true, kind: true } }),
    prisma.anomaly.findMany({
      where: { ...base, ...(status === "ALL" ? {} : { status }) },
      include: { lot: true, org: true, reviewedBy: true },
      orderBy: [{ score: "desc" }],
    }),
  ]);
  const count = (s: string) => all.filter((a) => a.status === s).length;
  const buckets = [
    ["0.5", 0.5, 0.6],
    ["0.6", 0.6, 0.75],
    ["0.75", 0.75, 0.9],
    ["0.9", 0.9, 0.97],
    ["0.97+", 0.97, 1.01],
  ].map(([label, lo, hi]) => ({ label: label as string, value: all.filter((a) => a.score >= (lo as number) && a.score < (hi as number)).length }));
  const kinds = Object.entries(all.reduce<Record<string, number>>((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {}));
  const canReview = ["AUDITOR", "ADMIN"].includes(user.role);

  return (
    <div className="space-y-8">
      <PageHeader kicker="assistance, not authority" title={<>Anomalies, <em className="italic text-indigo">scored for humans</em></>} action={<ScanButton />}>
        The engine blends domain rules (mass balance, field productivity, missing tests) with robust statistics over peer
        groups. It never rewrites data — it raises a score and queues the record for an auditor.
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open" value={count("OPEN")} accent="#b0412a" hint="awaiting review" />
        <Stat label="Confirmed" value={count("CONFIRMED")} accent="#7a2a1a" hint="escalated by auditors" />
        <Stat label="Dismissed" value={count("DISMISSED")} accent="#857d6e" hint="false positives" />
        <Stat label="Mean score" value={all.length ? (all.reduce((s, a) => s + a.score, 0) / all.length).toFixed(2) : "—"} accent="#d6a021" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex gap-2">
            {["OPEN", "CONFIRMED", "DISMISSED", "ALL"].map((s) => (
              <Link key={s} href={`/insights?status=${s}`} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", status === s ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2")}>
                {s.toLowerCase()}
              </Link>
            ))}
          </div>
          {list.map((a) => {
            const ev = safeJson<Record<string, unknown>>(a.evidence);
            const color = SEV_COLOR[a.severity];
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 shrink-0" style={{ background: color }} />
                  <div className="flex-1 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <ScoreRing score={a.score} color={color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{a.severity}</span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">· {KIND_LABEL[a.kind] ?? a.kind}</span>
                          {a.status !== "OPEN" && (
                            <span className={cn("stamp !text-[9px] !py-0.5", a.status === "CONFIRMED" ? "text-madder" : "text-muted")}>{a.status}</span>
                          )}
                        </div>
                        <h3 className="mt-1 font-display text-xl leading-snug">{a.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{a.detail}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {a.lot && <Link href={`/lots/${a.lot.code}`} className="rounded-md bg-indigo-soft px-2 py-0.5 font-mono text-[11px] font-bold text-indigo hover:underline">{a.lot.code}</Link>}
                          {a.org && <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[11px] text-ink-2">{a.org.name}</span>}
                          {Object.entries(ev)
                            .filter(([, v]) => typeof v === "number" || typeof v === "string")
                            .slice(0, 5)
                            .map(([k, v]) => (
                              <span key={k} className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-[10.5px] text-muted">
                                {k}={typeof v === "number" ? (Math.abs(v) < 10 ? v.toFixed(3) : Math.round(v)) : String(v).slice(0, 18)}
                              </span>
                            ))}
                        </div>
                        {a.reviewNote && (
                          <div className="mt-3 rounded-xl border border-dashed border-line bg-paper/60 px-3 py-2 text-xs text-ink-2">
                            <b>{a.reviewedBy?.name}</b> {a.reviewedAt && `· ${timeAgo(a.reviewedAt)}`}: {a.reviewNote}
                          </div>
                        )}
                      </div>
                    </div>
                    {canReview && <ReviewControls id={a.id} status={a.status} />}
                  </div>
                </div>
              </Card>
            );
          })}
          {!list.length && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">Nothing in this queue. Run a scan to re-evaluate the network.</p>}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader kicker="distribution" title="Anomaly scores" />
            <div className="p-4"><ScoreBars data={buckets} /></div>
          </Card>
          <Card>
            <CardHeader kicker="detectors" title="What fired" />
            <ul className="divide-y divide-line/60">
              {kinds.map(([k, n]) => (
                <li key={k} className="flex justify-between px-5 py-2.5 text-sm"><span>{KIND_LABEL[k] ?? k}</span><span className="font-mono">{n}</span></li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <Kicker>How a score is made</Kicker>
            <div className="mt-3 space-y-3 text-sm text-ink-2">
              <div className="rounded-xl bg-ink px-4 py-3 font-mono text-[12px] leading-relaxed text-paper">
                z = (x − median) / (1.4826 · MAD)
                <br />
                score = 1 / (1 + e<sup>−1.8(|z| − 2)</sup>)
              </div>
              <p>Median &amp; MAD resist the very outliers we hunt for. |z| = 2 maps to 0.5, |z| = 3 to ≈ 0.86.</p>
              <p>Deterministic checks (re-used certificate hashes, missing HVI tests, stale shipments) carry fixed prior scores.</p>
              <p className="text-xs text-muted">Severity: ≥ 0.9 critical · ≥ 0.75 high · ≥ 0.6 medium.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eae2d3" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={c} strokeDashoffset={c * (1 - score)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-mono text-sm font-bold">{score.toFixed(2)}</div>
    </div>
  );
}
