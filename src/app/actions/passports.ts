"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publishPassport } from "@/lib/chain/contracts";
import { actorOf, requireMember } from "@/lib/session";
import { run } from "./_run";

const schema = z.object({
  lotId: z.string(),
  productName: z.string().trim().min(2).max(100),
  style: z.string().trim().min(2).max(80),
  colorName: z.string().trim().min(2).max(40),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sizes: z.string().trim().max(60),
  description: z.string().trim().max(600),
  care: z.array(z.string().trim().min(1)).max(8),
  endOfLife: z.string().trim().max(400),
});

export async function publishPassportAction(payload: z.input<typeof schema>) {
  return run(async () => {
    const user = await requireMember();
    const input = schema.parse(payload);
    const { result, txHash } = await publishPassport(actorOf(user), input);
    revalidatePath("/passports");
    revalidatePath("/lots", "layout");
    return { publicId: result.publicId, txHash };
  });
}
