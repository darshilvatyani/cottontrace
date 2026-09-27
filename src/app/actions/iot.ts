"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { anchorSensorBatch } from "@/lib/chain/contracts";
import { merkleRoot, sha256, canonical } from "@/lib/chain/ledger";
import { METRICS } from "@/lib/domain";
import { simulateReadings } from "@/lib/iot";
import { prisma } from "@/lib/prisma";
import { actorOf, requireMember } from "@/lib/session";
import { run } from "./_run";

const deviceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  hardware: z.enum(["ESP32", "RASPBERRY_PI"]),
  metrics: z.array(z.string().refine((m) => m in METRICS)).min(1),
  lotId: z.string().optional().nullable(),
  fieldId: z.string().optional().nullable(),
});

export async function registerDeviceAction(payload: z.input<typeof deviceSchema>) {
  return run(async () => {
    const user = await requireMember();
    const input = deviceSchema.parse(payload);
    const n = (await prisma.device.count()) + 1;
    const code = `${input.hardware === "ESP32" ? "ESP" : "RPI"}-${user.organization.code}-${String(n).padStart(3, "0")}`;
    const device = await prisma.device.create({
      data: {
        code,
        name: input.name,
        hardware: input.hardware,
        metrics: JSON.stringify(input.metrics),
        apiKey: `ctk_${randomBytes(18).toString("hex")}`,
        topic: `cottontrace/${user.organization.code.toLowerCase()}/${code.toLowerCase()}`,
        orgId: user.organization.id,
        lotId: input.lotId || null,
        fieldId: input.fieldId || null,
      },
    });
    revalidatePath("/iot");
    return { id: device.id, code };
  });
}

export async function simulateReadingsAction(deviceId: string, opts: { count?: number; spike?: boolean } = {}) {
  return run(async () => {
    const user = await requireMember();
    const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { org: true } });
    if (!device) throw new Error("Device not found");
    if (device.orgId !== user.organization.id && user.role !== "ADMIN") throw new Error("Device belongs to another organisation");
    const count = Math.min(opts.count ?? 12, 96);
    const readings = simulateReadings({
      metrics: JSON.parse(device.metrics),
      orgType: device.org.type,
      count,
      intervalMin: 20,
      spikeAt: opts.spike ? count - 2 : null,
    });
    await prisma.sensorReading.createMany({ data: readings.map((r) => ({ ...r, deviceId: device.id, lotId: device.lotId })) });
    await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    revalidatePath("/iot");
    return { count: readings.length };
  });
}

/** Commit a Merkle root of the latest un-anchored readings to the ledger. */
export async function anchorReadingsAction(deviceId: string) {
  return run(async () => {
    const user = await requireMember();
    const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const readings = await prisma.sensorReading.findMany({ where: { deviceId }, orderBy: { recordedAt: "desc" }, take: 200 });
    if (!readings.length) throw new Error("No readings to anchor");
    const leaves = readings.map((r) => sha256(canonical({ m: r.metric, v: r.value, t: r.recordedAt.toISOString() })));
    const { txHash, blockNumber } = await anchorSensorBatch(actorOf(user), {
      deviceCode: device.code,
      count: readings.length,
      merkleRoot: merkleRoot(leaves),
      from: readings[readings.length - 1].recordedAt,
      to: readings[0].recordedAt,
    });
    revalidatePath("/iot");
    revalidatePath("/ledger");
    return { txHash, blockNumber, count: readings.length };
  });
}
