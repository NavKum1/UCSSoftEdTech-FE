/**
 * G10 web app manifest for the career suite: /career.webmanifest?persona=student
 *
 * Brand-aware: the name, color and icon come from the school's brand for this host (public GET /api/career/brand,
 * the same call CareerShell makes). If the brand cannot be read, the manifest stays neutral ("Career Center"):
 * a white-labelled school must never be installed under the platform's name.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const PERSONAS = ["student", "career-center", "employer", "faculty", "alumni"];
const NEUTRAL_NAME = "Career Center";
const NEUTRAL_COLOR = "#3f3f46";

interface Brand {
  displayName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

async function brandFor(host: string): Promise<Brand | null> {
  try {
    const res = await fetch(`${API_BASE}/api/career/brand?host=${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 600 },
    });
    return res.ok ? ((await res.json()) as Brand) : null;
  } catch {
    return null;
  }
}

const isColor = (c?: string) => !!c && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c);
const isHttpUrl = (u?: string | null) => !!u && /^(https:\/\/|\/)/i.test(u);

export async function GET(req: NextRequest) {
  const persona = PERSONAS.includes(req.nextUrl.searchParams.get("persona") ?? "") ? req.nextUrl.searchParams.get("persona")! : "student";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const brand = await brandFor(host);
  const name = brand?.displayName?.trim() || NEUTRAL_NAME;
  const color = isColor(brand?.primaryColor) ? brand!.primaryColor! : NEUTRAL_COLOR;

  const icons: { src: string; sizes: string; type?: string; purpose?: string }[] = [];
  if (isHttpUrl(brand?.logoUrl)) icons.push({ src: brand!.logoUrl!, sizes: "any" });
  icons.push({ src: "/career-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" });

  const manifest = {
    id: `/${persona}`,
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0].slice(0, 12) : name,
    start_url: `/${persona}`,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: color,
    icons,
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=600", vary: "host, x-forwarded-host" },
  });
}
