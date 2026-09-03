import { sveltekit } from "@sveltejs/kit/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit(), tsconfigPaths()],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    include: ["src/lib/**/*.test.ts", "src/routes/**/*.test.ts"],
  },
});
