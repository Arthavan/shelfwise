import "server-only";

import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import type { ReadingGoal } from "@/lib/types";

/** The reading goal, only while it belongs to the current year. */
export async function getReadingGoal(now: Date): Promise<ReadingGoal | null> {
  await ensureInitialized(db);
  const settings = await db.appSettings.findUnique({ where: { id: "app" } });
  if (!settings || settings.goalYear === null || settings.goalTarget === null) return null;
  if (settings.goalYear !== now.getFullYear()) return null;
  return { year: settings.goalYear, target: settings.goalTarget };
}
