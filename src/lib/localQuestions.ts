import type { Category, CategoryDraft, InterviewQuestion, QuestionDraft } from "../types";

const STORAGE_KEY = "interview-handbook.local-questions";
const CATEGORIES_STORAGE_KEY = "interview-handbook.local-categories";
const LEGACY_SEED_PREFIX = "seed-";
export const UNCATEGORIZED_ID = "uncategorized";

export function loadLocalCategories() {
  const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Category[];
    return parsed
      .map((item) => ({
        id: item.id,
        name: String(item.name ?? "").trim(),
        createdAt: item.createdAt,
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}

export function saveLocalCategory(draft: CategoryDraft) {
  const category: Category = {
    ...draft,
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    createdAt: new Date().toISOString(),
  };
  const current = loadLocalCategories();
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify([category, ...current]));
  return category;
}

export function loadLocalQuestions() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as InterviewQuestion[];
    return parsed
      .filter((item) => !item.id.startsWith(LEGACY_SEED_PREFIX))
      .map((item) => ({
        id: item.id,
        categoryId: String(item.categoryId ?? UNCATEGORIZED_ID),
        question: String(item.question ?? ""),
        answer: String(item.answer ?? ""),
        createdAt: item.createdAt,
      }))
      .filter((item) => item.question && item.answer);
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
