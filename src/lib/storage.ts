/**
 * Off-chain document store. Only the SHA-256 digest of a file goes on the ledger.
 *
 *  - On Vercel (BLOB_STORE_ID via OIDC, or BLOB_READ_WRITE_TOKEN): Vercel Blob, private by default.
 *  - Locally without a token: files on disk under STORAGE_ROOT (default ./storage).
 *
 * Stored files are never overwritten. The tamper demo writes a *new* altered copy and
 * repoints the document at it, which avoids CDN caching and keeps restore trivial.
 */
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

const blobEnabled = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const blobAccess = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private");

export const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage");
const LOCAL_DIR = path.join(STORAGE_ROOT, "documents");
const PREFIX = "documents/";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
}

/** Save bytes and return an opaque storage reference (blob URL or local file name). */
export async function saveFile(name: string, bytes: Buffer, contentType = "application/octet-stream") {
  const key = `${randomUUID()}-${safeName(name)}`;
  if (blobEnabled()) {
    const blob = await put(`${PREFIX}${key}`, bytes, { access: blobAccess(), contentType, addRandomSuffix: false });
    return blob.url;
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), bytes);
  return key;
}

export async function readStored(ref: string): Promise<Buffer> {
  if (ref.startsWith("http")) {
    const res = await get(ref, { access: blobAccess(), useCache: false });
    if (!res || res.statusCode !== 200) throw new Error("Stored file is missing");
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  return readFile(path.join(LOCAL_DIR, path.basename(ref)));
}

export async function deleteStored(ref: string) {
  if (ref.startsWith("http")) await del(ref).catch(() => undefined);
  else await unlink(path.join(LOCAL_DIR, path.basename(ref))).catch(() => undefined);
}

/** Simulate a forged edit: flip a byte and append a note, saved as a new file. */
export async function forgeCopy(ref: string, name: string) {
  const bytes = Buffer.from(await readStored(ref));
  if (bytes.length) bytes[Math.floor(bytes.length / 2)] ^= 0x20;
  return saveFile(`tampered-${name}`, Buffer.concat([bytes, Buffer.from("\n[edited]")]));
}

/** Remove every stored document (used by the seed script). */
export async function clearStorage() {
  if (blobEnabled()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return;
  }
  await rm(LOCAL_DIR, { recursive: true, force: true });
  await mkdir(LOCAL_DIR, { recursive: true });
}
