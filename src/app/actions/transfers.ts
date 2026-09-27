"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { respondTransfer, transferLot } from "@/lib/chain/contracts";
import { actorOf, requireMember } from "@/lib/session";
import { run } from "./_run";

const transferSchema = z.object({
  lotId: z.string(),
  toOrgId: z.string().min(1, "Choose a receiving organisation"),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(300).optional(),
});

export async function createTransferAction(payload: z.input<typeof transferSchema>) {
  return run(async () => {
    const user = await requireMember();
    const input = transferSchema.parse(payload);
    const { txHash, blockNumber } = await transferLot(actorOf(user), input);
    revalidatePath("/lots", "layout");
    revalidatePath("/transfers");
    return { txHash, blockNumber };
  });
}

export async function respondTransferAction(transferId: string, action: "ACCEPT" | "REJECT" | "CANCEL") {
  return run(async () => {
    const user = await requireMember();
    const { result, txHash, blockNumber } = await respondTransfer(actorOf(user), { transferId, action });
    revalidatePath("/transfers");
    revalidatePath("/lots", "layout");
    revalidatePath("/dashboard");
    return { lotId: result.lotId, txHash, blockNumber };
  });
}
