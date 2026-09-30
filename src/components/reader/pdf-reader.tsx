"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";

import { saveProgressAction, startReadingAction } from "@/app/books/[id]/read/actions";
import { updateBookStatus } from "@/app/books/status-actions";
import { PdfPage } from "@/components/reader/pdf-page";
import { loadPdf } from "@/components/reader/pdf-loader";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import type { ReaderData } from "@/components/reader/types";
import { useProgressSaver, type ProgressPayload } from "@/components/reader/use-progress-saver";
import { Button } from "@/components/ui/button";
import { STATUS_TOASTS } from "@/lib/constants";
import { clampPage, clampZoom, percentFor, type PageTheme, type ViewMode } from "@/lib/reading";
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
  // Held now; bookmarks, highlights and search are wired up in Tasks 7-9.
  const [bookmarks] = useState<BookmarkInfo[]>(data.bookmarks);
  const [highlights] = useState<HighlightInfo[]>(data.highlights);
  const [searchQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  /** Page to scroll to in scroll mode (set by user navigation, mode switch and zoom; not by scrolling). */
  const pendingScroll = useRef<number | null>(initial.page); // resuming in scroll mode scrolls to the saved page
  const started = useRef(false);
  const lastSavedKey = useRef(JSON.stringify([initial.page, initial.zoom, initial.viewMode, initial.pageTheme]));

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
      })
      .catch(() => {
        // Damaged, truncated or password-protected (PasswordException): same message.
        if (!cancelled) setError("open");
      });
    return () => {
      cancelled = true;
      if (doc) void doc.loadingTask.destroy();
    };
  }, [data.fileUrl]);

  // Opening the reader counts as reading: stamps lastReadAt, moves Want to read to Reading.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startReadingAction({ id: bookId });
  }, [bookId]);

  // Debounced progress saving. Positions equal to the last known one (initially the one we opened at)
  // are not re-saved, so opening a book does not rewrite an identical position.
  const save = useCallback((p: ProgressPayload) => saveProgressAction({ id: bookId, ...p }), [bookId]);
  const { schedule } = useProgressSaver(save);
  useEffect(() => {
    if (!pdf) return;
    const key = JSON.stringify([page, zoom, viewMode, pageTheme]);
    if (key === lastSavedKey.current) return;
    lastSavedKey.current = key;
    schedule({ location: String(page), percent: percentFor(page, pdf.numPages), zoom, viewMode, pageTheme });
  }, [page, zoom, viewMode, pageTheme, pdf, schedule]);

  const goTo = useCallback(
    (n: number) => {
      if (pageCount === null) return;
      const next = clampPage(n, pageCount);
      pendingScroll.current = next;
      setPage(next);
    },
    [pageCount],
  );

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
    el.querySelector(`[data-page-slot="${target}"]`)?.scrollIntoView({ block: "start" });
  }, [page, viewMode, zoom, pdf]);

  // Scroll mode: the current page is the one showing the most pixels.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !pdf || viewMode !== "scroll") return;
    const visiblePx = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.pageSlot);
          visiblePx.set(n, e.isIntersecting ? e.intersectionRect.height : 0);
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
      },
      { root, threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
    );
    root.querySelectorAll("[data-page-slot]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pdf, viewMode]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (pageCount === null) return;
      let target: number | null = null;
      if (e.key === "ArrowRight" || e.key === "PageDown") target = page + 1;
      else if (e.key === "ArrowLeft" || e.key === "PageUp") target = page - 1;
      else if (e.key === "Home") target = 1;
      else if (e.key === "End") target = pageCount;
      if (target === null) return;
      e.preventDefault();
      goTo(target);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pageCount, goTo]);

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

  const noop = useCallback(() => {}, []);

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
  const bookmarked = bookmarks.some((b) => b.location === String(page));
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
        onToggleSidebar={noop}
        onToggleSearch={noop}
        bookmarked={bookmarked}
        onToggleBookmark={noop}
        backHref={backHref}
        title={data.title}
      />
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-muted/60 px-4 py-6">
        {!pdf ? (
          <p className="text-center text-sm text-muted-foreground">Opening…</p>
        ) : viewMode === "page" ? (
          <PdfPage pdf={pdf} pageNumber={page} scale={zoom} theme={pageTheme} highlights={pageHighlights(page)} searchQuery={searchQuery} />
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
              <LazyPage key={n} pageNumber={n} minHeight={(baseSize?.h ?? 792) * zoom} root={containerRef}>
                <PdfPage pdf={pdf} pageNumber={n} scale={zoom} theme={pageTheme} highlights={pageHighlights(n)} searchQuery={searchQuery} />
              </LazyPage>
            ))}
          </div>
        )}
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
