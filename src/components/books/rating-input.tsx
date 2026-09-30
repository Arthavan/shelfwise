"use client";

import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rateButtonLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

/** Form rating control (D3): a fieldset "Rating" of five toggle buttons plus "Clear rating". */
export function RatingInput({ value, onChange, className }: RatingInputProps) {
  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)}>
      <legend className="mb-2 p-0 text-sm font-medium">Rating</legend>
      <div className="flex items-center justify-between gap-2">
        <div className="-ml-2.5 flex">
          {STARS.map((n) => {
            const filled = value !== null && n <= value;
            return (
              <button
                key={n}
                type="button"
                aria-label={rateButtonLabel(n)}
                aria-pressed={value === n}
                onClick={() => onChange(n)}
                className="group grid size-11 place-items-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:size-9"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    "size-5 transition-colors duration-150",
                    filled ? "fill-primary text-primary" : "text-input group-hover:text-primary",
                  )}
                />
              </button>
            );
          })}
        </div>
        {value !== null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear rating
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}
