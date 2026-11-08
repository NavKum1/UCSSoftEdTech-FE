/**
 * Résumé library helpers for forms that take a résumé (docs/resume_tools_plan_nov2026.md, stage 2, G1): a résumé uploaded
 * in a form is kept in the person's library too, and the form sends a copy of that version. Only when the school uses
 * Edulexa's résumé tools (the form checks `disabled` from useLibraryResumes first).
 */

/** The library's own limit: a larger résumé goes to the form directly, as before */
export const LIBRARY_MAX_BYTES = 5_000_000;

/** The same file chosen again (a retry after the form refused something else) reuses its library version */
const saved = new WeakMap<File, string>();

/** Tells every library picker on the page to load again (a résumé was just added) */
export function libraryChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("resume-library-changed"));
}

/**
 * Saves a résumé file (PDF or Word, up to 5 MB) to the person's library and returns its version id; null when the file
 * isn't one the library takes (the form then uploads it directly, as before).
 */
export async function saveToLibrary(api: <T>(path: string, init?: { method?: string; body?: BodyInit }) => Promise<T>, file: File): Promise<string | null> {
  if (!/\.(pdf|docx)$/i.test(file.name) || file.size > LIBRARY_MAX_BYTES) return null;
  const known = saved.get(file);
  if (known) return known;
  const fd = new FormData();
  fd.append("file", file);
  const r = await api<{ currentVersion: { id: string } | null }>("/api/resumes", { method: "POST", body: fd });
  const id = r.currentVersion?.id ?? null;
  if (id) {
    saved.set(file, id);
    libraryChanged();
  }
  return id;
}
