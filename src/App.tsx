import { useEffect, useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDownUp,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Eye,
  FileQuestion,
  Folder,
  FolderPlus,
  Info,
  Moon,
  Pencil,
  Plus,
  Search,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { isFirebaseConfigured } from "./lib/firebaseConfig";
import {
  loadFavoriteIds,
  loadLocalCategories,
  loadLocalQuestions,
  deleteLocalCategory,
  deleteLocalQuestion,
  deleteLocalQuestions,
  saveFavoriteIds,
  saveLocalCategory,
  saveLocalQuestion,
  saveLocalQuestions,
  updateLocalCategory,
  updateLocalQuestion,
} from "./lib/localQuestions";
import {
  emptyLocalizedText,
  getLocalizedText,
  hasLocalizedPair,
  languages,
  languageLabels,
  localizedSearchText,
  normalizeLocalizedText,
} from "./lib/localization";
import type { Category, CategoryDraft, InterviewQuestion, Language, QuestionDraft } from "./types";

const ALL_CATEGORIES_ID = "all";
const QUESTIONS_PER_PAGE = 10;
const THEME_STORAGE_KEY = "interview-handbook.theme";
const LANGUAGE_STORAGE_KEY = "interview-handbook.language";

const emptyQuestionDraft: QuestionDraft = {
  categoryId: "",
  question: emptyLocalizedText(),
  answer: emptyLocalizedText(),
};

const emptyCategoryDraft: CategoryDraft = {
  name: "",
};

type ExportScope = "all" | "category" | "page" | "selected";
type QuestionSortOrder = "newest" | "oldest";
type MissingLanguageFilter = Language | null;
type ConfirmDialog = {
  confirmLabel: string;
  detail?: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  title: string;
};
type DuplicateImportMatch = {
  existingId: string;
  importIndex: number;
  question: string;
};
type ImportedQuestion = {
  id?: string;
  question?: string;
  answer?: string;
  localizedQuestion?: Partial<Record<Language, string>>;
  localizedAnswer?: Partial<Record<Language, string>>;
};

function sortCategories(categories: Category[]) {
  return [...categories].sort((first, second) => first.name.localeCompare(second.name));
}

function getQuestionTime(question: InterviewQuestion) {
  const timestamp = Date.parse(question.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortQuestionsByTime(questions: InterviewQuestion[], order: QuestionSortOrder) {
  return [...questions].sort((first, second) => {
    const timeDiff = getQuestionTime(first) - getQuestionTime(second);

    if (timeDiff !== 0) {
      return order === "oldest" ? timeDiff : -timeDiff;
    }

    return first.id.localeCompare(second.id);
  });
}

function isMissingLanguage(question: InterviewQuestion, language: Language) {
  return !question.question[language].trim() || !question.answer[language].trim();
}

function normalizeDuplicateText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[`*_#[\]()>~|{}:;,.!?/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(first: string, second: string) {
  const firstTokens = new Set(normalizeDuplicateText(first).split(" ").filter(Boolean));
  const secondTokens = new Set(normalizeDuplicateText(second).split(" ").filter(Boolean));

  if (!firstTokens.size || !secondTokens.size) {
    return 0;
  }

  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  return intersection / union;
}

function getImportedQuestionTexts(item: ImportedQuestion, fallbackLanguage: Language) {
  const localizedLanguages = languages.filter((language) => item.localizedQuestion?.[language]?.trim());

  if (localizedLanguages.length) {
    return localizedLanguages.map((language) => item.localizedQuestion?.[language]?.trim() ?? "");
  }

  return [item.question?.trim() ?? ""].filter(Boolean);
}

function findDuplicateImportMatches(
  importedQuestions: ImportedQuestion[],
  existingQuestions: InterviewQuestion[],
  fallbackLanguage: Language,
) {
  const existingTexts = existingQuestions.flatMap((question) =>
    languages
      .map((language) => ({
        id: question.id,
        text: question.question[language].trim(),
      }))
      .filter((item) => item.text),
  );

  return importedQuestions.flatMap((item, importIndex): DuplicateImportMatch[] => {
    const importedTexts = getImportedQuestionTexts(item, fallbackLanguage);
    const match = importedTexts
      .flatMap((text) =>
        existingTexts.map((existing) => ({
          existingId: existing.id,
          importIndex,
          question: text,
          score:
            normalizeDuplicateText(text) === normalizeDuplicateText(existing.text)
              ? 1
              : textSimilarity(text, existing.text),
        })),
      )
      .filter((item) => item.score >= 0.88)
      .sort((first, second) => second.score - first.score)[0];

    return match ? [{ existingId: match.existingId, importIndex, question: match.question }] : [];
  });
}

function updateLocalizedValue(
  draft: QuestionDraft,
  field: "answer" | "question",
  language: Language,
  value: string,
) {
  return {
    ...draft,
    [field]: {
      ...draft[field],
      [language]: value,
    },
  };
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    addCategory: "Add category",
    addEnglishVersion: "Add English version",
    addQuestion: "Add question and answer",
    addVietnameseVersion: "Add Vietnamese version",
    allCategories: "All categories",
    answer: "Answer",
    answerHidden: "Answer hidden in review mode.",
    bulkImport: "Bulk import",
    cancel: "Cancel",
    categories: "Categories",
    category: "Category",
    categoryName: "Category name",
    categoryRequired: "Category name is required",
    clearSelection: "Clear",
    clearFilter: "Clear filter",
    create: "Create",
    deleteCategory: "Delete category",
    deleteCategoryConfirm: "Delete this category?",
    deleteCategoryWithQuestionsConfirm: "Delete this category and all questions inside it?",
    deleteQuestion: "Delete question",
    deleteQuestionConfirm: "Delete this question? This action cannot be undone.",
    deleteSelected: "Delete selected",
    deleteSelectedConfirm: "Delete selected questions? This action cannot be undone.",
    detected: "detected",
    duplicateQuestions: "Possible duplicates",
    duplicateQuestionsWarning: "Some new questions look similar to existing questions.",
    edit: "Edit",
    editCategory: "Edit category",
    editQuestion: "Edit question and answer",
    enterAnswer: "Enter the answer, key points, examples, trade-offs...",
    enterQuestion: "Enter the interview question",
    exportPrompt: "Export prompt",
    fallbackEnglish: "English fallback",
    fallbackVietnamese: "Vietnamese fallback",
    favorites: "Favorites",
    importQuestions: "Import questions",
    infoBulkTip: "Bulk import supports new questions, updates by ID, and bilingual EN/VI blocks.",
    infoCategoryTip: "Use categories to group topics like Java Core, Collections, or System Design.",
    infoDescription:
      "A focused workspace for collecting interview questions, storing Markdown answers, and reviewing them by category.",
    infoExportTip: "Export prompt helps translate selected questions with AI and paste them back safely.",
    infoGuide: "Guide",
    infoLanguageTip: "Switch EN/VI to review the same question in either language.",
    infoReviewTip: "Use the eye button in the header to enter Review mode and hide answers until you reveal them.",
    languageEnglish: "English",
    languageVietnamese: "Vietnamese",
    missingEnglish: "Missing English",
    missingVietnamese: "Missing Vietnamese",
    newCategory: "New category",
    newQuestion: "New question",
    noMatchingQuestions: "No matching questions",
    noQuestionsYet: "No questions yet",
    noQuestionsHint: "Add a question to this category or try another search keyword.",
    noQuestionsStartHint: "Create a category first, then add questions into it.",
    next: "Next",
    page: "Page",
    practiceByCategory: "Practice by category.",
    previous: "Previous",
    question: "Question",
    questions: "Questions",
    questionRequired: "Add at least one complete English or Vietnamese question and answer",
    revealAnswer: "Reveal answer",
    reviewMode: "Review",
    saveCategory: "Save category",
    saveQuestion: "Save question",
    searchIn: "Search in",
    selectCategory: "Select category",
    selectedFallback: "This entry is shown in the available language.",
    selectQuestion: "Select a question",
    selectPage: "Select page",
    answerWillAppear: "The answer will appear here.",
    showingMissingEnglish: "Showing questions missing English",
    showingMissingVietnamese: "Showing questions missing Vietnamese",
    showAll: "Show all",
    showLess: "Show less",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    updateCategory: "Update category",
    updateQuestion: "Update question",
    visibleQuestions: "Visible questions",
  },
  vi: {
    addCategory: "Thêm danh mục",
    addEnglishVersion: "Thêm bản tiếng Anh",
    addQuestion: "Thêm câu hỏi và câu trả lời",
    addVietnameseVersion: "Thêm bản tiếng Việt",
    allCategories: "Tất cả danh mục",
    answer: "Câu trả lời",
    answerHidden: "Câu trả lời đang được ẩn trong chế độ ôn tập.",
    bulkImport: "Nhập hàng loạt",
    cancel: "Hủy",
    categories: "Danh mục",
    category: "Danh mục",
    categoryName: "Tên danh mục",
    categoryRequired: "Tên danh mục là bắt buộc",
    clearSelection: "Bỏ chọn",
    clearFilter: "Bỏ lọc",
    create: "Tạo mới",
    deleteCategory: "Xóa danh mục",
    deleteCategoryConfirm: "Xóa danh mục này?",
    deleteCategoryWithQuestionsConfirm: "Xóa danh mục này và toàn bộ câu hỏi bên trong?",
    deleteQuestion: "Xóa câu hỏi",
    deleteQuestionConfirm: "Xóa câu hỏi này? Hành động này không thể hoàn tác.",
    deleteSelected: "Xóa đã chọn",
    deleteSelectedConfirm: "Xóa các câu hỏi đã chọn? Hành động này không thể hoàn tác.",
    detected: "được nhận diện",
    duplicateQuestions: "Có thể bị trùng",
    duplicateQuestionsWarning: "Một số câu hỏi mới có vẻ giống câu hỏi đã tồn tại.",
    edit: "Chỉnh sửa",
    editCategory: "Chỉnh sửa danh mục",
    editQuestion: "Chỉnh sửa câu hỏi và câu trả lời",
    enterAnswer: "Nhập câu trả lời, ý chính, ví dụ, trade-off...",
    enterQuestion: "Nhập câu hỏi phỏng vấn",
    exportPrompt: "Xuất prompt",
    fallbackEnglish: "Đang hiển thị bản tiếng Anh",
    fallbackVietnamese: "Đang hiển thị bản tiếng Việt",
    favorites: "Yêu thích",
    importQuestions: "Nhập câu hỏi",
    infoBulkTip: "Nhập hàng loạt hỗ trợ tạo câu hỏi mới, cập nhật theo ID và nhập song ngữ EN/VI.",
    infoCategoryTip: "Dùng danh mục để nhóm chủ đề như Java Core, Collections hoặc System Design.",
    infoDescription:
      "Không gian ôn luyện tập trung để lưu câu hỏi phỏng vấn, ghi câu trả lời bằng Markdown và xem lại theo danh mục.",
    infoExportTip: "Xuất prompt giúp dịch các câu đã chọn bằng AI và nhập ngược lại an toàn.",
    infoGuide: "Hướng dẫn",
    infoLanguageTip: "Chuyển EN/VI để xem cùng một câu hỏi ở từng ngôn ngữ.",
    infoReviewTip: "Dùng nút hình con mắt trên header để bật chế độ ôn tập và ẩn đáp án cho tới khi bạn mở ra.",
    languageEnglish: "Tiếng Anh",
    languageVietnamese: "Tiếng Việt",
    missingEnglish: "Thiếu tiếng Anh",
    missingVietnamese: "Thiếu tiếng Việt",
    newCategory: "Danh mục mới",
    newQuestion: "Câu hỏi mới",
    noMatchingQuestions: "Không có câu hỏi phù hợp",
    noQuestionsYet: "Chưa có câu hỏi",
    noQuestionsHint: "Thêm câu hỏi vào danh mục này hoặc thử từ khóa khác.",
    noQuestionsStartHint: "Tạo danh mục trước, rồi thêm câu hỏi vào đó.",
    next: "Tiếp",
    page: "Trang",
    practiceByCategory: "Ôn luyện theo danh mục.",
    previous: "Trước",
    question: "Câu hỏi",
    questions: "Câu hỏi",
    questionRequired: "Thêm ít nhất một cặp câu hỏi và câu trả lời tiếng Anh hoặc tiếng Việt",
    revealAnswer: "Hiện câu trả lời",
    reviewMode: "Ôn tập",
    saveCategory: "Lưu danh mục",
    saveQuestion: "Lưu câu hỏi",
    searchIn: "Tìm trong",
    selectCategory: "Chọn danh mục",
    selectedFallback: "Mục này đang hiển thị bằng ngôn ngữ có sẵn.",
    selectQuestion: "Chọn một câu hỏi",
    selectPage: "Chọn trang",
    answerWillAppear: "Câu trả lời sẽ hiển thị ở đây.",
    showingMissingEnglish: "Đang lọc câu thiếu tiếng Anh",
    showingMissingVietnamese: "Đang lọc câu thiếu tiếng Việt",
    showAll: "Hiện tất cả",
    showLess: "Thu gọn",
    sortNewest: "Mới nhất",
    sortOldest: "Cũ nhất",
    updateCategory: "Cập nhật danh mục",
    updateQuestion: "Cập nhật câu hỏi",
    visibleQuestions: "Câu hỏi hiển thị",
  },
};

function MarkdownContent({ value }: { value: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}

function cleanImportedText(value: string) {
  return value.replace(/^\s*-{3,}\s*$/gm, "").trim();
}

function stripCodeBlockWrapper(value: string) {
  return value.replace(/^```(?:text|markdown)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function parseImportLanguage(value: string | undefined): Language | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "en" || normalized === "english") {
    return "en";
  }

  if (normalized === "vi" || normalized === "vietnamese") {
    return "vi";
  }

  return null;
}

function parseMarkerChunk(value: string): ImportedQuestion | null {
  const questionLabel = String.raw`(?:Q(?:uestion)?|Cau hoi|Câu hỏi)`;
  const answerLabel = String.raw`(?:A(?:nswer)?|Tra loi|Trả lời)`;
  const labelPattern = new RegExp(
    `^\\s*(?:(EN|English|VI|Vietnamese)\\s+)?(${questionLabel}|${answerLabel})\\s*\\d*\\s*:\\s*`,
    "gim",
  );
  const chunk = stripCodeBlockWrapper(value);
  const id = chunk.match(/^\s*ID\s*:\s*([^\n]+)/i)?.[1]?.trim();
  const labels = [...chunk.matchAll(labelPattern)];

  if (labels.length < 2) {
    return null;
  }

  const imported: ImportedQuestion = {
    id,
    localizedAnswer: {},
    localizedQuestion: {},
  };

  labels.forEach((label, index) => {
    const contentStart = (label.index ?? 0) + label[0].length;
    const contentEnd = labels[index + 1]?.index ?? chunk.length;
    const content = cleanImportedText(chunk.slice(contentStart, contentEnd));
    const labelLanguage = parseImportLanguage(label[1]);
    const labelKind = label[2].toLowerCase().startsWith("a") || label[2].toLowerCase().startsWith("tra") ? "answer" : "question";

    if (!content) {
      return;
    }

    if (labelLanguage) {
      if (labelKind === "answer") {
        imported.localizedAnswer = {
          ...imported.localizedAnswer,
          [labelLanguage]: content,
        };
      } else {
        imported.localizedQuestion = {
          ...imported.localizedQuestion,
          [labelLanguage]: content,
        };
      }
      return;
    }

    if (labelKind === "answer") {
      imported.answer = content;
    } else {
      imported.question = content;
    }
  });

  const hasPlainPair = Boolean(imported.question && imported.answer);
  const hasLocalizedImportPair = languages.some(
    (item) => imported.localizedQuestion?.[item]?.trim() && imported.localizedAnswer?.[item]?.trim(),
  );

  return hasPlainPair || hasLocalizedImportPair ? imported : null;
}

function splitMarkerChunks(value: string) {
  const separatorChunks = value
    .split(/^\s*-{3,}\s*$/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (separatorChunks.length > 1) {
    return separatorChunks;
  }

  const questionLabel = String.raw`(?:Q(?:uestion)?|Cau hoi|Câu hỏi)`;
  const languagePrefix = String.raw`(?:(?:EN|English|VI|Vietnamese)\s+)?`;
  const hasImportIds = /^\s*ID\s*:\s*[^\n]+/im.test(value);
  const splitPattern = hasImportIds
    ? `(?=^\\s*ID\\s*:\\s*[^\\n]+\\n\\s*${languagePrefix}${questionLabel}\\s*\\d*\\s*:\\s*)`
    : `(?=^\\s*${questionLabel}\\s*\\d*\\s*:\\s*)`;

  return value
    .split(new RegExp(splitPattern, "gim"))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function parseMarkerQuestions(value: string) {
  return splitMarkerChunks(value).flatMap((chunk) => parseMarkerChunk(chunk) ?? []);
}

function parseMarkdownQuestions(value: string): ImportedQuestion[] {
  const headings = [...value.matchAll(/^#{2,6}\s+(.+)$/gm)];

  return headings.flatMap((heading, index) => {
    const question = heading[1].trim();
    const answerStart = (heading.index ?? 0) + heading[0].length;
    const answerEnd = headings[index + 1]?.index ?? value.length;
    const answer = cleanImportedText(value.slice(answerStart, answerEnd));

    return question && answer ? [{ question, answer }] : [];
  });
}

function parseBulkQuestions(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const markerQuestions = parseMarkerQuestions(normalized);
  return markerQuestions.length ? markerQuestions : parseMarkdownQuestions(normalized);
}

function getImportedLanguages(item: ImportedQuestion) {
  return languages.filter(
    (language) => item.localizedQuestion?.[language]?.trim() && item.localizedAnswer?.[language]?.trim(),
  );
}

function createDraftFromImport(
  item: ImportedQuestion,
  categoryId: string,
  fallbackLanguage: Language,
  current?: InterviewQuestion,
): QuestionDraft {
  const question = current ? { ...current.question } : emptyLocalizedText();
  const answer = current ? { ...current.answer } : emptyLocalizedText();
  const importedLanguages = getImportedLanguages(item);

  if (importedLanguages.length) {
    importedLanguages.forEach((language) => {
      question[language] = item.localizedQuestion?.[language]?.trim() ?? "";
      answer[language] = item.localizedAnswer?.[language]?.trim() ?? "";
    });
  } else {
    question[fallbackLanguage] = item.question?.trim() ?? "";
    answer[fallbackLanguage] = item.answer?.trim() ?? "";
  }

  return {
    categoryId,
    question,
    answer,
  };
}

function formatQuestionForPrompt(question: InterviewQuestion, language: Language, index: number) {
  const questionText = getLocalizedText(question.question, language).text;
  const answerText = getLocalizedText(question.answer, language).text;

  return [`ID: ${question.id}`, `Q${index}: ${questionText}`, `A${index}:`, answerText].join("\n");
}

function buildTranslationPrompt({
  categoryName,
  questions,
  sourceLanguage,
  targetLanguage,
}: {
  categoryName: string;
  questions: InterviewQuestion[];
  sourceLanguage: Language;
  targetLanguage: Language;
}) {
  const sourceLabel = languageLabels[sourceLanguage];
  const targetLabel = languageLabels[targetLanguage];
  const entries = questions
    .map((question, index) => formatQuestionForPrompt(question, sourceLanguage, index + 1))
    .join("\n\n---\n\n");

  return [
    `Translate the following interview questions and answers from ${sourceLabel} to ${targetLabel}.`,
    "Keep technical terms accurate.",
    "Keep each ID unchanged.",
    "Write the translated questions and answers as Markdown source, not rendered prose.",
    "Use Markdown where helpful: bullet lists, numbered lists, tables, bold, italic, inline code, and code examples.",
    "Return only one single plain-text code block containing all translated items so I can copy once.",
    "For code examples inside an answer, use Markdown tilde fences such as ~~~java and ~~~ instead of triple backticks.",
    "Use this exact format inside that single code block so I can paste it into my bulk import tool:",
    "",
    "```text",
    "ID: <same ID from source>",
    "Q: <translated question>",
    "A: <translated answer>",
    "",
    "ID: <same ID from source>",
    "Q: <translated question>",
    "A: <translated answer>",
    "```",
    "",
    `Category: ${categoryName}`,
    "",
    "Source content:",
    "",
    entries,
  ].join("\n");
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>(() => sortCategories(loadLocalCategories()));
  const [questions, setQuestions] = useState<InterviewQuestion[]>(() => loadLocalQuestions());
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteIds());
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORIES_ID);
  const [missingLanguageFilter, setMissingLanguageFilter] = useState<MissingLanguageFilter>(null);
  const [questionSortOrder, setQuestionSortOrder] = useState<QuestionSortOrder>("oldest");
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(() => new Set());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showBulkImportForm, setShowBulkImportForm] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestionDraft);
  const [questionFormLanguage, setQuestionFormLanguage] = useState<Language>("vi");
  const [bulkImportCategoryId, setBulkImportCategoryId] = useState("");
  const [bulkImportLanguage, setBulkImportLanguage] = useState<Language>("en");
  const [bulkImportText, setBulkImportText] = useState("");
  const [exportScope, setExportScope] = useState<ExportScope>("selected");
  const [exportTargetLanguage, setExportTargetLanguage] = useState<Language>("en");
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategoryDraft);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [language, setLanguage] = useState<Language>(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return storedLanguage === "en" || storedLanguage === "vi" ? storedLanguage : "en";
  });
  const [status, setStatus] = useState("");
  const t = translations[language];

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("Local mode");
      return undefined;
    }

    setStatus("Connecting Firestore");
    let unsubscribeQuestions: () => void = () => undefined;
    let unsubscribeCategories: () => void = () => undefined;

    void import("./lib/firebase").then(({ subscribeToCategories, subscribeToQuestions }) => {
      unsubscribeCategories = subscribeToCategories(
        (items) => {
          setCategories(sortCategories(items));
          setStatus("Firestore connected");
        },
        (error) => {
          setStatus(error.message);
          setCategories(sortCategories(loadLocalCategories()));
        },
      );

      unsubscribeQuestions = subscribeToQuestions(
        (items) => {
          setQuestions(items);
          setStatus("Firestore connected");
        },
        (error) => {
          setStatus(error.message);
          setQuestions(loadLocalQuestions());
        },
      );
    });

    return () => {
      unsubscribeQuestions();
      unsubscribeCategories();
    };
  }, []);

  useEffect(() => {
    saveFavoriteIds(favorites);
  }, [favorites]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (selectedCategoryId !== ALL_CATEGORIES_ID && !categories.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(ALL_CATEGORIES_ID);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const availableQuestionIds = new Set(questions.map((item) => item.id));
    setSelectedQuestionIds((current) => {
      const next = new Set([...current].filter((questionId) => availableQuestionIds.has(questionId)));
      return next.size === current.size ? current : next;
    });
  }, [questions]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((item) => [item.id, item.name]));
  }, [categories]);

  const questionsByCategory = useMemo(() => {
    return questions.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.categoryId] = (accumulator[item.categoryId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const matchedQuestions = questions.filter((item) => {
      const inSelectedCategory =
        selectedCategoryId === ALL_CATEGORIES_ID || item.categoryId === selectedCategoryId;
      const matchesMissingLanguage = !missingLanguageFilter || isMissingLanguage(item, missingLanguageFilter);
      const matchesSearch =
        !keyword || localizedSearchText(item.question, item.answer).toLowerCase().includes(keyword);

      return inSelectedCategory && matchesMissingLanguage && matchesSearch;
    });

    return sortQuestionsByTime(matchedQuestions, questionSortOrder);
  }, [missingLanguageFilter, questionSortOrder, questions, search, selectedCategoryId]);

  const selectedQuestion =
    filteredQuestions.find((item) => item.id === selectedId) ?? filteredQuestions[0] ?? null;

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * QUESTIONS_PER_PAGE;
  const pagedQuestions = filteredQuestions.slice(pageStartIndex, pageStartIndex + QUESTIONS_PER_PAGE);
  const visibleStart = filteredQuestions.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + QUESTIONS_PER_PAGE, filteredQuestions.length);
  const pagedQuestionIds = useMemo(() => pagedQuestions.map((item) => item.id), [pagedQuestions]);
  const selectedQuestionCount = selectedQuestionIds.size;
  const isPageSelected =
    pagedQuestionIds.length > 0 && pagedQuestionIds.every((questionId) => selectedQuestionIds.has(questionId));

  const favoriteQuestions = questions.filter((item) => favorites.has(item.id)).length;
  const missingEnglishQuestions = questions.filter((item) => isMissingLanguage(item, "en")).length;
  const missingVietnameseQuestions = questions.filter((item) => isMissingLanguage(item, "vi")).length;
  const parsedBulkQuestions = useMemo(() => parseBulkQuestions(bulkImportText), [bulkImportText]);
  const bulkImportPlan = useMemo(() => {
    const questionById = new Map(questions.map((item) => [item.id, item]));
    const missingIds = parsedBulkQuestions
      .filter((item) => item.id && !questionById.has(item.id))
      .map((item) => item.id);
    const newQuestions = parsedBulkQuestions.filter((item) => !item.id);
    const updates = parsedBulkQuestions.flatMap((item) => {
      const current = item.id ? questionById.get(item.id) : undefined;

      if (!current) {
        return [];
      }

      return [
        {
          id: current.id,
          draft: createDraftFromImport(item, current.categoryId, bulkImportLanguage, current),
        },
      ];
    });
    const duplicateMatches = findDuplicateImportMatches(newQuestions, questions, bulkImportLanguage);

    return {
      duplicateMatches,
      missingIds,
      newQuestions,
      updates,
    };
  }, [bulkImportLanguage, parsedBulkQuestions, questions]);
  const hasBulkImportErrors = bulkImportPlan.missingIds.length > 0 || bulkImportPlan.duplicateMatches.length > 0;
  const hasSearch = search.trim().length > 0;
  const hasActiveFilter = hasSearch || Boolean(missingLanguageFilter);
  const missingFilterLabel =
    missingLanguageFilter === "en"
      ? t.showingMissingEnglish
      : missingLanguageFilter === "vi"
        ? t.showingMissingVietnamese
        : "";
  const activeCategoryName =
    selectedCategoryId === ALL_CATEGORIES_ID
      ? t.allCategories
      : categoryById.get(selectedCategoryId) ?? "Uncategorized";
  const selectedQuestionDisplay = selectedQuestion ? getLocalizedText(selectedQuestion.question, language) : null;
  const selectedAnswerDisplay = selectedQuestion ? getLocalizedText(selectedQuestion.answer, language) : null;
  const isReviewAnswerHidden = isReviewMode && !isAnswerRevealed;
  const exportQuestions = useMemo(() => {
    switch (exportScope) {
      case "all":
        return questions;
      case "category":
        return filteredQuestions;
      case "page":
        return pagedQuestions;
      case "selected":
        return selectedQuestion ? [selectedQuestion] : [];
      default:
        return [];
    }
  }, [exportScope, filteredQuestions, pagedQuestions, questions, selectedQuestion]);
  const exportPrompt = useMemo(
    () =>
      buildTranslationPrompt({
        categoryName: activeCategoryName,
        questions: exportQuestions,
        sourceLanguage: language,
        targetLanguage: exportTargetLanguage,
      }),
    [activeCategoryName, exportQuestions, exportTargetLanguage, language],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [missingLanguageFilter, questionSortOrder, search, selectedCategoryId]);

  useEffect(() => {
    setIsAnswerRevealed(false);
  }, [isReviewMode, language, selectedQuestion?.id]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setPageInput(String(safeCurrentPage));
  }, [safeCurrentPage]);

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requestedPage = Number.parseInt(pageInput, 10);

    if (!Number.isFinite(requestedPage)) {
      setPageInput(String(safeCurrentPage));
      return;
    }

    const nextPage = Math.min(totalPages, Math.max(1, requestedPage));
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDraft = {
      name: categoryDraft.name.trim(),
    };

    if (!nextDraft.name) {
      setStatus(t.categoryRequired);
      return;
    }

    if (isFirebaseConfigured) {
      const { createCategory, updateCategory } = await import("./lib/firebase");

      if (editingCategoryId) {
        await updateCategory(editingCategoryId, nextDraft);
        setStatus("Updated category in Firestore");
      } else {
        await createCategory(nextDraft);
        setStatus("Saved category to Firestore");
      }
    } else {
      const created = editingCategoryId
        ? updateLocalCategory(editingCategoryId, nextDraft)
        : saveLocalCategory(nextDraft);
      setCategories(sortCategories(loadLocalCategories()));
      if (created) {
        setSelectedCategoryId(created.id);
      }
      setStatus(editingCategoryId ? "Updated category locally" : "Saved category locally");
    }

    setCategoryDraft(emptyCategoryDraft);
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryId =
      questionDraft.categoryId ||
      (selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id : selectedCategoryId);

    const nextDraft: QuestionDraft = {
      categoryId: categoryId ?? "",
      question: {
        en: questionDraft.question.en.trim(),
        vi: questionDraft.question.vi.trim(),
      },
      answer: {
        en: questionDraft.answer.en.trim(),
        vi: questionDraft.answer.vi.trim(),
      },
    };

    if (!nextDraft.categoryId || !hasLocalizedPair(nextDraft.question, nextDraft.answer)) {
      setStatus(t.questionRequired);
      return;
    }

    if (isFirebaseConfigured) {
      const { createQuestion, updateQuestion } = await import("./lib/firebase");

      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, nextDraft);
        setStatus("Updated question in Firestore");
      } else {
        await createQuestion(nextDraft);
        setStatus("Saved question to Firestore");
      }
    } else {
      const created = editingQuestionId
        ? updateLocalQuestion(editingQuestionId, nextDraft)
        : saveLocalQuestion(nextDraft);
      setQuestions(loadLocalQuestions());
      if (created) {
        setSelectedCategoryId(created.categoryId);
        setSelectedId(created.id);
      }
      setStatus(editingQuestionId ? "Updated question locally" : "Saved question locally");
    }

    setQuestionDraft(emptyQuestionDraft);
    setEditingQuestionId(null);
    setShowQuestionForm(false);
  }

  async function handleBulkImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryId =
      bulkImportCategoryId ||
      (selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id : selectedCategoryId);
    const drafts: QuestionDraft[] = bulkImportPlan.newQuestions.map((item) =>
      createDraftFromImport(item, categoryId ?? "", bulkImportLanguage),
    );

    if (!parsedBulkQuestions.length) {
      setStatus("No importable questions found");
      return;
    }

    if (bulkImportPlan.missingIds.length) {
      setStatus(`Could not find ${bulkImportPlan.missingIds.length} question IDs from the import`);
      return;
    }

    if (bulkImportPlan.duplicateMatches.length) {
      setStatus(`${bulkImportPlan.duplicateMatches.length} possible duplicate questions found`);
      return;
    }

    if (bulkImportPlan.newQuestions.length && !categoryId) {
      setStatus("Select a category before importing");
      return;
    }

    if (isFirebaseConfigured) {
      const { createQuestion, updateQuestion } = await import("./lib/firebase");
      await Promise.all([
        ...drafts.map((draft) => createQuestion(draft)),
        ...bulkImportPlan.updates.map((item) => updateQuestion(item.id, item.draft)),
      ]);
      setStatus(`Imported ${drafts.length} new and updated ${bulkImportPlan.updates.length} in Firestore`);
    } else {
      const created = saveLocalQuestions(drafts);
      bulkImportPlan.updates.forEach((item) => updateLocalQuestion(item.id, item.draft));
      setQuestions(loadLocalQuestions());

      if (created[0]) {
        setSelectedCategoryId(created[0].categoryId);
        setSelectedId(created[0].id);
      } else if (bulkImportPlan.updates[0]) {
        setSelectedId(bulkImportPlan.updates[0].id);
      }

      setStatus(`Imported ${drafts.length} new and updated ${bulkImportPlan.updates.length} locally`);
    }

    setBulkImportText("");
    setBulkImportCategoryId("");
    setShowBulkImportForm(false);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleQuestionSelection(questionId: string) {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  function togglePageSelection() {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (isPageSelected) {
        pagedQuestionIds.forEach((questionId) => next.delete(questionId));
      } else {
        pagedQuestionIds.forEach((questionId) => next.add(questionId));
      }
      return next;
    });
  }

  function clearQuestionSelection() {
    setSelectedQuestionIds(new Set());
  }

  async function handleDeleteSelectedQuestions() {
    const questionIds = [...selectedQuestionIds];

    if (!questionIds.length) {
      return;
    }

    setConfirmDialog({
      confirmLabel: t.deleteSelected,
      detail: `${questionIds.length} ${t.questions}`,
      message: t.deleteSelectedConfirm,
      title: t.deleteSelected,
      onConfirm: async () => {
        if (isFirebaseConfigured) {
          const { deleteQuestions } = await import("./lib/firebase");
          await deleteQuestions(questionIds);
          setStatus(`Deleted ${questionIds.length} questions from Firestore`);
        } else {
          deleteLocalQuestions(questionIds);
          setQuestions(loadLocalQuestions());
          setStatus(`Deleted ${questionIds.length} questions locally`);
        }

        setFavorites((current) => {
          const next = new Set(current);
          questionIds.forEach((questionId) => next.delete(questionId));
          return next;
        });
        setSelectedQuestionIds(new Set());
        setSelectedId(null);
      },
    });
  }

  async function handleDeleteQuestion(question: InterviewQuestion) {
    const questionTitle = getLocalizedText(question.question, language).text;

    setConfirmDialog({
      confirmLabel: t.deleteQuestion,
      detail: questionTitle,
      message: t.deleteQuestionConfirm,
      title: t.deleteQuestion,
      onConfirm: async () => {
        if (isFirebaseConfigured) {
          const { deleteQuestion } = await import("./lib/firebase");
          await deleteQuestion(question.id);
          setStatus("Deleted question from Firestore");
        } else {
          deleteLocalQuestion(question.id);
          setQuestions(loadLocalQuestions());
          setStatus("Deleted question locally");
        }

        setFavorites((current) => {
          const next = new Set(current);
          next.delete(question.id);
          return next;
        });
        setSelectedQuestionIds((current) => {
          const next = new Set(current);
          next.delete(question.id);
          return next;
        });

        setSelectedId(null);
      },
    });
  }

  function openCategoryForm() {
    setEditingCategoryId(null);
    setCategoryDraft(emptyCategoryDraft);
    setShowCategoryForm(true);
  }

  function openEditCategoryForm(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryDraft({ name: category.name });
    setShowCategoryForm(true);
  }

  function closeCategoryForm() {
    setEditingCategoryId(null);
    setCategoryDraft(emptyCategoryDraft);
    setShowCategoryForm(false);
  }

  async function handleDeleteCategory(category: Category) {
    const categoryQuestionIds = questions.filter((question) => question.categoryId === category.id).map((question) => question.id);
    const questionCount = categoryQuestionIds.length;

    setConfirmDialog({
      confirmLabel: t.deleteCategory,
      detail: questionCount ? `${category.name}: ${questionCount} ${t.questions}` : category.name,
      message: questionCount ? t.deleteCategoryWithQuestionsConfirm : t.deleteCategoryConfirm,
      title: t.deleteCategory,
      onConfirm: async () => {
        if (isFirebaseConfigured) {
          const { deleteCategory, deleteQuestions } = await import("./lib/firebase");
          await deleteQuestions(categoryQuestionIds);
          await deleteCategory(category.id);
          setStatus(`Deleted category and ${questionCount} questions from Firestore`);
        } else {
          deleteLocalQuestions(categoryQuestionIds);
          deleteLocalCategory(category.id);
          setCategories(sortCategories(loadLocalCategories()));
          setQuestions(loadLocalQuestions());
          setStatus("Deleted category locally");
        }

        if (selectedCategoryId === category.id) {
          setSelectedCategoryId(ALL_CATEGORIES_ID);
        }

        setFavorites((current) => {
          const next = new Set(current);
          categoryQuestionIds.forEach((questionId) => next.delete(questionId));
          return next;
        });
        setSelectedQuestionIds((current) => {
          const next = new Set(current);
          categoryQuestionIds.forEach((questionId) => next.delete(questionId));
          return next;
        });
        setSelectedId(null);
      },
    });
  }

  function openQuestionForm() {
    setEditingQuestionId(null);
    setQuestionFormLanguage(language);
    setQuestionDraft({
      ...emptyQuestionDraft,
      categoryId: selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id ?? "" : selectedCategoryId,
    });
    setShowQuestionForm(true);
  }

  function openBulkImportForm() {
    setBulkImportCategoryId(
      selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id ?? "" : selectedCategoryId,
    );
    setBulkImportLanguage(language);
    setBulkImportText("");
    setShowBulkImportForm(true);
  }

  function openEditQuestionForm(question: InterviewQuestion, targetLanguage = language) {
    setEditingQuestionId(question.id);
    setQuestionFormLanguage(targetLanguage);
    setQuestionDraft({
      categoryId: question.categoryId,
      question: normalizeLocalizedText(question.question, "vi"),
      answer: normalizeLocalizedText(question.answer, "vi"),
    });
    setShowQuestionForm(true);
  }

  function closeQuestionForm() {
    setQuestionDraft(emptyQuestionDraft);
    setEditingQuestionId(null);
    setShowQuestionForm(false);
  }

  function closeBulkImportForm() {
    setBulkImportCategoryId("");
    setBulkImportLanguage(language);
    setBulkImportText("");
    setShowBulkImportForm(false);
  }

  function openExportForm() {
    setExportTargetLanguage(language === "en" ? "vi" : "en");
    setExportScope(selectedQuestion ? "selected" : "page");
    setShowExportForm(true);
  }

  async function copyExportPrompt() {
    await navigator.clipboard.writeText(exportPrompt);
    setStatus(`Copied export prompt for ${exportQuestions.length} questions`);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="eyebrow">Interview Handbook</p>
            <h1>{t.practiceByCategory}</h1>
          </div>
        </div>

        <div className="header-actions">
          <span className={isFirebaseConfigured ? "status online" : "status"} title={status}>
            <Database size={16} aria-hidden="true" />
            {isFirebaseConfigured ? "Firestore" : status}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowInfoPanel(true)}
            title="About Interview Handbook"
            aria-label="About Interview Handbook"
          >
            <Info size={18} aria-hidden="true" />
          </button>
          <button
            className={isReviewMode ? "icon-button review-toggle active" : "icon-button review-toggle"}
            type="button"
            onClick={() => setIsReviewMode((current) => !current)}
            title={t.reviewMode}
            aria-label={t.reviewMode}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <div className="segmented-control" aria-label="Language">
            <button
              className={language === "en" ? "active" : ""}
              type="button"
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
            <button
              className={language === "vi" ? "active" : ""}
              type="button"
              onClick={() => setLanguage("vi")}
            >
              VI
            </button>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={openBulkImportForm}
            title={t.bulkImport}
            aria-label={t.bulkImport}
          >
            <ClipboardList size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={openExportForm}
            title={t.exportPrompt}
            aria-label={t.exportPrompt}
          >
            <Copy size={18} aria-hidden="true" />
          </button>
          <button className="primary-button new-question-button" type="button" onClick={openQuestionForm}>
            <Plus size={18} aria-hidden="true" />
            <span>{t.newQuestion}</span>
          </button>
        </div>
      </header>

      {showInfoPanel && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowInfoPanel(false)}>
          <section
            className="modal-panel compact-modal"
            aria-label="About Interview Handbook"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t.infoGuide}</p>
                <h2>Interview Handbook</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowInfoPanel(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="info-panel">
              <p>{t.infoDescription}</p>
              <ul>
                <li>{t.infoCategoryTip}</li>
                <li>{t.infoLanguageTip}</li>
                <li>{t.infoReviewTip}</li>
                <li>{t.infoBulkTip}</li>
                <li>{t.infoExportTip}</li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {confirmDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmDialog(null)}>
          <section
            className="modal-panel confirm-modal"
            aria-label={confirmDialog.title}
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirm-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>
            <div className="confirm-content">
              <p className="eyebrow">Confirm</p>
              <h2>{confirmDialog.title}</h2>
              <p>{confirmDialog.message}</p>
              {confirmDialog.detail && <div className="confirm-detail">{confirmDialog.detail}</div>}
            </div>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setConfirmDialog(null)}>
                {t.cancel}
              </button>
              <button
                className="primary-button danger-confirm-button"
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  void action();
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="summary-grid" aria-label="Question summary">
        <div className="summary-item">
          <span>{categories.length}</span>
          <p>{t.categories}</p>
        </div>
        <div className="summary-item">
          <span>{filteredQuestions.length}</span>
          <p>{t.visibleQuestions}</p>
        </div>
        <div className="summary-item">
          <span>{favoriteQuestions}</span>
          <p>{t.favorites}</p>
        </div>
        <button
          className={missingLanguageFilter === "en" ? "summary-item summary-button active" : "summary-item summary-button"}
          type="button"
          onClick={() => setMissingLanguageFilter((current) => (current === "en" ? null : "en"))}
        >
          <span>{missingEnglishQuestions}</span>
          <p>{t.missingEnglish}</p>
        </button>
        <button
          className={missingLanguageFilter === "vi" ? "summary-item summary-button active" : "summary-item summary-button"}
          type="button"
          onClick={() => setMissingLanguageFilter((current) => (current === "vi" ? null : "vi"))}
        >
          <span>{missingVietnameseQuestions}</span>
          <p>{t.missingVietnamese}</p>
        </button>
      </section>

      <section className="toolbar simple-toolbar" aria-label="Search">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`${t.searchIn} ${activeCategoryName}...`}
          />
        </div>

        {missingLanguageFilter && <span className="active-filter-chip">{missingFilterLabel}</span>}

        {hasActiveFilter && (
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              setSearch("");
              setMissingLanguageFilter(null);
            }}
            title={t.clearFilter}
            aria-label={t.clearFilter}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </section>

      {showCategoryForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeCategoryForm}>
          <section
            className="modal-panel compact-modal"
            aria-label="Create category"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{editingCategoryId ? t.edit : t.create}</p>
                <h2>{editingCategoryId ? t.editCategory : t.addCategory}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeCategoryForm}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="question-form" onSubmit={handleCategorySubmit}>
              <label>
                {t.categoryName}
                <input
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft({ name: event.target.value })}
                  placeholder="Example: Frontend, Backend, System Design..."
                />
              </label>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeCategoryForm}>
                  {t.cancel}
                </button>
                <button className="primary-button" type="submit">
                  {editingCategoryId ? t.updateCategory : t.saveCategory}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showQuestionForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeQuestionForm}>
          <section
            className="modal-panel"
            aria-label={editingQuestionId ? "Edit question" : "Create question"}
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{editingQuestionId ? t.edit : t.create}</p>
                <h2>{editingQuestionId ? t.editQuestion : t.addQuestion}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeQuestionForm}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="question-form" onSubmit={handleQuestionSubmit}>
              <label>
                {t.category}
                <select
                  value={questionDraft.categoryId}
                  onChange={(event) =>
                    setQuestionDraft({ ...questionDraft, categoryId: event.target.value })
                  }
                >
                  <option value="">{t.selectCategory}</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="segmented-control form-language-tabs" aria-label="Question language">
                <button
                  className={questionFormLanguage === "en" ? "active" : ""}
                  type="button"
                  onClick={() => setQuestionFormLanguage("en")}
                >
                  {t.languageEnglish}
                </button>
                <button
                  className={questionFormLanguage === "vi" ? "active" : ""}
                  type="button"
                  onClick={() => setQuestionFormLanguage("vi")}
                >
                  {t.languageVietnamese}
                </button>
              </div>

              <label>
                {t.question}
                <textarea
                  value={questionDraft.question[questionFormLanguage]}
                  onChange={(event) =>
                    setQuestionDraft(
                      updateLocalizedValue(questionDraft, "question", questionFormLanguage, event.target.value),
                    )
                  }
                  rows={4}
                  placeholder={t.enterQuestion}
                />
              </label>

              <label>
                {t.answer}
                <textarea
                  value={questionDraft.answer[questionFormLanguage]}
                  onChange={(event) =>
                    setQuestionDraft(
                      updateLocalizedValue(questionDraft, "answer", questionFormLanguage, event.target.value),
                    )
                  }
                  rows={8}
                  placeholder={t.enterAnswer}
                />
              </label>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeQuestionForm}>
                  {t.cancel}
                </button>
                <button className="primary-button" type="submit">
                  {editingQuestionId ? t.updateQuestion : t.saveQuestion}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showBulkImportForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeBulkImportForm}>
          <section
            className="modal-panel bulk-import-modal"
            aria-label="Bulk import questions"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Import</p>
                <h2>{t.bulkImport}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeBulkImportForm}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="question-form bulk-import-form" onSubmit={handleBulkImportSubmit}>
              <div className="bulk-import-controls">
                <label>
                  {t.category}
                  <select
                    value={bulkImportCategoryId}
                    onChange={(event) => setBulkImportCategoryId(event.target.value)}
                  >
                    <option value="">{t.selectCategory}</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Import language
                  <select
                    value={bulkImportLanguage}
                    onChange={(event) => setBulkImportLanguage(event.target.value as Language)}
                  >
                    <option value="en">{languageLabels.en}</option>
                    <option value="vi">{languageLabels.vi}</option>
                  </select>
                </label>
              </div>

              <label className="bulk-import-textarea">
                {t.questions}
                <textarea
                  value={bulkImportText}
                  onChange={(event) => setBulkImportText(event.target.value)}
                  rows={16}
                  placeholder={[
                    "ID: optional-existing-question-id",
                    "EN Q: What is JVM?",
                    "EN A: JVM runs Java bytecode.",
                    "",
                    "VI Q: JVM là gì?",
                    "VI A: JVM chạy Java bytecode.",
                    "",
                    "---",
                  ].join("\n")}
                />
              </label>

              <div className="bulk-import-meta">
                <span className="import-stat">
                  <strong>{parsedBulkQuestions.length}</strong>
                  <small>{parsedBulkQuestions.length === 1 ? t.question : t.questions} {t.detected}</small>
                </span>
                <span className="import-stat create">
                  <strong>{bulkImportPlan.newQuestions.length}</strong>
                  <small>create</small>
                </span>
                <span className="import-stat update">
                  <strong>{bulkImportPlan.updates.length}</strong>
                  <small>update</small>
                </span>
                <span className={bulkImportPlan.missingIds.length ? "import-stat danger" : "import-stat"}>
                  <strong>{bulkImportPlan.missingIds.length}</strong>
                  <small>missing ID</small>
                </span>
                <span className={bulkImportPlan.duplicateMatches.length ? "import-stat danger" : "import-stat"}>
                  <strong>{bulkImportPlan.duplicateMatches.length}</strong>
                  <small>duplicate</small>
                </span>
              </div>

              {hasBulkImportErrors && (
                <p className="form-warning">
                  {bulkImportPlan.missingIds.length
                    ? `${bulkImportPlan.missingIds.length} imported IDs do not match existing questions.`
                    : t.duplicateQuestionsWarning}
                </p>
              )}

              {bulkImportPlan.duplicateMatches.length > 0 && (
                <div className="duplicate-preview">
                  <strong>{t.duplicateQuestions}</strong>
                  {bulkImportPlan.duplicateMatches.slice(0, 3).map((item) => (
                    <span key={`${item.importIndex}-${item.existingId}`}>{item.question}</span>
                  ))}
                </div>
              )}

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeBulkImportForm}>
                  {t.cancel}
                </button>
                <button className="primary-button" type="submit" disabled={!parsedBulkQuestions.length || hasBulkImportErrors}>
                  {t.importQuestions}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showExportForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowExportForm(false)}>
          <section
            className="modal-panel"
            aria-label="Export translation prompt"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Export</p>
                <h2>{t.exportPrompt}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowExportForm(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="export-grid">
              <label>
                Scope
                <select value={exportScope} onChange={(event) => setExportScope(event.target.value as ExportScope)}>
                  <option value="selected">Selected question</option>
                  <option value="page">Current page</option>
                  <option value="category">Current category/search</option>
                  <option value="all">All questions</option>
                </select>
              </label>

              <label>
                Target language
                <select
                  value={exportTargetLanguage}
                  onChange={(event) => setExportTargetLanguage(event.target.value as Language)}
                >
                  <option value="en">{languageLabels.en}</option>
                  <option value="vi">{languageLabels.vi}</option>
                </select>
              </label>
            </div>

            <label>
              Prompt
              <textarea readOnly value={exportPrompt} rows={16} />
            </label>

            <div className="bulk-import-meta">
              <span>
                {exportQuestions.length} {exportQuestions.length === 1 ? t.question : t.questions}
              </span>
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setShowExportForm(false)}>
                {t.cancel}
              </button>
              <button className="primary-button" type="button" onClick={copyExportPrompt} disabled={!exportQuestions.length}>
                <Copy size={16} aria-hidden="true" />
                Copy prompt
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="category-strip" aria-label="Categories">
        <div className="category-strip__header">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>{t.categories}</h2>
          </div>

          <div className="category-strip__actions">
            {categories.length > 4 && (
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => setShowAllCategories((value) => !value)}
              >
                {showAllCategories ? t.showLess : t.showAll}
              </button>
            )}

            <button
              className="icon-button"
              type="button"
              onClick={openCategoryForm}
              title={t.newCategory}
              aria-label={t.newCategory}
            >
              <FolderPlus size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={showAllCategories ? "category-tabs expanded" : "category-tabs"}>
          <button
            className={selectedCategoryId === ALL_CATEGORIES_ID ? "category-chip active" : "category-chip"}
            type="button"
            onClick={() => setSelectedCategoryId(ALL_CATEGORIES_ID)}
          >
            <Folder size={17} aria-hidden="true" />
            <span>{t.allCategories}</span>
            <strong>{questions.length}</strong>
          </button>

          {categories.map((item) => (
            <div className={selectedCategoryId === item.id ? "category-chip active" : "category-chip"} key={item.id}>
              <button className="category-select" type="button" onClick={() => setSelectedCategoryId(item.id)}>
                <Folder size={17} aria-hidden="true" />
                <span>{item.name}</span>
                <strong>{questionsByCategory[item.id] ?? 0}</strong>
              </button>
              <button
                className="chip-action"
                type="button"
                onClick={() => openEditCategoryForm(item)}
                title="Edit category"
                aria-label="Edit category"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                className="chip-action danger-chip-action"
                type="button"
                onClick={() => handleDeleteCategory(item)}
                title="Delete category"
                aria-label="Delete category"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="practice-layout">
        <section className="question-list-panel" aria-label="Questions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activeCategoryName}</p>
              <h2>{t.questions}</h2>
            </div>
            <div className="question-panel-actions">
              <div className="sort-toggle" aria-label="Sort questions">
                <ArrowDownUp size={15} aria-hidden="true" />
                <button
                  className={questionSortOrder === "oldest" ? "active" : ""}
                  type="button"
                  onClick={() => setQuestionSortOrder("oldest")}
                >
                  {t.sortOldest}
                </button>
                <button
                  className={questionSortOrder === "newest" ? "active" : ""}
                  type="button"
                  onClick={() => setQuestionSortOrder("newest")}
                >
                  {t.sortNewest}
                </button>
              </div>
              <span className="match-count">
                {visibleStart}-{visibleEnd} / {filteredQuestions.length}
              </span>
              <button
                className="icon-button select-page-button"
                type="button"
                onClick={togglePageSelection}
                title={isPageSelected ? t.clearSelection : t.selectPage}
                aria-label={isPageSelected ? t.clearSelection : t.selectPage}
              >
                <CheckCircle2 size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          {filteredQuestions.length ? (
            <>
              {selectedQuestionCount > 0 && (
                <div className="bulk-question-actions">
                  <span>
                    {selectedQuestionCount} {t.questions}
                  </span>
                  <button className="secondary-button compact-action" type="button" onClick={clearQuestionSelection}>
                    {t.clearSelection}
                  </button>
                  <button className="secondary-button compact-action danger-button" type="button" onClick={handleDeleteSelectedQuestions}>
                    <Trash2 size={15} aria-hidden="true" />
                    {t.deleteSelected}
                  </button>
                </div>
              )}

              <div className={selectedQuestionCount > 0 ? "question-list selecting" : "question-list"}>
                {pagedQuestions.map((item) => {
                  const isSelected = selectedQuestion?.id === item.id;
                  const isFavorite = favorites.has(item.id);
                  const isChecked = selectedQuestionIds.has(item.id);
                  const questionDisplay = getLocalizedText(item.question, language);
                  const answerDisplay = getLocalizedText(item.answer, language);

                  return (
                    <article
                      className={[
                        "question-card",
                        isSelected ? "selected" : "",
                        isChecked ? "checked" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={item.id}
                    >
                      <label className="question-select-checkbox" aria-label="Select question">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleQuestionSelection(item.id)}
                        />
                      </label>

                      <button
                        className="question-card__main"
                        type="button"
                        onClick={() => {
                          if (selectedQuestionCount > 0) {
                            toggleQuestionSelection(item.id);
                          } else {
                            setSelectedId(item.id);
                          }
                        }}
                      >
                        <span className="card-kicker">
                          {categoryById.get(item.categoryId) ?? "Uncategorized"}
                        </span>
                        <h3>{questionDisplay.text}</h3>
                        <p>{isReviewMode ? t.answerHidden : answerDisplay.text}</p>
                        {(questionDisplay.fallbackLanguage || answerDisplay.fallbackLanguage) && (
                          <span className="fallback-chip">
                            {questionDisplay.fallbackLanguage === "en" || answerDisplay.fallbackLanguage === "en"
                              ? t.fallbackEnglish
                              : t.fallbackVietnamese}
                          </span>
                        )}
                      </button>

                      <button
                        className={isFavorite ? "star-button active" : "star-button"}
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        title={isFavorite ? "Remove favorite" : "Add favorite"}
                        aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
                      >
                        <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
                      </button>
                    </article>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav className="pagination" aria-label="Question pagination">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    {t.previous}
                  </button>

                  <form className="page-jump" onSubmit={handlePageJump}>
                    <span>{t.page}</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={(event) => setPageInput(event.target.value)}
                      onBlur={() => {
                        if (!pageInput.trim()) {
                          setPageInput(String(safeCurrentPage));
                        }
                      }}
                      aria-label="Page number"
                    />
                    <span>/ {totalPages}</span>
                  </form>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    {t.next}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>{questions.length ? t.noMatchingQuestions : t.noQuestionsYet}</h3>
              <p>
                {categories.length
                  ? t.noQuestionsHint
                  : t.noQuestionsStartHint}
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={categories.length ? openQuestionForm : openCategoryForm}
              >
                {categories.length ? t.newQuestion : t.newCategory}
              </button>
            </div>
          )}
        </section>

        <section className="answer-panel" aria-label="Selected answer">
          {selectedQuestion ? (
            <>
              <div className="answer-panel__header">
                <div>
                  <p className="eyebrow">
                    {categoryById.get(selectedQuestion.categoryId) ?? "Uncategorized"}
                  </p>
                  <h2>{selectedQuestionDisplay?.text}</h2>
                  {(selectedQuestionDisplay?.fallbackLanguage || selectedAnswerDisplay?.fallbackLanguage) && (
                    <div className="fallback-panel-actions">
                      <span className="fallback-chip panel-fallback">
                        {selectedQuestionDisplay?.fallbackLanguage === "en" ||
                        selectedAnswerDisplay?.fallbackLanguage === "en"
                          ? t.fallbackEnglish
                          : t.fallbackVietnamese}
                      </span>
                      <button
                        className="secondary-button compact-action"
                        type="button"
                        onClick={() => openEditQuestionForm(selectedQuestion, language)}
                      >
                        {language === "en" ? t.addEnglishVersion : t.addVietnameseVersion}
                      </button>
                    </div>
                  )}
                </div>
                <div className="answer-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => openEditQuestionForm(selectedQuestion)}
                    title="Edit question"
                    aria-label="Edit question"
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button danger-button"
                    type="button"
                    onClick={() => handleDeleteQuestion(selectedQuestion)}
                    title="Delete question"
                    aria-label="Delete question"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                  <button
                    className={favorites.has(selectedQuestion.id) ? "star-button active" : "star-button"}
                    type="button"
                    onClick={() => toggleFavorite(selectedQuestion.id)}
                    title="Toggle favorite"
                    aria-label="Toggle favorite"
                  >
                    <Star
                      size={20}
                      fill={favorites.has(selectedQuestion.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </div>

              <div className="answer-block answer">
                <div className="block-heading">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {t.answer}
                </div>
                {isReviewAnswerHidden ? (
                  <div className="review-hidden-panel">
                    <p>{t.answerHidden}</p>
                    <button className="primary-button" type="button" onClick={() => setIsAnswerRevealed(true)}>
                      <Eye size={17} aria-hidden="true" />
                      {t.revealAnswer}
                    </button>
                  </div>
                ) : (
                  <MarkdownContent value={selectedAnswerDisplay?.text ?? ""} />
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>{t.selectQuestion}</h3>
              <p>{t.answerWillAppear}</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
