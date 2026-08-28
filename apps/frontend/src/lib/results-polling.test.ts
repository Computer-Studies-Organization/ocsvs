import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TElectionStatus } from "$lib/types";
import {
  refreshResultsAfterClose,
  RESULTS_POLL_INTERVAL_MS,
  startResultsPolling,
} from "./results-polling";

describe("results polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls on schedule and visibility, then cleans up", () => {
    const poll = vi.fn();
    let active = true;
    const listeners = new Set<() => void>();
    const target = {
      hidden: false,
      addEventListener: (_event: string, listener: EventListenerOrEventListenerObject): void => {
        if (typeof listener === "function") listeners.add(listener as () => void);
      },
      removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject): void => {
        if (typeof listener === "function") listeners.delete(listener as () => void);
      },
    };
    const stop = startResultsPolling(poll, () => active, target);

    vi.advanceTimersByTime(RESULTS_POLL_INTERVAL_MS - 1);
    expect(poll).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(poll).toHaveBeenCalledTimes(1);

    target.hidden = true;
    listeners.forEach((listener) => listener());
    expect(poll).toHaveBeenCalledTimes(1);
    target.hidden = false;
    listeners.forEach((listener) => listener());
    expect(poll).toHaveBeenCalledTimes(2);

    active = false;
    vi.advanceTimersByTime(RESULTS_POLL_INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
    active = true;
    listeners.forEach((listener) => listener());
    vi.advanceTimersByTime(RESULTS_POLL_INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("refreshes exactly once when effective status closes", () => {
    const refresh = vi.fn();
    let previousStatus: TElectionStatus | null = null;

    previousStatus = refreshResultsAfterClose(previousStatus, "open", refresh);
    previousStatus = refreshResultsAfterClose(previousStatus, "closed", refresh);
    previousStatus = refreshResultsAfterClose(previousStatus, "closed", refresh);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(true);
  });
});
