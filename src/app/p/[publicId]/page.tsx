import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Droplets, Factory, FileText, Leaf, MapPin, Recycle, Route, ShieldCheck, ShieldX, Shirt, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getJourney } from "@/lib/trace";
import { verifyChain, verifyLotRecord } from "@/lib/chain/ledger";
import { JOURNEY_STAGES, ORG_TYPES, safeJson, type OrgType } from "@/lib/domain";
import { Garment3D } from "@/components/garment-3d";
import { FibreStory } from "@/components/fibre-story";
import { SupplyMap } from "@/components/supply-map";
import { Logo, OrgIcon } from "@/components/stage-icon";
import { dateFmt, fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const p = await prisma.passport.findUnique({ where: { publicId } });
  return { title: p ? `${p.productName} — Product Passport` : "Passport not found" };
}

type Attrs = Record<string, string | number | boolean | undefined>;

export default async function PassportPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const passport = await prisma.passport.findUnique({ where: { publicId }, include: { lot: { include: { owner: true } } } });
  if (!passport || !passport.published) notFound();
  await prisma.passport.update({ where: { id: passport.id }, data: { scanCount: { increment: 1 } } });

  const journey = await getJourney(passport.lotId);
  const [checks, chain, passportTx] = await Promise.all([
    Promise.all(journey.lots.map((l) => verifyLotRecord(l))),
    verifyChain(),
    passport.txHash ? prisma.ledgerTx.findUnique({ where: { id: passport.txHash } }) : null,
  ]);
  const verified = checks.filter((c) => c.ok).length;
  const authentic = verified === checks.length && chain.ok;

  const originals = journey.lots.filter((l) => !/-S\d+$/.test(l.code));
  const attrsOf = (type: string) => originals.filter((l) => l.type === type).map((l) => safeJson<Attrs>(l.attributes));
  const first = <T,>(xs: T[]) => xs[0];
  const seed = first(attrsOf("SEED_LOT")) ?? {};
  const harvest = first(attrsOf("HARVEST_LOT")) ?? {};
  const bale = first(attrsOf("BALE")) ?? {};
  const fibre = first(attrsOf("FIBRE_LOT")) ?? {};
  const yarn = first(attrsOf("YARN_LOT")) ?? {};
  const fabric = first(attrsOf("FABRIC_ROLL")) ?? {};
  const dye = first(attrsOf("DYED_FABRIC")) ?? {};
  const garment = first(attrsOf("GARMENT_BATCH")) ?? {};
  const fields = originals.filter((l) => l.type === "HARVEST_LOT" && l.field).map((l) => l.field!);
  const irrigations = journey.events.filter((e) => e.type === "IRRIGATION").length;

  const highlights: Record<string, [string, unknown][]> = {
    FARM: [["Variety", seed.variety], ["Seed", seed.organic ? "Certified organic" : "Conventional"], ["Picking", harvest.picking], ["Fields", fields.map((f) => `${f.name} (${f.areaHa} ha)`).join(", ")], ["Irrigation logs", irrigations || undefined]],
    GIN: [["Grade", bale.grade], ["Staple", bale.staple && `${bale.staple} mm`], ["Micronaire", bale.micronaire], ["Strength", bale.strength && `${bale.strength} g/tex`]],
    SPINNING_MILL: [["Blend", fibre.mixing], ["Count", yarn.count], ["Method", yarn.method], ["Twist", yarn.tpi && `${yarn.tpi} TPI`]],
    WEAVING_UNIT: [["Construction", fabric.construction], ["Weight", fabric.gsm && `${fabric.gsm} GSM`], ["Width", fabric.width && `${fabric.width} cm`]],
    DYEING_UNIT: [["Dye", dye.dyeClass], ["Shade", dye.shade], ["Fastness", dye.fastness]],
    GARMENT_FACTORY: [["Style", garment.style], ["Finish", garment.stitching], ["QC pass rate", garment.qcPass && `${garment.qcPass}%`]],
  };

  const stages = JOURNEY_STAGES.map((s) => {
    const lots = originals.filter((l) => s.lot.includes(l.type as never));
    const orgs = [...new Map(lots.map((l) => [l.creator.id, l.creator])).values()];
    const dates = lots.map((l) => l.createdAt.getTime());
    const certs = journey.certifications.filter((c) => lots.some((l) => l.code === c.lot));
    return { ...s, lots, orgs, date: dates.length ? new Date(Math.min(...dates)) : null, certs };
  }).filter((s) => s.lots.length);

  const orgStep = new Map<string, number>();
  stages.forEach((s, i) => s.orgs.forEach((o) => orgStep.set(o.id, i + 1)));
  if (journey.target.ownerId !== journey.target.creatorId) orgStep.set(journey.target.ownerId, stages.length + 1);
  const origin = stages[0]?.orgs[0];
  const color = passport.colorHex;
  const m = journey.metrics;

  return (
    <div className="grain min-h-screen bg-paper pb-16">
      {/* ── top bar ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="font-display text-lg">CottonTrace</span>
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Digital Product Passport · {passport.publicId}</div>
      </header>

      {/* ── hero ── */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="relative aspect-square max-h-[560px] w-full overflow-hidden rounded-[32px]" style={{ background: `radial-gradient(circle at 50% 42%, ${color}33, ${color}14 45%, transparent 70%)` }}>
          <div className="absolute inset-6 rounded-full border border-dashed" style={{ borderColor: `${color}55` }} />
          <div className="absolute inset-0">
            <Garment3D color={color} />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted backdrop-blur">
            drag to rotate · dyed {passport.colorName}
          </div>
        </div>

        <div className="py-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-madder">{passport.lot.owner.name}</div>
          <h1 className="mt-2 font-display text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95] tracking-tight">{passport.productName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
            <span className="flex items-center gap-2"><span className="size-4 rounded-full ring-2 ring-card" style={{ background: color }} /> {passport.colorName}</span>
            <span className="text-line">|</span>
            <span>{passport.style}</span>
            <span className="text-line">|</span>
            <span>Sizes {passport.sizes}</span>
          </div>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">{passport.description}</p>

          <div className={`mt-7 flex items-center gap-4 rounded-2xl border p-4 ${authentic ? "border-teal/40 bg-teal-soft/50" : "border-madder/50 bg-madder-soft/60"}`}>
            {authentic ? <ShieldCheck size={36} className="shrink-0 text-teal" /> : <ShieldX size={36} className="shrink-0 text-madder" />}
            <div className="flex-1">
              <div className="font-display text-xl">{authentic ? "Authentic & verified" : "Verification warning"}</div>
              <div className="text-sm text-ink-2">
                {verified}/{checks.length} records match the ledger · {chain.blocks} blocks re-hashed{chain.ok ? " cleanly" : ` · ${chain.issues.length} integrity issues`}
              </div>
            </div>
            <span className={`stamp hidden sm:inline-flex ${authentic ? "text-teal" : "text-madder"}`}>{authentic ? "Genuine" : "Check"}</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [MapPin, "Grown in", origin ? origin.city : "—"],
              [Route, "Travelled", `${fmt(m.transportKm)} km`],
              [Factory, "Stages", `${stages.length} verified`],
              [Leaf, "Organic", `${fmt(m.organicPct)}%`],
            ].map(([Icon, l, v]) => {
              const I = Icon as typeof MapPin;
              return (
                <div key={l as string} className="rounded-2xl border border-line bg-card p-3">
                  <I size={16} className="text-madder" />
                  <dt className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">{l as string}</dt>
                  <dd className="font-display text-lg leading-tight">{v as string}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* ── impact ── */}
      <section className="mx-auto mt-16 max-w-6xl px-5">
        <SectionTitle n="01" title="Footprint of this garment" sub="Allocated by mass from every upstream lot to one piece" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Impact icon={<Droplets />} value={fmt(m.perPiece.waterL, 1)} unit="litres" label="Metered water" note="dye-house & irrigation sensors" color="#0f6b63" fill={Math.min(1, m.perPiece.waterL / 60)} />
          <Impact icon={<Zap />} value={fmt(m.perPiece.energyKwh, 2)} unit="kWh" label="Process energy" note="spinning & dyeing meters" color="#d6a021" fill={Math.min(1, m.perPiece.energyKwh / 3)} />
          <Impact icon={<Leaf />} value={fmt(m.perPiece.co2Kg, 2)} unit="kg CO₂e" label="Energy + transport" note="India grid 0.71 kg/kWh" color="#56733a" fill={Math.min(1, m.perPiece.co2Kg / 3)} />
          <Impact icon={<Route />} value={fmt(m.transportKm)} unit="km" label="Distance travelled" note={`${journey.legs.length} road legs`} color="#b0412a" fill={Math.min(1, m.transportKm / 5000)} />
        </div>
      </section>

      {/* ── transformation ── */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionTitle n="02" title="From boll to body" sub="The physical transformation, recorded at every step" />
          <p className="text-[15px] leading-relaxed text-ink-2">
            Cotton was picked by hand, ginned into bales, blended and spun into yarn, knitted into jersey, dyed and finally
            cut and sewn. Each step created a new digital identity linked to the ones before it — so this tee knows exactly
            which fields, bales and yarn cones it came from.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {journey.lots
              .filter((l) => !/-S\d+$/.test(l.code))
              .map((l) => (
                <span key={l.id} className="rounded-full border border-line bg-card px-2.5 py-1 font-mono text-[10.5px] text-ink-2">{l.code}</span>
              ))}
          </div>
        </div>
        <FibreStory
          color={color}
          captions={{
            fibre: bale.staple ? `Lint fibres · staple ${bale.staple} mm` : undefined,
            yarn: yarn.count ? `Spun into ${yarn.count} yarn${yarn.tpi ? ` · ${yarn.tpi} TPI` : ""}` : undefined,
            fabric: fabric.construction ? `${fabric.construction}${fabric.gsm ? ` · ${fabric.gsm} GSM` : ""}` : undefined,
          }}
        />
      </section>

      {/* ── journey ── */}
      <section className="mx-auto mt-20 max-w-6xl px-5">
        <SectionTitle n="03" title="The journey" sub="Every stop, signed on the ledger by the organisation that did the work" />
        <ol className="relative">
          <svg className="absolute left-[23px] top-0 h-full w-3 md:left-1/2 md:-translate-x-1/2" preserveAspectRatio="none" viewBox="0 0 12 100" aria-hidden>
            <path d="M6 0 C 12 12, 0 25, 6 37 S 12 62, 6 75 S 0 90, 6 100" fill="none" stroke="#b0412a" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeDasharray="4 5" />
          </svg>
          {stages.map((s, i) => {
            const right = i % 2 === 1;
            const org = s.orgs[0];
            const orgColor = ORG_TYPES[org.type as OrgType]?.color;
            return (
              <li key={s.key} className={`relative mb-8 pl-16 md:w-1/2 md:pl-0 ${right ? "md:ml-auto md:pl-14" : "md:pr-14"}`}>
                <span
                  className={`absolute left-0 top-4 grid size-12 place-items-center rounded-full border-4 border-paper text-paper shadow-md md:top-5 ${right ? "md:-left-6" : "md:-right-6 md:left-auto"}`}
                  style={{ background: orgColor }}
                >
                  <OrgIcon type={org.type} size={20} />
                </span>
                <div className="rounded-3xl border border-line bg-card p-6">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.2em]" style={{ color: orgColor }}>
                      Step {i + 1} · {s.title}
                    </span>
                    {s.date && <span className="font-mono text-[10.5px] text-muted">{dateFmt(s.date)}</span>}
                  </div>
                  <div className="mt-2 font-display text-2xl leading-tight">{s.orgs.map((o) => o.name).join(" + ")}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin size={13} /> {[...new Set(s.orgs.map((o) => `${o.city}, ${o.state}`))].join(" · ")}</div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {(highlights[s.key] ?? [])
                      .filter(([, v]) => v !== undefined && v !== "" && v !== null)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">{k}</dt>
                          <dd className="text-sm font-semibold">{String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                  {s.certs.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.certs.map((c) => (
                        <span key={c.standard} className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-semibold text-teal">
                          <BadgeCheck size={13} /> {c.standard}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 border-t border-dashed border-line pt-3 font-mono text-[10px] text-muted">
                    signed by {org.mspId} · {s.lots.map((l) => l.code).join(", ")}
                  </div>
                </div>
              </li>
            );
          })}
          {journey.target.ownerId !== journey.target.creatorId && (
            <li className="relative pl-16 md:mx-auto md:w-fit md:pl-0">
              <div className="rounded-full border-2 border-ink bg-ink px-6 py-3 text-center text-paper md:mt-4">
                <Shirt size={18} className="mx-auto mb-1 text-turmeric" />
                <div className="font-display text-lg">Delivered to {passport.lot.owner.name}</div>
                <div className="font-mono text-[10px] text-paper/60">{passport.lot.owner.city} · passport issued {dateFmt(passport.createdAt)}</div>
              </div>
            </li>
          )}
        </ol>
      </section>

      {/* ── map ── */}
      <section className="mx-auto mt-16 max-w-6xl px-5">
        <SectionTitle n="04" title="On the map" sub={`${fmt(m.transportKm)} km by road across ${new Set(journey.orgs.map((o) => o.state)).size} states`} />
        <SupplyMap
          height={440}
          nodes={journey.orgs
            .filter((o) => orgStep.has(o.id))
            .map((o) => ({ id: o.id, name: o.name, type: o.type, city: `${o.city}, ${o.state}`, lat: o.lat, lng: o.lng, color: ORG_TYPES[o.type as OrgType].color, label: "", step: orgStep.get(o.id) }))}
          flows={journey.legs.map((l) => ({ from: l.from.id, to: l.to.id, kg: l.kg, label: `${l.from.city} → ${l.to.city} · ${fmt(l.km)} km` }))}
        />
      </section>

      {/* ── proof ── */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-6 px-5 lg:grid-cols-2">
        <div>
          <SectionTitle n="05" title="Certifications & evidence" sub="Documents stay private — their fingerprints are public" />
          <div className="space-y-3">
            {journey.certifications.map((c) => (
              <div key={`${c.standard}${c.lot}`} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
                <BadgeCheck className="shrink-0 text-teal" />
                <div>
                  <div className="font-semibold">{c.standard}</div>
                  <div className="text-xs text-muted">{c.by} · {c.lot} · {dateFmt(c.at)}</div>
                </div>
              </div>
            ))}
            {journey.documents
              .filter((d) => d.kind !== "INVOICE")
              .map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-card/60 p-4">
                  <FileText size={18} className="shrink-0 text-indigo" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{d.kind.replace("_", " ").toLowerCase()} · {d.org.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted">sha256 {d.sha256}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div>
          <SectionTitle n="06" title="Care & end of life" sub="Wear it longer, then close the loop" />
          <div className="rounded-3xl border border-line bg-card p-6">
            <ul className="space-y-2.5">
              {safeJson<string[]>(passport.care, []).map((c) => (
                <li key={c} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-madder" /> {c}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3 rounded-2xl bg-leaf-soft p-4 text-sm text-ink-2">
              <Recycle className="shrink-0 text-leaf" />
              <p>{passport.endOfLife}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-16 max-w-6xl px-5">
        <div className="weave rounded-3xl p-6 text-paper md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">Passport transaction</div>
              <div className="mt-1 break-all font-mono text-xs">{passport.txHash}</div>
              {passportTx?.blockNumber != null && <div className="mt-1 text-sm text-turmeric">sealed in block #{passportTx.blockNumber}</div>}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">This page</div>
              <div className="mt-1 text-sm">Scanned {passport.scanCount + 1} times · {journey.lots.length} linked lots</div>
            </div>
            <div className="text-sm text-paper/60">
              Commercial quantities, prices and personal data are never shown publicly. Supply-chain partners see the full
              record in the CottonTrace console.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-madder">{n}</div>
      <h2 className="mt-1 font-display text-3xl tracking-tight md:text-4xl">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Impact({ icon, value, unit, label, note, color, fill }: { icon: React.ReactNode; value: string; unit: string; label: string; note: string; color: string; fill: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-5">
      <div className="absolute bottom-0 left-0 w-full opacity-[0.12]" style={{ height: `${Math.max(8, fill * 100)}%`, background: color }} />
      <div className="relative">
        <span className="grid size-10 place-items-center rounded-xl text-paper" style={{ background: color }}>{icon}</span>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-4xl tracking-tight">{value}</span>
          <span className="text-sm text-muted">{unit}</span>
        </div>
        <div className="mt-1 font-semibold">{label}</div>
        <div className="text-xs text-muted">{note}</div>
      </div>
    </div>
  );
}
