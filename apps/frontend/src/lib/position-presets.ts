export const COMMON_POSITION_PRESETS = [
  "Chairman",
  "Internal Vice-Chairman",
  "External Vice-Chairman",
  "Internal Secretary",
  "External Secretary",
  "Auditor",
  "Treasurer",
  "Freshman PIO",
  "Junior PIO",
  "Sophomore PIO",
  "Senior PIO",
  "Head of Committees",
  "Editor in Chief",
  "Programming Committee Leader",
  "Gaming Committee Leader",
  "Graphics and Design Committee Leader",
  "Networking Committee Leader",
] as const;

export type CommonPositionPreset = (typeof COMMON_POSITION_PRESETS)[number];

/**
 * Normalizes a position name for case-insensitive, whitespace-trimmed comparison.
 */
export function normalizePositionName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Checks whether a given preset name already exists in the list of existing positions.
 */
export function isPositionAlreadyAdded(
  presetName: string,
  existingPositions: Array<{ name: string }>,
): boolean {
  const normalized = normalizePositionName(presetName);
  return existingPositions.some((p) => normalizePositionName(p.name) === normalized);
}

/**
 * Returns preset entries that are not already present in existing positions.
 */
export function getMissingPresets(
  existingPositions: Array<{ name: string }>,
): CommonPositionPreset[] {
  return COMMON_POSITION_PRESETS.filter(
    (preset) => !isPositionAlreadyAdded(preset, existingPositions),
  );
}
