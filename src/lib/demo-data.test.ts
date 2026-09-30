import { describe, expect, it } from "vitest";

import { buildDemoBooks } from "./demo-data";

describe("buildDemoBooks", () => {
  it("returns 12 books split 3/2/7", () => {
    const rows = buildDemoBooks(new Date());
    expect(rows).toHaveLength(12);
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    expect([count("want"), count("reading"), count("finished")]).toEqual([3, 2, 7]);
  });
});
