# In-app reader: design

Date: 2026-09-30

## Goal

Let the user open a book in Shelfwise and read it there. The app remembers where they left off and supports bookmarks, highlights with notes, in-book search, and reading view controls. PDF is the primary format. EPUB is secondary and is built after PDF.

## Assumptions

- Single user, local app, no accounts.
- Uploaded files live on disk in `DATA_DIR/books/<bookId>/`, not in SQLite. `DATA_DIR` defaults to `./data` and is git-ignored.
- At most one file per book.
- PDFs render with `pdfjs-dist` and a custom React reader styled with the existing shadcn components. EPUB uses `epub.js` behind the same reader interface.
- Upload size cap is 100 MB by default (configurable via env).

## Non-goals (v1)

OCR, multi-device sync, multiple files per book, exporting annotations.

## Data model (new Prisma migration)

- `BookFile`: `id`, `bookId` (unique, one per book), `format` (`pdf` | `epub`), `originalName`, `storagePath`, `sizeBytes`, `pageCount?`, `uploadedAt`.
- `ReadingProgress`: `bookId` (unique), `location` (PDF page number as string, or EPUB CFI), `percent` (0-100), `zoom?`, `viewMode` (`page` | `scroll`), `pageTheme` (`light` | `sepia` | `dark`), `lastReadAt`.
- `Bookmark`: `id`, `bookId`, `location`, `label?`, `createdAt`.
- `Highlight`: `id`, `bookId`, `page`, `rects` (JSON array of rectangles as fractions of page width and height, so they are zoom-independent), `text`, `color`, `note?`, `createdAt`.
- `Book.lastReadAt` (nullable) for sorting and the "Continue reading" row.
- All new models cascade on book hard delete. Soft-deleted books keep their file and reading data so undo restores everything.

## File handling

- Upload via server action or route handler. Validate the magic bytes (`%PDF-` or a ZIP with an EPUB mimetype), not just the extension, and enforce the size cap.
- `GET /api/books/[id]/file` streams the file with HTTP Range support so large PDFs open quickly. It returns 404 if there is no file or the book is deleted.
- Replacing a file deletes the old one. "Delete all books" and permanent purge remove files from disk. A missing file on disk shows a clear "file missing, re-upload" state rather than an error page.
- On upload, fill `Book.pages` from the PDF page count if empty.

## Reader (`/books/[id]/read`)

- Toolbar: page input and total, zoom in/out and fit-width, page vs continuous-scroll mode, page theme (light, sepia, dark), fullscreen, search, side panel toggle.
- Side panel tabs: Contents (PDF outline), Bookmarks, Highlights.
- Keyboard: arrows and PgUp/PgDn turn pages, `b` toggles a bookmark on the current page, `/` opens search, `Esc` closes overlays.
- Progress: saved with a ~1 s debounce on page change and on unmount or page hide. The reader opens at the saved location, zoom, and mode. A save failure shows a non-blocking toast and retries.
- Highlights: selecting text in the text layer shows a popover with colour choices and a note field. Highlights render as overlays from the stored fractional rects and are listed in the side panel, where clicking one jumps to it.
- Search: full-text search across pages using pdf.js text content, with a result count, next/previous, and match highlighting.
- Scanned PDFs (no text layer) still read and bookmark. Highlights and search show a "no selectable text in this PDF" message.
- Errors: corrupt or password-protected PDFs show a clear message with a re-upload action.

## Integration with existing app

- Book detail: "Upload file" when there is none. Otherwise "Read" or "Continue reading (p. 42 of 310, 13%)", plus replace/remove file actions.
- Book cards: progress bar and a Continue button when a file exists.
- Library: a "Continue reading" row at the top, ordered by `lastReadAt`.
- First open of a book with status `want` sets status to `reading` and `startedAt`, through the existing book rules. Reaching the last page offers "Mark as finished", which uses the existing finish rule. It is never applied silently.
- Settings page: shows storage used by files.

## Testing

- Unit (vitest): progress/percent maths, highlight rect normalisation, file validation (magic bytes, size cap), progress/bookmark/highlight data layer, status transition on first open.
- E2E (Playwright, small fixture PDF): upload, open, turn a page, reload and resume at the same page, bookmark add/remove/jump, highlight with note persists after reload, search finds and jumps, upload rejection of a non-PDF.
- Existing 78 unit and 37 e2e tests must keep passing.

## Delivery order

1. Schema, file storage, upload, and streaming route.
2. PDF reader with resume and progress saving, plus book detail integration.
3. Bookmarks, view controls, contents.
4. Search.
5. Highlights and annotations.
6. Library integration (progress bars, Continue row).
7. EPUB reader behind the same interface.
