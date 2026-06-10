import type { InterviewQuestion, QuestionDraft } from "../types";

const STORAGE_KEY = "interview-handbook.local-questions";
const LEGACY_SEED_PREFIX = "seed-";

export function loadLocalQuestions() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as InterviewQuestion[];
    return parsed.filter((item) => !item.id.startsWith(LEGACY_SEED_PREFIX));
  } catch {
    return [];
  }
}

export function saveLocalQuestion(draft: QuestionDraft) {
  const question: InterviewQuestion = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const current = loadLocalQuestions();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([question, ...current]));
  return question;
}

const FAVORITES_KEY = "interview-handbook.favorite-ids";

export function loadFavoriteIds() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

export function saveFavoriteIds(ids: Set<string>) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}
