import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** No "server-only": prisma/seed.ts imports this module. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR ?? "./data");
}

function booksDir(): string {
  return path.join(dataDir(), "books");
}

function assertSafeId(bookId: string): void {
  if (!SAFE_ID.test(bookId)) throw new Error("Invalid book id");
}

/** Resolves a stored relative path and refuses anything that escapes DATA_DIR. */
export function resolveStoragePath(rel: string): string {
  const root = dataDir();
  const full = path.resolve(root, rel);
  if (path.isAbsolute(rel) || (full !== root && !full.startsWith(root + path.sep))) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export async function deleteBookFiles(bookId: string): Promise<void> {
  assertSafeId(bookId);
  await rm(path.join(booksDir(), bookId), { recursive: true, force: true });
}

/** Writes book.<ext>, replacing anything already stored for this book. Returns the relative path. */
export async function saveBookFile(bookId: string, format: "pdf" | "epub", data: Buffer): Promise<string> {
  assertSafeId(bookId);
  await deleteBookFiles(bookId);
  const dir = path.join(booksDir(), bookId);
  await mkdir(dir, { recursive: true });
  const name = `book.${format}`;
  await writeFile(path.join(dir, name), data);
  return `books/${bookId}/${name}`;
}

export async function deleteAllBookFiles(): Promise<void> {
  await rm(booksDir(), { recursive: true, force: true });
}

export async function storageUsedBytes(): Promise<number> {
  async function walk(dir: string): Promise<number> {
    let total = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      total += entry.isDirectory() ? await walk(full) : (await stat(full)).size;
    }
    return total;
  }
  return walk(booksDir());
}
