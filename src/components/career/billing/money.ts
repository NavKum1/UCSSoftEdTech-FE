/**
 * Money display for the career suite's billing pages (G9). Amounts arrive in minor units (paise, cents).
 * Rupee amounts always use Indian digit grouping (lakh/crore: 12,34,567.00), whatever the page language,
 * because GST invoices are read that way. Other currencies follow the career locale.
 */

export function formatMinor(amountMinor: number | null | undefined, currency: string, locale: string): string {
  if (amountMinor === null || amountMinor === undefined) return "—";
  const code = (currency || "INR").toUpperCase();
  const value = amountMinor / 100;
  if (code === "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

/** GST state codes (first two digits of a GSTIN). Names are proper nouns and are not translated. */
export const GST_STATES: [string, string][] = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"],
  ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"],
  ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"],
  ["24", "Gujarat"], ["25", "Daman and Diu"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"],
  ["28", "Andhra Pradesh (before division)"], ["29", "Karnataka"], ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"],
  ["33", "Tamil Nadu"], ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"], ["37", "Andhra Pradesh"],
  ["38", "Ladakh"], ["97", "Other Territory"],
];

/** Saves a downloaded Response as a file. */
export async function saveResponse(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}
