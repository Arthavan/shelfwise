import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { removeAllBooks, replaceWithDemoData } from "@/lib/data/maintenance";
import { resetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Test-only reset hook (ARCHITECTURE §6.3). Enabled ONLY when E2E_TEST_HOOKS=1, which the Playwright
 * webServer sets. Never on in `npm run dev`: route handlers get none of the Origin checks Next applies
 * to server actions, so an always-on hook would let any website wipe the library. It also means a
 * Playwright run that reuses a plain dev server gets a 404 and fails loudly instead of wiping dev.db.
 */
function hooksEnabled(): boolean {
  return process.env.E2E_TEST_HOOKS === "1";
}

const notFound = () => NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
const forbidden = (error: string) => NextResponse.json({ ok: false, error }, { status: 403 });

/** Only application/json: a cross-site fetch can't send it without a CORS preflight, which we never grant. */
function isJsonRequest(request: Request): boolean {
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/** Browsers always send Origin on cross-site POSTs; when present it must name this very host. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hooksEnabled()) return notFound();
  if (!isJsonRequest(request)) return forbidden("Content-Type must be application/json");
  if (!isSameOrigin(request)) return forbidden("Cross-origin requests are not allowed");

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
