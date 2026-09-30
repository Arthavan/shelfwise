import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReaderShell } from "@/components/reader/reader-shell";
import { getBook, getBookReading } from "@/lib/data/books";
import { listBookmarks, listHighlights } from "@/lib/data/reading";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const book = await getBook((await params).id);
  return { title: book ? `Reading ${book.title}` : "Book not found" };
}

export default async function ReadPage({ params }: PageProps) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  const { file, progress } = await getBookReading(id);
  if (!file || file.missing) redirect(`/books/${id}`); // detail page shows the upload / "file missing" state
  const [bookmarks, highlights] = await Promise.all([listBookmarks(db, id), listHighlights(db, id)]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <ReaderShell
        data={{ bookId: id, title: book.title, status: book.status, format: file.format, fileUrl: `/api/books/${id}/file`, pageCount: file.pageCount, progress, bookmarks, highlights }}
      />
    </div>
  );
}
