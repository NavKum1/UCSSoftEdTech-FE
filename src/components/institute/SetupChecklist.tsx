"use client";

/**
 * A school's setup (S3): the shape the API returns (/api/institute/setup), what each checklist item says, and the
 * checklist card over the Admissions CRM. Every item is worked out from the school's data, so it ticks itself; the card
 * shows to administrators until setup is done or they hide it (Setup in the menu still has it).
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";

export interface ChecklistItem {
  key: "school" | "form" | "team" | "website" | "careerSuite";
  done: boolean;
  optional: boolean;
}

export interface SetupState {
  instituteId: string;
  school: {
    name: string;
    kind: string;
    country: string;
    countryLocked: boolean;
    website: string | null;
    contactEmail: string | null;
    address: string | null;
    accent: string | null;
    logoUrl: string | null;
  };
  plan: { key: string; name: string; careerSuite: boolean; customDomain: boolean } | null;
  team: { used: number; limit: number | null };
  forms: { id: string; name: string; isDefault: boolean; publicEnabled: boolean; customized: boolean; link: string }[];
  suggested: { key: string; name: string; audience: string; description: string; country: string }[];
  inquiries: number;
  checklist: ChecklistItem[];
  complete: boolean;
  hidden: boolean;
  wizardDone: boolean;
  /** The school's English: US or GB spelling for its forms, reports and e-mails (chosen, or from its country) */
  english: { value: "US" | "GB"; chosen: "US" | "GB" | null; fromCountry: "US" | "GB"; britishForms: number };
}

/** What each item asks for, and where it's done (the wizard's step, or Billing) */
export const CHECK_TEXT: Record<ChecklistItem["key"], { title: string; text: string; href: string; action: string }> = {
  // en() where shown
  school: { title: "Add your logo and colour", text: "They go on your forms, reports and e-mails.", href: "/institute/setup?step=school", action: "Add logo" },
  form: { title: "Publish your inquiry form", text: "Start from a template made for schools like yours.", href: "/institute/setup?step=form", action: "Choose a template" },
  // en() where shown
  team: { title: "Invite your team", text: "Counsellors work the inquiries; admins help run the school.", href: "/institute/setup?step=team", action: "Invite" },
  website: { title: "Get your first inquiry", text: "Put the form on your website, or share its link.", href: "/institute/setup?step=website", action: "Get the code" },
  careerSuite: { title: "Add the career suite", text: "Career services, events and AI interview practice for your students, on Growth and Pro.", href: "/institute/billing", action: "See plans" },
};

/** The checklist card on the Admissions CRM (administrators; nothing once setup is done or hidden) */
export function SetupChecklist() {
  const en = useEn();
  const { getToken, isSignedIn, roles } = useAppAuth();
  const pathname = usePathname();
  const [s, setS] = useState<SetupState | null>(null);
  const admin = roles.includes("InstituteAdmin");
  const show = pathname === "/institute/dashboard";

  useEffect(() => {
    if (!isSignedIn || !admin || !show) return;
    let live = true;
    authenticatedFetch("/api/institute/setup", {}, getToken)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setS(b))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isSignedIn, admin, show, getToken]);

  if (!show || !s || s.complete || s.hidden) return null;
  const needed = s.checklist.filter((c) => !c.optional);
  const done = needed.filter((c) => c.done).length;
  const hide = async () => {
    setS({ ...s, hidden: true });
    await authenticatedFetch("/api/institute/setup/checklist", { method: "POST", body: JSON.stringify({ hidden: true }) }, getToken).catch(() => undefined);
  };

  return (
    <section aria-labelledby="setup-checklist" className="mx-auto mb-5 max-w-7xl rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="setup-checklist" className="text-base font-semibold">
            Finish setting up {s.school.name}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {done} of {needed.length} done. Each step ticks itself when it&apos;s done.
          </p>
        </div>
        <button type="button" onClick={() => void hide()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
          <X aria-hidden="true" className="h-4 w-4" /> Hide
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup" aria-valuemin={0} aria-valuemax={needed.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-cyan-600 transition-[width] motion-reduce:transition-none" style={{ width: `${(done / needed.length) * 100}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {s.checklist.map((c) => {
          const t = CHECK_TEXT[c.key];
          return (
            <li key={c.key} className={`flex gap-3 rounded-xl border p-3.5 ${c.done ? "border-transparent bg-muted/60" : "border-border"} ${c.optional ? "border-dashed" : ""}`}>
              {c.done ? (
                <CheckCircle2 aria-label="Done" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle aria-label={c.optional ? "Optional" : "To do"} className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-medium ${c.done ? "text-muted-foreground line-through decoration-1" : ""}`}>{en(t.title)}</p>
                {!c.done && (
                  <>
                    <p className="mt-0.5 text-xs text-muted-foreground">{en(t.text)}</p>
                    <Link href={t.href} className="mt-1.5 inline-block text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400">
                      {en(t.action)}
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
