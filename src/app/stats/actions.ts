"use server";

import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import type { ActionResult, ReadingGoal } from "@/lib/types";
import { GOAL_ERROR, goalSchema } from "@/lib/validation";

/** D12: the goal is stored with the current year and ignored in other years. */
export async function setReadingGoal(input: { target: string | number }): Promise<ActionResult<ReadingGoal>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GOAL_ERROR, fieldErrors: { target: GOAL_ERROR } };
  }
  const goalTarget = parsed.data.target;
  const goalYear = new Date().getFullYear();
  try {
    await ensureInitialized(db);
    await db.appSettings.upsert({
      where: { id: "app" },
      update: { goalYear, goalTarget },
      create: { id: "app", goalYear, goalTarget },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { year: goalYear, target: goalTarget } };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}

export async function clearReadingGoal(): Promise<ActionResult> {
  try {
    await ensureInitialized(db);
    await db.appSettings.upsert({
      where: { id: "app" },
      update: { goalYear: null, goalTarget: null },
      create: { id: "app", goalYear: null, goalTarget: null },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: ERROR_TOAST };
  }
}
