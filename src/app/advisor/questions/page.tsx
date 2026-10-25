import FormsHome from "@/components/guidance/editor/FormsHome";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";

// Edulexa's own guidance forms: the questions people answer when they ask Edulexa (the platform tenant's forms)
export default function EdulexaQuestionsPage() {
  return (
    <FormsHome
      instituteId={COMMUNITY_INSTITUTE_ID}
      basePath="/advisor/questions"
      title="Edulexa's guidance forms"
      intro="The questions people answer when they ask Edulexa for career guidance."
      withProfile={false}
    />
  );
}
