import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  envPrefix: ["VITE_", "PUBLIC_"],
  build: {
    target: "es2022",
    cssMinify: true,
  },
});
