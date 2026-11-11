"use client";

// S4b: the side panel's opener, in a file of its own so the header (which the help pages also use) can open it without
// importing the panel itself
import { createContext, useContext } from "react";

export type HelpPanelApi = { open: (slug?: string | null) => void };
export const HelpPanelContext = createContext<HelpPanelApi | null>(null);

/** The side panel, when the page has one (null on the help center's own pages) */
export function useHelpPanel(): HelpPanelApi | null {
  return useContext(HelpPanelContext);
}
