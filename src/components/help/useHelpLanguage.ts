"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** The page's language (the html lang the app set), for picking a reviewed translation of an article; English on the server */
export function useHelpLanguage(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (document.documentElement.lang || "en").slice(0, 2).toLowerCase(),
    () => "en",
  );
}
