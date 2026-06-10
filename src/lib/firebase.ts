import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { InterviewQuestion, QuestionDraft } from "../types";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";

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
          title: String(data.title ?? ""),
          question: String(data.question ?? ""),
          answer: String(data.answer ?? ""),
          category: String(data.category ?? ""),
          role: String(data.role ?? ""),
          level: data.level,
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          source: data.source ? String(data.source) : undefined,
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
