import Link from "next/link";
import { ArrowRight, QrCode, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { LOT_ORDER, LOT_TYPES } from "@/lib/domain";
import { ButtonLink } from "@/components/ui";
import { LotIcon, Logo } from "@/components/stage-icon";
import { fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STAGES = [
  { t: "SEED_LOT", title: "Seed & Farm", who: "Farmer", rec: "Variety, field, season, sowing, irrigation, soil sensors" },
  { t: "HARVEST_LOT", title: "Harvest", who: "Farmer", rec: "Harvest lot ID, quantity, moisture, source fields" },
  { t: "BALE", title: "Ginning", who: "Ginner", rec: "Bale grade, staple, micronaire, source harvest lots" },
  { t: "FIBRE_LOT", title: "Blending", who: "Spinner", rec: "Mixing recipe, laydown, cleaning efficiency" },
  { t: "YARN_LOT", title: "Spinning", who: "Spinner", rec: "Count, twist, CSP, machine, energy meter" },
  { t: "FABRIC_ROLL", title: "Knitting", who: "Knitter", rec: "Construction, GSM, width, length, yarn inputs" },
  { t: "DYED_FABRIC", title: "Dyeing", who: "Dyer", rec: "Dye class, shade, water & energy, wastewater test" },
  { t: "GARMENT_BATCH", title: "Garment", who: "Manufacturer", rec: "Style, QC pass rate, piece weight, passport" },
] as const;

export default async function Landing() {
  const [user, blocks, lots, orgs, passport] = await Promise.all([
    getCurrentUser(),
    prisma.block.count(),
    prisma.lot.count(),
    prisma.organization.count(),
    prisma.passport.findFirst({ where: { published: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const demoPassport = passport ? `/p/${passport.publicId}` : "/scan";

  return (
    <div className="grain min-h-screen overflow-x-hidden bg-paper">
      {/* ── Nav ── */}
      <header className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="font-display text-2xl tracking-tight">CottonTrace</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-ink-2 md:flex">
          <a href="#journey" className="hover:text-ink">The journey</a>
          <a href="#stack" className="hover:text-ink">Technology</a>
          <a href="#demo" className="hover:text-ink">Demo</a>
          <Link href="/scan" className="hover:text-ink">Scan a tag</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard" variant="ink">Open console <ArrowRight size={15} /></ButtonLink>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" className="hidden sm:inline-flex">Sign in</ButtonLink>
              <ButtonLink href="/sign-up" variant="ink">Join network</ButtonLink>
            </>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto grid max-w-[1320px] gap-10 px-5 pb-20 pt-6 md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:pt-12">
        {/* the thread */}
        <svg className="pointer-events-none absolute inset-0 -z-0 h-full w-full" viewBox="0 0 1320 720" preserveAspectRatio="none" aria-hidden>
          <path
            d="M-20 610 C 180 520, 240 700, 420 600 S 700 380, 860 470 S 1100 640, 1180 420 S 1260 120, 1360 160"
            fill="none"
            stroke="#b0412a"
            strokeWidth="2.2"
            pathLength={1}
            className="thread-draw"
            strokeLinecap="round"
          />
          <path
            d="M-20 630 C 200 560, 260 720, 440 630 S 720 420, 880 500 S 1120 660, 1200 450 S 1280 150, 1360 190"
            fill="none"
            stroke="#25337a"
            strokeWidth="1.2"
            strokeDasharray="3 7"
            opacity=".45"
          />
        </svg>

        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-2">
            <span className="size-1.5 rounded-full bg-madder" /> Blockchain · IoT · AI · Digital Product Passport
          </div>
          <h1 className="font-display text-[clamp(3rem,7.4vw,6.6rem)] leading-[0.92] tracking-[-0.035em] text-ink">
            Every thread
            <br />
            <em className="font-normal italic text-indigo">remembers</em> where
            <br />
            it came from.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
            CottonTrace gives every seed lot, bale, cone of yarn and roll of fabric a digital identity — then stitches
            their transformations into a tamper-evident ledger that ends in a scannable passport on the garment.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/sign-in"} className="h-12 px-6 text-[15px]">
              Enter the console <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href={demoPassport} variant="outline" className="h-12 px-6 text-[15px]">
              <QrCode size={16} /> See a live passport
            </ButtonLink>
          </div>

          <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-dashed border-line pt-6">
            {[
              [fmt(blocks), "blocks sealed"],
              [fmt(lots), "material lots"],
              [fmt(orgs), "network members"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-4xl tracking-tight">{v}</dt>
                <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* swinging hang tag */}
        <div className="relative z-10 flex justify-center lg:justify-end">
          <div className="relative mt-4 w-[330px] origin-top animate-sway sm:w-[360px]">
            <svg className="absolute -top-24 left-1/2 -translate-x-1/2" width="120" height="110" viewBox="0 0 120 110" aria-hidden>
              <path d="M60 0 C 58 40, 30 60, 60 104" fill="none" stroke="#1c1a16" strokeWidth="1.6" />
            </svg>
            <div
              className="relative overflow-hidden bg-card shadow-[0_30px_60px_-30px_rgba(20,27,69,0.55)] ring-1 ring-line"
              style={{ clipPath: "polygon(22% 0, 78% 0, 100% 9%, 100% 100%, 0 100%, 0 9%)", borderRadius: 18 }}
            >
              <div className="weave relative px-7 pb-6 pt-10 text-paper">
                <div className="eyelet absolute left-1/2 top-3 -translate-x-1/2" />
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/60">Digital Product Passport</div>
                <div className="mt-2 font-display text-[28px] leading-tight">The Everyday Indigo Tee</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-paper/70">
                  <span className="size-3 rounded-full bg-[#27336b] ring-2 ring-paper/40" /> Indigo Night · 180 GSM organic jersey
                </div>
              </div>
              <div className="px-7 py-5">
                <ol className="relative space-y-3 border-l border-dashed border-madder/50 pl-5">
                  {[
                    ["Rajkot, Gujarat", "Hand-picked organic cotton"],
                    ["Kadi, Gujarat", "Ginned · 21 bales"],
                    ["Coimbatore, TN", "Ne 30s compact yarn"],
                    ["Erode, TN", "Natural indigo vat"],
                    ["Bengaluru, KA", "Cut, sewn, AQL 2.5"],
                  ].map(([p, d], i) => (
                    <li key={p} className="relative">
                      <span className="absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full bg-card ring-2 ring-madder">
                        {i === 4 && <span className="size-1.5 rounded-full bg-madder" />}
                      </span>
                      <div className="text-[13px] font-semibold text-ink">{p}</div>
                      <div className="text-xs text-muted">{d}</div>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex items-end justify-between border-t border-dashed border-line pt-4">
                  <div>
                    <div className="stamp text-teal">Verified · ledger</div>
                    <div className="mt-2 font-mono text-[10px] text-muted">3,459 km · 17.8 L · 0.79 kg CO₂e</div>
                  </div>
                  <QrGlyph />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="weave relative -rotate-1 overflow-hidden py-4 text-paper shadow-lg">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-2xl italic">
          {[...Array(2)].flatMap((_, k) =>
            LOT_ORDER.map((t, i) => (
              <span key={`${k}-${t}`} className="flex items-center gap-10">
                <span className="flex items-center gap-3">
                  <LotIcon type={t} size={24} className="text-turmeric" />
                  {LOT_TYPES[t].label}
                </span>
                {i < LOT_ORDER.length - 1 || k === 0 ? <span className="font-mono text-sm not-italic text-paper/40">──→</span> : null}
              </span>
            )),
          )}
        </div>
      </div>

      {/* ── Journey ── */}
      <section id="journey" className="mx-auto max-w-[1320px] px-5 py-24 md:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-madder">01 — Chain of custody</div>
            <h2 className="mt-3 font-display text-5xl leading-[1] tracking-tight md:text-6xl">
              Eight hands.<br />
              <em className="italic text-indigo">One unbroken thread.</em>
            </h2>
          </div>
          <p className="max-w-xl text-[17px] leading-relaxed text-ink-2">
            Cotton is split, mixed and transformed at every step. CottonTrace records parent → child relationships
            between lots — not just transfers — so a single T-shirt can be traced back to the exact fields, harvests
            and bales it was made from, with mass-balance checks at every conversion.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => {
            const def = LOT_TYPES[s.t];
            return (
              <div key={s.t} className="stitch group relative rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-1" style={{ color: def.color }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-xl" style={{ background: `${def.color}18` }}>
                    <LotIcon type={s.t} size={26} />
                  </span>
                  <span className="font-display text-5xl italic opacity-20">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="mt-5 font-display text-2xl text-ink">{s.title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em]">signed by {s.who}</div>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{s.rec}</p>
                {def.expectedYield && (
                  <div className="mt-4 border-t border-dashed border-line pt-3 font-mono text-[11px] text-muted">
                    expected yield {Math.round(def.expectedYield * 100)}% · hard cap {Math.round((def.maxYield ?? 1) * 100)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Stack ── */}
      <section id="stack" className="relative bg-ink py-24 text-paper">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-turmeric">02 — The digital layer</div>
          <h2 className="mt-3 max-w-3xl font-display text-5xl leading-[1] tracking-tight md:text-6xl">
            Six technologies, <em className="italic text-turmeric">woven</em> into one fabric of trust.
          </h2>

          <div className="mt-14 grid gap-4 md:grid-cols-6">
            <Tile className="md:col-span-4" kicker="Permissioned blockchain" title="Hash-linked blocks, per-organisation identities">
              <div className="mt-6 flex items-center gap-2 overflow-hidden">
                {["#56", "#57", "#58", "#59"].map((b, i) => (
                  <div key={b} className="flex items-center gap-2">
                    <div className="w-32 rounded-xl border border-white/15 bg-white/[0.04] p-3 font-mono text-[10px] text-paper/60">
                      <div className="font-display text-lg text-paper">Block {b}</div>
                      <div>prev a3f{i}…9c</div>
                      <div>root 7be{i}…12</div>
                    </div>
                    {i < 3 && <span className="text-turmeric">⟶</span>}
                  </div>
                ))}
              </div>
            </Tile>
            <Tile className="md:col-span-2" kicker="Smart contracts" title="Rules that refuse bad data">
              <pre className="mt-5 overflow-hidden rounded-xl bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-paper/80">
{`require(lot.exists)
require(qty <= lot.available)
require(out <= in × 0.45)
require(role == AUDITOR)`}
              </pre>
            </Tile>
            <Tile className="md:col-span-2" kicker="Internet of Things" title="ESP32 & Raspberry Pi sensors">
              <svg viewBox="0 0 200 60" className="mt-6 w-full">
                <path d="M0 40 Q 20 10 40 30 T 80 28 T 120 36 T 160 12 T 200 30" fill="none" stroke="#d6a021" strokeWidth="2" />
                <path d="M0 50 Q 25 40 50 46 T 100 44 T 150 48 T 200 42" fill="none" stroke="#9fb4ff" strokeWidth="1.5" opacity=".7" />
              </svg>
              <p className="mt-3 text-sm text-paper/60">Soil moisture, humidity, water & energy — Merkle-anchored to the ledger.</p>
            </Tile>
            <Tile className="md:col-span-2" kicker="AI & analytics" title="Anomaly scores for human review">
              <div className="mt-5 space-y-2">
                {[["Yield ratio", 0.91], ["Duplicate cert.", 0.88], ["Sensor spike", 0.74]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-xs text-paper/60"><span>{l}</span><span className="font-mono">{v}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-madder" style={{ width: `${(v as number) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </Tile>
            <Tile className="md:col-span-2" kicker="GIS" title="Supply-chain maps">
              <svg viewBox="0 0 200 90" className="mt-5 w-full">
                <path d="M30 20 Q 80 5 110 40 T 170 70" fill="none" stroke="#d6a021" strokeWidth="1.5" strokeDasharray="4 4" />
                {[[30, 20], [70, 16], [110, 40], [140, 62], [170, 70]].map(([x, y]) => (
                  <circle key={x} cx={x} cy={y} r="5" fill="#b0412a" stroke="#fbf8f2" strokeWidth="1.5" />
                ))}
              </svg>
              <p className="mt-2 text-sm text-paper/60">Every hop from Rajkot to Mumbai, drawn to scale.</p>
            </Tile>
            <Tile className="md:col-span-3" kicker="QR + Digital Product Passport" title="Scan the tag, read the story">
              <p className="mt-3 max-w-sm text-sm text-paper/60">
                Consumers see origin, processing, certifications, water, energy and carbon per garment — never the
                commercial secrets behind them.
              </p>
            </Tile>
            <Tile className="md:col-span-3" kicker="Computer graphics & multimedia" title="3D garment, animated fibre-to-fabric story">
              <p className="mt-3 max-w-sm text-sm text-paper/60">
                A real-time WebGL garment dyed in the passport&apos;s exact shade, an animated seed-to-cloth timeline and
                interactive material-flow graphs.
              </p>
            </Tile>
          </div>
        </div>
      </section>

      {/* ── Demo ── */}
      <section id="demo" className="mx-auto max-w-[1320px] px-5 py-24 md:px-10">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-card p-8 md:p-14">
          <div className="absolute -right-10 -top-10 size-64 rounded-full bg-turmeric/20 blur-3xl" />
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-madder">03 — Demonstration scenario</div>
          <h2 className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Farm A → Gin A → Spinning Mill A → Knitting A → Dye House A → Garment Factory A → Brand A
          </h2>
          <p className="mt-5 max-w-2xl text-ink-2">
            The console ships with a complete, verifiable journey — and a few deliberate irregularities (an impossible
            ginning outturn, a borrowed organic certificate, a sensor spike) for the AI layer and auditors to catch.
            Every demo account uses the password <code className="rounded bg-paper-2 px-1.5 font-mono text-sm">cotton123</code>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/sign-in" variant="primary" className="h-12 px-6">Try a role <ArrowRight size={16} /></ButtonLink>
            <ButtonLink href="/scan" variant="outline" className="h-12 px-6"><ScanLine size={16} /> Scan a passport</ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted md:flex-row md:items-center md:px-10">
          <div className="flex items-center gap-2">
            <Logo size={22} /> CottonTrace — Cotton Seed-to-Cloth Production · Major Project
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em]">Blockchain · IoT · AI · GIS · 3D · DPP</div>
        </div>
      </footer>
    </div>
  );
}

function Tile({ kicker, title, children, className }: { kicker: string; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${className ?? ""}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-turmeric">{kicker}</div>
      <div className="mt-2 font-display text-2xl leading-tight">{title}</div>
      {children}
    </div>
  );
}

function QrGlyph() {
  // decorative QR-like glyph
  const cells = "1110111010001101011101110001010011101011100010111010111011101110".split("");
  return (
    <div className="grid grid-cols-8 gap-[2px] rounded-md bg-card p-1 ring-1 ring-line">
      {cells.map((c, i) => (
        <span key={i} className={`size-[5px] ${c === "1" ? "bg-ink" : "bg-transparent"}`} />
      ))}
    </div>
  );
}
