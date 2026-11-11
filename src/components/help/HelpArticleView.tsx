"use client";

/**
 * S4 help center: one article's text (built from content/help by scripts/help-build.ts). Labels the reader should look for
 * in the app ([ui: Save decision]) show as small chips; links to other articles and pages keep the reader's way back.
 * S4b: "In short", terms from "Words we use" (a tap shows what they mean), screenshots marked "Example" (a tap shows them
 * bigger), the list of words, and "Next step". In the side panel, links to other articles open in the panel.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, X, ZoomIn } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { helpArticles, helpGlossary, nextStep, type HelpArticle } from "@/lib/help";
import type { HelpBlock, HelpInline } from "@/lib/help/types";
import { useHelpLanguage } from "./useHelpLanguage";

type Ctx = { from: string | null; onOpenArticle?: (slug: string) => void };

const articleHref = (slug: string, from: string | null) => `/help/${slug}${from ? `?from=${encodeURIComponent(from)}` : ""}`;

/** A link to another article: in the side panel it opens there; on the page it keeps the way back */
function ArticleLink({ slug, ctx, className, children }: { slug: string; ctx: Ctx; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={articleHref(slug, ctx.from)}
      className={className}
      onClick={(e) => {
        if (!ctx.onOpenArticle || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        ctx.onOpenArticle(slug);
      }}
    >
      {children}
    </Link>
  );
}

/** A term from "Words we use": a tap (or Enter) shows what it means; Escape or a tap elsewhere closes it */
function Term({ text, termKey, ctx }: { text: string; termKey: string; ctx: Ctx }) {
  const en = useEn();
  const lang = useHelpLanguage();
  const entry = helpGlossary(lang).find((g) => g.key === termKey);
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); // closes the term, not the side panel around it
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key, true); };
  }, [open]);
  if (!entry) return <>{text}</>;
  return (
    <span ref={box} className="relative inline">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help rounded-sm underline decoration-dotted decoration-2 underline-offset-4 decoration-[var(--brand)]/70 hover:decoration-[var(--brand)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
      >
        {text}
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute start-0 top-full z-30 mt-2 block w-72 max-w-[80vw] rounded-lg border border-border bg-card p-3 text-sm leading-6 text-foreground shadow-lg"
        >
          <span className="block font-semibold">{entry.term}</span>
          <span className="block text-muted-foreground">{entry.means}</span>
          {entry.see && (
            <ArticleLink slug={entry.see} ctx={ctx} className="mt-1 inline-block font-medium underline underline-offset-2">
              {en("Read more")}
            </ArticleLink>
          )}
        </span>
      )}
    </span>
  );
}

function Inlines({ items, ctx }: { items: HelpInline[]; ctx: Ctx }) {
  return (
    <>
      {items.map((i, n) => {
        switch (i.t) {
          case "b":
            return <strong key={n} className="font-semibold">{i.v}</strong>;
          case "ui":
            return (
              <span key={n} className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-px text-[0.92em] font-medium text-foreground">
                {i.v}
              </span>
            );
          case "code":
            return <code key={n} className="rounded bg-muted px-1 py-px font-mono text-[0.9em]" dir="ltr">{i.v}</code>;
          case "term":
            return <Term key={n} text={i.v} termKey={i.key} ctx={ctx} />;
          case "link": {
            const external = /^(https?:|mailto:)/.test(i.href);
            if (external)
              return <a key={n} href={i.href} className="font-medium underline underline-offset-2" target={i.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{i.v}</a>;
            if (i.href.startsWith("/help/"))
              return <ArticleLink key={n} slug={i.href.slice(6)} ctx={ctx} className="font-medium underline underline-offset-2">{i.v}</ArticleLink>;
            return <Link key={n} href={i.href} className="font-medium underline underline-offset-2">{i.v}</Link>;
          }
          default:
            return <React.Fragment key={n}>{i.v}</React.Fragment>;
        }
      })}
    </>
  );
}

/** A screenshot from the demo school, marked "Example"; a tap shows it at full size */
function Shot({ name, alt, w, h }: { name: string; alt: string; w: number; h: number }) {
  const en = useEn();
  const dialog = useRef<HTMLDialogElement>(null);
  const src = `/help/shots/${name}.png`;
  return (
    <figure className="my-2">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group relative block w-full overflow-hidden rounded-lg border border-border bg-muted/40 text-start shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        aria-label={en("Show bigger: {what}", { what: alt })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain picture: its size is known, and the help pages load without the image service */}
        <img src={src} alt={alt} width={w || undefined} height={h || undefined} loading="lazy" className="block h-auto w-full" />
        <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
          {en("Example")}
        </span>
        <span aria-hidden="true" className="absolute bottom-2 end-2 rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </span>
      </button>
      <figcaption className="mt-1.5 text-xs text-muted-foreground">{en("Example from a demo school. Your screens show your own school's details.")}</figcaption>
      <dialog
        ref={dialog}
        aria-label={alt}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto max-h-[92vh] w-[min(96vw,1400px)] max-w-none rounded-xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <p className="truncate text-sm font-medium">{alt}</p>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={en("Close")}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the same picture, at full size */}
          <img src={src} alt="" width={w || undefined} height={h || undefined} className="mx-auto block h-auto max-w-full" />
        </div>
      </dialog>
    </figure>
  );
}

