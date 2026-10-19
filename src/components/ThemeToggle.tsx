"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const noSubscribe = () => () => {};

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  // false on the server and during hydration, true on the client: the theme is only known in the browser
  const mounted = React.useSyncExternalStore(noSubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted/40 border border-border/40 shrink-0" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-8 h-8 rounded-full border border-border/80 bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm shrink-0 cursor-pointer p-0 overflow-hidden"
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none">
        <Sun className={`w-4 h-4 text-foreground transition-all duration-300 absolute inset-0 m-auto ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
        <Moon className={`w-4 h-4 text-foreground transition-all duration-300 absolute inset-0 m-auto ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
