import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "ghost" | "outline" | "danger" | "turmeric";

const variants: Record<Variant, string> = {
  primary: "bg-indigo text-paper hover:bg-indigo-deep shadow-[0_2px_0_0_#141b45]",
  ink: "bg-ink text-paper hover:bg-ink-2 shadow-[0_2px_0_0_#000]",
  turmeric: "bg-turmeric text-ink hover:brightness-95 shadow-[0_2px_0_0_#9b7412]",
  ghost: "text-ink-2 hover:bg-paper-2",
  outline: "border border-line bg-card text-ink hover:border-ink-2",
  danger: "bg-madder text-paper hover:brightness-95 shadow-[0_2px_0_0_#7a2a1a]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 h-10 text-sm font-semibold transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-card", className)} {...props} />;
}

export function CardHeader({ title, kicker, action, className }: { title: ReactNode; kicker?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4", className)}>
      <div>
        {kicker && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{kicker}</div>}
        <h3 className="font-display text-lg leading-tight text-ink">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted", className)}>{children}</div>;
}

export function PageHeader({ kicker, title, children, action }: { kicker?: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {kicker && <Kicker className="mb-2">{kicker}</Kicker>}
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl">{title}</h1>
        {children && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

const tones = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  indigo: "bg-indigo-soft text-indigo border-indigo/20",
  madder: "bg-madder-soft text-madder border-madder/20",
  turmeric: "bg-turmeric-soft text-[#8a6512] border-turmeric/30",
  leaf: "bg-leaf-soft text-leaf border-leaf/25",
  teal: "bg-teal-soft text-teal border-teal/25",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Stamp({ children, className, color = "text-teal" }: { children: ReactNode; className?: string; color?: string }) {
  return <span className={cn("stamp", color, className)}>{children}</span>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12px] tracking-tight", className)}>{children}</span>;
}

export function Stat({ label, value, unit, hint, accent = "#25337a" }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `repeating-linear-gradient(90deg, ${accent} 0 10px, transparent 10px 16px)` }} />
      <Kicker>{label}</Kicker>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-4xl tracking-tight text-ink">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center">
      <svg width="64" height="40" viewBox="0 0 64 40" className="mb-4 text-line">
        <path d="M2 30 C 14 4, 22 4, 32 20 S 50 36, 62 10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
        <circle cx="32" cy="20" r="4" fill="#d6a021" />
      </svg>
      <div className="font-display text-xl text-ink">{title}</div>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const inputCls =
  "w-full h-10 rounded-xl border border-line bg-paper/60 px-3 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-indigo focus:bg-card focus:ring-4 focus:ring-indigo/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputCls, "h-auto min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputCls, "appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23857d6e' stroke-width='1.6'/></svg>\")" }} {...props} />;
}

export function Label({ children, hint, className }: { children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-2", className)}>
      <span>{children}</span>
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Hash({ value, n = 10, className }: { value?: string | null; n?: number; className?: string }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span title={value} className={cn("rounded-md bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2", className)}>
      {value.slice(0, n)}…{value.slice(-4)}
    </span>
  );
}
