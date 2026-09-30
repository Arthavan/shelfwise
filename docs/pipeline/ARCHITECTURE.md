# Shelfwise: architecture

A single-user, local reading list. It is a Next.js App Router app with server components reading SQLite through Prisma and server actions for every write. There is no auth. This document is the contract for the scaffolder, test author, planner and builders. Where the spec was loose, the decision is recorded in §0 and binds everyone.

---

## 0. Decisions that resolve spec ambiguities (binding)

| # | Topic | Decision |
|---|---|---|
| D1 | Rating toast vs display name (AC-13) | Toast text is **"Rated N out of 5"** (as AC-13 says). The star **display** is `role="img"` with `aria-label="Rated N out of 5"` and **no text node**. Its star icons are `aria-hidden`. So `getByText("Rated 4 out of 5")` only ever hits the toast, and `getByRole("img", { name: "Rated 4 out of 5" })` / `getByLabel(...)` only ever hits the display. Clearing a rating toasts **"Rating cleared"**. |
| D2 | Mutation failure / pending | Every mutation shows `toast.error("Couldn't save changes. Try again.")` on failure. Inline controls (status select, stars) are optimistic via `useOptimistic` and revert automatically on failure. Submit buttons are disabled while pending and read **"Saving…"**. |
| D3 | Rating control in the form | In Add/Edit, when Status = Finished a `<fieldset>` with legend **"Rating"** (role `group`, name "Rating") shows `type="button"` star buttons "Rate 1 star" … "Rate 5 stars" (`aria-pressed`), plus "Clear rating" when a value is chosen. Switching Status away from Finished discards the chosen rating. |
| D4 | Pluralization | Everywhere: "1 book", "N books" (including 0); "1 star", "N stars". Chart bar names therefore match `/^[A-Z][a-z]{2} \d{4}: \d+ books?$/`. All 12 months render a bar, including 0-count months. |
| D5 | Seed dates | Deterministic offsets relative to seeding time (§8). Exactly one finished book (The Hobbit) is in the current month. |
| D6 | Tab counts / URL | Tab counts always reflect the **whole library** and ignore search. Tabs, search and sort each preserve the other two params. Default values are omitted from the URL (`/` = all, recent, no q). |
| D7 | Status rules | One pure function `applyStatusChange` (§4.1) is used by the quick select **and** the Edit form. → Want: clear started, finished, rating. → Reading: keep existing started or set now; clear finished and rating. → Finished: finished = now; keep started (may stay empty). Same status: no-op. |
| D8 | Validation | Values are trimmed and whitespace-only counts as empty. Messages: "Title is required", "Title must be 200 characters or fewer", "Author is required", "Author must be 120 characters or fewer", "Pages must be a positive whole number", "Pages must be 100,000 or fewer", "Notes must be 2000 characters or fewer". The same zod schema runs on the client (react-hook-form) and in the server action. Forms use `noValidate` so native validation never pre-empts these messages. |
| D9 | Not found | `app/not-found.tsx` shows **"Page not found"** for unknown URLs. `app/books/[id]/not-found.tsx` shows **"Book not found"** for unknown or soft-deleted ids (also used by `/edit`). Both have a "Back to library" link to `/`. |
| D10 | Theme | next-themes, `attribute="class"`, `defaultTheme="system"`. The header **"Toggle theme"** sets the explicit theme opposite to `resolvedTheme`. Settings shows a radiogroup "Theme" (Light / Dark / System) bound to the same `theme` value. |
| D11 | Soft delete lifecycle | `deleteBook` sets `deletedAt`. Soft-deleted rows are excluded from every list, count and stat. They are hard-purged on the next `deleteBook` if deleted more than 10 minutes ago, and always purged by "Delete all books" / "Restore demo data". Delete all and Restore are hard operations without undo. **Restore demo data also clears the reading goal**. Delete all keeps it. |
| D12 | Goal | Dialog "Reading goal {year}" with input labelled **"Books this year"**, buttons "Cancel" and "Save goal", plus "Remove goal" when a goal exists. Invalid input shows "Enter a whole number from 1 to 999". The card button reads "Set goal" when there is no goal and "Edit goal" when there is one. The goal is stored with its year and ignored in other years. |
| D13 | Pick another | Picks a different candidate when possible. Disabled when there is exactly one Want to read book. Candidates are **all** Want to read books, not filtered by search. |
| D14 | Search timing | Live, 300 ms debounce, `router.replace` (no history spam), `scroll: false`. Empty query removes `q`. Sort changes apply immediately. |
| D15 | Stats structure | Each stat card is `<section aria-labelledby>`, so its role is `region` and its name is exactly the card title. Its value is in an element with `data-testid="stat-value"`. Rating distribution rows are `<li aria-label="5 stars: 3">`. |
| D16 | Start/finish dates on detail | "Added on", "Started on" and "Finished on" rows always render. An unset date shows "—". |
| D17 | Stable demo ids | Demo books use deterministic ids `demo-<title-slug>` (for example `demo-the-hobbit`), so screenshots and debugging have concrete URLs. User-created books use `cuid()`. |

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest stable, 16.x) App Router**, `src/` dir, Turbopack | Server components fetch straight from the DB; server actions remove API boilerplate. |
| Language | **TypeScript `strict: true`** | No `any`. Shared types live only in `src/lib/types.ts`. |
| Styling | **Tailwind CSS v4 + shadcn/ui** (new-york), tokens from DESIGN.md as CSS vars, `cn()` | Consistent, themeable primitives with no custom CSS framework. |
| Icons | **lucide-react** | One icon family (Star, BookOpen, Plus, Sun, Moon, Trash2, Pencil, Search, Shuffle, ArrowLeft, BarChart3, Settings). |
| DB | **SQLite** file (`file:./dev.db`) | Zero setup, private and local. Schema uses only Postgres-compatible types. |
| ORM | **Prisma ORM 7** with `@prisma/adapter-better-sqlite3`, `prisma.config.ts`, generator `prisma-client` → `src/generated/prisma` | Typed queries and migrations. Prisma 7 needs a driver adapter and a config file. |
| Mutations | **Server actions** (`"use server"` files under `src/app/**`) + one test-only route handler | Actions are validated with zod and return `ActionResult`. |
| Forms | **react-hook-form + @hookform/resolvers/zod** | Inline field errors from the same schema the server uses. |
| Validation | **zod** (v4) | One schema file shared by client and server. |
| Feedback | **sonner** via shadcn `sonner` | Toasts with the Undo action. |
| Theme | **next-themes** (class strategy) | Light, dark and system, persisted in localStorage, no flash. |
| Unit tests | **Vitest** | Pure logic in `src/lib` (rules, query, stats, format, validation, demo data). |
| E2E | **Playwright** (chromium) | Acceptance criteria. Serial runs against a dedicated `e2e.db` (§10). |
| Auth | **none** | The spec is explicitly single-user and local. |

