"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Maximize,
  MoveHorizontal,
  PanelLeft,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ZOOM_MAX, ZOOM_MIN, type PageTheme, type ViewMode } from "@/lib/reading";

interface ReaderToolbarProps {
  page: number;
  pageCount: number | null;
  onPage: (n: number) => void;
  zoom: number;
  onZoom: (z: number) => void;
  fitWidth: () => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  theme: PageTheme;
  onTheme: (t: PageTheme) => void;
  onToggleFullscreen: () => void;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  backHref: string;
  /** Runs before navigating back (the reader flushes pending progress so the detail page sees it). */
  onBack?: () => void;
  title: string;
}

const ZOOM_STEP = 0.25;

/** Page number field: edits a draft, commits on Enter or blur. Keyed by page so it resets on navigation. */
function PageInput({ page, pageCount, onPage }: { page: number; pageCount: number | null; onPage: (n: number) => void }) {
  const [draft, setDraft] = useState(String(page));
  function commit() {
    const n = Number(draft.trim());
    if (draft.trim() !== "" && Number.isFinite(n) && n !== page) onPage(n);
    else setDraft(String(page));
  }
  return (
    <input
      aria-label="Page"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(String(page));
        }
      }}
      disabled={pageCount === null}
      className="h-11 w-14 rounded-md border border-input bg-card px-2 text-center text-base tabular-nums sm:h-9 sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    />
  );
}

export function ReaderToolbar(props: ReaderToolbarProps) {
  const { page, pageCount, onPage, zoom, onZoom, viewMode, theme, bookmarked } = props;
  const round = (z: number) => Math.round(z * 100) / 100;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={props.backHref} aria-label="Back to book" onClick={props.onBack}>
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Button>
      <p className="min-w-0 max-w-[40ch] flex-1 truncate font-serif text-sm font-medium" title={props.title}>
        {props.title}
      </p>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={pageCount === null || page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <PageInput key={page} page={page} pageCount={pageCount} onPage={onPage} />
        <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">of {pageCount ?? "…"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={pageCount === null || page >= pageCount} onClick={() => onPage(page + 1)}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => onZoom(round(zoom - ZOOM_STEP))}>
          <ZoomOut aria-hidden="true" />
        </Button>
        <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => onZoom(round(zoom + ZOOM_STEP))}>
          <ZoomIn aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" onClick={props.fitWidth}>
          <MoveHorizontal aria-hidden="true" />
          Fit width
        </Button>
      </div>

      <NativeSelect aria-label="View mode" value={viewMode} onChange={(e) => props.onViewMode(e.target.value as ViewMode)} wrapperClassName="w-28">
        <option value="page">Page</option>
        <option value="scroll">Scroll</option>
      </NativeSelect>
      <NativeSelect aria-label="Page theme" value={theme} onChange={(e) => props.onTheme(e.target.value as PageTheme)} wrapperClassName="w-28">
        <option value="light">Light</option>
        <option value="sepia">Sepia</option>
        <option value="dark">Dark</option>
      </NativeSelect>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"} aria-pressed={bookmarked} onClick={props.onToggleBookmark}>
          {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Search in book" onClick={props.onToggleSearch}>
          <Search aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle side panel" onClick={props.onToggleSidebar}>
          <PanelLeft aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle fullscreen" onClick={props.onToggleFullscreen}>
          <Maximize aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
