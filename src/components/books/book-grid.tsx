import { BookCard } from "@/components/books/book-card";
import type { Book, ReadingSummary } from "@/lib/types";

export function BookGrid({ books, readingByBook }: { books: readonly Book[]; readingByBook?: Record<string, ReadingSummary> }) {
  return (
    <ul aria-label="Books" className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => (
        <li key={book.id} className="min-w-0">
          <BookCard book={book} reading={readingByBook?.[book.id]} />
        </li>
      ))}
    </ul>
  );
}
