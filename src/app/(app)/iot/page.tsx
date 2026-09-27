import Link from "next/link";
import { Cpu, Radio } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { hasNetworkView, requireMember } from "@/lib/session";
import { METRICS, safeJson } from "@/lib/domain";
import { Card, CardHeader, Empty, Kicker, PageHeader } from "@/components/ui";
import { SensorChart } from "@/components/charts";
import { cn, dateFmt, msAgo, timeAgo } from "@/lib/utils";
import { DeviceControls, RegisterDevice } from "./device-controls";

export const metadata = { title: "IoT Sensors" };

export default async function IotPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const user = await requireMember();
  const sp = await searchParams;
  const orgId = user.organization.id;
  const network = hasNetworkView(user);
  const devices = await prisma.device.findMany({
    where: network ? {} : { orgId },
    include: { org: true, lot: true, field: true, _count: { select: { readings: true } } },
    orderBy: { createdAt: "asc" },
  });
  const selected = devices.find((d) => d.id === sp.device) ?? devices[0];
  const readings = selected
    ? (await prisma.sensorReading.findMany({ where: { deviceId: selected.id }, orderBy: { recordedAt: "desc" }, take: 480 })).reverse()
    : [];
  const [myLots, myFields] = await Promise.all([
    prisma.lot.findMany({ where: { ownerId: orgId, status: "ACTIVE" }, select: { id: true, code: true } }),
    prisma.field.findMany({ where: { orgId }, select: { id: true, name: true } }),
  ]);
  const origin = appUrl();

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="ESP32 · Raspberry Pi · MQTT → HTTP bridge"
        title={<>Sensors in the <em className="italic text-indigo">field &amp; factory</em></>}
        action={<RegisterDevice lots={myLots} fields={myFields} />}
      >
        Devices post readings with their own API key. Values outside physical ranges are stored but flagged, batches are
        Merkle-anchored on the ledger, and the AI layer watches for spikes.
      </PageHeader>

      {devices.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map((d) => {
              const active = d.id === selected?.id;
              const online = d.lastSeenAt && d.lastSeenAt > msAgo(15 * 60e3);
              return (
                <Link
                  key={d.id}
                  href={`/iot?device=${d.id}`}
                  scroll={false}
                  className={cn("relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5", active ? "border-ink bg-ink text-paper shadow-xl" : "border-line bg-card hover:border-ink-2")}
                >
                  {/* circuit-board texture */}
                  <svg className="pointer-events-none absolute -right-6 -top-6 opacity-[0.12]" width="140" height="140" viewBox="0 0 140 140">
                    <path d="M10 70 H50 V30 H90 M50 70 H90 V110 H130 M70 10 V50 M110 30 V70" stroke="currentColor" strokeWidth="2" fill="none" />
                    {[[50, 30], [90, 30], [90, 110], [70, 50], [110, 70]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="currentColor" />)}
                  </svg>
                  <div className="flex items-center justify-between">
                    <span className={cn("rounded-md px-2 py-0.5 font-mono text-[10px] font-bold", active ? "bg-turmeric text-ink" : "bg-paper-2 text-ink-2")}>{d.hardware.replace("_", " ")}</span>
                    <span className={cn("flex items-center gap-1.5 font-mono text-[10px] uppercase", online ? "text-[#7fd48a]" : active ? "text-paper/50" : "text-muted")}>
                      <Radio size={12} /> {online ? "online" : d.lastSeenAt ? timeAgo(d.lastSeenAt) : "never"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Cpu size={18} className={active ? "text-turmeric" : "text-indigo"} />
                    <span className="font-display text-xl leading-tight">{d.name}</span>
                  </div>
                  <div className={cn("mt-1 font-mono text-[11px]", active ? "text-paper/60" : "text-muted")}>{d.code} · {d.org.name}</div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {safeJson<string[]>(d.metrics, []).map((m) => (
                      <span key={m} className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", active ? "bg-white/10" : "bg-paper-2")} style={active ? undefined : { color: METRICS[m]?.color }}>
                        {METRICS[m]?.label}
                      </span>
                    ))}
                  </div>
                  <div className={cn("mt-4 flex justify-between border-t border-dashed pt-3 text-xs", active ? "border-white/15 text-paper/60" : "border-line text-muted")}>
                    <span>{d._count.readings} readings</span>
                    <span className="font-mono">{d.lot?.code ?? d.field?.name ?? "unbound"}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {selected && (
            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader kicker={`${readings.length} most recent readings`} title={selected.name} />
                <div className="space-y-6 p-5">
                  {safeJson<string[]>(selected.metrics, []).map((m) => {
                    const series = readings.filter((r) => r.metric === m);
                    const last = series.at(-1);
                    const meta = METRICS[m];
                    if (!series.length) return null;
                    return (
                      <div key={m}>
                        <div className="mb-2 flex items-end justify-between">
                          <div>
                            <Kicker>{meta.label}</Kicker>
                            <div className="font-display text-3xl">{last?.value.toFixed(1)} <span className="text-base text-muted">{meta.unit}</span></div>
                          </div>
                          <div className="text-right font-mono text-[11px] text-muted">
                            min {Math.min(...series.map((r) => r.value)).toFixed(1)} · max {Math.max(...series.map((r) => r.value)).toFixed(1)}
                            <br />
                            {series.filter((r) => !r.valid).length} flagged invalid
                          </div>
                        </div>
                        <SensorChart color={meta.color} unit={meta.unit} data={series.map((r) => ({ t: dateFmt(r.recordedAt, true), v: r.value, flagged: !r.valid }))} />
                      </div>
                    );
                  })}
                  {!readings.length && <p className="py-8 text-center text-sm text-muted">No readings yet — simulate a burst or post from the device.</p>}
                </div>
              </Card>
              <DeviceControls
                canControl={selected.orgId === orgId || user.role === "ADMIN"}
                device={{ id: selected.id, code: selected.code, topic: selected.topic, apiKey: selected.orgId === orgId || user.role === "ADMIN" ? selected.apiKey : null, metrics: safeJson<string[]>(selected.metrics, []) }}
                endpoint={`${origin}/api/iot/ingest`}
              />
            </div>
          )}
        </>
      ) : (
        <Empty title="No devices registered" action={<RegisterDevice lots={myLots} fields={myFields} />}>
          Register an ESP32 or Raspberry Pi to start streaming temperature, humidity, soil moisture, water or energy.
        </Empty>
      )}
    </div>
  );
}
