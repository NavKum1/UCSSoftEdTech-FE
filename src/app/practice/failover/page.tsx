import ScenarioPractice from "@/components/practice/ScenarioPractice";

// Phase E (24 Oct 2026): failover incident-command practice with real scoring (replaces the simulated multi-cloud console).
export default function FailoverPracticePage() {
  return (
    <ScenarioPractice
      track="failover"
      title="Incident command: failover"
      intro="Lead the response when one region of a service starts failing: traffic, data, and keeping customers informed."
    />
  );
}
