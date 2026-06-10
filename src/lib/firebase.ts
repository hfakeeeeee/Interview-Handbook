import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { Category, CategoryDraft, InterviewQuestion, QuestionDraft } from "../types";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";
import { UNCATEGORIZED_ID } from "./localQuestions";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const questionsCollection = () => {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return collection(db, "questions");
};

const categoriesCollection = () => {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return collection(db, "categories");
};

export function subscribeToCategories(
  onData: (categories: Category[]) => void,
  onError: (error: Error) => void,
) {
  if (!isFirebaseConfigured) {
    return () => undefined;
  }

  const categoriesQuery = query(categoriesCollection(), orderBy("createdAt", "desc"));

  return onSnapshot(
    categoriesQuery,
    (snapshot) => {
      const categories = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          name: String(data.name ?? ""),
          createdAt: data.createdAt?.toDate?.().toISOString?.(),
        } as Category;
      });

      onData(categories);
    },
    (error) => onError(error),
  );
}

export function subscribeToQuestions(
  onData: (questions: InterviewQuestion[]) => void,
  onError: (error: Error) => void,
) {
  if (!isFirebaseConfigured) {
    return () => undefined;
  }

  const questionsQuery = query(questionsCollection(), orderBy("createdAt", "desc"));

  return onSnapshot(
    questionsQuery,
    (snapshot) => {
      const questions = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          categoryId: String(data.categoryId ?? UNCATEGORIZED_ID),
          question: String(data.question ?? ""),
          answer: String(data.answer ?? ""),
          createdAt: data.createdAt?.toDate?.().toISOString?.(),
        } as InterviewQuestion;
      });

      onData(questions);
    },
    (error) => onError(error),
  );
}

export async function createQuestion(draft: QuestionDraft) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  await addDoc(questionsCollection(), {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateQuestion(questionId: string, draft: QuestionDraft) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(questionsCollection(), questionId), {
    ...draft,
    updatedAt: serverTimestamp(),
  });
}

export async function createCategory(draft: CategoryDraft) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  await addDoc(categoriesCollection(), {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
