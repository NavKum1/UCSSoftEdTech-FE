/**
 * Local development only: a developer session started from the sign-in page's shortcuts. It holds one of the API's
 * development tokens (accepted only when the API runs in Development, see Program.cs), so the portals work without
 * Keycloak running. It is used only when DEMO_LOGIN_ENABLED (NODE_ENV development or NEXT_PUBLIC_ENABLE_DEMO_LOGIN), so
 * a production build ignores it. A candidate session keeps one user id (sent as X-User-Id) so their data stays theirs.
 */

import { useSyncExternalStore } from "react";

export const DEMO_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

export interface DevSession {
  role: string;
  label: string;
  token: string;
  userId: string | null;
  /**
   * Optional: the organization to send as X-Institute-Id instead of the persona's default (DEV_PERSONAS[role].institute).
   * scripts/help-shots.mjs sets it so the recruiter works for the demo company the API seeds (Data/DevRecruiterSeeder.cs,
   * Lakeshore Analytics (demo), 5c400300-0000-4000-8000-000000000001), with its team, evidence packs and appeals.
   */
  institute?: string;
}

const KEY = "edulexa_dev_session";
const EVENT = "edulexa-dev-session";

/** The demo school the API seeds in Development (backend Data/DevRolesSeeder.cs): every school persona belongs to it */
export const DEV_SCHOOL_ID = "5c400100-0000-4000-8000-000000000001";
const SCHOOL_KEY = "career.school"; // lib/appAuth getSelectedSchool

/**
 * Every role that signs in. Platform roles get their access from the token; school roles (perUser false, a fixed userId)
 * from their membership at the demo school or its employer, seeded by the API. A persona's key is also its role in
 * useAppAuth, which decides the home page (lib/roleHome), so school keys avoid the platform role names.
 * `institute`: the organization the API should treat the persona as working for, sent as X-Institute-Id (lib/apiClient),
 * as the end-to-end suites do; the API accepts that header only in Development.
 */
export const DEV_PERSONAS: Record<string, { label: string; token: string; perUser: boolean; userId?: string; school?: boolean; institute?: string }> = {
  Candidate: { label: "Member", token: "candidate-dev-token", perUser: true },
  // The development institute the institute admin and counselor tokens default to (Global ITech Institute), so the
  // recruiter's review pages (evidence, work trials...) show that organization's data instead of "not linked to an institute".
  // A session with `institute` set to the demo company (DevSession.institute) gets the company's team page and demo data.
  Recruiter: { label: "Recruiter", token: "recruiter-dev-token", perUser: false, institute: "6c370735-4615-44f6-9d61-dbbb41d5d5cf" },
  InstituteAdmin: { label: "Institute admin", token: "institute-admin-dev-token", perUser: false },
  Counselor: { label: "Institute counselor", token: "institute-counsellor-dev-token", perUser: false },
  EdulexaAdvisor: { label: "Edulexa advisor", token: "advisor-dev-token", perUser: false },
  MentorReviewer: { label: "Mentor reviewer", token: "mentor-dev-token", perUser: false },
  SuperAdmin: { label: "Edulexa super admin", token: "superadmin-dev-token", perUser: false },
  CareerAdmin: { label: "Career center admin", token: "school-admin-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000011", school: true },
  CareerCounselor: { label: "Career counselor", token: "school-counselor-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000012", school: true },
  EmployerRelations: { label: "Employer relations", token: "employer-relations-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000013", school: true },
  Faculty: { label: "Faculty", token: "school-faculty-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000014", school: true },
  Student: { label: "Student", token: "school-student-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000015", school: true },
  Alumni: { label: "Alumni", token: "school-alumni-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000016", school: true },
  Employer: { label: "Employer", token: "employer-dev-token", perUser: false, userId: "5c400100-0000-4000-8000-000000000017", school: true },
};

let cachedRaw: string | null = null;
let cached: DevSession | null = null;

export function getDevSession(): DevSession | null {
  if (!DEMO_LOGIN_ENABLED || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as DevSession) : null;
    }
    return cached?.token ? cached : null;
  } catch {
    return null;
  }
}

/** Starts (or switches) the developer session. A candidate keeps the same user id across sessions in this browser. */
export function startDevSession(role: string): DevSession | null {
  const persona = DEV_PERSONAS[role];
  if (!DEMO_LOGIN_ENABLED || !persona) return null;
  let userId: string | null = persona.userId ?? null;
  if (persona.perUser) {
    try {
      userId = window.localStorage.getItem(`${KEY}_candidate_id`) ?? crypto.randomUUID();
      window.localStorage.setItem(`${KEY}_candidate_id`, userId);
    } catch {
      userId = crypto.randomUUID();
    }
  }
  const session: DevSession = { role, label: persona.label, token: persona.token, userId };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
    // A school persona works at the demo school; anyone else starts without a school picked (a school left over from
    // another persona would be refused, since they aren't a member there)
    if (persona.school) window.localStorage.setItem(SCHOOL_KEY, DEV_SCHOOL_ID);
    else window.localStorage.removeItem(SCHOOL_KEY);
  } catch {
    return null;
  }
  window.dispatchEvent(new Event(EVENT));
  return session;
}

export function endDevSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current developer session (null on the server, in production builds and when none is active). */
export function useDevSession(): DevSession | null {
  return useSyncExternalStore(subscribe, getDevSession, () => null);
}
