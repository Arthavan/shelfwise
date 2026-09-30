import type { MonthBucket } from "@/lib/types";

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const NUMBER = new Intl.NumberFormat("en-US");

/** "Sep 30, 2026", or an em dash when unset. */
export function formatDate(d: Date | null | undefined): string {
  return d ? DATE.format(d) : "—";
}

/** "2,210" */
export function formatNumber(n: number): string {
  return NUMBER.format(n);
}

/** "4.3", or an em dash when there is no average. */
export function formatAverage(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toFixed(1);
}

/** "1 book" / "0 books" */
export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

export function starsLabel(n: number): string {
  return pluralize(n, "star");
}

export function rateButtonLabel(n: number): string {
  return `Rate ${starsLabel(n)}`;
}

export function ratedLabel(n: number): string {
  return `Rated ${n} out of 5`;
}

/** "Sep 2026: 1 book" */
export function monthBarLabel(b: Pick<MonthBucket, "label" | "count">): string {
  return `${b.label}: ${pluralize(b.count, "book")}`;
}
