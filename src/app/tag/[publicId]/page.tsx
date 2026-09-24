import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getJourney } from "@/lib/trace";
import { safeJson } from "@/lib/domain";
import { Logo } from "@/components/stage-icon";
import { fmt } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata = { title: "Hang tag" };

export default async function TagPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const p = await prisma.passport.findUnique({ where: { publicId }, include: { lot: { include: { owner: true } } } });
  if (!p) notFound();
  const j = await getJourney(p.lotId);
  const farm = j.orgs.find((o) => o.type === "FARM");

  return (
    <div className="grain flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="no-print text-center">
        <div className="font-display text-3xl">Printable hang tag</div>
        <p className="text-sm text-muted">Front and back · print at 100% on 300 gsm card</p>
        <PrintButton />
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        <Tag>
          <div className="flex h-full flex-col px-7 pb-7 pt-12 text-paper" style={{ background: p.colorHex }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-70">{p.lot.owner.name}</div>
            <div className="mt-3 font-display text-4xl leading-[1]">{p.productName}</div>
            <div className="mt-3 text-xs opacity-75">{p.style}</div>
            <div className="mt-auto space-y-1 font-mono text-[10.5px] opacity-80">
              <div>Grown · {farm?.city ?? "India"}</div>
              <div>Travelled · {fmt(j.metrics.transportKm)} km</div>
              <div>Organic · {fmt(j.metrics.organicPct)}%</div>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-white/25 pt-4 text-xs opacity-80">
              <Logo size={20} /> traced by CottonTrace
            </div>
          </div>
        </Tag>
        <Tag>
          <div className="flex h-full flex-col items-center px-7 pb-7 pt-12 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Scan to meet the makers</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${p.publicId}`} alt="QR code" className="mt-5 size-44" />
            <div className="mt-3 font-mono text-sm font-bold tracking-wider">{p.publicId}</div>
            <div className="mt-5 w-full border-t border-dashed border-line pt-4 text-left">
              {safeJson<string[]>(p.care, []).slice(0, 4).map((c) => (
                <div key={c} className="text-[11px] leading-5 text-ink-2">· {c}</div>
              ))}
            </div>
            <div className="mt-auto text-[10px] text-muted">Size {p.sizes} · 100% cotton</div>
          </div>
        </Tag>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[280px] overflow-hidden bg-card shadow-xl ring-1 ring-line print:shadow-none" style={{ clipPath: "polygon(20% 0, 80% 0, 100% 7%, 100% 100%, 0 100%, 0 7%)", borderRadius: 14, height: 470 }}>
      <div className="eyelet absolute left-1/2 top-3 z-10 -translate-x-1/2" />
      {children}
    </div>
  );
}
