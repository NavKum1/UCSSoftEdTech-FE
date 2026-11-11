"use client";

/**
 * S4b: Your account, for everyone. Name, e-mail address, where you study or work, and the sign-in changes the sign-in
 * service makes on its own (Edulexa-branded) pages: name, password, an authenticator app, a passkey. The e-mail address
 * isn't changed here: it links you to your school, so support changes it.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Building2, KeyRound, Mail, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { keycloakSignIn, useAppAuth, type AccountAction } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useDevSession } from "@/lib/devSession";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader } from "@/components/career/ui";
import SignInRequired from "@/components/SignInRequired";
import { HelpLink } from "@/components/help/HelpLink";

interface Me {
  email?: string | null;
  name?: string | null;
  memberships: { id: string; school: string | null; role: string; status: string }[];
  employers: { id: string; name: string; role: string }[];
}

// Plain names for roles (en() where shown)
const SCHOOL_ROLES: Record<string, string> = {
  Student: "Student",
  Alumni: "Graduate",
  Faculty: "Teacher",
  CareerAdmin: "Career center admin",
  Counselor: "Career counselor",
  EmployerRelations: "Employer relations",
};
const OTHER_ROLES: Record<string, string> = {
  Recruiter: "Recruiter",
  MentorReviewer: "Mentor",
  EdulexaAdvisor: "Edulexa advisor",
  InstituteAdmin: "Admissions admin",
  InstituteCounselor: "Admissions counselor",
  SuperAdmin: "Edulexa staff",
};
const STATUS: Record<string, string> = { Invited: "Invited", Pending: "Waiting for approval", Suspended: "Paused" };

const card = "rounded-xl border border-border bg-card p-5 shadow-sm";

export default function AccountPage() {
  const en = useEn();
  const { data: session } = useSession();
  const { isLoaded, isSignedIn, roles, getToken } = useAppAuth();
  const dev = useDevSession();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [busy, setBusy] = useState<AccountAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let live = true;
    authenticatedFetch("/api/career/me", {}, getToken)
      .then(async (res) => (res.ok ? ((await res.json()) as Me) : null))
      .catch(() => null)
      .then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (isLoaded && !isSignedIn) return <SignInRequired title={en("Your account")} message="Sign in to see your account." />;

  const name = me?.name ?? session?.user?.name ?? (dev ? dev.label : null);
  const email = me?.email ?? session?.user?.email ?? null;
  // A school's student has the school's privacy page (consents and sharing as well); everyone else the member one
  const student = (me?.memberships ?? []).some((m) => m.role === "Student" && m.status === "Active");
  const others = roles.map((r) => OTHER_ROLES[r]).filter((r): r is string => !!r);
  const places = [
    ...(me?.memberships ?? []).map((m) => ({
      key: m.id,
      where: m.school ?? en("Your school"),
      role: en(SCHOOL_ROLES[m.role] ?? m.role),
      note: STATUS[m.status] ? en(STATUS[m.status]) : null,
    })),
    ...(me?.employers ?? []).map((e) => ({ key: e.id, where: e.name, role: en(e.role === "Owner" ? "Employer account owner" : "Employer team member"), note: null })),
  ];

  async function change(action: AccountAction) {
    setBusy(action);
    setError(null);
    const failed = await keycloakSignIn("/settings/account", { action });
    if (failed) {
      setBusy(null);
      setError(en("We couldn't open the sign-in page. Try again in a moment."));
    }
  }

  const actions: { action: AccountAction; label: string; text: string; Icon: typeof KeyRound }[] = [
    { action: "UPDATE_PASSWORD", label: en("Change your password"), text: en("You'll enter a new password twice."), Icon: KeyRound },
    { action: "CONFIGURE_TOTP", label: en("Set up an authenticator app"), text: en("A code from an app on your phone each time you sign in, as well as your password."), Icon: Smartphone },
    { action: "webauthn-register", label: en("Add a passkey"), text: en("Sign in with your fingerprint, face or your device's PIN instead of typing a password."), Icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 text-foreground">
      <PageHeader
        title={en("Your account")}
        description={en("Your name, e-mail address and sign-in, and where you study or work on Edulexa.")}
        actions={<HelpLink slug="your-account" />}
      />

      <section className={card} aria-labelledby="account-you">
        <h2 id="account-you" className="flex items-center gap-2 text-base font-semibold">
          <UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          {en("You")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{en("Name")}</dt>
            <dd className="mt-0.5 text-sm font-medium">{name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{en("E-mail address")}</dt>
            <dd className="mt-0.5 break-all text-sm font-medium">{email ?? "—"}</dd>
          </div>
        </dl>
        {!dev && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" busy={busy === "UPDATE_PROFILE"} onClick={() => change("UPDATE_PROFILE")}>
              {en("Change your name")}
            </Button>
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {en("Your e-mail address links you to your school, so it isn't changed here. To change it, ")}
            <Link href="/help/help-and-support" className="font-medium text-foreground underline underline-offset-2">
              {en("contact support")}
            </Link>
            {en(".")}
          </span>
        </p>
      </section>

      <section className={card} aria-labelledby="account-signin">
        <h2 id="account-signin" className="flex items-center gap-2 text-base font-semibold">
          <KeyRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          {en("Password and sign-in")}
        </h2>
        {dev ? (
          <p className="mt-3 text-sm text-muted-foreground">{en("These changes aren't available in this sign-in.")}</p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-border">
              {actions.map(({ action, label, text, Icon }) => (
                <li key={action} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  </div>
                  <Button variant="secondary" busy={busy === action} onClick={() => change(action)} aria-label={label}>
                    {en("Open")}
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              {en("If you sign in with your school's account, your school manages your password. Change it the way your school tells you.")}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </p>
        )}
      </section>

      <section className={card} aria-labelledby="account-places">
        <h2 id="account-places" className="flex items-center gap-2 text-base font-semibold">
          <Building2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          {en("Where you study or work")}
        </h2>
        {me === undefined ? (
          <p className="mt-3 text-sm text-muted-foreground">{en("Loading…")}</p>
        ) : places.length === 0 && others.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{en("You use Edulexa on your own. When your school or company adds you, it's listed here.")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {places.map((p) => (
              <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm font-medium">{p.where}</span>
                <span className="text-sm text-muted-foreground">
                  {p.role}
                  {p.note && ` (${p.note})`}
                </span>
              </li>
            ))}
            {others.map((r) => (
              <li key={r} className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm font-medium">Edulexa</span>
                <span className="text-sm text-muted-foreground">{en(r)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {en("To switch between them, use Switch to in your account menu.")}{" "}
          <Link href="/help/switch-schools-and-roles" className="font-medium text-foreground underline underline-offset-2">
            {en("More about schools and roles")}
          </Link>
        </p>
      </section>

      <section className={card} aria-labelledby="account-more">
        <h2 id="account-more" className="text-base font-semibold">
          {en("More settings")}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link href="/notifications" className="font-medium underline underline-offset-2">
              {en("Notifications")}
            </Link>
            <span className="text-muted-foreground"> {en("and which ones come by e-mail")}</span>
          </li>
          <li>
            <Link href={student ? "/student/privacy" : "/settings/privacy"} className="font-medium underline underline-offset-2">
              {en("Privacy and your data")}
            </Link>
            <span className="text-muted-foreground"> {en("(download or delete your data)")}</span>
          </li>
          <li className="text-muted-foreground">{en("Language, US or British English, and light or dark: at the top of every page.")}</li>
        </ul>
      </section>
    </div>
  );
}
