import { mkdirSync, mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAllBookFiles, deleteBookFiles, resolveStoragePath, saveBookFile, storageUsedBytes, sweepOrphanBookDirs } from "@/lib/file-storage";

/** Fault injection for the fs calls file-storage makes; everything else is the real module. */
const faults = vi.hoisted(() => ({ statMissing: new Set<string>(), writeFails: false }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs/promises")>();
  const stat = (async (p: Parameters<typeof real.stat>[0], ...rest: unknown[]) => {
    if (faults.statMissing.has(path.basename(String(p)))) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return (real.stat as (...a: unknown[]) => unknown)(p, ...rest);
  }) as typeof real.stat;
  const writeFile = (async (...args: Parameters<typeof real.writeFile>) => {
    if (faults.writeFails) throw new Error("disk full");
    return real.writeFile(...args);
  }) as typeof real.writeFile;
  return { ...real, default: { ...real, stat, writeFile }, stat, writeFile };
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "shelfwise-files-"));
  process.env.DATA_DIR = dir;
  faults.statMissing.clear();
  faults.writeFails = false;
});
afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("file storage", () => {
  it("saves under books/<id>/ and returns a relative path", async () => {
    const rel = await saveBookFile("abc123", "pdf", Buffer.from("%PDF-1.4"));
    expect(rel).toBe("books/abc123/book.pdf");
    expect(readFileSync(resolveStoragePath(rel), "utf8")).toBe("%PDF-1.4");
  });

  it("replacing a file removes the old one", async () => {
    await saveBookFile("abc123", "pdf", Buffer.from("%PDF-old"));
    const rel = await saveBookFile("abc123", "epub", Buffer.from("PK"));
    expect(rel).toBe("books/abc123/book.epub");
    expect(existsSync(path.join(dir, "books/abc123/book.pdf"))).toBe(false);
  });

  it("refuses path traversal and absolute paths", () => {
    expect(() => resolveStoragePath("../secret.txt")).toThrow();
    expect(() => resolveStoragePath("books/../../secret.txt")).toThrow();
    expect(() => resolveStoragePath(path.resolve("/etc/passwd"))).toThrow();
  });

  it("refuses unsafe book ids", async () => {
    await expect(saveBookFile("../evil", "pdf", Buffer.from("x"))).rejects.toThrow();
  });

  it("deletes one book's files, all files, and reports usage", async () => {
    await saveBookFile("a", "pdf", Buffer.alloc(10));
    await saveBookFile("b", "pdf", Buffer.alloc(20));
    expect(await storageUsedBytes()).toBe(30);
    await deleteBookFiles("a");
    expect(existsSync(path.join(dir, "books/a"))).toBe(false);
    expect(await storageUsedBytes()).toBe(20);
    await deleteAllBookFiles();
    expect(await storageUsedBytes()).toBe(0);
  });

  it("deleting files that do not exist is not an error", async () => {
    await expect(deleteBookFiles("nope")).resolves.toBeUndefined();
    await expect(deleteAllBookFiles()).resolves.toBeUndefined();
  });

  it("replacing leaves only the new file in the book folder", async () => {
    await saveBookFile("abc123", "pdf", Buffer.from("%PDF-old"));
    await saveBookFile("abc123", "pdf", Buffer.from("%PDF-new"));
    expect(readdirSync(path.join(dir, "books/abc123"))).toEqual(["book.pdf"]);
    expect(readFileSync(path.join(dir, "books/abc123/book.pdf"), "utf8")).toBe("%PDF-new");
  });

  it("a failed write keeps the old file", async () => {
    await saveBookFile("abc123", "pdf", Buffer.from("%PDF-old"));
    faults.writeFails = true;
    await expect(saveBookFile("abc123", "epub", Buffer.from("PK"))).rejects.toThrow();
    expect(readdirSync(path.join(dir, "books/abc123"))).toEqual(["book.pdf"]);
    expect(readFileSync(path.join(dir, "books/abc123/book.pdf"), "utf8")).toBe("%PDF-old");
  });

  it("storage usage skips a file that disappears while it is being measured", async () => {
    await saveBookFile("a", "pdf", Buffer.alloc(10));
    await saveBookFile("b", "epub", Buffer.alloc(20));
    faults.statMissing.add("book.epub");
    expect(await storageUsedBytes()).toBe(10);
  });

  it("sweepOrphanBookDirs removes folders with no matching book and keeps the rest", async () => {
    await saveBookFile("keep", "pdf", Buffer.alloc(5));
    await saveBookFile("gone1", "pdf", Buffer.alloc(5));
    await saveBookFile("gone2", "epub", Buffer.alloc(5));
    writeFileSync(path.join(dir, "books/stray.txt"), "not a book folder");
    const removed = await sweepOrphanBookDirs(new Set(["keep"]));
    expect(removed.sort()).toEqual(["gone1", "gone2"]);
    expect(readdirSync(path.join(dir, "books")).sort()).toEqual(["keep", "stray.txt"]);
  });

  it("sweepOrphanBookDirs is a no-op when there is no books folder", async () => {
    await expect(sweepOrphanBookDirs(new Set())).resolves.toEqual([]);
    mkdirSync(path.join(dir, "books"));
    await expect(sweepOrphanBookDirs(new Set())).resolves.toEqual([]);
  });
});
