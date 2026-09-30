"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      as="h1"
      bordered={false}
      className="mt-8 sm:mt-16"
      icon={TriangleAlert}
      iconClassName="text-destructive"
      title="Something went wrong"
      description="This page didn't load. Your books are still here."
      action={
        <Button
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      }
    />
  );
}
