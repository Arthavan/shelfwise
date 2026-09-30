import { lookup as dnsLookup } from "node:dns/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { detectFormat } from "@/lib/upload";

/*
 * Server-side download of a book file from a user-supplied link, hardened against SSRF:
 *   - http/https only, no credentials in the URL, no localhost/.local/.internal names;
 *   - every address the name resolves to must be public (loopback only with the e2e hatch);
 *   - the connection is pinned to the validated address (custom `lookup`), so a second DNS answer
 *     (rebinding) can never redirect the socket, while Host/SNI keep the original name;
 *   - redirects are followed by hand (max 3) and every hop is validated again;
 *   - 30 s overall timeout, a streamed size cap, and an early content sniff so a web page is dropped
 *     after its first kilobyte instead of being downloaded in full.
 */

export type RemoteFetchCode =
  | "invalid-url"
  | "blocked"
  | "refused"
  | "http-error"
  | "not-a-book"
  | "too-large"
  | "timeout"
  | "network"
  | "too-many-redirects";

export class RemoteFetchError extends Error {
  constructor(
    readonly code: RemoteFetchCode,
    readonly status?: number,
  ) {
    super(status ? `${code} (HTTP ${status})` : code);
    this.name = "RemoteFetchError";
  }
}

/** The copy shown to the user; never includes anything the remote site sent. */
export function remoteFetchMessage(err: RemoteFetchError, maxBytes: number): string {
  switch (err.code) {
    case "invalid-url":
      return "Enter a full web address starting with http:// or https://";
    case "blocked":
      return "That address isn't allowed";
    case "refused":
      return "The site refused the download (it may only allow its own viewer)";
    case "http-error":
      return `The site returned an error (HTTP ${err.status ?? "error"})`;
    case "not-a-book":
      return "That link is a web page, not a PDF or EPUB file";
    case "too-large":
      return `File is too large (max ${Math.round(maxBytes / 1048576)} MB)`;
    case "timeout":
      return "The download took too long";
    case "too-many-redirects":
      return "The link redirected too many times";
    case "network":
      return "Couldn't reach that address";
  }
}

export const USER_AGENT = "Shelfwise/1.0";
export const MAX_URL_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 3;
/** detectFormat only ever looks at the first 1 KB, so this prefix decides the format for good. */
const SNIFF_BYTES = 1024;

// ---------- address classification ----------

export type AddressClass = "public" | "loopback" | "blocked";

function parseIPv4(s: string): number | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

/** Eight 16-bit groups, or null. Accepts "::" compression and a dotted IPv4 tail. */
function parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  const lastColon = s.lastIndexOf(":");
  if (s.slice(lastColon + 1).includes(".")) {
    // Rewrite a dotted IPv4 tail as two hex groups.
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const explicit = head.length + rest.length;
  if (halves.length === 1 ? explicit !== 8 : explicit > 7) return null;
  const groups = halves.length === 2 ? [...head, ...Array<string>(8 - explicit).fill("0"), ...rest] : head;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function inV4(n: number, base: string, bits: number): boolean {
  const b = parseIPv4(base)!;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((n & mask) >>> 0) === ((b & mask) >>> 0);
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], // "this network", includes unspecified
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

function classifyV4(n: number): AddressClass {
  if (inV4(n, "127.0.0.0", 8)) return "loopback";
  return V4_BLOCKED.some(([base, bits]) => inV4(n, base, bits)) ? "blocked" : "public";
}

function classifyV6(g: number[]): AddressClass {
  const v4 = (g[6] << 16) + g[7];
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 7) && g[7] === 1) return "loopback"; // ::1
  if (zeros(0, 5) && g[5] === 0xffff) return classifyV4(v4 >>> 0); // ::ffff:a.b.c.d (IPv4-mapped)
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return classifyV4(v4 >>> 0); // 64:ff9b::/96 NAT64
  if (zeros(0, 6)) return "blocked"; // ::, ::a.b.c.d (deprecated IPv4-compatible)
  // Only global unicast (2000::/3) can be public; this excludes fc00::/7, fe80::/10, fec0::/10, ff00::/8...
  if ((g[0] & 0xe000) !== 0x2000) return "blocked";
  if (g[0] === 0x2001 && g[1] === 0x0db8) return "blocked"; // documentation
  if (g[0] === 0x2001 && g[1] < 0x0200) return "blocked"; // 2001::/23 IETF special purpose (Teredo, ORCHID...)
  if (g[0] === 0x2002) return classifyV4(((g[1] << 16) + g[2]) >>> 0); // 6to4 embeds an IPv4 address
  return "public";
}

/** Classifies an IP address string (IPv4 or IPv6, brackets optional). Anything unparsable is blocked. */
export function classifyAddress(address: string): AddressClass {
  const s = address.replace(/^\[|\]$/g, "");
  const kind = isIP(s.split("%")[0]);
  if (kind === 4) {
    const n = parseIPv4(s);
    return n === null ? "blocked" : classifyV4(n);
  }
  if (kind === 6) {
    const g = parseIPv6(s);
    return g === null ? "blocked" : classifyV6(g);
  }
  return "blocked";
}

/** Names that always point inside the machine or the local network. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}

/** The e2e escape hatch: loopback targets are allowed only when E2E_TEST_HOOKS is exactly "1". */
export function loopbackAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.E2E_TEST_HOOKS === "1";
}

// ---------- URL handling ----------

