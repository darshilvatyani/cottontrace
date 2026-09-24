import { METRICS } from "@/lib/domain";

type Profile = { base: number; amp: number; noise: number };

const PROFILES: Record<string, Record<string, Profile>> = {
  FARM: {
    TEMPERATURE: { base: 30, amp: 5, noise: 0.8 },
    HUMIDITY: { base: 58, amp: 12, noise: 2 },
    SOIL_MOISTURE: { base: 34, amp: 4, noise: 1.2 },
    WATER: { base: 140, amp: 40, noise: 12 },
    ENERGY: { base: 6, amp: 2, noise: 0.6 },
  },
  DEFAULT: {
    TEMPERATURE: { base: 33, amp: 3, noise: 0.6 },
    HUMIDITY: { base: 62, amp: 6, noise: 1.5 },
    SOIL_MOISTURE: { base: 30, amp: 3, noise: 1 },
    WATER: { base: 780, amp: 160, noise: 40 },
    ENERGY: { base: 42, amp: 9, noise: 2.5 },
  },
};

function gauss() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Generate realistic, diurnal sensor readings for a device. */
export function simulateReadings(opts: {
  metrics: string[];
  orgType: string;
  count: number;
  end?: Date;
  intervalMin?: number;
  spikeAt?: number | null;
}) {
  const { metrics, orgType, count } = opts;
  const end = opts.end ?? new Date();
  const interval = (opts.intervalMin ?? 30) * 60e3;
  const profiles = PROFILES[orgType] ?? PROFILES.DEFAULT;
  const out: { metric: string; value: number; unit: string; valid: boolean; recordedAt: Date }[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(end.getTime() - (count - 1 - i) * interval);
    const hour = t.getHours() + t.getMinutes() / 60;
    const diurnal = Math.sin(((hour - 9) / 24) * 2 * Math.PI);
    for (const m of metrics) {
      const p = profiles[m] ?? PROFILES.DEFAULT[m];
      const meta = METRICS[m];
      if (!p || !meta) continue;
      const sign = m === "HUMIDITY" || m === "SOIL_MOISTURE" ? -1 : 1;
      let value = p.base + sign * p.amp * diurnal + p.noise * gauss();
      if (opts.spikeAt != null && i === opts.spikeAt) value = p.base * (m === "WATER" || m === "ENERGY" ? 4.2 : 1.9);
      value = Math.max(meta.min, Math.round(value * 10) / 10);
      out.push({ metric: m, value, unit: meta.unit, valid: value >= meta.min && value <= meta.max, recordedAt: t });
    }
  }
  return out;
}
