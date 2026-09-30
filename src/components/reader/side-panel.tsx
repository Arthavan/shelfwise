"use client";
import { useState } from "react";
import { Trash2, X } from "lucide-react";

import { RovingTablist } from "@/components/books/roving-tablist";
import type { OutlineItem } from "@/components/reader/outline";
import { HIGHLIGHT_BG } from "@/components/reader/pdf-page";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { HIGHLIGHT_COLORS } from "@/lib/reading";
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
  onUpdateHighlight: (id: string, patch: { note?: string | null; color?: string }) => void;
  onRemoveHighlight: (id: string) => void;
  noText: boolean;
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
  onUpdateHighlight,
  onRemoveHighlight,
  noText,
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
          <HighlightsList
            highlights={highlights}
            noText={noText}
            onGoToPage={onGoToPage}
            onUpdate={onUpdateHighlight}
            onRemove={onRemoveHighlight}
          />
        )}
      </div>
    </aside>
  );
}

function HighlightsList({
  highlights,
  noText,
  onGoToPage,
  onUpdate,
  onRemove,
}: {
  highlights: HighlightInfo[];
  noText: boolean;
  onGoToPage: (n: number) => void;
  onUpdate: SidePanelProps["onUpdateHighlight"];
  onRemove: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return (
      <p className="p-2 text-sm text-muted-foreground">
        {noText
          ? "There’s no selectable text in this PDF, so search and highlights aren’t available."
          : "No highlights yet. Select text on a page to add one."}
      </p>
    );
  }
  const sorted = [...highlights].sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());
  return (
    <ul className="space-y-3">
      {sorted.map((h) => (
        <HighlightItem key={h.id} h={h} onGoToPage={onGoToPage} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function HighlightItem({
  h,
  onGoToPage,
  onUpdate,
  onRemove,
}: {
  h: HighlightInfo;
  onGoToPage: (n: number) => void;
  onUpdate: SidePanelProps["onUpdateHighlight"];
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(h.note ?? "");
  const saveNote = () => {
    const next = note.trim();
    if (next !== (h.note ?? "")) onUpdate(h.id, { note: next === "" ? null : next });
  };
  return (
    <li className="space-y-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-black/20" style={{ background: HIGHLIGHT_BG[h.color] ?? HIGHLIGHT_BG.yellow }} />
        <span className="flex-1 text-xs font-medium text-muted-foreground">Page {h.page ?? "?"}</span>
        <NativeSelect
          aria-label="Highlight colour"
          value={h.color}
          onChange={(e) => onUpdate(h.id, { color: e.target.value })}
          wrapperClassName="w-24"
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </NativeSelect>
        <Button variant="ghost" size="icon-sm" aria-label="Delete highlight" onClick={() => onRemove(h.id)}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <button
        type="button"
        disabled={h.page === null}
        onClick={() => h.page !== null && onGoToPage(h.page)}
        className="line-clamp-3 w-full rounded-md px-1 py-1 text-left text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {h.text}
      </button>
      <textarea
        aria-label="Note"
        placeholder="Add note"
        value={note}
        maxLength={2000}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        className="w-full rounded-md border bg-background p-2 text-sm"
      />
    </li>
  );
}
