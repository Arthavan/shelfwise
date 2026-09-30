// No "server-only" here: prisma/seed.ts imports this module. Relative imports only.
import type { PrismaClient } from "../../generated/prisma/client";
import { buildDemoBooks } from "../demo-data";

const SETTINGS_ID = "app";

/**
 * Destructive: replaces every book with the demo shelf and clears the goal.
 * Only for explicit requests (Settings → "Restore demo data", `prisma db seed`, the e2e reset hook).
 * Never call this from first-run initialization.
 */
export async function replaceWithDemoData(db: PrismaClient, now: Date) {
  await db.$transaction([
    db.book.deleteMany({}),
    db.book.createMany({ data: buildDemoBooks(now) }),
    db.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, seededAt: now },
      update: { seededAt: now, goalYear: null, goalTarget: null },
    }),
  ]);
}

export async function removeAllBooks(db: PrismaClient) {
  await db.book.deleteMany({});
}

export async function purgeSoftDeleted(db: PrismaClient, before: Date) {
  await db.book.deleteMany({ where: { deletedAt: { lt: before } } });
}

/** Clients that already passed the first-run check in this process (a WeakSet so tests get a fresh state per client). */
const initializedClients = new WeakSet<PrismaClient>();

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/**
 * First-run setup, independent of the Prisma CLI. Keyed on the AppSettings row, so "Delete all books"
 * never re-seeds. Strictly non-destructive: the demo shelf is inserted only when the book table is
 * completely empty, and nothing is ever deleted here. Call it before every read AND every write, so a
 * book saved before any page read the DB can't be wiped or mixed up with a later first-run seed.
 */
export async function ensureInitialized(db: PrismaClient): Promise<void> {
  if (initializedClients.has(db)) return;
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.appSettings.findUnique({ where: { id: SETTINGS_ID }, select: { id: true } });
      if (existing) return;
      const now = new Date();
      const bookCount = await tx.book.count();
      if (bookCount === 0) {
        await tx.book.createMany({ data: buildDemoBooks(now) });
      }
      await tx.appSettings.create({ data: { id: SETTINGS_ID, seededAt: bookCount === 0 ? now : null } });
    });
  } catch (e) {
    // A concurrent first request initialized the DB first; its transaction won, ours rolled back.
    if (!isUniqueViolation(e)) throw e;
  }
  initializedClients.add(db);
}
