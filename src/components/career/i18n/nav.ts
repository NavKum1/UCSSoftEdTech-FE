"use client";

import { useCallback } from "react";
import { careerNav, personaTitle, type CareerNavItem, type CareerPersona } from "@/lib/careerNav";
import { useCareerT } from "./CareerI18nProvider";

/**
 * Message key for a nav entry, derived from its route so lib/careerNav.ts keeps plain English labels:
 * the persona root is "home"; "/career-center/settings/sis" is "settings_sis". Entries without a message
 * (for example one a module just added) show their English label.
 */
export function navKey(persona: CareerPersona, href: string) {
  const root = careerNav[persona][0]?.href ?? "";
  if (href === root) return "home";
  return href.startsWith(root + "/") ? href.slice(root.length + 1).replace(/\//g, "_") : href.replace(/^\//, "").replace(/\//g, "_");
}

export function useCareerNavLabels(persona: CareerPersona) {
  const t = useCareerT();
  const label = useCallback(
    (item: CareerNavItem) => {
      const key = `nav.${persona}.${navKey(persona, item.href)}`;
      return t.has(key) ? t(key) : item.label;
    },
    [t, persona],
  );
  const title = t.has(`persona.${persona}`) ? t(`persona.${persona}`) : personaTitle[persona];
  return { label, title };
}
