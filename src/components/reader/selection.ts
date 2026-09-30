import { dropContainedRects, rectsToFractions, type BoxLike, type Rect } from "@/lib/reading";

const MAX_TEXT = 2000;
/** Client-side cap on stored rects; the server accepts more, so a big selection never hits its limit. */
export const MAX_HIGHLIGHT_RECTS = 150;
/** Horizontal gap (fraction of page width) still bridged when joining rects on one line. */
const LINE_GAP = 0.02;

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Groups rects into text lines: a rect joins a line when it overlaps at least half of the shorter height. */
function groupLines(rects: Rect[]): Rect[][] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { top: number; bottom: number; rects: Rect[] }[] = [];
  for (const r of sorted) {
    const line = lines.find((l) => {
      const overlap = Math.min(l.bottom, r.y + r.h) - Math.max(l.top, r.y);
      return overlap >= 0.5 * Math.min(l.bottom - l.top, r.h);
    });
    if (line) {
      line.rects.push(r);
      line.top = Math.min(line.top, r.y);
      line.bottom = Math.max(line.bottom, r.y + r.h);
    } else {
      lines.push({ top: r.y, bottom: r.y + r.h, rects: [r] });
    }
  }
  return lines.map((l) => l.rects.sort((a, b) => a.x - b.x));
}

/** Joins horizontally adjacent or overlapping rects on each line (gap up to `gap`; Infinity joins the whole line). */
function mergeLines(lines: Rect[][], gap: number): Rect[] {
  const out: Rect[] = [];
  for (const line of lines) {
    let cur = line[0];
    for (const r of line.slice(1)) {
      if (r.x - (cur.x + cur.w) <= gap) cur = union(cur, r);
      else {
        out.push(cur);
        cur = r;
      }
    }
    out.push(cur);
  }
  return out;
}

/** Merges per-span rects into per-line rects and keeps the count at or under `max`. */
export function mergeRects(rects: Rect[], max = MAX_HIGHLIGHT_RECTS): Rect[] {
  if (rects.length === 0) return [];
  const lines = groupLines(rects);
  let merged = mergeLines(lines, LINE_GAP);
  if (merged.length > max) merged = mergeLines(lines, Infinity);
  if (merged.length > max) {
    // Still too many lines: join runs of consecutive lines into blocks.
    const size = Math.ceil(merged.length / max);
    const blocks: Rect[] = [];
    for (let i = 0; i < merged.length; i += size) blocks.push(merged.slice(i, i + size).reduce(union));
    merged = blocks;
  }
  return merged;
}

export function selectionToHighlight(input: { text: string; rects: BoxLike[]; box: BoxLike }): { text: string; rects: Rect[] } | null {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (text === "") return null;
  const rects = mergeRects(dropContainedRects(rectsToFractions(input.rects, input.box)));
  if (rects.length === 0) return null;
  return { text, rects };
}
