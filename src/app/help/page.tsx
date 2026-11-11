"use client";

/**
 * S4 help center (docs/s4_help_center_plan.md): every help article, the reader's own role first, with search. Search runs
 * here in the browser (no AI, nothing sent); a search that finds nothing is counted, without the person, so we know what to
 * write next. The articles are built from content/help by scripts/help-build.ts.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Loading } from "@/components/career/ui";
import { ContactPanel, HelpFrame, useHelpApi, useHelpContact } from "@/components/help/HelpParts";
import { groupHelp, helpArticles, searchHelp, HELP_ROLES, type HelpArticle, type HelpRole } from "@/lib/help";
import { useHelpLanguage } from "@/components/help/useHelpLanguage";

export default function HelpCenterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HelpCenter />
    </Suspense>
  );
}

function HelpCenter() {
  const en = useEn();
  const from = useSearchParams().get("from");
  const lang = useHelpLanguage();
  const contact = useHelpContact();
  const call = useHelpApi();
  const all = useMemo(() => helpArticles(lang), [lang]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<HelpRole | "all" | null>(null);
  const shownRole = role ?? contact?.audience ?? "all";
  const roleNames: Record<HelpRole | "all", string> = {
    all: en("Everyone"),
    admin: en("School admins"),
    teacher: en("Teachers"),
    staff: en("Career staff"),
    student: en("Students"),
  };

  const forRole = shownRole === "all" ? all : all.filter((a) => a.roles.includes(shownRole));
  const results = query.trim() ? searchHelp(all, query) : null;

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

  return (
    <HelpFrame from={from}>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{en("Help center")}</h1>
        <p className="mt-2 text-muted-foreground">{en("Step-by-step guides for school admins, teachers, career staff and students.")}</p>
        <label className="relative mt-6 block">
          <span className="sr-only">{en("Search the help center")}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={en("Search, for example: hand in, viva, appeal, roster")}
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
            {(["all", ...HELP_ROLES] as (HelpRole | "all")[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={shownRole === r}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  shownRole === r ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]" : "border-border bg-card hover:bg-muted"
                }`}
              >
                {roleNames[r]}
              </button>
            ))}
          </nav>
          <div className="mt-6 space-y-8">
            {groupHelp(forRole).map((g) => (
              <section key={g.group} aria-labelledby={`g-${g.group}`}>
                <h2 id={`g-${g.group}`} className="mb-3 text-lg font-semibold">{g.group}</h2>
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
