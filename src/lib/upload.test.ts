import { describe, expect, it } from "vitest";

import { detectFormat, maxUploadBytes } from "@/lib/upload";

const enc = (s: string) => new TextEncoder().encode(s);

describe("detectFormat", () => {
  it("detects a PDF by magic bytes", () => expect(detectFormat(enc("%PDF-1.7\n..."))).toBe("pdf"));
  it("tolerates leading junk before %PDF- (within 1 KB)", () => {
    expect(detectFormat(enc("\n\n  garbage %PDF-1.4"))).toBe("pdf");
  });
  it("detects an EPUB (zip with the epub mimetype entry)", () => {
    const zip = "PK\x03\x04" + "x".repeat(26) + "mimetypeapplication/epub+zip";
    expect(detectFormat(enc(zip))).toBe("epub");
  });
  it("rejects a plain zip, text and empty input", () => {
    expect(detectFormat(enc("PK\x03\x04" + "x".repeat(60)))).toBeNull();
    expect(detectFormat(enc("hello world"))).toBeNull();
    expect(detectFormat(new Uint8Array())).toBeNull();
  });
  it("rejects a file renamed .pdf that is really an image", () => {
    expect(detectFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("maxUploadBytes", () => {
  it("defaults to 100 MB", () => expect(maxUploadBytes({})).toBe(100 * 1024 * 1024));
  it("reads MAX_UPLOAD_MB", () => expect(maxUploadBytes({ MAX_UPLOAD_MB: "5" })).toBe(5 * 1024 * 1024));
  it("falls back to the default on garbage", () => {
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "abc" })).toBe(100 * 1024 * 1024);
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "-4" })).toBe(100 * 1024 * 1024);
  });
});
