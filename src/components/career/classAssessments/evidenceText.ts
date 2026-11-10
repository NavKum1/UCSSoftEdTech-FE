"use client";

/**
 * Build & Defend 1.0, 2.7: the words for the evidence. The API returns points to talk about as codes with their numbers; they
 * are worded here, neutrally (patterns worth asking about, never findings), so they can be translated.
 */
import { useEn } from "@/lib/english/EnglishProvider";
import { formatWhen, type AttemptStatus, type Decision, type EvidenceSignal, type StudentRow, type SuggestionState, type WorkKind } from "./types";

export function useWorkKindNames(): Record<WorkKind, string> {
  const en = useEn();
  return { repo: en("GitHub repository"), upload: en("Uploaded project"), sprint: en("Coding task"), exam: en("Written exam") };
}

export function useDecisionNames(): Record<Decision, string> {
  const en = useEn();
  return { pass: en("Passed"), resubmit: en("Asked to resubmit"), fail: en("Not passed") };
}

export function useAttemptStatusNames(): Record<AttemptStatus, string> {
  const en = useEn();
  return { Started: en("Working on it"), Viva: en("Work in, viva next"), Submitted: en("Ready for review"), Decided: en("Decided") };
}

export function useSuggestionStateText(): Record<SuggestionState, string> {
  const en = useEn();
  return {
    ready: en("Suggested scores ready"),
    pending: en("Working out suggested scores"),
    after_viva: en("Suggested after the viva"),
    off: en("AI suggestions aren't set up for your school"),
    none: en("The AI couldn't suggest scores for this attempt"),
  };
}

/** Where a student is, for the class list */
export function useStudentStatus() {
  const en = useEn();
  const statuses = useAttemptStatusNames();
  const decisions = useDecisionNames();
  return (s: StudentRow): { label: string; tone: "neutral" | "good" | "warn" | "bad" | "info" } => {
    const t = s.attempt;
    if (!t) return { label: s.signedIn ? en("Not started") : en("Hasn't signed in yet"), tone: "neutral" };
    if (t.status === "Decided" && t.decision) return { label: decisions[t.decision], tone: t.decision === "pass" ? "good" : t.decision === "fail" ? "bad" : "warn" };
    return { label: statuses[t.status], tone: t.status === "Submitted" ? "info" : "neutral" };
  };
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function useSignalText() {
  const en = useEn();
  const text = (s: EvidenceSignal): string => {
    const v = s.values ?? {};
    const files = Array.isArray(v.files) ? (v.files as string[]).join(", ") : "";
    switch (s.code) {
      case "late":
        return en("Handed in after the due date ({when}).", { when: formatWhen(str(v.dueAt)) });
      case "repo_commits":
        return en("{share}% of the sampled commits in the repository are by the student's own GitHub account.", { share: num(v.share) });
      case "repo_commits_low":
        return en("Only {share}% of the sampled commits in the repository are by the student's own GitHub account. Worth asking who wrote the rest.", { share: num(v.share) });
      case "repo_not_verified":
        return en("The repository's ownership wasn't confirmed.");
      case "same_files":
        if (str(v.student)) return en("Files the same as in {student}'s work, apart from blank lines and indentation: {files}.", { student: str(v.student), files });
        return v.sameClass
          ? en("Files the same as in another student's work in this class, apart from blank lines and indentation: {files}.", { files })
          : en("Files the same as in a student's work in another class, apart from blank lines and indentation: {files}.", { files });
      case "same_upload":
        if (str(v.student)) return en("The uploaded .zip is identical to the one {student} handed in.", { student: str(v.student) });
        return en("The uploaded .zip is identical to one another student handed in.");
      case "coding_no_attempt":
        return en("Handed in without a timed session in the workspace, so the editing couldn't be followed.");
      case "coding_no_editor_activity":
        return en("No editing was recorded, but the work contains new code.");
      case "coding_replay_mismatch":
        return en("The recorded editing doesn't add up to the code handed in.");
      case "coding_telemetry_gaps":
        return en("Part of the editing record didn't arrive.");
      case "coding_clock_ahead":
        return en("The editor's clock ran ahead of the server's.");
      case "coding_too_fast":
        return en("A lot of new code arrived soon after starting.");
      case "coding_external_paste":
        return en("{count} characters were pasted from outside the editor.", { count: num(v.pasted) });
      case "coding_unverified_ai_insert":
        return en("Some text marked as from the AI assistant doesn't match what the assistant wrote.");
      case "coding_mechanical_rhythm":
        return en("The typing rhythm was unusually even.");
      case "coding_inhuman_speed":
        return en("The typing was very fast for a long stretch.");
      case "coding_no_revisions":
        return en("The code was typed with almost no corrections.");
      case "coding_burst_after_away":
        return en("A large block was typed right after coming back to the editor.");
      case "coding_time_away":
        return en("Away from the editor {count} times.", { count: num(v.focusLosses) });
      case "coding_high_similarity":
      case "coding_similarity":
        return en("{share}% of the code's structure matches someone else's work on the same task.", { share: num(v.similarity) });
      case "coding_chat_artifacts":
        return en("The code contains text that looks like it came from a chat assistant.");
      case "coding_markdown_fences":
        return en("The code contains Markdown code fences.");
      case "coding_ai_assistant":
        return en("The student used the built-in AI assistant. The conversation is with the work.");
      case "viva_voice_not_kept":
        return en("The voice viva didn't go through ({count} tries), so writing was offered.", { count: num(v.tries) });
      case "viva_typed_after_voice":
        return en("Answered in writing after the voice viva didn't go through.");
      case "viva_few_answers":
        return en("Answered {answered} of {asked} questions.", { answered: num(v.answered), asked: num(v.asked) });
      case "viva_short_answers":
        return en("The answers were short: {count} words on average.", { count: num(v.words) });
      default:
        return en("Something else worth asking about ({code}).", { code: s.code });
    }
  };
  // 2.12: the change task's points are the coding task's, about the change
  return (s: EvidenceSignal): string => {
    if (s.code === "change_not_handed_in") return en("The change task wasn't handed in in time.");
    if (s.code.startsWith("change_")) return en("In the change task: {point}", { point: text({ ...s, code: "coding_" + s.code.slice("change_".length) }) });
    return text(s);
  };
}

/** 2.12: why there was no change task (the API's three reasons), in the reader's language */
export function useSkipReasonText() {
  const en = useEn();
  return (reason: string | null): string => {
    if (!reason) return en("There's no change task this time. Go on to the viva.");
    if (reason.startsWith("The change task works with")) return en("The change task works with Python, JavaScript and TypeScript projects, so there's none for this one. Go on to the viva.");
    if (reason.startsWith("The change task couldn't be prepared")) return en("The change task couldn't be prepared: the AI or the code runner wasn't available. Go on to the viva.");
    if (reason.startsWith("A fair change task")) return en("A fair change task couldn't be made from this project. Go on to the viva.");
    return reason;
  };
}
