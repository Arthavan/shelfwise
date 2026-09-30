// No "server-only" here: relative imports only, like maintenance.ts.
import type { PrismaClient } from "../../generated/prisma/client";
import { applyStatusChange } from "../book-rules";
import type { Rect } from "../reading";
import type { BookFileInfo, BookmarkInfo, BookStatus, FileFormat, HighlightInfo, ProgressInfo } from "../types";

function isFileFormat(s: string): s is FileFormat {
  return s === "pdf" || s === "epub";
}

function liveBook(db: PrismaClient, bookId: string) {
  return db.book.findFirst({ where: { id: bookId, deletedAt: null } });
}

export async function attachFile(
  db: PrismaClient,
  bookId: string,
  f: { format: FileFormat; originalName: string; storagePath: string; sizeBytes: number; pageCount: number | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.bookFile.upsert({ where: { bookId }, create: { bookId, ...f }, update: { ...f, uploadedAt: new Date() } });
    await tx.readingProgress.deleteMany({ where: { bookId } });
    await tx.bookmark.deleteMany({ where: { bookId } });
    await tx.highlight.deleteMany({ where: { bookId } });
    const book = await tx.book.findUnique({ where: { id: bookId }, select: { pages: true } });
    if (book && book.pages == null && f.pageCount) {
      await tx.book.update({ where: { id: bookId }, data: { pages: f.pageCount } });
    }
  });
}

export async function getFile(db: PrismaClient, bookId: string): Promise<(BookFileInfo & { storagePath: string }) | null> {
  if (!(await liveBook(db, bookId))) return null;
  const row = await db.bookFile.findUnique({ where: { bookId } });
  if (!row || !isFileFormat(row.format)) return null;
  return { format: row.format, originalName: row.originalName, sizeBytes: row.sizeBytes, pageCount: row.pageCount, storagePath: row.storagePath };
}

/** Deletes the file row and its progress/bookmarks/highlights; returns the old storage path (or null). */
export async function removeFileRow(db: PrismaClient, bookId: string): Promise<string | null> {
  const old = await db.bookFile.findUnique({ where: { bookId }, select: { storagePath: true } });
  await db.$transaction([
    db.bookFile.deleteMany({ where: { bookId } }),
    db.readingProgress.deleteMany({ where: { bookId } }),
    db.bookmark.deleteMany({ where: { bookId } }),
    db.highlight.deleteMany({ where: { bookId } }),
  ]);
  return old?.storagePath ?? null;
}

export async function getProgress(db: PrismaClient, bookId: string): Promise<ProgressInfo | null> {
  const p = await db.readingProgress.findUnique({ where: { bookId } });
  if (!p) return null;
  return {
    location: p.location,
    percent: p.percent,
    zoom: p.zoom,
    viewMode: p.viewMode === "scroll" ? "scroll" : "page",
    pageTheme: p.pageTheme === "sepia" || p.pageTheme === "dark" ? p.pageTheme : "light",
    lastReadAt: p.lastReadAt,
  };
}

export async function saveProgress(
  db: PrismaClient,
  bookId: string,
  p: { location: string; percent: number; zoom?: number | null; viewMode: ProgressInfo["viewMode"]; pageTheme: ProgressInfo["pageTheme"] },
  now: Date,
): Promise<void> {
  const fields = { location: p.location, percent: p.percent, zoom: p.zoom ?? null, viewMode: p.viewMode, pageTheme: p.pageTheme, lastReadAt: now };
  await db.$transaction([
    db.readingProgress.upsert({ where: { bookId }, create: { bookId, ...fields }, update: fields }),
    db.book.update({ where: { id: bookId }, data: { lastReadAt: now } }),
  ]);
}

