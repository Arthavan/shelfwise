import type { BookStatus, SortKey } from "@/lib/types";

export const STATUSES: readonly BookStatus[] = ["want", "reading", "finished"];

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: "Want to read",
  reading: "Reading",
  finished: "Finished",
};

export const STATUS_TOASTS: Record<BookStatus, string> = {
  want: "Moved to Want to read",
  reading: "Moved to Reading",
  finished: "Marked as finished",
};

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Title (A–Z)" },
  { value: "author", label: "Author (A–Z)" },
  { value: "rating", label: "Highest rated" },
];

/** Exact toast copy (ARCHITECTURE §6.4). Rating toasts use `ratedLabel(n)` from format.ts. */
export const TOAST = {
  bookAdded: "Book added",
  changesSaved: "Changes saved",
  ratingCleared: "Rating cleared",
  bookDeleted: "Book deleted",
  undo: "Undo",
  bookRestored: "Book restored",
  demoRestored: "Demo data restored",
  allDeleted: "All books deleted",
  goalSaved: "Goal saved",
  goalRemoved: "Goal removed",
} as const;

export const ERROR_TOAST = "Couldn't save changes. Try again.";

/** Literal class strings so Tailwind can scan them. Index = coverTone(title) - 1. */
export const COVER_CLASSES = [
  "bg-cover-1 text-cover-foreground",
  "bg-cover-2 text-cover-foreground",
  "bg-cover-3 text-cover-foreground",
  "bg-cover-4 text-cover-foreground",
  "bg-cover-5 text-cover-foreground",
  "bg-cover-6 text-cover-foreground",
  "bg-cover-7 text-cover-foreground",
  "bg-cover-8 text-cover-foreground",
] as const;
