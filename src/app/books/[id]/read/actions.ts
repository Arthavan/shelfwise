"use server";

import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import { saveProgress, startReading } from "@/lib/data/reading";
import type { ActionResult, ProgressInfo } from "@/lib/types";
import { idSchema, progressSchema } from "@/lib/validation";

/** Runs once when the reader opens: stamps lastReadAt and moves a Want to read book to Reading. */
export async function startReadingAction(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input?.id);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    await startReading(db, parsed.data, new Date());
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

/** Debounced from the reader. No revalidatePath: the reader must not re-render mid-read. */
export async function saveProgressAction(input: {
  id: string;
  location: string;
  percent: number;
  zoom: number | null;
  viewMode: ProgressInfo["viewMode"];
  pageTheme: ProgressInfo["pageTheme"];
}): Promise<ActionResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const { id, ...p } = parsed.data;
  try {
    await ensureInitialized(db);
    await saveProgress(db, id, p, new Date());
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
