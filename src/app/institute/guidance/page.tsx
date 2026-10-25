import FormsHome from "@/components/guidance/editor/FormsHome";

// The institute's career guidance forms (the default one is used by "Ask an advisor"; others for websites and campaigns)
export default function InstituteGuidancePage() {
  return (
    <FormsHome
      basePath="/institute/guidance"
      title="Career guidance forms"
      intro="The questions people answer when they ask your advisors for help choosing an area or certification. Answers arrive as leads in your Admissions CRM."
    />
  );
}
