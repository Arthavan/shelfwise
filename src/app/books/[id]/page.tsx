import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { BookCover } from "@/components/books/book-cover";
import { BookDetails } from "@/components/books/book-details";
import { RatingControl } from "@/components/books/rating-control";
import { StatusSelect } from "@/components/books/status-select";
import { Button } from "@/components/ui/button";
import { getBook } from "@/lib/data/books";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  return { title: book ? book.title : "Book not found" };
}

export default async function BookDetailPage({ params }: PageProps) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
          Back to library
        </Link>
      </Button>

      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-8">
        <BookCover title={book.title} size="lg" className="sm:row-span-2" />
        <div className="min-w-0">
          <h1 className="break-words font-serif text-3xl font-medium tracking-tight sm:text-4xl">{book.title}</h1>
          <p className="mt-1 break-words text-base text-muted-foreground">{book.author}</p>
        </div>
        <div className="col-span-2 space-y-4 sm:col-span-1 sm:col-start-2 sm:max-w-sm">
          <StatusSelect bookId={book.id} title={book.title} status={book.status} />
          {book.status === "finished" ? <RatingControl bookId={book.id} rating={book.rating} size="md" /> : null}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Link href={`/books/${book.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <BookDetails book={book} />
    </div>
  );
}