Next.js rules:
- Do **not** enable `cacheComponents`.
- Every page that reads the DB exports `export const dynamic = "force-dynamic"`: library, detail, edit and stats. They must never be prerendered at build time.
- `params` and `searchParams` are Promises; `await` them.

---

## 2. Folder layout

```
prisma/
  schema.prisma                 # §3 (generator prisma-client → ../src/generated/prisma)
  migrations/                   # created by `prisma migrate dev --name init`
  seed.ts                       # new PrismaClient(adapter) → replaceWithDemoData(db, new Date())
prisma.config.ts                # schema path, migrations.seed = "tsx prisma/seed.ts", datasource.url
.env.example                    # DATABASE_URL="file:./dev.db"
src/
  app/
    layout.tsx                  # <html suppressHydrationWarning>, fonts, ThemeProvider, SiteHeader, <main>, <Toaster/>
    globals.css                 # DESIGN.md tokens (+ --cover-1..8), Tailwind v4 @theme inline mapping
    error.tsx                   # "Something went wrong" + "Try again" (client)
    global-error.tsx            # minimal fallback with own <html><body>
    not-found.tsx               # "Page not found" + "Back to library"
    (library)/
      page.tsx                  # Library "/" (force-dynamic)
      loading.tsx               # library skeleton (route group so it doesn't wrap other routes)
    books/
      actions.ts                # createBook, updateBook                  (F1, F6)
      status-actions.ts         # updateBookStatus, rateBook, clearRating (F3, F4, F12)
      delete-actions.ts         # deleteBook, restoreBook                 (F7)
      new/page.tsx              # Add book (static)
      [id]/page.tsx             # Book detail (force-dynamic)
      [id]/loading.tsx          # detail skeleton
      [id]/not-found.tsx        # "Book not found"
      [id]/edit/page.tsx        # Edit book (force-dynamic)
      [id]/edit/loading.tsx     # form skeleton
    stats/
      page.tsx                  # Stats (force-dynamic)
      loading.tsx               # stats skeleton
      actions.ts                # setReadingGoal, clearReadingGoal        (F11)
    settings/
      page.tsx                  # Settings (static shell, client widgets)
      actions.ts                # restoreDemoData, deleteAllBooks         (F9)
    api/test/reset/route.ts     # POST, e2e-only reset (§6.3)
  components/
    ui/                         # shadcn generated + native-select.tsx (handwritten, shadcn-styled <select>)
    layout/
      theme-provider.tsx        # "use client" wrapper around next-themes
      site-header.tsx           # brand, MainNav, "Add book" link, ThemeToggle
      main-nav.tsx              # "use client" (usePathname → aria-current)
      theme-toggle.tsx          # "use client" button "Toggle theme"
    common/
      empty-state.tsx           # icon + title + description + action slot
      confirm-dialog.tsx        # "use client" AlertDialog wrapper (title, description, confirmLabel, onConfirm)
    books/
      book-cover.tsx            # initials tile (server-safe, no hooks)
      book-card.tsx             # <article> card (server component composing client controls)
      book-grid.tsx             # <ul aria-label="Books"> of cards
      status-select.tsx         # "use client" quick status select
      rating-control.tsx        # "use client" rate/display/clear for finished books (card + detail)
      rating-input.tsx          # "use client" form fieldset "Rating"
      book-form.tsx             # "use client" add/edit form
      status-tabs.tsx           # tablist of Links
      library-toolbar.tsx       # "use client" search + sort
      clear-search-button.tsx   # "use client"
      library-empty.tsx         # the three empty states
      pick-next-read.tsx        # "use client" button + dialog (F12)
      book-details.tsx          # detail body (dl of pages/dates, notes)
      delete-book-button.tsx    # "use client" Delete → dialog → action → toast with Undo
      skeletons.tsx             # LibrarySkeleton, BookDetailSkeleton, BookFormSkeleton
    stats/
      stat-card.tsx
      monthly-chart.tsx
      rating-distribution.tsx
      goal-card.tsx             # server-rendered card, embeds GoalDialog
      goal-dialog.tsx           # "use client"
      stats-skeleton.tsx
    settings/
      theme-choice.tsx          # "use client" radiogroup "Theme"
      data-actions.tsx          # "use client" Restore demo data / Delete all books (+ ConfirmDialog)
  lib/
    utils.ts                    # cn()
    types.ts                    # ALL shared types (§4.0)
    constants.ts                # statuses, labels, sort options, toast copy, limits, cover classes
    validation.ts               # zod schemas (§4.4)
    book-rules.ts               # applyStatusChange, initialLifecycle (pure)
    library.ts                  # parseLibraryParams, filterAndSortBooks, countByStatus, buildLibraryHref (pure)
    stats.ts                    # computeStats (pure)
    format.ts                   # formatDate, formatNumber, formatAverage, pluralize, star labels, month labels (pure)
    cover.ts                    # getInitials, coverTone (pure)
    demo-data.ts                # DEMO_BOOKS + buildDemoBooks(now) (pure, relative imports only)
    db.ts                       # Prisma singleton with better-sqlite3 adapter; imports "server-only"
    data/
      books.ts                  # "server-only": listBooks, getBook, toBook
      settings.ts               # "server-only": getReadingGoal
      maintenance.ts            # ensureInitialized, replaceWithDemoData, removeAllBooks, purgeSoftDeleted
                                #   (takes a PrismaClient arg; relative imports; NO "server-only" so seed.ts can use it)
    *.test.ts                   # Vitest unit tests colocated with the pure modules
  generated/prisma/             # Prisma client output (gitignored, generated on postinstall)
tests/
  e2e/
    helpers.ts                  # resetData(request, "demo" | "empty"), todayMedium()
    smoke.spec.ts
    <feature-slug>.spec.ts
playwright.config.ts
vitest.config.ts                # include: ["src/**/*.test.ts"], alias "@" → ./src, environment node
```

Module boundaries:
- Pages (server) → `lib/data/*` for reads, `lib/*` pure helpers for shaping, `components/*` for UI.
- Client components → server actions for writes. They never import `lib/db.ts` or `lib/data/*`.
- Server actions → `lib/validation.ts`, `lib/book-rules.ts`, `lib/db.ts`, `lib/data/maintenance.ts`.
- `lib/*` pure modules import nothing from Next or Prisma, so they are unit-testable.

---

## 3. Data model

### 3.1 `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"            // url lives in prisma.config.ts (Prisma 7)
}

model Book {
  id         String    @id @default(cuid())   // demo books use "demo-<slug>"
  title      String                             // 1..200 chars, trimmed
  author     String                             // 1..120 chars, trimmed
  status     String    @default("want")         // "want" | "reading" | "finished" (validated in app; String keeps SQLite/Postgres parity)
  pages      Int?                               // 1..100000
  notes      String?                            // ≤ 2000 chars; "" stored as null
  rating     Int?                               // 1..5, non-null only when status = "finished"
  startedAt  DateTime?
  finishedAt DateTime?                          // non-null iff status = "finished"
  deletedAt  DateTime?                          // soft delete for Undo
  createdAt  DateTime  @default(now())          // "Added on"; default sort key
  updatedAt  DateTime  @updatedAt

  @@index([deletedAt, createdAt])
  @@index([status])
  @@index([finishedAt])
}

