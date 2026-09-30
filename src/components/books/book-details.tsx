import { formatDate, formatNumber } from "@/lib/format";
import type { Book } from "@/lib/types";

interface BookDetailsProps {
  book: Book;
}

/**
 * The "Details" and "Notes" surfaces of the detail page (DESIGN §6.4).
 * Each row is `<dt>Label</dt>{" "}<dd>Value</dd>` so the text reads "Finished on Sep 30, 2026".
 * Server component: dates are formatted with the server's time zone.
 */
export function BookDetails({ book }: BookDetailsProps) {
  const rows: { label: string; value: string }[] = [
    { label: "Pages", value: book.pages !== null ? formatNumber(book.pages) : "—" },
    { label: "Added on", value: formatDate(book.createdAt) },
    { label: "Started on", value: formatDate(book.startedAt) },
    { label: "Finished on", value: formatDate(book.finishedAt) },
  ];

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="book-details-heading" className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="book-details-heading" className="font-serif text-xl font-medium">
          Details
        </h2>
        <dl className="mt-2 divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>{" "}
              <dd className="text-right text-sm font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="book-notes-heading" className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="book-notes-heading" className="font-serif text-xl font-medium">
          Notes
        </h2>
        {book.notes ? (
          <p className="mt-4 whitespace-pre-wrap break-words text-base leading-relaxed">{book.notes}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No notes yet</p>
        )}
      </section>
    </div>
  );
}
