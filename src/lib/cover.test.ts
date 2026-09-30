import { describe, expect, it } from "vitest";

import { COVER_CLASSES } from "./constants";
import { coverTone, getInitials } from "./cover";

describe("getInitials", () => {
  it("uses the first letter of the first two words", () => {
    expect(getInitials("The Hobbit")).toBe("TH");
    expect(getInitials("The Remains of the Day")).toBe("TR");
    expect(getInitials("A Wizard of Earthsea")).toBe("AW");
  });
  it("handles a single word", () => {
    expect(getInitials("Piranesi")).toBe("P");
  });
  it("skips words that do not start with a letter or digit", () => {
    expect(getInitials("— Dune")).toBe("D");
    expect(getInitials("  1984  ")).toBe("1");
    expect(getInitials("“Quoted” Title")).toBe("T");
  });
  it("uppercases and copes with odd input", () => {
    expect(getInitials("station eleven")).toBe("SE");
    expect(getInitials("!!!")).toBe("!");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("coverTone", () => {
  it("is deterministic and within 1..8", () => {
    for (const title of ["Piranesi", "Dune", "The Hobbit", "", "Ünïcode ☃", "x".repeat(500)]) {
      const tone = coverTone(title);
      expect(tone).toBe(coverTone(title));
      expect(Number.isInteger(tone)).toBe(true);
      expect(tone).toBeGreaterThanOrEqual(1);
      expect(tone).toBeLessThanOrEqual(8);
    }
  });
  it("matches the djb2 reference value", () => {
    // djb2("a") = 5381 * 33 + 97 = 177670; 177670 % 8 = 6 → tone 7
    expect(coverTone("a")).toBe(7);
    expect(coverTone("")).toBe((5381 % 8) + 1);
  });
  it("spreads demo titles across several tones", () => {
    const tones = new Set(["Piranesi", "Dune", "Circe", "Educated", "Middlemarch", "The Hobbit"].map(coverTone));
    expect(tones.size).toBeGreaterThan(2);
  });
  it("indexes COVER_CLASSES", () => {
    expect(COVER_CLASSES).toHaveLength(8);
    expect(COVER_CLASSES[coverTone("Dune") - 1]).toMatch(/^bg-cover-[1-8] text-cover-foreground$/);
  });
});
