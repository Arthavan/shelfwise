# Pipeline report: Shelfwise

Prompt: "A personal reading list app: save books with title, author and status (want to read, reading, finished), rate finished books, and see simple reading stats."
Branch: `app/a-personal-reading-list-app-save-books-w-r12i`

## What was built
Shelfwise, a single-user Next.js 16 app with Prisma 7 and SQLite. It has an add/edit form, a library with status tabs, search and sort, inline status changes, 1–5 star ratings for finished books, a book detail page, soft delete with undo, a stats page (cards, monthly chart, rating distribution, yearly goal), Pick my next read, a settings page (theme, restore demo, delete all) and light/dark themes. See [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [DESIGN.md](DESIGN.md).

## Assumptions (from the spec)
- Single-user local app with no authentication. All data is in the server's SQLite database.
- Statuses are exactly Want to read, Reading and Finished. There is no Abandoned status.
- Ratings are whole stars from 1 to 5, and only finished books can be rated.
- Leaving Finished clears the rating and finished date. Moving to Reading keeps an existing started date. Moving back to Want to read clears the started date.
- A book can be created directly as Finished, and its finished date is then the creation date.
- Pages and Notes are optional extras added beyond the prompt.
- Duplicate titles are allowed.
- Default sort is Recently added. Title and Author sorts are case-insensitive with no article stripping. Highest rated puts rated books first, ties by title.
- Search is a case-insensitive substring match on title or author, with no pagination.
- Year, month and goal calculations use the server's local time zone. Dates display in en-US medium format.
- Average rating is the mean of rated finished books, to one decimal.
- Delete is a soft delete. Undo lasts about 6 seconds, while the toast is visible.
- The goal is one number for the current calendar year, with none by default.
- Demo data (12 books) is seeded on first database creation. "Restore demo data" resets to the same set.
- The theme defaults to System and is stored in localStorage. The UI is English only.

## Stage results
| Stage | Result |
| --- | --- |
| Spec + critic | Spec score 8. Critic issues (rating toast, mutation errors) were addressed in the architecture's binding decisions. |
| Architecture, design, scaffold, plan | Done. 10 tasks (T1–T10). |
| Tests | 14 Playwright spec files written before the build. |
| Build | All 10 tasks done. |
| Visual review | Score 8.5, 5 minor issues. |
| Code review | Round 1 fixed serious issues (destructive first-run seed, open reset hook, tab a11y). Round 2 verdict: **pass**, 0 serious, no missing ACs. |

## Test results
- Lint, typecheck, unit tests and build: all pass.
- Unit (Vitest): 78 passed in 8 files (re-run during this stage).
- E2E (Playwright): 37 passed, 0 failed.

## Scores
- Spec: 8/10. Visual: 8.5/10. Review: pass.
- Cost: about $25.62 in total.

## Known limitations
Remaining minor findings, not fixed in this run:
- R1 (search): with slow round-trips (hosted deploys), fast typing in the search box can be overwritten by an older URL update. It does not reproduce on localhost.
- R2 (delete): after deleting a book, browser Back can show the stale detail page, and a status change there gives a generic error toast.
- R3: ARCHITECTURE.md still describes two behaviours that round 1 changed.
- Visual: Settings section titles use sans instead of the serif h2 style. The Status select and Pages input differ in height at sm+ on the form. Desktop bottom padding on `main` is smaller than intended. The first tab label is slightly offset. The cover palette skews brown and green.
- No authentication. SQLite will not persist on serverless hosts such as Vercel.
- No pagination, no import/export, no external cover art or metadata.

## Suggested next features
- Fix the minor findings above (small, mostly one-line changes).
- Postgres option and a Docker setup for hosting.
- CSV import and export (for example Goodreads).
- An "Abandoned" status, tags or custom shelves.
- Reading progress by page, and per-book start and finish date editing.
- Optional authentication for a hosted multi-user version.
