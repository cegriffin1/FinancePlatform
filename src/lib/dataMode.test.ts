import { describe, expect, it } from "vitest";
import { getDataMode, isSimulationDataMode } from "@/lib/dataMode";

describe("test environment data-mode isolation", () => {
  it("defaults unit tests to simulation even if developer .env.local prefers supabase", () => {
    expect(process.env.ALTUS_DATA_MODE).toBe("simulation");
    expect(getDataMode()).toBe("simulation");
    expect(isSimulationDataMode()).toBe(true);
  });
});
