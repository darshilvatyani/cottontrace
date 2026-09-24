import Link from "next/link";
import { LOT_TYPES, type LotType } from "@/lib/domain";
import { cn, fmt } from "@/lib/utils";
import { LotIcon } from "./stage-icon";

export type LotTagData = {
  code: string;
  type: string;
  name: string;
  quantity: number;
  available: number;
  unit: string;
  status: string;
  certified: boolean;
  owner?: { name: string } | null;
};

export const STATUS_TONE: Record<string, string> = {
  ACTIVE: "text-leaf",
  IN_TRANSIT: "text-turmeric",
  CONSUMED: "text-muted",
  SOLD: "text-indigo",
};

/** A lot rendered as a garment hang-tag. */
export function LotTag({ lot, className, compact }: { lot: LotTagData; className?: string; compact?: boolean }) {
  const def = LOT_TYPES[lot.type as LotType];
  const used = lot.quantity ? 1 - lot.available / lot.quantity : 0;
  return (
    <Link
      href={`/lots/${lot.code}`}
      className={cn(
        "group relative block transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg]",
        className,
      )}
    >
      <div
        className="relative flex h-full overflow-hidden bg-card shadow-[0_1px_0_#d9cfbd,0_10px_24px_-18px_rgba(28,26,22,0.6)] ring-1 ring-line"
        style={{ clipPath: "polygon(26px 0, 100% 0, 100% 100%, 26px 100%, 0 calc(100% - 26px), 0 26px)", borderRadius: 14 }}
      >
        {/* eyelet strip */}
        <div className="relative flex w-9 shrink-0 items-center justify-center" style={{ background: def?.color ?? "#25337a" }}>
          <div className="eyelet" />
          <div className="absolute inset-y-3 right-1 border-r border-dashed border-white/40" />
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "p-3.5" : "p-4")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{def?.label}</div>
              <div className="truncate font-mono text-[13px] font-bold text-ink">{lot.code}</div>
            </div>
            <span className="shrink-0 rounded-full p-1.5" style={{ background: `${def?.color}1a`, color: def?.color }}>
              <LotIcon type={lot.type} size={18} />
            </span>
          </div>
          <div className={cn("mt-2 truncate font-display leading-snug text-ink", compact ? "text-[15px]" : "text-lg")}>{lot.name}</div>
          <div className="mt-auto pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="font-display text-2xl text-ink">{fmt(lot.available, 1)}</span>
                <span className="text-xs text-muted"> / {fmt(lot.quantity, 1)} {lot.unit}</span>
              </div>
              <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", STATUS_TONE[lot.status])}>
                ● {lot.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full" style={{ width: `${Math.max(0, 100 - used * 100)}%`, background: def?.color }} />
            </div>
            {!compact && (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{lot.owner?.name}</span>
                {lot.certified && <span className="stamp !text-[9px] !py-0.5 text-teal">Certified</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
