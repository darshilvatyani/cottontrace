import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { METRICS } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

/**
 * HTTP bridge for field devices (ESP32 / Raspberry Pi) or an MQTT → HTTP relay.
 *
 *   POST /api/iot/ingest
 *   x-device-key: ctk_...
 *   { "readings": [{ "metric": "TEMPERATURE", "value": 31.4, "recordedAt": "2026-09-24T10:00:00Z" }] }
 */
const reading = z.object({
  metric: z.string().refine((m) => m in METRICS, "Unknown metric"),
  value: z.number().finite(),
  recordedAt: z.string().datetime().optional(),
});
const body = z.union([z.object({ readings: z.array(reading).min(1).max(500) }), reading]);

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-device-key");
  if (!key) return NextResponse.json({ error: "Missing x-device-key header" }, { status: 401 });
  const device = await prisma.device.findUnique({ where: { apiKey: key } });
  if (!device) return NextResponse.json({ error: "Unknown device key" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  const list = "readings" in parsed.data ? parsed.data.readings : [parsed.data];
  const allowed: string[] = JSON.parse(device.metrics);

  const rows = list.map((r) => {
    const meta = METRICS[r.metric];
    return {
      deviceId: device.id,
      lotId: device.lotId,
      metric: r.metric,
      value: r.value,
      unit: meta.unit,
      // Out-of-range or unexpected metrics are stored but flagged invalid for review
      valid: allowed.includes(r.metric) && r.value >= meta.min && r.value <= meta.max,
      recordedAt: r.recordedAt ? new Date(r.recordedAt) : new Date(),
    };
  });
  await prisma.sensorReading.createMany({ data: rows });
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ accepted: rows.length, invalid: rows.filter((r) => !r.valid).length, device: device.code });
}
