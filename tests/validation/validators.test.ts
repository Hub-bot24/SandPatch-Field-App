import { describe, expect, it } from "vitest";
import { validateChainageInput, validateDiameterInput } from "@/lib/validation/validators";

describe("validateChainageInput", () => {
  it("accepts a non-negative number", () => {
    expect(validateChainageInput("27.080")).toEqual({ valid: true, parsed: 27.08 });
  });

  it("rejects a negative number", () => {
    expect(validateChainageInput("-1").valid).toBe(false);
  });

  it("treats empty input as valid-but-unset", () => {
    expect(validateChainageInput("")).toEqual({ valid: true, parsed: null });
  });

  it("rejects non-numeric input", () => {
    expect(validateChainageInput("abc").valid).toBe(false);
  });
});

describe("validateDiameterInput", () => {
  it("accepts very large legitimate readings without an arbitrary maximum", () => {
    expect(validateDiameterInput("5000").valid).toBe(true);
    expect(validateDiameterInput("999999").valid).toBe(true);
  });

  it("rejects zero and negative values", () => {
    expect(validateDiameterInput("0").valid).toBe(false);
    expect(validateDiameterInput("-5").valid).toBe(false);
  });

  it("treats empty input as valid-but-unset", () => {
    expect(validateDiameterInput("")).toEqual({ valid: true, parsed: null });
  });
});
