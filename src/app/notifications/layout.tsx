import CareerI18nRoot from "@/components/career/i18n/CareerI18nRoot";

// S4b: notifications for people without a school area of their own (members, recruiters, mentors, admissions). The page is
// the career suite's shared one, so it needs the career messages.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CareerI18nRoot>{children}</CareerI18nRoot>;
}
