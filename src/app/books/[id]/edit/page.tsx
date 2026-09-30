import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookForm } from "@/components/books/book-form";
import { getBook } from "@/lib/data/books";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit book" };

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">Edit book</h1>
          <p className="mt-1 text-sm text-muted-foreground">Update the details and save your changes.</p>
        </div>
      </header>
      <div className="max-w-xl rounded-lg border bg-card p-4 sm:p-6">
        <BookForm mode="edit" book={book} />
      </div>
    </div>
  );
}
