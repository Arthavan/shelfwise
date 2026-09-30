"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import "./globals.css";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Last-resort boundary: replaces the root layout, so it brings its own <html> and <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <TriangleAlert aria-hidden="true" className="size-6 text-destructive" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-medium tracking-tight sm:text-3xl">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">This page didn&apos;t load. Your books are still here.</p>
          <button type="button" onClick={() => reset()} className={cn(buttonVariants(), "mt-6")}>
            <RotateCcw aria-hidden="true" />
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
