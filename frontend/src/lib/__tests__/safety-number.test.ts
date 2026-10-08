import { describe, expect, it } from "vitest";

import { safetyNumber } from "@/lib/safety-number";

describe("safetyNumber", () => {
  it("is 12 groups of 5 digits", () => {
    const groups = safetyNumber(1, 2);
    expect(groups).toHaveLength(12);
    groups.forEach((group) => expect(group).toMatch(/^\d{5}$/));
  });

  it("is identical from both sides and stable across calls", () => {
    expect(safetyNumber(3, 9)).toEqual(safetyNumber(9, 3));
    expect(safetyNumber(3, 9)).toEqual(safetyNumber(3, 9));
  });

  it("differs between different pairs", () => {
    expect(safetyNumber(1, 2)).not.toEqual(safetyNumber(1, 3));
  });
});
