import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <EmptyState
      as="h1"
      bordered={false}
      className="mt-8 sm:mt-16"
      icon={Compass}
      title="Page not found"
      description="That page doesn't exist or has moved."
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
