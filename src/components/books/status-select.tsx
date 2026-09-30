"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";

import { updateBookStatus } from "@/app/books/status-actions";
import { NativeSelect } from "@/components/ui/native-select";
import { ERROR_TOAST, STATUSES, STATUS_LABELS, STATUS_TOASTS } from "@/lib/constants";
import type { BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOT_CLASSES: Record<BookStatus, string> = {
  want: "ring-1 ring-inset ring-muted-foreground",
  reading: "bg-primary",
  finished: "bg-success",
};

interface StatusSelectProps {
  bookId: string;
  title: string;
  status: BookStatus;
  className?: string;
}

function isBookStatus(value: string): value is BookStatus {
  return STATUSES.some((s) => s === value);
}

/** Quick status change: native select, optimistic, labelled only by aria-label (DESIGN §5.3). */
export function StatusSelect({ bookId, title, status, className }: StatusSelectProps) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);
  const refocus = useRef(false);

  // A disabled control drops keyboard focus; give it back once the change has settled.
  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false;
      selectRef.current?.focus();
    }
  }, [pending]);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isBookStatus(next) || next === optimistic) return;
    refocus.current = document.activeElement === event.target;
    startTransition(async () => {
      setOptimistic(next);
      const result = await updateBookStatus({ id: bookId, status: next });
      if (result.ok) toast.success(STATUS_TOASTS[next]);
      else toast.error(ERROR_TOAST);
    });
  }

  return (
    <div className={cn("relative", className)}>
      <NativeSelect
        ref={selectRef}
        aria-label={`Status for ${title}`}
        value={optimistic}
        onChange={handleChange}
        disabled={pending}
        className="pl-8"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full", DOT_CLASSES[optimistic])}
      />
    </div>
  );
}
