/**
 * Readable names for time zones, so people never see raw ids such as "America/New_York".
 * timeZoneName("America/New_York") → "Eastern Time" (or "Eastern Standard Time" where the browser has no generic name).
 * timeZoneOption("America/New_York") → "Eastern Time (New York)", for pickers where several zones share a name.
 * Unknown ids come back with "_" as spaces, so nothing breaks.
 */
function zonePart(timeZone: string, style: "longGeneric" | "long", locale?: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

const city = (timeZone: string) => (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");

export function timeZoneName(timeZone: string | null | undefined, locale?: string): string {
  if (!timeZone) return "";
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "Coordinated Universal Time (UTC)";
  return zonePart(timeZone, "longGeneric", locale) ?? zonePart(timeZone, "long", locale) ?? timeZone.replace(/_/g, " ");
}

export function timeZoneOption(timeZone: string, locale?: string): string {
  const name = timeZoneName(timeZone, locale);
  if (!timeZone.includes("/")) return name;
  const place = city(timeZone);
  return name.includes(place) ? name : `${name} (${place})`;
}
