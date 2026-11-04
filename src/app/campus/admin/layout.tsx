import { SchoolEnglishScope } from "@/components/institute/SchoolEnglish";

// The school's English and country around campus admin (country: India's NBA outcomes show for schools in India only)
export default function CampusAdminLayout({ children }: { children: React.ReactNode }) {
  return <SchoolEnglishScope>{children}</SchoolEnglishScope>;
}
