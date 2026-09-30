import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookCheck, BookOpen, Bookmark, CalendarCheck, FileText, Library, Star } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { GoalCard } from "@/components/stats/goal-card";
import { MonthlyChart } from "@/components/stats/monthly-chart";
import { RatingDistribution } from "@/components/stats/rating-distribution";
import { StatCard } from "@/components/stats/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { listBooks } from "@/lib/data/books";
import { getReadingGoal } from "@/lib/data/settings";
import { formatAverage, formatNumber } from "@/lib/format";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage() {
  const now = new Date();
  const [books, goal] = await Promise.all([listBooks(), getReadingGoal(now)]);
  const stats = computeStats(books, now);

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">Stats</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your reading at a glance.</p>
        </div>
      </header>

      {stats.total === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No stats yet"
          description="Add a few books and your stats will show up here."
          action={
            <Link href="/books/new" className={buttonVariants()}>
              Add a book
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <StatCard title="Total books" value={formatNumber(stats.total)} icon={Library} />
            <StatCard title="Want to read" value={formatNumber(stats.want)} icon={Bookmark} />
            <StatCard title="Reading" value={formatNumber(stats.reading)} icon={BookOpen} />
            <StatCard title="Finished" value={formatNumber(stats.finished)} icon={BookCheck} />
            <StatCard title="Finished this year" value={formatNumber(stats.finishedThisYear)} icon={CalendarCheck} />
            <StatCard title="Pages read" value={formatNumber(stats.pagesRead)} icon={FileText} />
            <StatCard title="Average rating" value={formatAverage(stats.averageRating)} icon={Star} />
            <GoalCard year={now.getFullYear()} goal={goal} finishedThisYear={stats.finishedThisYear} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MonthlyChart months={stats.monthly} />
            <RatingDistribution buckets={stats.distribution} />
          </div>
        </>
      )}
    </div>
  );
}
