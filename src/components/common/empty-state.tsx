import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const HEADING_CLASSES = {
  h1: "font-serif text-2xl font-medium tracking-tight sm:text-3xl",
  h2: "max-w-full break-words font-serif text-xl font-medium",
} as const;

interface EmptyStateProps {
  /** A lucide icon component (`icon={BookOpen}`), or a ready-made element for custom styling. */
  icon: LucideIcon | ReactElement;
  title: string;
  description: ReactNode;
  /** The single action: a link or button. */
  action?: ReactNode;
  /** Heading level. Use "h1" when the empty state is the whole page (not-found, error). */
  as?: "h1" | "h2";
  /** Dashed border (default). Pass false for a borderless, page-level state. */
  bordered?: boolean;
  /** Tailwind classes for the icon when `icon` is a component. */
  iconClassName?: string;
  className?: string;
}

/** Centered icon in a muted circle, one title, one line, one action (DESIGN §5.8). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  as: Heading = "h2",
  bordered = true,
  iconClassName,
  className,
}: EmptyStateProps) {
  const iconElement = isValidElement(icon) ? icon : null;
  const Icon = iconElement ? null : (icon as LucideIcon);
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg px-6 py-12 text-center sm:py-16",
        bordered ? "border border-dashed" : "border-0",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        {Icon ? <Icon aria-hidden="true" className={cn("size-6 text-muted-foreground", iconClassName)} /> : iconElement}
      </div>
      <Heading className={cn("mt-4", HEADING_CLASSES[Heading])}>{title}</Heading>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
