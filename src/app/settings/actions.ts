"use server";

import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized, removeAllBooks, replaceWithDemoData } from "@/lib/data/maintenance";
import type { ActionResult } from "@/lib/types";

const DEMO_BOOK_COUNT = 12;

/** D11: replaces every book with the demo shelf and clears the reading goal. No undo. */
export async function restoreDemoData(): Promise<ActionResult<{ count: number }>> {
  try {
    await replaceWithDemoData(db, new Date());
    revalidatePath("/", "layout");
    return { ok: true, data: { count: DEMO_BOOK_COUNT } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

/** D11: hard-deletes every book (soft-deleted too). Keeps AppSettings (so nothing re-seeds) and the goal. */
export async function deleteAllBooks(): Promise<ActionResult<{ count: number }>> {
  try {
    // First run: create the AppSettings marker (seeding if empty) BEFORE deleting, so the next
    // page read cannot treat the DB as uninitialized and bring the demo shelf back.
    await ensureInitialized(db);
    const before = await db.book.count();
    await removeAllBooks(db);
    revalidatePath("/", "layout");
    return { ok: true, data: { count: before } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
