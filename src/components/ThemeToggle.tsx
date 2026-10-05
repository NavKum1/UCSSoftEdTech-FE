"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
      className="relative flex items-center justify-center w-8 h-8 rounded-full bg-card hover:bg-muted text-foreground border border-border/80 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm shrink-0 cursor-pointer p-0 overflow-hidden"
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none">
        <Sun className={`w-4 h-4 text-amber-500 transition-all duration-300 absolute inset-0 m-auto ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
        <Moon className={`w-4 h-4 text-indigo-400 transition-all duration-300 absolute inset-0 m-auto ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
