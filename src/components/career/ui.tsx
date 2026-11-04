"use client";

/**
 * Small, accessible building blocks shared by every page of every role (5 Nov 2026; first made for the career suite).
 * Brand color comes from the --brand CSS variable that the shells set (the role's accent, or a school's white-label
 * brand), so pages look right in every area. Type, surfaces, corners and shadows come from app/globals.css.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { currentFormatLocale, useCareerT } from "@/components/career/i18n/CareerI18nProvider";

// Language and formatting (G1): useCareerT for texts, useCareerFormat for dates, numbers and money
export { labelKey, useCareerFormat, useCareerI18n, useCareerLabels, useCareerT } from "@/components/career/i18n/CareerI18nProvider";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-9">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The button look, also for links that act as buttons (<Link className={buttonClass("secondary")}>). A primary link
 * also needs style={brandFill}.
 */
export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary") {
  const base =
    "inline-flex min-h-9 max-w-full items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-center text-sm font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "text-[var(--brand-foreground,#fff)] shadow-sm hover:brightness-110",
    secondary: "border border-border bg-card text-foreground shadow-sm hover:bg-muted",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost: "text-foreground hover:bg-muted",
  };
  return `${base} ${variants[variant]}`;
}

/** The brand fill of a primary button, for a <Link> styled with buttonClass("primary") */
export const brandFill: React.CSSProperties = { background: "var(--brand, #0e7490)", outlineColor: "var(--brand, #0e7490)" };

/** A figure on a dashboard: what it counts, the number, and an optional line under it */
export function StatTile({ label, value, hint, icon, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? "text-red-700 dark:text-red-400" : tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon && <span aria-hidden="true" className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Tabs within a page (underlined, like the menu above): one look for every in-page tab bar. Each tab is a button
 * that shows its panel; counts sit beside the label.
 */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string; count?: number; icon?: React.ReactNode }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              on ? "border-[var(--brand,#0e7490)] font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {t.icon && <span aria-hidden="true" className="[&>svg]:h-4 [&>svg]:w-4">{t.icon}</span>}
            {t.label}
            {t.count != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; busy?: boolean; ref?: React.Ref<HTMLButtonElement> };

export function Button({ variant = "primary", busy, className = "", children, disabled, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`${buttonClass(variant)} ${className}`}
      style={variant === "primary" ? { background: "var(--brand, #0e7490)", outlineColor: "var(--brand, #0e7490)", ...style } : style}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-foreground",
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function ErrorBanner({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  const t = useCareerT("ui");
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{error}</span>
      {onRetry && (
        <button type="button" className="underline" onClick={onRetry}>
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
      {message}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useCareerT("ui");
  return (
    <div role="status" data-loading="true" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ?? t("loading")}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean; className: string }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    // min-w-0: a field in a grid can shrink to a phone's width even when its hint has a long URL
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined, className: inputClass })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Horizontal scroll container for wide tables. When its content actually overflows (small screens), it becomes a
 * keyboard-focusable region named after the table caption, so keyboard users can scroll it (WCAG 2.1.1, 1.4.10).
 */
export function ScrollArea({ children, className = "overflow-x-auto", label }: { children: React.ReactNode; className?: string; label?: string }) {
  const t = useCareerT("ui");
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ scrollable: boolean; name?: string }>({ scrollable: false, name: label });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // ResizeObserver reports once when observing starts, then on every size change
    const ro = new ResizeObserver(() => {
      const scrollable = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      const name = label ?? (el.querySelector("caption")?.textContent?.trim() || undefined);
      setState((s) => (s.scrollable === scrollable && s.name === name ? s : { scrollable, name }));
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [label]);
  return (
    <div
      ref={ref}
      className={`relative ${className} focus-visible:outline-2 focus-visible:outline-offset-2`}
      tabIndex={state.scrollable ? 0 : undefined}
      role={state.scrollable ? "region" : undefined}
      aria-label={state.scrollable ? (state.name ? t("scrollableNamed", { name: state.name }) : t("scrollableTable")) : undefined}
    >
      {children}
    </div>
  );
}

const FOCUSABLE ='a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog with the keyboard behaviour WCAG expects: focus moves into the dialog when it opens, Tab and
 * Shift+Tab stay inside it, Escape closes it, and focus returns to the control that opened it.
 */
export function Modal({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.getClientRects().length > 0);
    (focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const list = focusables();
        if (list.length === 0) {
          e.preventDefault();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !node?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !node?.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {children}
    </div>
  );
}

/** Loads data once (and on reload()); keeps error text for ErrorBanner. */
export function useLoad<T>(loader: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    loaderRef.current()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, setData, error, loading, reload: () => {
      setLoading(true);
      setTick((t) => t + 1);
    } };
}

/**
 * Date (and time) in the career locale. Prefer useCareerFormat() in components (it also offers the school's time
 * zone, numbers and currency); this plain function stays for existing pages and follows the same locale.
 */
export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const locale = currentFormatLocale();
  return withTime ? d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : d.toLocaleDateString(locale, { dateStyle: "medium" });
}
