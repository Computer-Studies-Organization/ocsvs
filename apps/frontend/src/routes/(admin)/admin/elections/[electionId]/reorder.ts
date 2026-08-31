import { invalidate } from "$app/navigation";
import { reorderPositions } from "$lib/api/positions";
import { appCache } from "$lib/cache";
import { extractErrorMessage } from "$lib/mutation-feedback-utils";
import { addToast } from "$lib/stores/toast.svelte";
import type { TPosition } from "$lib/types";

export async function reorderAndRefreshPositions(
  electionId: string,
  newPositions: TPosition[],
  previousPositions: TPosition[],
  setPositions: (positions: TPosition[]) => void,
): Promise<void> {
  setPositions(newPositions.map((position, displayOrder) => ({ ...position, displayOrder })));
  try {
    const updated = await reorderPositions(
      electionId,
      newPositions.map(({ id }) => id),
    );
    setPositions(updated);
    appCache.invalidate({ params: { electionId } });
    try {
      await invalidate("app:election");
    } catch (error: unknown) {
      addToast(
        "error",
        extractErrorMessage(error, "Positions reordered, but failed to refresh election data"),
      );
    }
  } catch (error: unknown) {
    setPositions(previousPositions);
    addToast("error", extractErrorMessage(error, "Failed to reorder positions"));
  }
}
