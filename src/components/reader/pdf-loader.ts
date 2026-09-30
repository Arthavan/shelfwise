import type { PDFDocumentProxy } from "pdfjs-dist";

/** Browser only. The worker is copied into /public by scripts/copy-pdf-worker.mjs. */
export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ url }).promise;
}
