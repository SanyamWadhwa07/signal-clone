import { describe, expect, it } from "vitest";

import { cleanFirstName, isValidFirstName, splitFullName } from "@/lib/names";

describe("splitFullName", () => {
  it("splits a pasted full name into first and last", () => {
    expect(splitFullName("Sanyam Wadhwa")).toEqual({ first: "Sanyam", rest: "Wadhwa" });
    expect(splitFullName("  Harpreet   Singh  Gill ")).toEqual({
      first: "Harpreet",
      rest: "Singh Gill",
    });
  });

  it("leaves a single word alone", () => {
    expect(splitFullName("Aarav")).toEqual({ first: "Aarav", rest: "" });
    expect(splitFullName("")).toEqual({ first: "", rest: "" });
  });
});

describe("first-name rules", () => {
  it("strips digits as you type", () => {
    expect(cleanFirstName("Sa1ny4m")).toBe("Sanym");
  });

  it("accepts one word and rejects spaces, digits and empty input", () => {
    expect(isValidFirstName("Sanyam")).toBe(true);
    expect(isValidFirstName("Anne-Marie")).toBe(true);
    expect(isValidFirstName("Sanyam Wadhwa")).toBe(false);
    expect(isValidFirstName("S4nyam")).toBe(false);
    expect(isValidFirstName("")).toBe(false);
  });
});
