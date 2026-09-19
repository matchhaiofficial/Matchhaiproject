import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex-test/**/*.test.ts"],
    environment: "edge-runtime",
    fileParallelism: false,
  },
});
