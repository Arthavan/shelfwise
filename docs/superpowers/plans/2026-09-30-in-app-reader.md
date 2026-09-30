# In-App Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user attach a PDF (or EPUB) to a book, read it inside Shelfwise, and have the app remember position, bookmarks, highlights and view settings.

**Architecture:** Files are stored on disk under `DATA_DIR` and streamed through a Range-capable route handler. A client-side reader (pdf.js for PDF, epub.js for EPUB) persists progress, bookmarks and highlights through server actions backed by new Prisma models. Pure logic (page maths, rect normalisation, search, upload validation, Range parsing) lives in small tested modules; data-layer functions take a `db` argument so they can be tested against a real temp SQLite file, exactly like `src/lib/data/maintenance.ts`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 + SQLite, zod, vitest, Playwright, `pdfjs-dist` (PDF), `epubjs` (EPUB), shadcn/ui, Tailwind v4, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-09-30-in-app-reader-design.md`

Refinement of the spec: `Highlight` gets an extra nullable `cfiRange` column (used only by EPUB), and `page`/`rects` are nullable so one table serves both formats. Nothing else in the spec changes.

## Global Constraints

- Upload size cap: 100 MB by default (`MAX_UPLOAD_MB` env, default `100`).
- Files live in `DATA_DIR/books/<bookId>/`; `DATA_DIR` defaults to `./data` and is git-ignored. Never in SQLite.
- One file per book (`BookFile.bookId` is unique).
- Uploads are validated by magic bytes (`%PDF-` or a ZIP whose `mimetype` entry is `application/epub+zip`), never by extension alone.
- Highlight rects are stored as fractions (0-1) of page width/height.
- Progress saves are debounced ~1 s, and flushed on unmount and on `pagehide`.
- The existing 78 unit tests and 37 e2e tests must keep passing.
- Route handlers get no Origin checks from Next, so every mutating route handler must reuse the same-origin guard (Task 3).
- First open of a `want` book uses the existing `applyStatusChange` rule. "Mark as finished" is offered on the last page, never applied silently.
- Code style: match the surrounding code (double quotes, 2-space indent, `@/` imports, `ActionResult<T>` from `@/lib/types` for actions, `ERROR_TOAST` for generic failures).

## Review Focus

- **Password-protected or corrupt PDF:** the reader shows a clear message with a re-upload action instead of a blank page or an error boundary (Task 6 e2e).
- **File missing on disk while the DB row exists:** the detail page and reader show "file missing, re-upload"; the file route returns 404 (Tasks 4 and 6).
- **Scanned PDF with no text layer:** reading and bookmarking work; search and highlight show "no selectable text in this PDF" (Tasks 8 and 9).
- **Saved page beyond the page count** (file replaced by a shorter one): the reader clamps to the last page rather than failing (Task 2 unit test, Task 6).
- **Soft-deleted book, then Undo:** the file, progress, bookmarks and highlights are all still there (Task 4 unit test).
- **Path traversal via a crafted `storagePath`/book id:** `resolveStoragePath` refuses anything outside `DATA_DIR` (Task 3 unit test).
- **Range request edge cases** (`bytes=-500`, `bytes=0-`, start past EOF, malformed header): correct 206/416/200 behaviour (Task 3 unit test).

---

## File Structure

```
prisma/schema.prisma                         + BookFile, ReadingProgress, Bookmark, Highlight, Book.lastReadAt
prisma/migrations/<ts>_reading/              generated
scripts/copy-pdf-worker.mjs                  copies pdf.worker.min.mjs into public/
src/lib/reading.ts (+ .test.ts)              pure: clampPage, percentFor, rect maths, searchPages, constants
src/lib/upload.ts (+ .test.ts)               pure: detectFormat, maxUploadBytes
src/lib/http-range.ts (+ .test.ts)           pure: parseRange
src/lib/request-guard.ts                     isSameOrigin (shared with the reset hook)
src/lib/file-storage.ts (+ .test.ts)         fs: save/resolve/delete book files, dirSize
src/lib/data/reading.ts (+ .test.ts)         db-parameterised data layer for file/progress/bookmarks/highlights
src/app/api/books/[id]/file/route.ts         GET (stream, Range), POST (upload), DELETE
src/app/books/[id]/read/page.tsx             server page: loads everything, renders <ReaderShell/>
src/app/books/[id]/read/actions.ts           server actions: startReading, saveProgress, bookmarks, highlights
src/components/reader/
  reader-shell.tsx                           client wrapper, picks PDF vs EPUB (dynamic, ssr:false)
  pdf-reader.tsx                             PDF reader state + layout
  pdf-page.tsx                               one page: canvas + text layer + highlight overlay
  pdf-loader.ts                              loadPdf(url)
  reader-toolbar.tsx                         page input, zoom, mode, theme, fullscreen, search toggle
  side-panel.tsx                             tabs: Contents / Bookmarks / Highlights
  search-panel.tsx                           search input + results
  selection-popover.tsx                      highlight colour + note popover
  use-progress-saver.ts                      debounced save hook
  epub-reader.tsx                            EPUB reader (Task 11)
src/components/books/upload-file.tsx         upload/replace/remove control on detail page
src/components/books/continue-reading.tsx    "Continue reading" row for the library
```

---

### Task 1: Dependencies, schema and migration

**Files:**
- Modify: `package.json`, `.gitignore`, `.env.example`, `playwright.config.ts`
- Create: `scripts/copy-pdf-worker.mjs`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_reading/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `BookFile`, `ReadingProgress`, `Bookmark`, `Highlight`, and `Book.lastReadAt`, used by every later task.

- [ ] **Step 1: Install dependencies**

```bash
npm install pdfjs-dist epubjs
```

- [ ] **Step 2: Add the worker copy script** `scripts/copy-pdf-worker.mjs`

```js
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const src = path.resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.resolve("public/pdf.worker.min.mjs");
if (!existsSync(src)) {
  console.warn("pdfjs-dist not installed; skipping worker copy");
  process.exit(0);
}
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
```

- [ ] **Step 3: Wire the script into `package.json`**

Change `"postinstall": "prisma generate"` to `"postinstall": "prisma generate && node scripts/copy-pdf-worker.mjs"` and change `"build"` to `"prisma generate && node scripts/copy-pdf-worker.mjs && next build"`. Then run `node scripts/copy-pdf-worker.mjs` and confirm `public/pdf.worker.min.mjs` exists.

- [ ] **Step 4: Ignore generated/user data** — append to `.gitignore`:

```
/public/pdf.worker.min.mjs
/data/
/e2e-data-*/
```

Append to `.env.example`:

```
# Where uploaded book files are stored (default ./data). Use a persistent volume in production.
# DATA_DIR="./data"
# Upload size cap in MB (default 100).
# MAX_UPLOAD_MB=100
```

In `playwright.config.ts` add `DATA_DIR: process.env.E2E_DATA_DIR ?? \`./e2e-data-${PORT}\`,` to `webServer.env`.

- [ ] **Step 5: Extend the schema** — in `prisma/schema.prisma` add `lastReadAt DateTime?` and relations to `Book`, and the new models:

```prisma
model Book {
  id         String    @id @default(cuid())
  title      String
  author     String
  status     String    @default("want")
  pages      Int?
  notes      String?
  rating     Int?
  startedAt  DateTime?
  finishedAt DateTime?
  lastReadAt DateTime?
  deletedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  file      BookFile?
  progress  ReadingProgress?
  bookmarks Bookmark[]
  highlights Highlight[]

  @@index([deletedAt, createdAt])
  @@index([status])
  @@index([finishedAt])
  @@index([lastReadAt])
}

model BookFile {
  id           String   @id @default(cuid())
  bookId       String   @unique
  book         Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  format       String // "pdf" | "epub"
  originalName String
  storagePath  String // relative to DATA_DIR
  sizeBytes    Int
  pageCount    Int?
  uploadedAt   DateTime @default(now())
}

model ReadingProgress {
  bookId     String   @id
  book       Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  location   String // PDF: page number as string; EPUB: CFI
  percent    Int      @default(0)
  zoom       Float?
  viewMode   String   @default("page") // "page" | "scroll"
  pageTheme  String   @default("light") // "light" | "sepia" | "dark"
  lastReadAt DateTime @default(now())
}

model Bookmark {
  id        String   @id @default(cuid())
  bookId    String
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  location  String // PDF: page number as string; EPUB: CFI
  label     String?
  createdAt DateTime @default(now())

  @@index([bookId, createdAt])
}

model Highlight {
  id        String   @id @default(cuid())
  bookId    String
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  page      Int? // PDF only
  rects     String? // PDF only: JSON [{x,y,w,h}] as fractions
  cfiRange  String? // EPUB only
  text      String
  color     String   @default("yellow")
  note      String?
  createdAt DateTime @default(now())

  @@index([bookId, page])
}
```

- [ ] **Step 6: Generate the migration and client**

Run: `npx prisma migrate dev --name reading`
Expected: a new folder in `prisma/migrations`, "Your database is now in sync", client regenerated. (Note `Book.lastReadAt` and the four tables appear in `migration.sql`.)

- [ ] **Step 7: Verify nothing regressed**

Run: `npm test` then `npx tsc --noEmit`
Expected: all 78 tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example playwright.config.ts scripts prisma
git commit -m "feat(reader): add reading schema, pdfjs/epubjs deps and worker copy script

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pure reading logic

**Files:**
- Create: `src/lib/reading.ts`
- Test: `src/lib/reading.test.ts`

**Interfaces:**
- Produces (all exported from `@/lib/reading`):
  - `type Rect = { x: number; y: number; w: number; h: number }`
  - `type BoxLike = { left: number; top: number; width: number; height: number }`
  - `clampPage(page: number, pageCount: number): number`
  - `percentFor(page: number, pageCount: number): number`
  - `rectsToFractions(rects: BoxLike[], box: BoxLike): Rect[]`
  - `dropContainedRects(rects: Rect[]): Rect[]`
  - `type SearchHit = { page: number; snippet: string; index: number }`
  - `searchPages(texts: string[], query: string, maxResults?: number): SearchHit[]` (`texts[i]` is page `i + 1`)
  - `HIGHLIGHT_COLORS`, `PAGE_THEMES`, `VIEW_MODES` (readonly tuples) and their union types `HighlightColor`, `PageTheme`, `ViewMode`
  - `ZOOM_MIN = 0.5`, `ZOOM_MAX = 3`, `clampZoom(z: number): number`

