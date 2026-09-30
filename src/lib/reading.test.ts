import { describe, expect, it } from "vitest";

import { clampPage, clampZoom, dropContainedRects, percentFor, rectsToFractions, searchPages } from "@/lib/reading";

describe("clampPage", () => {
  it("keeps a valid page", () => expect(clampPage(5, 10)).toBe(5));
  it("clamps below 1 and above the count", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-3, 10)).toBe(1);
    expect(clampPage(99, 10)).toBe(10); // saved page beyond a shorter replacement file
  });
  it("treats NaN and a zero page count as page 1", () => {
    expect(clampPage(Number.NaN, 10)).toBe(1);
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe("percentFor", () => {
  it("rounds page/pageCount to a whole percent", () => {
    expect(percentFor(42, 310)).toBe(14);
    expect(percentFor(310, 310)).toBe(100);
  });
  it("is 0 for an unknown page count and never exceeds 100", () => {
    expect(percentFor(3, 0)).toBe(0);
    expect(percentFor(500, 310)).toBe(100);
  });
});

describe("clampZoom", () => {
  it("clamps to 0.5-3", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(9)).toBe(3);
    expect(clampZoom(1.25)).toBe(1.25);
  });
});

describe("rectsToFractions", () => {
  const box = { left: 100, top: 200, width: 400, height: 800 };
  it("converts client rects into fractions of the page box", () => {
    const out = rectsToFractions([{ left: 200, top: 400, width: 100, height: 40 }], box);
    expect(out).toEqual([{ x: 0.25, y: 0.25, w: 0.25, h: 0.05 }]);
  });
  it("drops empty rects and clamps rects that overflow the page", () => {
    const out = rectsToFractions(
      [
        { left: 0, top: 0, width: 0, height: 10 },
        { left: 450, top: 200, width: 200, height: 80 },
      ],
      box,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBeCloseTo(0.875);
    expect(out[0].x + out[0].w).toBeLessThanOrEqual(1);
  });
  it("returns nothing for a zero-size box", () => {
    expect(rectsToFractions([{ left: 0, top: 0, width: 5, height: 5 }], { left: 0, top: 0, width: 0, height: 0 })).toEqual([]);
  });
});

describe("dropContainedRects", () => {
  it("removes rects fully inside another (nested span duplicates)", () => {
    const outer = { x: 0.1, y: 0.1, w: 0.5, h: 0.05 };
    const inner = { x: 0.2, y: 0.1, w: 0.1, h: 0.05 };
    expect(dropContainedRects([outer, inner])).toEqual([outer]);
  });
  it("keeps identical rects once", () => {
    const r = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    expect(dropContainedRects([r, { ...r }])).toHaveLength(1);
  });
});

describe("searchPages", () => {
  const texts = ["The quick brown fox", "nothing here", "A Quick reply, quickly"];
  it("finds case-insensitive matches with 1-based pages and snippets", () => {
    const hits = searchPages(texts, "quick");
    expect(hits.map((h) => h.page)).toEqual([1, 3, 3]);
    expect(hits[0].snippet).toContain("quick brown");
  });
  it("returns nothing for an empty or whitespace query", () => {
    expect(searchPages(texts, "")).toEqual([]);
    expect(searchPages(texts, "   ")).toEqual([]);
  });
  it("caps the number of results", () => {
    expect(searchPages(["a a a a a"], "a", 3)).toHaveLength(3);
  });
  it("does not treat regex characters specially", () => {
    expect(searchPages(["cost (approx.) $5"], "(approx.)")).toHaveLength(1);
  });
});
