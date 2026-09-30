import { Skeleton } from "@/components/ui/skeleton";

const BAR_HEIGHTS = [40, 65, 30, 80, 55, 20, 70, 45, 60, 35, 75, 50];
const ROWS = [0, 1, 2, 3, 4];
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Loading state with the same chrome as the stats page (DESIGN §5.9, §6.5). */
export function StatsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-8 w-32 sm:h-9" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {CELLS.map((i) => (
          <div key={i} className="flex min-h-32 flex-col justify-between gap-3 rounded-lg border bg-card p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-6 flex h-40 items-end gap-1 sm:gap-2">
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} className="flex h-28 min-w-0 flex-1 items-end justify-center self-center">
                <Skeleton className="w-full max-w-8 rounded-b-none rounded-t-sm" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
          <Skeleton className="h-7 w-44" />
          <div className="mt-6 space-y-3">
            {ROWS.map((i) => (
              <div key={i} className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-4 w-5 justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