- [ ] **Step 1: Write the failing tests** `src/lib/reading.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { clampPage, clampZoom, dropContainedRects, percentFor, rectsToFractions, searchPages } from "@/lib/reading";

describe("clampPage", () => {
  it("keeps a valid page", () => expect(clampPage(5, 10)).toBe(5));
  it("clamps below 1 and above the count", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-3, 10)).toBe(1);
    expect(clampPage(99, 10)).toBe(10); // saved page beyond a shorter replacement file
  });
  it("treats NaN and a zero page count as page 1", () => {
    expect(clampPage(Number.NaN, 10)).toBe(1);
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe("percentFor", () => {
  it("rounds page/pageCount to a whole percent", () => {
    expect(percentFor(42, 310)).toBe(14);
    expect(percentFor(310, 310)).toBe(100);
  });
  it("is 0 for an unknown page count and never exceeds 100", () => {
    expect(percentFor(3, 0)).toBe(0);
    expect(percentFor(500, 310)).toBe(100);
  });
});

describe("clampZoom", () => {
  it("clamps to 0.5-3", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(9)).toBe(3);
    expect(clampZoom(1.25)).toBe(1.25);
  });
});

describe("rectsToFractions", () => {
  const box = { left: 100, top: 200, width: 400, height: 800 };
  it("converts client rects into fractions of the page box", () => {
    const out = rectsToFractions([{ left: 200, top: 400, width: 100, height: 40 }], box);
    expect(out).toEqual([{ x: 0.25, y: 0.25, w: 0.25, h: 0.05 }]);
  });
  it("drops empty rects and clamps rects that overflow the page", () => {
    const out = rectsToFractions(
      [
        { left: 0, top: 0, width: 0, height: 10 },
        { left: 450, top: 200, width: 200, height: 80 },
      ],
      box,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBeCloseTo(0.875);
    expect(out[0].x + out[0].w).toBeLessThanOrEqual(1);
  });
  it("returns nothing for a zero-size box", () => {
    expect(rectsToFractions([{ left: 0, top: 0, width: 5, height: 5 }], { left: 0, top: 0, width: 0, height: 0 })).toEqual([]);
  });
});

describe("dropContainedRects", () => {
  it("removes rects fully inside another (nested span duplicates)", () => {
    const outer = { x: 0.1, y: 0.1, w: 0.5, h: 0.05 };
    const inner = { x: 0.2, y: 0.1, w: 0.1, h: 0.05 };
    expect(dropContainedRects([outer, inner])).toEqual([outer]);
  });
  it("keeps identical rects once", () => {
    const r = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    expect(dropContainedRects([r, { ...r }])).toHaveLength(1);
  });
});

describe("searchPages", () => {
  const texts = ["The quick brown fox", "nothing here", "A Quick reply, quickly"];
  it("finds case-insensitive matches with 1-based pages and snippets", () => {
    const hits = searchPages(texts, "quick");
    expect(hits.map((h) => h.page)).toEqual([1, 3, 3]);
    expect(hits[0].snippet).toContain("quick brown");
  });
  it("returns nothing for an empty or whitespace query", () => {
    expect(searchPages(texts, "")).toEqual([]);
    expect(searchPages(texts, "   ")).toEqual([]);
  });
  it("caps the number of results", () => {
    expect(searchPages(["a a a a a"], "a", 3)).toHaveLength(3);
  });
  it("does not treat regex characters specially", () => {
    expect(searchPages(["cost (approx.) $5"], "(approx.)")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reading.test.ts`
Expected: FAIL, module `@/lib/reading` not found.

- [ ] **Step 3: Implement** `src/lib/reading.ts`

```ts
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export const PAGE_THEMES = ["light", "sepia", "dark"] as const;
export const VIEW_MODES = ["page", "scroll"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type PageTheme = (typeof PAGE_THEMES)[number];
export type ViewMode = (typeof VIEW_MODES)[number];

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

export type Rect = { x: number; y: number; w: number; h: number };
export type BoxLike = { left: number; top: number; width: number; height: number };
export type SearchHit = { page: number; snippet: string; index: number };

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** 1-based page clamped into the document; a bad page or empty document is page 1. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || pageCount < 1) return 1;
  return Math.min(pageCount, Math.max(1, Math.trunc(page)));
}

export function percentFor(page: number, pageCount: number): number {
  if (pageCount < 1) return 0;
  return Math.min(100, Math.max(0, Math.round((page / pageCount) * 100)));
}

/** Client rects to fractions of the page box, so highlights survive zoom. Empty rects are dropped. */
export function rectsToFractions(rects: BoxLike[], box: BoxLike): Rect[] {
  if (box.width <= 0 || box.height <= 0) return [];
  const out: Rect[] = [];
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue;
    const x = Math.min(1, Math.max(0, (r.left - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (r.top - box.top) / box.height));
    const right = Math.min(1, Math.max(0, (r.left + r.width - box.left) / box.width));
    const bottom = Math.min(1, Math.max(0, (r.top + r.height - box.top) / box.height));
    if (right - x <= 0 || bottom - y <= 0) continue;
    out.push({ x, y, w: right - x, h: bottom - y });
  }
  return out;
}

const EPS = 1e-6;
function contains(a: Rect, b: Rect): boolean {
  return a.x <= b.x + EPS && a.y <= b.y + EPS && a.x + a.w >= b.x + b.w - EPS && a.y + a.h >= b.y + b.h - EPS;
}

/** Range.getClientRects() returns nested duplicates; keep only rects not inside another. */
export function dropContainedRects(rects: Rect[]): Rect[] {
  return rects.filter((r, i) =>
    !rects.some((other, j) => {
      if (i === j || !contains(other, r)) return false;
      // identical rects: keep the first only
      return !contains(r, other) || j < i;
    }),
  );
}

/** Case-insensitive literal search over per-page text (`texts[i]` is page i + 1). */
export function searchPages(texts: string[], query: string, maxResults = 200): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  const hits: SearchHit[] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const haystack = text.toLowerCase();
    let from = 0;
    while (hits.length < maxResults) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const start = Math.max(0, at - 30);
      const end = Math.min(text.length, at + needle.length + 30);
      hits.push({ page: i + 1, index: at, snippet: `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}` });
      from = at + needle.length;
    }
    if (hits.length >= maxResults) break;
  }
  return hits;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/reading.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reading.ts src/lib/reading.test.ts
git commit -m "feat(reader): pure page, rect and search helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Upload validation, Range parsing, request guard, file storage

**Files:**
- Create: `src/lib/upload.ts`, `src/lib/http-range.ts`, `src/lib/request-guard.ts`, `src/lib/file-storage.ts`
- Test: `src/lib/upload.test.ts`, `src/lib/http-range.test.ts`, `src/lib/file-storage.test.ts`
- Modify: `src/app/api/test/reset/route.ts` (import `isSameOrigin` from the new module instead of its local copy)

**Interfaces:**
- Produces:
  - `detectFormat(bytes: Uint8Array): "pdf" | "epub" | null`
  - `maxUploadBytes(env?: { MAX_UPLOAD_MB?: string }): number`
  - `parseRange(header: string | null, size: number): { kind: "full" } | { kind: "range"; start: number; end: number } | { kind: "invalid" }` (`end` inclusive)
  - `isSameOrigin(request: Request): boolean`
  - from `file-storage.ts`: `dataDir(): string`, `saveBookFile(bookId: string, format: "pdf" | "epub", data: Buffer): Promise<string>` (returns the relative `storagePath`), `resolveStoragePath(rel: string): string` (throws on traversal), `deleteBookFiles(bookId: string): Promise<void>`, `deleteAllBookFiles(): Promise<void>`, `storageUsedBytes(): Promise<number>`. No `server-only` import (the seed script uses it).

- [ ] **Step 1: Write the failing tests**

`src/lib/upload.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { detectFormat, maxUploadBytes } from "@/lib/upload";

const enc = (s: string) => new TextEncoder().encode(s);

describe("detectFormat", () => {
  it("detects a PDF by magic bytes", () => expect(detectFormat(enc("%PDF-1.7\n..."))).toBe("pdf"));
  it("tolerates leading junk before %PDF- (within 1 KB)", () => {
    expect(detectFormat(enc("\n\n  garbage %PDF-1.4"))).toBe("pdf");
  });
  it("detects an EPUB (zip with the epub mimetype entry)", () => {
    const zip = "PK\x03\x04" + "x".repeat(26) + "mimetypeapplication/epub+zip";
    expect(detectFormat(enc(zip))).toBe("epub");
  });
  it("rejects a plain zip, text and empty input", () => {
    expect(detectFormat(enc("PK\x03\x04" + "x".repeat(60)))).toBeNull();
    expect(detectFormat(enc("hello world"))).toBeNull();
    expect(detectFormat(new Uint8Array())).toBeNull();
  });
  it("rejects a file renamed .pdf that is really an image", () => {
    expect(detectFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("maxUploadBytes", () => {
  it("defaults to 100 MB", () => expect(maxUploadBytes({})).toBe(100 * 1024 * 1024));
  it("reads MAX_UPLOAD_MB", () => expect(maxUploadBytes({ MAX_UPLOAD_MB: "5" })).toBe(5 * 1024 * 1024));
  it("falls back to the default on garbage", () => {
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "abc" })).toBe(100 * 1024 * 1024);
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "-4" })).toBe(100 * 1024 * 1024);
  });
});
```

`src/lib/http-range.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseRange } from "@/lib/http-range";

