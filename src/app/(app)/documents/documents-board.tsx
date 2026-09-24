"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, RotateCcw, ScanSearch, Skull, Upload, FileUp, Check, X } from "lucide-react";
import {
  restoreDocumentAction,
  tamperDocumentAction,
  uploadDocumentAction,
  verifyStoredDocumentAction,
  verifyUploadedDocumentAction,
} from "@/app/actions/documents";
import { Button, Card, CardHeader, Hash, Label, Select } from "@/components/ui";
import { DOC_KINDS } from "@/lib/domain";
import { cn, dateFmt } from "@/lib/utils";

type Doc = { id: string; name: string; kind: string; size: number; sha256: string; txHash: string | null; block: number | null; lot: string | null; org: string; by: string | null; createdAt: string };
type Integrity = { recorded: string; ledger: string | null; stored: string | null; candidate: string | null; txIntact: boolean; storedMatches: boolean; candidateMatches: boolean | null; blockNumber: number | null };

export function DocumentsBoard({ docs, lots, canTamper }: { docs: Doc[]; lots: { id: string; code: string }[]; canTamper: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit xl:sticky xl:top-8">
        <CardHeader kicker="anchor a new file" title="Upload & hash" />
        <form
          ref={formRef}
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const res = await uploadDocumentAction(f);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(`Anchored in block #${res.data.blockNumber}`, { description: `sha256 ${res.data.sha256.slice(0, 20)}…` });
              formRef.current?.reset();
              router.refresh();
            });
          }}
        >
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper/60 px-4 py-8 text-center hover:border-indigo">
            <Upload size={22} className="text-indigo" />
            <span className="text-sm font-semibold">Choose a certificate, report or photo</span>
            <span className="text-xs text-muted">max 8 MB</span>
            <input name="file" type="file" required className="w-full text-xs file:hidden" />
          </label>
          <div>
            <Label>Type</Label>
            <Select name="kind">{DOC_KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ").toLowerCase()}</option>)}</Select>
          </div>
          <div>
            <Label>Attach to lot</Label>
            <Select name="lotId">
              <option value="">— organisation document —</option>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Hashing…" : "Hash & anchor on-chain"}</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {docs.map((d) => (
          <DocRow key={d.id} d={d} canTamper={canTamper} />
        ))}
        {!docs.length && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">No documents yet.</p>}
      </div>
    </div>
  );
}

function DocRow({ d, canTamper }: { d: Doc; canTamper: boolean }) {
  const [result, setResult] = useState<Integrity | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: true; data: Integrity } | { ok: false; error: string }>, msg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      if (msg) toast(msg);
    });

  const verdict = result ? (result.candidate ? result.candidateMatches : result.storedMatches && result.txIntact) : null;

  return (
    <Card className={cn("overflow-hidden transition", verdict === false && "border-madder/60", verdict === true && "border-teal/50")}>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-soft text-indigo"><FileText size={20} /></span>
          <div className="min-w-0">
            <a href={`/api/documents/${d.id}`} target="_blank" className="block truncate font-semibold hover:underline">{d.name}</a>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="font-mono uppercase tracking-wider">{d.kind.replace("_", " ")}</span>·
              {d.lot ? <Link href={`/lots/${d.lot}`} className="font-mono text-indigo hover:underline">{d.lot}</Link> : <span>organisation</span>}·
              <span>{d.org}</span>·<span>{dateFmt(d.createdAt)}</span>·<span>{(d.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => verifyStoredDocumentAction(d.id))}>
            <ScanSearch size={14} /> Verify stored
          </Button>
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => fileRef.current?.click()}>
            <FileUp size={14} /> Compare my copy
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const f = new FormData();
              f.set("file", file);
              f.set("documentId", d.id);
              run(() => verifyUploadedDocumentAction(f));
              e.target.value = "";
            }}
          />
          {canTamper && (
            <>
              <Button variant="danger" className="h-9" disabled={pending} onClick={() => run(() => tamperDocumentAction(d.id), "Stored file edited behind the ledger's back")} title="Demo: modify the off-chain file">
                <Skull size={14} /> Tamper
              </Button>
              <Button variant="ghost" className="h-9" disabled={pending} onClick={() => run(() => restoreDocumentAction(d.id), "Original file restored")} title="Restore original">
                <RotateCcw size={14} />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-2 border-t border-dashed border-line bg-paper/50 px-5 py-3 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2"><span className="w-20 text-muted">anchored</span><Hash value={d.sha256} n={16} /></div>
        <div className="flex items-center gap-2"><span className="w-20 text-muted">ledger</span><span className="font-mono">{d.block != null ? `block #${d.block}` : "—"}</span><Hash value={d.txHash} n={8} /></div>
      </div>
      {result && (
        <div className={cn("px-5 py-4 text-sm", verdict ? "bg-teal-soft/60" : "bg-madder-soft/70")}>
          <div className="flex items-center gap-2 font-display text-lg">
            {verdict ? <Check size={18} className="text-teal" /> : <X size={18} className="text-madder" />}
            {verdict ? "Authentic — fingerprints match the ledger" : "Mismatch — this file is not the one that was anchored"}
          </div>
          <div className="mt-3 grid gap-1.5 font-mono text-[11px]">
            <Row label="ledger" v={result.ledger} ok />
            <Row label="stored file" v={result.stored} ok={result.storedMatches} />
            {result.candidate && <Row label="your copy" v={result.candidate} ok={!!result.candidateMatches} />}
            <div className="text-ink-2">tx payload intact: {result.txIntact ? "yes" : "NO"}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, v, ok }: { label: string; v: string | null; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-muted">{label}</span>
      <span className={cn("break-all", ok ? "text-ink" : "text-madder line-through decoration-madder/40")}>{v ?? "missing"}</span>
    </div>
  );
}
