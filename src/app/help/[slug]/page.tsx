"use client";

/**
 * S4 help center: one article, with when it was last checked against the app, "Was this helpful?", the other articles in
 * its group, and who to contact. The articles are built from content/help by scripts/help-build.ts. S4b: "In short", terms
 * explained where they're first used, screenshots, "Next step" in the reader's steps, and "What were you looking for?".
 */
import React, { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEn } from "@/lib/english/EnglishProvider";
import { formatDate, Loading } from "@/components/career/ui";
import { HelpArticleBody } from "@/components/help/HelpArticleView";
import { ContactPanel, HelpFeedback, HelpFrame, useHelpContact } from "@/components/help/HelpParts";
import { useHelpLanguage } from "@/components/help/useHelpLanguage";
import { helpArticle, helpArticles, isFor } from "@/lib/help";

export default function HelpArticlePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Article />
    </Suspense>
  );
}

function Article() {
  const en = useEn();
  const { slug } = useParams<{ slug: string }>();
  const from = useSearchParams().get("from");
  const lang = useHelpLanguage();
  const contact = useHelpContact();
  const a = helpArticle(lang, slug);
  const q = from ? `?from=${encodeURIComponent(from)}` : "";

  if (!a)
    return (
      <HelpFrame from={from}>
        <h1 className="text-2xl font-semibold">{en("That article isn't here")}</h1>
        <p className="mt-2 text-muted-foreground">
          <Link href={`/help${q}`} className="font-medium underline underline-offset-2">{en("Open the help center")}</Link>
          {en(" to search all the guides.")}
        </p>
      </HelpFrame>
    );

  // Others in its group, for the reader where we know who they are
  const mine = contact?.audience ?? null;
  const related = helpArticles(lang).filter((x) => x.group === a.group && x.slug !== a.slug && (!mine || !isFor(a, mine) || isFor(x, mine)));
  return (
    <HelpFrame from={from}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0 max-w-[72ch]">
          <nav aria-label={en("Breadcrumb")} className="mb-3 text-sm text-muted-foreground">
            <Link href={`/help${q}`} className="underline-offset-2 hover:underline">{en("Help center")}</Link>
            <span aria-hidden="true"> / </span>
            <span>{a.group}</span>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight">{a.title}</h1>
          <p className="mt-3 text-lg leading-7 text-muted-foreground">{a.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground" suppressHydrationWarning>{en("Checked against the app on {date}", { date: formatDate(a.checked) })}</p>
          <div className="mt-6">
            <HelpArticleBody article={a} audience={mine} from={from} />
          </div>
          <div className="mt-8">
            <HelpFeedback slug={a.slug} />
          </div>
        </article>
        <aside className="space-y-6 lg:pt-9">
          {related.length > 0 && (
            <nav aria-labelledby="help-related">
              <h2 id="help-related" className="mb-2 text-sm font-semibold">{en("More in {group}", { group: a.group })}</h2>
              <ul className="space-y-1.5 text-sm">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/help/${r.slug}${q}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{r.title}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </div>
      <div className="mt-10 max-w-[72ch]">
        <ContactPanel contact={contact} page={from} />
      </div>
    </HelpFrame>
  );
}
