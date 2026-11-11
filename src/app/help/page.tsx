"use client";

/**
 * S4 help center (docs/s4_help_center_plan.md): every help article, with search. Search runs here in the browser (no AI,
 * nothing sent); a search that finds nothing is counted, without the person, so we know what to write next. The articles are
 * built from content/help by scripts/help-build.ts.
 * S4b (docs/s4b_help_center_for_everyone_plan.md): it opens on the reader's own guides ("Your guides": their steps in order,
 * then their groups in the order of their work), with "Also for you" for their other roles; "All guides" shows everything,
 * and each audience with guides of its own has a tab. Search understands everyday words and puts the reader's guides first.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Loading } from "@/components/career/ui";
import { ContactPanel, HelpFrame, useAudienceNames, useHelpApi, useHelpContact } from "@/components/help/HelpParts";
import { audiencesWithGuides, groupHelp, helpArticles, helpSteps, isFor, searchHelp, type HelpArticle, type HelpRole } from "@/lib/help";
import { useHelpLanguage } from "@/components/help/useHelpLanguage";
import { HelpStepsList } from "@/components/help/HelpSteps";

export default function HelpCenterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HelpCenter />
    </Suspense>
  );
}

const groupId = (g: string) => g.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");

type View = "mine" | "all" | HelpRole;

function HelpCenter() {
  const en = useEn();
  const from = useSearchParams().get("from");
  const lang = useHelpLanguage();
  const contact = useHelpContact();
  const names = useAudienceNames();
  const call = useHelpApi();
  const all = useMemo(() => helpArticles(lang), [lang]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<View | null>(null);
  const mine = contact?.audience ?? null;
  const view: View = picked ?? (mine ? "mine" : "all");
  const role: HelpRole | null = view === "mine" ? mine : view === "all" ? null : view;
  const tabs = audiencesWithGuides(all).filter((r) => r !== mine);
  const alsoMine = (contact?.audiences ?? []).filter((r) => r !== mine);

  const shown = role ? all.filter((a) => isFor(a, role)) : all;
  const steps = role ? helpSteps(all, role) : [];
  const results = query.trim() ? searchHelp(all, query, lang, role ?? mine) : null;

  // A search that finds nothing is counted once, after the reader stops typing
  const missed = useRef(new Set<string>());
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!results || results.length > 0 || q.length < 3 || missed.current.has(q) || !contact) return;
    const t = setTimeout(() => {
      missed.current.add(q);
      void call("/api/help/search-miss", { method: "POST", json: { query: q } }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results?.length, contact]);

  const link = (a: HelpArticle) => `/help/${a.slug}${from ? `?from=${encodeURIComponent(from)}` : ""}`;
  const card = (a: HelpArticle) => (
    <li key={a.slug}>
      <Link href={link(a)} className="block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-[var(--brand)]/50 hover:bg-muted/40">
        <span className="block font-medium">{a.title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{a.summary}</span>
      </Link>
    </li>
  );
  const tab = (v: View, label: string) => (
    <button
      key={v}
      type="button"
      onClick={() => setPicked(v)}
      aria-pressed={view === v}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        view === v ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <HelpFrame from={from}>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{en("Help center")}</h1>
        <p className="mt-2 text-muted-foreground">{en("Step-by-step guides for everyone who uses Edulexa, in the order you'll need them.")}</p>
        <label className="relative mt-6 block">
          <span className="sr-only">{en("Search the help center")}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={en("Search, for example: hand in, sign in, appointment, résumé")}
            className="w-full rounded-xl border border-border bg-background py-3 pe-4 ps-11 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>
      </div>

      {results ? (
        <section aria-live="polite" className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {results.length === 1 ? en("1 article") : en("{count} articles", { count: results.length })}
          </h2>
          {results.length === 0 ? (
            <p className="max-w-2xl rounded-lg border border-border bg-card p-4 text-sm">
              {en("No article matches \"{query}\". Try other words, or ask us below.", { query: query.trim() })}
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">{results.map(card)}</ul>
          )}
        </section>
      ) : (
        <>
          <nav aria-label={en("Who the guides are for")} className="mt-8 flex flex-wrap gap-2">
            {mine && tab("mine", en("Your guides"))}
            {tab("all", en("All guides"))}
            {tabs.map((r) => tab(r, names[r]))}
          </nav>

          {view === "mine" && mine && (
            <p className="mt-4 text-sm text-muted-foreground">
              {en("Guides for {who}.", { who: names[mine].toLowerCase() })}
              {alsoMine.length > 0 && (
                <>
                  {" "}
                  {en("Also for you:")}{" "}
                  {alsoMine.map((r, i) => (
                    <React.Fragment key={r}>
                      {i > 0 && ", "}
                      <button type="button" onClick={() => setPicked(r)} className="font-medium text-foreground underline underline-offset-2">
                        {names[r]}
                      </button>
                    </React.Fragment>
                  ))}
                </>
              )}
            </p>
          )}

          <div className="mt-6 space-y-8">
            {steps.length > 0 && (
              <section aria-labelledby="help-steps">
                <h2 id="help-steps" className="mb-1 text-lg font-semibold">{en("Your steps")}</h2>
                <p className="mb-3 text-sm text-muted-foreground">{en("The work in the order it's done. Each guide ends with the next step.")}</p>
                <HelpStepsList steps={steps} href={link} />
              </section>
            )}
            {groupHelp(shown, role).map((g) => (
              <section key={g.group} aria-labelledby={`g-${groupId(g.group)}`}>
                <h2 id={`g-${groupId(g.group)}`} className="mb-3 text-lg font-semibold">{g.group}</h2>
                <ul className="grid gap-3 md:grid-cols-2">{g.articles.map(card)}</ul>
              </section>
            ))}
          </div>
        </>
      )}

      <div className="mt-10 max-w-3xl">
        <ContactPanel contact={contact} page={from} />
      </div>
    </HelpFrame>
  );
}