export async function startReading(db: PrismaClient, bookId: string, now: Date): Promise<void> {
  const book = await liveBook(db, bookId);
  if (!book) return;
  if (book.status === "want") {
    const next = applyStatusChange(
      { status: book.status as BookStatus, startedAt: book.startedAt, finishedAt: book.finishedAt, rating: book.rating },
      "reading",
      now,
    );
    await db.book.update({
      where: { id: bookId },
      data: { status: next.status, startedAt: next.startedAt, finishedAt: next.finishedAt, rating: next.rating, lastReadAt: now },
    });
  } else {
    await db.book.update({ where: { id: bookId }, data: { lastReadAt: now } });
  }
}

type BookmarkRow = { id: string; location: string; label: string | null; createdAt: Date };
const toBookmark = (r: BookmarkRow): BookmarkInfo => ({ id: r.id, location: r.location, label: r.label, createdAt: r.createdAt });

export async function listBookmarks(db: PrismaClient, bookId: string): Promise<BookmarkInfo[]> {
  const rows = await db.bookmark.findMany({ where: { bookId }, orderBy: { createdAt: "asc" } });
  return rows.map(toBookmark);
}

export async function addBookmark(db: PrismaClient, bookId: string, location: string, label: string | null): Promise<BookmarkInfo> {
  const existing = await db.bookmark.findFirst({ where: { bookId, location } });
  if (existing) return toBookmark(existing);
  return toBookmark(await db.bookmark.create({ data: { bookId, location, label } }));
}

export async function removeBookmark(db: PrismaClient, bookId: string, id: string): Promise<void> {
  await db.bookmark.deleteMany({ where: { id, bookId } });
}

type HighlightRow = {
  id: string;
  page: number | null;
  rects: string | null;
  cfiRange: string | null;
  text: string;
  color: string;
  note: string | null;
  createdAt: Date;
};

function parseRects(raw: string | null): Rect[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as Rect[]) : [];
  } catch {
    return [];
  }
}

const toHighlight = (r: HighlightRow): HighlightInfo => ({
  id: r.id,
  page: r.page,
  rects: parseRects(r.rects),
  cfiRange: r.cfiRange,
  text: r.text,
  color: r.color,
  note: r.note,
  createdAt: r.createdAt,
});

export async function listHighlights(db: PrismaClient, bookId: string): Promise<HighlightInfo[]> {
  const rows = await db.highlight.findMany({ where: { bookId }, orderBy: { createdAt: "asc" } });
  return rows.map(toHighlight);
}

export async function addHighlight(
  db: PrismaClient,
  bookId: string,
  h: { page: number | null; rects: Rect[]; cfiRange: string | null; text: string; color: string },
): Promise<HighlightInfo> {
  const rects = h.cfiRange && h.rects.length === 0 ? null : JSON.stringify(h.rects);
  const row = await db.highlight.create({ data: { bookId, page: h.page, rects, cfiRange: h.cfiRange, text: h.text, color: h.color } });
  return toHighlight(row);
}

export async function updateHighlight(
  db: PrismaClient,
  bookId: string,
  id: string,
  patch: { note?: string | null; color?: string },
): Promise<void> {
  const data: { note?: string | null; color?: string } = {};
  if (patch.note !== undefined) data.note = patch.note;
  if (patch.color !== undefined) data.color = patch.color;
  await db.highlight.updateMany({ where: { id, bookId }, data });
}

export async function removeHighlight(db: PrismaClient, bookId: string, id: string): Promise<void> {
  await db.highlight.deleteMany({ where: { id, bookId } });
}

export async function getReadingSummaries(
  db: PrismaClient,
  bookIds?: string[],
): Promise<Record<string, { percent: number; location: string; format: FileFormat }>> {
  const rows = await db.bookFile.findMany({
    where: { book: { deletedAt: null }, ...(bookIds ? { bookId: { in: bookIds } } : {}) },
    include: { book: { include: { progress: true } } },
  });
  const out: Record<string, { percent: number; location: string; format: FileFormat }> = {};
  for (const r of rows) {
    if (!isFileFormat(r.format)) continue;
    out[r.bookId] = { percent: r.book.progress?.percent ?? 0, location: r.book.progress?.location ?? "1", format: r.format };
  }
  return out;
}
