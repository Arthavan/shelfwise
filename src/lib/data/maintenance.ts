// No "server-only" here: prisma/seed.ts imports this module. Relative imports only.
import type { PrismaClient } from "../../generated/prisma/client";
import { buildDemoBooks } from "../demo-data";

export async function replaceWithDemoData(db: PrismaClient, now: Date) {
  await db.$transaction([
    db.book.deleteMany({}),
    db.book.createMany({ data: buildDemoBooks(now) }),
    db.appSettings.upsert({
      where: { id: "app" },
      create: { id: "app", seededAt: now },
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

let initialized = false;

/** First-run seeding, independent of the Prisma CLI. Keyed on the settings row, not book count. */
export async function ensureInitialized(db: PrismaClient) {
  if (initialized) return;
  const existing = await db.appSettings.findUnique({ where: { id: "app" } });
  if (!existing) {
    try {
      await replaceWithDemoData(db, new Date());
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  initialized = true;
}
