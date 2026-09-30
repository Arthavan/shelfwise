# Shelfwise: a personal reading list

## Pitch
Shelfwise is a calm, private home for your reading life. Save any book with its title and author, and move it along a simple path: **Want to read → Reading → Finished**. Give finished books a 1–5 star rating and open the Stats page to see what you've read: totals by status, books finished this year, pages read, average rating, a month-by-month chart and how your ratings spread. It runs locally with no account and no sign-up, and the first time you open it there is already a small demo shelf, so it never starts out empty.

## Target users
- **The casual reader**: reads a handful of books a year, wants one place to remember "that book someone recommended" and what they thought of it.
- **The avid reader**: reads 20+ books a year, cares about progress (yearly goal, books per month, average rating) and wants to find things quickly with search and sort.

## Core loop
1. **Capture**: add a book (title, author, status; optionally pages and notes).
2. **Progress**: change its status from the library card as you start and finish it. Shelfwise records the start and finish dates.
3. **Reflect**: rate the book when you finish it (1–5 stars).
4. **Review**: open Stats to see totals, this year's progress and rating trends. Then go back to Want to read and pick your next book.

## Features

### Must (core loop)
- **F1 Add a book**: an "Add book" button in the header opens a form at `/books/new` (submit button "Save book") with Title (required, max 200 characters), Author (required, max 120), Status (default "Want to read"), Pages (optional, positive whole number), Notes (optional, max 2000). When Status is "Finished", a star Rating input appears. Errors show inline under each field: "Title is required", "Author is required", "Pages must be a positive whole number". Saving goes to the library and shows the toast "Book added".
- **F2 Library with status tabs**: the home page `/` shows book cards (a colored cover placeholder with initials, title, author, status, rating for finished books). Tabs read "All · N", "Want to read · N", "Reading · N", "Finished · N" and filter via `?status=want|reading|finished`. Empty states: an empty library shows "Your shelf is empty" with an "Add your first book" link. An empty tab shows "No books in {Status}".
- **F3 Quick status changes**: every card and the detail page have a status select (accessible name "Status for {title}"). Moving to Reading sets the started date if it isn't already set. Moving to Finished sets the finished date to today. Toasts: "Moved to Want to read", "Moved to Reading", "Marked as finished".
- **F4 Rate finished books**: finished books show five star buttons ("Rate 1 star" … "Rate 5 stars") under the label "Rate this book". A rated book shows stars with the accessible name "Rated N out of 5" and a "Clear rating" button. An unrated finished book shows "Not rated". Books that are not finished never show rating controls. Moving a book out of Finished clears its rating and finished date.
- **F5 Reading stats**: `/stats` shows stat cards for Total books, Want to read, Reading, Finished, Finished this year, Pages read (sum of pages of finished books) and Average rating (one decimal, "—" when nothing is rated). It also shows a "Finished per month" bar chart for the last 12 months (month abbreviations, current month last; each bar's accessible name is "{Mon YYYY}: N books") and a "Rating distribution" list from "5 stars" down to "1 star" with counts. With no books it shows "No stats yet" and an "Add a book" link.

### Should (feels complete)
- **F6 Book detail and edit**: `/books/{id}` shows the title as the page heading, author, status select, rating, pages, notes, and "Added on", "Started on" and "Finished on" dates (for example "Sep 30, 2026"). `/books/{id}/edit` is the same form as F1, prefilled (opened with "Edit", submit button "Save changes"). Saving goes back to the detail page and shows "Changes saved". An unknown id shows "Book not found" with a "Back to library" link.
- **F7 Delete with confirmation and undo**: "Delete" on the detail page opens a dialog titled `Delete "{title}"?` with "Cancel" and "Delete" buttons. Confirming goes back to `/` and shows the toast "Book deleted" with an "Undo" action. Undo restores the book exactly as it was (status, rating, dates, notes).
- **F8 Search and sort**: a "Search books" input (placeholder "Search title or author") filters by a case-insensitive substring of title or author and syncs to `?q=`. A "Sort by" select offers Recently added (default), Title (A–Z), Author (A–Z) and Highest rated, synced to `?sort=recent|title|author|rating`. Search, sort and status tab combine. No matches shows `No books match "{q}"` with a "Clear search" button.
- **F9 Demo data and settings**: on first run the database is seeded with 12 demo books (listed below). `/settings` has a Theme choice (Light, Dark, System), "Restore demo data" (replaces all books with the demo set, toast "Demo data restored") and "Delete all books" (confirmation dialog "Delete all books?", toast "All books deleted"). Both have confirmation dialogs.
- **F10 Theme, responsive layout and system states**: a header "Toggle theme" button switches light/dark and the choice persists. The layout works from 375px wide with no horizontal scroll, and the "Library", "Stats" and "Settings" navigation links stay visible. Lists and stats have loading skeletons and an error boundary ("Something went wrong" with a "Try again" button).

### Could (delight)
- **F11 Yearly reading goal**: on `/stats`, "Set goal" opens an input for a whole number from 1 to 999. A "Reading goal {year}" card then shows "{finished this year} of {goal} books" and a progress bar (`role="progressbar"`, `aria-valuenow` = finished this year, `aria-valuemax` = goal). The goal can be edited.
- **F12 Pick my next read**: on the Want to read tab, "Pick my next read" opens a dialog titled "Your next read" with one randomly chosen Want to read book, plus "Pick another" and "Start reading" buttons. "Start reading" moves that book to Reading. The button is hidden when there are no Want to read books.

## Demo seed data
| Title | Author | Status | Pages | Rating |
| --- | --- | --- | --- | --- |
| Piranesi | Susanna Clarke | Want to read | 272 | |
| The Overstory | Richard Powers | Want to read | 502 | |
| Braiding Sweetgrass | Robin Wall Kimmerer | Want to read | 391 | |
| Middlemarch | George Eliot | Reading | 880 | |
| Project Hail Mary | Andy Weir | Reading | 476 | |
| The Hobbit | J.R.R. Tolkien | Finished | 310 | 5 |
| Dune | Frank Herbert | Finished | 412 | 4 |
| Circe | Madeline Miller | Finished | 393 | 4 |
| The Remains of the Day | Kazuo Ishiguro | Finished | 245 | 5 |
| Educated | Tara Westover | Finished | 334 | 3 |
| Station Eleven | Emily St. John Mandel | Finished | 333 | 4 |
| A Wizard of Earthsea | Ursula K. Le Guin | Finished | 183 | 5 |

The demo set produces these stats: Total books 12, Want to read 3, Reading 2, Finished 7, Pages read 2,210, Average rating 4.3, and a rating distribution of 5 stars: 3, 4 stars: 3, 3 stars: 1, 2 stars: 0, 1 star: 0. Seed dates are relative to the time of seeding. Finished books are spread across the previous 11 months, with at least one finished in the current month, so the chart looks alive.

## Screens
| Screen | Path | Purpose |
| --- | --- | --- |
| Library | `/` | Status tabs, search, sort, book cards with inline status and rating, empty states, "Pick my next read" |
| Add book | `/books/new` | Create a book |
| Book detail | `/books/[id]` | Full book info, status, rating, dates, notes, edit and delete |
| Edit book | `/books/[id]/edit` | Edit a book |
| Stats | `/stats` | Stat cards, monthly chart, rating distribution, yearly goal |
| Settings | `/settings` | Theme, restore demo data, delete all books |
| Not found | any unknown path or book id | "Book not found" / "Page not found" with a link back to the library |

## Tone and visual direction
Warm and bookish but uncluttered: paper-like off-white surfaces, deep ink text, and one warm accent (terracotta or amber) for stars and primary actions. Headings use a literary serif and the interface uses a clean sans. Each book gets a generated cover tile (initials on a color derived from the title) instead of fetched cover art. Dark mode is a deep warm charcoal, not pure black. Copy is short, friendly and never cutesy.

## Non-goals
- User accounts, login, multi-user or sharing features.
- Fetching book metadata or covers from external APIs (Google Books, Open Library).
- Import/export (Goodreads CSV and similar).
- Page-by-page progress tracking, reading sessions or timers.
- Reviews longer than the Notes field, social feeds, recommendations.
- Multiple custom shelves or tags beyond the three statuses.
- Payments, notifications, native mobile apps, offline/PWA support.

## Assumptions
- It's a single-user, local app, so there's no authentication. All data lives in the app's SQLite database on the server.
- Statuses are exactly "Want to read", "Reading" and "Finished". There is no "Abandoned" / "Did not finish" status.
- Ratings are whole stars from 1 to 5 (no half stars), and only finished books can be rated.
- A book leaving Finished loses its rating and finished date, so the stats never count ratings for unfinished books. Moving to Reading keeps an existing started date. Moving a book back to Want to read clears its started date.
- A book may be created directly as Finished (with an optional rating). Its finished date is then the creation date.
- Pages and Notes are optional extras beyond the prompt, added so "Pages read" and personal notes are possible.
- Duplicate titles are allowed (different editions or re-reads).
- The default library sort is Recently added (newest first). Title and Author sorts are case-insensitive, plain alphabetical (no stripping of "The"/"A"). Highest rated sorts rated books by rating descending, then unrated books, with ties broken by title.
- Search is a case-insensitive substring match on title or author. There is no pagination because a personal list is expected to stay in the hundreds.
- "Finished this year", "Finished per month" and the goal use the calendar year and months in the server's local time zone. Dates are displayed in the en-US medium format (for example "Sep 30, 2026").
- Average rating is the mean of rated finished books, rounded to one decimal place.
- Delete is a soft delete, so Undo can restore the book exactly. Undo is available for as long as the toast is visible (about 6 seconds).
- The reading goal is a single number for the current calendar year, stored in a settings record. There is no goal by default.
- The demo data is seeded automatically when the database is first created. "Restore demo data" in Settings resets to the same set, which e2e tests can use to reach a known state.
- The theme defaults to System and is persisted by next-themes in localStorage.
- The UI is English-only.
