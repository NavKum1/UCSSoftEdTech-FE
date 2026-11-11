"use client";

/**
 * S4b help center (docs/s4b_help_center_for_everyone_plan.md, item 6): help beside the page. Help links on screens and the
 * header's help button open the guide in a panel on the right (a full-screen sheet on phones), so people can follow the
 * steps without losing their place. The panel opens on the reader's steps and guides, with search; links inside it open in
 * it, with Back. Focus moves into the panel and returns to what opened it; Escape closes it. /help stays the full page.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ExternalLink, Search, X } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { groupHelp, helpArticle, helpArticles, helpSteps, isFor, searchHelp, type HelpArticle } from "@/lib/help";
import { HelpArticleBody } from "./HelpArticleView";
import { ContactPanel, HelpFeedback, useHelpContact } from "./HelpParts";
import { HelpStepsList } from "./HelpSteps";
import { useHelpLanguage } from "./useHelpLanguage";
import { HelpPanelContext } from "./helpPanelContext";

export { useHelpPanel } from "./helpPanelContext";

export function HelpPanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [stack, setStack] = useState<(string | null)[] | null>(null); // null: closed; else the guides opened, last shown
  const opener = useRef<HTMLElement | null>(null);

  // Moving to another page closes it (adjusted while rendering, not in an effect)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (stack) setStack(null);
  }

  const open = useCallback((slug: string | null = null) => {
    if (typeof document !== "undefined" && !document.getElementById("help-panel")?.contains(document.activeElement))
      opener.current = document.activeElement as HTMLElement | null;
    setStack((s) => (s ? [...s, slug] : [slug]));
  }, []);
  const close = useCallback(() => {
    setStack(null);
    opener.current?.focus?.();
  }, []);
  const api = useMemo(() => ({ open }), [open]);
  const onHelpPages = pathname.startsWith("/help");

  return (
    <HelpPanelContext.Provider value={onHelpPages ? null : api}>
      {children}
      {stack && !onHelpPages && (
        <HelpPanel
          key={stack.length}
          slug={stack[stack.length - 1]}
          canGoBack={stack.length > 1}
          onBack={() => setStack((s) => (s && s.length > 1 ? s.slice(0, -1) : s))}
          onOpen={(slug) => setStack((s) => [...(s ?? []), slug])}
          onClose={close}
          from={pathname}
        />
      )}
    </HelpPanelContext.Provider>
  );
}

function HelpPanel({ slug, canGoBack, onBack, onOpen, onClose, from }: {
  slug: string | null;
  canGoBack: boolean;
  onBack: () => void;
  onOpen: (slug: string) => void;
  onClose: () => void;
  from: string;
}) {
  const en = useEn();
  const lang = useHelpLanguage();
  const contact = useHelpContact();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const article = slug ? helpArticle(lang, slug) : null;

  // Focus moves into the panel; Escape closes it (unless a term's explanation or a picture is open inside it)
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const fullPage = article ? `/help/${article.slug}?from=${encodeURIComponent(from)}` : `/help?from=${encodeURIComponent(from)}`;
  const iconButton = "rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--brand)]";

  return (
    <aside
      id="help-panel"
      role="dialog"
      aria-labelledby="help-panel-title"
      className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground shadow-2xl md:inset-y-0 md:start-auto md:end-0 md:w-[28rem] md:border-s md:border-border"
    >
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        {canGoBack && (
          <button type="button" onClick={onBack} className={iconButton} aria-label={en("Back")}>
            <ArrowLeft aria-hidden="true" className="h-5 w-5 rtl:rotate-180" />
          </button>
        )}
        <h2 id="help-panel-title" ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate px-2 font-semibold outline-none">
          {article ? article.title : en("Help")}
        </h2>
        <Link href={fullPage} className={iconButton} aria-label={en("Open in help center")} title={en("Open in help center")}>
          <ExternalLink aria-hidden="true" className="h-5 w-5" />
        </Link>
        <button type="button" onClick={onClose} className={iconButton} aria-label={en("Close help")}>
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {slug && !article ? (
          <p className="text-sm">{en("That article isn't here.")}</p>
        ) : article ? (
          <div className="space-y-6">
            <p className="text-[15px] leading-6 text-muted-foreground">{article.summary}</p>
            <HelpArticleBody article={article} audience={contact?.audience ?? null} from={from} onOpenArticle={onOpen} />
            <HelpFeedback slug={article.slug} onAskPerson={() => document.getElementById("help-contact")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
            <ContactPanel contact={contact} page={from} compact />
          </div>
        ) : (
          <PanelHome onOpen={onOpen} audience={contact?.audience ?? null} from={from} contact={contact} />
        )}
      </div>
    </aside>
  );
}

/** The panel's start: search, the reader's steps and their guides */
function PanelHome({ onOpen, audience, from, contact }: { onOpen: (slug: string) => void; audience: string | null; from: string; contact: ReturnType<typeof useHelpContact> }) {
  const en = useEn();
  const lang = useHelpLanguage();
  const all = useMemo(() => helpArticles(lang), [lang]);
  const [query, setQuery] = useState("");
  const results = query.trim() ? searchHelp(all, query, lang, audience) : null;
  const mine = audience ? all.filter((a) => isFor(a, audience)) : all;
  const steps = helpSteps(all, audience);
  const href = (a: HelpArticle) => `/help/${a.slug}?from=${encodeURIComponent(from)}`;
  const openIt = (a: HelpArticle, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(a.slug);
  };
  const row = (a: HelpArticle) => (
    <li key={a.slug}>
      <Link href={href(a)} onClick={(e) => openIt(a, e)} className="block rounded-md px-3 py-2 hover:bg-muted">
        <span className="block text-sm font-medium">{a.title}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{a.summary}</span>
      </Link>
    </li>
  );
  return (
    <div className="space-y-6">
      <label className="relative block">
        <span className="sr-only">{en("Search the help center")}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={en("Search the guides")}
          className="w-full rounded-lg border border-border bg-background py-2.5 pe-3 ps-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
      </label>
      {results ? (
        <section aria-live="polite">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {results.length === 1 ? en("1 article") : en("{count} articles", { count: results.length })}
          </h3>
          {results.length === 0 ? (
            <p className="text-sm">{en("No article matches \"{query}\". Try other words, or ask us below.", { query: query.trim() })}</p>
          ) : (
            <ul className="-mx-3 space-y-0.5">{results.map(row)}</ul>
          )}
        </section>
      ) : (
        <>
          {steps.length > 0 && (
            <section aria-labelledby="panel-steps">
              <h3 id="panel-steps" className="mb-2 font-semibold">{en("Your steps")}</h3>
              <div className="[&_ol]:grid-cols-1">
                <HelpStepsList steps={steps} href={href} onOpen={openIt} />
              </div>
            </section>
          )}
          {groupHelp(mine, audience).map((g) => (
            <section key={g.group}>
              <h3 className="mb-1 text-sm font-semibold">{g.group}</h3>
              <ul className="-mx-3 space-y-0.5">{g.articles.map(row)}</ul>
            </section>
          ))}
        </>
      )}
      <ContactPanel contact={contact} page={from} compact />
    </div>
  );
}
