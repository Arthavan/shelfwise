"use client";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { loadPdfjs } from "@/components/reader/pdf-loader";
import type { HighlightInfo } from "@/lib/types";
import type { PageTheme } from "@/lib/reading";

export const HIGHLIGHT_BG: Record<string, string> = {
  yellow: "rgba(250, 204, 21, 0.4)",
  green: "rgba(74, 222, 128, 0.4)",
  blue: "rgba(96, 165, 250, 0.4)",
  pink: "rgba(244, 114, 182, 0.4)",
};
const THEME_FILTER: Record<PageTheme, string> = {
  light: "none",
  sepia: "sepia(0.55) contrast(0.95)",
  dark: "invert(0.92) hue-rotate(180deg)",
};

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  theme: PageTheme;
  highlights: HighlightInfo[]; // already filtered to this page
  searchQuery: string;
  onTextReady?: (pageNumber: number, hasText: boolean) => void;
}

export function PdfPage({ pdf, pageNumber, scale, theme, highlights, searchQuery, onTextReady }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // Bumped after each text layer render so the search-hit effect re-runs on fresh spans.
  const [textVersion, setTextVersion] = useState(0);

  useEffect(() => {
    textRef.current?.replaceChildren(); // drop the previous page's spans while the new canvas renders
    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<unknown> } | null = null;
    let textLayer: { cancel(): void; render(): Promise<unknown> } | null = null;
    (async () => {
      const pdfjs = await loadPdfjs();
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textDiv = textRef.current;
      if (!canvas || !textDiv) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setSize({ w: viewport.width, h: viewport.height });
      // pdf.js v6: pass the canvas itself (canvasContext is deprecated).
      renderTask = page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await renderTask.promise;
      if (cancelled) return;
      const content = await page.getTextContent();
      if (cancelled) return;
      textDiv.replaceChildren();
      textLayer = new pdfjs.TextLayer({ textContentSource: content, container: textDiv, viewport });
      await textLayer.render();
      if (cancelled) return;
      setTextVersion((v) => v + 1);
      onTextReady?.(pageNumber, content.items.length > 0);
    })().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== "RenderingCancelledException" && !cancelled) console.error(e);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, scale, onTextReady]);

  // Search hits: mark text spans containing the query. Coarse (span level) by design.
  useEffect(() => {
    const spans = textRef.current?.querySelectorAll("span");
    const q = searchQuery.trim().toLowerCase();
    spans?.forEach((s) => s.classList.toggle("search-hit", q !== "" && (s.textContent ?? "").toLowerCase().includes(q)));
  }, [searchQuery, textVersion]);

  return (
    <div
      data-page={pageNumber}
      className="relative mx-auto bg-white shadow-md"
      style={{
        width: size?.w,
        height: size?.h,
        // Variables pdf_viewer.css expects from `.pdfViewer .page` (the text layer sizes itself from them).
        ["--scale-factor" as string]: scale,
        ["--user-unit" as string]: 1,
        ["--total-scale-factor" as string]: scale,
        ["--scale-round-x" as string]: "1px",
        ["--scale-round-y" as string]: "1px",
      }}
    >
      <canvas ref={canvasRef} className="block" style={{ width: size?.w, height: size?.h, filter: THEME_FILTER[theme] }} />
      <div ref={textRef} className="textLayer" />
      {highlights.flatMap((h) =>
        h.rects.map((r, i) => (
          <div
            key={`${h.id}-${i}`}
            data-highlight-id={h.id}
            className="pointer-events-none absolute mix-blend-multiply"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, background: HIGHLIGHT_BG[h.color] ?? HIGHLIGHT_BG.yellow }}
          />
        )),
      )}
    </div>
  );
}
