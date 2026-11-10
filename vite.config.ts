import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { exclude: ["tests/rules.test.ts", "node_modules/**"] },
});
