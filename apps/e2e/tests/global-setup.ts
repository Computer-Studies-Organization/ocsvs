import { test as setup } from "@playwright/test";
import { seedActiveElection, seedDraftCandidate, seedTestUsers } from "../fixtures/db-setup";

setup("seed database", async () => {
  await seedTestUsers();
  await seedActiveElection();
  await seedDraftCandidate();
});
