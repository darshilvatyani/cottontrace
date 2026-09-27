"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Anchor, Copy, Plus, Zap, Activity } from "lucide-react";
import { anchorReadingsAction, registerDeviceAction, simulateReadingsAction } from "@/app/actions/iot";
import { Button, Card, CardHeader, Input, Kicker, Label, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { METRICS } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function DeviceControls({
  device,
  endpoint,
  canControl,
}: {
  device: { id: string; code: string; topic: string; apiKey: string | null; metrics: string[] };
  endpoint: string;
  canControl: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sample = JSON.stringify({ readings: device.metrics.slice(0, 2).map((m) => ({ metric: m, value: Math.round((METRICS[m].min + METRICS[m].max) / 3) })) });
  const curl = `curl -X POST ${endpoint} \\\n  -H "content-type: application/json" \\\n  -H "x-device-key: ${device.apiKey ?? "<device key>"}" \\\n  -d '${sample}'`;

  const act = (fn: () => Promise<{ ok: true; data: { count?: number; blockNumber?: number } } | { ok: false; error: string }>, msg: (d: { count?: number; blockNumber?: number }) => string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(msg(res.data));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {canControl && (
        <Card>
          <CardHeader kicker="device simulator" title="Drive this device" />
          <div className="grid gap-2 p-5">
            <Button variant="outline" disabled={pending} onClick={() => act(() => simulateReadingsAction(device.id, { count: 12 }), (d) => `${d.count} readings ingested`)}>
              <Activity size={15} /> Stream a normal burst (4 h)
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => act(() => simulateReadingsAction(device.id, { count: 12, spike: true }), (d) => `${d.count} readings with a spike — run an AI scan`)}>
              <Zap size={15} /> Inject an anomalous spike
            </Button>
            <Button disabled={pending} onClick={() => act(() => anchorReadingsAction(device.id), (d) => `${d.count} readings Merkle-anchored in block #${d.blockNumber}`)}>
              <Anchor size={15} /> Anchor readings to ledger
            </Button>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader kicker="connect real hardware" title="Ingest endpoint" />
        <div className="space-y-4 p-5 text-sm">
          <div>
            <Kicker>MQTT topic</Kicker>
            <div className="mt-1 font-mono text-xs">{device.topic}</div>
          </div>
          {device.apiKey && (
            <div>
              <Kicker>Device key</Kicker>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-paper-2 px-2 py-1.5 font-mono text-[11px]">{device.apiKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(device.apiKey!); toast("Key copied"); }} className="rounded-lg p-2 hover:bg-paper-2" aria-label="Copy key"><Copy size={14} /></button>
              </div>
            </div>
          )}
          <div className="relative">
            <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[11px] leading-relaxed text-paper/85">{curl}</pre>
            <button onClick={() => { navigator.clipboard.writeText(curl); toast("cURL copied"); }} className="absolute right-2 top-2 rounded-lg p-1.5 text-paper/60 hover:bg-white/10" aria-label="Copy"><Copy size={13} /></button>
          </div>
          <p className="text-xs text-muted">An ESP32 sketch or a Mosquitto → HTTP relay can post to this endpoint every few minutes.</p>
        </div>
      </Card>
    </div>
  );
}

export function RegisterDevice({ lots, fields }: { lots: { id: string; code: string }[]; fields: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<string[]>(["TEMPERATURE", "HUMIDITY"]);
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={15} /> Register device</Button>
      <Modal open={open} onClose={() => setOpen(false)} kicker="device registry" title="Register an IoT device">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const res = await registerDeviceAction({
                name: String(f.get("name")),
                hardware: f.get("hardware") as "ESP32" | "RASPBERRY_PI",
                metrics,
                lotId: String(f.get("lotId") || "") || null,
                fieldId: String(f.get("fieldId") || "") || null,
              });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(`${res.data.code} registered`);
              setOpen(false);
              router.push(`/iot?device=${res.data.id}`);
            });
          }}
        >
          <div>
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Dye jet #2 flow meter" />
          </div>
          <div>
            <Label>Hardware</Label>
            <Select name="hardware">
              <option value="ESP32">ESP32 (Wi-Fi microcontroller)</option>
              <option value="RASPBERRY_PI">Raspberry Pi (gateway)</option>
            </Select>
          </div>
          <div>
            <Label>Metrics</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(METRICS).map(([k, m]) => {
                const on = metrics.includes(k);
                return (
                  <button type="button" key={k} onClick={() => setMetrics((s) => (on ? s.filter((x) => x !== k) : [...s, k]))} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-ink bg-ink text-paper" : "border-line bg-card")}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Bind to lot</Label>
              <Select name="lotId"><option value="">—</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</Select>
            </div>
            <div>
              <Label>Field</Label>
              <Select name="fieldId"><option value="">—</option>{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
            </div>
          </div>
          <Button type="submit" disabled={pending || !metrics.length} className="w-full">{pending ? "Registering…" : "Register & issue key"}</Button>
        </form>
      </Modal>
    </>
  );
}
