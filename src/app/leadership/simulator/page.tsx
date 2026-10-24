import ScenarioPractice from "@/components/practice/ScenarioPractice";

// Phase E (24 Oct 2026): leadership practice scenarios with real scoring. This page used to give fixed "promote to
// Staff" scores whatever was written, with invented stakeholders.
export default function LeadershipPracticePage() {
  return (
    <ScenarioPractice
      track="leadership"
      title="Leadership conversations"
      intro="Hard conversations with product, operations and compliance leads after an outage or under a tight deadline."
    />
  );
}
