"use server";

import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import { addBookmark, addHighlight, removeBookmark, removeHighlight, saveProgress, startReading, updateHighlight } from "@/lib/data/reading";
import type { ActionResult, BookmarkInfo, HighlightInfo, ProgressInfo } from "@/lib/types";
import {
  bookmarkRemoveSchema,
  bookmarkSchema,
  highlightAddSchema,
  highlightRemoveSchema,
  highlightUpdateSchema,
  idSchema,
  progressSchema,
} from "@/lib/validation";

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

export async function addBookmarkAction(input: { id: string; location: string; label?: string }): Promise<ActionResult<BookmarkInfo>> {
  const parsed = bookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    const bookmark = await addBookmark(db, parsed.data.id, parsed.data.location, parsed.data.label || null);
    return { ok: true, data: bookmark };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function removeBookmarkAction(input: { id: string; bookmarkId: string }): Promise<ActionResult> {
  const parsed = bookmarkRemoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    await removeBookmark(db, parsed.data.id, parsed.data.bookmarkId);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function addHighlightAction(input: {
  id: string;
  page: number | null;
  rects: { x: number; y: number; w: number; h: number }[];
  /** EPUB highlights: the CFI range (with page null and no rects). */
  cfiRange?: string | null;
  text: string;
  color: string;
}): Promise<ActionResult<HighlightInfo>> {
  const parsed = highlightAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    const { id, page, rects, cfiRange, text, color } = parsed.data;
    const highlight = await addHighlight(db, id, { page, rects, cfiRange: cfiRange ?? null, text, color });
    return { ok: true, data: highlight };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function updateHighlightAction(input: { id: string; highlightId: string; note?: string | null; color?: string }): Promise<ActionResult> {
  const parsed = highlightUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    const { id, highlightId, note, color } = parsed.data;
    await updateHighlight(db, id, highlightId, {
      ...(note !== undefined ? { note: note === null || note === "" ? null : note } : {}),
      ...(color !== undefined ? { color } : {}),
    });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function removeHighlightAction(input: { id: string; highlightId: string }): Promise<ActionResult> {
  const parsed = highlightRemoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  try {
    await ensureInitialized(db);
    await removeHighlight(db, parsed.data.id, parsed.data.highlightId);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
