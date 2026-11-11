"use client";

/**
 * S4 help center: a small "Help" link on a page to the article about it, keeping the way back. The slug is checked before
 * every push (scripts/help-build.ts), so a link never points at a missing article.
 */
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";

export function HelpLink({ slug, label }: { slug: string; label?: string }) {
  const en = useEn();
  const pathname = usePathname();
  return (
    <Link
      href={`/help/${slug}?from=${encodeURIComponent(pathname ?? "/")}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      <CircleHelp aria-hidden="true" className="h-4 w-4" />
      {label ?? en("Help")}
    </Link>
  );
}
