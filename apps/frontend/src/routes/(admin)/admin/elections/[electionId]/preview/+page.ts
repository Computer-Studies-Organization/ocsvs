import type { PageLoad } from "./$types";
import { loadElectionData } from "$lib/load-election-data";

export const load: PageLoad = ({ params, fetch, depends }) =>
  loadElectionData(params.electionId, { fetch, depends });
