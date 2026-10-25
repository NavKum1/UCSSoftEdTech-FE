import GuidanceFormEditor from "@/components/guidance/GuidanceFormEditor";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";

// Edulexa's own guidance form: the questions people answer when they ask Edulexa (the platform tenant's form)
export default function EdulexaQuestionsPage() {
  return (
    <GuidanceFormEditor
      instituteId={COMMUNITY_INSTITUTE_ID}
      title="Edulexa's guidance questions"
      intro="The questions people answer when they ask Edulexa for career guidance."
      withPublicForm={false}
      withProfile={false}
    />
  );
}
