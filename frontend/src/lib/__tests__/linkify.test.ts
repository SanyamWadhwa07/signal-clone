import { describe, expect, it } from "vitest";

import { linkify } from "@/lib/linkify";

describe("linkify", () => {
  it("returns plain text untouched", () => {
    expect(linkify("hello world")).toEqual([{ type: "text", value: "hello world" }]);
    expect(linkify("")).toEqual([]);
  });

  it("extracts an https link between text", () => {
    expect(linkify("see https://example.com/a?b=1 now")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", value: " now" },
    ]);
  });

  it("adds https:// to bare www links", () => {
    expect(linkify("www.signal.org")).toEqual([
      { type: "link", value: "www.signal.org", href: "https://www.signal.org" },
    ]);
  });

  it("leaves sentence punctuation outside the link", () => {
    const tokens = linkify("Check https://example.com/page, or https://example.org!");
    expect(tokens.filter((t) => t.type === "link").map((t) => t.value)).toEqual([
      "https://example.com/page",
      "https://example.org",
    ]);
  });

  it("keeps balanced parentheses that belong to the URL", () => {
    const [link] = linkify("https://en.wikipedia.org/wiki/Signal_(app)").filter(
      (t) => t.type === "link",
    );
    expect(link.value).toBe("https://en.wikipedia.org/wiki/Signal_(app)");
    const wrapped = linkify("(https://example.com)").find((t) => t.type === "link");
    expect(wrapped?.value).toBe("https://example.com");
  });

  it("never produces javascript: or other non-http links", () => {
    const tokens = linkify("javascript:alert(1) data:text/html,<b>x</b> ftp://files.example.com");
    expect(tokens.every((t) => t.type === "text")).toBe(true);
  });

  it("does not treat markup as links or html", () => {
    const tokens = linkify('<img src=x onerror=alert(1)> https://ok.com/"x');
    const links = tokens.filter((t) => t.type === "link");
    expect(links).toHaveLength(1);
    expect(links[0].href).not.toContain("<");
  });
});
