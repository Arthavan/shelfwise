import { describe, expect, it } from "vitest";

import { readLimitedText } from "@/lib/request-guard";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", body, headers, duplex: "half" } as RequestInit);

/** A body with no Content-Length: a stream delivering `chunks` pieces of `size` bytes. */
function streamed(chunks: number, size: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent++ < chunks) controller.enqueue(new Uint8Array(size).fill(0x61));
      else controller.close();
    },
  });
}

describe("readLimitedText", () => {
  it("returns a small body", async () => {
    expect(await readLimitedText(post('{"url":"x"}'), 100)).toBe('{"url":"x"}');
  });

  it("returns an empty string for no body", async () => {
    expect(await readLimitedText(new Request("http://localhost/api", { method: "POST" }), 100)).toBe("");
  });

  it("rejects a declared Content-Length above the limit without reading", async () => {
    expect(await readLimitedText(post("a".repeat(50), { "Content-Length": "5000" }), 100)).toBeNull();
  });

  it("rejects a body that is larger than the limit", async () => {
    expect(await readLimitedText(post("a".repeat(101)), 100)).toBeNull();
    expect(await readLimitedText(post("a".repeat(100)), 100)).toBe("a".repeat(100));
  });

  it("stops reading a stream as soon as it exceeds the limit", async () => {
    expect(await readLimitedText(post(streamed(1000, 1024)), 8 * 1024)).toBeNull();
    expect(await readLimitedText(post(streamed(2, 1024)), 8 * 1024)).toHaveLength(2048);
  });
});
