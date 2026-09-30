import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../generated/prisma/client";
import { ensureInitialized, replaceWithDemoData } from "./maintenance";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations");

/** Applies the real Prisma migrations to a fresh SQLite file, like `prisma migrate deploy` would. */
function migrate(file: string) {
  const sqlite = new Database(file);
  try {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const dir of dirs) sqlite.exec(readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8"));
  } finally {
    sqlite.close();
  }
}

let workDir: string;
let dbFile: string;
const clients: PrismaClient[] = [];

/** A new client means a new process-level "already initialized" memo, like a server restart. */
function newClient(): PrismaClient {
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbFile}` }) });
  clients.push(client);
  return client;
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "shelfwise-init-"));
  dbFile = path.join(workDir, "test.db");
  migrate(dbFile);
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
  rmSync(workDir, { recursive: true, force: true });
});

describe("ensureInitialized", () => {
  it("keeps a book that was saved before the first initialization (no AppSettings row yet)", async () => {
    const db = newClient();
    await db.book.create({ data: { id: "mine", title: "My Real First Book", author: "Me" } });

    await ensureInitialized(db);

    const books = await db.book.findMany();
    expect(books.map((b) => b.title)).toEqual(["My Real First Book"]);
    const settings = await db.appSettings.findUnique({ where: { id: "app" } });
    expect(settings).not.toBeNull();
    expect(settings?.seededAt).toBeNull();
  });

  it("seeds the demo shelf into a brand-new empty database", async () => {
    const db = newClient();

    await ensureInitialized(db);

    expect(await db.book.count()).toBe(12);
    const settings = await db.appSettings.findUnique({ where: { id: "app" } });
    expect(settings?.seededAt).toBeInstanceOf(Date);
  });

  it("never re-seeds once initialized, even after every book was deleted", async () => {
    await ensureInitialized(newClient());
    await newClient().book.deleteMany({});

    const restarted = newClient();
    await ensureInitialized(restarted);

    expect(await restarted.book.count()).toBe(0);
  });

  it("never deletes or duplicates books on repeated or concurrent calls", async () => {
    const db = newClient();
    await Promise.all([ensureInitialized(db), ensureInitialized(db), ensureInitialized(db)]);
    await db.book.create({ data: { id: "added", title: "Added Later", author: "Me" } });

    const restarted = newClient();
    await ensureInitialized(restarted);

    expect(await restarted.book.count()).toBe(13);
    expect(await restarted.book.findUnique({ where: { id: "added" } })).not.toBeNull();
    expect(await restarted.appSettings.count()).toBe(1);
  });
});

describe("replaceWithDemoData", () => {
  it("replaces every book with the 12 demo books and clears the goal (explicit restore only)", async () => {
    const db = newClient();
    await db.book.create({ data: { id: "mine", title: "Mine", author: "Me" } });
    await db.appSettings.create({ data: { id: "app", goalYear: 2026, goalTarget: 20 } });

    await replaceWithDemoData(db, new Date());

    expect(await db.book.count()).toBe(12);
    expect(await db.book.findUnique({ where: { id: "mine" } })).toBeNull();
    const settings = await db.appSettings.findUnique({ where: { id: "app" } });
    expect(settings?.goalTarget).toBeNull();
  });
});
