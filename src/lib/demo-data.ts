// Pure module: relative imports only (used by prisma/seed.ts as well as the app).

export type DemoBookRow = {
  id: string;
  title: string;
  author: string;
  status: "want" | "reading" | "finished";
  pages: number;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type DemoSeed = {
  slug: string;
  title: string;
  author: string;
  status: DemoBookRow["status"];
  pages: number;
  rating?: number;
  notes?: string;
  createdDaysAgo?: number;
  startedDaysAgo?: number;
  finishedMonthsAgo?: number;
};

export const DEMO_BOOKS: DemoSeed[] = [
  { slug: "piranesi", title: "Piranesi", author: "Susanna Clarke", status: "want", pages: 272, notes: "Recommended by Maya. Save it for a slow weekend.", createdDaysAgo: 1 },
  { slug: "the-overstory", title: "The Overstory", author: "Richard Powers", status: "want", pages: 502, createdDaysAgo: 2 },
  { slug: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", status: "want", pages: 391, notes: "One essay at a time.", createdDaysAgo: 3 },
  { slug: "project-hail-mary", title: "Project Hail Mary", author: "Andy Weir", status: "reading", pages: 476, createdDaysAgo: 9, startedDaysAgo: 5 },
  { slug: "middlemarch", title: "Middlemarch", author: "George Eliot", status: "reading", pages: 880, notes: "Book Three of Eight. Slow and worth it.", createdDaysAgo: 30, startedDaysAgo: 21 },
  { slug: "the-hobbit", title: "The Hobbit", author: "J.R.R. Tolkien", status: "finished", pages: 310, rating: 5, notes: "Reread before winter. Still perfect.", finishedMonthsAgo: 0 },
  { slug: "dune", title: "Dune", author: "Frank Herbert", status: "finished", pages: 412, rating: 4, finishedMonthsAgo: 1 },
  { slug: "circe", title: "Circe", author: "Madeline Miller", status: "finished", pages: 393, rating: 4, notes: "The island chapters are the best part.", finishedMonthsAgo: 2 },
  { slug: "the-remains-of-the-day", title: "The Remains of the Day", author: "Kazuo Ishiguro", status: "finished", pages: 245, rating: 5, finishedMonthsAgo: 4 },
  { slug: "educated", title: "Educated", author: "Tara Westover", status: "finished", pages: 334, rating: 3, notes: "Hard to read in places.", finishedMonthsAgo: 6 },
  { slug: "station-eleven", title: "Station Eleven", author: "Emily St. John Mandel", status: "finished", pages: 333, rating: 4, finishedMonthsAgo: 8 },
  { slug: "a-wizard-of-earthsea", title: "A Wizard of Earthsea", author: "Ursula K. Le Guin", status: "finished", pages: 183, rating: 5, finishedMonthsAgo: 10 },
];

const DAY = 86_400_000;

/** Create-ready rows with fixed ids (demo-<slug>) and dates relative to `now`. */
export function buildDemoBooks(now: Date): DemoBookRow[] {
  const monthAgo = (k: number) => new Date(now.getFullYear(), now.getMonth() - k, 15, 12, 0, 0);
  return DEMO_BOOKS.map((b) => {
    let finishedAt: Date | null = null;
    let startedAt: Date | null = null;
    let createdAt: Date;
    if (b.status === "finished") {
      finishedAt = b.finishedMonthsAgo === 0 ? new Date(now) : monthAgo(b.finishedMonthsAgo ?? 0);
      startedAt = new Date(finishedAt.getTime() - 14 * DAY);
      createdAt = new Date(finishedAt.getTime() - 21 * DAY);
    } else {
      createdAt = new Date(now.getTime() - (b.createdDaysAgo ?? 0) * DAY);
      startedAt = b.startedDaysAgo ? new Date(now.getTime() - b.startedDaysAgo * DAY) : null;
    }
    return {
      id: `demo-${b.slug}`,
      title: b.title,
      author: b.author,
      status: b.status,
      pages: b.pages,
      rating: b.rating ?? null,
      notes: b.notes ?? null,
      createdAt,
      startedAt,
      finishedAt,
    };
  });
}
