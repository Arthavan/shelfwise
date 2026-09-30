import { dropContainedRects, rectsToFractions, type BoxLike, type Rect } from "@/lib/reading";

const MAX_TEXT = 2000;

export function selectionToHighlight(input: { text: string; rects: BoxLike[]; box: BoxLike }): { text: string; rects: Rect[] } | null {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (text === "") return null;
  const rects = dropContainedRects(rectsToFractions(input.rects, input.box));
  if (rects.length === 0) return null;
  return { text, rects };
}
