// Single source of shared types (ARCHITECTURE §4.0).
export type BookStatus = "want" | "reading" | "finished";
export type StatusFilter = BookStatus | "all";
export type SortKey = "recent" | "title" | "author" | "rating";

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  pages: number | null;
  notes: string | null;
  rating: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type BookLifecycle = Pick<Book, "status" | "startedAt" | "finishedAt" | "rating">;
export interface BookSummary {
  id: string;
  title: string;
  author: string;
} // Pick-next candidates

export interface LibraryParams {
  status: StatusFilter;
  q: string;
  sort: SortKey;
}
export interface StatusCounts {
  all: number;
  want: number;
  reading: number;
  finished: number;
}

export interface MonthBucket {
  key: string; // "2026-09"
  short: string; // "Sep"
  label: string; // "Sep 2026"
  count: number;
}
export interface RatingBucket {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
}
export interface Stats {
  total: number;
  want: number;
  reading: number;
  finished: number;
  finishedThisYear: number;
  pagesRead: number;
  averageRating: number | null; // rounded to 1 decimal
  monthly: MonthBucket[]; // length 12, oldest → current month
  distribution: RatingBucket[]; // stars 5 → 1
}
export interface ReadingGoal {
  year: number;
  target: number;
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string>> };

export type BookFormValues = {
  title: string;
  author: string;
  status: BookStatus;
  pages: string;
  notes: string;
  rating: number | null;
};