/** "Words we use": every term and what it means */
function Glossary({ ctx }: { ctx: Ctx }) {
  const en = useEn();
  const lang = useHelpLanguage();
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {helpGlossary(lang).map((g) => (
        <div key={g.key} id={`term-${g.key}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="font-semibold">{g.term}</dt>
          <dd className="text-muted-foreground">
            {g.means}
            {g.see && (
              <>
                {" "}
                <ArticleLink slug={g.see} ctx={ctx} className="font-medium text-foreground underline underline-offset-2">{en("Read more")}</ArticleLink>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HelpArticleView({ blocks, from, onOpenArticle }: { blocks: HelpBlock[]; from: string | null; onOpenArticle?: (slug: string) => void }) {
  const ctx: Ctx = { from, onOpenArticle };
  return (
    <div className="space-y-4 text-[15px] leading-7">
      {blocks.map((b, n) => {
        switch (b.t) {
          case "h2":
            return <h2 key={n} className="pt-3 text-lg font-semibold leading-snug"><Inlines items={b.c} ctx={ctx} /></h2>;
          case "h3":
            return <h3 key={n} className="pt-1 font-semibold"><Inlines items={b.c} ctx={ctx} /></h3>;
          case "note":
            return (
              <p key={n} className="rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3 text-sm leading-6">
                <Inlines items={b.c} ctx={ctx} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.t === "ul" ? "ul" : "ol";
            return (
              <List key={n} className={`space-y-1.5 ps-6 ${b.t === "ul" ? "list-disc" : "list-decimal"} marker:text-muted-foreground`}>
                {b.items.map((it, k) => <li key={k} className="ps-1"><Inlines items={it} ctx={ctx} /></li>)}
              </List>
            );
          }
          case "shot":
            return <Shot key={n} name={b.name} alt={b.alt} w={b.w} h={b.h} />;
          case "glossary":
            return <Glossary key={n} ctx={ctx} />;
          default:
            return <p key={n}><Inlines items={b.c} ctx={ctx} /></p>;
        }
      })}
    </div>
  );
}

/** "In short": the whole answer for someone in a hurry */
export function HelpShort({ lines }: { lines: string[] }) {
  const en = useEn();
  if (!lines.length) return null;
  return (
    <section aria-label={en("In short")} className="rounded-xl border border-border bg-muted/40 px-5 py-4">
      <h2 className="text-sm font-semibold">{en("In short")}</h2>
      <ul className="mt-2 space-y-1.5 text-[15px] leading-6">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Next step" after an article that's one of the reader's steps */
export function HelpNextStep({ slug, audience, from, onOpenArticle }: { slug: string; audience: string | null; from: string | null; onOpenArticle?: (slug: string) => void }) {
  const en = useEn();
  const lang = useHelpLanguage();
  const next = nextStep(helpArticles(lang), slug, audience);
  if (!next) return null;
  return (
    <ArticleLink
      slug={next.article.slug}
      ctx={{ from, onOpenArticle }}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[var(--brand)]/50 hover:bg-muted/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{en("Next step, {step} of {of}", { step: next.step, of: next.of })}</span>
        <span className="mt-0.5 block font-semibold">{next.article.title}</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
    </ArticleLink>
  );
}

/** One article: "In short", its text and "Next step" (the article page and the side panel both show it this way) */
export function HelpArticleBody({ article, audience, from, onOpenArticle }: { article: HelpArticle; audience: string | null; from: string | null; onOpenArticle?: (slug: string) => void }) {
  return (
    <div className="space-y-6">
      <HelpShort lines={article.short} />
      <HelpArticleView blocks={article.blocks} from={from} onOpenArticle={onOpenArticle} />
      <HelpNextStep slug={article.slug} audience={audience} from={from} onOpenArticle={onOpenArticle} />
    </div>
  );
}
