import { describe, expect, it } from "vitest";
import { formatBuildLabel } from "@/lib/version";

describe("formatBuildLabel", () => {
  it("formats the UTC date, time, and sha together", () => {
    expect(formatBuildLabel("cd15273", "2026-09-16T02:32:38.069Z")).toBe("16 Sep 02:32 UTC · cd15273");
  });

  it("pads single-digit hours and minutes", () => {
    expect(formatBuildLabel("abc1234", "2026-01-05T03:07:00.000Z")).toBe("5 Jan 03:07 UTC · abc1234");
  });

  it("omits the sha entirely when it's null (git unavailable at build time)", () => {
    expect(formatBuildLabel(null, "2026-09-16T02:32:38.069Z")).toBe("16 Sep 02:32 UTC");
  });
});
