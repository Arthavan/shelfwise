"use server";

import { revalidatePath } from "next/cache";

import { applyFormToLifecycle, initialLifecycle } from "@/lib/book-rules";
import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { toBook } from "@/lib/data/books";
import type { ActionResult } from "@/lib/types";
import { bookFormSchema, idSchema, toBookData } from "@/lib/validation";

const FIX_FIELDS = "Please fix the highlighted fields";

type IdResult = ActionResult<{ id: string }>;

function validationFailure(issues: readonly { path: readonly PropertyKey[]; message: string }[]): IdResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (fieldErrors[key] === undefined) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: FIX_FIELDS, fieldErrors };
}

export async function createBook(values: unknown): Promise<IdResult> {
  const parsed = bookFormSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error.issues);
  const form = parsed.data;

  try {
    const lifecycle = initialLifecycle(form.status, form.rating, new Date());
    const created = await db.book.create({
      data: {
        ...toBookData(form),
        status: lifecycle.status,
        rating: lifecycle.rating,
        startedAt: lifecycle.startedAt,
        finishedAt: lifecycle.finishedAt,
      },
      select: { id: true },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: created.id } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function updateBook(id: string, values: unknown): Promise<IdResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Book not found" };
  const parsed = bookFormSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error.issues);
  const form = parsed.data;

  try {
    const row = await db.book.findFirst({ where: { id: parsedId.data, deletedAt: null } });
    if (!row) return { ok: false, error: "Book not found" };

    const lifecycle = applyFormToLifecycle(toBook(row), form, new Date());
    await db.book.update({
      where: { id: row.id },
      data: {
        ...toBookData(form),
        status: lifecycle.status,
        rating: lifecycle.rating,
        startedAt: lifecycle.startedAt,
        finishedAt: lifecycle.finishedAt,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: row.id } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
