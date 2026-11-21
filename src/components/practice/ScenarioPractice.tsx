"use client";

/**
 * Practice scenarios (phase E, 24 Oct 2026): leadership conversations, the promotion case and failover incident command.
 * At each turn the member picks a response; the server scores it on the track's dimensions and reveals the feedback and
 * the strongest response. Simulated roles only; the result is practice, not an assessment of readiness for any level.
 * Stage 3 (21 Nov 2026): Talk it through. Any situation can also be practiced by voice, with an AI playing the other person
 * (calm, typical or difficult), and the person can rehearse a real conversation of their own. The call uses practice
 * minutes, and its coaching is on the practice coaching page (interview practice's, reused).
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Mic, PhoneOff, RotateCcw, X } from "lucide-react";
import { usePracticeCall } from "@/lib/usePracticeCall";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, ErrorBanner, PageHeader } from "@/components/career/ui";

interface Dimension {
  key: string;
  label: string;
  description: string;
}
interface ScenarioSummary {
  code: string;
  track: string;
  title: string;
  context: string;
  turns: number;
  /** Stage 3: who the AI plays when it's talked through */
  talk?: boolean;
  voiceRole?: string;
}
interface Conversation {
  id: string;
  jobTitle: string;
  scenario: string | null;
  status: string | null;
  overallScore: number | null;
  createdAt: string;
}
interface Catalogue {
  tracks: { key: string; label: string; dimensions: Dimension[] }[];
  scenarios: ScenarioSummary[];
  note: string;
}
interface Revealed {
  turn: number;
  speaker: string;
  message: string;
  chosen: { text: string; feedback: string };
  strongest: { text: string; feedback: string };
  chosenStrongest: boolean;
}
interface Attempt {
  id: string;
  scenario: ScenarioSummary & { label: string };
  dimensions: Dimension[];
  answered: Revealed[];
  justAnswered: Revealed | null;
  current: { turn: number; speaker: string; message: string; options: { key: string; text: string }[] } | null;
  result: { overall: number; scores: Record<string, number> } | null;
  note: string;
}
interface HistoryRow {
  id: string;
  title: string;
  overall: number;
  completedAt: string;
}

const card = "rounded-xl border border-border bg-card shadow-sm";

