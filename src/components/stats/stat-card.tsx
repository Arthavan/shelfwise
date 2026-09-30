import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  /** Card title. It is the region's accessible name (ARCHITECTURE D15). */
  title: string;
  /** Already formatted value ("2,210", "4.3", "—"). */
  value: string;
  icon: LucideIcon;
}

/** One headline number: `<section>` named by its title, value in `data-testid="stat-value"` (DESIGN §5.7). */
export function StatCard({ title, value, icon: Icon }: StatCardProps) {
  const headingId = `stat-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-32 flex-col justify-between gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p data-testid="stat-value" className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </section>
  );
}
