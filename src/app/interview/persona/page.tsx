import { redirect } from "next/navigation";

// Retired 18 Nov 2026 (owner, B2): the interviewer's style (supportive, standard or demanding) is chosen on Interview practice,
// with an interview for each career, so this page of four tech interviewers is gone.
export default function InterviewerPersonaPage() {
  redirect("/interview/practice");
}
