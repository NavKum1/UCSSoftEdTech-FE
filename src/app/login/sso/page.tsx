import { redirect } from "next/navigation";

// The old enterprise sign-in address: university and company sign-in now starts from the one sign-in page, where
// Keycloak sends each email domain to its own identity provider (A6, 1 Nov 2026)
export default function EnterpriseSsoLoginPage() {
  redirect("/login");
}
