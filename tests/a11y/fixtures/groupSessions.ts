/**
 * H14 group sessions: the student "Group sessions" tab, the career-center group sessions tab and one session's detail
 * (roster, attendance, waitlist, notes), plus the group sessions shown in the counselor schedule.
 */
import type { ApiFixture, A11yRoute, FixtureContext } from "./types";
import { USER_ID, days, hours } from "./types";
import type { GroupSession, GroupType } from "@/components/career/appointments/groupShared";

const TZ = "America/Chicago";
const local = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 16);

const HOSTS = [
  { userId: USER_ID, name: "Morgan Lee", isLead: true },
  { userId: "c0ffee00-0000-4000-8000-000000000002", name: "Priya Raman", isLead: false },
];

function session(over: Partial<GroupSession> & { id: string; startUtc: string }): GroupSession {
  const start = over.startUtc;
  const end = new Date(new Date(start).getTime() + 60 * 60_000).toISOString();
  return {
    typeId: "gt-1", typeName: "Résumé clinic", kind: "ResumeClinic", title: "Résumé clinic", description: "Bring a printed or digital résumé. We review in small groups.",
    endUtc: end, timeZone: TZ, localStart: local(start), capacity: 12, registered: 7, waitlisted: 0, seatsLeft: 5, mode: "InPerson", location: "Career Center, Room 210",
    meetingUrl: null, meetingSource: null, meetingProvider: null, meetingFallbackReason: null, status: "Scheduled", cancelReason: null,
    seriesId: null, seriesIndex: null, seriesCount: null, hosts: HOSTS, eligibility: {}, allowStudents: true, allowAlumni: true,
    minLeadMinutes: 60, maxLeadDays: 90, cancelCutoffMinutes: 120,
    promotionCutoffMinutes: 120, waitlistClosesUtc: new Date(new Date(start).getTime() - 7_200_000).toISOString(), waitlistOpen: true,
    registrationOpensUtc: days(-30), registrationClosesUtc: new Date(new Date(start).getTime() - 3_600_000).toISOString(), cancelCutoffUtc: new Date(new Date(start).getTime() - 7_200_000).toISOString(),
    registrationOpen: true, eligible: true, ineligibleReason: null, myRegistration: null,
    ...over,
  };
}

const SESSIONS: GroupSession[] = [
  session({ id: "gs-1", startUtc: days(3), seriesId: "series-1", seriesIndex: 2, seriesCount: 6, title: "Résumé clinic" }),
  session({
    id: "gs-2", startUtc: days(5), title: "Interview skills workshop", typeName: "Interview workshop", kind: "Workshop", mode: "Video", location: null,
    capacity: 20, registered: 20, waitlisted: 3, seatsLeft: 0, meetingUrl: "https://teams.microsoft.com/l/meetup-join/a11y-fixture", meetingSource: "Generated", meetingProvider: "Teams",
    eligibility: { majors: ["Computer Science", "Data Science"], classYears: [2027], degreeLevels: ["Bachelor"] },
  }),
  session({ id: "gs-3", startUtc: days(40), title: "Graduate school information session", typeName: "Information session", kind: "InfoSession", registrationOpensUtc: days(10), registrationOpen: false }),
];

const MINE_UPCOMING: GroupSession[] = [
  session({ id: "gs-4", startUtc: days(2), title: "Group advising: internships", typeName: "Group advising", kind: "GroupAdvising", mode: "Video", location: null,
    meetingUrl: "https://meet.google.com/abc-defg-hij", meetingSource: "Generated", meetingProvider: "GoogleMeet",
    myRegistration: { id: "gr-1", status: "Registered", attendance: null, waitlistPosition: null, canCancel: true, registeredAt: days(-3), promotedAt: null } }),
  session({ id: "gs-5", startUtc: days(6), title: "LinkedIn profile lab", typeName: "Workshop", kind: "Workshop", seatsLeft: 0, registered: 12, waitlisted: 4,
    myRegistration: { id: "gr-2", status: "Waitlisted", attendance: null, waitlistPosition: 2, canCancel: true, registeredAt: null, promotedAt: null } }),
  // H14b: past the waitlist cutoff with a seat free again: the waitlisted student can take it directly
  session({ id: "gs-7", startUtc: hours(3), title: "Mock interview lab", typeName: "Workshop", kind: "Workshop", seatsLeft: 1, registered: 11, waitlisted: 1, waitlistOpen: false,
    waitlistClosesUtc: hours(1), registrationClosesUtc: hours(2),
    myRegistration: { id: "gr-7", status: "Waitlisted", attendance: null, waitlistPosition: 1, canCancel: true, registeredAt: null, promotedAt: null } }),
];

