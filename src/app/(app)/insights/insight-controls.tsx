"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { reviewAnomalyAction, runScanAction } from "@/app/actions/insights";
import { Button } from "@/components/ui";

export function ScanButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await runScanAction();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(`Scan complete — ${res.data.total} findings, ${res.data.created} new`);
          router.refresh();
        })
      }
    >
      <Sparkles size={15} className={pending ? "animate-spin" : ""} /> {pending ? "Scanning network…" : "Run anomaly scan"}
    </Button>
  );
}

export function ReviewControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const review = (s: "CONFIRMED" | "DISMISSED" | "OPEN") =>
    start(async () => {
      const res = await reviewAnomalyAction({ id, status: s, note: note || undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(s === "OPEN" ? "Re-opened" : `Marked ${s.toLowerCase()}`);
      router.refresh();
    });

  if (status !== "OPEN")
    return (
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" className="h-8 text-xs" disabled={pending} onClick={() => review("OPEN")}><RotateCcw size={13} /> Re-open</Button>
      </div>
    );
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-line pt-4 sm:flex-row">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note (optional)" className="h-9 flex-1 rounded-full border border-line bg-paper/60 px-4 text-sm outline-none focus:border-indigo" />
      <div className="flex gap-2">
        <Button variant="outline" className="h-9" disabled={pending} onClick={() => review("DISMISSED")}><X size={14} /> Dismiss</Button>
        <Button variant="danger" className="h-9" disabled={pending} onClick={() => review("CONFIRMED")}><Check size={14} /> Confirm</Button>
      </div>
    </div>
  );
}
