import { describe, expect, it } from "vitest";

import { isJumbomoji } from "@/lib/emoji";

describe("isJumbomoji", () => {
  it("accepts one to three emoji", () => {
    expect(isJumbomoji("😀")).toBe(true);
    expect(isJumbomoji("👍🏽")).toBe(true); // skin-tone modifier is still one emoji
    expect(isJumbomoji("🎉 🎉 🎉")).toBe(true);
    expect(isJumbomoji("❤️")).toBe(true);
  });

  it("rejects four or more emoji", () => {
    expect(isJumbomoji("😀😀😀😀")).toBe(false);
  });

  it("rejects text, numbers and mixed content", () => {
    expect(isJumbomoji("hello")).toBe(false);
    expect(isJumbomoji("hi 😀")).toBe(false);
    expect(isJumbomoji("123")).toBe(false);
    expect(isJumbomoji("")).toBe(false);
    expect(isJumbomoji(null)).toBe(false);
  });
});
