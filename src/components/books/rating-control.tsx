"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

import { clearRating, rateBook } from "@/app/books/status-actions";
import { Button } from "@/components/ui/button";
import { ERROR_TOAST, TOAST } from "@/lib/constants";
import { rateButtonLabel, ratedLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface RatingControlProps {
  bookId: string;
  rating: number | null;
  size: "sm" | "md";
}

/**
 * Rate / display / clear for a finished book. Both states render two rows of equal height,
 * so rating or clearing never shifts the layout (DESIGN §5.5). The rated display is a
 * `role="img"` with no text node (ARCHITECTURE D1).
 */
export function RatingControl({ bookId, rating, size }: RatingControlProps) {
  const labelId = useId();
  const [optimistic, setOptimistic] = useOptimistic(rating);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<number | null>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const firstStarRef = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<"clear" | "star" | null>(null);

  // The control that had focus is replaced by the other state; keep keyboard users in place.
  useEffect(() => {
    if (focusTarget.current === "clear" && optimistic !== null) clearRef.current?.focus();
    if (focusTarget.current === "star" && optimistic === null) firstStarRef.current?.focus();
    if (focusTarget.current !== null) focusTarget.current = null;
  }, [optimistic]);

  function rate(value: number) {
    focusTarget.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible") ? "clear" : null;
    setPreview(null);
    startTransition(async () => {
      setOptimistic(value);
      const result = await rateBook({ id: bookId, rating: value });
      if (result.ok) toast.success(ratedLabel(value));
      else toast.error(ERROR_TOAST);
    });
  }

  function clear() {
    focusTarget.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible") ? "star" : null;
    startTransition(async () => {
      setOptimistic(null);
      const result = await clearRating({ id: bookId });
      if (result.ok) toast.success(TOAST.ratingCleared);
      else toast.error(ERROR_TOAST);
    });
  }

  if (optimistic === null) {
    return (
      <div role="group" aria-labelledby={labelId}>
        <div className="flex items-baseline justify-between gap-2">
          <span id={labelId} className="text-sm font-medium">
            Rate this book
          </span>
          <span className="text-sm text-muted-foreground">Not rated</span>
        </div>
        <div className="-ml-2.5 flex" onMouseLeave={() => setPreview(null)}>
          {STARS.map((n) => (
            <button
              key={n}
              ref={n === 1 ? firstStarRef : undefined}
              type="button"
              aria-label={rateButtonLabel(n)}
              disabled={pending}
              onClick={() => rate(n)}
              onMouseEnter={() => setPreview(n)}
              onFocus={() => setPreview(n)}
              onBlur={() => setPreview(null)}
              className="grid size-11 place-items-center rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none sm:size-9"
            >
              <Star
                aria-hidden="true"
                className={cn(
                  "size-5 transition-colors duration-150",
                  preview !== null && n <= preview ? "fill-primary/25 text-primary" : "text-input",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const starSize = size === "sm" ? "size-4" : "size-5";
  return (
    <div>
      <span className="block text-sm font-medium text-muted-foreground" aria-hidden="true">
        Your rating
      </span>
      <div className="flex min-h-11 items-center justify-between gap-2 sm:min-h-9">
        <div role="img" aria-label={ratedLabel(optimistic)} className="flex gap-0.5">
          {STARS.map((n) => (
            <Star
              key={n}
              aria-hidden="true"
              className={cn(starSize, n <= optimistic ? "fill-primary text-primary" : "text-input")}
            />
          ))}
        </div>
        {size === "sm" ? (
          <Button
            ref={clearRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear rating"
            disabled={pending}
            onClick={clear}
            className="-mr-2.5 focus-visible:ring-offset-card"
          >
            <X aria-hidden="true" />
          </Button>
        ) : (
          <Button
            ref={clearRef}
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={clear}
            className="focus-visible:ring-offset-card"
          >
            Clear rating
          </Button>
        )}
      </div>
    </div>
  );
}