const MINE_PAST: GroupSession[] = [
  session({ id: "gs-6", startUtc: days(-12), title: "Résumé clinic", myRegistration: { id: "gr-3", status: "Registered", attendance: "Present", waitlistPosition: null, canCancel: false, registeredAt: days(-20), promotedAt: null } }),
];

const TYPES: GroupType[] = [
  { id: "gt-1", name: "Résumé clinic", description: "Small-group résumé reviews.", kind: "ResumeClinic", durationMinutes: 60, capacity: 12, mode: "InPerson", location: "Career Center, Room 210", allowStudents: true, allowAlumni: true, eligibility: {}, minLeadMinutes: 60, maxLeadDays: 90, cancelCutoffMinutes: 120, promotionCutoffMinutes: 120, active: true, sortOrder: 0 },
  { id: "gt-2", name: "Interview workshop", description: null, kind: "Workshop", durationMinutes: 90, capacity: 20, mode: "Video", location: null, allowStudents: true, allowAlumni: false, eligibility: { classYears: [2027] }, minLeadMinutes: 0, maxLeadDays: 60, cancelCutoffMinutes: 60, promotionCutoffMinutes: 0, active: true, sortOrder: 1 },
];

const roster = (n: number, status: string, attendance: (i: number) => string | null) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${status}-${i}`, status, queueNumber: i + 1, waitlistPosition: status === "Waitlisted" ? i + 1 : null, attendance: attendance(i),
    student: { userId: `stu-${status}-${i}`, name: ["Aisha Khan", "Diego Ramos", "Mei Chen", "Tom Okafor", "Lena Fischer"][i % 5], email: `student${i}@lakeside.edu`, studentNumber: `S10${i}` },
    registeredAt: status === "Registered" ? days(-5) : null, waitlistedAt: status === "Waitlisted" ? days(-2) : null, promotedAt: i === 2 && status === "Registered" ? days(-1) : null,
    cancelledAt: status === "Cancelled" ? days(-1) : null, cancelReason: status === "Cancelled" ? "Exam clash" : null, addedByStaff: false,
    // H14b: one staff placement over capacity, and waitlisted students the last promotion passed over
    ...(status === "Registered" && i === 3 ? { addedByStaff: true, addedBy: { userId: USER_ID, name: "Morgan Lee" }, overCapacity: true, overCapacityReason: "Needs feedback before a visa interview" } : {}),
    ...(status === "Waitlisted" ? { promotionSkippedReason: i === 0 ? "TimeConflict" : "NotEligible", promotionSkippedAt: days(-1) } : {}),
    // H15: registered students on the lead host's calendar invite, one without a verified email
    ...(status === "Registered" ? (i === 1 ? { inviteStatus: "Skipped", inviteSkippedReason: "NoVerifiedEmail" } : { inviteStatus: "Invited", inviteSkippedReason: null }) : {}),
  }));

const detail = (ctx: FixtureContext) => {
  const id = ctx.url.pathname.split("/").pop() ?? "gs-1";
  const s = [...SESSIONS, ...MINE_UPCOMING].find((x) => x.id === id) ?? session({ id, startUtc: hours(-1), title: "Résumé clinic" });
  const started = id === "gs-past";
  const base = started ? session({ id, startUtc: hours(-1), title: "Résumé clinic", seriesId: "series-1", seriesIndex: 1, seriesCount: 6 }) : s;
  return {
    session: base,
    canManage: true,
    registered: roster(4, "Registered", (i) => (started ? (i === 3 ? "NoShow" : "Present") : null)),
    waitlist: roster(2, "Waitlisted", () => null),
    cancelled: roster(1, "Cancelled", () => null),
    sessionNotes: [
      { id: "sn-1", visibility: "Staff", body: "Room booked until 5 pm. Projector works.", createdAt: days(-2), author: "Morgan Lee", canEdit: true },
      { id: "sn-2", visibility: "Attendees", body: "Slides and the résumé checklist: see the shared folder.", createdAt: days(-1), author: "Priya Raman", canEdit: false },
    ],
    studentNotes: [{ id: "n-1", visibility: "Private", body: "Wants help with a career change summary.", createdAt: days(-1), author: "Morgan Lee", canEdit: true, studentUserId: "stu-Registered-0" }],
    tasks: [{ id: "t-1", studentUserId: "stu-Registered-0", title: "Send updated résumé", dueDate: days(7).slice(0, 10), status: "Open", assigneeType: "Student", studentName: "Aisha Khan" }],
  };
};

/** Group sessions in the counselor schedule (careerCenterA's schedule fixture adds these). */
export const scheduleGroupSessions: GroupSession[] = [session({ id: "gs-sched", startUtc: hours(3), title: "Résumé clinic", registered: 9, seatsLeft: 3 })];

const raw: ApiFixture[] = [
  // Student (exact paths before the /student/{id} RegExp of student.ts)
  { path: "/api/career/appointments/student/group-sessions", body: { timeZone: TZ, sessions: [...SESSIONS, ...MINE_UPCOMING] } },
  { path: "/api/career/appointments/student/group-sessions/registrations", body: { timeZone: TZ, upcoming: MINE_UPCOMING, past: MINE_PAST } },
  { method: "POST", path: /^\/api\/career\/appointments\/student\/group-sessions\/[^/]+\/register$/, body: { id: "gr-9", status: "Registered", waitlistPosition: null } },
  { path: /^\/api\/career\/appointments\/student\/group-sessions\/registrations\/[^/]+\/ics$/, contentType: "text/calendar", body: "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n" },
  {
    path: /^\/api\/career\/appointments\/student\/group-sessions\/[^/]+$/,
    body: () => ({ session: MINE_UPCOMING[0], sessionNotes: [{ id: "sn-2", body: "Slides are in the shared folder.", createdAt: days(-1) }], notes: [], tasks: [] }),
  },
  // Career center
  { path: "/api/career/appointments/group/types", body: { timeZone: TZ, kinds: ["Workshop", "GroupAdvising", "ResumeClinic", "InfoSession", "Other"], types: TYPES } },
  { path: "/api/career/appointments/group/cohorts", body: [{ id: "co-1", name: "Data analytics, spring", programName: "Data analytics", startDate: "2026-01-12" }] },
  { path: "/api/career/appointments/group/sessions", body: { timeZone: TZ, from: days(0).slice(0, 10), to: days(59).slice(0, 10), sessions: SESSIONS } },
  { path: /^\/api\/career\/appointments\/group\/sessions\/[^/]+$/, body: detail },
];

export const groupSessionFixtures: ApiFixture[] = raw.map((f) => ({
  ...f,
  when: (ctx: FixtureContext) => (ctx.url.pathname.includes("/student/") ? ctx.persona === "student" : ctx.persona === "career-center") && (f.when ? f.when(ctx) : true),
}));

export const groupSessionRoutes: A11yRoute[] = [
  { name: "student-appointments-group", path: "/student/appointments?tab=group", persona: "student" },
  { name: "cc-appointments-group", path: "/career-center/appointments?tab=group", persona: "career-center" },
  { name: "cc-group-session-detail", path: "/career-center/appointments?tab=group&session=gs-past", persona: "career-center" },
];
