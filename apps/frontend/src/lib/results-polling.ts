import type { TElectionStatus } from "$lib/types";

export const RESULTS_POLL_INTERVAL_MS = 15_000;

type VisibilityTarget = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;
type RefreshTask = () => void | Promise<unknown>;

export async function refreshElectionAndResults(
  refreshElection: RefreshTask,
  refreshResults: RefreshTask,
): Promise<void> {
  await Promise.all([refreshElection(), refreshResults()]);
}

export function startResultsPolling(
  poll: () => void | Promise<void>,
  isOpen: () => boolean,
  target: VisibilityTarget = document,
): () => void {
  const intervalId = setInterval(() => {
    if (isOpen()) void poll();
  }, RESULTS_POLL_INTERVAL_MS);
  const onVisibility = () => {
    if (!target.hidden && isOpen()) void poll();
  };
  target.addEventListener("visibilitychange", onVisibility);

  return () => {
    clearInterval(intervalId);
    target.removeEventListener("visibilitychange", onVisibility);
  };
}

export function refreshResultsAfterClose(
  previousStatus: TElectionStatus | null,
  currentStatus: TElectionStatus,
  refresh: (force: true) => void | Promise<void>,
): TElectionStatus {
  if (previousStatus === "open" && currentStatus === "closed") void refresh(true);
  return currentStatus;
}
