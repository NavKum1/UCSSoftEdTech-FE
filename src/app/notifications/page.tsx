"use client";

import NotificationsPage from "@/components/career/NotificationsPage";
import SignInRequired from "@/components/SignInRequired";
import { useAppAuth } from "@/lib/appAuth";
import { useDevSession } from "@/lib/devSession";
import { useEn } from "@/lib/english/EnglishProvider";

export default function Page() {
  const en = useEn();
  const { isLoaded, isSignedIn } = useAppAuth();
  const dev = useDevSession();
  if (isLoaded && !isSignedIn && !dev) return <SignInRequired title={en("Notifications")} message="Sign in to see your notifications." />;
  return <NotificationsPage />;
}
