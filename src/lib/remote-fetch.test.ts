import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  classifyAddress,
  fetchRemoteFile,
  fileNameFromUrl,
  isBlockedHostname,
  loopbackAllowed,
  parseRemoteUrl,
  RemoteFetchError,
  remoteFetchMessage,
  type Resolver,
} from "@/lib/remote-fetch";

import { makeEpub } from "../../tests/e2e/fixtures/make-epub";
import { makePdf } from "../../tests/e2e/fixtures/make-pdf";

describe("classifyAddress", () => {
  it.each([
    // IPv4 loopback
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback"],
    // IPv4 blocked
    ["0.0.0.0", "blocked"],
    ["0.1.2.3", "blocked"],
    ["10.0.0.1", "blocked"],
    ["172.16.0.1", "blocked"],
    ["172.31.255.255", "blocked"],
    ["192.168.1.1", "blocked"],
    ["169.254.169.254", "blocked"],
    ["169.254.0.1", "blocked"],
    ["100.64.0.1", "blocked"],
    ["100.127.255.255", "blocked"],
    ["224.0.0.1", "blocked"],
    ["239.255.255.250", "blocked"],
    ["240.0.0.1", "blocked"],
    ["255.255.255.255", "blocked"],
    ["192.0.2.1", "blocked"],
    ["198.18.0.1", "blocked"],
    // IPv4 public (edges of the blocked ranges)
    ["8.8.8.8", "public"],
    ["1.1.1.1", "public"],
    ["172.15.255.255", "public"],
    ["172.32.0.1", "public"],
    ["100.63.255.255", "public"],
    ["100.128.0.1", "public"],
    ["11.0.0.1", "public"],
    ["93.184.216.34", "public"],
    // IPv6
    ["::1", "loopback"],
    ["::", "blocked"],
    ["fe80::1", "blocked"],
    ["febf::1", "blocked"],
    ["fc00::1", "blocked"],
    ["fd12:3456::1", "blocked"],
    ["ff02::1", "blocked"],
    ["2001:db8::1", "blocked"],
    ["2606:4700:4700::1111", "public"],
    ["2a00:1450:4001:80b::200e", "public"],
    // IPv4-mapped / embedded IPv4, judged by the IPv4 address
    ["::ffff:127.0.0.1", "loopback"],
    ["::ffff:7f00:1", "loopback"],
    ["::ffff:169.254.169.254", "blocked"],
    ["::ffff:a9fe:a9fe", "blocked"],
    ["::ffff:10.0.0.1", "blocked"],
    ["::ffff:8.8.8.8", "public"],
    ["64:ff9b::a9fe:a9fe", "blocked"],
    ["64:ff9b::808:808", "public"],
    ["::127.0.0.1", "blocked"],
    // Not an address
    ["example.com", "blocked"],
    ["", "blocked"],
  ])("%s is %s", (ip, expected) => {
    expect(classifyAddress(ip)).toBe(expected);
  });
});

describe("isBlockedHostname", () => {
  it.each(["localhost", "LOCALHOST", "localhost.", "a.localhost", "printer.local", "db.internal", "metadata.google.internal"])("blocks %s", (h) =>
    expect(isBlockedHostname(h)).toBe(true),
  );
  it.each(["example.com", "books.example.org", "localhost.example.com", "internal.example.com"])("allows %s", (h) =>
    expect(isBlockedHostname(h)).toBe(false),
  );
});

describe("parseRemoteUrl", () => {
  it("accepts http and https URLs", () => {
    expect(parseRemoteUrl("https://example.com/book.pdf").href).toBe("https://example.com/book.pdf");
    expect(parseRemoteUrl("  http://example.com:8080/x  ").port).toBe("8080");
  });
  it.each(["", "not a url", "example.com/book.pdf", "ftp://example.com/book.pdf", "file:///etc/passwd", "javascript:alert(1)", "data:application/pdf,x"])(
    "rejects %j as an invalid address",
    (input) => {
      expect(() => parseRemoteUrl(input)).toThrow(expect.objectContaining({ code: "invalid-url" }));
    },
  );
  it("rejects credentials in the URL", () => {
    expect(() => parseRemoteUrl("https://user:pass@example.com/a.pdf")).toThrow(expect.objectContaining({ code: "blocked" }));
    expect(() => parseRemoteUrl("https://user@example.com/a.pdf")).toThrow(expect.objectContaining({ code: "blocked" }));
  });
  it("rejects a very long URL", () => {
    expect(() => parseRemoteUrl(`https://example.com/${"a".repeat(3000)}`)).toThrow(expect.objectContaining({ code: "invalid-url" }));
  });
});

