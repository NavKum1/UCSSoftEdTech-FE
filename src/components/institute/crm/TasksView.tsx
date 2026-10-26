"use client";

/** Open follow-ups across all leads: mine, overdue or everyone's, soonest first; tick one off or open its lead. */

import React, { useCallback, useEffect, useState } from "react";
import { crm, PriorityBadge, relative, STAGE_LABEL, StageDot, type GetToken, type OpenTask } from "./api";

export default function TasksView({ getToken, openLead, version }: { getToken: GetToken; openLead: (id: string) => void; version: number }) {
  const [scope, setScope] = useState<"mine" | "overdue" | "all">("mine");
  const [tasks, setTasks] = useState<OpenTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    crm<OpenTask[]>(getToken, `/tasks?scope=${scope}`)
      .then((t) => {
        setTasks(t);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [getToken, scope]);

  useEffect(() => {
    load();
  }, [load, version]);

  const done = async (id: string) => {
    setTasks((ts) => ts?.filter((t) => t.id !== id) ?? null);
    await crm(getToken, `/tasks/${id}/done`, { method: "POST", body: { done: true } }).catch((e) => {
      setError((e as Error).message);
      load();
    });
  };

  const groups: [string, OpenTask[]][] = [];
  if (tasks) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    groups.push(["Overdue", tasks.filter((t) => t.overdue)]);
    groups.push(["Today", tasks.filter((t) => !t.overdue && new Date(t.dueAt) <= end)]);
    groups.push(["Coming up", tasks.filter((t) => new Date(t.dueAt) > end)]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["mine", "Mine"],
            ["overdue", "Overdue"],
            ["all", "Everyone's"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${scope === k ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      {!tasks && !error && <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}
      {tasks && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {scope === "mine" ? "No follow-ups for you. Schedule one from a lead's Follow-ups tab." : "Nothing here."}
        </div>
      )}
      {groups
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => (
          <section key={label}>
            <h3 className={`mb-2 text-sm font-semibold ${label === "Overdue" ? "text-red-700 dark:text-red-400" : ""}`}>
              {label} <span className="font-normal text-muted-foreground">({items.length})</span>
            </h3>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <input type="checkbox" aria-label={`Done: ${t.title}`} onChange={() => done(t.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t.title}
                      {t.lead && (
                        <>
                          <span className="font-normal text-muted-foreground"> with </span>
                          <button type="button" onClick={() => openLead(t.leadId)} className="hover:underline">
                            {t.lead}
                          </button>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} ({relative(t.dueAt)}){t.assignee ? ` · for ${t.assignee}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {t.phone && (
                        <a href={`tel:${t.phone}`} className="text-cyan-700 hover:underline dark:text-cyan-400">
                          {t.phone}
                        </a>
                      )}
                      {t.email && <span className="truncate">{t.email}</span>}
                      {t.interest && <span>{t.interest}</span>}
                      {t.stage && (
                        <span className="inline-flex items-center gap-1">
                          <StageDot stage={t.stage} />
                          {STAGE_LABEL[t.stage] ?? t.stage}
                        </span>
                      )}
                      {t.highPriority && <PriorityBadge />}
                    </div>
                  </div>
                  <button type="button" onClick={() => openLead(t.leadId)} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                    Open lead
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
