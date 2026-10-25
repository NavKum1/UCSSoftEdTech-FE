"use client";

// G13 sign-up: sign in (or create an account) with the identity provider, then create the personal career space.
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, useApi, useAppAuth } from "@/lib/appAuth";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, useCareerT, useLoad } from "@/components/career/ui";
import { publicGet, type FreeAvailability } from "@/components/career/freeTier/FreeTierFrame";

export default function FreeSignupPage() {
  const t = useCareerT("freeTier");
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAppAuth();
  const { data: avail, error: availError, loading } = useLoad(() => publicGet<FreeAvailability>("/api/career/free/availability"), []);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/career/free/signup", { json: { acceptTerms: terms, confirmAge: age, name: name || undefined } });
      router.push("/free/home");
    } catch (err) {
      // An existing account goes straight to its home
      if (err instanceof ApiError && err.status === 409) router.push("/free/home");
      else setError(err instanceof Error && !(err instanceof TypeError) ? err.message : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("signupTitle")} description={t("signupIntro")} />
      {(loading || !isLoaded) && <Loading />}
      <ErrorBanner error={availError} />
      {avail && !avail.available && (
        <EmptyState title={t("notAvailableTitle")}>
          <p className="text-sm">{t(`gate.${avail.code}`)}</p>
        </EmptyState>
      )}
      {avail?.available && isLoaded && !isSignedIn && (
        <Card>
          <p className="text-sm">{t("signInFirst")}</p>
          <Link
            href={`/login?redirect_url=${encodeURIComponent("/free/signup")}`}
            className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--brand, #4f46e5)" }}
          >
            {t("signInCta")}
          </Link>
        </Card>
      )}
      {avail?.available && isLoaded && isSignedIn && (
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label={t("nameLabel")} hint={t("nameHint")}>
              {(p) => <input {...p} type="text" autoComplete="name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <div className="flex items-start gap-2">
              <input id="free-terms" type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <label htmlFor="free-terms" className="text-sm">
                {t("termsLabel")}
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input id="free-age" type="checkbox" className="mt-1" checked={age} onChange={(e) => setAge(e.target.checked)} />
              <label htmlFor="free-age" className="text-sm">
                {t("ageLabel", { age: avail.minimumAge })}
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{t("privacyNote")}</p>
            <div role="status" aria-live="polite">
              <ErrorBanner error={error} />
            </div>
            <Button type="submit" busy={busy} disabled={!terms || !age}>
              {t("createCta")}
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
