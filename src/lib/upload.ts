const DEFAULT_MAX_MB = 100;

export function maxUploadBytes(env?: { MAX_UPLOAD_MB?: string }): number {
  const e = env ?? process.env;
  const mb = Number(e.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_MB) * 1024 * 1024;
}

function indexOfAscii(bytes: Uint8Array, needle: string, limit: number): number {
  const n = needle.length;
  const end = Math.min(bytes.length, limit) - n;
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < n; j++) if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

/** Detects by content, not by file name or MIME type. */
export function detectFormat(bytes: Uint8Array): "pdf" | "epub" | null {
  // The EPUB check comes first: a ZIP's early bytes may contain "%PDF-" (e.g. in a stored chapter).
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (isZip) return indexOfAscii(bytes, "application/epub+zip", 256) !== -1 ? "epub" : null;
  if (indexOfAscii(bytes, "%PDF-", 1024) !== -1) return "pdf";
  return null;
}
