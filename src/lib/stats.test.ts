import { describe, expect, it } from "vitest";

import { buildDemoBooks } from "./demo-data";
import { monthBarLabel } from "./format";
import { computeStats } from "./stats";
import type { Book } from "./types";

function demoBooks(now: Date): Book[] {
  return buildDemoBooks(now).map((row) => ({ ...row, updatedAt: row.createdAt }));
}

const NOW = new Date(2026, 8, 30, 10, 0, 0); // Sep 30, 2026

describe("computeStats", () => {
  it("matches the demo numbers", () => {
    const s = computeStats(demoBooks(NOW), NOW);
    expect([s.total, s.want, s.reading, s.finished]).toEqual([12, 3, 2, 7]);
    expect(s.pagesRead).toBe(2210);
    expect(s.averageRating).toBe(4.3);
    expect(s.finishedThisYear).toBe(6);
    expect(s.distribution.map((d) => [d.stars, d.count])).toEqual([
      [5, 3],
      [4, 3],
      [3, 1],
      [2, 0],
      [1, 0],
    ]);
  });

  it("builds 12 monthly buckets with the current month last", () => {
    const s = computeStats(demoBooks(NOW), NOW);
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[0].label).toBe("Oct 2025");
    expect(s.monthly[11]).toMatchObject({ key: "2026-09", short: "Sep", label: "Sep 2026", count: 1 });
    expect(s.monthly.reduce((sum, m) => sum + m.count, 0)).toBe(7);
  });

  it("crosses year boundaries", () => {
    const jan = new Date(2027, 0, 10);
    const s = computeStats(demoBooks(jan), jan);
    expect(s.monthly[0].label).toBe("Feb 2026");
    expect(s.monthly[11].label).toBe("Jan 2027");
  });

  it("pluralises bar labels", () => {
    const s = computeStats(demoBooks(NOW), NOW);
    expect(monthBarLabel(s.monthly[11])).toBe("Sep 2026: 1 book");
    expect(monthBarLabel(s.monthly[10])).toBe("Aug 2026: 1 book");
    expect(monthBarLabel(s.monthly[8])).toBe("Jun 2026: 0 books");
  });

  it("counts null pages as 0 and ignores unrated books in the average", () => {
    const base = demoBooks(NOW)[5];
    const books: Book[] = [
      { ...base, id: "a", pages: null, rating: 4 },
      { ...base, id: "b", pages: 100, rating: null },
    ];
    const s = computeStats(books, NOW);
    expect(s.pagesRead).toBe(100);
    expect(s.averageRating).toBe(4);
  });

  it("handles an empty library", () => {
    const s = computeStats([], NOW);
    expect([s.total, s.want, s.reading, s.finished, s.finishedThisYear, s.pagesRead]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.averageRating).toBeNull();
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly.every((m) => m.count === 0)).toBe(true);
    expect(s.distribution.every((d) => d.count === 0)).toBe(true);
  });
});
