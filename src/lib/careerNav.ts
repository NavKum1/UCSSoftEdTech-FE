/**
 * Navigation for the career suite, one list per persona. Modules add their pages under these routes;
 * an entry whose page doesn't exist yet stays hidden until `ready` is true.
 * Keep labels brand-neutral: these pages can be white-labelled for a partner.
 */

export type CareerPersona = "student" | "career-center" | "employer" | "faculty" | "alumni";

export interface CareerNavItem {
  // English label; translations live in messages/career/*.json under Career.nav.<persona>.<key from href> (G1)
  label: string;
  href: string;
  // Plan item that delivers the page (docs/career_services_suite_plan.md)
  module: string;
  ready: boolean;
}

export const CAREER_PREFIXES = ["/student", "/career-center", "/employer", "/faculty", "/alumni", "/supervisor", "/kiosk"];

// Career pages that render without the career shell (they keep the app's <main>) but are reached by white-label
// users, so the Edulexa header must not show on them either
export const CAREER_STANDALONE_PREFIXES = ["/partner/callback", "/career-unsubscribe", "/verify/internship"];

// Sign-in and sign-up (/login, /login?mode=signup): a full-screen, brand-aware page of their own (components/auth),
// which may also be white-labelled. Exact paths only: /login/sso keeps the navigation.
export const AUTH_PAGES = ["/login"];

// Portals with a header of their own (app/<portal>/layout.tsx): the global navigation would show a second header there
export const PORTAL_PREFIXES = ["/recruiter", "/institute", "/admin"];

const matches = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isCareerSuitePath(pathname: string | null | undefined): boolean {
  return !!pathname && matches(pathname, CAREER_PREFIXES);
}

/** True where the platform's global navigation (Edulexa branding) must be hidden */
export function hidesGlobalNavigation(pathname: string | null | undefined): boolean {
  return (
    !!pathname &&
    (matches(pathname, CAREER_PREFIXES) || matches(pathname, CAREER_STANDALONE_PREFIXES) || matches(pathname, PORTAL_PREFIXES) || AUTH_PAGES.includes(pathname))
  );
}

