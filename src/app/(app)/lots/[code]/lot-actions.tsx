"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, BadgeCheck, FilePlus2, NotebookPen, QrCode, Shuffle } from "lucide-react";
import { certifyLotAction, recordEventAction } from "@/app/actions/lots";
import { createTransferAction } from "@/app/actions/transfers";
import { uploadDocumentAction } from "@/app/actions/documents";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DOC_KINDS, EVENT_LABEL, LOT_TYPES, type LotType } from "@/lib/domain";

type Props = {
  lot: { id: string; code: string; type: string; status: string; available: number; unit: string };
  canOwn: boolean;
  canAttach: boolean;
  canCertify: boolean;
  canPassport: boolean;
  hasPassport: boolean;
  receivers: { id: string; name: string; type: string; city: string }[];
  events: string[];
  nextTypes: LotType[];
};

type Result = { ok: true; data: { blockNumber?: number } } | { ok: false; error: string; rejected?: boolean };

export function LotActions(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "transfer" | "event" | "doc" | "certify">(null);
  const [pending, start] = useTransition();

  const done = (res: Result, msg: string) => {
    if (!res.ok) {
      toast.error(res.rejected ? "Rejected by smart contract" : "Action failed", { description: res.error });
      return;
    }
    toast.success(msg, { description: res.data.blockNumber != null ? `Sealed in block #${res.data.blockNumber}` : undefined });
    setOpen(null);
    router.refresh();
  };

  const active = p.lot.status === "ACTIVE";
  const btn = "inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 h-10 text-sm font-semibold text-ink hover:border-ink-2 hover:-translate-y-px transition disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className="flex flex-wrap gap-2">
      {p.canOwn &&
        active &&
        p.nextTypes.map((t) => (
          <Link key={t} href={`/lots/new?type=${t}&from=${p.lot.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-indigo px-4 text-sm font-semibold text-paper shadow-[0_2px_0_0_#141b45] hover:bg-indigo-deep">
            <Shuffle size={15} /> Transform → {LOT_TYPES[t].label}
          </Link>
        ))}
      {p.canOwn && (
        <button className={btn} disabled={!active || !p.receivers.length} onClick={() => setOpen("transfer")}>
          <ArrowLeftRight size={15} /> Hand off
        </button>
      )}
      {p.canOwn && p.events.length > 0 && (
        <button className={btn} onClick={() => setOpen("event")}>
          <NotebookPen size={15} /> Record event
        </button>
      )}
      {p.canAttach && (
        <button className={btn} onClick={() => setOpen("doc")}>
          <FilePlus2 size={15} /> Attach document
        </button>
      )}
      {p.canCertify && (
        <button className={btn} onClick={() => setOpen("certify")}>
          <BadgeCheck size={15} /> Certify
        </button>
      )}
      {p.canPassport && (
        <Link href={`/passports/new?lot=${p.lot.code}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-turmeric px-4 text-sm font-semibold text-ink shadow-[0_2px_0_0_#9b7412]">
          <QrCode size={15} /> {p.hasPassport ? "Update passport" : "Issue passport"}
        </Link>
      )}

      <Modal open={open === "transfer"} onClose={() => setOpen(null)} kicker="TransferContract · initiateTransfer" title={`Hand off ${p.lot.code}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () =>
              done(await createTransferAction({ lotId: p.lot.id, toOrgId: String(f.get("to")), quantity: Number(f.get("qty")), note: String(f.get("note") || "") || undefined }), "Handoff initiated"),
            );
          }}
        >
          <div>
            <Label>Receiving organisation</Label>
            <Select name="to" required>
              {p.receivers.map((o) => (
                <option key={o.id} value={o.id}>{o.name} · {o.city}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label hint={`${p.lot.available} ${p.lot.unit} available`}>Quantity</Label>
            <Input name="qty" type="number" step="any" min={0} defaultValue={p.lot.available} className="font-mono" />
            <p className="mt-1.5 text-xs text-muted">Sending part of the lot splits it — the receiver gets a child lot linked to this one.</p>
          </div>
          <div>
            <Label>Dispatch note</Label>
            <Input name="note" placeholder="Truck / invoice / e-way bill no." />
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Submitting…" : "Sign & dispatch"}</Button>
        </form>
      </Modal>

      <Modal open={open === "event"} onClose={() => setOpen(null)} kicker="EventContract · recordEvent" title="Record a traceability event">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () =>
              done(await recordEventAction({ lotId: p.lot.id, type: String(f.get("type")), title: String(f.get("title")), data: { notes: String(f.get("notes") || "") } }), "Event recorded"),
            );
          }}
        >
          <div>
            <Label>Event type</Label>
            <Select name="type">
              {p.events.map((e) => (
                <option key={e} value={e}>{EVENT_LABEL[e] ?? e}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input name="title" required placeholder="e.g. HVI test — all bales passed" />
          </div>
          <div>
            <Label>Notes / measurements</Label>
            <Textarea name="notes" placeholder="Values, observations, instrument IDs…" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Submitting…" : "Sign & record"}</Button>
        </form>
      </Modal>

      <Modal open={open === "doc"} onClose={() => setOpen(null)} kicker="DocumentContract · anchorDocument" title="Attach an off-chain document">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("lotId", p.lot.id);
            start(async () => done(await uploadDocumentAction(f), "Document hashed & anchored"));
          }}
        >
          <div>
            <Label>File</Label>
            <input name="file" type="file" required className="block w-full rounded-xl border border-dashed border-line bg-paper/60 p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-paper" />
          </div>
          <div>
            <Label>Document type</Label>
            <Select name="kind">
              {DOC_KINDS.map((k) => (
                <option key={k} value={k}>{k.replace("_", " ").toLowerCase()}</option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted">The file stays off-chain. Only its SHA-256 fingerprint is committed to the ledger, so any later edit is detectable.</p>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Hashing…" : "Hash & anchor"}</Button>
        </form>
      </Modal>

      <Modal open={open === "certify"} onClose={() => setOpen(null)} kicker="CertificationContract · certify" title={`Certify ${p.lot.code}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => done(await certifyLotAction({ lotId: p.lot.id, standard: String(f.get("standard")), note: String(f.get("note") || "") }), "Lot certified"));
          }}
        >
          <div>
            <Label>Standard / scheme</Label>
            <Input name="standard" required placeholder="e.g. Organic Content Standard — Transaction Certificate" />
          </div>
          <div>
            <Label>Audit note</Label>
            <Textarea name="note" placeholder="Scope, evidence reviewed, findings…" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing…" : "Sign certification"}</Button>
        </form>
      </Modal>
    </div>
  );
}
