import type { Book, MonthBucket, RatingBucket, Stats } from "@/lib/types";

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Reading stats for the whole library. Works in server local time (ARCHITECTURE §4.3). */
export function computeStats(books: Book[], now: Date): Stats {
  const finishedBooks = books.filter((b) => b.status === "finished");
  const year = now.getFullYear();

  const finishedThisYear = finishedBooks.filter((b) => b.finishedAt && b.finishedAt.getFullYear() === year).length;
  const pagesRead = finishedBooks.reduce((sum, b) => sum + (b.pages ?? 0), 0);

  const ratings = finishedBooks.map((b) => b.rating).filter((r): r is number => r !== null);
  const averageRating = ratings.length ? Math.round((ratings.reduce((a, r) => a + r, 0) / ratings.length) * 10) / 10 : null;

  const monthly: MonthBucket[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const short = MONTH_SHORT.format(d);
    const key = monthKey(d.getFullYear(), d.getMonth());
    indexByKey.set(key, i);
    monthly.push({ key, short, label: `${short} ${d.getFullYear()}`, count: 0 });
  }
  for (const b of finishedBooks) {
    if (!b.finishedAt) continue;
    const idx = indexByKey.get(monthKey(b.finishedAt.getFullYear(), b.finishedAt.getMonth()));
    if (idx !== undefined) monthly[idx].count += 1;
  }

  const distribution: RatingBucket[] = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: ratings.filter((r) => r === stars).length,
  }));

  return {
    total: books.length,
    want: books.filter((b) => b.status === "want").length,
    reading: books.filter((b) => b.status === "reading").length,
    finished: finishedBooks.length,
    finishedThisYear,
    pagesRead,
    averageRating,
    monthly,
    distribution,
  };
}
