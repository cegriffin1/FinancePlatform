import { describe, expect, it } from "vitest";
import {
  getPublicConsumerLaunchMode,
  isPublicConsumerLaunchOpen,
  isPublicConsumerPath,
} from "@/lib/launchGate";

describe("public consumer launch gate", () => {
  it("fail-closes when configuration is absent or unknown", () => {
    const previous = process.env.HIGHWATER_PUBLIC_LAUNCH;
    delete process.env.HIGHWATER_PUBLIC_LAUNCH;
    try {
      expect(getPublicConsumerLaunchMode()).toBe("closed");
      expect(getPublicConsumerLaunchMode("")).toBe("closed");
      expect(getPublicConsumerLaunchMode("closed")).toBe("closed");
      expect(getPublicConsumerLaunchMode("yes")).toBe("closed");
      expect(isPublicConsumerLaunchOpen()).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.HIGHWATER_PUBLIC_LAUNCH;
      else process.env.HIGHWATER_PUBLIC_LAUNCH = previous;
    }
  });

  it("opens only on explicit open", () => {
    expect(getPublicConsumerLaunchMode("open")).toBe("open");
    expect(getPublicConsumerLaunchMode("OPEN")).toBe("open");
    expect(isPublicConsumerLaunchOpen("open")).toBe(true);
  });

  it("covers consumer intake paths and excludes unavailable + dashboards", () => {
    expect(isPublicConsumerPath("/assessment/retirement")).toBe(true);
    expect(isPublicConsumerPath("/assessment/unavailable")).toBe(false);
    expect(isPublicConsumerPath("/c/altus/retirement-opportunity")).toBe(true);
    expect(isPublicConsumerPath("/api/public/leads")).toBe(true);
    expect(isPublicConsumerPath("/api/public/appointment-request")).toBe(true);
    expect(isPublicConsumerPath("/app/leads")).toBe(false);
    expect(isPublicConsumerPath("/login")).toBe(false);
    expect(isPublicConsumerPath("/api/crm")).toBe(false);
  });
});
