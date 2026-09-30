# Shelfwise

A calm, private personal reading list. Save books with a title and author, move them through **Want to read → Reading → Finished**, rate finished books from 1 to 5 stars, and see simple reading stats. Single user, no account, and a demo shelf of 12 books on first run.

## Features

- **Add and edit books**: title, author, status, optional pages and notes, with inline validation.
- **Library** with status tabs (All, Want to read, Reading, Finished), counts, generated cover tiles and empty states.
- **Quick status changes** from any card or the detail page. Start and finish dates are recorded automatically.
- **Ratings** (1–5 stars) for finished books only, with clear rating.
- **Stats**: totals by status, finished this year, pages read, average rating, a 12-month "Finished per month" chart and rating distribution.
- **Search and sort**: search title or author, sort by recent, title, author or rating. Both are kept in the URL.
- **Read in the app**: upload a PDF or EPUB to a book and read it in Shelfwise, with automatic resume, bookmarks, highlights with notes, in-book search, zoom, page/scroll modes and page themes. PDF is the primary format, EPUB is supported too. One file per book, up to 100 MB by default, and no OCR (scanned PDFs without a text layer cannot be searched or highlighted).
- **Delete with undo** (soft delete, restored exactly).
- **Yearly reading goal** with a progress bar.
- **Pick my next read**: a random pick from your Want to read list.
- **Settings**: light, dark or system theme, restore demo data, delete all books.
- Responsive from 375px, loading skeletons and error boundaries.

## Screenshots

Captured by the pipeline (light theme) in [`docs/pipeline/screens/`](docs/pipeline/screens/):

| Library | Stats |
| --- | --- |
| [home-desktop-light.png](docs/pipeline/screens/home-desktop-light.png) | [stats-desktop-light.png](docs/pipeline/screens/stats-desktop-light.png) |
| [Book detail](docs/pipeline/screens/books-demo-the-hobbit-desktop-light.png) | [Add book](docs/pipeline/screens/books-new-desktop-light.png) |
| [Settings](docs/pipeline/screens/settings-desktop-light.png) | [Mobile library](docs/pipeline/screens/home-mobile-light.png) |

## Quick start

Requires Node 20+ (22 recommended).

```bash
npm install                 # also runs `prisma generate` and copies the pdf.js worker
cp .env.example .env        # optional; defaults work without it
npm run db:reset            # apply migrations and seed the demo data
npm run dev                 # http://localhost:3000 (applies migrations first)
```

Optional settings in `.env` (see `.env.example`):

- `DATABASE_URL`: SQLite file, defaults to `file:./dev.db`.
- `DATA_DIR`: where uploaded book files are stored, defaults to `./data`.
- `MAX_UPLOAD_MB`: upload size cap in MB, defaults to 100.

The demo data is also seeded automatically the first time the app reads an empty, new database.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (runs `prisma migrate deploy` and copies the pdf.js worker first) |
| `npm run build` | `prisma generate`, copy the pdf.js worker into `public/`, and production build |
| `npm run start` | Production server (runs `prisma migrate deploy` first) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npx playwright test` | End-to-end tests |
| `npm run db:migrate` | Create a new migration in development |
| `npm run db:seed` | Seed the demo data |
| `npm run db:reset` | Apply migrations and seed |

## Tests

- Unit: `npm test` (141 tests across 15 files: rules, validation, stats, library, formatting, cover colors, demo data, maintenance, plus the reader's upload checks, byte-range parsing, selection handling and progress saving).
- Type check: `npx tsc --noEmit`.
- E2E: `npx playwright test` builds the app, uses a separate `e2e-<port>.db`, runs with one worker, and sets `E2E_TEST_HOOKS=1`. The last run passed 85 of 85. Run `npx playwright install chromium` first if the browser is missing.

## Project structure

```
prisma/                 schema, migrations, seed
prisma.config.ts        Prisma 7 config (datasource URL, seed)
src/app/                routes: library, books/*, books/[id]/read, stats, settings, api/books/[id]/file, api/test/reset
src/components/         books/, reader/, stats/, settings/, layout/, common/, ui/ (shadcn)
src/lib/                validation, book rules, stats, library queries, data access, db client
scripts/                copy-pdf-worker.mjs (copies the pdf.js worker into public/)
tests/e2e/              Playwright specs and PDF/EPUB fixture builders
docs/pipeline/          spec, architecture, design, reports, screenshots
```

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4 with shadcn/ui, Prisma 7 with SQLite (better-sqlite3 adapter), zod, react-hook-form, next-themes.

## Deploying

- **Node host** (VPS, Docker, Railway, Fly): `npm ci && npm run build && npm run start`. Set `DATABASE_URL` and `DATA_DIR` to paths on a persistent volume, and back up the `DATA_DIR` files together with the database. Do **not** set `E2E_TEST_HOOKS`.
- **Vercel**: serverless filesystems are ephemeral, so SQLite will not persist there. Both the database and the uploaded book files (`DATA_DIR`) would be lost, so they need external storage. Switch to Postgres first, and store files somewhere durable.
- **SQLite to Postgres**:
  1. In `prisma/schema.prisma`, change the datasource provider to `postgresql`.
  2. Replace `@prisma/adapter-better-sqlite3` with `@prisma/adapter-pg` in `src/lib/db.ts` and `prisma/seed.ts`.
  3. Set `DATABASE_URL` to your Postgres connection string.
  4. Delete `prisma/migrations` and generate a fresh baseline with `npx prisma migrate dev --name init`. Use `prisma migrate deploy` in production.
  5. Check the queries in `src/lib/data/` for case-insensitive search behaviour (SQLite and Postgres differ).
- Reader notes: EPUB search lists matches but does not highlight them on the page, and PDF search highlighting works per text span. Uploads are limited by `MAX_UPLOAD_MB`.
- There is no authentication, so put the app behind a private network or an auth proxy if it is exposed.

## Built with the app pipeline

This app was generated by an automated spec → architecture → design → build → review pipeline. The spec, architecture, design, task plan, review reports, screenshots and a run report are in [`docs/pipeline/`](docs/pipeline/), starting with [`REPORT.md`](docs/pipeline/REPORT.md).
