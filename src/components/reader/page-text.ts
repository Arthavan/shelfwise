import type { PDFDocumentProxy } from "pdfjs-dist";

const cache = new WeakMap<PDFDocumentProxy, Promise<string[]>>();

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Text of every page (index i = page i + 1). Cached per document; pages load one at a time, yielding between them. */
export function getAllPageTexts(pdf: PDFDocumentProxy, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  let cached = cache.get(pdf);
  if (!cached) {
    cached = (async () => {
      const texts: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        texts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim());
        onProgress?.(n, pdf.numPages);
        await yieldToUi();
      }
      return texts;
    })();
    cache.set(pdf, cached);
    // A failed extraction must not be cached forever.
    cached.catch(() => {
      if (cache.get(pdf) === cached) cache.delete(pdf);
    });
  }
  return cached;
}
