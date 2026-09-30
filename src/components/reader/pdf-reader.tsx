"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";

import { saveProgressAction, startReadingAction } from "@/app/books/[id]/read/actions";
import { pdfOutlineToItems, type OutlineItem } from "@/components/reader/outline";
import { getAllPageTexts } from "@/components/reader/page-text";
import { PdfPage } from "@/components/reader/pdf-page";
import { FinishBanner, isTypingTarget, ReaderOpenError, toggleFullscreen } from "@/components/reader/reader-common";
import { loadPdf } from "@/components/reader/pdf-loader";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { focusSearchInput, SearchPanel } from "@/components/reader/search-panel";
import { selectionToHighlight } from "@/components/reader/selection";
import { SelectionPopover } from "@/components/reader/selection-popover";
import { SidePanel, type PanelTab } from "@/components/reader/side-panel";
import type { ReaderData } from "@/components/reader/types";
import { useProgressSaver, type ProgressPayload } from "@/components/reader/use-progress-saver";
import { useFinishBook, useReaderAnnotations } from "@/components/reader/use-reader-annotations";
import { ERROR_TOAST } from "@/lib/constants";
import { clampPage, clampZoom, percentFor, searchPages, wrapIndex, type HighlightColor, type PageTheme, type Rect, type ViewMode } from "@/lib/reading";
import type { SearchHit } from "@/lib/reading";

const DEFAULT_ZOOM = 1.25;

/**
 * Scroll-mode slot: mounts its page while it is within a few screens of the viewport and unmounts it
 * again when it scrolls far away, so long documents keep only nearby pages (and canvases) in memory.
 * The slot keeps the page's last rendered height (or the estimate) so the scroll height stays stable.
 */
