"use client";
import { X } from "lucide-react";

import { RovingTablist } from "@/components/books/roving-tablist";
import type { OutlineItem } from "@/components/reader/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BookmarkInfo, HighlightInfo } from "@/lib/types";

export type PanelTab = "contents" | "bookmarks" | "highlights";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "contents", label: "Contents" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "highlights", label: "Highlights" },
];

interface SidePanelProps {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  bookmarks: BookmarkInfo[];
  highlights: HighlightInfo[];
  outline: OutlineItem[];
  currentPage: number;
  onGoToPage: (n: number) => void;
  onRemoveBookmark: (id: string) => void;
  onClose: () => void;
}

export function SidePanel({
  tab,
  onTab,
  bookmarks,
  highlights,
  outline,
  currentPage,
  onGoToPage,
  onRemoveBookmark,
  onClose,
}: SidePanelProps) {
  const sorted = [...bookmarks].sort(
    (a, b) => Number(a.location) - Number(b.location),
  );
  return (
    <aside
      aria-label="Reader side panel"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[70vh] flex-col border-t bg-background shadow-lg md:static md:inset-auto md:max-h-none md:w-80 md:shrink-0 md:border-l md:border-t-0 md:shadow-none"
    >
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <RovingTablist aria-label="Side panel" className="flex flex-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`panel-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="reader-panel-body"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => onTab(t.id)}
              className={cn(
                "min-h-9 rounded-md px-2.5 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </RovingTablist>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close side panel"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div
        id="reader-panel-body"
        role="tabpanel"
        aria-labelledby={`panel-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {tab === "contents" ? (
          outline.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              This PDF has no table of contents
            </p>
          ) : (
            <ul>
              {outline.map((o, i) => (
                <li key={`${i}-${o.page}`}>
                  <button
                    type="button"
                    onClick={() => onGoToPage(o.page)}
                    style={{ paddingLeft: o.depth * 12 + 8 }}
                    className="w-full rounded-md py-2 pr-2 text-left text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {o.title}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : tab === "bookmarks" ? (
          sorted.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              No bookmarks yet. Press B to add one.
            </p>
          ) : (
            <ul>
              {sorted.map((b) => (
                <li key={b.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onGoToPage(Number(b.location))}
                    aria-current={
                      Number(b.location) === currentPage ? "true" : undefined
                    }
                    className="min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">Page {b.location}</span>
                    {b.label ? (
                      <span className="ml-2 text-muted-foreground">
                        {b.label}
                      </span>
                    ) : null}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove bookmark on page ${b.location}`}
                    onClick={() => onRemoveBookmark(b.id)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="p-2 text-sm text-muted-foreground">
            {highlights.length === 0
              ? "No highlights yet"
              : `${highlights.length} highlights`}
          </p>
        )}
      </div>
    </aside>
  );
}
