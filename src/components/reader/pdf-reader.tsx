"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";

import { addBookmarkAction, removeBookmarkAction, saveProgressAction, startReadingAction } from "@/app/books/[id]/read/actions";
import { updateBookStatus } from "@/app/books/status-actions";
import { pdfOutlineToItems, type OutlineItem } from "@/components/reader/outline";
import { getAllPageTexts } from "@/components/reader/page-text";
import { PdfPage } from "@/components/reader/pdf-page";
import { loadPdf } from "@/components/reader/pdf-loader";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { SEARCH_INPUT_ID, SearchPanel } from "@/components/reader/search-panel";
import { SidePanel, type PanelTab } from "@/components/reader/side-panel";
import type { ReaderData } from "@/components/reader/types";
import { useProgressSaver, type ProgressPayload } from "@/components/reader/use-progress-saver";
import { Button } from "@/components/ui/button";
import { ERROR_TOAST, STATUS_TOASTS } from "@/lib/constants";
import { clampPage, clampZoom, percentFor, searchPages, wrapIndex, type PageTheme, type ViewMode } from "@/lib/reading";
import type { SearchHit } from "@/lib/reading";
import type { BookmarkInfo, BookStatus, HighlightInfo } from "@/lib/types";

const DEFAULT_ZOOM = 1.25;
const OPEN_ERROR = "Shelfwise couldn't open this file. It may be damaged or password-protected.";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Scroll-mode placeholder: reserves the estimated height and mounts the page once near the viewport. */
function LazyPage({
  pageNumber,
  minHeight,
  root,
  children,
}: {
  pageNumber: number;
  minHeight: number;
  root: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: root.current, rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, visible]);
  return (
    <div ref={ref} data-page-slot={pageNumber} className="flex justify-center" style={{ minHeight }}>
      {visible ? children : null}
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
  const [status, setStatus] = useState<BookStatus>(data.status);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkInfo[]>(data.bookmarks);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("contents");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  // Held now; highlights are wired up in Task 9.
  const [highlights] = useState<HighlightInfo[]>(data.highlights);
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
    if (!pdf || !searchOpen || pageTexts) return;
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
  }, [pdf, searchOpen, pageTexts]);

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
    requestAnimationFrame(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const toggleSearch = useCallback(() => {
    if (searchOpen) closeSearch();
    else openSearch();
  }, [searchOpen, openSearch, closeSearch]);

  const currentBookmark = bookmarks.find((b) => b.location === String(page));
  const toggleBookmark = useCallback(async () => {
    if (currentBookmark) {
      const removed = currentBookmark;
      setBookmarks((prev) => prev.filter((b) => b.id !== removed.id));
      const res = await removeBookmarkAction({ id: bookId, bookmarkId: removed.id });
      if (!res.ok) {
        setBookmarks((prev) => (prev.some((b) => b.id === removed.id) ? prev : [...prev, removed]));
        toast.error(ERROR_TOAST);
      }
      return;
    }
    const res = await addBookmarkAction({ id: bookId, location: String(page) });
    if (res.ok) setBookmarks((prev) => (prev.some((b) => b.id === res.data.id) ? prev : [...prev, res.data]));
    else toast.error(ERROR_TOAST);
  }, [bookId, page, currentBookmark]);
  useEffect(() => {
    toggleBookmarkRef.current = toggleBookmark;
  });

  const removeBookmark = useCallback(
    async (bookmarkId: string) => {
      const removed = bookmarks.find((b) => b.id === bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      const res = await removeBookmarkAction({ id: bookId, bookmarkId });
      if (!res.ok) {
        if (removed) setBookmarks((prev) => [...prev, removed]);
        toast.error(ERROR_TOAST);
      }
    },
    [bookId, bookmarks],
  );

  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);

  async function markFinished() {
    const res = await updateBookStatus({ id: bookId, status: "finished" });
    if (res.ok) {
      setStatus("finished");
      toast.success(STATUS_TOASTS.finished);
    } else {
      toast.error(res.error);
    }
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div role="alert" className="max-w-md space-y-4 text-center">
          <p className="text-base">{OPEN_ERROR}</p>
          <p className="text-sm text-muted-foreground">You can replace the file from the book page.</p>
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft aria-hidden="true" />
              Back to book
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
      <div ref={containerRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/60 px-4 py-6">
        {!pdf ? (
          <p className="text-center text-sm text-muted-foreground">Opening…</p>
        ) : viewMode === "page" ? (
          <PdfPage pdf={pdf} pageNumber={page} scale={zoom} theme={pageTheme} highlights={pageHighlights(page)} searchQuery={searchOpen ? debouncedQuery : ""} />
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
              <LazyPage key={n} pageNumber={n} minHeight={(baseSize?.h ?? 792) * zoom} root={containerRef}>
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
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
      </div>
      {showFinish ? (
        <div className="flex items-center justify-center gap-3 border-t bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">You&apos;ve reached the last page.</p>
          <Button size="sm" onClick={() => void markFinished()}>
            <CircleCheck aria-hidden="true" />
            Mark as finished
          </Button>
        </div>
      ) : null}
    </>
  );
}
