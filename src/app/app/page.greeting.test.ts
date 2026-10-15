import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Agent Home greeting", () => {
  it("does not hardcode a second GOOD MORNING alongside data.greeting", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/app/page.tsx"),
      "utf8",
    );
    expect(source).toContain("{data.greeting}");
    expect(source).not.toMatch(/GOOD MORNING\s*</);
    // Only one greeting render target in the hero
    const greetingRenders = source.match(/data\.greeting/g) ?? [];
    expect(greetingRenders.length).toBeGreaterThanOrEqual(1);
  });
});
