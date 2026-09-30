import type { PDFDocumentProxy } from "pdfjs-dist";

export type OutlineItem = { title: string; page: number; depth: number };

type RawNode = {
  title: string;
  dest: string | unknown[] | null;
  items: RawNode[];
};
type RawOutline = RawNode[];

export async function pdfOutlineToItems(
  pdf: PDFDocumentProxy,
): Promise<OutlineItem[]> {
  const raw = (await pdf.getOutline()) as RawOutline | null;
  if (!raw) return [];
  const out: OutlineItem[] = [];
  async function walk(nodes: RawOutline, depth: number) {
    for (const node of nodes) {
      try {
        const dest =
          typeof node.dest === "string"
            ? await pdf.getDestination(node.dest)
            : node.dest;
        if (dest && dest[0] && typeof dest[0] === "object") {
          const index = await pdf.getPageIndex(dest[0] as never);
          out.push({ title: node.title, page: index + 1, depth });
        }
      } catch {
        /* skip an unresolvable entry */
      }
      if (node.items?.length) await walk(node.items, depth + 1);
    }
  }
  await walk(raw, 0);
  return out;
}
