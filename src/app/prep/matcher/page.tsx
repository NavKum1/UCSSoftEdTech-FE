import { redirect } from "next/navigation";

/**
 * The old résumé match was retired on 8 Nov 2026 (it scored résumés against a fixed word list). Its job, checking a résumé
 * against a job, is now the job check in the résumé library (docs/resume_tools_plan_nov2026.md, stage 3); old links land there.
 */
export default function ResumeMatcherMoved() {
  redirect("/resumes/job-check");
}
