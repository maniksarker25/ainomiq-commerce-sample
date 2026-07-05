import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Real unit tests live next to the code in __tests__ folders.
    // The legacy /tests/*.test.mjs files are source-grep "tests" and are
    // intentionally excluded — they are being replaced with real tests.
    include: ["lib/**/__tests__/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
});
