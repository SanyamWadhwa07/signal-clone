/** Signal's quick reactions, in order. */
export const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢"];

export interface EmojiGroup {
  label: string;
  emojis: string[];
}

/** A compact, curated set: enough for a convincing picker without shipping a full emoji database. */
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "🙂",
      "😉",
      "😊",
      "😍",
      "🥰",
      "😘",
      "😋",
      "😎",
      "🤩",
      "🤔",
      "😐",
      "😴",
      "😢",
      "😭",
      "😡",
      "🥳",
      "😱",
      "🙄",
      "😬",
      "🤗",
      "🤯",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👋", "✌️", "🤞", "👌", "🫶", "🤙", "👀"],
  },
  {
    label: "Hearts & symbols",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "💔",
      "✨",
      "🔥",
      "💯",
      "🎉",
      "✅",
      "❌",
      "⭐",
      "⚡",
    ],
  },
  {
    label: "Objects & nature",
    emojis: [
      "☕",
      "🍕",
      "🍔",
      "🍰",
      "🍺",
      "🎶",
      "⚽",
      "🎮",
      "📷",
      "💻",
      "📱",
      "🚀",
      "🌅",
      "🌲",
      "🥾",
      "🌈",
    ],
  },
];
