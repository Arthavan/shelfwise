import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium shadow-sm ring-2 ring-ring focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Shelfwise"
          className="inline-flex h-11 items-center gap-2 rounded-md pr-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <BookOpen aria-hidden="true" className="size-[18px]" />
          </span>
          <span className="hidden font-serif text-lg font-medium sm:inline">Shelfwise</span>
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/books/new"
            aria-label="Add book"
            className={cn(buttonVariants({ size: "icon" }), "bg-primary text-primary-foreground hover:bg-primary/90 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3")}
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden text-sm sm:inline">Add book</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
