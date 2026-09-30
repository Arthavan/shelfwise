import { describe, expect, it } from "vitest";

import { selectionToHighlight } from "@/components/reader/selection";

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
});
