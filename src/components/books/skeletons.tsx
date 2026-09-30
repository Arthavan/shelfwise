import { Skeleton } from "@/components/ui/skeleton";

/** Loading states reuse the real chrome (borders, padding, grids) with fixed widths (DESIGN §5.9). */

function PageHeaderSkeleton({ titleWidth = "w-32" }: { titleWidth?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Skeleton className={`h-8 ${titleWidth}`} />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
    </div>
  );
}

function BookCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-lg border bg-card p-4">
      <Skeleton className="h-21 w-14 shrink-0 rounded-sm sm:h-24 sm:w-16" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-auto h-11 w-full sm:h-9" />
      </div>
    </div>
  );
}

const TAB_WIDTHS = ["w-14", "w-28", "w-20", "w-[84px]"] as const;

export function LibrarySkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your books</span>
      <PageHeaderSkeleton />
      <div className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0">
        <div className="flex h-11 w-max min-w-full items-center gap-1 border-b">
          {TAB_WIDTHS.map((width) => (
            <div key={width} className="flex h-11 shrink-0 items-center px-3">
              <Skeleton className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-11 w-full sm:h-10 sm:max-w-sm sm:flex-1" />
        <Skeleton className="h-11 w-full sm:ml-auto sm:h-9 sm:w-64" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function BookDetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading book</span>
      <div className="mb-4 flex h-11 items-center sm:h-9">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-8" aria-hidden="true">
        <Skeleton className="h-30 w-20 rounded-sm sm:row-span-2 sm:h-60 sm:w-40" />
        <div className="min-w-0">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="mt-2 h-5 w-1/3" />
        </div>
        <div className="col-span-2 space-y-4 sm:col-span-1 sm:col-start-2 sm:max-w-sm">
          <Skeleton className="h-11 w-full sm:h-9" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 sm:h-9 sm:w-20 sm:flex-none" />
            <Skeleton className="h-11 flex-1 sm:h-9 sm:w-24 sm:flex-none" />
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" aria-hidden="true">
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <Skeleton className="h-6 w-24" />
          <div className="mt-2 divide-y">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <Skeleton className="h-6 w-20" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldSkeleton({ label = "w-16", height = "h-11 sm:h-10" }: { label?: string; height?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-4 ${label}`} />
      <Skeleton className={`${height} w-full`} />
    </div>
  );
}

export function BookFormSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading form</span>
      <PageHeaderSkeleton titleWidth="w-40" />
      <div className="max-w-xl space-y-6 rounded-lg border bg-card p-4 sm:p-6" aria-hidden="true">
        <FieldSkeleton />
        <FieldSkeleton label="w-14" />
        <div className="grid gap-6 sm:grid-cols-2">
          <FieldSkeleton label="w-12" />
          <FieldSkeleton label="w-12" />
        </div>
        <FieldSkeleton label="w-12" height="h-32" />
        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Skeleton className="h-11 w-full sm:h-10 sm:w-24" />
          <Skeleton className="h-11 w-full sm:h-10 sm:w-28" />
        </div>
      </div>
    </div>
  );
}