describe("loopbackAllowed", () => {
  it("is off by default and only on for E2E_TEST_HOOKS=1", () => {
    expect(loopbackAllowed({})).toBe(false);
    expect(loopbackAllowed({ E2E_TEST_HOOKS: "0" })).toBe(false);
    expect(loopbackAllowed({ E2E_TEST_HOOKS: "true" })).toBe(false);
    expect(loopbackAllowed({ E2E_TEST_HOOKS: "1" })).toBe(true);
  });
});

describe("fileNameFromUrl", () => {
  it("uses the decoded last path segment", () => {
    expect(fileNameFromUrl(new URL("https://x.com/books/My%20Book.pdf?dl=1"), "pdf")).toBe("My Book.pdf");
  });
  it("falls back by format when there is no segment", () => {
    expect(fileNameFromUrl(new URL("https://x.com/"), "pdf")).toBe("imported.pdf");
    expect(fileNameFromUrl(new URL("https://x.com/dir/"), "epub")).toBe("imported.epub");
  });
  it("strips control characters and separators and caps the length", () => {
    expect(fileNameFromUrl(new URL("https://x.com/a%2Fb%5Cc%00d.pdf"), "pdf")).toBe("abcd.pdf");
    expect(fileNameFromUrl(new URL(`https://x.com/${"n".repeat(300)}.pdf`), "pdf")).toHaveLength(200);
  });
  it("survives a malformed escape", () => {
    expect(fileNameFromUrl(new URL("https://x.com/100%zz.pdf"), "pdf")).toBe("100%zz.pdf");
  });
});

describe("remoteFetchMessage", () => {
  const mb = 100 * 1024 * 1024;
  it.each([
    [new RemoteFetchError("invalid-url"), "Enter a full web address starting with http:// or https://"],
    [new RemoteFetchError("blocked"), "That address isn't allowed"],
    [new RemoteFetchError("refused", 403), "The site refused the download (it may only allow its own viewer)"],
    [new RemoteFetchError("http-error", 404), "The site returned an error (HTTP 404)"],
    [new RemoteFetchError("not-a-book"), "That link is a web page, not a PDF or EPUB file"],
    [new RemoteFetchError("too-large"), "File is too large (max 100 MB)"],
    [new RemoteFetchError("timeout"), "The download took too long"],
    [new RemoteFetchError("network"), "Couldn't reach that address"],
  ])("%o", (err, message) => expect(remoteFetchMessage(err, mb)).toBe(message));
});

