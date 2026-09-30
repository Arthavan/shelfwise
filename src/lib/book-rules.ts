import type { BookFormValues, BookLifecycle, BookStatus } from "@/lib/types";

/** Lifecycle for a brand-new book (ARCHITECTURE §4.1). */
export function initialLifecycle(status: BookStatus, rating: number | null, now: Date): BookLifecycle {
  switch (status) {
    case "want":
      return { status, startedAt: null, finishedAt: null, rating: null };
    case "reading":
      return { status, startedAt: now, finishedAt: null, rating: null };
    case "finished":
      return { status, startedAt: null, finishedAt: now, rating: rating ?? null };
  }
}

/** D7: the one status-transition function used by the quick select and the edit form. */
export function applyStatusChange(current: BookLifecycle, next: BookStatus, now: Date): BookLifecycle {
  if (current.status === next) return current;
  switch (next) {
    case "want":
      return { status: next, startedAt: null, finishedAt: null, rating: null };
    case "reading":
      return { status: next, startedAt: current.startedAt ?? now, finishedAt: null, rating: null };
    case "finished":
      return { status: next, startedAt: current.startedAt, finishedAt: now, rating: null };
  }
}

/** Edit form: transition first, then the rating only survives on finished books. */
export function applyFormToLifecycle(
  current: BookLifecycle,
  values: Pick<BookFormValues, "status" | "rating">,
  now: Date,
): BookLifecycle {
  const next = applyStatusChange(current, values.status, now);
  return { ...next, rating: values.status === "finished" ? values.rating : null };
}
