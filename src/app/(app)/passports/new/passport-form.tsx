"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { publishPassportAction } from "@/app/actions/passports";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

type Init = { productName: string; style: string; colorName: string; colorHex: string; sizes: string; description: string; care: string[]; endOfLife: string };

export function PassportForm({ lotId, brand, initial }: { lotId: string; brand: string; initial: Init }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, careText: initial.care.join("\n") });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <div className="md:col-span-2"><Label>Product name</Label><Input value={v.productName} onChange={set("productName")} /></div>
        <div><Label>Style</Label><Input value={v.style} onChange={set("style")} /></div>
        <div><Label>Sizes</Label><Input value={v.sizes} onChange={set("sizes")} /></div>
        <div><Label>Colour name</Label><Input value={v.colorName} onChange={set("colorName")} /></div>
        <div>
          <Label>Colour</Label>
          <div className="flex gap-2">
            <input type="color" value={v.colorHex} onChange={set("colorHex")} className="h-10 w-14 rounded-lg border border-line" />
            <Input value={v.colorHex} onChange={set("colorHex")} className="font-mono" />
          </div>
        </div>
        <div className="md:col-span-2"><Label>Story</Label><Textarea value={v.description} onChange={set("description")} /></div>
        <div><Label hint="one per line">Care instructions</Label><Textarea value={v.careText} onChange={set("careText")} className="min-h-32" /></div>
        <div><Label>End of life</Label><Textarea value={v.endOfLife} onChange={set("endOfLife")} className="min-h-32" /></div>
        <div className="md:col-span-2">
          <Button
            className="h-11"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await publishPassportAction({ lotId, ...v, care: v.careText.split("\n").map((s) => s.trim()).filter(Boolean) });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(`Passport ${res.data.publicId} is live`);
                router.push("/passports");
              })
            }
          >
            {pending ? "Publishing…" : "Sign & publish passport"} <ArrowRight size={15} />
          </Button>
        </div>
      </Card>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="mx-auto w-[300px] origin-top animate-sway">
          <div className="mx-auto h-16 w-px bg-ink" />
          <div className="overflow-hidden bg-card shadow-2xl ring-1 ring-line" style={{ clipPath: "polygon(20% 0, 80% 0, 100% 8%, 100% 100%, 0 100%, 0 8%)", borderRadius: 16 }}>
            <div className="relative px-6 pb-6 pt-10 text-paper" style={{ background: v.colorHex }}>
              <div className="eyelet absolute left-1/2 top-3 -translate-x-1/2" />
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">{brand}</div>
              <div className="mt-1 font-display text-2xl leading-tight">{v.productName || "Product name"}</div>
              <div className="mt-1 text-xs opacity-70">{v.style} · {v.colorName}</div>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <p className="line-clamp-4 text-ink-2">{v.description}</p>
              <div className="grid grid-cols-5 gap-1 pt-2">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className={`aspect-square ${[0, 1, 2, 4, 5, 9, 10, 12, 14, 15, 19, 20, 22, 23, 24].includes(i) ? "bg-ink" : "bg-paper-2"}`} />
                ))}
              </div>
              <div className="text-center font-mono text-[10px] text-muted">QR generated on publish</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
