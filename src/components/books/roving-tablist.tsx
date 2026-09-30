"use client";

import type * as React from "react";

type RovingTablistProps = Omit<React.ComponentProps<"div">, "role">;

/**
 * `role="tablist"` with the ARIA keyboard model (manual activation): ArrowLeft/ArrowRight (wrapping),
 * Home and End move focus between the `role="tab"` children; Enter or Space activates the focused tab.
 * The children own the roving tabindex (0 on the selected tab, -1 on the rest), so Tab enters the list
 * on the selected tab and the next Tab leaves it.
 */
export function RovingTablist({ children, onKeyDown, ...props }: RovingTablistProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const current = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="tab"]') : null;
    if (!current) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const index = tabs.indexOf(current);
    if (index === -1) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      case " ":
        // Links only activate on Enter; tabs also activate on Space.
        event.preventDefault();
        current.click();
        return;
      default:
        return;
    }
    event.preventDefault();
    tabs[nextIndex]?.focus();
  }

  return (
    <div role="tablist" {...props} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
