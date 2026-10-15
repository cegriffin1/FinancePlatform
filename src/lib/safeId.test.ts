import { describe, expect, it } from "vitest";
import { createId } from "./safeId";

describe("createId", () => {
  it("returns a UUID-shaped string without importing Node crypto", () => {
    const id = createId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("returns unique values across calls", () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
  });
});
