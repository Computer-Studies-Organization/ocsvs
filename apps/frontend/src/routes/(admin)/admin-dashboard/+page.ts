import type { PageLoad } from "./$types";
import { fetchAdminStats } from "$lib/api/admin-stats";

export const load: PageLoad = async ({ fetch }) => {
  try {
    const stats = await fetchAdminStats({ fetch });
    return { stats };
  } catch {
    return {
      stats: {
        votersCount: 0,
        electionsCount: 0,
        activeElection: null,
        recentLogs: [],
      },
      error: "Failed to load dashboard stats",
    };
  }
};
