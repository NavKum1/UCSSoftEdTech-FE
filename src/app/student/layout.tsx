import CareerShell from "@/components/career/CareerShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CareerShell persona="student">{children}</CareerShell>;
}
