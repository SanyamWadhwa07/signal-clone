/**
 * Name rules shared by the profile form (the backend enforces the same on first names):
 * a first name is one word without digits; a last name may contain spaces ("Van Der Berg").
 */

/** Drops digits from a first name as it is typed. */
export function cleanFirstName(value: string): string {
  return value.replace(/\d/g, "");
}

/**
 * Splits text typed or pasted into the first-name field on its first run of whitespace:
 * "Sanyam Wadhwa" -> { first: "Sanyam", rest: "Wadhwa" }.
 */
export function splitFullName(input: string): { first: string; rest: string } {
  const [first = "", ...others] = cleanFirstName(input).trim().split(/\s+/);
  return { first, rest: others.join(" ") };
}

/** Same check as the backend: no whitespace, no digits. */
export function isValidFirstName(value: string): boolean {
  return value.length > 0 && !/[\s\d]/.test(value);
}
