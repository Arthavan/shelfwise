import Link from "next/link";

import { RovingTablist } from "@/components/books/roving-tablist";
import { STATUS_LABELS } from "@/lib/constants";
import { buildLibraryHref } from "@/lib/library";
import type { LibraryParams, StatusCounts, StatusFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: STATUS_LABELS.want },
  { value: "reading", label: STATUS_LABELS.reading },
  { value: "finished", label: STATUS_LABELS.finished },
];

/** The single panel below the tabs (toolbar + list); labelled by whichever tab is selected. */
export const LIBRARY_PANEL_ID = "library-panel";

export function statusTabId(status: StatusFilter): string {
  return `status-tab-${status}`;
}

interface StatusTabsProps {
  params: LibraryParams;
  counts: StatusCounts;
}

/**
 * Tablist of links. Counts cover the whole library; hrefs keep search and sort (D6).
 * Roving tabindex: only the selected tab is in the Tab order; arrows move between tabs (RovingTablist).
 */
export function StatusTabs({ params, counts }: StatusTabsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <RovingTablist aria-label="Filter by status" className="flex w-max min-w-full gap-1 border-b">
        {TABS.map((tab) => {
          const selected = params.status === tab.value;
          return (
            <Link
              key={tab.value}
              id={statusTabId(tab.value)}
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? LIBRARY_PANEL_ID : undefined}
              tabIndex={selected ? 0 : -1}
              href={buildLibraryHref(params, { status: tab.value })}
              className={cn(
                "relative inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selected
                  ? "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground",
              )}
            >
              <span>
                {tab.label}
                <span className="text-muted-foreground tabular-nums">{" · "}{counts[tab.value]}</span>
              </span>
            </Link>
          );
        })}
      </RovingTablist>
    </div>
  );
}
