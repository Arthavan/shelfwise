"use client";
import { useCallback, useEffect, useRef } from "react";

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
    if (p) void saveRef.current(p);
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
