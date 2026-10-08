import { describe, expect, it } from "vitest";

import { COUNTRIES, joinPhone, matchPhone, prettyPhone, splitPhone } from "@/lib/countries";

describe("COUNTRIES", () => {
  it("covers far more than one country and lists India first", () => {
    expect(COUNTRIES.length).toBeGreaterThan(60);
    expect(COUNTRIES[0].name).toBe("India");
  });
});

describe("matchPhone / splitPhone", () => {
  it("uses the longest matching dial code", () => {
    expect(matchPhone("+971501234567")?.country.name).toBe("United Arab Emirates");
    expect(matchPhone("+919876500001")?.country.name).toBe("India");
    expect(matchPhone("+14155550100")?.country.dial).toBe("+1");
  });

  it("returns null for unknown codes and a safe fallback from splitPhone", () => {
    expect(matchPhone("+99999999")).toBeNull();
    expect(splitPhone("+99999999").national).toBe("99999999");
  });
});

describe("joinPhone", () => {
  const india = COUNTRIES[0];

  it("prefixes the selected country and drops a trunk 0", () => {
    expect(joinPhone(india, "98765 00001")).toBe("+919876500001");
    expect(joinPhone(india, "098765-00001")).toBe("+919876500001");
  });

  it("treats a number typed with + as already international (never prefixed with +91)", () => {
    expect(joinPhone(india, "+1 415 555 0100")).toBe("+14155550100");
    expect(joinPhone(india, " +44 20 7183 8750")).toBe("+442071838750");
  });
});

describe("prettyPhone", () => {
  it("groups Indian numbers 5+5 and others sensibly", () => {
    expect(prettyPhone("+919876500001")).toBe("+91 98765 00001");
    expect(prettyPhone("+14155550100")).toBe("+1 415 555 0100");
  });

  it("shows unknown country codes without crashing", () => {
    expect(prettyPhone("+99999999")).toBe("+999 99999");
  });
});
