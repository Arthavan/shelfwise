import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { attachFile } from "@/lib/data/reading";
import { saveBookFile } from "@/lib/file-storage";
import { detectFormat } from "@/lib/upload";

/** A client-reported PDF page count, kept only when it is plausible. */
function validPageCount(hint: number | null): number | null {
  return hint !== null && Number.isInteger(hint) && hint > 0 && hint <= 100_000 ? hint : null;
}

/**
 * Stores a book file exactly as an upload does (shared by the upload and import routes): detects the
 * format by content, writes it to disk, attaches it (resetting reading data) and revalidates pages.
 * Returns null when the bytes are neither a PDF nor an EPUB; the caller has already checked the size.
 */
export async function storeBookFile(
  bookId: string,
  data: Buffer,
  originalName: string,
  pageCountHint: number | null,
): Promise<{ format: "pdf" | "epub"; sizeBytes: number } | null> {
  const format = detectFormat(data);
  if (!format) return null;
  const pageCount = format === "pdf" ? validPageCount(pageCountHint) : null;
  const storagePath = await saveBookFile(bookId, format, data);
  await attachFile(db, bookId, { format, originalName: originalName.slice(0, 200), storagePath, sizeBytes: data.length, pageCount });
  revalidatePath("/", "layout");
  return { format, sizeBytes: data.length };
}