describe("parseRange", () => {
  it("no header means the full file", () => expect(parseRange(null, 1000)).toEqual({ kind: "full" }));
  it("parses start-end (inclusive)", () => expect(parseRange("bytes=0-99", 1000)).toEqual({ kind: "range", start: 0, end: 99 }));
  it("parses open-ended ranges", () => expect(parseRange("bytes=900-", 1000)).toEqual({ kind: "range", start: 900, end: 999 }));
  it("parses suffix ranges", () => expect(parseRange("bytes=-500", 1000)).toEqual({ kind: "range", start: 500, end: 999 }));
  it("clamps an end past EOF", () => expect(parseRange("bytes=990-5000", 1000)).toEqual({ kind: "range", start: 990, end: 999 }));
  it("clamps a suffix longer than the file", () => expect(parseRange("bytes=-5000", 1000)).toEqual({ kind: "range", start: 0, end: 999 }));
  it("flags start past EOF as invalid (416)", () => expect(parseRange("bytes=1000-", 1000)).toEqual({ kind: "invalid" }));
  it("flags malformed or multi-range headers as invalid", () => {
    expect(parseRange("bytes=abc", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("bytes=5-2", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("items=0-5", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("bytes=0-5,10-20", 1000)).toEqual({ kind: "invalid" });
  });
  it("flags any range on an empty file as invalid", () => expect(parseRange("bytes=0-", 0)).toEqual({ kind: "invalid" }));
});
```

`src/lib/file-storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/upload.test.ts src/lib/http-range.test.ts src/lib/file-storage.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/upload.ts`:

```ts
const DEFAULT_MAX_MB = 100;

export function maxUploadBytes(env: { MAX_UPLOAD_MB?: string } = process.env): number {
  const mb = Number(env.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_MB) * 1024 * 1024;
}

function indexOfAscii(bytes: Uint8Array, needle: string, limit: number): number {
  const n = needle.length;
  const end = Math.min(bytes.length, limit) - n;
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < n; j++) if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

/** Detects by content, not by file name or MIME type. */
export function detectFormat(bytes: Uint8Array): "pdf" | "epub" | null {
  if (indexOfAscii(bytes, "%PDF-", 1024) !== -1) return "pdf";
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (isZip && indexOfAscii(bytes, "application/epub+zip", 256) !== -1) return "epub";
  return null;
}
```

`src/lib/http-range.ts`:

```ts
export type RangeResult = { kind: "full" } | { kind: "range"; start: number; end: number } | { kind: "invalid" };

/** Single byte-range only; `end` is inclusive. Anything else that is not absent is invalid (416). */
export function parseRange(header: string | null, size: number): RangeResult {
  if (header === null) return { kind: "full" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "") || size < 1) return { kind: "invalid" };
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix < 1) return { kind: "invalid" };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return { kind: "invalid" };
  return { kind: "range", start, end };
}
```

`src/lib/request-guard.ts` (moved verbatim from the reset route):

```ts
/** Browsers always send Origin on cross-site POSTs; when present it must name this very host. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
```

In `src/app/api/test/reset/route.ts`, delete the local `isSameOrigin` function and add `import { isSameOrigin } from "@/lib/request-guard";`.

`src/lib/file-storage.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/upload.test.ts src/lib/http-range.test.ts src/lib/file-storage.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/app/api/test/reset/route.ts
git commit -m "feat(reader): upload validation, range parsing, guarded file storage

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Reading data layer and the file route

**Files:**
- Create: `src/lib/data/reading.ts`, `src/app/api/books/[id]/file/route.ts`
- Test: `src/lib/data/reading.test.ts`
- Modify: `src/lib/data/maintenance.ts` (nothing to change in logic), `src/app/settings/actions.ts`, `src/app/api/test/reset/route.ts`, `prisma/seed.ts` (delete stored files whenever books are wiped)
- Modify: `src/lib/types.ts` (add reading types)

**Interfaces:**
- Consumes: `deleteBookFiles`, `deleteAllBookFiles`, `saveBookFile`, `resolveStoragePath` (Task 3); `clampPage`, `percentFor` (Task 2); `applyStatusChange` from `@/lib/book-rules`.
- Produces, added to `src/lib/types.ts`:

```ts
export type FileFormat = "pdf" | "epub";
export interface BookFileInfo { format: FileFormat; originalName: string; sizeBytes: number; pageCount: number | null }
export interface ProgressInfo { location: string; percent: number; zoom: number | null; viewMode: "page" | "scroll"; pageTheme: "light" | "sepia" | "dark"; lastReadAt: Date }
export interface BookmarkInfo { id: string; location: string; label: string | null; createdAt: Date }
export interface HighlightInfo { id: string; page: number | null; rects: { x: number; y: number; w: number; h: number }[]; cfiRange: string | null; text: string; color: string; note: string | null; createdAt: Date }
```

  and, from `src/lib/data/reading.ts` (every function takes `db: PrismaClient` first; no `server-only`):
  - `attachFile(db, bookId, f: { format: FileFormat; originalName: string; storagePath: string; sizeBytes: number; pageCount: number | null }): Promise<void>`. Upserts the row, and clears `ReadingProgress` (new file, new positions) plus that book's highlights and bookmarks. Sets `Book.pages` from `pageCount` only when `Book.pages` is null.
  - `getFile(db, bookId): Promise<(BookFileInfo & { storagePath: string }) | null>` (null if the book is missing or soft-deleted)
  - `removeFileRow(db, bookId): Promise<string | null>` returns the old `storagePath`, and clears progress/bookmarks/highlights
  - `getProgress(db, bookId): Promise<ProgressInfo | null>`
  - `saveProgress(db, bookId, p: { location: string; percent: number; zoom?: number | null; viewMode: ProgressInfo["viewMode"]; pageTheme: ProgressInfo["pageTheme"] }, now: Date): Promise<void>`. Upserts, and also sets `Book.lastReadAt = now`.
  - `startReading(db, bookId, now): Promise<void>`. When status is `want`, applies `applyStatusChange(..., "reading", now)`. Always sets `lastReadAt`.
  - `listBookmarks / addBookmark / removeBookmark` (`addBookmark` is idempotent per `(bookId, location)`; `removeBookmark(db, bookId, id)`)
  - `listHighlights / addHighlight / updateHighlight / removeHighlight` (`addHighlight(db, bookId, h: { page: number | null; rects: Rect[]; cfiRange: string | null; text: string; color: string }): Promise<HighlightInfo>`, `updateHighlight(db, bookId, id, patch: { note?: string | null; color?: string })`)
  - `getReadingSummaries(db, bookIds?: string[]): Promise<Record<string, { percent: number; location: string; format: FileFormat }>>`. Books with a file: percent from progress, 0 if none.
- Route: `GET/POST/DELETE /api/books/[id]/file`.

- [ ] **Step 1: Add the types** to `src/lib/types.ts` (block above).

- [ ] **Step 2: Write the failing data-layer tests** `src/lib/data/reading.test.ts`. Copy the `migrate`, `newClient`, `beforeEach`/`afterEach` scaffolding from `src/lib/data/maintenance.test.ts` (lines 1-50), and seed one book per test with `db.book.create({ data: { title: "T", author: "A" } })`. Tests:

```ts
// helper
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
    expect(s[a.id]).toEqual({ percent: 25, location: "50", format: "pdf" });
    expect(s[b.id]).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/data/reading.test.ts`
Expected: FAIL, `./reading` not found.

- [ ] **Step 4: Implement `src/lib/data/reading.ts`.** Follow the interfaces above. Requirements and shape:

```ts
import type { PrismaClient } from "../../generated/prisma/client";
import { applyStatusChange } from "../book-rules";
import type { BookFileInfo, BookmarkInfo, FileFormat, HighlightInfo, ProgressInfo } from "../types";
import type { Rect } from "../reading";
```

  - A private `liveBook(db, bookId)` returning `db.book.findFirst({ where: { id: bookId, deletedAt: null } })`; `getFile` returns null when it is null.
  - `attachFile`: in one `db.$transaction`: upsert `bookFile` on `bookId`; `deleteMany` progress, bookmarks and highlights for the book; if `book.pages == null && pageCount` then `book.update({ pages: pageCount })`.
  - `removeFileRow`: read the old `storagePath`, then in a transaction delete the file row and progress/bookmarks/highlights; return the old path or null.
  - `saveProgress`: `db.$transaction([readingProgress.upsert({ where:{bookId}, create:{bookId,...p,lastReadAt:now}, update:{...p,lastReadAt:now} }), book.update({ where:{id:bookId}, data:{ lastReadAt: now } })])`; normalise `zoom` with `?? null`.
  - `startReading`: load the live book; if missing return; compute `applyStatusChange({status, startedAt, finishedAt, rating}, "reading", now)` only when `status === "want"`; update status/startedAt/finishedAt/rating and `lastReadAt: now`.
  - `addBookmark`: `findFirst({ where:{ bookId, location } })` → return it if present, else create. Map rows via `toBookmark`.
  - `addHighlight`: store `rects` as `JSON.stringify(rects)` (or `null` when `cfiRange` is set and `rects` is empty); `toHighlight` parses with a guard, falling back to `[]`.
  - `updateHighlight/removeHighlight`: use `updateMany`/`deleteMany` with `{ id, bookId }` so a wrong book is a no-op.
  - `getReadingSummaries`: `db.bookFile.findMany({ where: { book: { deletedAt: null } }, include: { book: { include: { progress: true } } } })`, map to `{ percent: progress?.percent ?? 0, location: progress?.location ?? "1", format }`.
  - `isFileFormat(s): s is FileFormat` guard for reading `format` from the DB.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/data/reading.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Implement the file route** `src/app/api/books/[id]/file/route.ts`:

```ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import { attachFile, getFile, removeFileRow } from "@/lib/data/reading";
import { deleteBookFiles, resolveStoragePath, saveBookFile } from "@/lib/file-storage";
import { parseRange } from "@/lib/http-range";
import { isSameOrigin } from "@/lib/request-guard";
import { detectFormat, maxUploadBytes } from "@/lib/upload";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const json = (body: object, status: number) => NextResponse.json(body, { status });
const MIME = { pdf: "application/pdf", epub: "application/epub+zip" } as const;

export async function GET(request: Request, { params }: Ctx) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Not found" }, 404);
  await ensureInitialized(db);
  const file = await getFile(db, id.data);
  if (!file) return json({ ok: false, error: "Not found" }, 404);

  let full: string;
  let size: number;
  try {
    full = resolveStoragePath(file.storagePath);
    size = (await stat(full)).size;
  } catch {
    return json({ ok: false, error: "File missing" }, 404);
  }

  const headers: Record<string, string> = {
    "Content-Type": MIME[file.format],
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "Content-Disposition": `inline; filename="book.${file.format}"`,
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(request.headers.get("range"), size);
  if (range.kind === "invalid") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  if (range.kind === "full") {
    return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
  }
  const { start, end } = range;
  return new NextResponse(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}

export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Cross-origin requests are not allowed" }, 403);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Book not found" }, 404);
  const limit = maxUploadBytes();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit + 1024 * 1024) return json({ ok: false, error: `File is too large (max ${Math.round(limit / 1048576)} MB)` }, 413);

  await ensureInitialized(db);
  const book = await db.book.findFirst({ where: { id: id.data, deletedAt: null }, select: { id: true } });
  if (!book) return json({ ok: false, error: "Book not found" }, 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Upload could not be read" }, 400);
  }
  const entry = form.get("file");
  if (!(entry instanceof File) || entry.size === 0) return json({ ok: false, error: "Choose a PDF or EPUB file" }, 400);
  if (entry.size > limit) return json({ ok: false, error: `File is too large (max ${Math.round(limit / 1048576)} MB)` }, 413);

  const data = Buffer.from(await entry.arrayBuffer());
  const format = detectFormat(data);
  if (!format) return json({ ok: false, error: "That file isn't a PDF or EPUB" }, 415);

  const pageCountRaw = Number(form.get("pageCount"));
  const pageCount = format === "pdf" && Number.isInteger(pageCountRaw) && pageCountRaw > 0 && pageCountRaw <= 100_000 ? pageCountRaw : null;

  const storagePath = await saveBookFile(id.data, format, data);
  await attachFile(db, id.data, { format, originalName: entry.name.slice(0, 200), storagePath, sizeBytes: data.length, pageCount });
  revalidatePath("/", "layout");
  return json({ ok: true, format, sizeBytes: data.length }, 200);
}

export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Cross-origin requests are not allowed" }, 403);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Book not found" }, 404);
  await ensureInitialized(db);
  await removeFileRow(db, id.data);
  await deleteBookFiles(id.data);
  revalidatePath("/", "layout");
  return json({ ok: true }, 200);
}
```

Note for the implementer: the client computes `pageCount` from pdf.js before uploading (Task 5), so the server never needs a PDF parser. The server treats it as a hint that only fills `Book.pages`.

- [ ] **Step 7: Delete stored files whenever books are wiped.** In `src/app/settings/actions.ts`: import `deleteAllBookFiles` from `@/lib/file-storage` and call `await deleteAllBookFiles();` right after `replaceWithDemoData(db, ...)` and after `removeAllBooks(db)`. Do the same in `src/app/api/test/reset/route.ts` (both branches) and in `prisma/seed.ts` (import with a relative path `../src/lib/file-storage`). In `src/app/books/delete-actions.ts`, no change (soft delete must keep files); but in `purgeSoftDeleted` callers the purged rows' files are left behind. Fix this in `src/lib/data/maintenance.ts`: change `purgeSoftDeleted` to first `findMany({ where: { deletedAt: { lt: before } }, select: { id: true } })`, delete the rows, and return the ids; then in `deleteBook` (in `delete-actions.ts`) call `deleteBookFiles(id)` for each returned id. Update `maintenance.test.ts` if an existing test asserts the old void return.

- [ ] **Step 8: Manual route check.** Start `npm run dev`, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/books/nope/file          # 404
curl -s -X POST -F "file=@README.md" http://localhost:3000/api/books/<a real id>/file        # 415 "isn't a PDF or EPUB"
```

Expected: 404 and a 415 JSON error. (A valid-PDF upload is covered by the e2e in Task 5.)

- [ ] **Step 9: Full regression.** Run `npm test`, `npx tsc --noEmit`, `npm run lint`. Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src prisma
git commit -m "feat(reader): reading data layer and Range-capable file route

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Upload control on the detail page and the e2e PDF fixture

**Files:**
- Create: `tests/e2e/fixtures/make-pdf.ts`, `src/components/books/upload-file.tsx`, `tests/e2e/upload-file.spec.ts`
- Modify: `src/app/books/[id]/page.tsx`, `src/lib/data/books.ts` (add `getBookReading`)
- Modify: `tests/e2e/helpers.ts` (add `uploadPdf`)

**Interfaces:**
- Consumes: `getFile`, `getProgress` (Task 4), the `POST/DELETE /api/books/[id]/file` route.
- Produces:
  - `makePdf(pages: string[]): Buffer`, a valid one-line-per-page PDF with selectable Helvetica text (used by every later e2e).
  - `uploadPdf(page: Page, pages: string[], name?: string): Promise<void>` (on a book detail page: attaches the PDF and waits for the "File attached" toast).
  - `<UploadFile bookId, file: BookFileInfo | null, fileMissing: boolean />` client component.
  - `getBookReading(id): Promise<{ file: (BookFileInfo & { missing: boolean }) | null; progress: ProgressInfo | null }>` in `src/lib/data/books.ts`. `missing` is true when the file is not on disk (`stat` fails).

- [ ] **Step 1: Fixture generator** `tests/e2e/fixtures/make-pdf.ts`

```ts
/** Builds a minimal valid PDF with one line of selectable Helvetica text per page (ASCII only). */
export function makePdf(pages: string[]): Buffer {
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((text, i) => {
    const stream = `BT /F1 24 Tf 72 700 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objs[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  out += offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** N pages whose text is "Page <n> alpha", "Page <n> beta"... easy to assert on and to search. */
export function numberedPages(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Page ${i + 1} marker`);
}
```

Sanity check: `node -e` cannot import TS, so instead, after Step 4 below, the e2e upload proves the file parses. Additionally run `npx tsx -e "require('fs').writeFileSync('x.pdf', require('./tests/e2e/fixtures/make-pdf').makePdf(['hi']))"` and confirm a PDF viewer (or `Get-Content x.pdf -Head 1` shows `%PDF-1.4`), then delete `x.pdf`.

- [ ] **Step 2: Add `uploadPdf` to `tests/e2e/helpers.ts`**

```ts
import { makePdf } from "./fixtures/make-pdf";

/** On a book detail page: attach a generated PDF through the file input and wait for confirmation. */
export async function uploadPdf(page: Page, pages: string[], name = "sample.pdf"): Promise<void> {
  await page.getByTestId("book-file-input").setInputFiles({ name, mimeType: "application/pdf", buffer: makePdf(pages) });
  await expect(toast(page, "File attached")).toBeVisible();
}
```

- [ ] **Step 3: Write the failing e2e** `tests/e2e/upload-file.spec.ts`

```ts
import { expect, test } from "@playwright/test";

import { makePdf, numberedPages } from "./fixtures/make-pdf";
import { openDetail, resetData, toast, uploadPdf } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("a book without a file offers Upload, and the file shows after attaching", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await expect(page.getByRole("link", { name: /^(Read|Continue reading)/ })).toHaveCount(0);
  await uploadPdf(page, numberedPages(3));
  await expect(page.getByText("sample.pdf")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read" })).toBeVisible();
});

test("rejects a non-PDF file with a clear message", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await page.getByTestId("book-file-input").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("just some text") });
  await expect(toast(page, "That file isn't a PDF or EPUB")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read" })).toHaveCount(0);
});

