import type { ProgressPayload } from "@/components/reader/use-progress-saver";

export interface ProgressSaverCore {
  schedule(p: ProgressPayload): void;
  flush(): void;
  /** Swap the save function (the latest closure) without recreating the saver. */
  setSave(save: (p: ProgressPayload) => Promise<unknown>): void;
}

/**
 * Debounced saver with retry. A failed save (rejection or `{ ok: false }`) keeps its payload for the next
 * schedule/flush unless a newer payload is already waiting, and reports at most once per failure streak.
 * A failure from an older in-flight save after a newer one succeeded is dropped (it would be stale).
 */
export function createProgressSaver(
  initialSave: (p: ProgressPayload) => Promise<unknown>,
  onError: () => void,
  delayMs = 1000,
): ProgressSaverCore {
  let save = initialSave;
  let pending: ProgressPayload | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failing = false;
  let seq = 0;
  let lastOkSeq = 0;

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    const p = pending;
    pending = null;
    if (!p) return;
    const mine = ++seq;
    void (async () => {
      let ok = true;
      try {
        const res = (await save(p)) as { ok?: boolean } | undefined;
        if (res && res.ok === false) ok = false;
      } catch {
        ok = false;
      }
      if (ok) {
        failing = false;
        lastOkSeq = Math.max(lastOkSeq, mine);
        return;
      }
      if (mine < lastOkSeq) return; // a newer save already succeeded
      if (!pending) pending = p;
      if (!failing) {
        failing = true;
        onError();
      }
    })();
  }

  function schedule(p: ProgressPayload) {
    pending = p;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  return { schedule, flush, setSave: (fn) => void (save = fn) };
}
