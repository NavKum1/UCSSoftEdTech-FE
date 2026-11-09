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
  // Only for schools in these countries (ISO codes); absent = every school
  countries?: string[];
  // Heading the entry sits under in the menu (en() where shown); entries of a group are listed together
  group?: string;
  // A heading inside the group's menu (en() where shown), e.g. "Interviews" in Practice
  sub?: string;
  // A shorter label for the bar of the group's pages under the header
  short?: string;
}

/** Whether an entry shows for a school in this country (country pages only for schools in those countries; none while unknown) */
export const shownForCountry = (item: CareerNavItem, country: string | null) =>
  !item.countries || (country !== null && item.countries.includes(country));

export const CAREER_PREFIXES = ["/student", "/career-center", "/employer", "/faculty", "/alumni", "/supervisor", "/kiosk"];

// Career pages that render without the career shell (they keep the app's <main>) but are reached by white-label
// users, so the Edulexa header must not show on them either
export const CAREER_STANDALONE_PREFIXES = ["/partner/callback", "/career-unsubscribe", "/verify/internship"];

// Sign-in and sign-up (/login, /login?mode=signup): a full-screen, brand-aware page of their own (components/auth),
// which may also be white-labelled. Exact paths only: /login/sso keeps the navigation.
export const AUTH_PAGES = ["/login"];

// Self-serve sign-up for schools (/start, /start/done): a focused flow of its own (S1)
export const SIGNUP_PREFIXES = ["/start"];

// Portals with a header of their own (app/<portal>/layout.tsx): the global navigation would show a second header there
export const PORTAL_PREFIXES = ["/recruiter", "/institute", "/admin", "/advisor"];

// Pages embedded on other websites (e.g. an institute's guidance form): no Edulexa header
export const EMBED_PREFIXES = ["/embed"];

const matches = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** Recruiter, institute, admin and advisor pages: PortalShell renders their header and their <main> */
export function isPortalPath(pathname: string | null | undefined): boolean {
  return !!pathname && matches(pathname, PORTAL_PREFIXES);
}

export function isCareerSuitePath(pathname: string | null | undefined): boolean {
  return !!pathname && matches(pathname, CAREER_PREFIXES);
}

/** True where the platform's global navigation (Edulexa branding) must be hidden */
export function hidesGlobalNavigation(pathname: string | null | undefined): boolean {
  return (
    !!pathname &&
    (matches(pathname, CAREER_PREFIXES) || matches(pathname, CAREER_STANDALONE_PREFIXES) || matches(pathname, PORTAL_PREFIXES) || matches(pathname, EMBED_PREFIXES) || matches(pathname, SIGNUP_PREFIXES) || AUTH_PAGES.includes(pathname))
  );
}

