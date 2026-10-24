import { redirect } from "next/navigation";

// Phase E (24 Oct 2026, owner decision 2): guild battles are retired (invented corporate guilds, hackathons and prize
// pools). Rankings are on the leaderboard, from real graded practice.
export default function GuildBattlesPage() {
  redirect("/leaderboard");
}
