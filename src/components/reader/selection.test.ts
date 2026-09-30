import { describe, expect, it } from "vitest";

import { MAX_HIGHLIGHT_RECTS, selectionToHighlight } from "@/components/reader/selection";

const box = { left: 0, top: 0, width: 100, height: 200 };

describe("selectionToHighlight", () => {
  it("normalises whitespace and converts rects to fractions", () => {
    const r = selectionToHighlight({ text: "  hello\n  world ", rects: [{ left: 10, top: 20, width: 50, height: 10 }], box });
    expect(r).toEqual({ text: "hello world", rects: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.05 }] });
  });
  it("returns null for empty text or no usable rects", () => {
    expect(selectionToHighlight({ text: "   ", rects: [{ left: 0, top: 0, width: 5, height: 5 }], box })).toBeNull();
    expect(selectionToHighlight({ text: "x", rects: [], box })).toBeNull();
  });
  it("drops nested duplicate rects", () => {
    const r = selectionToHighlight({
      text: "x",
      rects: [
        { left: 0, top: 0, width: 100, height: 20 },
        { left: 10, top: 0, width: 20, height: 20 },
      ],
      box,
    });
    expect(r?.rects).toHaveLength(1);
  });
  it("caps very long selections", () => {
    const r = selectionToHighlight({ text: "a".repeat(5000), rects: [{ left: 0, top: 0, width: 5, height: 5 }], box });
    expect(r?.text.length).toBe(2000);
  });
  it("merges per-word rects on one line into a single rect", () => {
    // 20 words of 4px with 1px gaps on the same line (slightly jittered heights, as pdf.js spans are).
    const rects = Array.from({ length: 20 }, (_, i) => ({ left: 2 + i * 5, top: 40 + (i % 2) * 0.3, width: 4, height: 10 - (i % 2) * 0.3 }));
    const r = selectionToHighlight({ text: "many words", rects, box: { left: 0, top: 0, width: 200, height: 200 } });
    expect(r?.rects).toHaveLength(1);
    const [m] = r!.rects;
    expect(m.x).toBeCloseTo(0.01);
    expect(m.x + m.w).toBeCloseTo(0.505);
    expect(m.y).toBeCloseTo(0.2);
    expect(m.y + m.h).toBeCloseTo(0.25);
  });
  it("keeps two lines as two rects", () => {
    const rects = [
      { left: 10, top: 20, width: 30, height: 10 },
      { left: 42, top: 20, width: 30, height: 10 },
      { left: 10, top: 34, width: 30, height: 10 },
      { left: 42, top: 34, width: 30, height: 10 },
    ];
    const r = selectionToHighlight({ text: "two lines", rects, box });
    expect(r?.rects).toHaveLength(2);
    expect(r!.rects[0].y).toBeLessThan(r!.rects[1].y);
  });
  it("keeps far-apart rects on one line (two columns) separate", () => {
    const rects = [
      { left: 5, top: 20, width: 30, height: 10 },
      { left: 60, top: 20, width: 30, height: 10 },
    ];
    expect(selectionToHighlight({ text: "cols", rects, box })?.rects).toHaveLength(2);
  });
  it("never returns more rects than the cap, even for 1000 input rects", () => {
    // 1000 separate lines: nothing merges per line, so the cap must kick in.
    const tall = { left: 0, top: 0, width: 100, height: 10000 };
    const rects = Array.from({ length: 1000 }, (_, i) => ({ left: 10 + (i % 3) * 20, top: i * 10, width: 10, height: 8 }));
    const r = selectionToHighlight({ text: "long", rects, box: tall });
    expect(r).not.toBeNull();
    expect(r!.rects.length).toBeGreaterThan(0);
    expect(r!.rects.length).toBeLessThanOrEqual(MAX_HIGHLIGHT_RECTS);
    expect(MAX_HIGHLIGHT_RECTS).toBeLessThanOrEqual(150);
  });
});
