import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  dialect: "sqlite",
  // driver: "d1-http", // Optional, can use wrangler.toml for auth
});
