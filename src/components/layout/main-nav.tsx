"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Library" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="ml-1 flex items-stretch self-stretch sm:ml-4">
      {NAV.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-14 items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3",
              active &&
                "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary sm:after:inset-x-3",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
