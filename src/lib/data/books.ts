import "server-only";

import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import type { Book, BookStatus } from "@/lib/types";

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
