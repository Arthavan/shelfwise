"use server";

import { revalidatePath } from "next/cache";

import { applyStatusChange } from "@/lib/book-rules";
import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import type { ActionResult, BookStatus } from "@/lib/types";
import { idSchema, rateSchema, statusChangeSchema } from "@/lib/validation";

const NOT_FOUND = "Book not found";

function isBookStatus(value: string): value is BookStatus {
  return value === "want" || value === "reading" || value === "finished";
}

/** D7: the shared transition rules move dates and clear the rating as needed. */
export async function updateBookStatus(input: {
  id: string;
  status: BookStatus;
}): Promise<ActionResult<{ id: string; status: BookStatus }>> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const { id, status } = parsed.data;
  try {
    const book = await db.book.findFirst({ where: { id, deletedAt: null } });
    if (!book) return { ok: false, error: NOT_FOUND };
    const current = {
      status: isBookStatus(book.status) ? book.status : ("want" as const),
      startedAt: book.startedAt,
      finishedAt: book.finishedAt,
      rating: book.rating,
    };
    const next = applyStatusChange(current, status, new Date());
    await db.book.update({
      where: { id },
      data: {
        status: next.status,
        startedAt: next.startedAt,
        finishedAt: next.finishedAt,
        rating: next.rating,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id, status } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

/** Only finished books can be rated. */
export async function rateBook(input: {
  id: string;
  rating: number;
}): Promise<ActionResult<{ id: string; rating: number }>> {
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const { id, rating } = parsed.data;
  try {
    const book = await db.book.findFirst({ where: { id, deletedAt: null } });
    if (!book) return { ok: false, error: NOT_FOUND };
    if (book.status !== "finished") return { ok: false, error: "Only finished books can be rated" };
    await db.book.update({ where: { id }, data: { rating } });
    revalidatePath("/", "layout");
    return { ok: true, data: { id, rating } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function clearRating(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = idSchema.safeParse(input?.id);
  if (!parsed.success) return { ok: false, error: ERROR_TOAST };
  const id = parsed.data;
  try {
    const book = await db.book.findFirst({ where: { id, deletedAt: null } });
    if (!book) return { ok: false, error: NOT_FOUND };
    await db.book.update({ where: { id }, data: { rating: null } });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
