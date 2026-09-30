import { BookForm } from "@/components/books/book-form";

export const metadata = { title: "Add book" };

export default function Page() {
  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">Add book</h1>
          <p className="mt-1 text-sm text-muted-foreground">Save a book to your shelf.</p>
        </div>
      </header>
      <div className="max-w-xl rounded-lg border bg-card p-4 sm:p-6">
        <BookForm mode="create" />
      </div>
    </div>
  );
}
