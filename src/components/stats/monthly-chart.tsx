import { monthBarLabel } from "@/lib/format";
import type { MonthBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Books finished per month over the last 12 months, oldest → current (DESIGN §6.5). */
export function MonthlyChart({ months }: { months: MonthBucket[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const lastIndex = months.length - 1;

  return (
    <section aria-labelledby="chart-monthly" className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="chart-monthly" className="font-serif text-xl font-medium">
          Finished per month
        </h2>
        <p className="text-xs text-muted-foreground">Last 12 months</p>
      </div>
      <ol className="mt-6 flex h-40 items-end gap-1 sm:gap-2">
        {months.map((m, i) => {
          const isCurrent = i === lastIndex;
          return (
            <li key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              {m.count > 0 ? (
                <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
                  {m.count}
                </span>
              ) : null}
              <div className="flex h-28 w-full items-end justify-center">
                <div
                  role="img"
                  aria-label={monthBarLabel(m)}
                  className={cn("w-full max-w-8 rounded-t-sm", m.count > 0 ? "bg-chart-1" : "h-1 bg-input")}
                  style={m.count > 0 ? { height: `${(m.count / max) * 100}%` } : undefined}
                />
              </div>
              <span
                aria-hidden="true"
                className={cn("text-xs", isCurrent ? "font-medium text-foreground" : "text-muted-foreground")}
              >
                <span className="sm:hidden">{m.short.charAt(0)}</span>
                <span className="hidden sm:inline">{m.short}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
