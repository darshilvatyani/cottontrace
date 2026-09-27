import Link from "next/link";
import { Logo, LotIcon } from "@/components/stage-icon";
import { LOT_ORDER } from "@/lib/domain";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="weave relative hidden overflow-hidden p-12 text-paper lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="font-display text-2xl">CottonTrace</span>
        </Link>
        <div className="relative my-auto">
          <svg className="absolute -left-12 -top-24 h-[420px] w-[140%]" viewBox="0 0 600 420" aria-hidden>
            <path d="M0 380 C 120 300, 160 420, 260 330 S 420 120, 600 60" fill="none" stroke="#d6a021" strokeWidth="2" pathLength={1} className="thread-draw" />
          </svg>
          <div className="relative grid max-w-md grid-cols-4 gap-3">
            {LOT_ORDER.map((t, i) => (
              <div key={t} className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-turmeric" style={{ transform: `rotate(${(i % 3) - 1}deg)` }}>
                <LotIcon type={t} size={30} />
              </div>
            ))}
          </div>
          <blockquote className="relative mt-12 max-w-md font-display text-4xl leading-[1.1]">
            “Not replacing the loom — <em className="text-turmeric">adding a memory</em> to every thread that passes through it.”
          </blockquote>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">Seed-to-Cloth Project Report · Conclusion</p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">cotton-channel · permissioned · 10 organisations</div>
      </aside>
      <main className="grain flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[480px]">{children}</div>
      </main>
    </div>
  );
}
