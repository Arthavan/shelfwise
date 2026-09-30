import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../generated/prisma/client";
import { storeBookFile } from "./book-file";

import { makePdf } from "../../../tests/e2e/fixtures/make-pdf";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations");

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
let db: PrismaClient;
let previousDataDir: string | undefined;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "shelfwise-store-"));
  const dbFile = path.join(workDir, "test.db");
  migrate(dbFile);
  db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbFile}` }) });
  previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(workDir, "data");
});

afterEach(async () => {
  await db.$disconnect();
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(workDir, { recursive: true, force: true });
});

const PDF = makePdf(["One", "Two"]);
const bookDir = (id: string) => path.join(workDir, "data", "books", id);

/** `db`, except that the book is soft-deleted right before the attach transaction runs. */
function deletedBeforeAttach(client: PrismaClient, bookId: string): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "$transaction") {
        return async (fn: never) => {
          await target.book.update({ where: { id: bookId }, data: { deletedAt: new Date() } });
          return target.$transaction(fn);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** `db`, except that the attach transaction fails. */
function failingAttach(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "$transaction") return async () => Promise.reject(new Error("disk full"));
      return Reflect.get(target, prop, receiver);
    },
  });
}

describe("storeBookFile", () => {
  it("stores and attaches a PDF", async () => {
    const book = await db.book.create({ data: { title: "T", author: "A" } });
    const r = await storeBookFile(db, book.id, PDF, "a.pdf", 2);
    expect(r).toEqual({ ok: true, format: "pdf", sizeBytes: PDF.length });
    expect((await db.bookFile.findUnique({ where: { bookId: book.id } }))?.pageCount).toBe(2);
    expect(existsSync(path.join(bookDir(book.id), "book.pdf"))).toBe(true);
  });

  it("rejects bytes that are not a book", async () => {
    const book = await db.book.create({ data: { title: "T", author: "A" } });
    expect(await storeBookFile(db, book.id, Buffer.from("<html>"), "a.pdf", null)).toEqual({ ok: false, reason: "not-a-book" });
    expect(existsSync(bookDir(book.id))).toBe(false);
  });

  it("does not store anything for a deleted book", async () => {
    const book = await db.book.create({ data: { title: "T", author: "A", deletedAt: new Date() } });
    expect(await storeBookFile(db, book.id, PDF, "a.pdf", null)).toEqual({ ok: false, reason: "not-found" });
    expect(existsSync(bookDir(book.id))).toBe(false);
    expect(await db.bookFile.count()).toBe(0);
  });

  it("removes the saved file when the book is deleted while storing", async () => {
    const book = await db.book.create({ data: { title: "T", author: "A" } });
    expect(await storeBookFile(deletedBeforeAttach(db, book.id), book.id, PDF, "a.pdf", null)).toEqual({ ok: false, reason: "not-found" });
    expect(await db.bookFile.count()).toBe(0);
    expect(existsSync(path.join(bookDir(book.id), "book.pdf"))).toBe(false);
  });

  it("cleans up after a failed attach only when no file was attached before", async () => {
    const fresh = await db.book.create({ data: { title: "T", author: "A" } });
    await expect(storeBookFile(failingAttach(db), fresh.id, PDF, "a.pdf", null)).rejects.toThrow("disk full");
    expect(existsSync(path.join(bookDir(fresh.id), "book.pdf"))).toBe(false);

    const attached = await db.book.create({ data: { title: "U", author: "A" } });
    await storeBookFile(db, attached.id, PDF, "a.pdf", null);
    await expect(storeBookFile(failingAttach(db), attached.id, PDF, "b.pdf", null)).rejects.toThrow("disk full");
    expect(existsSync(path.join(bookDir(attached.id), "book.pdf"))).toBe(true);
    expect((await db.bookFile.findUnique({ where: { bookId: attached.id } }))?.originalName).toBe("a.pdf");
  });
});
