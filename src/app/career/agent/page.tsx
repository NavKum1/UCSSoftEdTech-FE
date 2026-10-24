import { redirect } from "next/navigation";

// Phase E (24 Oct 2026): this page showed an "autonomous" agent negotiating salaries with invented recruiters. The career
// agent now works on the student's real campus drives, with their approval or their standing rules.
export default function OldCareerAgentPage() {
  redirect("/student/agent");
}