test("fills Pages from the PDF when the book has none, and can remove the file", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(4));
  await page.getByRole("button", { name: "Remove file" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(toast(page, "File removed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read" })).toHaveCount(0);
});

test("the file route serves byte ranges", async ({ page, request }) => {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(2));
  const id = page.url().split("/books/")[1];
  const full = await request.get(`/api/books/${id}/file`);
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("application/pdf");
  const part = await request.get(`/api/books/${id}/file`, { headers: { Range: "bytes=0-4" } });
  expect(part.status()).toBe(206);
  expect((await part.body()).toString()).toBe("%PDF-");
  const bad = await request.get(`/api/books/${id}/file`, { headers: { Range: "bytes=999999999-" } });
  expect(bad.status()).toBe(416);
  expect(makePdf(["x"]).length).toBeGreaterThan(0);
});
```

Note: The demo "The Hobbit" book has demo `pages`. The third test only asserts remove works; the "fills Pages" behaviour is unit-tested in Task 4. Rename the test to "can remove the file" if you prefer honesty over brevity.

- [ ] **Step 4: Run to verify it fails**

Run: `npx playwright test tests/e2e/upload-file.spec.ts`
Expected: FAIL (no `book-file-input`). (If the browser is missing, run `npx playwright install chromium` first.)

- [ ] **Step 5: Implement `getBookReading`** in `src/lib/data/books.ts`:

```ts
import { stat } from "node:fs/promises";
import { getFile, getProgress } from "@/lib/data/reading";
import { resolveStoragePath } from "@/lib/file-storage";
import type { BookFileInfo, ProgressInfo } from "@/lib/types";

export async function getBookReading(id: string): Promise<{ file: (BookFileInfo & { missing: boolean }) | null; progress: ProgressInfo | null }> {
  await ensureInitialized(db);
  const file = await getFile(db, id);
  if (!file) return { file: null, progress: null };
  let missing = false;
  try {
    await stat(resolveStoragePath(file.storagePath));
  } catch {
    missing = true;
  }
  const { storagePath: _unused, ...info } = file;
  return { file: { ...info, missing }, progress: await getProgress(db, id) };
}
```

- [ ] **Step 6: Implement `<UploadFile>`** `src/components/books/upload-file.tsx` (client). Behaviour:
  - Props: `{ bookId: string; file: BookFileInfo | null; fileMissing: boolean; progress: ProgressInfo | null }`.
  - Renders a hidden `<input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" data-testid="book-file-input">` and a visible `Button` "Upload PDF or EPUB" (label "Replace file" when `file`), wired with a ref click. A "Remove file" button opens the existing `ConfirmDialog` (look at `src/components/common/confirm-dialog.tsx` and `delete-book-button.tsx` for its props and copy the usage) whose confirm button reads "Remove".
  - On file choice: client-side pre-checks size against `NEXT_PUBLIC_MAX_UPLOAD_MB` (optional; the server is the authority). For PDFs, call `loadPdf(URL.createObjectURL(file))` from Task 6's `pdf-loader.ts`, read `numPages`, `destroy()`. If pdf.js throws `PasswordException`, still upload but with no page count. Build `FormData` with `file` and `pageCount`, `fetch(\`/api/books/${bookId}/file\`, { method: "POST", body })`, and on `res.ok` → `toast.success("File attached")` and `router.refresh()`; else `toast.error(json.error ?? ERROR_TOAST)`. Disable buttons and show "Uploading…" while pending. Reset `input.value = ""` afterwards so the same file can be picked again.
  - Text: shows `file.originalName`, formatted size (add `formatBytes(n)` to `src/lib/format.ts` with a unit test in `format.test.ts`: 0 → "0 B", 1536 → "1.5 KB", 5 * 1024 * 1024 → "5.0 MB"), and a "File missing — re-upload it to keep reading" warning line when `fileMissing`.
  - Since `pdf-loader.ts` is created in Task 6, create it now as part of this task (its full code is in Task 6 Step 3) so this task stands alone.

- [ ] **Step 7: Integrate into the detail page** `src/app/books/[id]/page.tsx`: call `const { file, progress } = await getBookReading(book.id);`, and in the actions column (below the Edit/Delete row) render:

```tsx
{file && !file.missing ? (
  <Button asChild size="sm" className="w-full sm:w-auto">
    <Link href={`/books/${book.id}/read`}>
      <BookOpen aria-hidden="true" />
      {progress ? `Continue reading (${progress.percent}%)` : "Read"}
    </Link>
  </Button>
) : null}
<UploadFile bookId={book.id} file={file} fileMissing={file?.missing ?? false} progress={progress} />
```

  Import `BookOpen` from `lucide-react`. The test in Step 3 looks for a link named exactly "Read" when there is no progress, and `/^(Read|Continue reading)/` otherwise, so keep that copy. (Page number text such as "p. 42 of 310" is added in Task 6 once the reader records it: compute `page = Number(progress.location)` and show `Continue reading (p. ${page}${file.pageCount ? \` of ${file.pageCount}\` : ""} · ${progress.percent}%)` for PDFs.) Use that fuller copy right away, and adjust the e2e regex, which already matches by prefix.

- [ ] **Step 8: Run to verify it passes**

