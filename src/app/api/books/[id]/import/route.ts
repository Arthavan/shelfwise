import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { storeBookFile } from "@/lib/data/book-file";
import { ensureInitialized } from "@/lib/data/maintenance";
import { fetchRemoteFile, fileNameFromUrl, loopbackAllowed, MAX_URL_LENGTH, RemoteFetchError, remoteFetchMessage, type RemoteFetchCode } from "@/lib/remote-fetch";
import { isSameOrigin, readLimitedText } from "@/lib/request-guard";
import { maxUploadBytes } from "@/lib/upload";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const json = (body: object, status: number) => NextResponse.json(body, { status });

const bodySchema = z.object({ url: z.string().max(MAX_URL_LENGTH * 2) });
/** The JSON body only carries a link: anything bigger is refused before it is read. */
const MAX_BODY_BYTES = 8 * 1024;

const STATUS: Record<RemoteFetchCode, number> = {
  "invalid-url": 400,
  blocked: 400,
  refused: 502,
  "http-error": 502,
  "not-a-book": 415,
  "too-large": 413,
  timeout: 504,
  network: 502,
  truncated: 502,
  "too-many-redirects": 502,
};

/** POST { url }: downloads a PDF/EPUB from the link server-side and stores it exactly like an upload. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    return await importFromLink(request, ctx);
  } catch {
    // Unexpected failures (disk, database) become a JSON error the client can show, never a bare 500.
    return json({ ok: false, error: ERROR_TOAST }, 500);
  }
}

async function importFromLink(request: Request, { params }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Cross-origin requests are not allowed" }, 403);
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ ok: false, error: "Expected a JSON body" }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: "Request is too large" }, 413);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Book not found" }, 404);

  await ensureInitialized(db);
  const book = await db.book.findFirst({ where: { id: id.data, deletedAt: null }, select: { id: true } });
  if (!book) return json({ ok: false, error: "Book not found" }, 404);

  const limit = maxUploadBytes();
  const text = await readLimitedText(request, MAX_BODY_BYTES);
  if (text === null) return json({ ok: false, error: "Request is too large" }, 413);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Treated like a missing link below.
  }
  const body = bodySchema.safeParse(parsed);
  if (!body.success) return json({ ok: false, error: remoteFetchMessage(new RemoteFetchError("invalid-url"), limit) }, 400);

  let remote;
  try {
    remote = await fetchRemoteFile(body.data.url, { maxBytes: limit, allowLoopback: loopbackAllowed() });
  } catch (err) {
    if (err instanceof RemoteFetchError) return json({ ok: false, error: remoteFetchMessage(err, limit) }, STATUS[err.code]);
    throw err;
  }

  // No page count for imports: the server has no PDF parser. The reader reads it from the file.
  // storeBookFile re-checks the book is live now that the download is done (it may have been deleted).
  const stored = await storeBookFile(db, id.data, remote.data, fileNameFromUrl(remote.url, remote.format), null);
  if (!stored.ok) {
    if (stored.reason === "not-found") return json({ ok: false, error: "Book not found" }, 404);
    return json({ ok: false, error: remoteFetchMessage(new RemoteFetchError("not-a-book"), limit) }, 415);
  }
  revalidatePath("/", "layout");
  return json({ ok: true, format: stored.format, sizeBytes: stored.sizeBytes }, 200);
}
