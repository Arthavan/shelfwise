"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createBook, updateBook } from "@/app/books/actions";
import { RatingInput } from "@/components/books/rating-input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ERROR_TOAST, STATUSES, STATUS_LABELS, TOAST } from "@/lib/constants";
import type { Book, BookFormValues } from "@/lib/types";
import { bookFormSchema } from "@/lib/validation";

const NOTES_LIMIT = 2000;

type BookFormProps = { mode: "create"; book?: undefined } | { mode: "edit"; book: Book };

function defaultValues(book: Book | undefined): BookFormValues {
  return {
    title: book?.title ?? "",
    author: book?.author ?? "",
    status: book?.status ?? "want",
    pages: book?.pages != null ? String(book.pages) : "",
    notes: book?.notes ?? "",
    rating: book?.status === "finished" ? (book.rating ?? null) : null,
  };
}

const FIELD_NAMES = ["title", "author", "status", "pages", "notes", "rating"] as const;
type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(name: string): name is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(name);
}

export function BookForm({ mode, book }: BookFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: defaultValues(book),
  });

  const status = useWatch({ control: form.control, name: "status" });
  const notesLength = useWatch({ control: form.control, name: "notes" }).length;
  const pending = form.formState.isSubmitting || saved;
  const isEdit = mode === "edit";
  const cancelHref = isEdit ? `/books/${book.id}` : "/";

  async function onSubmit(values: BookFormValues) {
    try {
      const result = isEdit ? await updateBook(book.id, values) : await createBook(values);
      if (result.ok) {
        setSaved(true);
        toast.success(isEdit ? TOAST.changesSaved : TOAST.bookAdded);
        router.push(isEdit ? `/books/${result.data.id}` : "/");
        return;
      }
      const entries = Object.entries(result.fieldErrors ?? {});
      if (entries.length > 0) {
        for (const [name, message] of entries) {
          if (message && isFieldName(name)) form.setError(name, { type: "server", message });
        }
        form.setFocus(entries.map(([name]) => name).find(isFieldName) ?? "title");
        return;
      }
      toast.error(result.error === "Book not found" ? result.error : ERROR_TOAST);
    } catch {
      toast.error(ERROR_TOAST);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} autoFocus={!isEdit} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="author"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Author</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <NativeSelect
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(event) => {
                      const next = event.target.value;
                      field.onChange(next);
                      if (next !== "finished") form.setValue("rating", null, { shouldDirty: true });
                    }}
                  >
                    {STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pages"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between">
                  <FormLabel>Pages</FormLabel>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <FormControl>
                  <Input {...field} type="text" inputMode="numeric" placeholder="e.g. 320" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between">
                <FormLabel>Notes</FormLabel>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <FormControl>
                <Textarea
                  {...field}
                  rows={5}
                  placeholder="What stood out, who recommended it…"
                  className="min-h-32 resize-y"
                />
              </FormControl>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <FormMessage />
                </div>
                <span
                  aria-hidden="true"
                  className={
                    notesLength > NOTES_LIMIT
                      ? "ml-auto text-xs font-medium tabular-nums text-destructive"
                      : "ml-auto text-xs font-medium tabular-nums text-muted-foreground"
                  }
                >
                  {notesLength} / {NOTES_LIMIT}
                </span>
              </div>
            </FormItem>
          )}
        />

        {status === "finished" ? (
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <RatingInput
                className="animate-in fade-in-0 duration-150"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending} className="min-w-28">
            {pending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Save book"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
