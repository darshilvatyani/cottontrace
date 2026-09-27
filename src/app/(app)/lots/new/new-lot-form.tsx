"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X, ArrowRight } from "lucide-react";
import { createLotAction } from "@/app/actions/lots";
import { Button, Card, Input, Kicker, Label, Select } from "@/components/ui";
import { LotIcon } from "@/components/stage-icon";
import { LOT_TYPES, type FieldDef, type LotType } from "@/lib/domain";
import { cn, fmt } from "@/lib/utils";

type InputLot = { id: string; code: string; type: string; name: string; available: number; unit: string; kgPerUnit: number };

export function NewLotForm({
  types,
  initialType,
  inputs,
  fields,
  preselect,
}: {
  types: LotType[];
  initialType: LotType;
  inputs: InputLot[];
  fields: { id: string; label: string }[];
  preselect?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<LotType>(initialType);
  const def = LOT_TYPES[type];
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [season, setSeason] = useState("Kharif 2026");
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [picked, setPicked] = useState<Record<string, string>>(() => {
    const p = inputs.find((i) => i.id === preselect);
    return p ? { [p.id]: String(p.available) } : {};
  });
  const [pending, start] = useTransition();

  const eligible = inputs.filter((i) => def.inputs.includes(i.type as LotType));
  const selected = eligible.filter((i) => picked[i.id] !== undefined);
  const qty = Number(quantity) || 0;
  const inputMass = selected.reduce((s, i) => s + (Number(picked[i.id]) || 0) * i.kgPerUnit, 0);
  const outputMass = type === "GARMENT_BATCH" ? qty * (Number(attrs.weightPerPiece) || 0.18) : qty;
  const ratio = inputMass ? outputMass / inputMass : 0;

  const checks = (() => {
    const list: { label: string; ok: boolean }[] = [
      { label: "Organisation authorised for this lot type", ok: true },
      { label: "Quantity greater than zero", ok: qty > 0 },
      { label: "Name provided", ok: name.trim().length >= 2 },
      ...def.attributes.filter((a) => a.required).map((a) => ({ label: `${a.label} provided`, ok: attrs[a.key] !== undefined && attrs[a.key] !== "" })),
    ];
    if (def.inputs.length) {
      list.push({ label: "At least one input lot selected", ok: selected.length > 0 });
      list.push({
        label: "Draws within available quantities",
        ok: selected.length > 0 && selected.every((i) => Number(picked[i.id]) > 0 && Number(picked[i.id]) <= i.available + 1e-6),
      });
    }
    if (def.maxYield) list.push({ label: `Mass balance ≤ ${Math.round(def.maxYield * 100)}% of input`, ok: inputMass > 0 && ratio <= def.maxYield });
    return list;
  })();

  function switchType(t: LotType) {
    setType(t);
    setAttrs({});
    setPicked({});
    router.replace(`/lots/new?type=${t}`, { scroll: false });
  }

  function submit() {
    start(async () => {
      const res = await createLotAction({
        type,
        name,
        quantity: qty,
        season: def.org === "FARM" ? season : null,
        fieldId: def.org === "FARM" ? fieldId || null : null,
        attributes: attrs,
        inputs: selected.map((i) => ({ lotId: i.id, quantity: Number(picked[i.id]) })),
      });
      if (!res.ok) {
        toast.error(res.rejected ? "Transaction rejected by smart contract" : "Could not create lot", { description: res.error });
        return;
      }
      toast.success(`${res.data.code} sealed in block #${res.data.blockNumber}`, { description: `tx ${res.data.txHash.slice(0, 16)}…` });
      router.push(`/lots/${res.data.code}`);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {types.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => switchType(t)}
                className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition", t === type ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-2")}
              >
                <LotIcon type={t} size={17} style={{ color: t === type ? "#d6a021" : LOT_TYPES[t].color }} /> {LOT_TYPES[t].label}
              </button>
            ))}
          </div>
        )}

        {def.inputs.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b border-line/70 px-5 py-4">
              <Kicker>Step 1 · Source material</Kicker>
              <h3 className="font-display text-lg">Which lots are being transformed?</h3>
            </div>
            {eligible.length ? (
              <div className="divide-y divide-line/60">
                {eligible.map((i) => {
                  const on = picked[i.id] !== undefined;
                  return (
                    <div key={i.id} className={cn("flex flex-wrap items-center gap-4 px-5 py-3.5 transition", on && "bg-indigo-soft/40")}>
                      <button
                        onClick={() => setPicked((p) => {
                          const n = { ...p };
                          if (on) delete n[i.id];
                          else n[i.id] = String(i.available);
                          return n;
                        })}
                        className={cn("grid size-6 place-items-center rounded-md border-2 transition", on ? "border-indigo bg-indigo text-paper" : "border-line bg-card")}
                        aria-label={`Select ${i.code}`}
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </button>
                      <span style={{ color: LOT_TYPES[i.type as LotType].color }}><LotIcon type={i.type} size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[13px] font-bold">{i.code}</div>
                        <div className="truncate text-xs text-muted">{i.name}</div>
                      </div>
                      <div className="text-right text-xs text-muted">
                        available<br /><span className="font-mono text-sm text-ink">{fmt(i.available, 1)} {i.unit}</span>
                      </div>
                      {on && (
                        <div className="flex w-36 items-center gap-1.5">
                          <Input type="number" step="any" min={0} max={i.available} value={picked[i.id]} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.value }))} className="h-9 text-right font-mono" />
                          <span className="text-xs text-muted">{i.unit}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-sm text-muted">
                You don&apos;t hold any active {def.inputs.map((t) => LOT_TYPES[t].plural.toLowerCase()).join(" or ")}.{" "}
                {def.inputs.includes("SEED_LOT") ? "Register a seed lot first." : "Accept an incoming handoff first."}
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="border-b border-line/70 px-5 py-4">
            <Kicker>{def.inputs.length ? "Step 2 · " : ""}Output identity</Kicker>
            <h3 className="font-display text-lg">Describe the new {def.label.toLowerCase()}</h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Lot name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${placeholderName(type)}`} />
            </div>
            <div>
              <Label hint={def.unit}>Quantity</Label>
              <Input type="number" step="any" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="font-mono" />
            </div>
            {def.org === "FARM" && (
              <>
                <div>
                  <Label>Season</Label>
                  <Input value={season} onChange={(e) => setSeason(e.target.value)} />
                </div>
                {fields.length > 0 && (
                  <div className="md:col-span-2">
                    <Label>Field</Label>
                    <Select value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
                      <option value="">— none —</option>
                      {fields.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </>
            )}
            {def.attributes.map((a) => (
              <AttrField key={a.key} def={a} value={attrs[a.key]} onChange={(v) => setAttrs((s) => ({ ...s, [a.key]: v }))} />
            ))}
          </div>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8 xl:self-start">
        <Card className="overflow-hidden">
          <div className="weave px-5 py-4 text-paper">
            <Kicker className="text-paper/60">Transaction preview</Kicker>
            <div className="mt-1 font-display text-xl">LotContract.createLot()</div>
          </div>
          <div className="p-5">
            {def.maxYield ? (
              <YieldGauge ratio={ratio} expected={def.expectedYield!} cap={def.maxYield} inputMass={inputMass} outputMass={outputMass} />
            ) : (
              <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                {type === "SEED_LOT" ? "Seed lots are the root of the genealogy — no inputs required." : "Harvest quantities are screened by the AI layer against field productivity (kg/ha)."}
              </div>
            )}
            <ul className="mt-5 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", c.ok ? "bg-leaf text-paper" : "bg-madder-soft text-madder")}>
                    {c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                  </span>
                  <span className={c.ok ? "text-ink-2" : "text-ink"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <Button onClick={submit} disabled={pending} className="mt-6 h-11 w-full">
              {pending ? "Endorsing & ordering…" : "Sign & submit transaction"} <ArrowRight size={15} />
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted">Failing checks are enforced on-chain too — a rejected invocation is logged in the ledger.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function placeholderName(t: LotType) {
  return {
    SEED_LOT: "Shankar-6 organic seed — North Plot",
    HARVEST_LOT: "First picking — North Plot",
    BALE: "Organic lint — press run 16",
    FIBRE_LOT: "Laydown 89",
    YARN_LOT: "Ne 30s combed compact",
    FABRIC_ROLL: "Single jersey 180 GSM",
    DYED_FABRIC: "Madder Red — natural vat",
    GARMENT_BATCH: "The Everyday Tee",
  }[t];
}

function AttrField({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.type === "boolean")
    return (
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-paper/60 px-3 py-2.5 md:self-end">
        <span className="text-sm font-semibold text-ink-2">{def.label}</span>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#25337a]" />
      </label>
    );
  return (
    <div>
      <Label hint={def.unit}>{def.label}{def.required && <span className="text-madder"> *</span>}</Label>
      {def.type === "select" ? (
        <Select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {def.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : def.type === "color" ? (
        <div className="flex items-center gap-2">
          <input type="color" value={(value as string) ?? "#27336b"} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-card" />
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="#27336b" className="font-mono" />
        </div>
      ) : (
        <Input
          type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
          step="any"
          value={(value as string | number) ?? ""}
          onChange={(e) => onChange(def.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          placeholder={def.placeholder}
        />
      )}
    </div>
  );
}

function YieldGauge({ ratio, expected, cap, inputMass, outputMass }: { ratio: number; expected: number; cap: number; inputMass: number; outputMass: number }) {
  const max = cap * 1.35;
  const angle = (v: number) => Math.PI * (1 - Math.min(v, max) / max);
  const pt = (v: number, r: number) => [100 + r * Math.cos(angle(v)), 100 - r * Math.sin(angle(v))];
  const arc = (a: number, b: number, r: number) => {
    const [x1, y1] = pt(a, r);
    const [x2, y2] = pt(b, r);
    return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const over = ratio > cap;
  const [nx, ny] = pt(ratio, 62);
  const [ex, ey] = pt(expected, 86);
  return (
    <div>
      <svg viewBox="0 0 200 116" className="w-full">
        <path d={arc(0, cap, 78)} stroke="#e1e8d3" strokeWidth="14" fill="none" />
        <path d={arc(cap, max, 78)} stroke="#f4dcd3" strokeWidth="14" fill="none" />
        {ratio > 0 && <path d={arc(0, Math.min(ratio, max), 78)} stroke={over ? "#b0412a" : "#56733a"} strokeWidth="14" fill="none" strokeLinecap="round" />}
        <line x1={ex} y1={ey} x2={pt(expected, 70)[0]} y2={pt(expected, 70)[1]} stroke="#1c1a16" strokeWidth="2" />
        <text x={ex} y={ey - 4} textAnchor="middle" className="fill-ink-2 font-mono text-[8px]">exp {Math.round(expected * 100)}%</text>
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="#1c1a16" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="100" r="5" fill="#1c1a16" />
        <text x="100" y="86" textAnchor="middle" className={cn("font-display text-[22px]", over ? "fill-madder" : "fill-ink")}>
          {ratio ? `${(ratio * 100).toFixed(1)}%` : "—"}
        </text>
      </svg>
      <div className="mt-1 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-paper-2 py-2">
          <div className="font-mono text-[10px] uppercase text-muted">input</div>
          <div className="font-mono text-sm font-bold">{fmt(inputMass, 1)} kg</div>
        </div>
        <div className="rounded-lg bg-paper-2 py-2">
          <div className="font-mono text-[10px] uppercase text-muted">output</div>
          <div className="font-mono text-sm font-bold">{fmt(outputMass, 1)} kg</div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-muted">Hard cap {Math.round(cap * 100)}% — anything above is rejected on-chain.</div>
    </div>
  );
}
