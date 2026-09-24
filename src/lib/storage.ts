import { mkdir, readFile, writeFile, rename, access } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Off-chain document store (local disk). Only the SHA-256 digest goes on the ledger. */
/** Set STORAGE_ROOT to a persistent volume in production (e.g. /data/storage). */
export const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage");
export const STORAGE_DIR = path.join(STORAGE_ROOT, "documents");

export async function saveFile(name: string, bytes: Buffer) {
  await mkdir(STORAGE_DIR, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const rel = `${randomUUID()}-${safe}`;
  await writeFile(path.join(STORAGE_DIR, rel), bytes);
  return rel;
}

export async function readStored(rel: string) {
  return readFile(path.join(STORAGE_DIR, path.basename(rel)));
}

export async function tamperStored(rel: string) {
  const file = path.join(STORAGE_DIR, path.basename(rel));
  const backup = `${file}.orig`;
  const exists = await access(backup).then(() => true, () => false);
  if (!exists) {
    const bytes = await readFile(file);
    await writeFile(backup, bytes);
    // Simulate a forged edit: flip a byte in the middle and append a note.
    const copy = Buffer.from(bytes);
    if (copy.length) copy[Math.floor(copy.length / 2)] ^= 0x20;
    await writeFile(file, Buffer.concat([copy, Buffer.from("\n[edited]")]));
  }
}

export async function restoreStored(rel: string) {
  const file = path.join(STORAGE_DIR, path.basename(rel));
  const backup = `${file}.orig`;
  const exists = await access(backup).then(() => true, () => false);
  if (exists) await rename(backup, file);
  return exists;
}
