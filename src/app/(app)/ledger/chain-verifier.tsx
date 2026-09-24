"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck, ShieldX, Skull, Play } from "lucide-react";
import { restoreLedgerAction, tamperLedgerAction, verifyChainAction } from "@/app/actions/ledger";
import { Button, Kicker } from "@/components/ui";
import { cn } from "@/lib/utils";

type Report = { ok: boolean; blocks: number; txs: number; issues: { block: number; kind: string; message: string }[] };

export function ChainVerifier({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [progress, setProgress] = useState(0);
  const [pending, start] = useTransition();

  const verify = () =>
    start(async () => {
      setReport(null);
      setProgress(0);
      const timer = setInterval(() => setProgress((p) => Math.min(95, p + 7)), 60);
      const res = await verifyChainAction();
      clearInterval(timer);
      setProgress(100);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setReport(res.data);
    });

  const tamper = () =>
    start(async () => {
      const res = await tamperLedgerAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.warning(`Block #${res.data.block}: quantity silently changed ${res.data.from} → ${res.data.to} kg`, { description: "Now run verification." });
      setReport(null);
      router.refresh();
    });

  const restore = () =>
    start(async () => {
      const res = await restoreLedgerAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Original transaction restored");
      setReport(null);
      router.refresh();
    });

  return (
    <div className={cn("overflow-hidden rounded-2xl border", report ? (report.ok ? "border-teal/40 bg-teal-soft/40" : "border-madder/50 bg-madder-soft/50") : "border-line bg-card")}>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-card ring-1 ring-line">
          {report ? report.ok ? <ShieldCheck size={28} className="text-teal" /> : <ShieldX size={28} className="text-madder" /> : <ShieldCheck size={28} className="text-muted" />}
        </div>
        <div className="flex-1">
          <Kicker>Integrity audit</Kicker>
          <div className="font-display text-xl">
            {report
              ? report.ok
                ? `All ${report.blocks} blocks and ${report.txs} transactions re-hash correctly`
                : `${report.issues.length} integrity violation${report.issues.length > 1 ? "s" : ""} detected`
              : "Recompute every transaction hash, Merkle root and block link"}
          </div>
          {pending && !report && (
            <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-indigo transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={verify} disabled={pending}><Play size={14} /> Verify chain</Button>
          {isAdmin && (
            <>
              <Button variant="danger" onClick={tamper} disabled={pending} title="Demo: edit a committed tx directly in the database">
                <Skull size={14} /> Simulate tampering
              </Button>
              <Button variant="outline" onClick={restore} disabled={pending}><RotateCcw size={14} /> Restore</Button>
            </>
          )}
        </div>
      </div>
      {report && !report.ok && (
        <ul className="space-y-1 border-t border-madder/30 px-5 py-4 font-mono text-xs text-madder">
          {report.issues.map((i, k) => (
            <li key={k}>✗ [{i.kind}] {i.message}</li>
          ))}
          <li className="pt-2 font-sans text-[13px] text-ink-2">
            The edited payload no longer hashes to the transaction ID sealed in the block&apos;s Merkle root. Rewriting
            the ID as well would change the root, the block hash, and every later block that links to it.
          </li>
        </ul>
      )}
    </div>
  );
}
