"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 11, fill: "#857d6e", fontFamily: "var(--font-jetbrains)" };

function TipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 font-semibold text-ink">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {typeof p.value === "number" ? p.value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : p.value} {unit}
        </div>
      ))}
    </div>
  );
}

export function StageBars({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4dccd" strokeDasharray="3 5" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(37,51,122,0.05)" }} content={<TipBox unit="lots" />} />
        <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={34}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ActivityArea({ data }: { data: { day: string; events: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="act" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b0412a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#b0412a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e4dccd" strokeDasharray="3 5" />
        <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<TipBox unit="events" />} />
        <Area type="monotone" dataKey="events" stroke="#b0412a" strokeWidth={2} fill="url(#act)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SensorChart({
  data,
  color,
  unit,
  height = 180,
}: {
  data: { t: string; v: number; flagged?: boolean }[];
  color: string;
  unit: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4dccd" strokeDasharray="3 5" />
        <XAxis dataKey="t" tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tick={axis} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
        <Tooltip content={<TipBox unit={unit} />} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        {data.map((d, i) => (d.flagged ? <ReferenceDot key={i} x={d.t} y={d.v} r={5} fill="#b0412a" stroke="#fbf8f2" strokeWidth={2} /> : null))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScoreBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4dccd" strokeDasharray="3 5" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(176,65,42,0.06)" }} content={<TipBox unit="findings" />} />
        <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={["#d6c9a9", "#d6a021", "#d07a2a", "#b0412a", "#7a2a1a"][i] ?? "#b0412a"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
