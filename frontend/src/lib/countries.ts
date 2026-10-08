export interface Country {
  name: string;
  /** International dial code, e.g. "+91". */
  dial: string;
  /** ISO 3166-1 alpha-2 region, used to pick a sensible default from the browser locale. */
  region: string;
}

/** India and the US first (the likely audience), the rest alphabetical. */
export const COUNTRIES: Country[] = [
  { name: "India", dial: "+91", region: "IN" },
  { name: "United States", dial: "+1", region: "US" },
  ...(
    [
      ["Afghanistan", "+93", "AF"],
      ["Argentina", "+54", "AR"],
      ["Australia", "+61", "AU"],
      ["Austria", "+43", "AT"],
      ["Bahrain", "+973", "BH"],
      ["Bangladesh", "+880", "BD"],
      ["Belgium", "+32", "BE"],
      ["Bhutan", "+975", "BT"],
      ["Brazil", "+55", "BR"],
      ["Canada", "+1", "CA"],
      ["Chile", "+56", "CL"],
      ["China", "+86", "CN"],
      ["Colombia", "+57", "CO"],
      ["Czechia", "+420", "CZ"],
      ["Denmark", "+45", "DK"],
      ["Egypt", "+20", "EG"],
      ["Ethiopia", "+251", "ET"],
      ["Finland", "+358", "FI"],
      ["France", "+33", "FR"],
      ["Germany", "+49", "DE"],
      ["Ghana", "+233", "GH"],
      ["Greece", "+30", "GR"],
      ["Hong Kong", "+852", "HK"],
      ["Hungary", "+36", "HU"],
      ["Indonesia", "+62", "ID"],
      ["Iran", "+98", "IR"],
      ["Iraq", "+964", "IQ"],
      ["Ireland", "+353", "IE"],
      ["Israel", "+972", "IL"],
      ["Italy", "+39", "IT"],
      ["Japan", "+81", "JP"],
      ["Jordan", "+962", "JO"],
      ["Kenya", "+254", "KE"],
      ["Kuwait", "+965", "KW"],
      ["Lebanon", "+961", "LB"],
      ["Malaysia", "+60", "MY"],
      ["Maldives", "+960", "MV"],
      ["Mexico", "+52", "MX"],
      ["Morocco", "+212", "MA"],
      ["Nepal", "+977", "NP"],
      ["Netherlands", "+31", "NL"],
      ["New Zealand", "+64", "NZ"],
      ["Nigeria", "+234", "NG"],
      ["Norway", "+47", "NO"],
      ["Oman", "+968", "OM"],
      ["Pakistan", "+92", "PK"],
      ["Peru", "+51", "PE"],
      ["Philippines", "+63", "PH"],
      ["Poland", "+48", "PL"],
      ["Portugal", "+351", "PT"],
      ["Qatar", "+974", "QA"],
      ["Romania", "+40", "RO"],
      ["Russia", "+7", "RU"],
      ["Saudi Arabia", "+966", "SA"],
      ["Singapore", "+65", "SG"],
      ["South Africa", "+27", "ZA"],
      ["South Korea", "+82", "KR"],
      ["Spain", "+34", "ES"],
      ["Sri Lanka", "+94", "LK"],
      ["Sweden", "+46", "SE"],
      ["Switzerland", "+41", "CH"],
      ["Tanzania", "+255", "TZ"],
      ["Thailand", "+66", "TH"],
      ["Turkey", "+90", "TR"],
      ["Uganda", "+256", "UG"],
      ["Ukraine", "+380", "UA"],
      ["United Arab Emirates", "+971", "AE"],
      ["United Kingdom", "+44", "GB"],
      ["Vietnam", "+84", "VN"],
    ] as const
  ).map(([name, dial, region]) => ({ name, dial, region })),
];

const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** Best default for the visitor: their browser's region if we know it, otherwise India. */
export function defaultCountry(): Country {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return COUNTRIES.find((c) => c.region === region) ?? COUNTRIES[0];
  } catch {
    return COUNTRIES[0];
  }
}

/** Longest-dial-code match, so "+971..." is the UAE and not "+9". Null if the code is unknown. */
export function matchPhone(e164: string): { country: Country; national: string } | null {
  const country = BY_DIAL_LENGTH.find((c) => e164.startsWith(c.dial));
  return country ? { country, national: e164.slice(country.dial.length) } : null;
}

/** Split an E.164 number into the picker's country and the national digits. */
export function splitPhone(e164: string): { country: Country; national: string } {
  return (
    matchPhone(e164) ?? {
      country: { name: "International", dial: "+", region: "" },
      national: e164.replace(/\D/g, ""),
    }
  );
}

/**
 * Builds E.164 from the picker and the typed digits. A number typed with its own leading "+" is
 * taken as already international, so a pasted "+1 415 555 0100" is never prefixed with +91.
 */
export function joinPhone(country: Country, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (national.trim().startsWith("+")) return `+${digits}`;
  return `${country.dial}${digits.replace(/^0+/, "")}`;
}

/** "+919876500001" -> "+91 98765 00001". Purely cosmetic; the stored value stays E.164. */
export function prettyPhone(e164: string): string {
  const { country, national } = splitPhone(e164);
  let grouped: string;
  if (country.dial === "+91" && national.length === 10) {
    grouped = `${national.slice(0, 5)} ${national.slice(5)}`; // Indian style: 98765 00001
  } else if (national.length === 10) {
    grouped = `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`; // 415 555 0100
  } else {
    grouped = national.replace(/(\d{3})(?=\d{3,})/g, "$1 ");
  }
  return `${country.dial} ${grouped}`.replace(/^\+ /, "+");
}
