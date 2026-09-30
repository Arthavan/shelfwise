import type { Metadata } from "next";

import { BookGrid } from "@/components/books/book-grid";
import { LibraryEmpty } from "@/components/books/library-empty";
import { StatusTabs } from "@/components/books/status-tabs";
import { listBooks } from "@/lib/data/books";
import { buildLibraryHref, countByStatus, filterAndSortBooks, parseLibraryParams } from "@/lib/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseLibraryParams(await searchParams);
  const books = await listBooks();
  const counts = countByStatus(books);
  const visible = filterAndSortBooks(books, params);

  let content: React.ReactNode;
  if (counts.all === 0) {
    content = <LibraryEmpty kind="shelf" />;
  } else if (params.q !== "" && visible.length === 0) {
    content = <LibraryEmpty kind="search" query={params.q} />;
  } else if (visible.length === 0 && params.status !== "all") {
    content = <LibraryEmpty kind="tab" status={params.status} allHref={buildLibraryHref(params, { status: "all" })} />;
  } else {
    content = <BookGrid books={visible} />;
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you want to read, are reading and have finished.</p>
        </div>
      </header>
      <StatusTabs params={params} counts={counts} />
      <div id="library-toolbar-slot" className="mt-4" />
      <div className="mt-6">{content}</div>
    </div>
  );
}
