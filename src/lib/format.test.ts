import { describe, expect, it } from "vitest";

import {
  formatAverage,
  formatBytes,
  formatDate,
  formatNumber,
  monthBarLabel,
  pluralize,
  rateButtonLabel,
  ratedLabel,
  starsLabel,
} from "./format";

describe("formatDate", () => {
  it("formats en-US medium", () => {
    expect(formatDate(new Date(2026, 8, 30, 12))).toBe("Sep 30, 2026");
  });
  it("shows an em dash when unset", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatNumber / formatAverage", () => {
  it("groups thousands", () => {
    expect(formatNumber(2210)).toBe("2,210");
    expect(formatNumber(0)).toBe("0");
  });
  it("shows one decimal or an em dash", () => {
    expect(formatAverage(4.3)).toBe("4.3");
    expect(formatAverage(4)).toBe("4.0");
    expect(formatAverage(null)).toBe("—");
  });
});

describe("pluralize and labels", () => {
  it("pluralizes including zero", () => {
    expect(pluralize(1, "book")).toBe("1 book");
    expect(pluralize(0, "book")).toBe("0 books");
    expect(pluralize(12, "book")).toBe("12 books");
  });
  it("star labels", () => {
    expect(starsLabel(1)).toBe("1 star");
    expect(starsLabel(5)).toBe("5 stars");
    expect(rateButtonLabel(1)).toBe("Rate 1 star");
    expect(rateButtonLabel(2)).toBe("Rate 2 stars");
    expect(ratedLabel(4)).toBe("Rated 4 out of 5");
  });
  it("month bar labels", () => {
    expect(monthBarLabel({ label: "Sep 2026", count: 1 })).toBe("Sep 2026: 1 book");
    expect(monthBarLabel({ label: "Aug 2026", count: 0 })).toBe("Aug 2026: 0 books");
    expect(monthBarLabel({ label: "Jul 2026", count: 3 })).toMatch(/^[A-Z][a-z]{2} \d{4}: \d+ books?$/);
  });
});

describe("formatBytes", () => {
  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