Run: `npx playwright test tests/e2e/upload-file.spec.ts`, then `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat(reader): upload, replace and remove a book file from the detail page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: PDF reader core: open, render, resume, save progress

**Files:**
- Create: `src/components/reader/pdf-loader.ts` (if not created in Task 5), `pdf-page.tsx`, `pdf-reader.tsx`, `reader-toolbar.tsx`, `reader-shell.tsx`, `use-progress-saver.ts`
- Create: `src/app/books/[id]/read/page.tsx`, `src/app/books/[id]/read/actions.ts`, `src/app/books/[id]/read/loading.tsx`
- Test: `tests/e2e/reader-basics.spec.ts`

**Interfaces:**
- Consumes: `getFile`, `getProgress`, `listBookmarks`, `listHighlights`, `startReading`, `saveProgress` (Task 4); `clampPage`, `percentFor`, `clampZoom` (Task 2); `makePdf`, `numberedPages`, `uploadPdf` (Task 5).
- Produces:
  - `loadPdf(url: string): Promise<PDFDocumentProxy>` in `pdf-loader.ts`
  - Server actions in `read/actions.ts` (all return `ActionResult`): `startReadingAction({ id })`, `saveProgressAction({ id, location, percent, zoom, viewMode, pageTheme })`
  - `useProgressSaver(save: (p: ProgressPayload) => Promise<unknown>): { schedule(p: ProgressPayload): void; flush(): void }` (debounce 1000 ms)
  - `<PdfPage pdf, pageNumber, scale, theme, highlights, searchQuery, onTextReady? />`
  - `<ReaderShell data />` where `data` is `{ bookId; title; format; fileUrl; pageCount: number | null; progress: ProgressInfo | null; bookmarks: BookmarkInfo[]; highlights: HighlightInfo[]; status: BookStatus }`
  - `data-testid`s: `reader-page-input` is not needed; use accessible names: textbox "Page", text "of N", buttons "Previous page", "Next page".

- [ ] **Step 1: Write the failing e2e** `tests/e2e/reader-basics.spec.ts`

```ts
import { expect, test } from "@playwright/test";

import { numberedPages } from "./fixtures/make-pdf";
import { openDetail, resetData, uploadPdf } from "./helpers";

async function openReader(page: import("@playwright/test").Page, pages = 5) {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(pages));
  await page.getByRole("link", { name: "Read" }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("1");
}

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("renders the first page text and turns pages with buttons and keys", async ({ page }) => {
  await openReader(page);
  await expect(page.getByText("Page 1 marker")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 marker")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
  await page.keyboard.press("PageUp");
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("2");
  await page.getByRole("textbox", { name: "Page" }).fill("5");
  await page.getByRole("textbox", { name: "Page" }).press("Enter");
  await expect(page.getByText("Page 5 marker")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});

test("resumes where you left off after a reload and from the detail page", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 3 marker")).toBeVisible();
  await page.waitForTimeout(1500); // debounce
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("link", { name: /Continue reading \(p\. 3 of 5/ })).toBeVisible();
});

test("first open moves a Want to read book to Reading", async ({ page }) => {
  await openReader(page);
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for The Hobbit" })).toHaveValue("reading");
});

test("offers Mark as finished on the last page and never applies it silently", async ({ page }) => {
  await openReader(page, 2);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: "Mark as finished" })).toBeVisible();
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for The Hobbit" })).toHaveValue("reading");
});

