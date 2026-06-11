export type Language = "en" | "vi";

export type LocalizedText = Record<Language, string>;

export type Category = {
  id: string;
  name: string;
  createdAt?: string;
};

export type CategoryDraft = Omit<Category, "id" | "createdAt">;

export type InterviewQuestion = {
  id: string;
  categoryId: string;
  question: LocalizedText;
  answer: LocalizedText;
  createdAt?: string;
};

export type QuestionDraft = Omit<InterviewQuestion, "id" | "createdAt">;
