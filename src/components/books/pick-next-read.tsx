"use client";

import { useState, useTransition } from "react";
import { BookOpen, Shuffle } from "lucide-react";
import { toast } from "sonner";

import { updateBookStatus } from "@/app/books/status-actions";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ERROR_TOAST, STATUS_TOASTS } from "@/lib/constants";
import type { BookSummary } from "@/lib/types";

interface PickNextReadProps {
  candidates: BookSummary[];
}

/** A random candidate, different from `exceptId` whenever more than one exists (D13). */
function pickRandom(candidates: BookSummary[], exceptId: string | null): BookSummary | null {
  const pool = candidates.length > 1 ? candidates.filter((c) => c.id !== exceptId) : candidates;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** Strip on the Want to read tab plus the "Your next read" dialog (F12). */
export function PickNextRead({ candidates }: PickNextReadProps) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const picked = candidates.find((c) => c.id === pickedId) ?? null;

  function openDialog() {
    setPickedId(pickRandom(candidates, null)?.id ?? null);
    setOpen(true);
  }

  function pickAnother() {
    setPickedId(pickRandom(candidates, pickedId)?.id ?? null);
  }

  function startReading() {
    if (!picked) return;
    const { id } = picked;
    startTransition(async () => {
      const result = await updateBookStatus({ id, status: "reading" });
      if (result.ok) {
        toast.success(STATUS_TOASTS.reading);
        setOpen(false);
      } else {
        toast.error(ERROR_TOAST);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Can&apos;t decide what to read next?</p>
        <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={openDialog}>
          <Shuffle aria-hidden="true" />
          Pick my next read
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your next read</DialogTitle>
            <DialogDescription>A random pick from your Want to read list.</DialogDescription>
          </DialogHeader>
          {picked ? (
            <div
              key={picked.id}
              className="flex animate-in items-center gap-4 rounded-lg border bg-card p-4 duration-150 fade-in-0"
            >
              <BookCover title={picked.title} size="md" />
              <div className="min-w-0">
                <h3 className="font-serif text-lg font-medium leading-6">{picked.title}</h3>
                <p className="text-sm text-muted-foreground">{picked.author}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={pickAnother} disabled={pending || candidates.length <= 1}>
              <Shuffle aria-hidden="true" />
              Pick another
            </Button>
            <Button type="button" onClick={startReading} disabled={pending || !picked}>
              <BookOpen aria-hidden="true" />
              Start reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
