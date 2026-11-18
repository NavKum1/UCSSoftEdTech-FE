import { redirect } from "next/navigation";

// Retired 18 Nov 2026 (owner): Edulexa records no proctoring video. The session check notes only leaving full screen, and
// candidates are told there's no camera, microphone or screen recording. Sessions are reviewed on Proctored sessions.
export default function ProctoringVideoPage() {
  redirect("/recruiter/proctoring");
}