function LazyPage({
  pageNumber,
  estimatedHeight,
  scale,
  root,
  children,
}: {
  pageNumber: number;
  estimatedHeight: number;
  scale: number;
  root: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // Height at scale 1 measured while mounted, so an unmounted slot keeps the real size at any zoom.
  const [unitHeight, setUnitHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry.isIntersecting) {
          const h = el.getBoundingClientRect().height;
          if (h > 0) setUnitHeight(h / scale);
        }
        setNear(entry.isIntersecting);
      },
      // Mount within two screens above or below; unmount beyond that.
      { root: root.current, rootMargin: "200% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, scale]);
  const minHeight = unitHeight !== null ? unitHeight * scale : estimatedHeight;
  return (
    <div ref={ref} data-page-slot={pageNumber} className="flex justify-center" style={{ minHeight }}>
      {near ? children : null}
    </div>
  );
}

export function PdfReader({ data }: { data: ReaderData }) {
  const { bookId, progress } = data;
  const backHref = `/books/${bookId}`;

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<"open" | null>(null);
  // The position as opened (re-clamped once the real page count is known).
  const [initial] = useState(() => ({
    page: clampPage(Number(progress?.location ?? 1), data.pageCount ?? Infinity),
    zoom: clampZoom(progress?.zoom ?? DEFAULT_ZOOM),
    viewMode: (progress?.viewMode ?? "page") as ViewMode,
    pageTheme: (progress?.pageTheme ?? "light") as PageTheme,
  }));
  const [page, setPage] = useState(initial.page);
  const [zoom, setZoom] = useState(initial.zoom);
  const [viewMode, setViewMode] = useState<ViewMode>(initial.viewMode);
  const [pageTheme, setPageTheme] = useState<PageTheme>(initial.pageTheme);
  const { status, markFinished } = useFinishBook(bookId, data.status);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);
  const { bookmarks, highlights, toggleBookmark: toggleBookmarkAt, removeBookmark, addHighlight, updateHighlight, removeHighlight } =
    useReaderAnnotations(bookId, data);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("contents");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [pending, setPending] = useState<{ page: number; rects: Rect[]; text: string; anchor: { x: number; y: number } } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ done: number; total: number } | null>(null);
  const [pick, setPick] = useState<{ hits: SearchHit[]; index: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  /** Page to scroll to in scroll mode (set by user navigation, mode switch and zoom; not by scrolling). */
  const pendingScroll = useRef<number | null>(initial.page); // resuming in scroll mode scrolls to the saved page
  const started = useRef(false);
  const settleUntil = useRef(0);
  // Seeded from the raw stored location (not the clamped page) so a stored page past the end is corrected on save.
  const lastSavedKey = useRef(JSON.stringify([Number(progress?.location ?? 1), initial.zoom, initial.viewMode, initial.pageTheme]));

  const numPages = pdf?.numPages ?? null;
  // Known from the upload before the document loads, so navigation works immediately; the real count wins.
  const pageCount = numPages ?? data.pageCount;

  // Open the document.
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    loadPdf(data.fileUrl)
      .then(async (d) => {
        doc = d;
        if (cancelled) {
          void d.loadingTask.destroy();
          return;
        }
        if (d.numPages < 1) throw new Error("empty document");
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBaseSize({ w: vp.width, h: vp.height });
        setPage((p) => clampPage(p, d.numPages));
        setPdf(d);
        // Only a file that opened counts as reading (stamps lastReadAt, Want to read -> Reading).
        if (!started.current) {
          started.current = true;
          void startReadingAction({ id: bookId });
        }
      })
      .catch(() => {
        // Damaged, truncated or password-protected (PasswordException): same message.
        if (!cancelled) setError("open");
      });
    return () => {
      cancelled = true;
      if (doc) void doc.loadingTask.destroy();
    };
  }, [data.fileUrl, bookId]);

  // Table of contents.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    pdfOutlineToItems(pdf)
      .then((items) => {
        if (!cancelled) setOutline(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // Search: extract every page's text once, on first open (cached per document).
  useEffect(() => {
    if (!pdf || !(searchOpen || (panelOpen && panelTab === "highlights")) || pageTexts) return;
    let cancelled = false;
    getAllPageTexts(pdf, (done, total) => {
      if (!cancelled) setSearchProgress({ done, total });
    })
      .then((texts) => {
        if (cancelled) return;
        setPageTexts(texts);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(ERROR_TOAST);
      });
    return () => {
      cancelled = true;
    };
  }, [pdf, searchOpen, panelOpen, panelTab, pageTexts]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const hits = useMemo(() => (pageTexts ? searchPages(pageTexts, debouncedQuery) : []), [pageTexts, debouncedQuery]);
  const hitIndex = pick && pick.hits === hits ? pick.index : 0;
  const noText = pageTexts !== null && pageTexts.every((t) => t === "");
  const searching = pdf !== null && searchOpen && !pageTexts;
  const searchLoading = searching ? (searchProgress ?? { done: 0, total: pdf.numPages }) : null;
  const searchPending = query !== debouncedQuery;

  // Debounced progress saving. Positions equal to the last known one (initially the one we opened at)
  // are not re-saved, so opening a book does not rewrite an identical position.
  const save = useCallback((p: ProgressPayload) => saveProgressAction({ id: bookId, ...p }), [bookId]);
  const { schedule, flush } = useProgressSaver(save);
  useEffect(() => {
    if (!pdf) return;
    const key = JSON.stringify([page, zoom, viewMode, pageTheme]);
    if (key === lastSavedKey.current) return;
    lastSavedKey.current = key;
    schedule({ location: String(page), percent: percentFor(page, pdf.numPages), zoom, viewMode, pageTheme });
  }, [page, zoom, viewMode, pageTheme, pdf, schedule]);

  const toggleBookmarkRef = useRef<() => Promise<void>>(async () => {});

  const goTo = useCallback(
    (n: number) => {
      if (pageCount === null) return;
      const next = clampPage(n, pageCount);
      pendingScroll.current = next;
      setPage(next);
    },
    [pageCount],
  );

  // A fresh result set jumps to its first hit.
  const firstHitPage = hits.length > 0 ? hits[0].page : null;
  useEffect(() => {
    if (!searchOpen || firstHitPage === null) return;
    const t = setTimeout(() => goTo(firstHitPage), 0);
    return () => clearTimeout(t);
  }, [hits, searchOpen, firstHitPage, goTo]);

  const pickHit = useCallback(
    (i: number) => {
      if (hits.length === 0) return;
      const index = wrapIndex(i, 0, hits.length);
      setPick({ hits, index });
      goTo(hits[index].page);
    },
    [hits, goTo],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    focusSearchInput();
  }, []);

  // Page mode: back to the top of the page on navigation. Scroll mode: bring the requested page into view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pdf) return;
    if (viewMode === "page") {
      el.scrollTop = 0;
      pendingScroll.current = null;
      return;
    }
    const target = pendingScroll.current;
    if (target === null) return;
    pendingScroll.current = null;
    settleUntil.current = Date.now() + 500; // the scroll events this causes must not re-pick the page
    el.querySelector(`[data-page-slot="${target}"]`)?.scrollIntoView({ block: "start" });
  }, [page, viewMode, zoom, pdf]);

  // Scroll mode: the current page is the one showing the most pixels.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !pdf || viewMode !== "scroll") return;
    const visiblePx = new Map<number, number>();
    const lastPage = pdf.numPages;
    function recompute() {
      // A programmatic jump (bookmark, contents, End) already chose the page; a short final viewport must not override it.
      if (Date.now() < settleUntil.current) return;
      // Scrolled to the very end: the last page is current even if a taller page above shows more pixels.
      const scrollable = root!.scrollHeight > root!.clientHeight + 1;
      if (scrollable && root!.scrollTop + root!.clientHeight >= root!.scrollHeight - 1) {
        setPage(lastPage);
        return;
      }
      let best = 0;
      let bestPx = 0;
      for (const [n, px] of visiblePx) {
        if (px > bestPx || (px === bestPx && px > 0 && n < best)) {
          best = n;
          bestPx = px;
        }
      }
      if (best > 0) setPage(best);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.pageSlot);
          visiblePx.set(n, e.isIntersecting ? e.intersectionRect.height : 0);
        }
        recompute();
      },
      { root, threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
    );
    root.querySelectorAll("[data-page-slot]").forEach((el) => io.observe(el));
    root.addEventListener("scroll", recompute, { passive: true });
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", recompute);
    };
  }, [pdf, viewMode]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault(); // keep the "/" out of the search box it opens
        openSearch();
        return;
      }
      if (e.key === "Escape" && searchOpen) {
        closeSearch();
        return;
      }
      if (pageCount === null) return;
      let target: number | null = null;
      if (e.key === "ArrowRight" || e.key === "PageDown") target = page + 1;
      else if (e.key === "ArrowLeft" || e.key === "PageUp") target = page - 1;
      else if (e.key === "Home") target = 1;
      else if (e.key === "End") target = pageCount;
      else if ((e.key === "b" || e.key === "B") && !e.shiftKey) {
        e.preventDefault();
        void toggleBookmarkRef.current();
        return;
      }
      if (target === null) return;
      e.preventDefault();
      goTo(target);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pageCount, goTo, searchOpen, openSearch, closeSearch]);

  const changeZoom = useCallback(
    (z: number) => {
      pendingScroll.current = page;
      setZoom(clampZoom(z));
    },
    [page],
  );

  const fitWidth = useCallback(() => {
    const el = containerRef.current;
    if (!el || !baseSize) return;
    changeZoom((el.clientWidth - 32) / baseSize.w);
  }, [baseSize, changeZoom]);

  const changeViewMode = useCallback(
    (m: ViewMode) => {
      pendingScroll.current = page;
      setViewMode(m);
    },
    [page],
  );

  const toggleSearch = useCallback(() => {
    if (searchOpen) closeSearch();
    else openSearch();
  }, [searchOpen, openSearch, closeSearch]);

  const currentBookmark = bookmarks.find((b) => b.location === String(page));
  const toggleBookmark = useCallback(() => toggleBookmarkAt(currentBookmark, String(page)), [toggleBookmarkAt, currentBookmark, page]);
  useEffect(() => {
    toggleBookmarkRef.current = toggleBookmark;
  });

  // Selection -> highlight popover. Only the page holding the start of the selection counts; on it, the
  // rects whose centre lies inside the page box are used (a selection spanning pages keeps its first page).
  const onSelectionEnd = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || noText) {
      setPending(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const startEl = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const pageEl = startEl?.closest<HTMLElement>("[data-page]");
    if (!pageEl) {
      setPending(null);
      return;
    }
    const box = pageEl.getBoundingClientRect();
    const rects = [...range.getClientRects()].filter((r) => {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return r.width > 0 && r.height > 0 && cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom;
    });
    const h = selectionToHighlight({ text: sel.toString(), rects, box });
    if (!h) {
      setPending(null);
      return;
    }
    const first = rects[0];
    setPending({ page: Number(pageEl.dataset.page), rects: h.rects, text: h.text, anchor: { x: first.left + first.width / 2, y: first.top } });
  }, [noText]);

  // Shift+arrow selection: re-read the selection after the keys that can extend it.
  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || !e.key.startsWith("Arrow") && e.key !== "Shift" && e.key !== "Home" && e.key !== "End") return;
      if (window.getSelection()?.isCollapsed === false) onSelectionEnd();
    }
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [onSelectionEnd]);

  const closePopover = useCallback(() => setPending(null), []);

  const createHighlight = useCallback(
    async (color: HighlightColor, note: string) => {
      if (!pending) return;
      const p = pending;
      setPending(null);
      await addHighlight({ page: p.page, rects: p.rects, text: p.text }, color, note, () => window.getSelection()?.removeAllRanges());
    },
    [pending, addHighlight],
  );

  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);

  if (error) return <ReaderOpenError backHref={backHref} />;

  const pageHighlights = (n: number) => highlights.filter((h) => h.page === n);
  const bookmarked = currentBookmark !== undefined;
  const showFinish = pdf !== null && page === pdf.numPages && status !== "finished";

  return (
    <>
      <ReaderToolbar
        page={page}
        pageCount={pageCount}
        onPage={goTo}
        zoom={zoom}
        onZoom={changeZoom}
        fitWidth={fitWidth}
        viewMode={viewMode}
        onViewMode={changeViewMode}
        theme={pageTheme}
        onTheme={setPageTheme}
        onToggleFullscreen={toggleFullscreen}
        onToggleSidebar={togglePanel}
        onToggleSearch={toggleSearch}
        bookmarked={bookmarked}
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
          loading={searchLoading}
          noText={noText}
          pending={searchPending}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
      <div ref={containerRef} onMouseUp={onSelectionEnd} className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/60 px-4 py-6">
        {!pdf ? (
          <p className="text-center text-sm text-muted-foreground">Opening…</p>
        ) : viewMode === "page" ? (
          <PdfPage pdf={pdf} pageNumber={page} scale={zoom} theme={pageTheme} highlights={pageHighlights(page)} searchQuery={searchOpen ? debouncedQuery : ""} />
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
              <LazyPage key={n} pageNumber={n} estimatedHeight={(baseSize?.h ?? 792) * zoom} scale={zoom} root={containerRef}>
                <PdfPage pdf={pdf} pageNumber={n} scale={zoom} theme={pageTheme} highlights={pageHighlights(n)} searchQuery={searchOpen ? debouncedQuery : ""} />
              </LazyPage>
            ))}
          </div>
        )}
      </div>
      {panelOpen ? (
        <SidePanel
          tab={panelTab}
          onTab={setPanelTab}
          bookmarks={bookmarks}
          highlights={highlights}
          outline={outline}
          currentPage={page}
          onGoToPage={goTo}
          onRemoveBookmark={(id) => void removeBookmark(id)}
          onUpdateHighlight={(id, patch) => void updateHighlight(id, patch)}
          onRemoveHighlight={(id) => void removeHighlight(id)}
          noText={noText}
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
      {showFinish ? <FinishBanner message={"You've reached the last page."} onFinish={() => void markFinished()} /> : null}
    </>
  );
}
