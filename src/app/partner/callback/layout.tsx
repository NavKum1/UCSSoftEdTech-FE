import CareerI18nRoot from "@/components/career/i18n/CareerI18nRoot";

// G1: signed-link page without the career shell; still rendered in the career language (cookie or school default)
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CareerI18nRoot>{children}</CareerI18nRoot>;
}
