/** Selectable outgoing-bubble colors (Signal's conversation color names). */
export const CHAT_COLORS: { name: string; hex: string; label: string }[] = [
  { name: "ultramarine", hex: "#2c6bed", label: "Ultramarine" },
  { name: "crimson", hex: "#cf163e", label: "Crimson" },
  { name: "vermilion", hex: "#c73f0a", label: "Vermilion" },
  { name: "burlap", hex: "#6f6a58", label: "Burlap" },
  { name: "forest", hex: "#3b7845", label: "Forest" },
  { name: "wintergreen", hex: "#1d8663", label: "Wintergreen" },
  { name: "teal", hex: "#077d92", label: "Teal" },
  { name: "blue", hex: "#336ba3", label: "Blue" },
  { name: "indigo", hex: "#6058ca", label: "Indigo" },
  { name: "violet", hex: "#9932c8", label: "Violet" },
  { name: "plum", hex: "#aa377a", label: "Plum" },
  { name: "taupe", hex: "#8f616a", label: "Taupe" },
  { name: "steel", hex: "#71717f", label: "Steel" },
];

export function chatColorHex(name: string): string {
  return (CHAT_COLORS.find((c) => c.name === name) ?? CHAT_COLORS[0]).hex;
}
