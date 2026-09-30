import { COVER_CLASSES } from "@/lib/constants";
import { coverTone, getInitials } from "@/lib/cover";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-21 w-14 text-lg sm:h-24 sm:w-16 sm:text-xl", rule: "inset-x-3 sm:inset-x-2", top: "top-3 sm:top-2", bottom: "bottom-3 sm:bottom-2" },
  md: { box: "h-24 w-16 text-xl", rule: "inset-x-3", top: "top-3", bottom: "bottom-3" },
  lg: { box: "h-30 w-20 text-2xl sm:h-60 sm:w-40 sm:text-5xl", rule: "inset-x-3", top: "top-3", bottom: "bottom-3" },
} as const;

interface BookCoverProps {
  title: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Decorative initials tile in a book-cloth tone (DESIGN §5.6). Server-safe: no hooks. */
export function BookCover({ title, size = "sm", className }: BookCoverProps) {
  const s = SIZES[size];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 select-none place-items-center overflow-hidden rounded-l-[3px] rounded-r-sm font-serif font-medium tracking-wide ring-1 ring-inset ring-black/10 dark:ring-white/10",
        COVER_CLASSES[coverTone(title) - 1],
        s.box,
        className,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/15" />
      <span className={cn("absolute h-px bg-current opacity-30", s.rule, s.top)} />
      <span className={cn("absolute h-px bg-current opacity-30", s.rule, s.bottom)} />
      {getInitials(title)}
    </div>
  );
}
