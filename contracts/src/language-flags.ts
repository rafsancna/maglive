/**
 * Country flags are stored as static SVG files on the backend
 * (`backend/assets/flags/<country>.svg`) and are published twice:
 *
 * - `/media/flags/<country>.svg` — canonical asset on the API host.
 * - `/flags/<country>.svg` — same-origin path served by the website, so the
 *   URL keeps working on any domain, IP address or port, in development and
 *   in production, without a rebuild.
 *
 * The mapping lives in the shared contracts package so the API, the CMS and
 * the download script always agree about which flag belongs to which language.
 */

/** Country used for a language when its tag does not carry a region. */
export const LANGUAGE_COUNTRY_CODES: Readonly<Record<string, string>> = {
  af: "ZA",
  am: "ET",
  ar: "SA",
  az: "AZ",
  be: "BY",
  bg: "BG",
  bn: "BD",
  bo: "CN",
  bs: "BA",
  ca: "ES",
  cs: "CZ",
  cy: "GB",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "US",
  es: "ES",
  et: "EE",
  eu: "ES",
  fa: "IR",
  fi: "FI",
  fil: "PH",
  fr: "FR",
  ga: "IE",
  gl: "ES",
  gu: "IN",
  ha: "NG",
  he: "IL",
  hi: "IN",
  hr: "HR",
  hu: "HU",
  hy: "AM",
  id: "ID",
  ig: "NG",
  is: "IS",
  it: "IT",
  ja: "JP",
  ka: "GE",
  kk: "KZ",
  km: "KH",
  kn: "IN",
  ko: "KR",
  ky: "KG",
  lo: "LA",
  lt: "LT",
  lv: "LV",
  mg: "MG",
  mk: "MK",
  ml: "IN",
  mn: "MN",
  mr: "IN",
  ms: "MY",
  mt: "MT",
  my: "MM",
  nb: "NO",
  ne: "NP",
  nl: "NL",
  nn: "NO",
  no: "NO",
  pa: "IN",
  pl: "PL",
  ps: "AF",
  pt: "BR",
  ro: "RO",
  ru: "RU",
  si: "LK",
  sk: "SK",
  sl: "SI",
  sn: "ZW",
  so: "SO",
  sq: "AL",
  sr: "RS",
  sv: "SE",
  sw: "KE",
  ta: "IN",
  te: "IN",
  tg: "TJ",
  th: "TH",
  tk: "TM",
  tr: "TR",
  ug: "CN",
  uk: "UA",
  ur: "PK",
  uz: "UZ",
  vi: "VN",
  yo: "NG",
  zh: "CN",
  zu: "ZA",
};

/**
 * Every country that has a stored flag file. Keep this list and
 * `backend/assets/flags` in sync with `npm run flags:fetch`.
 */
export const FLAG_COUNTRY_CODES: readonly string[] = Object.freeze([
  "ae", "af", "al", "am", "ar", "at", "au", "az", "ba", "bd", "be", "bg",
  "bh", "bo", "br", "by", "ca", "ch", "cl", "cn", "co", "cr", "cz", "de",
  "dk", "do", "dz", "ec", "ee", "eg", "es", "et", "fi", "fr", "gb", "ge",
  "gh", "gr", "gt", "hk", "hn", "hr", "hu", "id", "ie", "il", "in", "iq",
  "ir", "is", "it", "jo", "jp", "ke", "kg", "kh", "kr", "kw", "kz", "la",
  "lb", "lk", "lt", "lu", "lv", "ly", "ma", "mg", "mk", "mm", "mn", "mt",
  "mx", "my", "ng", "ni", "nl", "no", "np", "nz", "om", "pa", "pe", "ph",
  "pk", "pl", "ps", "pt", "py", "qa", "ro", "rs", "ru", "sa", "sd", "se",
  "sg", "si", "sk", "sn", "so", "sv", "sy", "th", "tj", "tm", "tn", "tr",
  "tw", "tz", "ua", "ug", "us", "uy", "uz", "ve", "vn", "ye", "za", "zm",
  "zw",
]);

const flagCountryCodeSet: ReadonlySet<string> = new Set(FLAG_COUNTRY_CODES);

/** Backend asset path of a stored flag. */
export function flagAssetPath(countryCode: string): string {
  return `/media/flags/${countryCode.toLowerCase()}.svg`;
}

/** Same-origin path used by the website and the CMS for a stored flag. */
export function flagPublicPath(countryCode: string): string {
  return `/flags/${countryCode.toLowerCase()}.svg`;
}

/** Region carried by a BCP 47 tag, but only when a flag file exists for it. */
export function regionCodeFromLanguageTag(
  languageTag: string,
): string | undefined {
  const [base, ...subtags] = languageTag.trim().split(/[-_]/);
  if (base === undefined || base === "") return undefined;
  for (const subtag of subtags) {
    if (!/^[A-Za-z]{2}$/.test(subtag)) continue;
    const candidate = subtag.toUpperCase();
    if (flagCountryCodeSet.has(candidate.toLowerCase())) return candidate;
  }
  return undefined;
}

/** Country whose flag represents a language, if one is available. */
export function countryCodeForLanguage(
  code: string,
  languageTag: string,
): string | undefined {
  const region = regionCodeFromLanguageTag(languageTag);
  if (region !== undefined) return region;
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  if (base === undefined || base === "") return undefined;
  const mapped = LANGUAGE_COUNTRY_CODES[base];
  return mapped !== undefined && flagCountryCodeSet.has(mapped.toLowerCase())
    ? mapped
    : undefined;
}