test("an unreadable PDF shows a clear message with a re-upload path", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  const truncated = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"); // valid magic, no pages
  await page.getByTestId("book-file-input").setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: truncated });
  await page.getByRole("link", { name: "Read" }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't open this file");
  await expect(page.getByRole("link", { name: "Back to book" })).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/reader-basics.spec.ts`
Expected: FAIL (no reader route).

- [ ] **Step 3: `pdf-loader.ts`**

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Browser only. The worker is copied into /public by scripts/copy-pdf-worker.mjs. */
export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ url }).promise;
}
```

- [ ] **Step 4: Server actions** `src/app/books/[id]/read/actions.ts` (`"use server"`), following the style of `status-actions.ts`. Zod schemas go in `src/lib/validation.ts`:

```ts
export const progressSchema = z.object({
  id: idSchema,
  location: z.string().min(1).max(500),
  percent: z.number().int().min(0).max(100),
  zoom: z.number().min(0.5).max(3).nullable(),
  viewMode: z.enum(["page", "scroll"]),
  pageTheme: z.enum(["light", "sepia", "dark"]),
});
```

  `startReadingAction({ id })` → `ensureInitialized(db)` then `startReading(db, id, new Date())`. `saveProgressAction(input)` → parse with `progressSchema`, `saveProgress(db, id, {...}, new Date())`. Both catch errors and return `{ ok: false, error: ERROR_TOAST }`; **neither calls `revalidatePath`** (the reader must not re-render mid-read; pages are `force-dynamic` so navigating away picks up fresh data). `startReadingAction` does call `revalidatePath("/", "layout")` since it changes status and runs once.

- [ ] **Step 5: `use-progress-saver.ts`**

```ts
"use client";
import { useCallback, useEffect, useRef } from "react";

export type ProgressPayload = {
  location: string;
  percent: number;
  zoom: number | null;
  viewMode: "page" | "scroll";
  pageTheme: "light" | "sepia" | "dark";
};

export function useProgressSaver(save: (p: ProgressPayload) => Promise<unknown>, delayMs = 1000) {
  const pending = useRef<ProgressPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) void saveRef.current(p);
  }, []);

  const schedule = useCallback(
    (p: ProgressPayload) => {
      pending.current = p;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}
```

  `visibilitychange` flushes on tab hide too; the effect cleanup flushes on unmount (navigating back).

- [ ] **Step 6: `pdf-page.tsx`.** Client component rendering canvas + text layer + highlight overlay. Import `"pdfjs-dist/web/pdf_viewer.css"` here (global CSS import from node_modules is allowed in App Router client components). Structure:

```tsx
"use client";
import "pdfjs-dist/web/pdf_viewer.css";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { HighlightInfo } from "@/lib/types";
import type { PageTheme } from "@/lib/reading";

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: "rgba(250, 204, 21, 0.4)",
  green: "rgba(74, 222, 128, 0.4)",
  blue: "rgba(96, 165, 250, 0.4)",
  pink: "rgba(244, 114, 182, 0.4)",
};
const THEME_FILTER: Record<PageTheme, string> = {
  light: "none",
  sepia: "sepia(0.55) contrast(0.95)",
  dark: "invert(0.92) hue-rotate(180deg)",
};

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  theme: PageTheme;
  highlights: HighlightInfo[]; // already filtered to this page
  searchQuery: string;
  onTextReady?: (pageNumber: number, hasText: boolean) => void;
}

export function PdfPage({ pdf, pageNumber, scale, theme, highlights, searchQuery, onTextReady }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<unknown> } | null = null;
    let textLayer: { cancel(): void; render(): Promise<unknown> } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textDiv = textRef.current;
      if (!canvas || !textDiv) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setSize({ w: viewport.width, h: viewport.height });
      renderTask = page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await renderTask.promise;
      if (cancelled) return;
      const content = await page.getTextContent();
      if (cancelled) return;
      textDiv.replaceChildren();
      textLayer = new pdfjs.TextLayer({ textContentSource: content, container: textDiv, viewport });
      await textLayer.render();
      onTextReady?.(pageNumber, content.items.length > 0);
    })().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== "RenderingCancelledException" && !cancelled) console.error(e);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, scale, onTextReady]);

  // Search hits: mark text spans containing the query. Coarse (span level) by design.
  useEffect(() => {
    const spans = textRef.current?.querySelectorAll("span");
    const q = searchQuery.trim().toLowerCase();
    spans?.forEach((s) => s.classList.toggle("search-hit", q !== "" && (s.textContent ?? "").toLowerCase().includes(q)));
  }, [searchQuery, size]);

  return (
    <div
      data-page={pageNumber}
      className="relative mx-auto bg-white shadow-md"
      style={{ width: size?.w, height: size?.h, ["--scale-factor" as string]: scale, ["--total-scale-factor" as string]: scale }}
    >
      <canvas ref={canvasRef} style={{ width: size?.w, height: size?.h, filter: THEME_FILTER[theme] }} />
      <div ref={textRef} className="textLayer" />
      {highlights.flatMap((h) =>
        h.rects.map((r, i) => (
          <div
            key={`${h.id}-${i}`}
            data-highlight-id={h.id}
            className="pointer-events-none absolute mix-blend-multiply"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, background: HIGHLIGHT_BG[h.color] ?? HIGHLIGHT_BG.yellow }}
          />
        )),
      )}
    </div>
  );
}
```

  Add to `src/app/globals.css`: `.textLayer span.search-hit { background: rgba(250, 204, 21, 0.55); color: transparent; border-radius: 2px; }`. (`onTextReady` must be a stable callback from the parent, wrapped in `useCallback`, or the effect will re-render the page on every parent render.)

- [ ] **Step 7: `reader-toolbar.tsx`** (presentational; props-driven). Props: `{ page, pageCount, onPage(n), zoom, onZoom(z), fitWidth(), viewMode, onViewMode, theme, onTheme, onToggleFullscreen, onToggleSidebar, onToggleSearch, bookmarked, onToggleBookmark, backHref, title }`. Renders, using the existing `Button`, `NativeSelect` (see `src/components/ui/native-select.tsx`) and lucide icons: a "Back to book" `Link` (icon `ArrowLeft`, accessible name "Back to book"), the title (truncate), Previous/Next page buttons (`aria-label="Previous page"`/`"Next page"`, disabled at the ends), a page `<input aria-label="Page" inputMode="numeric">` that commits on Enter/blur, the text `of {pageCount}`, zoom -/+ buttons (`aria-label="Zoom out"`/`"Zoom in"`) with the percent, "Fit width" button, a view-mode select "View mode" (Page/Scroll), a theme select "Page theme" (Light/Sepia/Dark), bookmark toggle (`aria-label` "Add bookmark"/"Remove bookmark", `aria-pressed`), search (`aria-label="Search in book"`), contents/panel toggle (`aria-label="Toggle side panel"`), fullscreen (`aria-label="Toggle fullscreen"`). Wrap in a `flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2` bar. The bookmark, search, side-panel and theme/mode controls are wired up in later tasks but rendered from this task so the toolbar is written once; until then they receive no-op handlers from `PdfReader`. Their behaviour is tested in Tasks 7-9.

- [ ] **Step 8: `pdf-reader.tsx`.** Client component; the reader state machine:

  - Props `data: ReaderData` (from the spec above). State: `pdf: PDFDocumentProxy | null`, `error: "open" | null`, `page` (initial `clampPage(Number(progress?.location ?? 1), pageCount ?? Infinity)` and re-clamped once the real `numPages` is known), `zoom` (initial `progress?.zoom ?? 1.25`), `viewMode`, `pageTheme` (from progress, defaults page/light).
  - On mount: `loadPdf(data.fileUrl)`; on success set `pdf`, and re-clamp `page` to `pdf.numPages`; on failure `setError("open")`. Fire `startReadingAction({ id })` once (guard with a ref).
  - Progress: `const { schedule } = useProgressSaver((p) => saveProgressAction({ id: data.bookId, ...p }))`, then `useEffect(() => { if (pdf) schedule({ location: String(page), percent: percentFor(page, pdf.numPages), zoom, viewMode, pageTheme }) }, [page, zoom, viewMode, pageTheme, pdf, schedule])`. Skip the very first run so opening a book does not rewrite an identical position (use a `mounted` ref); the change of `lastReadAt` is handled by `startReadingAction`.
  - Page mode: render a single `<PdfPage pageNumber={page} …/>` in a scrollable container that scrolls to top on page change. Scroll mode: render `PdfPage` for every page inside a lazily-rendered wrapper (`LazyPage`: a div with `min-height` estimated from page 1's size × scale; it mounts `PdfPage` only when an `IntersectionObserver` with `rootMargin: "800px 0px"` reports it visible, and keeps it mounted afterwards); track the current page as the page whose wrapper has the largest intersection ratio, and on entering scroll mode or on `page` set by the user, `scrollIntoView` the matching `[data-page]` wrapper.
  - Keyboard (window `keydown`, ignored when the target is an input/textarea/select): `ArrowRight`/`PageDown`/`Space`-less → next, `ArrowLeft`/`PageUp` → prev, `Home`/`End` → first/last. (`b`, `/` are added in Tasks 7 and 8.)
  - Fit width: compute `zoom = clampZoom((containerWidth - 32) / page1UnscaledWidth)` using `(await pdf.getPage(1)).getViewport({ scale: 1 }).width`.
  - Fullscreen: `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`.
  - Errors: if `error`, render `<div role="alert">` with "Shelfwise couldn't open this file. It may be damaged or password-protected." plus a `Link` "Back to book" (the same detail-page href, where Upload/Replace lives). Also handle `PasswordException` by the same message.
  - "Mark as finished": when `page === pdf.numPages` and `data.status !== "finished"`, show a bottom bar with a `Button` "Mark as finished" that calls the existing `updateBookStatus({ id, status: "finished" })` from `@/app/books/status-actions`, then `toast.success(STATUS_TOASTS.finished)` and hides itself.
  - Bookmarks/highlights/search wiring: accept `data.bookmarks` and `data.highlights` and hold them in state now (Tasks 7-9 use them); pass `highlights.filter(h => h.page === n)` to each `PdfPage`.

- [ ] **Step 9: `reader-shell.tsx`** (client):

```tsx
"use client";
import dynamic from "next/dynamic";

import type { ReaderData } from "@/components/reader/types";

const PdfReader = dynamic(() => import("@/components/reader/pdf-reader").then((m) => m.PdfReader), { ssr: false, loading: () => <p className="p-6 text-sm text-muted-foreground">Opening…</p> });

export function ReaderShell({ data }: { data: ReaderData }) {
  return <PdfReader data={data} />;
}
```

  Create `src/components/reader/types.ts` with `ReaderData` (fields listed in Interfaces above). EPUB dispatch is added in Task 11.

- [ ] **Step 10: The server page** `src/app/books/[id]/read/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReaderShell } from "@/components/reader/reader-shell";
import { getBook, getBookReading } from "@/lib/data/books";
import { listBookmarks, listHighlights } from "@/lib/data/reading";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const book = await getBook((await params).id);
  return { title: book ? `Reading ${book.title}` : "Book not found" };
}

export default async function ReadPage({ params }: PageProps) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  const { file, progress } = await getBookReading(id);
  if (!file || file.missing) redirect(`/books/${id}`); // detail page shows the upload / "file missing" state
  const [bookmarks, highlights] = await Promise.all([listBookmarks(db, id), listHighlights(db, id)]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <ReaderShell
        data={{ bookId: id, title: book.title, status: book.status, format: file.format, fileUrl: `/api/books/${id}/file`, pageCount: file.pageCount, progress, bookmarks, highlights }}
      />
    </div>
  );
}
```

  `loading.tsx`: a centered "Opening…" paragraph. Because `ReaderData` crosses the server/client boundary, `Date` fields serialise fine in RSC props.

- [ ] **Step 11: Run to verify it passes**

Run: `npx playwright test tests/e2e/reader-basics.spec.ts`
Expected: PASS. If `import("pdfjs-dist")` fails to bundle under Turbopack (for example an error about `canvas` or Node built-ins), add `serverExternalPackages: ["pdfjs-dist"]` and, if needed, `turbopack: { resolveAlias: { canvas: "./empty-module.ts" } }` to `next.config.ts` with an empty module file; re-run. Then `npm test`, `npx tsc --noEmit`, `npm run lint`.

- [ ] **Step 12: Commit**

```bash
git add src tests
git commit -m "feat(reader): PDF reader with resume, progress saving and finish prompt

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bookmarks, contents, view controls

**Files:**
- Create: `src/components/reader/side-panel.tsx`
- Modify: `src/components/reader/pdf-reader.tsx`, `src/app/books/[id]/read/actions.ts`, `src/lib/validation.ts`
- Test: `tests/e2e/reader-bookmarks.spec.ts`

**Interfaces:**
- Consumes: `addBookmark`, `removeBookmark`, `listBookmarks` (Task 4), toolbar props (Task 6).
- Produces: actions `addBookmarkAction({ id, location, label? }): ActionResult<BookmarkInfo>`, `removeBookmarkAction({ id, bookmarkId }): ActionResult`; `<SidePanel tab, onTab, bookmarks, highlights, outline, currentPage, onGoToPage(n), onRemoveBookmark(id), … />` with tabs named "Contents", "Bookmarks", "Highlights" (Highlights tab is filled in Task 9); `pdfOutlineToItems(pdf): Promise<{ title: string; page: number; depth: number }[]>` in `side-panel.tsx` or a sibling `outline.ts`.

- [ ] **Step 1: Write the failing e2e** `tests/e2e/reader-bookmarks.spec.ts`. Use `openReader` like Task 6 (copy the helper into `tests/e2e/helpers.ts` as an exported `openReader(page, pages = 5)` and update `reader-basics.spec.ts` to import it). Tests:
  - press `b` on page 1, expect the "Remove bookmark" button (`aria-pressed=true`); open the side panel ("Toggle side panel"), tab "Bookmarks", expect a list item "Page 1"; go to page 4, add a bookmark via the toolbar button, expect two items; click "Page 1" in the panel → page input shows 1.
  - reload the page and check both bookmarks persist; remove one from the panel with its "Remove bookmark on page N" button and confirm the list shrinks.
  - adding a bookmark twice on the same page does not duplicate it (press `b` twice ⇒ toggled off then on ⇒ one item).
  - view controls: "Page theme" → Sepia and Dark apply `filter` to the canvas (`expect(page.locator("canvas").first()).toHaveCSS("filter", /sepia|invert/)`); "Zoom in" changes the zoom percent text; "View mode" → Scroll shows all five `[data-page]` wrappers and, after choosing Page again, one. Persist: set theme Dark and zoom in, reload, expect the same theme selected and the same zoom text (validate the saved values via the progress payload; wait 1.5 s before reloading).
  - Contents tab shows "This PDF has no table of contents" for the fixture (it has no outline).

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/reader-bookmarks.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Actions.** In `validation.ts` add:

```ts
export const bookmarkSchema = z.object({ id: idSchema, location: z.string().min(1).max(500), label: z.string().trim().max(200).optional() });
export const bookmarkRemoveSchema = z.object({ id: idSchema, bookmarkId: idSchema });
```

  In `read/actions.ts`, `addBookmarkAction` → `addBookmark(db, id, location, label ?? null)` returning `{ ok: true, data: bookmark }`; `removeBookmarkAction` → `removeBookmark(db, id, bookmarkId)`. Same error handling and no revalidation as Task 6.

- [ ] **Step 4: Outline extraction** (`src/components/reader/outline.ts`):

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";

export type OutlineItem = { title: string; page: number; depth: number };

type RawOutline = { title: string; dest: string | unknown[] | null; items: RawOutline[] }[];

export async function pdfOutlineToItems(pdf: PDFDocumentProxy): Promise<OutlineItem[]> {
  const raw = (await pdf.getOutline()) as RawOutline | null;
  if (!raw) return [];
  const out: OutlineItem[] = [];
  async function walk(nodes: RawOutline, depth: number) {
    for (const node of nodes) {
      try {
        const dest = typeof node.dest === "string" ? await pdf.getDestination(node.dest) : node.dest;
        if (dest && dest[0] && typeof dest[0] === "object") {
          const index = await pdf.getPageIndex(dest[0] as never);
          out.push({ title: node.title, page: index + 1, depth });
        }
      } catch {
        /* skip an unresolvable entry */
      }
      if (node.items?.length) await walk(node.items, depth + 1);
    }
  }
  await walk(raw, 0);
  return out;
}
```

- [ ] **Step 5: `side-panel.tsx`.** A right-hand `aside` (fixed-width `w-80` on ≥ md; a bottom sheet overlay `fixed inset-x-0 bottom-0 max-h-[70vh]` below md). Tabs use `role="tablist"` buttons "Contents", "Bookmarks", "Highlights" (reuse `RovingTablist` from `src/components/books/roving-tablist.tsx` if its props fit; otherwise plain buttons with `role="tab"` and `aria-selected`). Contents: list of buttons with `style={{ paddingLeft: depth * 12 }}` calling `onGoToPage`, or the empty message "This PDF has no table of contents". Bookmarks: list items "Page N" (the accessible name of the jump button) plus an optional label, and a remove button `aria-label="Remove bookmark on page N"`; empty state "No bookmarks yet. Press B to add one." Highlights: placeholder text "No highlights yet" (Task 9 replaces this).

- [ ] **Step 6: Wire into `pdf-reader.tsx`.** State `bookmarks` (initial `data.bookmarks`), `panelOpen`, `panelTab`. `bookmarked = bookmarks.some(b => b.location === String(page))`. `toggleBookmark`: if bookmarked → optimistic remove + `removeBookmarkAction`; else call `addBookmarkAction` and append the returned bookmark (on failure `toast.error(ERROR_TOAST)`). `b` key toggles (skip when typing in inputs). Contents: `useEffect(() => { if (pdf) pdfOutlineToItems(pdf).then(setOutline) }, [pdf])`. Pass everything into `ReaderToolbar` and `SidePanel`. Sort bookmarks by `Number(location)` for display. Theme and zoom are already persisted via Task 6's progress payload.

- [ ] **Step 7: Run to verify it passes**

Run: `npx playwright test tests/e2e/reader-bookmarks.spec.ts tests/e2e/reader-basics.spec.ts` then `npx tsc --noEmit`, `npm run lint`.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat(reader): bookmarks, table of contents and view controls

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Search inside the book

**Files:**
- Create: `src/components/reader/search-panel.tsx`, `src/components/reader/page-text.ts`
- Modify: `src/components/reader/pdf-reader.tsx`
- Test: `tests/e2e/reader-search.spec.ts`

**Interfaces:**
- Consumes: `searchPages`, `SearchHit` (Task 2); `PdfPage` `searchQuery` prop (Task 6).
- Produces: `getAllPageTexts(pdf: PDFDocumentProxy, onProgress?: (done: number, total: number) => void): Promise<string[]>` (cached per `pdf` in a `WeakMap`); `<SearchPanel query, onQuery, hits, current, onPrev, onNext, onPick(i), loading, noText />`.

- [ ] **Step 1: Write the failing e2e** `tests/e2e/reader-search.spec.ts`. Build a PDF with `["Alpha zebra one", "Nothing here", "Zebra again and zebra twice", "The end"]` (extend `openReader` to accept custom page texts, or upload manually).
  - Press `/` → the "Search in book" textbox is focused. Type "zebra" → text "3 results"; the first hit jumps to page 1; "Next result" goes to page 3 twice (two matches on that page) and then wraps to page 1; "Previous result" goes back. The text layer span containing the match has class `search-hit` (`expect(page.locator(".search-hit").first()).toBeVisible()`).
  - Clicking a hit in the list jumps to its page.
  - Searching a term that is not present shows "No results".
  - Regex characters: searching `(` shows "No results" and does not crash.
  - Closing search (`Escape`) clears highlighting (`.search-hit` count 0).
  - No-text PDF: upload a PDF whose page has no text (make `makePdf([""])`) and expect "no selectable text in this PDF" in the search panel after typing.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/reader-search.spec.ts`
Expected: FAIL.

- [ ] **Step 3: `page-text.ts`**

```ts
import type { PDFDocumentProxy } from "pdfjs-dist";

const cache = new WeakMap<PDFDocumentProxy, Promise<string[]>>();

/** Text of every page (index i = page i + 1). Cached per document; pages load one at a time. */
export function getAllPageTexts(pdf: PDFDocumentProxy, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  let cached = cache.get(pdf);
  if (!cached) {
    cached = (async () => {
      const texts: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        texts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim());
        onProgress?.(n, pdf.numPages);
      }
      return texts;
    })();
    cache.set(pdf, cached);
  }
  return cached;
}
```

- [ ] **Step 4: `search-panel.tsx`.** A panel above the reading area (or inside the side panel, your choice; keep it as a separate tab-less popover under the toolbar): an `<input aria-label="Search in book" type="search">`, the summary text (`"{n} results"` / `"1 result"` / `"No results"` / `"Searching… {done} of {total}"`), buttons `aria-label="Previous result"` / `"Next result"`, and a scrollable list of hit buttons `Page {page}: {snippet}`. When `noText` is true (all page texts empty) show "There's no selectable text in this PDF, so search and highlights aren't available."

- [ ] **Step 5: Wire into `pdf-reader.tsx`.** State: `searchOpen`, `query`, `hits`, `hitIndex`, `pageTexts`, `loading`. When the panel opens, call `getAllPageTexts(pdf, progress)` once; then `hits = useMemo(() => searchPages(pageTexts, query), …)` (debounce the query by ~200 ms). Selecting `hitIndex` sets `page = hits[hitIndex].page` (and wraps around at the ends). Pass `searchQuery={searchOpen ? query : ""}` to each `PdfPage`. `/` opens and focuses search (prevent the default `/` character from being typed); `Escape` closes it and clears the query. `noText = pageTexts.every(t => t === "")`.

- [ ] **Step 6: Run to verify it passes**

Run: `npx playwright test tests/e2e/reader-search.spec.ts tests/e2e/reader-basics.spec.ts tests/e2e/reader-bookmarks.spec.ts`, then `npx tsc --noEmit`, `npm run lint`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(reader): full-text search inside the PDF

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Highlights and annotations

**Files:**
- Create: `src/components/reader/selection-popover.tsx`, `src/components/reader/selection.ts`
- Modify: `src/components/reader/pdf-reader.tsx`, `src/components/reader/side-panel.tsx`, `src/app/books/[id]/read/actions.ts`, `src/lib/validation.ts`
- Test: `src/components/reader/selection.test.ts` (vitest; add `"src/**/*.test.ts"` already matches), `tests/e2e/reader-highlights.spec.ts`

**Interfaces:**
- Consumes: `rectsToFractions`, `dropContainedRects`, `HIGHLIGHT_COLORS` (Task 2); `addHighlight`, `updateHighlight`, `removeHighlight` (Task 4).
- Produces:
  - `selectionToHighlight(selection: { text: string; rects: BoxLike[]; box: BoxLike }): { text: string; rects: Rect[] } | null` in `selection.ts` (pure; returns null for empty text or no rects; normalises text whitespace; caps text at 2000 chars)
  - actions `addHighlightAction({ id, page, rects, text, color })`, `updateHighlightAction({ id, highlightId, note?, color? })`, `removeHighlightAction({ id, highlightId })`
  - `<SelectionPopover anchor: {x, y}, onPick(color), onSaveNote(color, note), onClose />`

- [ ] **Step 1: Write the failing unit test** `src/components/reader/selection.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { selectionToHighlight } from "@/components/reader/selection";

