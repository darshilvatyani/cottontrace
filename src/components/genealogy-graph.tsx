"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LOT_TYPES, type LotType } from "@/lib/domain";
import { fmt } from "@/lib/utils";

export type GNode = { id: string; code: string; type: string; name: string; quantity: number; unit: string; owner: string; massKg: number };
export type GEdge = { from: string; to: string; quantity: number; massKg: number };

const W = 176;
const H = 70;
const GX = 74;
const GY = 22;
const PAD = 16;

/** Material-flow graph: columns are transformation depth, ribbons are mass. */
export function GenealogyGraph({ nodes, edges, currentId }: { nodes: GNode[]; edges: GEdge[]; currentId: string }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const depth = new Map<string, number>();
    const parents = (id: string) => edges.filter((e) => e.to === id).map((e) => e.from);
    const visit = (id: string, seen = new Set<string>()): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const ps = parents(id);
      const d = ps.length ? Math.max(...ps.map((p) => visit(p, seen))) + 1 : 0;
      depth.set(id, d);
      return d;
    };
    nodes.forEach((n) => visit(n.id));
    const cols = new Map<number, GNode[]>();
    for (const n of nodes) cols.set(depth.get(n.id)!, [...(cols.get(depth.get(n.id)!) ?? []), n]);
    const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
    const pos = new Map<string, { x: number; y: number }>();
    for (const [c, list] of cols) {
      const offset = ((maxRows - list.length) * (H + GY)) / 2;
      list.forEach((n, r) => pos.set(n.id, { x: PAD + c * (W + GX), y: PAD + offset + r * (H + GY) }));
    }
    const width = PAD * 2 + (Math.max(...cols.keys()) + 1) * (W + GX) - GX;
    const height = PAD * 2 + maxRows * (H + GY) - GY;
    return { pos, width, height };
  }, [nodes, edges]);

  const maxMass = Math.max(1, ...edges.map((e) => e.massKg));
  const related = (id: string) => hover && (id === hover || edges.some((e) => (e.from === hover && e.to === id) || (e.to === hover && e.from === id)));

  return (
    <div className="overflow-x-auto scrollbar-none">
      <svg width={layout.width} height={layout.height} className="block min-w-full">
        <defs>
          <pattern id="gg-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#d9cfbd" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gg-dots)" opacity="0.6" />
        {edges.map((e, i) => {
          const a = layout.pos.get(e.from);
          const b = layout.pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + W;
          const y1 = a.y + H / 2;
          const x2 = b.x;
          const y2 = b.y + H / 2;
          const mid = (x1 + x2) / 2;
          const color = LOT_TYPES[nodes.find((n) => n.id === e.from)?.type as LotType]?.color ?? "#857d6e";
          const dim = hover && !(e.from === hover || e.to === hover);
          return (
            <g key={i} opacity={dim ? 0.15 : 1} className="transition-opacity">
              <path d={`M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={2 + (e.massKg / maxMass) * 14} strokeLinecap="round" />
              <path d={`M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1.4} className="thread-flow" />
              <text x={mid} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="fill-muted font-mono text-[9.5px]">
                {fmt(e.quantity, 1)}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = layout.pos.get(n.id)!;
          const def = LOT_TYPES[n.type as LotType];
          const current = n.id === currentId;
          const dim = hover && !related(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x} ${p.y})`}
              className="cursor-pointer transition-opacity"
              opacity={dim ? 0.3 : 1}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/lots/${n.code}`)}
            >
              <path
                d={`M16 0 H${W - 8} Q${W} 0 ${W} 8 V${H - 8} Q${W} ${H} ${W - 8} ${H} H16 L0 ${H - 16} V16 Z`}
                fill={current ? "#1c1a16" : "#fbf8f2"}
                stroke={current ? "#1c1a16" : "#d9cfbd"}
                strokeWidth={1.2}
              />
              <rect x={0} y={16} width={6} height={H - 32} fill={def?.color} />
              <circle cx={16} cy={H / 2} r={4.5} fill={current ? "#1c1a16" : "#f3ede2"} stroke={def?.color} strokeWidth={2} />
              <text x={30} y={20} className="font-mono text-[9px] uppercase tracking-[0.12em]" fill={current ? "#d6a021" : def?.color}>
                {def?.label}
              </text>
              <text x={30} y={37} className="font-mono text-[11.5px] font-bold" fill={current ? "#fbf8f2" : "#1c1a16"}>
                {n.code}
              </text>
              <text x={30} y={56} className="text-[10.5px]" fill={current ? "#f3ede2aa" : "#857d6e"}>
                {fmt(n.quantity, 1)} {n.unit} · {n.owner.length > 14 ? `${n.owner.slice(0, 13)}…` : n.owner}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
