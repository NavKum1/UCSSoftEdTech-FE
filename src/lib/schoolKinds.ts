/**
 * The kinds of organisation a school can be, and the countries it can be in: the same lists for the sign-up (/start)
 * and the setup wizard (/institute/setup). The API checks the kinds against SchoolSignupService.Kinds.
 */

export type SchoolKind = "school" | "college" | "training" | "coaching" | "other";

export const SCHOOL_KINDS: { value: SchoolKind; label: string; text: string }[] = [
  { value: "school", label: "School", text: "Grades 9 to 12, or classes 8 to 12" },
  { value: "college", label: "College or university", text: "Admissions, careers and placements" },
  { value: "training", label: "Career or training school", text: "Healthcare, IT, trades and more" },
  { value: "coaching", label: "Coaching centre", text: "Test preparation and tuition" }, // en() where shown
  { value: "other", label: "Something else", text: "Any other kind of organisation" }, // en() where shown
];

export const COUNTRY_CODES =
  "AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IS IT JM JO JP KE KG KH KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PS PT PY QA RO RS RW SA SB SC SE SG SI SK SL SN SO SR SS SV SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VC VE VN VU WS XK YE ZA ZM ZW".split(" ");

/** The countries with their English names, sorted by name */
export function countryList(): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    names = null;
  }
  return COUNTRY_CODES.map((c) => ({ code: c, name: names?.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name));
}

export const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};
