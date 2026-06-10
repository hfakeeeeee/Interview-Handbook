export type QuestionLevel = "Intern" | "Junior" | "Middle" | "Senior";

export type InterviewQuestion = {
  id: string;
  title: string;
  question: string;
  answer: string;
  category: string;
  role: string;
  level: QuestionLevel;
  tags: string[];
  source?: string;
  createdAt?: string;
};

export type QuestionDraft = Omit<InterviewQuestion, "id" | "createdAt">;
