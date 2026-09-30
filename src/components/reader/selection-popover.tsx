"use client";
import { useEffect, useRef, useState } from "react";

import { HIGHLIGHT_BG } from "@/components/reader/pdf-page";
import { Button } from "@/components/ui/button";
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/reading";

interface SelectionPopoverProps {
  anchor: { x: number; y: number };
  onPick: (color: HighlightColor) => void;
  onSaveNote: (color: HighlightColor, note: string) => void;
  onClose: () => void;
}

export function SelectionPopover({ anchor, onPick, onSaveNote, onClose }: SelectionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [color, setColor] = useState<HighlightColor>("yellow");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Highlight selection"
      // Keep the text selection alive while the card is clicked (the textarea still takes focus normally).
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
      }}
      className="fixed z-30 flex flex-col gap-2 rounded-lg border bg-popover p-2 shadow-lg"
      style={{ left: anchor.x, top: anchor.y - 8, transform: "translate(-50%, -100%)" }}
    >
      <div className="flex items-center gap-2">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Highlight ${c}`}
            aria-pressed={noting ? color === c : undefined}
            onClick={() => (noting ? setColor(c) : onPick(c))}
            className="size-6 rounded-full border border-black/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: HIGHLIGHT_BG[c] }}
          />
        ))}
        {noting ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setNoting(true)}>
            Add note
          </Button>
        )}
      </div>
      {noting ? (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Note"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-56 rounded-md border bg-background p-2 text-sm"
          />
          <Button type="button" size="sm" onClick={() => onSaveNote(color, note)}>
            Save note
          </Button>
        </div>
      ) : null}
    </div>
  );
}
