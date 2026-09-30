import type { Book, LibraryParams, SortKey, StatusCounts, StatusFilter } from "@/lib/types";

const STATUS_FILTERS: readonly StatusFilter[] = ["all", "want", "reading", "finished"];
const SORT_KEYS: readonly SortKey[] = ["recent", "title", "author", "rating"];
const MAX_QUERY = 200;

export const DEFAULT_LIBRARY_PARAMS: LibraryParams = { status: "all", q: "", sort: "recent" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Invalid or missing values fall back to all / recent / "". `q` is trimmed and capped (ARCHITECTURE §4.2). */
export function parseLibraryParams(raw: Record<string, string | string[] | undefined>): LibraryParams {
  const status = first(raw.status);
  const sort = first(raw.sort);
  const q = (first(raw.q) ?? "").trim().slice(0, MAX_QUERY).trim();
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_LIBRARY_PARAMS.status,
    q,
    sort: SORT_KEYS.find((s) => s === sort) ?? DEFAULT_LIBRARY_PARAMS.sort,
  };
}

/** Counts for the whole library. They deliberately ignore search (D6). */
export function countByStatus(books: readonly Pick<Book, "status">[]): StatusCounts {
  const counts: StatusCounts = { all: books.length, want: 0, reading: 0, finished: 0 };
  for (const book of books) counts[book.status] += 1;
  return counts;
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

function compareBooks(sort: SortKey): (a: Book, b: Book) => number {
  switch (sort) {
    case "recent":
      return (a, b) => b.createdAt.getTime() - a.createdAt.getTime();
    case "title":
      return (a, b) => compareText(a.title, b.title) || compareText(a.author, b.author);
    case "author":
      return (a, b) => compareText(a.author, b.author) || compareText(a.title, b.title);
    case "rating":
      return (a, b) => {
        if (a.rating !== null && b.rating !== null && a.rating !== b.rating) return b.rating - a.rating;
        if (a.rating !== null && b.rating === null) return -1;
        if (a.rating === null && b.rating !== null) return 1;
        return compareText(a.title, b.title);
      };
  }
}

/** Status filter, case-insensitive substring match on title OR author, then the chosen sort. */
export function filterAndSortBooks(books: readonly Book[], params: LibraryParams): Book[] {
  const needle = params.q.trim().toLocaleLowerCase("en-US");
  return books
    .filter((book) => params.status === "all" || book.status === params.status)
    .filter(
      (book) =>
        needle === "" ||
        book.title.toLocaleLowerCase("en-US").includes(needle) ||
        book.author.toLocaleLowerCase("en-US").includes(needle),
    )
    .sort(compareBooks(params.sort));
}

/** "/" plus params in the order status, q, sort. Defaults are omitted. */
export function buildLibraryHref(current: LibraryParams, patch: Partial<LibraryParams> = {}): string {
  const next: LibraryParams = { ...current, ...patch };
  const search = new URLSearchParams();
  if (next.status !== DEFAULT_LIBRARY_PARAMS.status) search.set("status", next.status);
  const q = next.q.trim();
  if (q !== "") search.set("q", q);
  if (next.sort !== DEFAULT_LIBRARY_PARAMS.sort) search.set("sort", next.sort);
  const query = search.toString();
  return query === "" ? "/" : `/?${query}`;
}
