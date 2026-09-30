"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS: readonly { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const subscribe = () => () => {};

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <RadioGroup
      aria-label="Theme"
      value={mounted ? (theme ?? "system") : ""}
      onValueChange={setTheme}
      disabled={!mounted}
      className="mt-4 grid gap-2 data-[disabled]:opacity-100 sm:grid-cols-3"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Label
          key={value}
          htmlFor={`theme-${value}`}
          className="flex h-11 cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3 text-sm font-medium transition-colors duration-150 hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
        >
          <RadioGroupItem id={`theme-${value}`} value={value} className="data-[disabled]:opacity-100" />
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          {label}
        </Label>
      ))}
    </RadioGroup>
  );
}
