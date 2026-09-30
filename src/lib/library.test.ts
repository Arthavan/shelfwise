import { describe, expect, it } from "vitest";

import { buildDemoBooks } from "./demo-data";
import { buildLibraryHref, continueReadingBooks, countByStatus, filterAndSortBooks, parseLibraryParams } from "./library";
import type { Book, LibraryParams, ReadingSummary } from "./types";

const now = new Date(2026, 8, 30, 12);

function demoBooks(): Book[] {
  return buildDemoBooks(now).map((row) => ({ ...row, updatedAt: row.createdAt }));
}

const base: LibraryParams = { status: "all", q: "", sort: "recent" };
const titles = (books: Book[]) => books.map((b) => b.title);

describe("parseLibraryParams", () => {
  it("falls back to defaults for missing values", () => {
    expect(parseLibraryParams({})).toEqual(base);
  });
  it("falls back for invalid status and sort", () => {
    expect(parseLibraryParams({ status: "done", sort: "pages" })).toEqual(base);
  });
  it("accepts valid values", () => {
    expect(parseLibraryParams({ status: "finished", q: "hobbit", sort: "rating" })).toEqual({
      status: "finished",
      q: "hobbit",
      sort: "rating",
    });
  });
  it("trims q and caps it at 200 characters", () => {
    expect(parseLibraryParams({ q: "  dune  " }).q).toBe("dune");
    expect(parseLibraryParams({ q: "x".repeat(500) }).q).toHaveLength(200);
  });
  it("uses the first value of repeated params", () => {
    expect(parseLibraryParams({ status: ["reading", "want"], q: ["a", "b"] })).toMatchObject({ status: "reading", q: "a" });
  });
});

describe("countByStatus", () => {
  it("counts the whole demo library 12 / 3 / 2 / 7", () => {
    expect(countByStatus(demoBooks())).toEqual({ all: 12, want: 3, reading: 2, finished: 7 });
  });
  it("is zero for an empty library", () => {
    expect(countByStatus([])).toEqual({ all: 0, want: 0, reading: 0, finished: 0 });
  });
});

describe("filterAndSortBooks", () => {
  const books = demoBooks();

  it("recent: newest first", () => {
    expect(titles(filterAndSortBooks(books, base)).slice(0, 3)).toEqual(["Piranesi", "The Overstory", "Braiding Sweetgrass"]);
  });
  it("filters by status", () => {
    const result = filterAndSortBooks(books, { ...base, status: "finished" });
    expect(result).toHaveLength(7);
    expect(result.every((b) => b.status === "finished")).toBe(true);
  });
  it("matches title or author, case-insensitively", () => {
    expect(titles(filterAndSortBooks(books, { ...base, q: "TOLKIEN" }))).toEqual(["The Hobbit"]);
    expect(titles(filterAndSortBooks(books, { ...base, q: "hobb" }))).toEqual(["The Hobbit"]);
    expect(filterAndSortBooks(books, { ...base, q: "zzzz" })).toEqual([]);
  });
  it("combines status and search", () => {
    expect(filterAndSortBooks(books, { ...base, status: "want", q: "tolkien" })).toEqual([]);
  });
  it("title sort (AC-30): first A Wizard of Earthsea, last The Remains of the Day", () => {
    const result = titles(filterAndSortBooks(books, { ...base, sort: "title" }));
    expect(result[0]).toBe("A Wizard of Earthsea");
    expect(result[result.length - 1]).toBe("The Remains of the Day");
  });
  it("author sort ascending", () => {
    const authors = filterAndSortBooks(books, { ...base, sort: "author" }).map((b) => b.author);
    expect(authors[0]).toBe("Andy Weir");
    expect(authors[authors.length - 1]).toBe("Ursula K. Le Guin");
  });
  it("rating sort: rated desc, unrated last, ties by title", () => {
    const result = filterAndSortBooks(books, { ...base, sort: "rating" });
    expect(titles(result).slice(0, 3)).toEqual(["A Wizard of Earthsea", "The Hobbit", "The Remains of the Day"]);
    expect(result.slice(3, 6).map((b) => b.rating)).toEqual([4, 4, 4]);
    expect(result[6].rating).toBe(3);
    expect(result.slice(7).every((b) => b.rating === null)).toBe(true);
    expect(titles(result).slice(7)).toEqual([...titles(result).slice(7)].sort((a, b) => a.localeCompare(b)));
  });
  it("does not mutate the input", () => {
    const copy = [...books];
    filterAndSortBooks(books, { ...base, sort: "title" });
    expect(books).toEqual(copy);
  });
});

describe("buildLibraryHref", () => {
  it("is / when everything is default", () => {
    expect(buildLibraryHref(base, {})).toBe("/");
    expect(buildLibraryHref({ status: "want", q: "x", sort: "title" }, { status: "all", q: "", sort: "recent" })).toBe("/");
  });
  it("omits defaults and orders status, q, sort", () => {
    expect(buildLibraryHref(base, { sort: "title", q: "dune", status: "finished" })).toBe("/?status=finished&q=dune&sort=title");
    expect(buildLibraryHref(base, { status: "reading" })).toBe("/?status=reading");
  });
  it("preserves the other params", () => {
    const current: LibraryParams = { status: "want", q: "the", sort: "author" };
    expect(buildLibraryHref(current, { status: "finished" })).toBe("/?status=finished&q=the&sort=author");
    expect(buildLibraryHref(current, { q: "" })).toBe("/?status=want&sort=author");
  });
  it("encodes q", () => {
    expect(buildLibraryHref(base, { q: "a b&c" })).toBe("/?q=a+b%26c");
  });
});

describe("continueReadingBooks", () => {
  const book = (id: string, status: Book["status"]): Book => ({
    id, title: id, author: "A", status, pages: null, notes: null, rating: null,
    startedAt: null, finishedAt: null, createdAt: now, updatedAt: now,
  });
  const summary = (lastReadAt: Date | null, hasProgress = false): ReadingSummary => ({ percent: hasProgress ? 40 : 0, location: "1", format: "pdf", lastReadAt, hasProgress });
  const at = (day: number) => new Date(2026, 8, day);

  it("keeps Reading books with a file that have been opened, most recently read first, at most three", () => {
    const books = [book("old", "reading"), book("new", "reading"), book("mid", "reading"), book("oldest", "reading"), book("unopened", "reading"), book("nofile", "reading"), book("done", "finished"), book("want", "want")];
    const summaries: Record<string, ReadingSummary> = {
      old: summary(at(10), true),
      new: summary(at(20)), // opened but never paged through: still in the row
      mid: summary(at(15), true),
      oldest: summary(at(1), true),
      unopened: summary(null),
      done: summary(at(25), true),
      want: summary(at(26)),
    };
    expect(continueReadingBooks(books, summaries).map((b) => b.id)).toEqual(["new", "mid", "old"]);
  });
});
