"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createProgressSaver } from "@/components/reader/progress-saver-core";
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
  const [core] = useState(() => createProgressSaver(save, () => toast.error(ERROR_TOAST), delayMs));
  useEffect(() => {
    core.setSave(save);
  }, [core, save]);

  useEffect(() => {
    const onHide = () => core.flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      core.flush();
    };
  }, [core]);

  return core;
}
