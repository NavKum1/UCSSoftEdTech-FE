import ScenarioPractice from "@/components/practice/ScenarioPractice";

// Phase E (24 Oct 2026): promotion-case practice with real scoring. This page used to "ingest" made-up pull requests,
// quote invented peer reviewers and give readiness verdicts.
export default function PromotionCasePracticePage() {
  return (
    <ScenarioPractice
      track="promotion"
      title="Practise your promotion case"
      intro="Answer a practice committee's questions about your work: evidence, scope, influence and what you learned."
    />
  );
}