model AppSettings {
  id         String    @id @default("app")      // singleton row, always id = "app"
  goalYear   Int?                               // year the goal applies to
  goalTarget Int?                               // 1..999
  seededAt   DateTime?                          // set when demo data was first seeded
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

Relations: none. The two tables are independent. `AppSettings` existing is the "initialized" marker (§8).

Invariants, enforced in server actions through `book-rules.ts`:
- `rating != null ⇒ status = "finished"`
- `finishedAt != null ⇔ status = "finished"`
- `status = "want" ⇒ startedAt = null`
- Read queries always filter `deletedAt: null`.

### 3.2 `prisma.config.ts` (Prisma 7)

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
```

### 3.3 `src/lib/db.ts`

```ts
import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
if (process.env.NODE_ENV !== "production") g.prisma = db;
```

**Scaffolder must verify** that the Prisma CLI (`migrate`/`seed`) and the runtime adapter open the **same** file. After `npm run db:reset` there must be exactly one `dev.db`, at the repo root. If the CLI resolves relative to `prisma/`, adjust both sides to one agreed path. Gitignore `*.db`, `*.db-journal` and `src/generated/`.

---

## 4. Shared logic (`src/lib`, pure and unit-tested)

### 4.0 `types.ts` (single source of shared types)

```ts
export type BookStatus = "want" | "reading" | "finished";
export type StatusFilter = BookStatus | "all";
export type SortKey = "recent" | "title" | "author" | "rating";

export interface Book {
  id: string; title: string; author: string; status: BookStatus;
  pages: number | null; notes: string | null; rating: number | null;
  startedAt: Date | null; finishedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export type BookLifecycle = Pick<Book, "status" | "startedAt" | "finishedAt" | "rating">;
export interface BookSummary { id: string; title: string; author: string }   // Pick-next candidates

export interface LibraryParams { status: StatusFilter; q: string; sort: SortKey }
export interface StatusCounts { all: number; want: number; reading: number; finished: number }

export interface MonthBucket { key: string /* "2026-09" */; short: string /* "Sep" */; label: string /* "Sep 2026" */; count: number }
export interface RatingBucket { stars: 1 | 2 | 3 | 4 | 5; count: number }
export interface Stats {
  total: number; want: number; reading: number; finished: number;
  finishedThisYear: number; pagesRead: number; averageRating: number | null; // rounded to 1 decimal
  monthly: MonthBucket[];        // length 12, oldest → current month
  distribution: RatingBucket[];  // stars 5 → 1
}
export interface ReadingGoal { year: number; target: number }

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string>> };

export type BookFormValues = { title: string; author: string; status: BookStatus; pages: string; notes: string; rating: number | null };
```

### 4.1 `book-rules.ts`

- `initialLifecycle(status, rating, now): BookLifecycle`
  - want: all null.
  - reading: `startedAt = now`.
  - finished: `finishedAt = now`, `rating = rating ?? null`, `startedAt = null`.
- `applyStatusChange(current: BookLifecycle, next: BookStatus, now: Date): BookLifecycle` follows D7:
  - same status → unchanged.
  - want → `{ startedAt: null, finishedAt: null, rating: null }`.
  - reading → `{ startedAt: current.startedAt ?? now, finishedAt: null, rating: null }`.
  - finished → `{ startedAt: current.startedAt, finishedAt: now, rating: null }`.
- `applyFormToLifecycle(current, values, now)` covers edit: `applyStatusChange` first, then `rating = values.status === "finished" ? values.rating : null`.

### 4.2 `library.ts`

- `parseLibraryParams(raw: Record<string, string | string[] | undefined>): LibraryParams`. Invalid or missing values fall back to `all`, `recent` and `""`. `q` is trimmed and capped at 200 chars.
- `countByStatus(books): StatusCounts` covers the full library (D6).
- `filterAndSortBooks(books, params): Book[]` does the filtering and sorting:
  - Status filter.
  - `q`: `toLocaleLowerCase("en-US")` substring match on title **or** author.
  - Sort:
    - `recent`: createdAt desc.
    - `title`: `localeCompare(…, "en", { sensitivity: "base" })` asc, tie → author.
    - `author`: author asc, tie → title.
    - `rating`: rated desc first, then unrated, tie → title asc.
  - Done in JS (not SQL) so case-insensitivity behaves identically on SQLite and Postgres. There is no pagination (spec).
- `buildLibraryHref(current: LibraryParams, patch: Partial<LibraryParams>): string` builds `/` + `URLSearchParams` in the order `status, q, sort`, omitting defaults. It returns `"/"` when everything is default.

### 4.3 `stats.ts`

`computeStats(books: Book[], now: Date): Stats` works in **server local time**:
- Counts come from `status`.
- `finishedThisYear` = finished books whose `finishedAt` year equals `now` year.
- `pagesRead` = Σ pages of finished books (null counts as 0).
- `averageRating` = mean of non-null ratings of finished books, `Math.round(x * 10) / 10`, or null.
- `monthly` = 12 buckets from `new Date(y, m - 11, 1)` to the current month:
  - `short` from `Intl.DateTimeFormat("en-US", { month: "short" })`.
  - `label` = `${short} ${year}`.
- `distribution` = stars 5 → 1.

### 4.4 `validation.ts` (zod; client and server)

- `bookFormSchema`, per D8:
  - `title` and `author` are trimmed strings.
  - `status` is `z.enum(["want","reading","finished"])`.
  - `pages` is a string: `""` is allowed, otherwise `/^\d+$/` and ≥ 1 ("Pages must be a positive whole number") and ≤ 100000.
  - `notes` is a string ≤ 2000.
  - `rating` is `z.number().int().min(1).max(5).nullable()`.
- `toBookData(values)` converts the form to DB fields: pages to number or null, empty notes to null.
- `idSchema = z.string().trim().min(1).max(64)`.
- `statusChangeSchema = { id, status }`, `rateSchema = { id, rating: int 1..5 }`.
- `goalSchema = { target: string | number }`. It parses to an int from 1 to 999, and every failure message is "Enter a whole number from 1 to 999".
- `resetSchema = { mode: z.enum(["demo","empty"]).default("demo") }`.

### 4.5 `format.ts`

| Function | Output |
|---|---|
| `formatDate(d \| null)` | `Intl.DateTimeFormat("en-US", { dateStyle: "medium" })` → "Sep 30, 2026", or "—" |
| `formatNumber(n)` | "2,210" |
| `formatAverage(n \| null)` | "4.3" / "—" (`toFixed(1)`) |
| `pluralize(n, "book")` | "1 book" / "0 books" |
| `starsLabel(n)` | "1 star" / "5 stars" |
| `rateButtonLabel(n)` | "Rate 1 star" / "Rate 2 stars" |
| `ratedLabel(n)` | "Rated 4 out of 5" |
| `monthBarLabel(b)` | "Sep 2026: 1 book" |

Dates are always formatted **on the server** (server components), so the server's local time zone applies.

### 4.6 `cover.ts` and `constants.ts`

`cover.ts`:
- `getInitials(title)`: first letter of the first two words that start with a letter or digit, uppercased. "The Hobbit" → "TH", "Piranesi" → "P".
- `coverTone(title)`: djb2 hash mod 8 → 1..8.

`constants.ts`:
- `STATUSES = ["want","reading","finished"]`.
- `STATUS_LABELS = { want: "Want to read", reading: "Reading", finished: "Finished" }`.
- `STATUS_TOASTS = { want: "Moved to Want to read", reading: "Moved to Reading", finished: "Marked as finished" }`.
- `SORT_OPTIONS = [{ value: "recent", label: "Recently added" }, { value: "title", label: "Title (A–Z)" }, { value: "author", label: "Author (A–Z)" }, { value: "rating", label: "Highest rated" }]`. The labels use an en dash.
- `TOAST` copy (§6.4).
- `ERROR_TOAST = "Couldn't save changes. Try again."`.
- `COVER_CLASSES`: 8 **literal** class strings `bg-cover-1 text-cover-foreground` … so Tailwind can scan them. DESIGN.md defines `--cover-1..8` and `--cover-foreground` for light and dark.

---

## 5. Routes and screens

All pages render inside the root layout: a sticky `SiteHeader` then `<main>`. Each page title uses the template `"%s · Shelfwise"`, default `"Shelfwise"`.

| Path | File | Render | Purpose |
|---|---|---|---|
| `/` (`?status=want\|reading\|finished&q=&sort=recent\|title\|author\|rating`) | `(library)/page.tsx` | dynamic | Library |
| `/books/new` | `books/new/page.tsx` | static | Add book |
| `/books/[id]` | `books/[id]/page.tsx` | dynamic | Book detail |
| `/books/[id]/edit` | `books/[id]/edit/page.tsx` | dynamic | Edit book |
| `/stats` | `stats/page.tsx` | dynamic | Stats + goal |
| `/settings` | `settings/page.tsx` | static | Theme and data management |
| any unknown path | `not-found.tsx` | — | "Page not found" |
| `POST /api/test/reset` | `api/test/reset/route.ts` | dynamic | e2e reset (§6.3) |

### 5.1 Library `/`

The server component does this:
1. `params = parseLibraryParams(await searchParams)`
2. `books = await listBooks()`
3. `counts = countByStatus(books)`
4. `visible = filterAndSortBooks(books, params)`
5. `candidates = books.filter(want).map(summary)`

It renders, top to bottom:
1. `h1` "Library".
2. `StatusTabs`.
3. `LibraryToolbar` (search + sort).
4. `PickNextRead` (only when `params.status === "want"` and `counts.want > 0`).
5. Content. Precedence: (a) `counts.all === 0` → the "Your shelf is empty" state; (b) `q` set and `visible` empty → the `No books match "{q}"` state; (c) `visible` empty → the "No books in {Status label}" state; else (d) `BookGrid`.

Card (`BookCard`, `<article aria-labelledby="book-{id}-title">`) contains:
- A `BookCover` (aria-hidden).
- An `h2` holding a `Link` to `/books/{id}` with the title. This is the only link in the card.
- The author.
- A `StatusSelect`.
- A `RatingControl` only when `status === "finished"`.

`loading.tsx`: skeleton tabs, toolbar and 6 card skeletons.

### 5.2 Add book `/books/new` and Edit `/books/[id]/edit`

- Heading: `h1` "Add book" / "Edit book".
- Form: `BookForm` with `mode="create"`, or `mode="edit"` and `book`.
- Fields, in order: Title (input), Author (input), Status (native select, default `want`), Pages (`type="text" inputMode="numeric"`), Notes (textarea), then `RatingInput` only when the watched status is `finished`.
- Buttons: submit "Save book" / "Save changes" ("Saving…" while pending); a "Cancel" link back to `/` or to the detail page.
- On success:
  - create: `toast.success("Book added")` then `router.push("/")`.
  - edit: `toast.success("Changes saved")` then `router.push("/books/{id}")`.
- On `fieldErrors`: `form.setError` per field. On any other error: the error toast.
- The edit page loads the book with `getBook(id)` and calls `notFound()` when it returns null.

### 5.3 Book detail `/books/[id]`

- `getBook(id)`; if null, call `notFound()`, which renders `[id]/not-found.tsx`.
- `generateMetadata` gives the title.
- Content:
  - A "Back to library" link.
  - A large `BookCover`.
  - `h1` = title, then the author.
  - `StatusSelect` and `RatingControl` (finished only).
  - `BookDetails`: a `<dl>` of rows "Pages", "Added on", "Started on", "Finished on". Each row is `<div><dt>Label</dt> <dd>Value</dd></div>`, with a literal space between dt and dd so the row text reads "Finished on Sep 30, 2026".
  - A "Notes" section (pre-wrapped text, or "No notes yet").
  - Actions: an "Edit" link and a "Delete" button (`DeleteBookButton`).
- `loading.tsx`: detail skeleton.

### 5.4 Stats `/stats`

- `books = await listBooks()`, `stats = computeStats(books, now)`, `goal = await getReadingGoal(now)`.
- `h1` "Stats".
- If `stats.total === 0`: an `EmptyState` with heading "No stats yet" and a link "Add a book" → `/books/new`.
- Otherwise, in order:
  1. A grid of 7 `StatCard`s. Titles and values:
     - "Total books", "Want to read", "Reading", "Finished", "Finished this year" → `formatNumber`
     - "Pages read" → `formatNumber`
     - "Average rating" → `formatAverage`
  2. `GoalCard`: region "Reading goal {year}".
  3. `MonthlyChart`: region "Finished per month". An `<ol>` of 12 `<li>`. Each has a bar `<div role="img" aria-label="Sep 2026: 1 book">`, with height relative to the max count and a minimum visible stub for 0. Below the bar sits the aria-hidden month short label. Bars flex to fit 343 px with no overflow.
  4. `RatingDistribution`: region "Rating distribution". A `<ul>` of 5 `<li aria-label="{starsLabel}: {count}">`, each with the visible label, a proportional bar and the count.
- `loading.tsx`: stats skeleton.

### 5.5 Settings `/settings`

- `h1` "Settings".
- **Appearance** section: `ThemeChoice`, a shadcn RadioGroup "Theme" with "Light", "Dark" and "System". It renders disabled until mounted to avoid a hydration mismatch.
- **Your data** section: `DataActions`.
  - "Restore demo data" opens a confirm dialog titled "Restore demo data?". The description says it replaces all books with the 12 demo books and clears the reading goal. Buttons: "Cancel" and "Restore". Confirming calls `restoreDemoData()` and toasts "Demo data restored".
  - "Delete all books" opens a confirm dialog titled "Delete all books?" (destructive). Buttons: "Cancel" and "Delete all". Confirming calls `deleteAllBooks()` and toasts "All books deleted".

### 5.6 System states

- `error.tsx` (client): heading "Something went wrong", a short line, and a button "Try again". The button runs `startTransition(() => { router.refresh(); reset(); })`.
- `global-error.tsx`: the same copy inside its own `<html><body>`.
- Not-found pages as in D9.
- Header at 375 px: brand (icon plus wordmark; the wordmark may hide below `sm`), nav links "Library", "Stats" and "Settings" always visible as text (**no hamburger**), "Add book" (icon-only below `sm` with `aria-label="Add book"`), and "Toggle theme". Nothing may cause horizontal scroll at 375 px.

---

## 6. Server actions and route handlers

All action files start with `"use server"` and export only async functions. Every action does four things:
1. Validates input with the zod schema from `lib/validation.ts`.
2. Wraps DB work in try/catch. On an unexpected error it returns `{ ok: false, error: ERROR_TOAST }`.
3. Returns `ActionResult`.
4. On success calls `revalidatePath("/", "layout")`. **Exception:** `deleteBook` does **not** revalidate. Otherwise the current detail route would re-render into "Book not found" before the client navigates away. The client `router.push("/")` fetches fresh data because the pages are dynamic.

"Not found" means the book doesn't exist or `deletedAt != null`, and returns `{ ok: false, error: "Book not found" }`.

### 6.1 Books

| Action (file) | Input | Output | Behaviour |
|---|---|---|---|
| `createBook` (`books/actions.ts`) | `BookFormValues` | `ActionResult<{ id: string }>` | Validates. Creates with `toBookData` + `initialLifecycle(status, rating, now)`. Validation failure → `{ ok:false, error:"Please fix the highlighted fields", fieldErrors }`. |
| `updateBook` (`books/actions.ts`) | `(id: string, values: BookFormValues)` | `ActionResult<{ id: string }>` | Validates. Loads the current row, applies `applyFormToLifecycle`, then updates title, author, pages and notes. |
| `updateBookStatus` (`books/status-actions.ts`) | `{ id: string; status: BookStatus }` | `ActionResult<{ id: string; status: BookStatus }>` | `applyStatusChange(current, status, now)`. The client toasts `STATUS_TOASTS[status]`. |
| `rateBook` (`books/status-actions.ts`) | `{ id: string; rating: 1..5 }` | `ActionResult<{ id: string; rating: number }>` | Book must be finished, else `{ ok:false, error:"Only finished books can be rated" }`. The client toasts `ratedLabel(rating)`. |
| `clearRating` (`books/status-actions.ts`) | `{ id: string }` | `ActionResult<{ id: string }>` | Sets rating to null. The client toasts "Rating cleared". |
| `deleteBook` (`books/delete-actions.ts`) | `{ id: string }` | `ActionResult<{ id: string; title: string }>` | `purgeSoftDeleted(db, now - 10min)`, then sets `deletedAt = now`. No revalidate (see above). |
| `restoreBook` (`books/delete-actions.ts`) | `{ id: string }` | `ActionResult<{ id: string }>` | Requires a soft-deleted row; sets `deletedAt = null`. Every other field was untouched, so the restore is exact. |

### 6.2 Stats and settings

| Action | Input | Output | Behaviour |
|---|---|---|---|
| `setReadingGoal` (`stats/actions.ts`) | `{ target: string \| number }` | `ActionResult<ReadingGoal>` | Upserts `AppSettings{id:"app"}` with `goalYear = now.getFullYear()` and `goalTarget`. Invalid input → `{ ok:false, error, fieldErrors:{ target:"Enter a whole number from 1 to 999" } }`. |
| `clearReadingGoal` (`stats/actions.ts`) | none | `ActionResult` | Sets the goal fields to null. |
| `restoreDemoData` (`settings/actions.ts`) | none | `ActionResult<{ count: 12 }>` | `replaceWithDemoData(db, new Date())` (§8). |
| `deleteAllBooks` (`settings/actions.ts`) | none | `ActionResult<{ count: number }>` | `removeAllBooks(db)`: hard-deletes every book row, including soft-deleted ones. Keeps AppSettings. |

Read helpers (server-only, used by pages, not actions):
- `listBooks(): Promise<Book[]>`: `ensureInitialized` first, then all rows with `deletedAt: null`, ordered by createdAt desc, mapped with `toBook`. `toBook` narrows `status` via a type guard, falling back to `"want"`.
- `getBook(id): Promise<Book | null>`: `ensureInitialized` first; excludes soft-deleted rows.
- `getReadingGoal(now): Promise<ReadingGoal | null>`: returns the goal only when `goalYear === now.getFullYear()`.

### 6.3 Route handler: `POST /api/test/reset`

- **Enabled only when** `process.env.E2E_TEST_HOOKS === "1"` or `NODE_ENV !== "production"`. Otherwise it responds 404.
- Body: `{ "mode": "demo" | "empty" }` (default `"demo"`), validated with `resetSchema`. Invalid body → 400.
- `demo` calls `replaceWithDemoData(db, new Date())`, which also clears the goal.
- `empty` calls `removeAllBooks(db)`, clears the goal, and keeps the AppSettings row so nothing re-seeds.
- Responds `200 { ok: true, mode, count }`.
- Exists so every feature's e2e tests can reach a known state without depending on the Settings UI. It duplicates behaviour already reachable, unauthenticated, from Settings.

### 6.4 Client-side mutation patterns and toast copy

- `StatusSelect` (`{ bookId, title, status }`):
  - Native `<select aria-label="Status for {title}">` with options `want` / `reading` / `finished`, labelled via `STATUS_LABELS`.
  - Uses `useOptimistic(status)` + `useTransition`. `onChange` → `setOptimistic(next)` → `await updateBookStatus` → success or error toast.
  - Disabled while pending.
- `RatingControl` (`{ bookId, rating, size: "sm" | "md" }`), rendered only for finished books:
  - **Unrated:** `<div role="group" aria-labelledby>` with the visible label "Rate this book", five `<button type="button" aria-label="Rate N star(s)">` with star icons, and the muted text "Not rated".
  - **Rated:** `<div role="img" aria-label="Rated N out of 5">` holding N filled and 5−N empty aria-hidden stars, plus a button "Clear rating" (icon-only on cards with `aria-label="Clear rating"`, text on detail).
  - Optimistic via `useOptimistic`.
- `DeleteBookButton` (`{ bookId, title }`):
  - "Delete" opens a `ConfirmDialog` titled `Delete "{title}"?` with "Cancel" / "Delete".
  - On confirm: `await deleteBook`. If ok: `router.push("/")` then `toast("Book deleted", { duration: 6000, action: { label: "Undo", onClick } })`.
  - `onClick` → `await restoreBook({ id })` → `toast.success("Book restored")` + `router.refresh()`, or the error toast.
- `PickNextRead` (`{ candidates: BookSummary[] }`):
  - Button "Pick my next read" opens a Dialog titled "Your next read".
  - The body shows the picked book: an `h3` with the title, the author and a cover.
  - Buttons: "Pick another" (disabled when `candidates.length === 1`) and "Start reading". "Start reading" calls `updateBookStatus({ id, status: "reading" })`, toasts "Moved to Reading" and closes the dialog.
- `LibraryToolbar` (`{ params: LibraryParams }`):
  - `<input type="search" aria-label="Search books" placeholder="Search title or author">` (D14). Local state resyncs from `params.q` only when the URL changed from elsewhere (track the last value this input pushed in a ref), so typing is never clobbered.
  - Native `<select>` labelled "Sort by" with `SORT_OPTIONS`.
- `ClearSearchButton`: `router.replace(buildLibraryHref(params, { q: "" }))`.
- `GoalDialog`: the input "Books this year", "Save goal", "Remove goal", "Cancel". It shows `fieldErrors.target` inline. On success: toast "Goal saved" / "Goal removed", then close.

**Toast copy (exact):**
- Books: "Book added", "Changes saved", "Moved to Want to read", "Moved to Reading", "Marked as finished", "Rated N out of 5", "Rating cleared", "Book deleted" (action "Undo"), "Book restored".
- Settings and stats: "Demo data restored", "All books deleted", "Goal saved", "Goal removed".
- Any failure: "Couldn't save changes. Try again."

---

## 7. UI contract: accessible names (tests and builders both rely on this)

Use `{ exact: true }` for short names that are substrings of others: "Library" vs "Back to library", "Reading" vs "Reading goal …", "Finished" vs "Finished this year", "Delete" vs "Delete all books", "Status".

| Where | Element | Role and accessible name |
|---|---|---|
| Header | nav | `navigation` "Main" → links "Library" (/), "Stats", "Settings" with `aria-current="page"` when active |
| Header | add | **link** "Add book" → `/books/new` |
| Header | theme | button "Toggle theme" |
| Library | heading | h1 "Library" |
| Library | tabs | `tablist` "Filter by status" → `tab` elements (Next `Link` with `role="tab"`, `aria-selected`) named exactly "All · N", "Want to read · N", "Reading · N", "Finished · N" (U+00B7, single spaces) |
| Library | search | `searchbox` "Search books" (placeholder "Search title or author") |
| Library | sort | `combobox` "Sort by" (native select). Options: "Recently added", "Title (A–Z)", "Author (A–Z)", "Highest rated" |
| Library | list | `list` "Books" → one `article` per book, named by its title |
| Card | title | link with the title text → `/books/{id}` (only link in the card) |
| Card and detail | status | `combobox` "Status for {title}" (**native `<select>`**, values `want`/`reading`/`finished`, option labels "Want to read"/"Reading"/"Finished"). Assert with `toHaveValue("reading")`. `selectOption("Reading")` works by label. |
| Card and detail | rating (finished, unrated) | `group` "Rate this book" → buttons "Rate 1 star", "Rate 2 stars" … "Rate 5 stars"; text "Not rated" |
| Card and detail | rating (finished, rated) | `img` "Rated N out of 5" (no text node) + button "Clear rating" |
| Library empty | shelf | heading "Your shelf is empty" + link "Add your first book" |
| Library empty | tab | text "No books in {Want to read\|Reading\|Finished}" |
| Library empty | search | text `No books match "{q}"` (straight quotes) + button "Clear search" |
| Library | pick | button "Pick my next read" → `dialog` "Your next read" containing `h3` = book title, buttons "Pick another", "Start reading" |
| Form | fields | textbox "Title", textbox "Author", combobox "Status" (native select, default value `want`), textbox "Pages", textbox "Notes" |
| Form | rating | `group` "Rating" (fieldset/legend) → buttons "Rate 1 star" … "Rate 5 stars" (`aria-pressed`), "Clear rating" when set |
| Form | submit | button "Save book" (new) / "Save changes" (edit); "Saving…" while pending; link "Cancel" |
| Form | errors | text under each field, linked with `aria-describedby`; the field gets `aria-invalid="true"` |
| Detail | heading | h1 = title; link "Back to library"; link "Edit"; button "Delete" |
| Detail | dates | rows reading "Added on {date}", "Started on {date \| —}", "Finished on {date \| —}"; also "Pages" |
| Delete | dialog | `alertdialog` `Delete "{title}"?` → buttons "Cancel", "Delete" |
| Toast | undo | button "Undo" inside the "Book deleted" toast |
| Stats | cards | `region` named "Total books", "Want to read", "Reading", "Finished", "Finished this year", "Pages read", "Average rating"; value in `getByTestId("stat-value")` inside |
| Stats | chart | `region` "Finished per month" → exactly 12 `img` bars, oldest → newest, named "{Mon YYYY}: N book(s)" |
| Stats | distribution | `region` "Rating distribution" → 5 `listitem`s named "5 stars: 3", "4 stars: 3", "3 stars: 1", "2 stars: 0", "1 star: 0" (visible label + count too) |
| Stats | goal | `region` "Reading goal {year}". No goal: text "No goal set yet" + button "Set goal". With goal: text "{n} of {goal} book(s)" + `progressbar` "Reading goal progress" (`aria-valuemin=0`, `aria-valuenow`=finished this year, `aria-valuemax`=goal; hand-rolled, not Radix) + button "Edit goal" |
| Stats | goal dialog | `dialog` "Reading goal {year}" → textbox "Books this year", buttons "Save goal", "Cancel", ("Remove goal"); error "Enter a whole number from 1 to 999" |
| Stats empty | — | heading "No stats yet" + link "Add a book" |
| Settings | theme | `radiogroup` "Theme" → `radio` "Light", "Dark", "System" |
| Settings | data | buttons "Restore demo data", "Delete all books" → `alertdialog` "Restore demo data?" ("Cancel", "Restore") / "Delete all books?" ("Cancel", "Delete all") |
| Errors | boundary | heading "Something went wrong" + button "Try again" |
| Not found | pages | heading "Page not found" or "Book not found" + link "Back to library" |

Confirmation dialogs use shadcn **AlertDialog** (role `alertdialog`). Radix hides the rest of the page from the accessibility tree while it is open. "Your next read" and the goal editor use **Dialog** (role `dialog`).

---

## 8. Seed data plan

`src/lib/demo-data.ts` exports `DEMO_BOOKS` (the 12 rows of the spec table) and `buildDemoBooks(now: Date)`. The latter returns create-ready rows with fixed ids and computed dates. `M(k)` = `new Date(now.getFullYear(), now.getMonth() - k, 15, 12, 0, 0)` in local time. `d(n)` = `now − n days`.

| id | Title | Author | Status | Pages | Rating | createdAt | startedAt | finishedAt | notes |
|---|---|---|---|---|---|---|---|---|---|
| demo-piranesi | Piranesi | Susanna Clarke | want | 272 | – | d(1) | – | – | "Recommended by Maya. Save it for a slow weekend." |
| demo-the-overstory | The Overstory | Richard Powers | want | 502 | – | d(2) | – | – | – |
| demo-braiding-sweetgrass | Braiding Sweetgrass | Robin Wall Kimmerer | want | 391 | – | d(3) | – | – | "One essay at a time." |
| demo-project-hail-mary | Project Hail Mary | Andy Weir | reading | 476 | – | d(9) | d(5) | – | – |
| demo-middlemarch | Middlemarch | George Eliot | reading | 880 | – | d(30) | d(21) | – | "Book Three of Eight. Slow and worth it." |
| demo-the-hobbit | The Hobbit | J.R.R. Tolkien | finished | 310 | 5 | F−21d | F−14d | F = now | "Reread before winter. Still perfect." |
| demo-dune | Dune | Frank Herbert | finished | 412 | 4 | F−21d | F−14d | M(1) | – |
| demo-circe | Circe | Madeline Miller | finished | 393 | 4 | F−21d | F−14d | M(2) | "The island chapters are the best part." |
| demo-the-remains-of-the-day | The Remains of the Day | Kazuo Ishiguro | finished | 245 | 5 | F−21d | F−14d | M(4) | – |
| demo-educated | Educated | Tara Westover | finished | 334 | 3 | F−21d | F−14d | M(6) | "Hard to read in places." |
| demo-station-eleven | Station Eleven | Emily St. John Mandel | finished | 333 | 4 | F−21d | F−14d | M(8) | – |
| demo-a-wizard-of-earthsea | A Wizard of Earthsea | Ursula K. Le Guin | finished | 183 | 5 | F−21d | F−14d | M(10) | – |

The resulting stats:
- Total 12; Want 3; Reading 2; Finished 7.
- Pages read 2,210 (310+412+393+245+334+333+183).
- Average rating 30/7 → **4.3**.
- Distribution 5★ 3, 4★ 3, 3★ 1, 2★ 0, 1★ 0.
- Chart bars at month offsets 0, 1, 2, 4, 6, 8 and 10, all inside the 12-month window.
- "Finished this year" varies with the calendar month (6 in September). Tests read it rather than hard-code it.
- The default "Recently added" order starts with Piranesi, The Overstory, Braiding Sweetgrass.
- "Title (A–Z)" goes from "A Wizard of Earthsea" to "The Remains of the Day".

`src/lib/data/maintenance.ts` (takes `db: PrismaClient`, relative imports, no `server-only`):
- `replaceWithDemoData(db, now)`: a single `$transaction` that runs `book.deleteMany({})`, then `book.createMany(buildDemoBooks(now))`, then upserts `AppSettings{ id:"app", seededAt: now, goalYear: null, goalTarget: null }`.
- `removeAllBooks(db)`: `book.deleteMany({})`.
- `purgeSoftDeleted(db, before)`: `book.deleteMany({ where: { deletedAt: { lt: before } } })`.
- `ensureInitialized(db)`. **First-run seeding, independent of the Prisma CLI** (Prisma 7 no longer seeds on `migrate reset`/`migrate dev`):
  - If `AppSettings{id:"app"}` exists, return.
  - Otherwise run `replaceWithDemoData(db, new Date())` inside try/catch and ignore `P2002`, which covers concurrent first requests.
  - Memoize success in a module-level flag.
  - Because the marker is the settings row, not the book count, "Delete all books" never triggers a re-seed.
- `prisma/seed.ts` calls `replaceWithDemoData` with its own adapter-backed client. It is idempotent and wired as `migrations.seed` in `prisma.config.ts`.

---

## 9. Environment variables and scripts

| Name | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | no (defaults to `file:./dev.db` in both `prisma.config.ts` and `db.ts`) | `file:./dev.db` | SQLite file. Playwright uses `file:./e2e.db`. |
| `E2E_TEST_HOOKS` | no | `1` | Enables `POST /api/test/reset` in production builds (always on in dev). Set only by the Playwright webServer. |

Commit `.env.example` containing `DATABASE_URL="file:./dev.db"`. `.env` is optional.

`package.json` scripts (scaffolder):
- `"postinstall": "prisma generate"`
- `"predev": "prisma migrate deploy"`, `"dev": "next dev"`
- `"build": "prisma generate && next build"`
- `"prestart": "prisma migrate deploy"`, `"start": "next start"`
- `"db:migrate": "prisma migrate dev"`, `"db:seed": "prisma db seed"`
- `"db:reset": "prisma migrate reset --force && prisma db seed"` (seed is idempotent, so a double run is harmless)
- `"lint": "eslint ."`, `"test": "vitest run"`

`migrate deploy` creates the DB file and tables if they are missing. The app then seeds itself on the first request, so `npm install && npm run dev` always opens on a populated shelf.

Deployment note (release manager): the app is local-first. Serverless hosts such as Vercel have no persistent writable disk for SQLite. A hosted deploy needs `provider = "postgresql"`, `@prisma/adapter-pg` and a Postgres `DATABASE_URL`; the schema is already compatible. This is out of scope for the spec.

---

## 10. Testing strategy

**Unit (Vitest, `src/lib/*.test.ts`, node environment):**
- `book-rules.test.ts`: every transition in D7, including keep-started and clear-rating.
- `library.test.ts`: filter, all 4 sorts (AC-30 order on demo data), counts, `buildLibraryHref`.
- `stats.test.ts`: demo numbers; 12 buckets; the current month last; "1 book" pluralization.
- `validation.test.ts`: every message in D8 and the goal range.
- `format.test.ts`: `formatDate` "Sep 30, 2026", `formatAverage`.
- `demo-data.test.ts`: 12 books, 3/2/7, 2,210, 4.3, and the distribution.

**E2E (Playwright):**
- The shared SQLite DB and global-state ACs ("freshly restored", "all books deleted") make parallel runs unsafe. So `fullyParallel: false` and `workers: 1`. This overrides the skill's parallel default for this app.
- Each test establishes its own state first with `resetData(request, "demo" | "empty")` from `tests/e2e/helpers.ts` (`request.post("/api/test/reset", { data: { mode } })` + expect ok). Tests stay independent and order-free.
- `webServer`:
  - `command: "npm run db:reset && npm run build && npm run start"`
  - `env: { DATABASE_URL: "file:./e2e.db", E2E_TEST_HOOKS: "1", PORT: "3000" }`
  - `url: "http://localhost:3000"`, `reuseExistingServer: !process.env.CI`, `timeout: 240_000`
- Other config: `use: { baseURL: "http://localhost:3000", locale: "en-US" }`, chromium only, `retries: 1`.
- AC-34 uses `test.use({ viewport: { width: 375, height: 812 } })`.
- "Today" in tests is `new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())`, and the current month label is `"{short} {yyyy}"` built the same way. The test runner and the server share a host, so their time zones match.
- Several finished demo books share a rating (three are rated 4), so scope rating assertions to `page.getByRole("article", { name: "<title>" })` or to the detail page.

---

## 11. Acceptance criteria → implementation

| AC | Route(s) | Implementation |
|---|---|---|
| AC-1 | `/` → `/books/new` | Header link "Add book"; `BookForm` fields Title, Author, Status (default `want`), Pages, Notes |
| AC-2 | `/books/new` | `bookFormSchema` via zodResolver; inline "Title is required" / "Author is required"; no action call, no navigation |
| AC-3 | `/books/new` → `/` | `createBook` → toast "Book added" → `router.push("/")`; newest `createdAt` puts the book in the first article; its status select value is `reading` |
| AC-4 | `/books/new` | Pages refine → "Pages must be a positive whole number" |
| AC-5 | `/books/new` | `RatingInput` fieldset "Rating" is rendered only while the watched status is `finished` |
| AC-6 | `/` | `listBooks` + `countByStatus`; `StatusTabs` names "All · 12" …; 12 articles |
| AC-7 | `/?status=finished` | Tab link built with `buildLibraryHref`; `filterAndSortBooks` status filter |
| AC-8 | `/` → `/books/new` | Empty-shelf state (precedence a) with link "Add your first book" |
| AC-9 | `/?status=reading` | Empty-tab state "No books in Reading" |
| AC-10 | `/` | `StatusSelect` → `updateBookStatus` → toast "Moved to Reading"; revalidation refreshes tabs (Want 2, Reading 3) |
| AC-11 | `/` | `applyStatusChange` → finished and unrated; the card renders `RatingControl` unrated state "Rate this book" + "Rate 5 stars"; toast "Marked as finished" |
| AC-12 | `/books/[id]` | `finishedAt = now`; `BookDetails` row "Finished on {formatDate}" |
| AC-13 | `/` or `/books/[id]` | `rateBook` → toast "Rated 4 out of 5"; `img` "Rated 4 out of 5" persists after reload (D1) |
| AC-14 | `/`, `/books/demo-piranesi` | `RatingControl` rendered only when status is finished |
| AC-15 | `/books/demo-the-hobbit` | `clearRating` → "Not rated" (toast "Rating cleared") |
| AC-16 | `/books/demo-dune` | → Reading clears rating and finishedAt; → Finished stays unrated → "Not rated" |
| AC-17 | `/stats` | `computeStats` + `StatCard` regions; `formatNumber` "2,210"; `formatAverage` "4.3" |
| AC-18 | `/stats` | `RatingDistribution` listitems "5 stars: 3" … "1 star: 0" |
| AC-19 | `/` → `/stats` | Finishing sets `finishedAt = now`, counted in Finished and Finished this year; the stats page is dynamic |
| AC-20 | `/stats` | `MonthlyChart` 12 `img` bars, current month last, named "{Mon YYYY}: N book(s)" |
| AC-21 | `/stats` → `/books/new` | Empty state "No stats yet" + link "Add a book" |
| AC-22 | `/` → `/books/[id]` | Card title link; detail h1 is the title; author, status select ("Finished"), "Added on" row |
| AC-23 | `/books/[id]/edit` → `/books/[id]` | `updateBook` → toast "Changes saved" → push to detail; h1 updated |
| AC-24 | `/books/does-not-exist` → `/` | `getBook` null → `notFound()` → `books/[id]/not-found.tsx` "Book not found" + "Back to library" |
| AC-25 | `/books/demo-educated` | `DeleteBookButton` AlertDialog `Delete "Educated"?`; Cancel closes it |
| AC-26 | `/books/demo-educated` → `/` | `deleteBook` (soft) → push "/" → toast "Book deleted" with "Undo"; the list excludes soft-deleted rows |
| AC-27 | `/` | Undo → `restoreBook` → revalidate + refresh; the card shows select `finished` and `img` "Rated 3 out of 5" |
| AC-28 | `/?q=tolkien` | `LibraryToolbar` debounced `router.replace`; substring filter → The Hobbit only |
| AC-29 | `/?q=zzzz` → `/` | No-match state `No books match "zzzz"` + `ClearSearchButton` removes `q` |
| AC-30 | `/?sort=title` | Sort select → `sort=title`; `localeCompare` base order |
| AC-31 | `/settings` → `/` | `DataActions` → AlertDialog "Delete all books?" → `deleteAllBooks` → toast; the AppSettings marker prevents re-seeding |
| AC-32 | `/settings` → `/` | `DataActions` → AlertDialog "Restore demo data?" → `restoreDemoData` → toast "Demo data restored"; 12 cards |
| AC-33 | any | `ThemeToggle` → `setTheme(resolvedTheme === "dark" ? "light" : "dark")`; next-themes class + localStorage persist across reload |
| AC-34 | `/`, `/stats` at 375 px | Header keeps text links visible; responsive grid and chart with no overflow |
| AC-35 | `/stats` | `GoalCard` + `GoalDialog` → `setReadingGoal` → "{finishedThisYear} of 24 books", progressbar `aria-valuemax=24` |
| AC-36 | `/?status=want` | `PickNextRead` dialog "Your next read" → "Start reading" → `updateBookStatus(reading)` → toast; tab "Want to read · 2" |

---

## 12. Suggested build slices (for the planner)

Files are disjoint except where a dependency is noted.

1. **Foundation** (everything else depends on it):
   - Everything in `src/lib/**`, including the unit tests.
   - `app/layout.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
   - `components/layout/**`, `components/common/**` and `components/ui/native-select.tsx`.
   - `app/api/test/reset/route.ts`.
   - ACs: AC-33, and the header part of AC-34.
2. **Book controls**: `books/status-actions.ts`, `status-select.tsx`, `rating-control.tsx`, `book-cover.tsx`. Depends on 1.
3. **Library**: `(library)/*`, `book-card.tsx`, `book-grid.tsx`, `status-tabs.tsx`, `library-toolbar.tsx`, `clear-search-button.tsx`, `library-empty.tsx`, `skeletons.tsx` (library part). ACs: AC-6–11, AC-13, AC-14, AC-28–30. Depends on 2.
4. **Book form**: `books/actions.ts`, `books/new/*`, `books/[id]/edit/*`, `book-form.tsx`, `rating-input.tsx`. ACs: AC-1–5, AC-23. Depends on 1.
5. **Detail and delete**: `books/[id]/page.tsx`, `loading.tsx`, `not-found.tsx`, `book-details.tsx`, `delete-book-button.tsx`, `books/delete-actions.ts`. ACs: AC-12, AC-15, AC-16, AC-22, AC-24–27. Depends on 2.
6. **Stats and goal**: `stats/**`, `components/stats/**`. ACs: AC-17–21, AC-35. Depends on 1.
7. **Settings**: `settings/**`, `components/settings/**`. ACs: AC-31, AC-32. Depends on 1.
8. **Pick next read**: `pick-next-read.tsx`. AC-36. Depends on 3; slice 3 renders `<PickNextRead candidates>` from the start.
9. **Integration and polish**: DESIGN.md pass, responsive and dark mode, AC-34.
