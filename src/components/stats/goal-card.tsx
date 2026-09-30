import { Target } from "lucide-react";

import { GoalDialog } from "@/components/stats/goal-dialog";
import { pluralize } from "@/lib/format";
import type { ReadingGoal } from "@/lib/types";

interface GoalCardProps {
  /** Current calendar year (the goal only applies to it). */
  year: number;
  goal: ReadingGoal | null;
  finishedThisYear: number;
}

/** Yearly goal card, the 8th cell of the stats grid (DESIGN §6.5). */
export function GoalCard({ year, goal, finishedThisYear }: GoalCardProps) {
  const title = `Reading goal ${year}`;
  const percent = goal ? Math.min(100, Math.max(0, (finishedThisYear / goal.target) * 100)) : 0;
  return (
    <section
      aria-labelledby="stat-reading-goal"
      className="flex min-h-32 flex-col justify-between gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="stat-reading-goal" className="text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        <Target aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {goal ? (
        <>
          <p className="text-base font-medium tabular-nums">{`${finishedThisYear} of ${pluralize(goal.target, "book")}`}</p>
          <div
            role="progressbar"
            aria-label="Reading goal progress"
            aria-valuemin={0}
            aria-valuenow={finishedThisYear}
            aria-valuemax={goal.target}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No goal set yet</p>
      )}
      <GoalDialog year={year} target={goal?.target ?? null} />
    </section>
  );
}
