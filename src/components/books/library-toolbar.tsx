"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SORT_OPTIONS } from "@/lib/constants";
import { buildLibraryHref } from "@/lib/library";
import type { LibraryParams, SortKey } from "@/lib/types";

const DEBOUNCE_MS = 300;

interface LibraryToolbarProps {
  params: LibraryParams;
}

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/** Live search (debounced, D14) and sort. Both keep the other URL params (D6). */
export function LibraryToolbar({ params }: LibraryToolbarProps) {
  const router = useRouter();
  const [value, setValue] = useState(params.q);
  const lastPushed = useRef(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(params);

  useEffect(() => {
    latest.current = params;
  }, [params]);

  // Resync only when the URL changed from elsewhere (tab click, "Clear search", back button).
  useEffect(() => {
    if (params.q === lastPushed.current) return;
    lastPushed.current = params.q;
    if (timer.current) clearTimeout(timer.current);
    setValue(params.q);
  }, [params.q]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleSearch(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      if (q === lastPushed.current) return;
      lastPushed.current = q;
      router.replace(buildLibraryHref(latest.current, { q }), { scroll: false });
    }, DEBOUNCE_MS);
  }

  function handleSort(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isSortKey(next)) return;
    router.replace(buildLibraryHref(latest.current, { sort: next }), { scroll: false });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search books"
          placeholder="Search title or author"
          value={value}
          onChange={handleSearch}
          autoComplete="off"
          maxLength={200}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <label htmlFor="sort" className="sr-only whitespace-nowrap text-sm text-muted-foreground sm:not-sr-only">
          Sort by
        </label>
        <NativeSelect id="sort" value={params.sort} onChange={handleSort} wrapperClassName="w-full sm:w-44">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
