"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, Home } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side crash to error tracking service (e.g. Sentry / Datadog)
    console.error("[BUILD & DEFEND CLIENT CRASH]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 font-sans">
      {/* Ambient Red Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 blur-3xl rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-red-500/30 text-center space-y-6 relative z-10 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">
            Service Notice
          </span>
          <h1 className="text-2xl font-extrabold text-white">Something Went Wrong</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            We encountered an unexpected issue while loading this page. Please try again or return to your dashboard.
          </p>
        </div>

        {error?.digest && (
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Reference Code:</span>
            <span className="text-red-400 font-bold">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-col space-y-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <a
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium text-xs flex items-center justify-center space-x-2 border border-slate-800 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </a>
        </div>
      </div>
    </div>
  );
}
