// No "server-only" here: relative imports only, like reading.ts, so it can be unit-tested.
import type { PrismaClient } from "../../generated/prisma/client";
import { deleteBookFiles, saveBookFile } from "../file-storage";
import { detectFormat } from "../upload";
import { attachFile } from "./reading";

export type StoreResult = { ok: true; format: "pdf" | "epub"; sizeBytes: number } | { ok: false; reason: "not-a-book" | "not-found" };

/** A client-reported PDF page count, kept only when it is plausible. */
function validPageCount(hint: number | null): number | null {
  return hint !== null && Number.isInteger(hint) && hint > 0 && hint <= 100_000 ? hint : null;
}

/** Removes files saved for a book that ended up with no attached file (never an attached one). */
async function cleanUpUnattached(db: PrismaClient, bookId: string): Promise<void> {
  try {
    if (!(await db.bookFile.findUnique({ where: { bookId }, select: { id: true } }))) await deleteBookFiles(bookId);
  } catch {
    // Best effort: an orphaned file on disk is harmless.
  }
}

/**
 * Stores a book file exactly as an upload does (shared by the upload and import routes): detects the
 * format by content, checks the book is still live, writes the file and attaches it (resetting
 * reading data). The caller has already checked the size and revalidates pages on success.
 */
export async function storeBookFile(
  db: PrismaClient,
  bookId: string,
  data: Buffer,
  originalName: string,
  pageCountHint: number | null,
): Promise<StoreResult> {
  const format = detectFormat(data);
  if (!format) return { ok: false, reason: "not-a-book" };
  if (!(await db.book.findFirst({ where: { id: bookId, deletedAt: null }, select: { id: true } }))) return { ok: false, reason: "not-found" };
  const pageCount = format === "pdf" ? validPageCount(pageCountHint) : null;
  const storagePath = await saveBookFile(bookId, format, data);
  let attached: boolean;
  try {
    attached = await attachFile(db, bookId, { format, originalName: originalName.slice(0, 200), storagePath, sizeBytes: data.length, pageCount });
  } catch (err) {
    await cleanUpUnattached(db, bookId);
    throw err;
  }
  if (!attached) {
    // The book was deleted while we were saving: keep nothing new.
    await cleanUpUnattached(db, bookId);
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, format, sizeBytes: data.length };
}
