"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { BookOpen, Info, Loader2, AlertTriangle, Share2, Undo2, CheckCircle2, X, Mail } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import SignInRequired from "@/components/SignInRequired";

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
      setError("We couldn't load your recommendations right now.");
    }
    setLoading(false);
  }, []);

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
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        setNotice(`Your details were shared with ${confirm.rec.instituteName}. You can withdraw at any time below.`);
      } else {
        const res = await authenticatedFetch(`/api/referrals/${confirm.referral.referralId}/withdraw`, { method: "POST" }, getToken);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setNotice(`Withdrawn. ${confirm.referral.instituteName} has been asked to stop contacting you and delete your data.`);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? `Something went wrong: ${e.message}` : "Something went wrong.");
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
      setError("Could not save your email preference.");
    } finally {
      setSavingPref(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title="Learning recommendations" message="Sign in to see course suggestions based on your defenses." />
    );
  }

  const activeReferrals = mine.filter((m) => m.status !== "Withdrawn");
  const pastReferrals = mine.filter((m) => m.status === "Withdrawn");

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Learning recommendations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Courses that match the skills your latest defense suggested you strengthen. Nothing is shared unless you choose to.
          </p>
        </div>

        {data?.disclosure && (
          <div className="p-4 rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-500/10 flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300 mt-0.5" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{data.disclosure}</p>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading recommendations...
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Suggested courses</h2>
              {!data || data.recommendations.length === 0 ? (
                <div className="glass-panel rounded-2xl p-6 border border-border text-sm text-muted-foreground">
                  No recommendations yet. Complete a voice defense and we&apos;ll suggest courses for any skills to strengthen.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.recommendations.map((rec) => (
                    <div key={rec.courseId} className="glass-panel rounded-2xl p-5 border border-border flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground">{rec.courseName}</h3>
                          <p className="text-xs text-muted-foreground">{rec.instituteName}</p>
                        </div>
                        {rec.sponsored && (
                          <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            Sponsored
                          </span>
                        )}
                      </div>
                      {rec.description && <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>}
                      {rec.matchedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.matchedSkills.map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded-md text-[11px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto pt-2">
                        {rec.referralId ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" /> Details shared — manage below
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirm({ kind: "opt-in", rec })}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share my details with {rec.instituteName}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Details you&apos;ve shared</h2>
              {mine.length === 0 ? (
                <div className="glass-panel rounded-2xl p-5 border border-border text-sm text-muted-foreground">
                  You haven&apos;t shared your details with any course provider.
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-border divide-y divide-border">
                  {[...activeReferrals, ...pastReferrals].map((r) => (
                    <div key={r.referralId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{r.courseName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.instituteName} · shared {new Date(r.candidateConsentedAt ?? r.createdAt).toLocaleDateString()} · status:{" "}
                          <span className="font-medium text-foreground">{r.status}</span>
                        </p>
                      </div>
                      {r.status !== "Withdrawn" && (
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: "withdraw", referral: r })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold shrink-0"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Withdraw
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data && (
              <section className="glass-panel rounded-2xl p-5 border border-border flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Include sponsored course suggestions in feedback emails</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Off by default. Turning this on only changes what we email you; it never shares your details with a provider.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={data.sponsoredRecommendationEmails}
                  aria-label="Include sponsored course suggestions in feedback emails"
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
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-2xl p-6 space-y-4">
            {confirm.kind === "opt-in" ? (
              <>
                <h3 className="text-base font-bold text-foreground">Share your details with {confirm.rec.instituteName}?</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    {confirm.rec.instituteName} will receive the following so they can contact you about &ldquo;{confirm.rec.courseName}&rdquo;:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your name</li>
                    <li>Your email address</li>
                    <li>
                      Skills to improve
                      {confirm.rec.matchedSkills.length > 0 && <>: {confirm.rec.matchedSkills.join(", ")}</>}
                    </li>
                  </ul>
                  <p className="font-medium text-foreground">Your scores, transcripts and recordings are not shared.</p>
                  {confirm.rec.sponsored && <p>This is a sponsored listing; we may earn a referral fee if you enrol.</p>}
                  <p>You can withdraw at any time, and the provider will be asked to stop contacting you and delete your data.</p>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-foreground">Withdraw from {confirm.referral.instituteName}?</h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll tell {confirm.referral.instituteName} to stop contacting you about &ldquo;{confirm.referral.courseName}&rdquo; and to
                  delete the details you shared.
                </p>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={working}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performConfirmed}
                disabled={working}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 ${
                  confirm.kind === "opt-in" ? "bg-indigo-600 hover:bg-indigo-500" : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {working && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirm.kind === "opt-in" ? "Share my details" : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