export const careerNav: Record<CareerPersona, CareerNavItem[]> = {
  student: [
    { label: "Home", href: "/student", module: "F1", ready: true },
    { label: "Appointments", href: "/student/appointments", module: "C3", ready: true },
    { label: "Document review", href: "/student/document-review", module: "C6", ready: true },
    { label: "Internships", href: "/student/experiences", module: "C9", ready: true },
    { label: "Mentoring", href: "/student/mentoring", module: "C10", ready: true },
    { label: "Interviews", href: "/student/interviews", module: "C4", ready: true },
    { label: "Career fairs", href: "/student/fairs", module: "C5", ready: true },
    { label: "Messages", href: "/student/messages", module: "C7", ready: true },
    { label: "Surveys", href: "/student/surveys", module: "C8", ready: false },
    { label: "My next step", href: "/student/next-step", module: "D4", ready: true },
    { label: "Job board", href: "/student/jobs", module: "H1", ready: true },
    { label: "My applications", href: "/student/jobs/applications", module: "H1", ready: true },
    { label: "Career agent", href: "/student/agent", module: "E", ready: true },
    { label: "My placement record", href: "/student/placements", module: "G14a", ready: true },
    { label: "Challenges", href: "/student/challenges", module: "D7", ready: true },
    { label: "International", href: "/student/international", module: "D3", ready: true },
    { label: "My competencies", href: "/student/competencies", module: "D1", ready: true },
    { label: "My record", href: "/student/record", module: "F2", ready: true },
    { label: "National credentials", href: "/student/national-credentials", module: "G6", ready: true },
    { label: "Privacy & sharing", href: "/student/privacy", module: "F4", ready: true },
    { label: "Chat & SMS", href: "/student/chat-sms", module: "G7", ready: true },
    { label: "Notifications", href: "/student/notifications", module: "F5", ready: true },
  ],
  "career-center": [
    { label: "Home", href: "/career-center", module: "F1", ready: true },
    { label: "Appointments", href: "/career-center/appointments", module: "C3", ready: true },
    { label: "Caseload", href: "/career-center/caseload", module: "D6", ready: true },
    { label: "Document review", href: "/career-center/document-review", module: "C6", ready: true },
    { label: "Interview schedules", href: "/career-center/interviews", module: "C4", ready: true },
    { label: "Career fairs", href: "/career-center/fairs", module: "C5", ready: true },
    { label: "Internships", href: "/career-center/experiences", module: "C9", ready: true },
    { label: "Mentoring", href: "/career-center/mentoring", module: "C10", ready: true },
    { label: "Messages & campaigns", href: "/career-center/messages", module: "C7", ready: true },
    { label: "Outcomes", href: "/career-center/outcomes", module: "D4", ready: true },
    { label: "Placement office", href: "/career-center/placements", module: "G14a", ready: true },
    { label: "Campus drives", href: "/career-center/placements/drives", module: "H1", ready: true },
    { label: "Reports", href: "/career-center/reports", module: "C11", ready: true },
    { label: "NIRF, NAAC and NBA reports", href: "/career-center/reports/india", module: "G3/G4", ready: true },
    { label: "Workforce localisation", href: "/career-center/reports/localisation", module: "G12", ready: true },
    { label: "Workforce (WIOA) reports", href: "/career-center/reports/workforce", module: "G15", ready: true },
    { label: "Apprenticeships", href: "/career-center/apprenticeships", module: "G15", ready: true },
    { label: "Bootcamp outcomes (CIRR-style)", href: "/career-center/reports/cirr", module: "G16", ready: true },
    { label: "Frameworks", href: "/career-center/frameworks", module: "D1", ready: true },
    { label: "Challenges", href: "/career-center/challenges", module: "D7", ready: true },
    { label: "International students", href: "/career-center/international", module: "D3", ready: true },
    { label: "Employers", href: "/career-center/employers", module: "F3", ready: true },
    { label: "Imports", href: "/career-center/imports", module: "I1", ready: true },
    { label: "SIS roster sync", href: "/career-center/settings/sis", module: "I2", ready: true },
    { label: "Chat & SMS", href: "/career-center/settings/chat-sms", module: "G7", ready: true },
    { label: "Calendar sync", href: "/career-center/calendar", module: "I3", ready: true },
    { label: "People", href: "/career-center/people", module: "F1", ready: true },
    { label: "National credentials", href: "/career-center/national-credentials", module: "G6", ready: true },
    { label: "Billing", href: "/career-center/billing", module: "G9", ready: true },
    { label: "Settings", href: "/career-center/settings", module: "F1", ready: true },
    { label: "Privacy log", href: "/career-center/privacy-log", module: "F4", ready: true },
    { label: "Privacy requests", href: "/career-center/privacy", module: "G18", ready: true },
    { label: "Notifications", href: "/career-center/notifications", module: "F5", ready: true },
  ],
  employer: [
    { label: "Home", href: "/employer", module: "F3", ready: true },
    { label: "Campus jobs", href: "/employer/jobs", module: "H1", ready: true },
    { label: "Interview schedules", href: "/employer/interviews", module: "C4", ready: true },
    { label: "Career fairs", href: "/employer/fairs", module: "C5", ready: true },
    { label: "Challenges", href: "/employer/challenges", module: "D7", ready: true },
    { label: "Interns", href: "/employer/interns", module: "C9", ready: false },
    { label: "Schools", href: "/employer/schools", module: "F3", ready: true },
    { label: "Company", href: "/employer/company", module: "F3", ready: true },
    { label: "Team", href: "/employer/team", module: "F3", ready: true },
    { label: "Notifications", href: "/employer/notifications", module: "F5", ready: true },
  ],
  faculty: [
    { label: "Home", href: "/faculty", module: "F1", ready: true },
    { label: "Internship approvals", href: "/faculty/experiences", module: "C9", ready: true },
    { label: "Outcome attainment", href: "/faculty/frameworks", module: "D1", ready: true },
    { label: "Notifications", href: "/faculty/notifications", module: "F5", ready: true },
  ],
  alumni: [
    { label: "Home", href: "/alumni", module: "C10", ready: true },
    { label: "Mentoring", href: "/alumni/mentoring", module: "C10", ready: true },
  ],
};

export const personaTitle: Record<CareerPersona, string> = {
  student: "Career",
  "career-center": "Career center",
  employer: "Employer",
  faculty: "Faculty",
  alumni: "Alumni",
};
