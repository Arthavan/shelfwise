"use client";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const OPEN_ERROR = "Shelfwise couldn't open this file. It may be damaged or password-protected.";

/** Hotkeys are ignored while the user types in a field. Duck-typed: EPUB key events come from the book's iframe (another realm). */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void document.documentElement.requestFullscreen().catch(() => {});
}

/** Shown instead of the reader when the file can't be opened. */
export function ReaderOpenError({ backHref }: { backHref: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <p className="text-base">{OPEN_ERROR}</p>
        <p className="text-sm text-muted-foreground">You can replace the file from the book page.</p>
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft aria-hidden="true" />
            Back to book
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Bottom bar offering the explicit "Mark as finished" (never applied silently). */
export function FinishBanner({ message, onFinish }: { message: string; onFinish: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 border-t bg-background px-4 py-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" onClick={onFinish}>
        <CircleCheck aria-hidden="true" />
        Mark as finished
      </Button>
    </div>
  );
}
