export type TextToken =
  { type: "text"; value: string } | { type: "link"; value: string; href: string };

// http(s):// URLs and bare www. hosts. Stops at whitespace or angle brackets.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
// Punctuation that usually ends a sentence rather than a URL.
const TRAILING = /[.,:;!?'")\]}]+$/;

/**
 * Splits message text into plain text and links. Output is data, never HTML: the renderer
 * builds elements from tokens, so message content can't inject markup. Only http(s) links are
 * produced (no javascript: or data: URLs).
 */
export function linkify(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING)?.[0] ?? "";
    // Keep a closing parenthesis that balances one inside the URL, e.g. wikipedia.org/wiki/A_(b)
    if (
      trailing.startsWith(")") &&
      (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)
    ) {
      url = url.slice(0, url.length - trailing.length + 1);
    } else {
      url = url.slice(0, url.length - trailing.length);
    }
    if (url.length === 0) continue;

    if (start > cursor) tokens.push({ type: "text", value: text.slice(cursor, start) });
    tokens.push({
      type: "link",
      value: url,
      href: url.toLowerCase().startsWith("www.") ? `https://${url}` : url,
    });
    cursor = start + url.length;
  }

  if (cursor < text.length) tokens.push({ type: "text", value: text.slice(cursor) });
  return tokens;
}
