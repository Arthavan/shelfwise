export type RangeResult = { kind: "full" } | { kind: "range"; start: number; end: number } | { kind: "invalid" };

/** Single byte-range only; `end` is inclusive. Anything else that is not absent is invalid (416). */
export function parseRange(header: string | null, size: number): RangeResult {
  if (header === null) return { kind: "full" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "") || size < 1) return { kind: "invalid" };
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix < 1) return { kind: "invalid" };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return { kind: "invalid" };
  return { kind: "range", start, end };
}
