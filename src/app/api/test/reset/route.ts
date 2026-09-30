import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { removeAllBooks, replaceWithDemoData } from "@/lib/data/maintenance";
import { resetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Test-only reset hook (ARCHITECTURE §6.3). Enabled in dev, or in production only with E2E_TEST_HOOKS=1. */
function hooksEnabled(): boolean {
  return process.env.E2E_TEST_HOOKS === "1" || process.env.NODE_ENV !== "production";
}

const notFound = () => NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

export async function POST(request: Request) {
  if (!hooksEnabled()) return notFound();

  let raw: unknown = {};
  try {
    const text = await request.text();
    if (text.trim() !== "") raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'mode must be "demo" or "empty"' }, { status: 400 });
  }
  const { mode } = parsed.data;

  try {
    if (mode === "demo") {
      await replaceWithDemoData(db, new Date());
    } else {
      await removeAllBooks(db);
      // Keep the AppSettings row (the "initialized" marker) so nothing re-seeds; just clear the goal.
      await db.appSettings.upsert({
        where: { id: "app" },
        create: { id: "app", seededAt: new Date() },
        update: { goalYear: null, goalTarget: null },
      });
    }
    const count = await db.book.count();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, mode, count });
  } catch {
    return NextResponse.json({ ok: false, error: "Reset failed" }, { status: 500 });
  }
}

// Only POST is supported; Next answers other methods with 405.
