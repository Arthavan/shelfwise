import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Loads the pdf.js library. We use the legacy build: pdf.js v6's modern build calls very new
 * built-ins (Map.prototype.getOrInsertComputed) that current browsers may lack; the legacy build
 * bundles polyfills for them. Types are the same (legacy/build/pdf.d.mts re-exports "pdfjs-dist").
 */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/** Browser only. The worker (legacy build) is copied into /public by scripts/copy-pdf-worker.mjs. */
export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ url }).promise;
}
