import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/security/highwaterLaunchTester", () => ({
  currentUserIsAuthorizedHighwaterLaunchTester: vi.fn(),
}));

import { currentUserIsAuthorizedHighwaterLaunchTester } from "@/infrastructure/security/highwaterLaunchTester";
import { enforcePublicConsumerLaunchGate } from "@/infrastructure/security/publicConsumerLaunchGate";
import { LAUNCH_GATE_CLOSED_CODE } from "@/lib/launchGate";

describe("enforcePublicConsumerLaunchGate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.HIGHWATER_PUBLIC_LAUNCH;
  });

  it("allows when HIGHWATER_PUBLIC_LAUNCH=open", async () => {
    process.env.HIGHWATER_PUBLIC_LAUNCH = "open";
    await expect(enforcePublicConsumerLaunchGate()).resolves.toBeNull();
    expect(currentUserIsAuthorizedHighwaterLaunchTester).not.toHaveBeenCalled();
  });

  it("denies when closed and user is not an authorized org member", async () => {
    vi.mocked(currentUserIsAuthorizedHighwaterLaunchTester).mockResolvedValue(
      false,
    );
    const blocked = await enforcePublicConsumerLaunchGate();
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(403);
    const body = await blocked!.json();
    expect(body.code).toBe(LAUNCH_GATE_CLOSED_CODE);
  });

  it("allows authorized ALTUS org members when closed", async () => {
    vi.mocked(currentUserIsAuthorizedHighwaterLaunchTester).mockResolvedValue(
      true,
    );
    await expect(enforcePublicConsumerLaunchGate()).resolves.toBeNull();
  });
});
