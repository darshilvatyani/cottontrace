"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SCENES = ["Fibre", "Yarn", "Fabric", "Garment"] as const;

/** Animated fibre → yarn → fabric → garment transformation. */
type Captions = { fibre?: string; yarn?: string; fabric?: string; garment?: string };

export function FibreStory({ color = "#27336b", captions = {} }: { color?: string; captions?: Captions }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SCENES.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-paper-2/70">
        <AnimatePresence mode="wait">
          <motion.svg
            key={i}
            viewBox="0 0 320 240"
            className="absolute inset-0 h-full w-full"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.5 }}
          >
            {i === 0 && <FibreScene caption={captions.fibre ?? "Ginned lint fibres"} />}
            {i === 1 && <YarnScene caption={captions.yarn ?? "Twisted into yarn"} />}
            {i === 2 && <FabricScene color={color} caption={captions.fabric ?? "Knitted into fabric"} />}
            {i === 3 && <GarmentScene color={color} caption={captions.garment ?? "Cut, sewn & passport-tagged"} />}
          </motion.svg>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {SCENES.map((s, k) => (
          <button key={s} onClick={() => setI(k)} className="flex flex-1 flex-col items-center gap-1.5">
            <span className={cn("h-1 w-full rounded-full transition-colors", k <= i ? "bg-madder" : "bg-line")} />
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", k === i ? "text-ink" : "text-muted")}>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FibreScene({ caption }: { caption: string }) {
  const strands = Array.from({ length: 26 }, (_, k) => ({
    x: 30 + ((k * 47) % 260),
    y: 40 + ((k * 71) % 160),
    r: (k * 37) % 180,
    l: 30 + ((k * 13) % 30),
  }));
  return (
    <g>
      {strands.map((s, k) => (
        <g key={k} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`}>
          <motion.path
            d={`M0 0 q ${s.l / 4} -8 ${s.l / 2} 0 t ${s.l / 2} 0`}
            fill="none"
            stroke="#8a7f6a"
            strokeWidth="1.3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.85, x: [0, 4, 0], y: [0, -3, 0] }}
            transition={{ duration: 1.6, delay: k * 0.03, x: { repeat: Infinity, duration: 3 }, y: { repeat: Infinity, duration: 2.4 } }}
          />
        </g>
      ))}
      <Caption>{caption}</Caption>
    </g>
  );
}

function YarnScene({ caption }: { caption: string }) {
  const wave = (phase: number) => {
    let d = "M20 120";
    for (let x = 20; x <= 300; x += 4) d += ` L${x} ${120 + Math.sin(x / 11 + phase) * 16}`;
    return d;
  };
  return (
    <g>
      {[0, 2.1, 4.2].map((p, k) => (
        <motion.path
          key={k}
          d={wave(p)}
          fill="none"
          stroke={["#b0412a", "#d6a021", "#8a7f6a"][k]}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: k * 0.15, ease: "easeInOut" }}
        />
      ))}
      <motion.ellipse cx="300" cy="120" rx="14" ry="30" fill="#d6a021" initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ delay: 1.2, rotate: { repeat: Infinity, duration: 1.2, ease: "linear" } }} />
      <Caption>{caption}</Caption>
    </g>
  );
}

function FabricScene({ color, caption }: { color: string; caption: string }) {
  const rows = 9;
  const cols = 13;
  return (
    <g transform="translate(40 30)">
      {Array.from({ length: rows }).map((_, r) => (
        <motion.path
          key={`r${r}`}
          d={`M0 ${r * 18 + 9} ${Array.from({ length: cols }, (_, c) => `Q ${c * 18 + 9} ${r * 18 + 9 + (c % 2 === r % 2 ? -5 : 5)} ${c * 18 + 18} ${r * 18 + 9}`).join(" ")}`}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: r * 0.12 }}
        />
      ))}
      {Array.from({ length: cols }).map((_, c) => (
        <motion.line key={`c${c}`} x1={c * 18 + 9} y1="0" x2={c * 18 + 9} y2={rows * 18} stroke="#fbf8f2" strokeWidth="2" strokeOpacity="0.55" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.6 + c * 0.05 }} />
      ))}
      <Caption y={200} x={120}>{caption}</Caption>
    </g>
  );
}

function GarmentScene({ color, caption }: { color: string; caption: string }) {
  const d = "M130 40 Q160 62 190 40 L228 52 L270 92 L246 118 L222 102 L222 206 L98 206 L98 102 L74 118 L50 92 L92 52 Z";
  return (
    <g>
      <motion.path d={d} fill={color} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} />
      <motion.path d={d} fill="none" stroke="#1c1a16" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />
      <motion.path d="M102 196 H218" stroke="#fbf8f2" strokeWidth="1.5" strokeDasharray="4 4" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 1.4 }} />
      <motion.circle cx="182" cy="84" r="6" fill="#d6a021" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.6, type: "spring" }} />
      <Caption>{caption}</Caption>
    </g>
  );
}

function Caption({ children, x = 160, y = 225 }: { children: React.ReactNode; x?: number; y?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" className="fill-ink-2 font-mono text-[10px] uppercase tracking-[0.14em]">
      {children}
    </text>
  );
}
