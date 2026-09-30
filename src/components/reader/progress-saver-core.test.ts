import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProgressSaver } from "./progress-saver-core";
import type { ProgressPayload } from "./use-progress-saver";

const p = (n: number): ProgressPayload => ({ location: String(n), percent: n, zoom: 1, viewMode: "page", pageTheme: "light" });
const tick = () => vi.advanceTimersByTimeAsync(0);

describe("createProgressSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces to the latest payload", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const s = createProgressSaver(save, vi.fn(), 1000);
    s.schedule(p(1));
    s.schedule(p(2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(p(2));
  });

  it("keeps a failed payload, retries on the next flush and toasts once per streak", async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error("x")).mockResolvedValue({ ok: true });
    const onError = vi.fn();
    const s = createProgressSaver(save, onError, 1000);
    s.schedule(p(1));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);
    s.flush(); // retries the kept payload; rejects, no unhandled rejection, no second toast
    await tick();
    expect(save).toHaveBeenLastCalledWith(p(1));
    expect(onError).toHaveBeenCalledTimes(1);
    s.flush(); // succeeds
    await tick();
    expect(save).toHaveBeenCalledTimes(3);
    s.flush(); // nothing left
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("lets a newer scheduled payload win over a retained one and re-arms the toast after success", async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const onError = vi.fn();
    const s = createProgressSaver(save, onError, 1000);
    s.schedule(p(1));
    await vi.advanceTimersByTimeAsync(1000);
    s.schedule(p(2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenLastCalledWith(p(2));
    s.schedule(p(3));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("does not re-queue a stale payload when an older in-flight save fails after a newer one succeeded", async () => {
    let failOld!: (v: unknown) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise((res) => (failOld = res)))
      .mockResolvedValue({ ok: true });
    const s = createProgressSaver(save, vi.fn(), 1000);
    s.schedule(p(1));
    s.flush();
    s.schedule(p(2));
    s.flush();
    await tick();
    failOld({ ok: false });
    await tick();
    s.flush();
    expect(save).toHaveBeenCalledTimes(2); // p(1) was not retried
  });
});