// ---------- fetchRemoteFile against a local server ----------

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const routes = new Map<string, Handler>();
let server: Server;
let port: number;
const seenHosts: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    seenHosts.push(req.headers.host ?? "");
    const handler = routes.get((req.url ?? "").split("?")[0]);
    if (handler) handler(req, res);
    else res.writeHead(404).end("nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const PDF = makePdf(["Hello", "World"]);
const EPUB = makeEpub([{ title: "One", body: "Alpha" }]);
routes.set("/book.pdf", (_req, res) => res.writeHead(200, { "Content-Type": "application/octet-stream" }).end(PDF));
routes.set("/book.epub", (_req, res) => res.writeHead(200, { "Content-Type": "text/html" }).end(EPUB));
routes.set("/page.html", (_req, res) => res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><html><body>" + "x".repeat(5000) + "</body></html>"));
routes.set("/forbidden", (_req, res) => res.writeHead(403).end("no"));
routes.set("/unauthorized", (_req, res) => res.writeHead(401).end("no"));
routes.set("/broken", (_req, res) => res.writeHead(500).end("oops"));
routes.set("/empty", (_req, res) => res.writeHead(200).end());
routes.set("/ua", (req, res) => res.writeHead(200).end(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from(String(req.headers["user-agent"]))])));
routes.set("/redirect-1", (_req, res) => res.writeHead(302, { Location: "/redirect-2" }).end());
routes.set("/redirect-2", (_req, res) => res.writeHead(301, { Location: `http://127.0.0.1:${port}/book.pdf` }).end());
routes.set("/redirect-loop", (_req, res) => res.writeHead(302, { Location: "/redirect-loop" }).end());
routes.set("/redirect-metadata", (_req, res) => res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" }).end());
routes.set("/redirect-private-name", (_req, res) => res.writeHead(307, { Location: "http://intranet.example.test/x.pdf" }).end());
routes.set("/redirect-file", (_req, res) => res.writeHead(302, { Location: "file:///etc/passwd" }).end());
routes.set("/redirect-no-location", (_req, res) => res.writeHead(302).end());
routes.set("/declared-huge", (_req, res) => {
  res.writeHead(200, { "Content-Length": String(10 * 1024 * 1024) });
  res.write(PDF);
  // Never finishes: the client must give up on the declared size alone.
});
routes.set("/chunked-huge", (_req, res) => {
  res.writeHead(200, { "Content-Type": "application/pdf" }); // no Content-Length: chunked
  res.write("%PDF-1.4\n");
  const chunk = Buffer.alloc(16 * 1024, 0x20);
  let sent = 0;
  const pump = () => {
    while (sent < 50) {
      sent++;
      if (!res.write(chunk)) break;
    }
    if (sent < 50) res.once("drain", pump);
    else res.end();
  };
  pump();
});
let htmlStreamBytes = 0;
routes.set("/html-stream", (_req, res) => {
  htmlStreamBytes = 0;
  res.writeHead(200, { "Content-Type": "text/html" });
  const chunk = Buffer.from("<html>" + "a".repeat(4090));
  const timer = setInterval(() => {
    if (res.destroyed || htmlStreamBytes > 5 * 1024 * 1024) {
      clearInterval(timer);
      res.end();
      return;
    }
    htmlStreamBytes += chunk.length;
    res.write(chunk);
  }, 5);
  res.on("close", () => clearInterval(timer));
});
routes.set("/slow", () => {
  // Never answers.
});

const base = () => `http://127.0.0.1:${port}`;
const local = { allowLoopback: true, maxBytes: 1024 * 1024, timeoutMs: 5000 };

/** A resolver that maps test names to fixed addresses and never hits the network. */
const fakeResolver =
  (table: Record<string, string[]>): Resolver =>
  async (host) => {
    const addrs = table[host];
    if (!addrs) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
    return addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

async function failure(p: Promise<unknown>): Promise<RemoteFetchError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(RemoteFetchError);
    return err as RemoteFetchError;
  }
  throw new Error("expected the fetch to fail");
}

