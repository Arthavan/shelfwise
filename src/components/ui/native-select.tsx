import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type NativeSelectProps = React.ComponentProps<"select"> & {
  wrapperClassName?: string;
};

function NativeSelect({ className, wrapperClassName, children, ...props }: NativeSelectProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 sm:h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-base sm:text-sm text-foreground transition-colors duration-150 hover:border-foreground/40 disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
