import { test as setup } from "@playwright/test";
import { seedActiveElection, seedDraftCandidate } from "../fixtures/db-setup";

setup("seed database", async () => {
  await seedActiveElection();
  await seedDraftCandidate();
});
