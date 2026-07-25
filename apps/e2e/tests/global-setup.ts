import { test as setup } from "@playwright/test";
import { seedActiveElection, seedTestUsers } from "../fixtures/db-setup";

setup("seed database", async () => {
  await seedTestUsers();
  await seedActiveElection();
});
