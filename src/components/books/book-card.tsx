import Link from "next/link";

import { BookCover } from "@/components/books/book-cover";
import { ReadingProgress } from "@/components/books/reading-progress";
import { RatingControl } from "@/components/books/rating-control";
import { StatusSelect } from "@/components/books/status-select";
import { Button } from "@/components/ui/button";
import type { Book, ReadingSummary } from "@/lib/types";

/** One book on the shelf. Only the title is a link: the card itself holds controls (DESIGN §5.7). */
export function BookCard({ book, reading }: { book: Book; reading?: ReadingSummary }) {
  const titleId = `book-${book.id}-title`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex h-full gap-4 rounded-lg border bg-card p-4 text-card-foreground transition-colors duration-150 hover:border-foreground/20"
    >
      <BookCover title={book.title} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id={titleId} className="line-clamp-2 font-serif text-lg font-medium leading-6">
          <Link
            href={`/books/${book.id}`}
            className="rounded-sm decoration-primary/60 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {book.title}
          </Link>
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">{book.author}</p>
        <div className="mt-auto space-y-3 pt-4">
          {reading ? (
            <div className="space-y-2">
              {reading.hasProgress ? <ReadingProgress percent={reading.percent} /> : null}
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/books/${book.id}/read`}
                  aria-label={`${reading.lastReadAt ? "Continue reading" : "Read"} ${book.title}`}
                >
                  {reading.lastReadAt ? "Continue" : "Read"}
                </Link>
              </Button>
            </div>
          ) : null}
          <StatusSelect bookId={book.id} title={book.title} status={book.status} />
          {book.status === "finished" ? <RatingControl bookId={book.id} rating={book.rating} size="sm" /> : null}
        </div>
      </div>
    </article>
  );
}
