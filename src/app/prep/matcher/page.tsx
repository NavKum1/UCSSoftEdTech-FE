import { redirect } from "next/navigation";

/**
 * The old résumé match was retired on 8 Nov 2026 (it scored résumés against a fixed word list). Résumés live in the
 * résumé library now (docs/resume_tools_plan_nov2026.md); old links land there.
 */
export default function ResumeMatcherMoved() {
  redirect("/resumes");
}