function RevealedTurn({ r }: { r: Revealed }) {
  const en = useEn();
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-start gap-2">
        {r.chosenStrongest ? (
          <Check aria-label={en("Strongest response")} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <X aria-label={en("Not the strongest response")} className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span>
          <span className="font-medium">{en("You said:")}</span> {r.chosen.text}
          <span className="mt-1 block text-muted-foreground">{r.chosen.feedback}</span>
        </span>
      </p>
      {!r.chosenStrongest && (
        <p className="rounded-xl bg-muted/60 p-3">
          <span className="font-medium">{en("Strongest response:")}</span> {r.strongest.text}
          <span className="mt-1 block text-muted-foreground">{r.strongest.feedback}</span>
        </p>
      )}
    </div>
  );
}

// The result in plain words (B3, 18 Nov 2026). en() where shown.
const resultLabel = (overall: number) => (overall >= 85 ? "Strong" : overall >= 70 ? "Good" : overall >= 50 ? "Getting there" : "Keep practicing");

// How the other person behaves in a conversation (the interview styles). en() where shown.
const MANNERS: { key: string; label: string; hint: string }[] = [
  { key: "supportive", label: "Calm", hint: "Open and easy to talk to" },
  { key: "standard", label: "Typical", hint: "The way most people react" },
  { key: "demanding", label: "Difficult", hint: "Pushes back and interrupts" },
];
const OWN_MAX = 1200;
/** A role inside a sentence: "The customer at your table" reads "the customer at your table" */
const inSentence = (role: string) => (role ? role.charAt(0).toLowerCase() + role.slice(1) : role);

/** embedded: inside Workplace practice, which shows its own page header; this shows the track's title and intro smaller */
export default function ScenarioPractice({ track, title, intro, embedded = false }: { track: string; title: string; intro: string; embedded?: boolean }) {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const call = usePracticeCall(apiFetch);
  const [manner, setManner] = useState("standard");
  const [talking, setTalking] = useState<{ who: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ownText, setOwnText] = useState("");
  const [ownWho, setOwnWho] = useState("");

  const loadHistory = useCallback(async () => {
    const h = await apiFetch(`/api/practice/scenarios/attempts?track=${track}`, {}, { quiet: true });
    if (h.ok) setHistory((await h.json()) as HistoryRow[]);
    const v = await apiFetch(`/api/interview/practice/sessions?kind=situation&track=${encodeURIComponent(track)}`, {}, { quiet: true });
    if (v.ok) setConversations(((await v.json()) as { sessions: Conversation[] }).sessions ?? []);
  }, [apiFetch, track]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/practice/scenarios?track=${track}`);
      if (!res.ok) return setFailed(true);
      setCatalogue((await res.json()) as Catalogue);
      await loadHistory();
    } catch {
      setFailed(true);
    }
  }, [apiFetch, track, loadHistory]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "That didn't go through. Please try again.");
      setAttempt(data as Attempt);
      if ((data as Attempt).result) await loadHistory();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Talk it through: the call ends here (the person ends it, or its time limit), then its coaching page opens
  const finishTalk = async () => {
    const ended = await call.end();
    setTalking(null);
    if (!ended) return;
    const r = ended.result;
    if (r && r.status !== "ended" && r.status !== "ending") {
      setNotice(r.message || en("This conversation didn't record any replies, so no minutes were used."));
      return;
    }
    const minutes = r?.status === "ended" ? `?used=${r.minutesUsed ?? 0}&back=${r.minutesGivenBack ?? 0}` : "";
    router.push(`/interview/practice/${ended.id}${minutes}`);
  };

  const talk = async (who: string, route: string, body: object) => {
    setError(null);
    setNotice(null);
    setTalking({ who });
    const started = await call.start(route, { ...body, style: manner }, () => void finishTalk());
    if ("error" in started) {
      setTalking(null);
      setError(started.error);
    }
  };

  const talkScenario = (s: ScenarioSummary) => talk(inSentence(s.voiceRole ?? en("the other person")), "/api/interview/practice/situation/start", { scenario: s.code });
  const talkOwn = () => talk(ownWho.trim() || en("the other person"), "/api/interview/practice/situation/own/start", { track, situation: ownText, otherPerson: ownWho });

  if (access) return <AccessNotice problem={access} feature={title} />;
  if (failed)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-xl font-semibold">{en("We couldn't load the scenarios")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{en("Please refresh the page to try again.")}</p>
      </div>
    );
  if (!catalogue)
    return (
      <div aria-busy="true" aria-label={en("Loading scenarios")}>
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </div>
    );

  const dims = catalogue.tracks.find((t) => t.key === track)?.dimensions ?? [];

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{intro} {catalogue.note}</p>
        </div>
      ) : (
        <PageHeader
          title={title}
          description={
            <>
              {intro} {catalogue.note}
            </>
          }
        />
      )}
      <ErrorBanner error={error} />
      {notice && <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{notice}</p>}

      {talking && (
        <div role="status" className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--brand)] bg-card p-4 shadow-md">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--brand)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {call.phase === "live" ? en("Talking with {who}. End the conversation when you've finished.", { who: talking.who })
                : call.phase === "ending" ? en("Ending the conversation…") : en("Connecting…")}
            </p>
            <p className="text-xs text-muted-foreground">{en("Speak as you would at work. The AI plays the other person.")}</p>
          </div>
          {call.phase === "live" && (
            <Button variant="secondary" onClick={() => void finishTalk()}>
              <PhoneOff aria-hidden="true" className="h-4 w-4" />
              {en("End conversation")}
            </Button>
          )}
        </div>
      )}

      {!attempt && (
        <>
          <fieldset className="flex flex-wrap items-center gap-2" disabled={!!talking}>
            <legend className="me-2 text-sm text-muted-foreground">{en("When you talk it through, the other person is:")}</legend>
            {MANNERS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={manner === m.key}
                title={en(m.hint)}
                onClick={() => setManner(m.key)}
                className={`rounded-full border px-3 py-1.5 text-sm ${manner === m.key ? "border-[var(--brand)] bg-muted font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}
              >
                {en(m.label)}
              </button>
            ))}
          </fieldset>
          <section className="grid gap-4 sm:grid-cols-2" aria-label={en("Scenarios")}>
            {catalogue.scenarios.map((s) => (
              <div key={s.code} className={`${card} flex flex-col p-5`}>
                <h2 className="text-base font-semibold">{s.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.context}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy || !!talking} onClick={() => void post(`/api/practice/scenarios/${s.code}/start`)}>
                    {en("Start ({turns} turns)", { turns: s.turns })}
                  </Button>
                  {s.talk && (
                    <Button variant="ghost" disabled={busy || !!talking} onClick={() => void talkScenario(s)}>
                      <Mic aria-hidden="true" className="h-4 w-4" />
                      {en("Talk it through")}
                    </Button>
                  )}
                </div>
                {s.talk && s.voiceRole && (
                  <p className="mt-2 text-xs text-muted-foreground">{en("Talk it through: a short voice conversation with {who}. Uses practice minutes.", { who: inSentence(s.voiceRole) })}</p>
                )}
              </div>
            ))}
            <div className={`${card} flex flex-col gap-3 p-5 sm:col-span-2`}>
              <div>
                <h2 className="text-base font-semibold">{en("Rehearse your own conversation")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{en("Have a real conversation like this coming up? Describe it, and the AI plays the other person. You're coached on the same four points.")}</p>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="block font-medium text-foreground">{en("What's the conversation about?")}</span>
                <textarea
                  value={ownText}
                  maxLength={OWN_MAX}
                  rows={3}
                  onChange={(e) => setOwnText(e.target.value)}
                  placeholder={en("For example: I need to ask for Fridays off for my evening course. We're short-staffed on Fridays.")}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="block font-medium text-foreground">{en("Who will you be talking to?")}</span>
                <input
                  value={ownWho}
                  maxLength={80}
                  onChange={(e) => setOwnWho(e.target.value)}
                  placeholder={en("For example: my manager")}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground sm:max-w-sm"
                />
              </label>
              <p className="text-xs text-muted-foreground">{en("Don't use real names. Contact details, your own name and names after a title (like Ms. or Dr.) are removed before anything is sent to the AI.")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={busy || !!talking || ownText.trim().length < 20 || ownWho.trim().length === 0} onClick={() => void talkOwn()}>
                  <Mic aria-hidden="true" className="h-4 w-4" />
                  {en("Talk it through")}
                </Button>
                <span className="text-xs text-muted-foreground">{en("Uses practice minutes.")}</span>
              </div>
            </div>
          </section>
        </>
      )}

      {attempt && (
        <section className={`${card} space-y-5 p-5`} aria-labelledby="sc-title">
          <div>
            <h2 id="sc-title" className="text-base font-semibold">
              {attempt.scenario.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{attempt.scenario.context}</p>
          </div>

          {attempt.answered.map((r) => (
            <div key={r.turn} className="space-y-2 border-t border-border pt-4">
              <p className="text-sm">
                <span className="font-medium">{r.speaker}:</span> {r.message}
              </p>
              <RevealedTurn r={r} />
            </div>
          ))}

          {attempt.current && (
            <fieldset className="space-y-3 border-t border-border pt-4" aria-live="polite">
              <legend className="text-sm">
                <span className="font-medium">{attempt.current.speaker}:</span> {attempt.current.message}
              </legend>
              <p className="text-xs text-muted-foreground">
                {en("Turn {value} of {turns}. Choose your response.", { value: attempt.current.turn + 1, turns: attempt.scenario.turns })}
              </p>
              <ul className="space-y-2">
                {attempt.current.options.map((o) => (
                  <li key={o.key}>
                    <button
                      className="w-full rounded-lg border border-border p-3 text-start text-sm hover:border-indigo-400 hover:bg-muted/40 disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void post(`/api/practice/scenarios/attempts/${attempt.id}/answer`, { key: o.key })}
                    >
                      {o.text}
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {attempt.result && (
            <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
              <h3 className="text-base font-semibold">{en("Your result: {label} ({overall}%)", { label: en(resultLabel(attempt.result.overall)), overall: Math.round(attempt.result.overall) })}</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {dims.map((d) => (
                  <div key={d.key} className="rounded-xl bg-muted/60 p-3">
                    <dt className="text-sm font-medium">
                      {d.label}: {Math.round(attempt.result!.scores[d.key] ?? 0)}%
                    </dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{d.description}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void post(`/api/practice/scenarios/${attempt.scenario.code}/start`)}>
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />{en(" Try again")}
                </Button>
                {catalogue.scenarios.find((x) => x.code === attempt.scenario.code)?.talk && (
                  <Button variant="secondary" disabled={!!talking} onClick={() => { const sc = catalogue.scenarios.find((x) => x.code === attempt.scenario.code); if (sc) void talkScenario(sc); }}>
                    <Mic aria-hidden="true" className="h-4 w-4" />
                    {en("Now say it out loud")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setAttempt(null)}>
                  {en("Other scenarios")}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {conversations.length > 0 && (
        <section className={`${card} p-5`} aria-labelledby="sc-conversations">
          <h2 id="sc-conversations" className="text-base font-semibold">
            {en("Your conversations")}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {conversations.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-3 border-t border-border pt-1">
                <Link href={`/interview/practice/${v.id}`} className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">
                  {v.scenario === "own" ? en("Your own, with {who}", { who: v.jobTitle }) : v.jobTitle}
                </Link>
                <span className="tabular-nums text-muted-foreground">
                  {v.overallScore != null && v.status !== "not-enough" ? `${Math.round(v.overallScore)}/100 · ` : ""}
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className={`${card} p-5`} aria-labelledby="sc-history">
          <h2 id="sc-history" className="text-base font-semibold">
            {en("Your past attempts")}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 border-t border-border pt-1">
                <span>{h.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(h.overall)}% · {new Date(h.completedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
