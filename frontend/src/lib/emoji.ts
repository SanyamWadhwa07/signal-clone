const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s)+$/u;

/**
 * True for messages made of 1–3 emoji and nothing else. Signal renders those large and without
 * a bubble ("jumbomoji").
 */
export function isJumbomoji(text: string | null): boolean {
  const value = text?.trim();
  if (!value || !EMOJI_ONLY.test(value) || !/\p{Extended_Pictographic}/u.test(value)) return false;
  const graphemes = segmenter
    ? Array.from(segmenter.segment(value.replace(/\s+/g, "")), (s) => s.segment)
    : Array.from(value.replace(/\s+/g, ""));
  return graphemes.length >= 1 && graphemes.length <= 3;
}
