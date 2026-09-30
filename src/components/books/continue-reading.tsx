import Link from "next/link";

import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";

export interface ContinueItem {
  id: string;
  title: string;
  author: string;
  percent: number;
}

/** "Continue reading" row: books in progress, most recently read first. Not `article`s, so it never counts as shelf cards. */
export function ContinueReading({ items }: { items: readonly ContinueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="continue-reading-heading" className="mb-6">
      <h2 id="continue-reading-heading" className="text-base font-semibold">
        Continue reading
      </h2>
      <ul className="mt-3 grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-3">
            <BookCover title={item.title} size="sm" />
            <div className="min-w-0 flex-1">
              <p data-continue-title className="line-clamp-2 font-serif font-medium leading-5">
                {item.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{Math.round(item.percent)}% read</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href={`/books/${item.id}/read`} aria-label={`Continue reading ${item.title}`}>
                  Continue
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
