import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ContractError } from "@/lib/chain/ledger";

export type ActionResult<T = unknown> = { ok: true; data: T; message?: string } | { ok: false; error: string; rejected?: boolean };

/** Uniform error handling for server actions: contract rejections and validation errors become messages. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ContractError) return { ok: false, error: err.message, rejected: true };
    if (err instanceof ZodError) return { ok: false, error: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
    console.error(err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}
