import Link from "next/link";
import { ArrowLeft, BookX } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Book not found" };

export default function BookNotFound() {
  return (
    <EmptyState
      as="h1"
      bordered={false}
      className="mt-8 sm:mt-16"
      icon={BookX}
      title="Book not found"
      description="It may have been deleted, or the link is wrong."
      action={
        <Button asChild>
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Back to library
          </Link>
        </Button>
      }
    />
  );
}
