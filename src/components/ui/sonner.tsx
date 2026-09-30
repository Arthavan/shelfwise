"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-popover text-popover-foreground border border-border rounded-lg shadow-md font-sans",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md !h-8 !px-3 !text-sm !font-medium",
          icon: "[&_svg]:size-4",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
