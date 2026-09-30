import { describe, expect, it } from "vitest";

import type { BookFormValues } from "./types";
import {
  bookFormSchema,
  goalSchema,
  idSchema,
  progressSchema,
  rateSchema,
  resetSchema,
  statusChangeSchema,
  toBookData,
} from "./validation";

const valid: BookFormValues = { title: "Dune", author: "Frank Herbert", status: "want", pages: "", notes: "", rating: null };

function messages(values: Partial<BookFormValues>): Record<string, string> {
  const result = bookFormSchema.safeParse({ ...valid, ...values });
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

describe("bookFormSchema", () => {
  it("accepts a minimal valid book and trims", () => {
    const parsed = bookFormSchema.parse({ ...valid, title: "  Dune  ", author: " Frank Herbert " });
    expect(parsed.title).toBe("Dune");
    expect(parsed.author).toBe("Frank Herbert");
  });

  it("requires a title and an author; whitespace-only counts as empty", () => {
    expect(messages({ title: "" }).title).toBe("Title is required");
    expect(messages({ title: "   " }).title).toBe("Title is required");
    expect(messages({ author: "" }).author).toBe("Author is required");
    expect(messages({ author: " \t " }).author).toBe("Author is required");
  });

  it("limits title to 200 and author to 120 characters (after trimming)", () => {
    expect(messages({ title: "a".repeat(200) }).title).toBeUndefined();
    expect(messages({ title: "a".repeat(201) }).title).toBe("Title must be 200 characters or fewer");
    expect(messages({ title: ` ${"a".repeat(200)} ` }).title).toBeUndefined();
    expect(messages({ author: "a".repeat(120) }).author).toBeUndefined();
    expect(messages({ author: "a".repeat(121) }).author).toBe("Author must be 120 characters or fewer");
  });

  it("validates pages", () => {
    for (const ok of ["", "  ", "1", "320", "100000"]) expect(messages({ pages: ok }).pages, ok).toBeUndefined();
    for (const bad of ["0", "1.5", "abc", "-3", "12a", "1e3", "+5"]) {
      expect(messages({ pages: bad }).pages, bad).toBe("Pages must be a positive whole number");
    }
    expect(messages({ pages: "100001" }).pages).toBe("Pages must be 100,000 or fewer");
    expect(messages({ pages: "99999999999999999999" }).pages).toBe("Pages must be 100,000 or fewer");
  });

  it("limits notes to 2000 characters", () => {
    expect(messages({ notes: "n".repeat(2000) }).notes).toBeUndefined();
    expect(messages({ notes: "n".repeat(2001) }).notes).toBe("Notes must be 2000 characters or fewer");
  });

  it("checks status and rating", () => {
    expect(messages({ status: "nope" as never }).status).toBeDefined();
    expect(messages({ status: "finished", rating: 5 }).rating).toBeUndefined();
    expect(messages({ rating: 0 }).rating).toBeDefined();
    expect(messages({ rating: 6 }).rating).toBeDefined();
    expect(messages({ rating: 2.5 }).rating).toBeDefined();
  });

  it("reports several errors at once", () => {
    const m = messages({ title: "", author: "", pages: "abc" });
    expect(m).toEqual({ title: "Title is required", author: "Author is required", pages: "Pages must be a positive whole number" });
  });
});

describe("toBookData", () => {
  it("converts pages and empty notes", () => {
    expect(toBookData({ ...valid, pages: "320", notes: "" })).toEqual({ title: "Dune", author: "Frank Herbert", pages: 320, notes: null });
    expect(toBookData({ ...valid, pages: "", notes: "  hi  " })).toEqual({ title: "Dune", author: "Frank Herbert", pages: null, notes: "hi" });
    expect(toBookData({ ...valid, notes: "   " }).notes).toBeNull();
  });
});

describe("id, status, rate schemas", () => {
  it("idSchema trims and bounds", () => {
    expect(idSchema.parse(" abc ")).toBe("abc");
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("   ").success).toBe(false);
    expect(idSchema.safeParse("x".repeat(65)).success).toBe(false);
  });
  it("statusChangeSchema", () => {
    expect(statusChangeSchema.safeParse({ id: "a", status: "reading" }).success).toBe(true);
    expect(statusChangeSchema.safeParse({ id: "a", status: "done" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ status: "want" }).success).toBe(false);
  });
  it("rateSchema", () => {
    expect(rateSchema.safeParse({ id: "a", rating: 5 }).success).toBe(true);
    for (const rating of [0, 6, 2.5, "3"]) expect(rateSchema.safeParse({ id: "a", rating }).success, String(rating)).toBe(false);
  });
});

describe("goalSchema", () => {
  const MSG = "Enter a whole number from 1 to 999";
  const run = (target: unknown) => goalSchema.safeParse({ target });

  it("accepts whole numbers 1..999 as strings or numbers", () => {
    expect(run("24")).toMatchObject({ success: true, data: { target: 24 } });
    expect(run(" 24 ")).toMatchObject({ success: true, data: { target: 24 } });
    expect(run(1)).toMatchObject({ success: true, data: { target: 1 } });
    expect(run("999")).toMatchObject({ success: true, data: { target: 999 } });
  });

  it("rejects everything else with the one message", () => {
    for (const bad of ["", "  ", "0", "1000", "-1", "1.5", "abc", "12abc", "1e2", 0, 1000, 2.5, -4, NaN, null, undefined, {}, true]) {
      const result = run(bad);
      expect(result.success, String(bad)).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((i) => i.message), String(bad)).toEqual([MSG]);
      }
    }
  });

  it("rejects a missing target", () => {
    const result = goalSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(MSG);
  });
});

describe("resetSchema", () => {
  it("defaults to demo", () => {
    expect(resetSchema.parse({})).toEqual({ mode: "demo" });
  });
  it("accepts demo and empty only", () => {
    expect(resetSchema.parse({ mode: "empty" })).toEqual({ mode: "empty" });
    expect(resetSchema.safeParse({ mode: "wipe" }).success).toBe(false);
  });
});

describe("progressSchema", () => {
  const ok = { id: "b1", location: "3", percent: 60, zoom: 1.25, viewMode: "page", pageTheme: "light" } as const;
  it("accepts a valid payload, including a null zoom", () => {
    expect(progressSchema.safeParse(ok).success).toBe(true);
    expect(progressSchema.safeParse({ ...ok, zoom: null }).success).toBe(true);
  });
  it("rejects out-of-range percent and zoom, empty location and unknown enums", () => {
    expect(progressSchema.safeParse({ ...ok, percent: 101 }).success).toBe(false);
    expect(progressSchema.safeParse({ ...ok, percent: 1.5 }).success).toBe(false);
    expect(progressSchema.safeParse({ ...ok, zoom: 4 }).success).toBe(false);
    expect(progressSchema.safeParse({ ...ok, location: "" }).success).toBe(false);
    expect(progressSchema.safeParse({ ...ok, viewMode: "spread" }).success).toBe(false);
    expect(progressSchema.safeParse({ ...ok, pageTheme: "blue" }).success).toBe(false);
  });
});
