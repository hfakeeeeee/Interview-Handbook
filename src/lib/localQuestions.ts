import type { Category, CategoryDraft, InterviewQuestion, QuestionDraft } from "../types";
import { normalizeLocalizedText } from "./localization";

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

export function updateLocalCategory(categoryId: string, draft: CategoryDraft) {
  const updated = loadLocalCategories().map((item) =>
    item.id === categoryId
      ? {
          ...item,
          name: draft.name.trim(),
        }
      : item,
  );

  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  return updated.find((item) => item.id === categoryId) ?? null;
}

export function deleteLocalCategory(categoryId: string) {
  const updated = loadLocalCategories().filter((item) => item.id !== categoryId);
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
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
        question: normalizeLocalizedText(item.question, "vi"),
        answer: normalizeLocalizedText(item.answer, "vi"),
        createdAt: item.createdAt,
      }))
      .filter((item) => item.question.en || item.question.vi || item.answer.en || item.answer.vi);
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

export function saveLocalQuestions(drafts: QuestionDraft[]) {
  const created = drafts.map((draft) => ({
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  const current = loadLocalQuestions();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...created, ...current]));
  return created;
}

export function updateLocalQuestion(questionId: string, draft: QuestionDraft) {
  const current = loadLocalQuestions();
  const updated = current.map((item) =>
    item.id === questionId
      ? {
          ...item,
          ...draft,
        }
      : item,
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((item) => item.id === questionId) ?? null;
}

export function deleteLocalQuestion(questionId: string) {
  const updated = loadLocalQuestions().filter((item) => item.id !== questionId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteLocalQuestions(questionIds: string[]) {
  const ids = new Set(questionIds);
  const updated = loadLocalQuestions().filter((item) => !ids.has(item.id));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
