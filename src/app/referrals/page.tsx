"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { Info, AlertTriangle, Share2, Undo2, CheckCircle2, X, Mail } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Loading, PageHeader } from "@/components/career/ui";

interface Recommendation {
  courseId: string;
  courseName: string;
  description?: string;
  instituteName: string;
  matchedSkills: string[];
  sponsored: boolean;
  referralId?: string | null;
}

interface RecommendationsResponse {
  disclosure: string;
  sponsoredRecommendationEmails: boolean;
  recommendations: Recommendation[];
}

interface MyReferral {
  referralId: string;
  courseName: string;
  instituteName: string;
  status: string;
  candidateConsentedAt?: string | null;
  createdAt: string;
}

type LoadResult = { data: RecommendationsResponse; mine: MyReferral[] } | null;

async function fetchReferralData(getToken: () => Promise<string | null>): Promise<LoadResult> {
  try {
    const [recRes, mineRes] = await Promise.all([
      authenticatedFetch("/api/referrals/recommendations", {}, getToken),
      authenticatedFetch("/api/referrals/mine", {}, getToken),
    ]);
    if (!recRes.ok) return null;
    const data = (await recRes.json()) as RecommendationsResponse;
    const mine = mineRes.ok ? ((await mineRes.json()) as MyReferral[]) : [];
    return { data, mine };
  } catch {
    return null;
  }
}

type PendingConfirm =
  | { kind: "opt-in"; rec: Recommendation }
  | { kind: "withdraw"; referral: MyReferral };

