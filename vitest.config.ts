import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Isolate unit tests from developer .env.local / exported Supabase vars
  envDir: path.resolve(__dirname, "vitest.env"),
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: [path.resolve(__dirname, "src/test/setup-env.ts")],
    env: {
      ALTUS_DATA_MODE: "simulation",
      ALTUS_ALLOW_UNAUTHENTICATED_SIM: "false",
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
