import { redirect } from "next/navigation";

// Phase E (24 Oct 2026): this page showed invented cloud regions and metrics as if they were the platform's own. It is
// retired; failover is practised at /practice/failover (the platform's real health is the API's /health/ready).
export default function ResiliencePage() {
  redirect("/practice/failover");
}
