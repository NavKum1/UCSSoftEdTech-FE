/**
 * Brand colors come from each school's settings, so they can be any shade. White text on a light or mid-tone
 * brand color fails WCAG 1.4.3 (4.5:1). accessibleBrandColor keeps the hue and darkens the color just enough
 * for white text; pages use it as --brand for backgrounds behind white text and for selected-state borders.
 */

const FALLBACK = "#4f46e5";

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 1;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The brand color, darkened only as much as needed so white text on it reaches at least 4.5:1. */
export function accessibleBrandColor(brand: string | null | undefined, minRatio = 4.6): string {
  const rgb = parseHex(brand ?? "") ?? parseHex(FALLBACK)!;
  let current: [number, number, number] = rgb;
  for (let i = 0; i < 40 && contrastRatio(toHex(current), "#ffffff") < minRatio; i++) {
    current = [current[0] * 0.94, current[1] * 0.94, current[2] * 0.94];
  }
  return toHex(current);
}

function mix(c: [number, number, number], target: number, amount: number): [number, number, number] {
  return [c[0] + (target - c[0]) * amount, c[1] + (target - c[1]) * amount, c[2] + (target - c[2]) * amount];
}

/**
 * Brand color for text: darkened for light pages, lightened for dark mode, each reaching 4.5:1 against the page
 * and card backgrounds. Use with BRAND_TEXT_CLASS after setting brandCssVars on a parent.
 */
export function brandTextColors(brand: string | null | undefined): { light: string; dark: string } {
  const rgb = parseHex(brand ?? "") ?? parseHex(FALLBACK)!;
  let light: [number, number, number] = rgb;
  for (let i = 0; i < 40 && contrastRatio(toHex(light), "#eef0f3") < 4.6; i++) light = mix(light, 0, 0.06);
  let dark: [number, number, number] = rgb;
  for (let i = 0; i < 40 && contrastRatio(toHex(dark), "#16181d") < 4.6; i++) dark = mix(dark, 255, 0.08);
  return { light: toHex(light), dark: toHex(dark) };
}

/** CSS variables for a brand-aware subtree: --brand (safe behind white text) and the brand text colors. */
export function brandCssVars(brand: string | null | undefined): Record<string, string> {
  const text = brandTextColors(brand);
  return { "--brand": accessibleBrandColor(brand), "--brand-text-light": text.light, "--brand-text-dark": text.dark };
}

/** Text in the brand color with enough contrast in light and dark mode (needs brandCssVars on a parent). */
export const BRAND_TEXT_CLASS = "text-[var(--brand-text-light)] dark:text-[var(--brand-text-dark)]";
