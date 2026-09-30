import Link from "next/link";
import { BookCheck, BookOpen, Bookmark, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants";
import type { BookStatus } from "@/lib/types";

type LibraryEmptyProps =
  | { kind: "shelf" }
  /** `action` is the "Clear search" button (a client component supplied by the page). */
  | { kind: "search"; query: string; action?: ReactNode }
  | { kind: "tab"; status: BookStatus; allHref: string };

const TAB_COPY = {
  want: { icon: Bookmark, line: "Save a book you'd like to read next." },
  reading: { icon: BookOpen, line: "Set a book to Reading when you start it." },
  finished: { icon: BookCheck, line: "Finished books and their ratings appear here." },
} as const;

/** The three library empty states (DESIGN §6.1). */
export function LibraryEmpty(props: LibraryEmptyProps) {
  if (props.kind === "shelf") {
    return (
      <EmptyState
        icon={BookOpen}
        title="Your shelf is empty"
        description="Add the books you want to read, are reading or have finished."
        action={
          <Button asChild>
            <Link href="/books/new">
              <Plus aria-hidden="true" />
              Add your first book
            </Link>
          </Button>
        }
      />
    );
  }
  if (props.kind === "search") {
    return (
      <EmptyState
        icon={Search}
        title={`No books match "${props.query}"`}
        description="Try a different title or author."
        action={props.action}
      />
    );
  }
  const copy = TAB_COPY[props.status];
  return (
    <EmptyState
      icon={copy.icon}
      title={`No books in ${STATUS_LABELS[props.status]}`}
      description={copy.line}
      action={
        <Button asChild variant="outline">
          <Link href={props.allHref}>View all books</Link>
        </Button>
      }
    />
  );
}
