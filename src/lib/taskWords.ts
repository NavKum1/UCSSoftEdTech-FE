/**
 * Plain names for a coding task's type and language, as people read them on credentials, evidence packs and the
 * verification page ("New code · Python", not "Greenfield · python"). The stored values stay as they are.
 * en() where shown.
 */
const TASK_TYPE: Record<string, string> = {
  Greenfield: "New code",
  Brownfield: "Changes to existing code",
  AgentSupervision: "Working with an AI agent",
  ClassAssessment: "Class assessment",
  InternshipDefense: "Internship defense",
  RealWork: "Real-work defense",
};

const LANGUAGE: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  csharp: "C#",
  "c#": "C#",
  cpp: "C++",
  "c++": "C++",
  c: "C",
  go: "Go",
  golang: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  kotlin: "Kotlin",
  swift: "Swift",
  sql: "SQL",
  bash: "Bash",
  r: "R",
};

/** The task type's plain name (the English text, to pass through en()); unknown types are shown as they are */
export function taskTypeText(type?: string | null): string | null {
  if (!type) return null;
  return TASK_TYPE[type] ?? type;
}

/** The language's usual name ("Python", "C#"); unknown languages get a capital first letter */
export function languageText(language?: string | null): string | null {
  const l = language?.trim();
  if (!l) return null;
  return LANGUAGE[l.toLowerCase()] ?? l.charAt(0).toUpperCase() + l.slice(1);
}
