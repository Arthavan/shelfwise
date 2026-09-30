"use server";

import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized, purgeSoftDeleted } from "@/lib/data/maintenance";
import { deleteBookFiles } from "@/lib/file-storage";
import type { ActionResult } from "@/lib/types";
import { idSchema } from "@/lib/validation";

const NOT_FOUND = "Book not found";
const UNDO_WINDOW_MS = 10 * 60 * 1000;

/**
 * D11: soft delete. Deliberately does NOT revalidate: the detail route would re-render into
 * "Book not found" before the client navigates away. The client's push("/") fetches fresh data.
 */
export async function deleteBook(input: { id: string }): Promise<ActionResult<{ id: string; title: string }>> {
  const parsed = idSchema.safeParse(input?.id);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const id = parsed.data;
  try {
    await ensureInitialized(db);
    const now = new Date();
    const purged = await purgeSoftDeleted(db, new Date(now.getTime() - UNDO_WINDOW_MS));
    await Promise.all(purged.map((purgedId) => deleteBookFiles(purgedId)));
    const book = await db.book.findFirst({ where: { id, deletedAt: null } });
    if (!book) return { ok: false, error: NOT_FOUND };
    await db.book.update({ where: { id }, data: { deletedAt: now } });
    return { ok: true, data: { id, title: book.title } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

/** Undo: every other field was untouched by deleteBook, so the restore is exact. */
export async function restoreBook(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = idSchema.safeParse(input?.id);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const id = parsed.data;
  try {
    await ensureInitialized(db);
    const book = await db.book.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!book) return { ok: false, error: NOT_FOUND };
    await db.book.update({ where: { id }, data: { deletedAt: null } });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
