"use client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { ERROR_TOAST } from "@/lib/constants";

export type ProgressPayload = {
  location: string;
  percent: number;
  zoom: number | null;
  viewMode: "page" | "scroll";
  pageTheme: "light" | "sepia" | "dark";
};

/** Debounces progress saves; flushes on tab hide, page hide and unmount. */
export function useProgressSaver(save: (p: ProgressPayload) => Promise<unknown>, delayMs = 1000) {
  const pending = useRef<ProgressPayload | null>(null);
  const failing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    void (async () => {
      let ok = true;
      try {
        const res = (await saveRef.current(p)) as { ok?: boolean } | undefined;
        if (res && res.ok === false) ok = false;
      } catch {
        ok = false;
      }
      if (ok) {
        failing.current = false;
        return;
      }
      // Keep the payload for the next schedule/flush (a newer one wins); tell the reader once per failure streak.
      if (!pending.current) pending.current = p;
      if (!failing.current) {
        failing.current = true;
        toast.error(ERROR_TOAST);
      }
    })();
  }, []);

  const schedule = useCallback(
    (p: ProgressPayload) => {
      pending.current = p;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}
