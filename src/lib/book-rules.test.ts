import { describe, expect, it } from "vitest";

import { applyFormToLifecycle, applyStatusChange, initialLifecycle } from "./book-rules";
import type { BookLifecycle } from "./types";

const now = new Date(2026, 8, 30, 12);
const earlier = new Date(2026, 8, 1, 9);
const finishedOn = new Date(2026, 7, 10, 9);

const want: BookLifecycle = { status: "want", startedAt: null, finishedAt: null, rating: null };
const reading: BookLifecycle = { status: "reading", startedAt: earlier, finishedAt: null, rating: null };
const finished: BookLifecycle = { status: "finished", startedAt: earlier, finishedAt: finishedOn, rating: 4 };

describe("initialLifecycle", () => {
  it("want: everything null, rating ignored", () => {
    expect(initialLifecycle("want", 5, now)).toEqual({ status: "want", startedAt: null, finishedAt: null, rating: null });
  });
  it("reading: started now, rating ignored", () => {
    expect(initialLifecycle("reading", 3, now)).toEqual({ status: "reading", startedAt: now, finishedAt: null, rating: null });
  });
  it("finished: finished now, no start, keeps the rating", () => {
    expect(initialLifecycle("finished", 4, now)).toEqual({ status: "finished", startedAt: null, finishedAt: now, rating: 4 });
    expect(initialLifecycle("finished", null, now).rating).toBeNull();
  });
});

describe("applyStatusChange (D7)", () => {
  it("same status is a no-op", () => {
    expect(applyStatusChange(finished, "finished", now)).toBe(finished);
    expect(applyStatusChange(reading, "reading", now)).toBe(reading);
    expect(applyStatusChange(want, "want", now)).toBe(want);
  });
  it("→ want clears started, finished and rating", () => {
    expect(applyStatusChange(finished, "want", now)).toEqual({ status: "want", startedAt: null, finishedAt: null, rating: null });
    expect(applyStatusChange(reading, "want", now)).toEqual({ status: "want", startedAt: null, finishedAt: null, rating: null });
  });
  it("want → reading sets started to now", () => {
    expect(applyStatusChange(want, "reading", now)).toEqual({ status: "reading", startedAt: now, finishedAt: null, rating: null });
  });
  it("finished → reading keeps an existing started, clears finished and rating", () => {
    expect(applyStatusChange(finished, "reading", now)).toEqual({ status: "reading", startedAt: earlier, finishedAt: null, rating: null });
  });
  it("finished without a started date → reading sets started to now", () => {
    const noStart: BookLifecycle = { ...finished, startedAt: null };
    expect(applyStatusChange(noStart, "reading", now).startedAt).toBe(now);
  });
  it("reading → finished sets finished to now, keeps started, no rating", () => {
    expect(applyStatusChange(reading, "finished", now)).toEqual({ status: "finished", startedAt: earlier, finishedAt: now, rating: null });
  });
  it("want → finished leaves started empty", () => {
    expect(applyStatusChange(want, "finished", now)).toEqual({ status: "finished", startedAt: null, finishedAt: now, rating: null });
  });
  it("does not mutate its input", () => {
    const copy = { ...finished };
    applyStatusChange(finished, "want", now);
    expect(finished).toEqual(copy);
  });
});

describe("applyFormToLifecycle", () => {
  it("finished → finished keeps dates and takes the form rating", () => {
    expect(applyFormToLifecycle(finished, { status: "finished", rating: 2 }, now)).toEqual({
      status: "finished",
      startedAt: earlier,
      finishedAt: finishedOn,
      rating: 2,
    });
  });
  it("finished → finished with a cleared rating", () => {
    expect(applyFormToLifecycle(finished, { status: "finished", rating: null }, now).rating).toBeNull();
  });
  it("reading → finished applies the chosen rating and stamps finished", () => {
    expect(applyFormToLifecycle(reading, { status: "finished", rating: 5 }, now)).toEqual({
      status: "finished",
      startedAt: earlier,
      finishedAt: now,
      rating: 5,
    });
  });
  it("finished → reading drops the rating even if the form still carries one", () => {
    expect(applyFormToLifecycle(finished, { status: "reading", rating: 4 }, now)).toEqual({
      status: "reading",
      startedAt: earlier,
      finishedAt: null,
      rating: null,
    });
  });
  it("→ want clears everything", () => {
    expect(applyFormToLifecycle(finished, { status: "want", rating: 5 }, now)).toEqual({
      status: "want",
      startedAt: null,
      finishedAt: null,
      rating: null,
    });
  });
});
