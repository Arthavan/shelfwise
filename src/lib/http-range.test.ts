import { describe, expect, it } from "vitest";

import { parseRange } from "@/lib/http-range";

describe("parseRange", () => {
  it("no header means the full file", () => expect(parseRange(null, 1000)).toEqual({ kind: "full" }));
  it("parses start-end (inclusive)", () => expect(parseRange("bytes=0-99", 1000)).toEqual({ kind: "range", start: 0, end: 99 }));
  it("parses open-ended ranges", () => expect(parseRange("bytes=900-", 1000)).toEqual({ kind: "range", start: 900, end: 999 }));
  it("parses suffix ranges", () => expect(parseRange("bytes=-500", 1000)).toEqual({ kind: "range", start: 500, end: 999 }));
  it("clamps an end past EOF", () => expect(parseRange("bytes=990-5000", 1000)).toEqual({ kind: "range", start: 990, end: 999 }));
  it("clamps a suffix longer than the file", () => expect(parseRange("bytes=-5000", 1000)).toEqual({ kind: "range", start: 0, end: 999 }));
  it("flags start past EOF as invalid (416)", () => expect(parseRange("bytes=1000-", 1000)).toEqual({ kind: "invalid" }));
  it("flags malformed or multi-range headers as invalid", () => {
    expect(parseRange("bytes=abc", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("bytes=5-2", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("items=0-5", 1000)).toEqual({ kind: "invalid" });
    expect(parseRange("bytes=0-5,10-20", 1000)).toEqual({ kind: "invalid" });
  });
  it("flags any range on an empty file as invalid", () => expect(parseRange("bytes=0-", 0)).toEqual({ kind: "invalid" }));
});
