"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Book, Contents, Location, NavItem, Rendition } from "epubjs";
import type Section from "epubjs/types/section";
import { toast } from "sonner";

import { saveProgressAction, startReadingAction } from "@/app/books/[id]/read/actions";
import { HIGHLIGHT_BG } from "@/components/reader/pdf-page";
import { FinishBanner, isTypingTarget, ReaderOpenError, toggleFullscreen } from "@/components/reader/reader-common";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { focusSearchInput, SearchPanel } from "@/components/reader/search-panel";
import { SelectionPopover } from "@/components/reader/selection-popover";
import { SidePanel, type PanelTab, type TocItem } from "@/components/reader/side-panel";
import type { ReaderData } from "@/components/reader/types";
import { useProgressSaver, type ProgressPayload } from "@/components/reader/use-progress-saver";
import { useFinishBook, useReaderAnnotations } from "@/components/reader/use-reader-annotations";
import { ERROR_TOAST } from "@/lib/constants";
import { clampZoom, wrapIndex, type HighlightColor, type PageTheme, type SearchHit, type ViewMode } from "@/lib/reading";

const DEFAULT_TEXT_SIZE = 1;
const LOCATION_CHARS = 1600;
const MAX_SEARCH_HITS = 200;

/** Page colours inside the book's iframe (the PDF reader inverts/tints its canvas instead). */
const THEME_COLORS: Record<PageTheme, { bg: string; fg: string }> = {
  light: { bg: "#ffffff", fg: "#1c1917" },
  sepia: { bg: "#f4ecd8", fg: "#5b4636" },
  dark: { bg: "#1c1c1e", fg: "#e7e5e4" },
};

type CfiClass = (typeof import("epubjs"))["EpubCFI"];
type Span = { start: string; end: string };
interface RenditionHandlers {
  relocated: (loc: Location) => void;
  selected: (cfiRange: string, contents: Contents) => void;
  key: (e: KeyboardEvent) => void;
  pointerDown: () => void;
}

function flattenToc(items: NavItem[], depth = 0, out: TocItem[] = []): TocItem[] {
  for (const item of items) {
    out.push({ title: item.label.trim(), href: item.href, depth });
    if (item.subitems?.length) flattenToc(item.subitems, depth + 1, out);
  }
  return out;
}

/** "OEBPS/ch1.xhtml#x" and "ch1.xhtml" name the same file: compare without fragment and folders. */
function sameFile(a: string, b: string): boolean {
  const norm = (h: string) => decodeURIComponent(h.split("#")[0]).split("/").pop() ?? "";
  return norm(a) !== "" && norm(a) === norm(b);
}

