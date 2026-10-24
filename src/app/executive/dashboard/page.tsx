import { redirect } from "next/navigation";

// Phase C (24 Oct 2026): this page showed an invented consortium (named universities, deans, audit claims and fixed
// metrics) with no data behind it. Executive users land on campus governance, which is built on real ledger data.
export default function ExecutiveDashboardPage() {
  redirect("/executive/governance");
}
