export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export const PAGE_THEMES = ["light", "sepia", "dark"] as const;
export const VIEW_MODES = ["page", "scroll"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type PageTheme = (typeof PAGE_THEMES)[number];
export type ViewMode = (typeof VIEW_MODES)[number];

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

export type Rect = { x: number; y: number; w: number; h: number };
export type BoxLike = { left: number; top: number; width: number; height: number };
export type SearchHit = { page: number; snippet: string; index: number };

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** 1-based page clamped into the document; a bad page or empty document is page 1. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || pageCount < 1) return 1;
  return Math.min(pageCount, Math.max(1, Math.trunc(page)));
}

export function percentFor(page: number, pageCount: number): number {
  if (pageCount < 1) return 0;
  return Math.min(100, Math.max(0, Math.round((page / pageCount) * 100)));
}

/** Client rects to fractions of the page box, so highlights survive zoom. Empty rects are dropped. */
export function rectsToFractions(rects: BoxLike[], box: BoxLike): Rect[] {
  if (box.width <= 0 || box.height <= 0) return [];
  const out: Rect[] = [];
  const round = (n: number) => Math.round(n * 1e10) / 1e10; // avoid floating point errors
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue;
    const x = round(Math.min(1, Math.max(0, (r.left - box.left) / box.width)));
    const y = round(Math.min(1, Math.max(0, (r.top - box.top) / box.height)));
    const right = round(Math.min(1, Math.max(0, (r.left + r.width - box.left) / box.width)));
    const bottom = round(Math.min(1, Math.max(0, (r.top + r.height - box.top) / box.height)));
    if (right - x <= 0 || bottom - y <= 0) continue;
    out.push({ x, y, w: round(right - x), h: round(bottom - y) });
  }
  return out;
}

const EPS = 1e-6;
function contains(a: Rect, b: Rect): boolean {
  return a.x <= b.x + EPS && a.y <= b.y + EPS && a.x + a.w >= b.x + b.w - EPS && a.y + a.h >= b.y + b.h - EPS;
}

/** Range.getClientRects() returns nested duplicates; keep only rects not inside another. */
export function dropContainedRects(rects: Rect[]): Rect[] {
  return rects.filter((r, i) =>
    !rects.some((other, j) => {
      if (i === j || !contains(other, r)) return false;
      // identical rects: keep the first only
      return !contains(r, other) || j < i;
    }),
  );
}

/** Case-insensitive literal search over per-page text (`texts[i]` is page i + 1). */
export function searchPages(texts: string[], query: string, maxResults = 200): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  const hits: SearchHit[] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const haystack = text.toLowerCase();
    let from = 0;
    while (hits.length < maxResults) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const start = Math.max(0, at - 30);
      const end = Math.min(text.length, at + needle.length + 30);
      hits.push({ page: i + 1, index: at, snippet: `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}` });
      from = at + needle.length;
    }
    if (hits.length >= maxResults) break;
  }
  return hits;
}
