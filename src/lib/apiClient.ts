import { getDevSession } from "@/lib/devSession";

/**
 * Authenticated API fetch for the Edulexa frontend.
 * Automatically attaches Clerk JWT Session Bearer Token in HTTP Authorization Header.
 */

/** The default (home) API. With regional hosting this is also the directory that answers region lookups. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";

/*
 * G8 regional hosting (docs/regional_hosting.md). OFF unless NEXT_PUBLIC_API_REGIONS is set at build time, e.g.
 *   NEXT_PUBLIC_API_REGIONS="US=https://api.us.example.com,IN=https://api.in.example.com"
 * When off, every call goes to API_BASE_URL exactly as before.
 * When on, the list is an allowlist: the browser sends the user's token only to these origins, whatever an API answers.
 * A school hosted in another region is answered by the API with 409 {code:"wrong_region", region}; the client then
 * switches this tab's API base to that region (kept in sessionStorage for the tab's session) and retries once.
 */
function parseRegions(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i <= 0) continue;
    const id = pair.slice(0, i).trim().toUpperCase();
    const url = pair.slice(i + 1).trim().replace(/\/+$/, "");
    if (id && /^https?:\/\//.test(url)) map[id] = url;
  }
  return map;
}

export const API_REGIONS: Record<string, string> = parseRegions(process.env.NEXT_PUBLIC_API_REGIONS);
export const REGION_ROUTING = Object.keys(API_REGIONS).length > 0;

const REGION_KEY = "api.region";
type StoredRegion = { region: string; user: string | null };

function readRegion(): StoredRegion | null {
  if (!REGION_ROUTING || typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(REGION_KEY) ?? "null") as StoredRegion | null;
    return stored && API_REGIONS[stored.region] ? stored : null;
  } catch {
    return null;
  }
}

/** The API base for this tab: the region chosen for the signed-in user's school, else API_BASE_URL. */
export function getApiBaseUrl(): string {
  const stored = readRegion();
  return stored ? API_REGIONS[stored.region] : API_BASE_URL;
}

/** The region this tab is pinned to, if any. */
export function getApiRegion(): StoredRegion | null {
  return readRegion();
}

/**
 * Points this tab at a region's API (null = back to API_BASE_URL). Regions outside NEXT_PUBLIC_API_REGIONS are ignored.
 * `user` ties the choice to the signed-in user so a different user in the same tab starts from the default again.
 * Returns true when the API base changed.
 */
export function setApiRegion(region: string | null, user: string | null = null): boolean {
  if (!REGION_ROUTING || typeof window === "undefined") return false;
  const before = getApiBaseUrl();
  const id = region?.toUpperCase() ?? null;
  try {
    if (id && API_REGIONS[id]) window.sessionStorage.setItem(REGION_KEY, JSON.stringify({ region: id, user } satisfies StoredRegion));
    else if (!id) window.sessionStorage.removeItem(REGION_KEY);
    else return false;
  } catch {
    return false; // storage blocked: stay on the default API
  }
  return getApiBaseUrl() !== before;
}

/** If this response is the API's wrong-region answer for an allowed region, switch to it. Returns true when switched. */
async function followWrongRegion(res: Response): Promise<boolean> {
  if (!REGION_ROUTING || res.status !== 409) return false;
  try {
    const body = (await res.clone().json()) as { code?: unknown; region?: unknown };
    if (body?.code !== "wrong_region" || typeof body.region !== "string") return false;
    return setApiRegion(body.region, readRegion()?.user ?? null);
  } catch {
    return false;
  }
}

/** The career-suite language cookie (set by the language picker; see components/career/i18n/config.ts LOCALE_COOKIE). */
const CAREER_LOCALE_COOKIE = "career_locale";

function isCareerApi(endpoint: string): boolean {
  let path = endpoint;
  if (/^https?:\/\//.test(endpoint)) {
    try {
      path = new URL(endpoint).pathname;
    } catch {
      return false;
    }
  }
  return path === "/api/career" || path.startsWith("/api/career/") || path.startsWith("/api/career?");
}

/** A well-formed language tag from the cookie, or null (server side, no cookie, or anything odd). */
function careerLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CAREER_LOCALE_COOKIE}=`))?.slice(CAREER_LOCALE_COOKIE.length + 1);
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // BCP 47 shape only: keeps the header CORS-safelisted and free of injected text
  return /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8}){0,3}$/.test(value) ? value : null;
}

export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const relative = !endpoint.startsWith("http");
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // G1: career-suite responses the caller downloads (PDFs, exports) follow the language picked in this browser.
  // Only /api/career calls, and never over a header the caller set.
  if (!headers.has("Accept-Language") && isCareerApi(endpoint)) {
    const locale = careerLocaleCookie();
    if (locale) headers.set("Accept-Language", locale);
  }

  // Attach Clerk JWT Bearer Token if available
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        // Local developer session: the candidate dev token needs a stable user id
        const dev = getDevSession();
        if (dev?.userId && token === dev.token && !headers.has("X-User-Id")) headers.set("X-User-Id", dev.userId);
      }
    } catch (error) {
      console.warn("[API CLIENT] Could not retrieve Clerk JWT token:", error);
    }
  }

  const send = () => fetch(relative ? `${getApiBaseUrl()}${endpoint}` : endpoint, { ...options, headers });
  const res = await send();
  // G8: the API refuses a school hosted elsewhere before doing anything, so one retry at the right region is safe.
  // A school keeps the same id in every region, so the X-Career-Institute header stays valid there.
  if (relative && (await followWrongRegion(res))) return send();
  return res;
}

