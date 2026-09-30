import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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

/**
 * Writes book.<ext>, replacing anything already stored for this book. Returns the relative path.
 * The data goes to a temp file first; the old file is only removed once the new one is fully written.
 */
export async function saveBookFile(bookId: string, format: "pdf" | "epub", data: Buffer): Promise<string> {
  assertSafeId(bookId);
  const dir = path.join(booksDir(), bookId);
  await mkdir(dir, { recursive: true });
  const name = `book.${format}`;
  const tmpName = `.upload-${randomUUID()}.tmp`;
  const tmp = path.join(dir, tmpName);
  try {
    await writeFile(tmp, data);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  for (const entry of await readdir(dir)) {
    if (entry !== tmpName && entry !== name) await rm(path.join(dir, entry), { recursive: true, force: true });
  }
  await rename(tmp, path.join(dir, name));
  return `books/${bookId}/${name}`;
}

/** Removes books/<id> folders whose id is not in `validIds` (files left behind by a failed cleanup). */
export async function sweepOrphanBookDirs(validIds: ReadonlySet<string>): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(booksDir(), { withFileTypes: true });
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_ID.test(entry.name) || validIds.has(entry.name)) continue;
    await rm(path.join(booksDir(), entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
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
      if (entry.isDirectory()) {
        total += await walk(full);
        continue;
      }
      try {
        total += (await stat(full)).size;
      } catch {
        // Removed between readdir and stat (a concurrent replace or delete): it no longer uses space.
      }
    }
    return total;
  }
  return walk(booksDir());
}
