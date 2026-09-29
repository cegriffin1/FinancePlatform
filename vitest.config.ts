import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Isolate unit tests from developer .env.local (which may set ALTUS_DATA_MODE=supabase)
  envDir: path.resolve(__dirname, "vitest.env"),
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      ALTUS_DATA_MODE: "simulation",
      ALTUS_ALLOW_UNAUTHENTICATED_SIM: "false",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
