import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteAllBookFiles, deleteBookFiles, resolveStoragePath, saveBookFile, storageUsedBytes } from "@/lib/file-storage";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "shelfwise-files-"));
  process.env.DATA_DIR = dir;
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
});