describe("fetchRemoteFile", () => {
  it("downloads a PDF and reports its format", async () => {
    const r = await fetchRemoteFile(`${base()}/book.pdf`, local);
    expect(r.format).toBe("pdf");
    expect(r.data.equals(PDF)).toBe(true);
    expect(r.url.pathname).toBe("/book.pdf");
  });

  it("detects an EPUB by content even when the server says text/html", async () => {
    const r = await fetchRemoteFile(`${base()}/book.epub`, local);
    expect(r.format).toBe("epub");
    expect(r.data.length).toBe(EPUB.length);
  });

  it("sends an honest Shelfwise User-Agent", async () => {
    const r = await fetchRemoteFile(`${base()}/ua`, local);
    expect(r.data.toString()).toContain("Shelfwise/1.0");
  });

  it("blocks loopback unless the escape hatch is on", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/book.pdf`, { ...local, allowLoopback: false }))).code).toBe("blocked");
    expect((await failure(fetchRemoteFile(`${base()}/book.pdf`, { maxBytes: 1024 * 1024 }))).code).toBe("blocked");
  });

  it.each([
    "http://2130706433/",
    "http://0x7f.1/",
    "http://0177.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.1/",
    "http://[fd00::1]/",
    "http://printer.local/",
    "http://metadata.google.internal/",
  ])("blocks %s without the hatch", async (url) => {
    expect((await failure(fetchRemoteFile(url, { maxBytes: 1024, resolve: fakeResolver({}) }))).code).toBe("blocked");
  });

  it("still blocks private, link-local and metadata addresses with the loopback hatch on", async () => {
    for (const url of ["http://169.254.169.254/latest/meta-data", "http://192.168.1.1/", "http://[fe80::1]/", "http://localhost/", "http://[::]/"]) {
      expect((await failure(fetchRemoteFile(url, { ...local, resolve: fakeResolver({}) }))).code).toBe("blocked");
    }
  });

  it("rejects a hostname if ANY resolved address is non-public", async () => {
    const resolve = fakeResolver({ "mixed.example.test": ["93.184.216.34", "10.0.0.5"], "meta.example.test": ["169.254.169.254"] });
    expect((await failure(fetchRemoteFile("http://mixed.example.test/a.pdf", { maxBytes: 1024, resolve }))).code).toBe("blocked");
    expect((await failure(fetchRemoteFile("http://meta.example.test/a.pdf", { maxBytes: 1024, resolve }))).code).toBe("blocked");
  });

  it("connects to the validated address while keeping the original Host header (no second lookup)", async () => {
    let calls = 0;
    const resolve: Resolver = async () => {
      calls++;
      return [{ address: "127.0.0.1", family: 4 }];
    };
    seenHosts.length = 0;
    const r = await fetchRemoteFile(`http://books.example.test:${port}/book.pdf`, { ...local, resolve });
    expect(r.format).toBe("pdf");
    expect(calls).toBe(1);
    expect(seenHosts).toEqual([`books.example.test:${port}`]);
  });

  it("maps a DNS failure to a network error", async () => {
    expect((await failure(fetchRemoteFile("http://nowhere.example.test/", { maxBytes: 1024, resolve: fakeResolver({}) }))).code).toBe("network");
  });

  it("maps a refused connection to a network error", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));
    expect((await failure(fetchRemoteFile(`http://127.0.0.1:${closedPort}/`, local))).code).toBe("network");
  });

  it("follows up to 3 redirects", async () => {
    const r = await fetchRemoteFile(`${base()}/redirect-1`, local);
    expect(r.format).toBe("pdf");
    expect(r.url.pathname).toBe("/book.pdf");
  });

  it("gives up after too many redirects", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/redirect-loop`, local))).code).toBe("too-many-redirects");
  });

  it("re-validates every redirect hop", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/redirect-metadata`, local))).code).toBe("blocked");
    const resolve = fakeResolver({ "127.0.0.1": ["127.0.0.1"], "intranet.example.test": ["10.1.2.3"] });
    expect((await failure(fetchRemoteFile(`${base()}/redirect-private-name`, { ...local, resolve }))).code).toBe("blocked");
    expect((await failure(fetchRemoteFile(`${base()}/redirect-file`, local))).code).toBe("blocked");
  });

  it("treats a redirect without Location as an HTTP error", async () => {
    const err = await failure(fetchRemoteFile(`${base()}/redirect-no-location`, local));
    expect(err.code).toBe("http-error");
    expect(err.status).toBe(302);
  });

  it("maps 401/403 to a refusal and other statuses to an HTTP error", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/forbidden`, local))).code).toBe("refused");
    expect((await failure(fetchRemoteFile(`${base()}/unauthorized`, local))).code).toBe("refused");
    const notFound = await failure(fetchRemoteFile(`${base()}/missing`, local));
    expect([notFound.code, notFound.status]).toEqual(["http-error", 404]);
    const broken = await failure(fetchRemoteFile(`${base()}/broken`, local));
    expect([broken.code, broken.status]).toEqual(["http-error", 500]);
  });

  it("rejects a web page and an empty body as not a book", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/page.html`, local))).code).toBe("not-a-book");
    expect((await failure(fetchRemoteFile(`${base()}/empty`, local))).code).toBe("not-a-book");
  });

  it("stops reading an endless HTML stream early", async () => {
    const err = await failure(fetchRemoteFile(`${base()}/html-stream`, { ...local, maxBytes: 50 * 1024 * 1024 }));
    expect(err.code).toBe("not-a-book");
    expect(htmlStreamBytes).toBeLessThan(256 * 1024);
  });

  it("rejects early when Content-Length declares more than the limit", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/declared-huge`, { ...local, maxBytes: 1024 * 1024 }))).code).toBe("too-large");
  });

  it("enforces the size cap on a chunked body without Content-Length", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/chunked-huge`, { ...local, maxBytes: 256 * 1024 }))).code).toBe("too-large");
    // The same body fits a larger cap.
    const r = await fetchRemoteFile(`${base()}/chunked-huge`, { ...local, maxBytes: 1024 * 1024 });
    expect(r.format).toBe("pdf");
  });

  it("times out", async () => {
    expect((await failure(fetchRemoteFile(`${base()}/slow`, { ...local, timeoutMs: 300 }))).code).toBe("timeout");
  });

  it("rejects invalid input before any network access", async () => {
    let called = false;
    const resolve: Resolver = async () => {
      called = true;
      return [];
    };
    expect((await failure(fetchRemoteFile("ftp://example.com/a.pdf", { maxBytes: 1024, resolve }))).code).toBe("invalid-url");
    expect((await failure(fetchRemoteFile("https://u:p@example.com/a.pdf", { maxBytes: 1024, resolve }))).code).toBe("blocked");
    expect(called).toBe(false);
  });
});
