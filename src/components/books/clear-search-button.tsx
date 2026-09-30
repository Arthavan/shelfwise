"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { buildLibraryHref } from "@/lib/library";
import type { LibraryParams } from "@/lib/types";

/** Empty-state action for a search with no matches. Keeps status and sort. */
export function ClearSearchButton({ params }: { params: LibraryParams }) {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" onClick={() => router.replace(buildLibraryHref(params, { q: "" }), { scroll: false })}>
      Clear search
    </Button>
  );
}
