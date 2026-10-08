/**
 * Mock "safety number". Real Signal derives it from both parties' identity keys; there are no
 * keys here (encryption is simulated), so this is a deterministic stand-in: the same pair of
 * users always sees the same 60 digits, and it is identical from both sides.
 */
export function safetyNumber(userA: number, userB: number): string[] {
  const [low, high] = userA <= userB ? [userA, userB] : [userB, userA];
  let state = (Math.imul(low, 2654435761) ^ Math.imul(high, 40503) ^ 0x9e3779b9) >>> 0;
  const groups: string[] = [];
  for (let group = 0; group < 12; group++) {
    let digits = "";
    for (let i = 0; i < 5; i++) {
      // xorshift32: small, deterministic, good enough for a display-only number
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      digits += String(state % 10);
    }
    groups.push(digits);
  }
  return groups;
}