export const careerNav: Record<CareerPersona, CareerNavItem[]> = {
  student: [
    { label: "Home", href: "/student", module: "F1", ready: true },
    { label: "My assessments", href: "/student/assessments", module: "BD2", ready: true },
    { label: "Appointments", href: "/student/appointments", module: "C3", ready: true, group: "Get help" },
    { label: "Document review", href: "/student/document-review", module: "C6", ready: true, group: "Get help" },
    { label: "Mentoring", href: "/student/mentoring", module: "C10", ready: true, group: "Get help" },
    { label: "Career agent", href: "/student/agent", module: "E", ready: true, group: "Get help" },
    { label: "Messages", href: "/student/messages", module: "C7", ready: true, group: "Get help" },
    { label: "Chat & SMS", href: "/student/chat-sms", module: "G7", ready: true, group: "Get help" },
    { label: "Surveys", href: "/student/surveys", module: "C8", ready: false, group: "Get help" },
    { label: "Job board", href: "/student/jobs", module: "H1", ready: true, group: "Find work" },
    { label: "My applications", href: "/student/jobs/applications", module: "H1", ready: true, group: "Find work" },
    { label: "Internships", href: "/student/experiences", module: "C9", ready: true, group: "Find work" },
    { label: "Interviews", href: "/student/interviews", module: "C4", ready: true, group: "Find work" },
    { label: "Career fairs", href: "/student/fairs", module: "C5", ready: true, group: "Find work" },
    { label: "Challenges", href: "/student/challenges", module: "D7", ready: true, group: "Find work" },
    { label: "International", href: "/student/international", module: "D3", ready: true, group: "Find work" },
    // P1 (5 Nov 2026): practice and guidance live in the same menu as the school's pages. 7 Nov 2026: the same Practice
    // pages, names and groups as the member menu (components/GlobalNavigation)
    { label: "Interview practice", href: "/interview/practice", module: "B2", ready: true, group: "Practice", sub: "Interviews" },
    { label: "Speaking practice", short: "Speaking", href: "/prep/delivery", module: "B2", ready: true, group: "Practice", sub: "Interviews" },
    { label: "Leadership practice", short: "Leadership", href: "/leadership/simulator", module: "B3", ready: true, group: "Practice", sub: "Interviews" },
    { label: "Code review drills", short: "Code review", href: "/daily/review", module: "B2", ready: true, group: "Practice", sub: "Engineering drills" },
    { label: "Incident drills", short: "Incidents", href: "/daily/incident", module: "B2", ready: true, group: "Practice", sub: "Engineering drills" },
    { label: "Failover practice", short: "Failover", href: "/practice/failover", module: "B2", ready: true, group: "Practice", sub: "Engineering drills" },
    { label: "System design duels", short: "System design", href: "/duels/arena", module: "B2", ready: true, group: "Practice", sub: "Engineering drills" },
    { label: "Coding challenges", href: "/sprint/distributed-database", module: "B2", ready: true, group: "Practice", sub: "Prove your skills" },
    { label: "Written exams", href: "/prep/exam", module: "B2", ready: true, group: "Practice", sub: "Prove your skills" },
    { label: "Defend your repo", href: "/defend-repo", module: "B2", ready: true, group: "Practice", sub: "Prove your skills" },
    { label: "Leaderboard", href: "/leaderboard", module: "B2", ready: true, group: "Practice" },
    { label: "Counseling quiz", href: "/prep/counselling", module: "C3", ready: true, group: "Guidance" },
    { label: "Career path", href: "/prep/career", module: "C3", ready: true, group: "Guidance" },
    { label: "My guidance requests", href: "/my/guidance", module: "C3", ready: true, group: "Guidance" },
    { label: "My next step", href: "/student/next-step", module: "D4", ready: true, group: "Your record" },
    { label: "My competencies", href: "/student/competencies", module: "D1", ready: true, group: "Your record" },
    { label: "My record", href: "/student/record", module: "F2", ready: true, group: "Your record" },
    { label: "My placement record", href: "/student/placements", module: "G14a", ready: true, group: "Your record" },
    { label: "My results", href: "/my/results", module: "F2", ready: true, group: "Your record" },
    { label: "Credentials", href: "/credentials", module: "F2", ready: true, group: "Your record" },
    { label: "Skill passport", href: "/passport", module: "F2", ready: true, group: "Your record" },
    { label: "Résumés", href: "/resumes", module: "R1", ready: true, group: "Your record" },
    { label: "Job check", href: "/resumes/job-check", module: "R1", ready: true, group: "Your record" },
    { label: "Cover letters", href: "/resumes/cover-letters", module: "R1", ready: true, group: "Your record" },
    { label: "National credentials", href: "/student/national-credentials", module: "G6", ready: true, countries: ["IN"], group: "Your record" },
    { label: "Privacy & sharing", href: "/student/privacy", module: "F4", ready: true, group: "Account" },
    { label: "Notifications", href: "/student/notifications", module: "F5", ready: true, group: "Account" },
  ],
  "career-center": [
    { label: "Home", href: "/career-center", module: "F1", ready: true },
    { label: "Appointments", href: "/career-center/appointments", module: "C3", ready: true, group: "Students" },
    { label: "Caseload", href: "/career-center/caseload", module: "D6", ready: true, group: "Students" },
    { label: "Document review", href: "/career-center/document-review", module: "C6", ready: true, group: "Students" },
    { label: "Interview schedules", href: "/career-center/interviews", module: "C4", ready: true, group: "Students" },
    { label: "Mentoring", href: "/career-center/mentoring", module: "C10", ready: true, group: "Students" },
    { label: "Messages & campaigns", href: "/career-center/messages", module: "C7", ready: true, group: "Students" },
    { label: "International students", href: "/career-center/international", module: "D3", ready: true, group: "Students" },
    { label: "Challenges", href: "/career-center/challenges", module: "D7", ready: true, group: "Students" },
    { label: "Employers", href: "/career-center/employers", module: "F3", ready: true, group: "Employers and jobs" },
    { label: "Career fairs", href: "/career-center/fairs", module: "C5", ready: true, group: "Employers and jobs" },
    { label: "Internships", href: "/career-center/experiences", module: "C9", ready: true, group: "Employers and jobs" },
    { label: "Placement office", href: "/career-center/placements", module: "G14a", ready: true, group: "Employers and jobs" },
    { label: "Campus drives", href: "/career-center/placements/drives", module: "H1", ready: true, group: "Employers and jobs" },
    { label: "Résumé book", href: "/career-center/resume-books", module: "R1", ready: true, group: "Employers and jobs" },
    { label: "Apprenticeships", href: "/career-center/apprenticeships", module: "G15", ready: true, countries: ["US"], group: "Employers and jobs" },
    { label: "Outcomes", href: "/career-center/outcomes", module: "D4", ready: true, group: "Reports" },
    { label: "Reports", href: "/career-center/reports", module: "C11", ready: true, group: "Reports" },
    { label: "NIRF, NAAC and NBA reports", href: "/career-center/reports/india", module: "G3/G4", ready: true, countries: ["IN"], group: "Reports" },
    { label: "Workforce localization", href: "/career-center/reports/localisation", module: "G12", ready: true, countries: ["SA", "AE", "QA", "ZA"], group: "Reports" },
    { label: "Workforce (WIOA) reports", href: "/career-center/reports/workforce", module: "G15", ready: true, countries: ["US"], group: "Reports" },
    { label: "Bootcamp outcomes (CIRR-style)", href: "/career-center/reports/cirr", module: "G16", ready: true, group: "Reports" },
    { label: "Frameworks", href: "/career-center/frameworks", module: "D1", ready: true, group: "Reports" },
    { label: "People", href: "/career-center/people", module: "F1", ready: true, group: "Setup" },
    { label: "Imports", href: "/career-center/imports", module: "I1", ready: true, group: "Setup" },
    { label: "SIS roster sync", href: "/career-center/settings/sis", module: "I2", ready: true, group: "Setup" },
    { label: "Calendar sync", href: "/career-center/calendar", module: "I3", ready: true, group: "Setup" },
    { label: "Chat & SMS", href: "/career-center/settings/chat-sms", module: "G7", ready: true, group: "Setup" },
    { label: "National credentials", href: "/career-center/national-credentials", module: "G6", ready: true, countries: ["IN"], group: "Setup" },
    { label: "Settings", href: "/career-center/settings", module: "F1", ready: true, group: "Setup" },
    { label: "Billing", href: "/career-center/billing", module: "G9", ready: true, group: "Setup" },
    { label: "Privacy requests", href: "/career-center/privacy", module: "G18", ready: true, group: "Privacy" },
    { label: "Privacy log", href: "/career-center/privacy-log", module: "F4", ready: true, group: "Privacy" },
    { label: "Notifications", href: "/career-center/notifications", module: "F5", ready: true, group: "Privacy" },
  ],
  employer: [
    { label: "Home", href: "/employer", module: "F3", ready: true },
    // 7 Nov 2026: hiring work in one menu, the company's own pages in another
    { label: "Campus jobs", href: "/employer/jobs", module: "H1", ready: true, group: "Hiring" },
    { label: "Interview schedules", href: "/employer/interviews", module: "C4", ready: true, group: "Hiring" },
    { label: "Career fairs", href: "/employer/fairs", module: "C5", ready: true, group: "Hiring" },
    { label: "Challenges", href: "/employer/challenges", module: "D7", ready: true, group: "Hiring" },
    { label: "Résumé books", href: "/employer/resume-books", module: "R1", ready: true, group: "Hiring" },
    { label: "Interns", href: "/employer/interns", module: "C9", ready: false, group: "Hiring" },
    { label: "Schools", href: "/employer/schools", module: "F3", ready: true },
    { label: "Company", href: "/employer/company", module: "F3", ready: true, group: "Your company" },
    { label: "Team", href: "/employer/team", module: "F3", ready: true, group: "Your company" },
    { label: "Notifications", href: "/employer/notifications", module: "F5", ready: true },
  ],
  faculty: [
    { label: "Home", href: "/faculty", module: "F1", ready: true },
    { label: "Classes", href: "/faculty/classes", module: "BD2", ready: true },
    { label: "Assessments", href: "/faculty/assessments", module: "BD2", ready: true },
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
