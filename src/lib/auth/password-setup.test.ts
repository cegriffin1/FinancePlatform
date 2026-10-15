import { describe, expect, it } from "vitest";
import {
  isPasswordSetupType,
  passwordMeetsPolicy,
  resolveAuthCallbackNext,
  shouldForcePasswordSetup,
} from "./password-setup";

describe("password-setup helpers", () => {
  it("classifies invite and recovery as password-setup types", () => {
    expect(isPasswordSetupType("invite")).toBe(true);
    expect(isPasswordSetupType("recovery")).toBe(true);
    expect(isPasswordSetupType("signup")).toBe(true);
    expect(isPasswordSetupType("login")).toBe(false);
    expect(isPasswordSetupType(null)).toBe(false);
  });

  it("routes invite/recovery callbacks to set-password", () => {
    expect(resolveAuthCallbackNext("invite", "/app")).toBe("/auth/set-password");
    expect(resolveAuthCallbackNext("recovery", "/app")).toBe(
      "/auth/set-password",
    );
    expect(resolveAuthCallbackNext(null, "/auth/set-password")).toBe(
      "/auth/set-password",
    );
  });

  it("rejects open redirects in next param", () => {
    expect(resolveAuthCallbackNext(null, "https://evil.example")).toBe("/app");
    expect(resolveAuthCallbackNext(null, "//evil.example")).toBe("/app");
    expect(resolveAuthCallbackNext(null, "/app/leads")).toBe("/app/leads");
  });

  it("flags password setup when type or next requires it", () => {
    expect(shouldForcePasswordSetup("invite")).toBe(true);
    expect(shouldForcePasswordSetup(null, "/auth/set-password")).toBe(true);
    expect(shouldForcePasswordSetup(null, "/app")).toBe(false);
  });

  it("enforces password policy bounds", () => {
    expect(passwordMeetsPolicy("short").ok).toBe(false);
    expect(passwordMeetsPolicy("longenough").ok).toBe(true);
  });
});
