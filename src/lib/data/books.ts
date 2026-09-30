import "server-only";

import { stat } from "node:fs/promises";

import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import { getFile, getProgress } from "@/lib/data/reading";
import { resolveStoragePath } from "@/lib/file-storage";
import type { Book, BookFileInfo, BookStatus, ProgressInfo } from "@/lib/types";

type BookRow = Omit<Book, "status"> & { status: string };

function isBookStatus(value: string): value is BookStatus {
  return value === "want" || value === "reading" || value === "finished";
}

export function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: isBookStatus(row.status) ? row.status : "want",
    pages: row.pages,
    notes: row.notes,
    rating: row.rating,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** All live (not soft-deleted) books, newest first. Seeds the demo shelf on first run. */
export async function listBooks(): Promise<Book[]> {
  await ensureInitialized(db);
  const rows = await db.book.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  return rows.map(toBook);
}

/** A single live book, or null when it is missing or soft-deleted. */
export async function getBook(id: string): Promise<Book | null> {
  await ensureInitialized(db);
  const row = await db.book.findFirst({ where: { id, deletedAt: null } });
  return row ? toBook(row) : null;
}

export async function getBookReading(id: string): Promise<{ file: (BookFileInfo & { missing: boolean }) | null; progress: ProgressInfo | null }> {
  await ensureInitialized(db);
  const file = await getFile(db, id);
  if (!file) return { file: null, progress: null };
  let missing = false;
  try {
    await stat(resolveStoragePath(file.storagePath));
  } catch {
    missing = true;
  }
  const info: BookFileInfo = { format: file.format, originalName: file.originalName, sizeBytes: file.sizeBytes, pageCount: file.pageCount };
  return { file: { ...info, missing }, progress: await getProgress(db, id) };
}
