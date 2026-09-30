import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../generated/prisma/client";
import {
  addBookmark, addHighlight, attachFile, countAnnotations, getFile, getProgress, getReadingSummaries, listBookmarks, listHighlights,
  removeBookmark, removeFileRow, removeHighlight, saveProgress, startReading, updateHighlight,
} from "./reading";

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

async function makeBook(db: PrismaClient, status = "want") {
  return db.book.create({ data: { title: "T", author: "A", status } });
}
const file = { format: "pdf" as const, originalName: "a.pdf", storagePath: "books/x/book.pdf", sizeBytes: 10, pageCount: 200 };

describe("reading data layer", () => {
  it("attachFile stores the file and fills Book.pages only when empty", async () => {
    const db = newClient();
    const a = await makeBook(db);
    await attachFile(db, a.id, file);
    expect((await getFile(db, a.id))?.pageCount).toBe(200);
    expect((await db.book.findUnique({ where: { id: a.id } }))?.pages).toBe(200);
    const b = await db.book.create({ data: { title: "B", author: "A", pages: 321 } });
    await attachFile(db, b.id, file);
    expect((await db.book.findUnique({ where: { id: b.id } }))?.pages).toBe(321);
  });

  it("replacing the file resets progress, bookmarks and highlights", async () => {
    const db = newClient();
    const b = await makeBook(db);
    await attachFile(db, b.id, file);
    await saveProgress(db, b.id, { location: "5", percent: 3, viewMode: "page", pageTheme: "light" }, new Date());
    await addBookmark(db, b.id, "5", null);
    await addHighlight(db, b.id, { page: 5, rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }], cfiRange: null, text: "hi", color: "yellow" });
    await attachFile(db, b.id, { ...file, pageCount: 10 });
    expect(await getProgress(db, b.id)).toBeNull();
    expect(await listBookmarks(db, b.id)).toEqual([]);
    expect(await listHighlights(db, b.id)).toEqual([]);
  });

  it("countAnnotations counts only this book's bookmarks and highlights", async () => {
    const db = newClient();
    const b = await makeBook(db);
    const other = await makeBook(db);
    expect(await countAnnotations(db, b.id)).toEqual({ bookmarks: 0, highlights: 0 });
    await addBookmark(db, b.id, "1", null);
    await addBookmark(db, b.id, "2", null);
    await addHighlight(db, b.id, { page: 1, rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }], cfiRange: null, text: "hi", color: "yellow" });
    await addBookmark(db, other.id, "1", null);
    expect(await countAnnotations(db, b.id)).toEqual({ bookmarks: 2, highlights: 1 });
  });

  it("saveProgress upserts and stamps Book.lastReadAt", async () => {
    const db = newClient();
    const b = await makeBook(db);
    await attachFile(db, b.id, file);
    const t1 = new Date("2026-01-01T00:00:00Z");
    const t2 = new Date("2026-01-02T00:00:00Z");
    await saveProgress(db, b.id, { location: "3", percent: 2, zoom: 1.5, viewMode: "scroll", pageTheme: "sepia" }, t1);
    await saveProgress(db, b.id, { location: "9", percent: 5, zoom: 1.5, viewMode: "scroll", pageTheme: "sepia" }, t2);
    const p = await getProgress(db, b.id);
    expect(p).toMatchObject({ location: "9", percent: 5, zoom: 1.5, viewMode: "scroll", pageTheme: "sepia" });
    expect((await db.book.findUnique({ where: { id: b.id } }))?.lastReadAt).toEqual(t2);
  });

  it("startReading moves want to reading once and never regresses other statuses", async () => {
    const db = newClient();
    const want = await makeBook(db, "want");
    const now = new Date("2026-03-01T00:00:00Z");
    await startReading(db, want.id, now);
    let row = await db.book.findUnique({ where: { id: want.id } });
    expect(row).toMatchObject({ status: "reading", startedAt: now, lastReadAt: now });
    const fin = await makeBook(db, "finished");
    await startReading(db, fin.id, now);
    row = await db.book.findUnique({ where: { id: fin.id } });
    expect(row?.status).toBe("finished");
  });

  it("bookmarks are idempotent per location and removable", async () => {
    const db = newClient();
    const b = await makeBook(db);
    const first = await addBookmark(db, b.id, "7", "note");
    const again = await addBookmark(db, b.id, "7", null);
    expect(again.id).toBe(first.id);
    expect(await listBookmarks(db, b.id)).toHaveLength(1);
    await removeBookmark(db, b.id, first.id);
    expect(await listBookmarks(db, b.id)).toEqual([]);
  });

  it("highlights round-trip rects and can be edited and removed, only within their own book", async () => {
    const db = newClient();
    const b = await makeBook(db);
    const other = await makeBook(db);
    const h = await addHighlight(db, b.id, { page: 2, rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }], cfiRange: null, text: "quoted", color: "green" });
    expect(h.rects).toEqual([{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }]);
    await updateHighlight(db, b.id, h.id, { note: "why" });
    expect((await listHighlights(db, b.id))[0].note).toBe("why");
    await removeHighlight(db, other.id, h.id); // wrong book: no-op
    expect(await listHighlights(db, b.id)).toHaveLength(1);
    await removeHighlight(db, b.id, h.id);
    expect(await listHighlights(db, b.id)).toEqual([]);
  });

  it("soft delete then restore keeps file, progress, bookmarks and highlights", async () => {
    const db = newClient();
    const b = await makeBook(db);
    await attachFile(db, b.id, file);
    await saveProgress(db, b.id, { location: "4", percent: 2, viewMode: "page", pageTheme: "light" }, new Date());
    await addBookmark(db, b.id, "4", null);
    await db.book.update({ where: { id: b.id }, data: { deletedAt: new Date() } });
    expect(await getFile(db, b.id)).toBeNull(); // hidden while deleted
    await db.book.update({ where: { id: b.id }, data: { deletedAt: null } });
    expect((await getFile(db, b.id))?.originalName).toBe("a.pdf");
    expect((await getProgress(db, b.id))?.location).toBe("4");
    expect(await listBookmarks(db, b.id)).toHaveLength(1);
  });

  it("hard-deleting a book cascades to its reading data", async () => {
    const db = newClient();
    const b = await makeBook(db);
    await attachFile(db, b.id, file);
    await addBookmark(db, b.id, "1", null);
    await db.book.delete({ where: { id: b.id } });
    expect(await db.bookFile.count()).toBe(0);
    expect(await db.bookmark.count()).toBe(0);
  });

  it("getReadingSummaries reports only books that have a file", async () => {
    const db = newClient();
    const a = await makeBook(db);
    const b = await makeBook(db);
    await attachFile(db, a.id, file);
    await saveProgress(db, a.id, { location: "50", percent: 25, viewMode: "page", pageTheme: "light" }, new Date());
    const s = await getReadingSummaries(db);
    expect(s[a.id]).toEqual({ percent: 25, location: "50", format: "pdf", lastReadAt: expect.any(Date), hasProgress: true });
    expect(s[b.id]).toBeUndefined();
  });

  it("getReadingSummaries reports lastReadAt null for a file without progress", async () => {
    const db = newClient();
    const a = await makeBook(db);
    await attachFile(db, a.id, file);
    const s = await getReadingSummaries(db);
    expect(s[a.id]).toEqual({ percent: 0, location: "1", format: "pdf", lastReadAt: null, hasProgress: false });
  });

  it("getReadingSummaries uses Book.lastReadAt, so a book opened but never paged through counts as read", async () => {
    const db = newClient();
    const a = await makeBook(db);
    await attachFile(db, a.id, file);
    const opened = new Date("2026-04-01T00:00:00Z");
    await startReading(db, a.id, opened);
    const s = await getReadingSummaries(db);
    expect(s[a.id]).toEqual({ percent: 0, location: "1", format: "pdf", lastReadAt: opened, hasProgress: false });
  });

  it("replacing or removing the file clears Book.lastReadAt with the progress", async () => {
    const db = newClient();
    const a = await makeBook(db);
    await attachFile(db, a.id, file);
    await startReading(db, a.id, new Date());
    await attachFile(db, a.id, file);
    expect((await getReadingSummaries(db))[a.id].lastReadAt).toBeNull();
    await startReading(db, a.id, new Date());
    await removeFileRow(db, a.id);
    expect((await db.book.findUnique({ where: { id: a.id } }))?.lastReadAt).toBeNull();
  });
});
