export type Category = {
  id: string;
  name: string;
  createdAt?: string;
};

export type CategoryDraft = Omit<Category, "id" | "createdAt">;

export type InterviewQuestion = {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  createdAt?: string;
};

export type QuestionDraft = Omit<InterviewQuestion, "id" | "createdAt">;
