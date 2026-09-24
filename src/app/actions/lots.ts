"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { certifyLot, createLot, recordEvent } from "@/lib/chain/contracts";
import { LOT_ORDER, type LotType } from "@/lib/domain";
import { actorOf, requireMember } from "@/lib/session";
import { run } from "./_run";

const createSchema = z.object({
  type: z.enum(LOT_ORDER as [LotType, ...LotType[]]),
  name: z.string().trim().min(2).max(120),
  quantity: z.coerce.number().positive(),
  season: z.string().trim().max(40).optional().nullable(),
  fieldId: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  inputs: z.array(z.object({ lotId: z.string(), quantity: z.coerce.number().positive() })).default([]),
});

export async function createLotAction(payload: z.input<typeof createSchema>) {
  return run(async () => {
    const user = await requireMember();
    const input = createSchema.parse(payload);
    const { result, txHash, blockNumber } = await createLot(actorOf(user), { ...input, fieldId: input.fieldId || null });
    revalidatePath("/lots");
    revalidatePath("/dashboard");
    return { code: result.code, txHash, blockNumber };
  });
}

const eventSchema = z.object({
  lotId: z.string(),
  type: z.string(),
  title: z.string().trim().min(2).max(160),
  data: z.record(z.string(), z.unknown()).default({}),
});

export async function recordEventAction(payload: z.input<typeof eventSchema>) {
  return run(async () => {
    const user = await requireMember();
    const input = eventSchema.parse(payload);
    const { txHash, blockNumber } = await recordEvent(actorOf(user), input);
    revalidatePath("/lots", "layout");
    return { txHash, blockNumber };
  });
}

const certifySchema = z.object({
  lotId: z.string(),
  standard: z.string().trim().min(2),
  note: z.string().trim().max(400).optional(),
});

export async function certifyLotAction(payload: z.input<typeof certifySchema>) {
  return run(async () => {
    const user = await requireMember();
    const input = certifySchema.parse(payload);
    const { txHash, blockNumber } = await certifyLot(actorOf(user), input);
    revalidatePath("/lots", "layout");
    return { txHash, blockNumber };
  });
}
