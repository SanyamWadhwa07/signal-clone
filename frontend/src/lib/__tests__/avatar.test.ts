import { describe, expect, it } from "vitest";

import { avatarColorClass, initials } from "@/lib/avatar";

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Alex Rivera")).toBe("AR");
    expect(initials("  alex  ")).toBe("A");
    expect(initials("Mary Jane Watson")).toBe("MW");
  });
  it("skips leading punctuation so labels never produce symbols as initials", () => {
    expect(initials("(Sanyam) “Wadhwa”")).toBe("SW");
    expect(initials("@alex")).toBe("A");
  });
  it("has no initials for phone numbers and handles emoji names", () => {
    expect(initials("+1 555 010 0001")).toBe("#");
    expect(initials("Weekend Hike 🥾")).toBe("WH");
  });
});

describe("avatarColorClass", () => {
  it("maps names to classes with a safe fallback", () => {
    expect(avatarColorClass("crimson")).toBe("bg-av-crimson");
    expect(avatarColorClass("nope")).toBe("bg-av-steel");
    expect(avatarColorClass(null)).toBe("bg-av-steel");
  });
});
