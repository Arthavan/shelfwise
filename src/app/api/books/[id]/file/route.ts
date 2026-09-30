import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { ERROR_TOAST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensureInitialized } from "@/lib/data/maintenance";
import { attachFile, getFile, removeFileRow } from "@/lib/data/reading";
import { deleteBookFiles, resolveStoragePath, saveBookFile } from "@/lib/file-storage";
import { parseRange } from "@/lib/http-range";
import { isSameOrigin } from "@/lib/request-guard";
import { detectFormat, maxUploadBytes } from "@/lib/upload";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const json = (body: object, status: number) => NextResponse.json(body, { status });
/** Any unexpected failure (disk, database) becomes a JSON error the client can show, never a bare 500. */
async function orServerError(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch {
    return json({ ok: false, error: ERROR_TOAST }, 500);
  }
}

const MIME = { pdf: "application/pdf", epub: "application/epub+zip" } as const;

export async function GET(request: Request, { params }: Ctx) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Not found" }, 404);
  await ensureInitialized(db);
  const file = await getFile(db, id.data);
  if (!file) return json({ ok: false, error: "Not found" }, 404);

  let full: string;
  let size: number;
  try {
    full = resolveStoragePath(file.storagePath);
    size = (await stat(full)).size;
  } catch {
    return json({ ok: false, error: "File missing" }, 404);
  }

  const headers: Record<string, string> = {
    "Content-Type": MIME[file.format],
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "Content-Disposition": `inline; filename="book.${file.format}"`,
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(request.headers.get("range"), size);
  if (range.kind === "invalid") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  if (range.kind === "full") {
    return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
  }
  const { start, end } = range;
  return new NextResponse(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}

export async function POST(request: Request, ctx: Ctx) {
  return orServerError(() => upload(request, ctx));
}

async function upload(request: Request, { params }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Cross-origin requests are not allowed" }, 403);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Book not found" }, 404);
  const limit = maxUploadBytes();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit + 1024 * 1024) return json({ ok: false, error: `File is too large (max ${Math.round(limit / 1048576)} MB)` }, 413);

  await ensureInitialized(db);
  const book = await db.book.findFirst({ where: { id: id.data, deletedAt: null }, select: { id: true } });
  if (!book) return json({ ok: false, error: "Book not found" }, 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Upload could not be read" }, 400);
  }
  const entry = form.get("file");
  if (!(entry instanceof File) || entry.size === 0) return json({ ok: false, error: "Choose a PDF or EPUB file" }, 400);
  if (entry.size > limit) return json({ ok: false, error: `File is too large (max ${Math.round(limit / 1048576)} MB)` }, 413);

  const data = Buffer.from(await entry.arrayBuffer());
  const format = detectFormat(data);
  if (!format) return json({ ok: false, error: "That file isn't a PDF or EPUB" }, 415);

  const pageCountRaw = Number(form.get("pageCount"));
  const pageCount = format === "pdf" && Number.isInteger(pageCountRaw) && pageCountRaw > 0 && pageCountRaw <= 100_000 ? pageCountRaw : null;

  const storagePath = await saveBookFile(id.data, format, data);
  await attachFile(db, id.data, { format, originalName: entry.name.slice(0, 200), storagePath, sizeBytes: data.length, pageCount });
  revalidatePath("/", "layout");
  return json({ ok: true, format, sizeBytes: data.length }, 200);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return orServerError(() => remove(request, ctx));
}

async function remove(request: Request, { params }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Cross-origin requests are not allowed" }, 403);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ ok: false, error: "Book not found" }, 404);
  await ensureInitialized(db);
  await removeFileRow(db, id.data);
  await deleteBookFiles(id.data);
  revalidatePath("/", "layout");
  return json({ ok: true }, 200);
}