export function EpubReader({ data }: { data: ReaderData }) {
  const { bookId, progress } = data;
  const backHref = `/books/${bookId}`;

  const [book, setBook] = useState<Book | null>(null);
  const [Cfi, setCfi] = useState<CfiClass | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [error, setError] = useState<"open" | null>(null);
  const [initial] = useState(() => ({
    location: progress?.location ?? null,
    percent: progress?.percent ?? 0,
    zoom: clampZoom(progress?.zoom ?? DEFAULT_TEXT_SIZE),
    viewMode: (progress?.viewMode ?? "page") as ViewMode,
    pageTheme: (progress?.pageTheme ?? "light") as PageTheme,
  }));
  const [span, setSpan] = useState<Span | null>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const [sectionHref, setSectionHref] = useState<string | null>(null);
  const [locationsReady, setLocationsReady] = useState(false);
  const [zoom, setZoom] = useState(initial.zoom);
  const [viewMode, setViewMode] = useState<ViewMode>(initial.viewMode);
  const [pageTheme, setPageTheme] = useState<PageTheme>(initial.pageTheme);
  const { status, markFinished } = useFinishBook(bookId, data.status);
  const [toc, setToc] = useState<TocItem[]>([]);
  const { bookmarks, highlights, toggleBookmark: toggleBookmarkAt, removeBookmark, addHighlight, updateHighlight, removeHighlight } =
    useReaderAnnotations(bookId, data);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("contents");
  const [pending, setPending] = useState<{ cfiRange: string; text: string; anchor: { x: number; y: number }; contents: Contents } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; hits: SearchHit[]; cfis: string[] } | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ done: number; total: number } | null>(null);
  const [hitIndex, setHitIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  /** The location to show when a rendition is (re)created: the resume point, then the current position. */
  const locationRef = useRef<string | null>(initial.location);
  /** Opened position: recorded on the first relocation without saving, so opening never rewrites it. */
  const lastSavedKey = useRef<string | null>(null);
  const shownHighlights = useRef(new Map<string, string>());

  // Open the book. The file is fetched here so a failure surfaces as a rejection (epub.js only emits an event).
  useEffect(() => {
    let cancelled = false;
    let opened: Book | null = null;
    (async () => {
      try {
        const epub = await import("epubjs");
        const res = await fetch(data.fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        if (cancelled) return;
        const b = epub.default();
        opened = b;
        await b.open(bytes, "binary");
        await b.ready;
        const nav = await b.loaded.navigation;
        let sections = 0;
        b.spine.each(() => sections++);
        if (sections === 0) throw new Error("empty book");
        if (cancelled) return;
        setToc(flattenToc(nav.toc));
        setCfi(() => epub.EpubCFI);
        setBook(b);
        // Only a file that opened counts as reading (stamps lastReadAt, Want to read -> Reading).
        if (!started.current) {
          started.current = true;
          void startReadingAction({ id: bookId });
        }
      } catch {
        if (!cancelled) setError("open");
      }
    })();
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [data.fileUrl, bookId]);

  // Percentages need the location list, which can take a while on a big book: build it after first paint.
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    const t = setTimeout(() => {
      book.locations
        .generate(LOCATION_CHARS)
        .then(() => {
          if (!cancelled) setLocationsReady(true);
        })
        .catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [book]);

  // Latest handlers for the rendition's events (the rendition outlives renders).
  const handlers = useRef<RenditionHandlers>({ relocated: () => {}, selected: () => {}, key: () => {}, pointerDown: () => {} });

  // Render. Recreated when the flow changes (paginated vs scrolled), resuming at the current position.
  useEffect(() => {
    const el = containerRef.current;
    if (!book || !el) return;
    const r = book.renderTo(el, {
      width: "100%",
      height: "100%",
      flow: viewMode === "scroll" ? "scrolled-doc" : "paginated",
      spread: "none",
      manager: "default",
    });
    shownHighlights.current = new Map();
    r.on("relocated", (loc: Location) => handlers.current.relocated(loc));
    r.on("selected", (cfiRange: string, contents: Contents) => handlers.current.selected(cfiRange, contents));
    // Key presses inside the book's iframe never reach window.
    r.on("keydown", (e: KeyboardEvent) => handlers.current.key(e));
    r.on("mousedown", () => handlers.current.pointerDown());
    setRendition(r);
    const target = locationRef.current;
    const shown = target ? r.display(target).catch(() => r.display()) : r.display();
    shown.catch(() => setError("open"));
    return () => {
      setRendition(null);
      r.destroy();
    };
  }, [book, viewMode]);

  // Theme and text size apply inside the iframe.
  useEffect(() => {
    if (!rendition) return;
    const { bg, fg } = THEME_COLORS[pageTheme];
    rendition.themes.override("color", fg, true);
    rendition.themes.override("background", bg, true);
    rendition.themes.fontSize(`${Math.round(zoom * 100)}%`);
  }, [rendition, pageTheme, zoom]);

  // Saved highlights are drawn by epub.js (it re-applies them whenever a chapter is shown).
  useEffect(() => {
    if (!rendition) return;
    const shown = shownHighlights.current;
    const wanted = new Map(highlights.filter((h) => h.cfiRange).map((h) => [h.cfiRange as string, h.color]));
    for (const [cfi, color] of shown) {
      if (wanted.get(cfi) !== color) {
        rendition.annotations.remove(cfi, "highlight");
        shown.delete(cfi);
      }
    }
    for (const [cfi, color] of wanted) {
      if (shown.has(cfi)) continue;
      rendition.annotations.highlight(cfi, {}, undefined, "hl", { fill: HIGHLIGHT_BG[color] ?? HIGHLIGHT_BG.yellow, "fill-opacity": "0.4", "mix-blend-mode": "multiply" });
      shown.set(cfi, color);
    }
  }, [rendition, highlights]);

  const percent = useMemo(() => {
    if (!book || !locationsReady || !span) return null;
    const p = book.locations.percentageFromCfi(span.start);
    return typeof p === "number" && Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p * 100))) : null;
  }, [book, locationsReady, span]);

  // Debounced progress saving, on change only (the opened position is not re-saved).
  const save = useCallback((p: ProgressPayload) => saveProgressAction({ id: bookId, ...p }), [bookId]);
  const { schedule, flush } = useProgressSaver(save);
  const savedPercent = percent ?? initial.percent;
  useEffect(() => {
    if (!span) return;
    const key = JSON.stringify([span.start, savedPercent, zoom, viewMode, pageTheme]);
    // The first relocation is the opened position (the resume point, or the start of a new book): not progress.
    if (lastSavedKey.current === null || key === lastSavedKey.current) {
      lastSavedKey.current = key;
      return;
    }
    lastSavedKey.current = key;
    schedule({ location: span.start, percent: savedPercent, zoom, viewMode, pageTheme });
  }, [span, savedPercent, zoom, viewMode, pageTheme, schedule]);

  const cfiCompare = useCallback(
    (a: string, b: string) => {
      if (!Cfi) return 0;
      try {
        return new Cfi().compare(a, b);
      } catch {
        return 0;
      }
    },
    [Cfi],
  );

  const chapterTitle = useCallback(
    (href: string | null | undefined) => (href ? toc.find((t) => sameFile(t.href, href))?.title : undefined),
    [toc],
  );

  const goTo = useCallback(
    (target: string) => {
      if (!rendition) return;
      void rendition.display(target).catch(() => toast.error(ERROR_TOAST));
    },
    [rendition],
  );
  const next = useCallback(() => void rendition?.next(), [rendition]);
  const prev = useCallback(() => void rendition?.prev(), [rendition]);

  // Search: load each chapter in turn, find the query, unload it again.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!book || !searchOpen || q === "") return;
    let cancelled = false;
    (async () => {
      const sections: Section[] = [];
      book.spine.each((s: Section) => sections.push(s));
      const hits: SearchHit[] = [];
      const cfis: string[] = [];
      for (let i = 0; i < sections.length && hits.length < MAX_SEARCH_HITS; i++) {
        if (cancelled) return;
        setSearchProgress({ done: i, total: sections.length });
        const s = sections[i];
        try {
          await s.load(book.load.bind(book));
          const found = s.find(q) as unknown as { cfi: string; excerpt: string }[];
          found.slice(0, MAX_SEARCH_HITS - hits.length).forEach((f, j) => {
            hits.push({ page: i + 1, snippet: f.excerpt.replace(/\s+/g, " ").trim(), index: j });
            cfis.push(f.cfi);
          });
        } catch {
          /* an unreadable chapter has no hits */
        } finally {
          s.unload();
        }
      }
      if (cancelled) return;
      setSearchProgress(null);
      setSearch({ query: q, hits, cfis });
      setHitIndex(0);
      if (cfis.length > 0) goTo(cfis[0]);
    })();
    return () => {
      cancelled = true;
    };
    // goTo changes with the rendition; a new rendition must not re-run the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, searchOpen, debouncedQuery]);

  const current = search && search.query === debouncedQuery.trim() ? search : null;
  const hits = current?.hits ?? [];
  const searchPending = query !== debouncedQuery || (debouncedQuery.trim() !== "" && current === null);
  const sectionTitles = useMemo(() => {
    const titles: string[] = [];
    book?.spine.each((s: Section) => titles.push(chapterTitle(s.href) ?? `Chapter ${s.index + 1}`));
    return titles;
  }, [book, chapterTitle]);

  const pickHit = useCallback(
    (i: number) => {
      if (!current || current.hits.length === 0) return;
      const index = wrapIndex(i, 0, current.hits.length);
      setHitIndex(index);
      goTo(current.cfis[index]);
    },
    [current, goTo],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setSearch(null);
    setSearchProgress(null);
  }, []);
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    focusSearchInput();
  }, []);
  const toggleSearch = useCallback(() => {
    if (searchOpen) closeSearch();
    else openSearch();
  }, [searchOpen, openSearch, closeSearch]);

  // Bookmarks: one is current when its CFI falls on the page on screen.
  const onPage = useCallback((cfi: string) => span !== null && cfiCompare(span.start, cfi) <= 0 && cfiCompare(cfi, span.end) <= 0, [span, cfiCompare]);
  const currentBookmark = bookmarks.find((b) => onPage(b.location));
  const toggleBookmark = useCallback(async () => {
    if (!span) return;
    await toggleBookmarkAt(currentBookmark, span.start, chapterTitle(sectionHref));
  }, [toggleBookmarkAt, span, currentBookmark, chapterTitle, sectionHref]);

  const createHighlight = useCallback(
    async (color: HighlightColor, note: string) => {
      if (!pending) return;
      const p = pending;
      setPending(null);
      await addHighlight({ page: null, rects: [], cfiRange: p.cfiRange, text: p.text }, color, note, () =>
        p.contents.window?.getSelection()?.removeAllRanges(),
      );
    },
    [pending, addHighlight],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault(); // keep the "/" out of the search box it opens
        openSearch();
      } else if (e.key === "Escape") {
        if (pending) setPending(null);
        else if (searchOpen) closeSearch();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if ((e.key === "b" || e.key === "B") && !e.shiftKey) {
        e.preventDefault();
        void toggleBookmark();
      }
    },
    [openSearch, closeSearch, searchOpen, pending, next, prev, toggleBookmark],
  );

  useEffect(() => {
    handlers.current = {
      relocated: (loc) => {
        setSpan({ start: loc.start.cfi, end: loc.end.cfi });
        setEdges({ atStart: loc.atStart === true, atEnd: loc.atEnd === true });
        setSectionHref(loc.start.href ?? null);
        locationRef.current = loc.start.cfi;
        setPending(null);
      },
      selected: (cfiRange, contents) => {
        try {
          const range = contents.range(cfiRange);
          const text = range.toString().replace(/\s+/g, " ").trim().slice(0, 2000);
          const frame = contents.window?.frameElement;
          const r = range.getClientRects()[0] ?? range.getBoundingClientRect();
          if (!text || !frame || !r) return;
          const box = frame.getBoundingClientRect();
          setPending({ cfiRange, text, contents, anchor: { x: box.left + r.left + r.width / 2, y: box.top + r.top } });
        } catch {
          setPending(null);
        }
      },
      key: onKey,
      pointerDown: () => setPending(null),
    };
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const changeZoom = useCallback((z: number) => setZoom(clampZoom(z)), []);
  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);
  const closePopover = useCallback(() => setPending(null), []);

  const byCfi = useCallback(<T,>(items: T[], cfiOf: (t: T) => string | null) => {
    return [...items].sort((a, b) => {
      const ca = cfiOf(a);
      const cb = cfiOf(b);
      return ca && cb ? cfiCompare(ca, cb) : 0;
    });
  }, [cfiCompare]);
  const sortedBookmarks = useMemo(() => byCfi(bookmarks, (b) => b.location), [byCfi, bookmarks]);
  const sortedHighlights = useMemo(() => byCfi(highlights, (h) => h.cfiRange), [byCfi, highlights]);

  if (error) return <ReaderOpenError backHref={backHref} />;

  const colors = THEME_COLORS[pageTheme];
  const showFinish = span !== null && edges.atEnd && status !== "finished";

  return (
    <>
      <ReaderToolbar
        variant="epub"
        percent={percent}
        ready={span !== null}
        atStart={edges.atStart}
        atEnd={edges.atEnd}
        onPrev={prev}
        onNext={next}
        zoom={zoom}
        onZoom={changeZoom}
        viewMode={viewMode}
        onViewMode={setViewMode}
        theme={pageTheme}
        onTheme={setPageTheme}
        onToggleFullscreen={toggleFullscreen}
        onToggleSidebar={togglePanel}
        onToggleSearch={toggleSearch}
        bookmarked={currentBookmark !== undefined}
        onToggleBookmark={() => void toggleBookmark()}
        backHref={backHref}
        // Queue the pending save ahead of the navigation, which reads progress for the detail page.
        onBack={flush}
        title={data.title}
      />
      {searchOpen ? (
        <SearchPanel
          query={query}
          onQuery={setQuery}
          hits={searchPending ? [] : hits}
          current={hitIndex}
          onPrev={() => pickHit(wrapIndex(hitIndex, -1, hits.length))}
          onNext={() => pickHit(wrapIndex(hitIndex, 1, hits.length))}
          onPick={pickHit}
          onClose={closeSearch}
          loading={searchProgress}
          noText={false}
          pending={searchPending && searchProgress === null}
          hitLabel={(h) => sectionTitles[h.page - 1] ?? `Chapter ${h.page}`}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        {/* epub.js sizes itself from its container, which therefore needs a definite size. */}
        <div className="relative min-h-0 min-w-0 flex-1" style={{ background: colors.bg }}>
          <div ref={containerRef} className="absolute inset-x-2 inset-y-3 mx-auto max-w-3xl sm:inset-x-8" />
          {span === null ? <p className="absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">Opening…</p> : null}
        </div>
        {panelOpen ? (
          <SidePanel
            variant="epub"
            tab={panelTab}
            onTab={setPanelTab}
            bookmarks={sortedBookmarks}
            highlights={sortedHighlights}
            outline={[]}
            toc={toc}
            currentPage={0}
            currentLocation={currentBookmark?.location ?? null}
            onGoToPage={() => {}}
            onGoToLocation={goTo}
            onRemoveBookmark={(id) => void removeBookmark(id)}
            onUpdateHighlight={(id, patch) => void updateHighlight(id, patch)}
            onRemoveHighlight={(id) => void removeHighlight(id)}
            noText={false}
            onClose={() => setPanelOpen(false)}
          />
        ) : null}
      </div>
      {pending ? (
        <SelectionPopover
          anchor={pending.anchor}
          onPick={(c) => void createHighlight(c, "")}
          onSaveNote={(c, note) => void createHighlight(c, note)}
          onClose={closePopover}
        />
      ) : null}
      {showFinish ? <FinishBanner message={"You've reached the end of the book."} onFinish={() => void markFinished()} /> : null}
    </>
  );
}