export default function ReferralsPage() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [mine, setMine] = useState<MyReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [working, setWorking] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  const applyLoaded = useCallback((result: LoadResult) => {
    if (result) {
      setData(result.data);
      setMine(result.mine);
      setError(null);
    } else {
      setError(en("We couldn't load your recommendations right now."));
    }
    setLoading(false);
  }, [en]);

  const load = useCallback(async () => applyLoaded(await fetchReferralData(getToken)), [applyLoaded, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchReferralData(getToken).then((result) => {
      if (!cancelled) applyLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, applyLoaded]);

  const performConfirmed = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      if (confirm.kind === "opt-in") {
        const res = await authenticatedFetch(
          "/api/referrals/opt-in",
          { method: "POST", body: JSON.stringify({ courseId: confirm.rec.courseId }) },
          getToken
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || "We couldn't share your details. Please try again.");
        }
        setNotice(en("Your details were shared with {institute}. You can withdraw at any time below.", { institute: confirm.rec.instituteName }));
      } else {
        const res = await authenticatedFetch(`/api/referrals/${confirm.referral.referralId}/withdraw`, { method: "POST" }, getToken);
        if (!res.ok) throw new Error("We couldn't withdraw your referral. Please try again.");
        setNotice(en("Withdrawn. {institute} has been asked to stop contacting you and delete your data.", { institute: confirm.referral.instituteName }));
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach Edulexa. Check your internet connection and try again." : e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  const togglePreference = async () => {
    if (!data) return;
    const next = !data.sponsoredRecommendationEmails;
    setSavingPref(true);
    try {
      const res = await authenticatedFetch(
        "/api/referrals/preferences",
        { method: "PUT", body: JSON.stringify({ sponsoredRecommendationEmails: next }) },
        getToken
      );
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { sponsoredRecommendationEmails: boolean };
      setData({ ...data, sponsoredRecommendationEmails: body.sponsoredRecommendationEmails });
    } catch {
      setError(en("Could not save your email preference."));
    } finally {
      setSavingPref(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title={en("Learning recommendations")} message="Sign in to see course suggestions based on your defenses." />
    );
  }

  const activeReferrals = mine.filter((m) => m.status !== "Withdrawn");
  const pastReferrals = mine.filter((m) => m.status === "Withdrawn");

  return (
    <div className="text-foreground">
      <div className="space-y-8">
        <PageHeader
          title={en("Learning recommendations")}
          description={en("Courses that match the skills your latest defense suggested you strengthen. Nothing is shared unless you choose to.")}
        />

        {data?.disclosure && (
          <div className="p-4 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-500/10 flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300 mt-0.5" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{data.disclosure}</p>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label={en("Dismiss")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </span>
            <button type="button" onClick={() => setError(null)} aria-label={en("Dismiss")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <Loading label={en("Loading recommendations…")} />
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-base font-semibold">{en("Suggested courses")}</h2>
              {!data || data.recommendations.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-sm text-muted-foreground">
                  {en("No recommendations yet. Complete a voice defense and we'll suggest courses for any skills to strengthen.")}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.recommendations.map((rec) => (
                    <div key={rec.courseId} className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{rec.courseName}</h3>
                          <p className="text-xs text-muted-foreground">{rec.instituteName}</p>
                        </div>
                        {rec.sponsored && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            {en("Sponsored")}
                          </span>
                        )}
                      </div>
                      {rec.description && <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>}
                      {rec.matchedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.matchedSkills.map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto pt-2">
                        {rec.referralId ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />{en(" Details shared — manage below")}
                          </span>
                        ) : (
                          <Button type="button" variant="secondary" onClick={() => setConfirm({ kind: "opt-in", rec })}>
                            <Share2 className="w-4 h-4" />
                            {en("Share my details with {instituteName}", { instituteName: rec.instituteName })}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">{en("Details you've shared")}</h2>
              {mine.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-sm text-muted-foreground">
                  {en("You haven't shared your details with any course provider.")}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
                  {[...activeReferrals, ...pastReferrals].map((r) => (
                    <div key={r.referralId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{r.courseName}</p>
                        <p className="text-xs text-muted-foreground">
                          {en("{instituteName} · shared {date} · status:", { instituteName: r.instituteName, date: new Date(r.candidateConsentedAt ?? r.createdAt).toLocaleDateString() })}{" "}
                          <span className="font-medium text-foreground">{r.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                        </p>
                      </div>
                      {r.status !== "Withdrawn" && (
                        <Button type="button" variant="secondary" className="shrink-0 text-red-700 dark:text-red-400" onClick={() => setConfirm({ kind: "withdraw", referral: r })}>
                          <Undo2 className="w-4 h-4" />
                          {en("Withdraw")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{en("Include sponsored course suggestions in feedback emails")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {en("Off by default. Turning this on only changes what we email you; it never shares your details with a course provider.")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={data.sponsoredRecommendationEmails}
                  aria-label={en("Include sponsored course suggestions in feedback emails")}
                  onClick={togglePreference}
                  disabled={savingPref}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                    data.sponsoredRecommendationEmails ? "bg-indigo-600" : "bg-muted border border-border"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      data.sponsoredRecommendationEmails ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </section>
            )}
          </>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-6 space-y-4">
            {confirm.kind === "opt-in" ? (
              <>
                <h3 className="text-base font-semibold text-foreground">{en("Share your details with {instituteName}?", { instituteName: confirm.rec.instituteName })}</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    {en("{instituteName} will receive the following so they can contact you about “{courseName}”:", { instituteName: confirm.rec.instituteName, courseName: confirm.rec.courseName })}
                  </p>
                  <ul className="list-disc ps-5 space-y-1">
                    <li>{en("Your name")}</li>
                    <li>{en("Your email address")}</li>
                    <li>
                      {en("Skills to improve")}
                      {confirm.rec.matchedSkills.length > 0 && <>: {confirm.rec.matchedSkills.join(", ")}</>}
                    </li>
                  </ul>
                  <p className="font-medium text-foreground">{en("Your scores, transcripts and recordings are not shared.")}</p>
                  {confirm.rec.sponsored && <p>{en("This is a sponsored listing; we may earn a referral fee if you enrol.")}</p>}
                  <p>{en("You can withdraw at any time, and the provider will be asked to stop contacting you and delete your data.")}</p>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground">{en("Withdraw from {instituteName}?", { instituteName: confirm.referral.instituteName })}</h3>
                <p className="text-sm text-muted-foreground">
                  {en("We'll tell {instituteName} to stop contacting you about “{courseName}” and to delete the details you shared.", { instituteName: confirm.referral.instituteName, courseName: confirm.referral.courseName })}
                </p>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConfirm(null)} disabled={working}>
                {en("Cancel")}
              </Button>
              <Button type="button" variant={confirm.kind === "opt-in" ? "primary" : "danger"} onClick={performConfirmed} busy={working}>
                {confirm.kind === "opt-in" ? en("Share my details") : en("Withdraw")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