function assertFetchableUrl(url: URL, onBadScheme: RemoteFetchCode): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new RemoteFetchError(onBadScheme);
  if (url.username || url.password) throw new RemoteFetchError("blocked");
}

/** Parses what the user typed; throws RemoteFetchError("invalid-url" | "blocked"). */
export function parseRemoteUrl(input: string): URL {
  const text = input.trim();
  if (text === "" || text.length > MAX_URL_LENGTH) throw new RemoteFetchError("invalid-url");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new RemoteFetchError("invalid-url");
  }
  assertFetchableUrl(url, "invalid-url");
  return url;
}

/** The stored display name: the link's last path segment, decoded and cleaned, or "imported.<format>". */
export function fileNameFromUrl(url: URL, format: "pdf" | "epub"): string {
  const segment = url.pathname.split("/").pop() ?? "";
  let name: string;
  try {
    name = decodeURIComponent(segment);
  } catch {
    name = segment;
  }
  name = name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim();
  return (name || `imported.${format}`).slice(0, 200);
}

// ---------- fetching ----------

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const systemResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export interface FetchRemoteOptions {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Allow 127.0.0.0/8 and ::1 (e2e only). Private, link-local and metadata addresses stay blocked. */
  allowLoopback?: boolean;
  /** DNS resolution; injectable so tests never touch the network. */
  resolve?: Resolver;
}

export interface RemoteFile {
  data: Buffer;
  format: "pdf" | "epub";
  /** The final URL after redirects. */
  url: URL;
}

interface Target {
  address: string;
  family: 4 | 6;
}

async function resolveTarget(url: URL, allowLoopback: boolean, resolve: Resolver): Promise<Target> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const allowed = (address: string) => {
    const c = classifyAddress(address);
    return c === "public" || (c === "loopback" && allowLoopback);
  };
  const literal = isIP(host);
  if (literal) {
    if (!allowed(host)) throw new RemoteFetchError("blocked");
    return { address: host, family: literal as 4 | 6 };
  }
  if (isBlockedHostname(host)) throw new RemoteFetchError("blocked");
  let addresses: { address: string; family: number }[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new RemoteFetchError("network");
  }
  if (addresses.length === 0) throw new RemoteFetchError("network");
  if (!addresses.every((a) => allowed(a.address))) throw new RemoteFetchError("blocked");
  const first = addresses[0];
  return { address: first.address, family: isIP(first.address) === 6 ? 6 : 4 };
}

/** A `lookup` that always answers with the address we already validated (defeats DNS rebinding). */
function pinnedLookup(target: Target): LookupFunction {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options?.all) callback(null, [{ address: target.address, family: target.family }]);
    else callback(null, target.address, target.family);
  }) as LookupFunction;
}

function requestOnce(url: URL, target: Target, signal: AbortSignal): Promise<IncomingMessage> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const secure = url.protocol === "https:";
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        lookup: pinnedLookup(target),
        agent: false,
        signal,
        ...(secure && !isIP(hostname) ? { servername: hostname } : {}),
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function readBody(res: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RemoteFetchError("too-large");
  const chunks: Buffer[] = [];
  let total = 0;
  let sniffed = false;
  for await (const chunk of res as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new RemoteFetchError("too-large");
    chunks.push(chunk);
    if (!sniffed && total >= SNIFF_BYTES) {
      sniffed = true;
      if (!detectFormat(Buffer.concat(chunks).subarray(0, SNIFF_BYTES))) throw new RemoteFetchError("not-a-book");
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Downloads a PDF or EPUB from `input`. Throws RemoteFetchError for every expected failure; the
 * response body and headers are never exposed beyond the returned bytes.
 */
export async function fetchRemoteFile(input: string, options: FetchRemoteOptions): Promise<RemoteFile> {
  const { maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS, maxRedirects = DEFAULT_MAX_REDIRECTS, allowLoopback = false, resolve = systemResolver } = options;
  let url = parseRemoteUrl(input);
  const signal = AbortSignal.timeout(timeoutMs);
  let res: IncomingMessage | null = null;
  try {
    for (let hop = 0; ; hop++) {
      const target = await resolveTarget(url, allowLoopback, resolve);
      if (signal.aborted) throw new RemoteFetchError("timeout");
      res = await requestOnce(url, target, signal);
      const status = res.statusCode ?? 0;
      if (!REDIRECTS.has(status)) break;
      const location = res.headers.location;
      res.destroy();
      res = null;
      if (!location) throw new RemoteFetchError("http-error", status);
      if (hop >= maxRedirects) throw new RemoteFetchError("too-many-redirects");
      try {
        url = new URL(location, url);
      } catch {
        throw new RemoteFetchError("blocked");
      }
      assertFetchableUrl(url, "blocked");
    }
    const status = res.statusCode ?? 0;
    if (status === 401 || status === 403) throw new RemoteFetchError("refused", status);
    if (status < 200 || status > 299) throw new RemoteFetchError("http-error", status);
    const current = res;
    signal.addEventListener("abort", () => current.destroy(), { once: true });
    const data = await readBody(res, maxBytes);
    const format = detectFormat(data);
    if (!format) throw new RemoteFetchError("not-a-book");
    return { data, format, url };
  } catch (err) {
    if (err instanceof RemoteFetchError) throw err;
    if (signal.aborted) throw new RemoteFetchError("timeout");
    throw new RemoteFetchError("network");
  } finally {
    res?.destroy();
  }
}