const box = { left: 0, top: 0, width: 100, height: 200 };

describe("selectionToHighlight", () => {
  it("normalises whitespace and converts rects to fractions", () => {
    const r = selectionToHighlight({ text: "  hello\n  world ", rects: [{ left: 10, top: 20, width: 50, height: 10 }], box });
    expect(r).toEqual({ text: "hello world", rects: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.05 }] });
  });
  it("returns null for empty text or no usable rects", () => {
    expect(selectionToHighlight({ text: "   ", rects: [{ left: 0, top: 0, width: 5, height: 5 }], box })).toBeNull();
    expect(selectionToHighlight({ text: "x", rects: [], box })).toBeNull();
  });
  it("drops nested duplicate rects", () => {
    const r = selectionToHighlight({
      text: "x",
      rects: [
        { left: 0, top: 0, width: 100, height: 20 },
        { left: 10, top: 0, width: 20, height: 20 },
      ],
      box,
    });
    expect(r?.rects).toHaveLength(1);
  });
  it("caps very long selections", () => {
    const r = selectionToHighlight({ text: "a".repeat(5000), rects: [{ left: 0, top: 0, width: 5, height: 5 }], box });
    expect(r?.text.length).toBe(2000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/reader/selection.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `selection.ts`**

```ts
import { dropContainedRects, rectsToFractions, type BoxLike, type Rect } from "@/lib/reading";

const MAX_TEXT = 2000;

export function selectionToHighlight(input: { text: string; rects: BoxLike[]; box: BoxLike }): { text: string; rects: Rect[] } | null {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (text === "") return null;
  const rects = dropContainedRects(rectsToFractions(input.rects, input.box));
  if (rects.length === 0) return null;
  return { text, rects };
}
```

Run: `npx vitest run src/components/reader/selection.test.ts` → PASS.

- [ ] **Step 4: Write the failing e2e** `tests/e2e/reader-highlights.spec.ts` with a helper `selectText(page, text)` that finds the text-layer span (`page.locator(".textLayer span", { hasText: text })`), gets its bounding box, and does a `page.mouse` triple-click selection over it (`await span.click({ clickCount: 3 })`), which selects the line. Tests:
  - select "Page 1 marker" → popover with buttons "Highlight yellow", "Highlight green", "Highlight blue", "Highlight pink" appears; click "Highlight green"; an overlay element `[data-highlight-id]` becomes visible on the page; the popover closes.
  - reload → the overlay is still there (persisted); open the panel's Highlights tab → item containing "Page 1 marker" and "Page 1".
  - add a note: select again on page 2, click "Add note", type "why this matters", press "Save note" → the Highlights tab shows the note text; reload and it's still there.
  - clicking a highlight in the panel jumps to its page (from page 3, click the page-1 highlight → page input shows 1).
  - delete via `aria-label="Delete highlight"` removes the overlay and the list item.
  - changing colour from the panel (`aria-label="Highlight colour"` select) changes the overlay's background (assert it differs from before via `toHaveCSS("background-color", …)`).
  - a no-text PDF (`makePdf([""])`): triple-click yields no popover, and the panel shows the "no selectable text" message.

- [ ] **Step 5: Run to verify it fails**

Run: `npx playwright test tests/e2e/reader-highlights.spec.ts`
Expected: FAIL.

- [ ] **Step 6: Actions and validation.** In `validation.ts`:

```ts
const highlightRect = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
const highlightColor = z.enum(["yellow", "green", "blue", "pink"]);
export const highlightAddSchema = z.object({
  id: idSchema,
  page: z.number().int().min(1).max(100_000).nullable(),
  rects: z.array(highlightRect).max(200),
  cfiRange: z.string().max(1000).nullable().optional(),
  text: z.string().trim().min(1).max(2000),
  color: highlightColor,
});
export const highlightUpdateSchema = z.object({
  id: idSchema,
  highlightId: idSchema,
  note: z.string().trim().max(2000).nullable().optional(),
  color: highlightColor.optional(),
});
export const highlightRemoveSchema = z.object({ id: idSchema, highlightId: idSchema });
```

  Actions call the Task 4 functions; an empty `note` string is stored as `null`. Same error/no-revalidate pattern as before.

- [ ] **Step 7: `selection-popover.tsx`.** Fixed-position card at `anchor` (`position: fixed; left: anchor.x; top: anchor.y - 8; transform: translate(-50%, -100%)`), containing four round colour buttons with `aria-label="Highlight {colour}"` (background from the same palette as `PdfPage`), an "Add note" button that swaps in a `<textarea aria-label="Note">` plus "Save note" (which saves the highlight with the last-chosen colour, default yellow, and the note), and closes on `Escape` or outside `mousedown`. `onMouseDown={(e) => e.preventDefault()}` on the card so clicking it does not clear the text selection before the handler reads it.

- [ ] **Step 8: Wire into `pdf-reader.tsx`.** On `mouseup` inside the pages container (and `keyup` for shift-selection), read `window.getSelection()`; if non-collapsed, find the page element via `range.commonAncestorContainer` → `closest("[data-page]")`; ignore selections spanning multiple pages by using only the page that contains the range start (highlight the portion on that page: compute rects from `range.getClientRects()` and filter those whose centre lies inside the page box). Build `selectionToHighlight({ text: selection.toString(), rects: [...range.getClientRects()], box: pageEl.getBoundingClientRect() })`; if it is null show nothing; otherwise set `pending = { page, highlight, anchor: { x: rectCentreX, y: rectTop } }` and show the popover. Picking a colour calls `addHighlightAction`, appends the returned `HighlightInfo` to state, clears the selection (`selection.removeAllRanges()`), and closes the popover; on failure `toast.error(ERROR_TOAST)`. When `noText` (from `onTextReady` reporting every rendered page as text-less, or from `getAllPageTexts`), do not show the popover. Highlights list in `SidePanel` (Highlights tab): items with the colour swatch, "Page N", the quoted text (line-clamped), the note, and controls: a "Highlight colour" select, a note textarea edited inline that saves on blur via `updateHighlightAction`, and a `Delete highlight` icon button (optimistic removal). Clicking the quote jumps to the page.

- [ ] **Step 9: Run to verify it passes**

Run: `npx playwright test tests/e2e/reader-highlights.spec.ts` plus all reader specs, then `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: PASS. (If triple-click selection is flaky in headless Chromium, replace it with `page.evaluate` that builds a `Range` over the span's text node, sets it via `getSelection().addRange`, and dispatches a `mouseup` event on the pages container.)

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "feat(reader): highlights with colours and notes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Library integration and Settings

**Files:**
- Create: `src/components/books/continue-reading.tsx`, `src/components/books/reading-progress.tsx`
- Modify: `src/components/books/book-card.tsx`, `src/components/books/book-grid.tsx`, `src/app/(library)/page.tsx`, `src/app/settings/page.tsx`, `src/lib/types.ts`
- Test: `tests/e2e/library-reading.spec.ts`

**Interfaces:**
- Consumes: `getReadingSummaries` (Task 4), `storageUsedBytes` (Task 3), `formatBytes` (Task 5).
- Produces: `type ReadingSummary = { percent: number; location: string; format: FileFormat }` (add to `types.ts`, and use it in `reading.ts`'s return type); `<ReadingProgress percent />` (a slim progress bar with `role="progressbar"`, `aria-valuenow`, `aria-label="Reading progress"`); `<ContinueReading items />`; `BookCard` and `BookGrid` accept an optional `reading?: ReadingSummary` / `readingByBook?: Record<string, ReadingSummary>`.

- [ ] **Step 1: Write the failing e2e** `tests/e2e/library-reading.spec.ts`:
  - With demo data and no files: no "Continue reading" heading; cards show no progress bar and no "Read" link.
  - After uploading a PDF to "The Hobbit", reading to page 3 of 5 (wait for the debounce) and going back to `/`: a "Continue reading" region lists "The Hobbit" with a link "Continue" → `/books/<id>/read`; the card for The Hobbit has a `progressbar` with `aria-valuenow` 60; clicking "Continue" opens the reader at page 3.
  - A book with a file but no progress yet shows a card link "Read" and no "Continue reading" row entry.
  - Finished books with files show a "Read" link but do not appear in the "Continue reading" row (only status `reading` books with progress do), and the row is ordered by most recently read (read book B after book A: B first).
  - Settings shows "Book files" with the used storage (e.g. "Storage used" `formatBytes` text after an upload), and "Delete all books" (existing flow in `settings.spec.ts`) removes the files: after it, `GET /api/books/<id>/file` for the old id returns 404. Add the check to a new test here using `request`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/library-reading.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `(library)/page.tsx`: `const summaries = await getReadingSummaries(db);` and `const continueItems = books.filter(b => b.status === "reading" && summaries[b.id] && summaries[b.id].percent >= 0 ...)`. Define "has progress" precisely: `summaries[b.id]` exists and the book has a `ReadingProgress` row, so extend `getReadingSummaries` to include `lastReadAt: Date | null` (null when there is no progress row) in the `ReadingSummary` type, add that field to the Task 4 unit test expectation (`lastReadAt: expect.any(Date)` for `a`), and sort `continueItems` by `lastReadAt` descending, capped at 3. Render `<ContinueReading>` above the tabs only when there are items and `params.q === ""`. It is a `<section aria-labelledby>` headed "Continue reading" with a horizontal list of small cards (cover, title, percent, `Continue` link button). In `BookCard`, when `reading` exists, render `<ReadingProgress percent>` above the status select and a small `Button asChild` link "Read" (no progress yet) or "Continue" (progress exists) to `/books/${id}/read`. Settings: add a "Book files" section with `Storage used: {formatBytes(await storageUsedBytes())}`.

- [ ] **Step 4: Run to verify it passes**

Run: the new spec, then the whole suite `npm test`, `npx playwright test`, `npx tsc --noEmit`, `npm run lint`.
Expected: all pass, including the original 37 e2e tests. (Existing tests may match `getByRole("link", { name: ... })` and could be affected by the new "Read"/"Continue" links only for books with files, which the demo data does not have, so none should change.)

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(reader): progress on cards, Continue reading row and storage usage

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: EPUB reader

**Files:**
- Create: `src/components/reader/epub-reader.tsx`, `tests/e2e/fixtures/make-epub.ts`, `tests/e2e/reader-epub.spec.ts`
- Modify: `src/components/reader/reader-shell.tsx`, `src/components/books/upload-file.tsx` (EPUB has no client page count), `src/app/books/[id]/page.tsx` (progress label for EPUB: `Continue reading (${percent}%)`)

**Interfaces:**
- Consumes: the same `ReaderData`, actions and `SidePanel`, `ReaderToolbar` components, with `location` = CFI, `percent` from `book.locations`, `Highlight.cfiRange`, `Bookmark.location` = CFI.
- Produces: `<EpubReader data />`; `makeEpub(chapters: { title: string; body: string }[]): Buffer` (uses `node:zlib` only, stored (uncompressed) zip entries with `mimetype` first).

- [ ] **Step 1: EPUB fixture** `tests/e2e/fixtures/make-epub.ts`. Write a minimal ZIP writer with stored entries (CRC-32 table, local file headers, central directory, EOCD) and these entries in order: `mimetype` (`application/epub+zip`), `META-INF/container.xml` (rootfile `OEBPS/content.opf`), `OEBPS/content.opf` (manifest + spine + `<dc:title>`), `OEBPS/nav.xhtml` (a `nav epub:type="toc"` listing chapters) and `OEBPS/ch<N>.xhtml` per chapter. Add a unit test `tests/e2e/fixtures/make-epub.test.ts`? Not needed in vitest's include; instead verify in Step 4's e2e that `detectFormat` accepts it (upload succeeds) and that epub.js opens it.

- [ ] **Step 2: Write the failing e2e** `tests/e2e/reader-epub.spec.ts`: upload `makeEpub([{title:"One",body:"Alpha chapter text"},{title:"Two",body:"Beta chapter text"},{title:"Three",body:"Gamma"}])` on a book; click "Read"; expect the text "Alpha chapter text" visible inside the epub iframe (`page.frameLocator("iframe").getByText(...)`); "Next page" advances to Beta; reload resumes at the same chapter; the Contents tab lists "One", "Two", "Three" and clicking "Three" jumps there; bookmark toggling and the bookmark list work (`Bookmarks` tab shows an entry); select text in the iframe and add a highlight (persisted after reload, listed in the Highlights tab); search "Beta" lists a hit and jumps to it; theme change applies (`iframe` body background differs).

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/e2e/reader-epub.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `epub-reader.tsx`.** Client component using `import ePub from "epubjs"` (dynamic import inside an effect, as with pdf.js):
  - `const book = ePub(data.fileUrl, { openAs: "epub" })`; `const rendition = book.renderTo(container, { width: "100%", height: "100%", flow: viewMode === "scroll" ? "scrolled-doc" : "paginated", spread: "none" })`.
  - Resume: `rendition.display(data.progress?.location || undefined)`. On `rendition.on("relocated", (loc) => …)` set the current CFI (`loc.start.cfi`) and the percent from `book.locations.percentageFromCfi(cfi)` after `await book.ready; await book.locations.generate(1600)`; save via the shared `useProgressSaver` with `location: cfi`.
  - Toolbar: reuse `ReaderToolbar` with the page controls replaced by prev/next (`rendition.prev()/next()`) and a percent readout; theme through `rendition.themes.override("color", …)`/`background`; font-size instead of zoom via `rendition.themes.fontSize(`${Math.round(zoom*100)}%`)`.
  - Contents: `book.navigation.toc` mapped to `{ title, href }`; jump with `rendition.display(href)`.
  - Bookmarks: `location = cfi`; the label defaults to the chapter title from the current `toc` match.
  - Highlights: `rendition.on("selected", (cfiRange, contents) => …)` → `book.getRange(cfiRange)` for the text → popover → `addHighlightAction({ page: null, rects: [], cfiRange, text, color })`; render saved ones with `rendition.annotations.highlight(cfiRange, {}, undefined, "hl", { fill: colour, "fill-opacity": "0.4" })`; delete with `rendition.annotations.remove(cfiRange, "highlight")`.
  - Search: for each `book.spine.spineItems`, `await item.load(book.load.bind(book))`, `item.find(query)` → `[{ cfi, excerpt }]`, then `item.unload()`. Show the excerpts as hits; picking one calls `rendition.display(cfi)`.
  - Errors: wrap `book.ready` in try/catch and show the same "couldn't open this file" alert.
  - Cleanup: `rendition.destroy()` and `book.destroy()` on unmount. Keep the keyboard handler (`ArrowLeft/Right`) via `rendition.on("keyup")` too, since key events inside the iframe do not reach `window`.
  - Because `ReaderToolbar` and `SidePanel` were written page-number-first, make the page controls conditional (`variant: "pdf" | "epub"` prop; for EPUB hide the page input and zoom buttons and show a percent instead). Extend the Task 6 toolbar props accordingly; keep the PDF behaviour unchanged and re-run the PDF specs.

- [ ] **Step 5: Dispatch in `reader-shell.tsx`:** `data.format === "epub" ? <EpubReader data={data} /> : <PdfReader data={data} />`, both via `next/dynamic` with `ssr: false`.

- [ ] **Step 6: Run to verify it passes**

Run: `npx playwright test tests/e2e/reader-epub.spec.ts` plus every reader spec, then `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: PASS. Known risk: epub.js needs `flow: "scrolled-doc"` with `allowScriptedContent: false` (default) and a sized container; if the iframe renders blank, give the container an explicit `height: calc(100vh - <toolbar>px)` and pass `manager: "default"`.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(reader): EPUB reader with the same progress, bookmarks and highlights

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Docs, final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/pipeline/` is left alone (generated history).

- [ ] **Step 1: Update the README.** Add to Features: "**Read in the app**: upload a PDF or EPUB to a book and read it in Shelfwise, with automatic resume, bookmarks, highlights with notes, in-book search, zoom, page/scroll modes and page themes." Update Scripts/Project structure (`src/components/reader/`, `src/app/api/books/`, `scripts/`), add `DATA_DIR` and `MAX_UPLOAD_MB` to Quick start / Deploying (files live on disk: back them up with the database and put `DATA_DIR` on a persistent volume; on Vercel-like hosts the filesystem is ephemeral, so both the DB and files need external storage), update the unit/e2e counts by running the suites, and mention `npm run build` copies the pdf.js worker into `public/`.

- [ ] **Step 2: Full verification.** Run, and record the actual output of each:

```bash
npm test
npx tsc --noEmit
npm run lint
npx playwright test
npm run build
```

Expected: everything passes with the original 78 unit and 37 e2e tests still included, plus the new ones. Do not claim success without seeing this output. Then run `npm run dev`, upload a real multi-hundred-page PDF from disk, and check by hand: it opens fast (Range requests in the Network tab), resume works after closing the tab, and a 100 MB+ file is rejected with the size message.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the in-app reader, storage and new config

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
