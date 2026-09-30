import { starsLabel } from "@/lib/format";
import type { RatingBucket } from "@/lib/types";

/** How many finished books got each star rating, 5 → 1 (DESIGN §6.5). */
export function RatingDistribution({ buckets }: { buckets: RatingBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <section aria-labelledby="chart-distribution" className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
      <h2 id="chart-distribution" className="font-serif text-xl font-medium">
        Rating distribution
      </h2>
      <ul className="mt-6 space-y-3">
        {buckets.map((b) => (
          <li
            key={b.stars}
            aria-label={`${starsLabel(b.stars)}: ${b.count}`}
            className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-3"
          >
            <span className="text-sm">{starsLabel(b.stars)}</span>
            <div className="h-2 rounded-full bg-muted">
              {b.count > 0 ? (
                <div className="h-2 rounded-full bg-chart-1" style={{ width: `${(b.count / max) * 100}%` }} />
              ) : null}
            </div>
            <span className="text-right text-sm tabular-nums">{b.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
