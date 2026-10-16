import CareerI18nRoot from "@/components/career/i18n/CareerI18nRoot";
import FreeTierFrame from "@/components/career/freeTier/FreeTierFrame";

// G13 free student tier (no school needed). No CareerShell: a free user has no school membership.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CareerI18nRoot>
      <FreeTierFrame>{children}</FreeTierFrame>
    </CareerI18nRoot>
  );
}
