"use client";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SearchHit } from "@/lib/reading";

interface SearchPanelProps {
  query: string;
  onQuery: (q: string) => void;
  hits: SearchHit[];
  current: number;
  onPrev: () => void;
  onNext: () => void;
  onPick: (i: number) => void;
  onClose: () => void;
  loading: { done: number; total: number } | null;
  noText: boolean;
  /** True while the typed query has not yet been applied (debounce). */
  pending: boolean;
  /** Where a hit is, before its snippet ("Page 3" for a PDF, the chapter title for an EPUB). */
  hitLabel?: (h: SearchHit) => string;
}

const pageLabel = (h: SearchHit) => `Page ${h.page}`;

export const SEARCH_INPUT_ID = "reader-search-input";

/** Focus the search box once the panel has rendered (used when opening search). */
export function focusSearchInput() {
  requestAnimationFrame(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
}

export function SearchPanel({ query, onQuery, hits, current, onPrev, onNext, onPick, onClose, loading, noText, pending, hitLabel = pageLabel }: SearchPanelProps) {
  const hasQuery = query.trim() !== "";
  let summary = "";
  if (loading) summary = `Searching… ${loading.done} of ${loading.total}`;
  else if (hasQuery && !pending && !noText) summary = hits.length === 0 ? "No results" : hits.length === 1 ? "1 result" : `${hits.length} results`;

  return (
    <div className="space-y-2 border-b bg-background px-3 py-2" role="search">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={SEARCH_INPUT_ID}
          type="search"
          aria-label="Search in book"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
          }}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base sm:h-9 sm:max-w-sm sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <p className="text-sm text-muted-foreground tabular-nums" role="status" aria-live="polite">
          {summary}
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Previous result" disabled={hits.length === 0} onClick={onPrev}>
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next result" disabled={hits.length === 0} onClick={onNext}>
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close search" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {noText ? (
        <p className="text-sm text-muted-foreground">There&apos;s no selectable text in this PDF, so search and highlights aren&apos;t available.</p>
      ) : null}
      {hits.length > 0 && !pending ? (
        <ul aria-label="Search results" className="max-h-40 space-y-1 overflow-auto">
          {hits.map((h, i) => (
            <li key={`${h.page}-${h.index}`}>
              <button
                type="button"
                aria-current={i === current ? "true" : undefined}
                onClick={() => onPick(i)}
                className={`w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${i === current ? "bg-muted font-medium" : ""}`}
              >
                {hitLabel(h)}: {h.snippet}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
