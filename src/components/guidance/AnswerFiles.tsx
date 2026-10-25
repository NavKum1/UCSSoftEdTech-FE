"use client";

/** Files a person attached to a guidance form (CV, marksheet), downloaded with the signed-in staff member's access. */

import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";

export interface AnswerFile {
  id: string;
  name: string;
  size: number;
}

export default function AnswerFiles({ files }: { files: AnswerFile[] | null | undefined }) {
  const { getToken } = useAppAuth();
  const [error, setError] = useState<string | null>(null);
  if (!files?.length) return null;

  const open = async (f: AnswerFile) => {
    setError(null);
    const res = await authenticatedFetch(`/api/guidance-forms/files/${f.id}`, {}, getToken).catch(() => null);
    if (!res?.ok) return setError("The file couldn't be opened.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {files.map((f) => (
        <button key={f.id} type="button" onClick={() => open(f)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-normal hover:bg-muted">
          <Paperclip aria-hidden="true" className="h-3.5 w-3.5" /> {f.name} <span className="text-muted-foreground">({Math.ceil(f.size / 1024)} KB)</span>
        </button>
      ))}
      {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}
    </span>
  );
}
