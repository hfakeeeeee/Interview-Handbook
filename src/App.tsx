import { useEffect, useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileQuestion,
  Folder,
  FolderPlus,
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

function sortCategories(categories: Category[]) {
  return [...categories].sort((first, second) => first.name.localeCompare(second.name));
}

function createLocalizedDraft(question: string, answer: string, language: Language) {
  return {
    answer: {
      ...emptyLocalizedText(),
      [language]: answer,
    },
    question: {
      ...emptyLocalizedText(),
      [language]: question,
    },
  };
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
    bulkImport: "Bulk import",
    cancel: "Cancel",
    categories: "Categories",
    category: "Category",
    categoryName: "Category name",
    categoryRequired: "Category name is required",
    create: "Create",
    deleteCategoryConfirm: "Delete category",
    deleteQuestionConfirm: "Delete this question? This action cannot be undone.",
    detected: "detected",
    edit: "Edit",
    editCategory: "Edit category",
    editQuestion: "Edit question and answer",
    enterAnswer: "Enter the answer, key points, examples, trade-offs...",
    enterQuestion: "Enter the interview question",
    fallbackEnglish: "English fallback",
    fallbackVietnamese: "Vietnamese fallback",
    favorites: "Favorites",
    importQuestions: "Import questions",
    languageEnglish: "English",
    languageVietnamese: "Vietnamese",
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
    saveCategory: "Save category",
    saveQuestion: "Save question",
    searchIn: "Search in",
    selectCategory: "Select category",
    selectedFallback: "This entry is shown in the available language.",
    selectQuestion: "Select a question",
    answerWillAppear: "The answer will appear here.",
    showAll: "Show all",
    showLess: "Show less",
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
    bulkImport: "Nhập hàng loạt",
    cancel: "Hủy",
    categories: "Danh mục",
    category: "Danh mục",
    categoryName: "Tên danh mục",
    categoryRequired: "Tên danh mục là bắt buộc",
    create: "Tạo mới",
    deleteCategoryConfirm: "Xóa danh mục",
    deleteQuestionConfirm: "Xóa câu hỏi này? Hành động này không thể hoàn tác.",
    detected: "được nhận diện",
    edit: "Chỉnh sửa",
    editCategory: "Chỉnh sửa danh mục",
    editQuestion: "Chỉnh sửa câu hỏi và câu trả lời",
    enterAnswer: "Nhập câu trả lời, ý chính, ví dụ, trade-off...",
    enterQuestion: "Nhập câu hỏi phỏng vấn",
    fallbackEnglish: "Đang hiển thị bản tiếng Anh",
    fallbackVietnamese: "Đang hiển thị bản tiếng Việt",
    favorites: "Yêu thích",
    importQuestions: "Nhập câu hỏi",
    languageEnglish: "Tiếng Anh",
    languageVietnamese: "Tiếng Việt",
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
    saveCategory: "Lưu danh mục",
    saveQuestion: "Lưu câu hỏi",
    searchIn: "Tìm trong",
    selectCategory: "Chọn danh mục",
    selectedFallback: "Mục này đang hiển thị bằng ngôn ngữ có sẵn.",
    selectQuestion: "Chọn một câu hỏi",
    answerWillAppear: "Câu trả lời sẽ hiển thị ở đây.",
    showAll: "Hiện tất cả",
    showLess: "Thu gọn",
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

function parseMarkerQuestions(value: string) {
  const questionLabel = String.raw`(?:Q(?:uestion)?|Cau hoi|Câu hỏi)`;
  const answerLabel = String.raw`(?:A(?:nswer)?|Tra loi|Trả lời)`;
  const chunks = value
    .split(new RegExp(`(?=^\\s*${questionLabel}\\s*\\d*\\s*[:.-]\\s*)`, "gim"))
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.flatMap((chunk) => {
    const match = chunk.match(
      new RegExp(
        `^\\s*${questionLabel}\\s*\\d*\\s*[:.-]\\s*([\\s\\S]*?)\\n\\s*${answerLabel}\\s*\\d*\\s*[:.-]\\s*([\\s\\S]*)$`,
        "i",
      ),
    );

    if (!match) {
      return [];
    }

    const question = cleanImportedText(match[1]);
    const answer = cleanImportedText(match[2]);
    return question && answer ? [{ question, answer }] : [];
  });
}

function parseMarkdownQuestions(value: string) {
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

export default function App() {
  const [categories, setCategories] = useState<Category[]>(() => sortCategories(loadLocalCategories()));
  const [questions, setQuestions] = useState<InterviewQuestion[]>(() => loadLocalQuestions());
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteIds());
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORIES_ID);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showBulkImportForm, setShowBulkImportForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestionDraft);
  const [questionFormLanguage, setQuestionFormLanguage] = useState<Language>("vi");
  const [bulkImportCategoryId, setBulkImportCategoryId] = useState("");
  const [bulkImportText, setBulkImportText] = useState("");
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

    return questions.filter((item) => {
      const inSelectedCategory =
        selectedCategoryId === ALL_CATEGORIES_ID || item.categoryId === selectedCategoryId;
      const matchesSearch =
        !keyword || localizedSearchText(item.question, item.answer).toLowerCase().includes(keyword);

      return inSelectedCategory && matchesSearch;
    });
  }, [questions, search, selectedCategoryId]);

  const selectedQuestion =
    filteredQuestions.find((item) => item.id === selectedId) ?? filteredQuestions[0] ?? null;

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * QUESTIONS_PER_PAGE;
  const pagedQuestions = filteredQuestions.slice(pageStartIndex, pageStartIndex + QUESTIONS_PER_PAGE);
  const visibleStart = filteredQuestions.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + QUESTIONS_PER_PAGE, filteredQuestions.length);

  const favoriteQuestions = questions.filter((item) => favorites.has(item.id)).length;
  const parsedBulkQuestions = useMemo(() => parseBulkQuestions(bulkImportText), [bulkImportText]);
  const hasSearch = search.trim().length > 0;
  const activeCategoryName =
    selectedCategoryId === ALL_CATEGORIES_ID
      ? t.allCategories
      : categoryById.get(selectedCategoryId) ?? "Uncategorized";
  const selectedQuestionDisplay = selectedQuestion ? getLocalizedText(selectedQuestion.question, language) : null;
  const selectedAnswerDisplay = selectedQuestion ? getLocalizedText(selectedQuestion.answer, language) : null;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategoryId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    const drafts: QuestionDraft[] = parsedBulkQuestions.map((item) => ({
      ...createLocalizedDraft(item.question, item.answer, language),
      categoryId: categoryId ?? "",
    }));

    if (!categoryId) {
      setStatus("Select a category before importing");
      return;
    }

    if (!drafts.length) {
      setStatus("No importable questions found");
      return;
    }

    if (isFirebaseConfigured) {
      const { createQuestion } = await import("./lib/firebase");
      await Promise.all(drafts.map((draft) => createQuestion(draft)));
      setStatus(`Imported ${drafts.length} questions to Firestore`);
    } else {
      const created = saveLocalQuestions(drafts);
      setQuestions(loadLocalQuestions());

      if (created[0]) {
        setSelectedCategoryId(created[0].categoryId);
        setSelectedId(created[0].id);
      }

      setStatus(`Imported ${drafts.length} questions locally`);
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

  async function handleDeleteQuestion(question: InterviewQuestion) {
    const confirmed = window.confirm(t.deleteQuestionConfirm);

    if (!confirmed) {
      return;
    }

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

    setSelectedId(null);
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
    const questionCount = questionsByCategory[category.id] ?? 0;

    if (questionCount > 0) {
      setStatus("Cannot delete category that still has questions");
      return;
    }

    const confirmed = window.confirm(`Delete category "${category.name}"?`);

    if (!confirmed) {
      return;
    }

    if (isFirebaseConfigured) {
      const { deleteCategory } = await import("./lib/firebase");
      await deleteCategory(category.id);
      setStatus("Deleted category from Firestore");
    } else {
      deleteLocalCategory(category.id);
      setCategories(sortCategories(loadLocalCategories()));
      setStatus("Deleted category locally");
    }

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId(ALL_CATEGORIES_ID);
    }
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
    setBulkImportText("");
    setShowBulkImportForm(false);
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
          <span className={isFirebaseConfigured ? "status online" : "status"}>
            <Database size={16} aria-hidden="true" />
            {status}
          </span>
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
          <button className="secondary-button" type="button" onClick={openBulkImportForm}>
            <ClipboardList size={18} aria-hidden="true" />
            {t.bulkImport}
          </button>
          <button className="primary-button" type="button" onClick={openQuestionForm}>
            <Plus size={18} aria-hidden="true" />
            {t.newQuestion}
          </button>
        </div>
      </header>

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

        {hasSearch && (
          <button className="icon-button" type="button" onClick={() => setSearch("")} title="Clear search">
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
            className="modal-panel"
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

            <form className="question-form" onSubmit={handleBulkImportSubmit}>
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
                {t.questions}
                <textarea
                  value={bulkImportText}
                  onChange={(event) => setBulkImportText(event.target.value)}
                  rows={16}
                  placeholder={[
                    "Q: What is Java?",
                    "A: Java is a programming language...",
                    "",
                    "Q: What is JVM?",
                    "A: JVM runs bytecode and manages the runtime...",
                  ].join("\n")}
                />
              </label>

              <div className="bulk-import-meta">
                <span>
                  {parsedBulkQuestions.length}{" "}
                  {parsedBulkQuestions.length === 1 ? t.question : t.questions} {t.detected}
                </span>
              </div>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeBulkImportForm}>
                  {t.cancel}
                </button>
                <button className="primary-button" type="submit" disabled={!parsedBulkQuestions.length}>
                  {t.importQuestions}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="category-strip" aria-label="Categories">
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
                title="Delete empty category"
                aria-label="Delete category"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {categories.length > 4 && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowAllCategories((value) => !value)}
          >
            {showAllCategories ? t.showLess : t.showAll}
          </button>
        )}

        <button className="secondary-button" type="button" onClick={openCategoryForm}>
          <FolderPlus size={18} aria-hidden="true" />
          {t.newCategory}
        </button>
      </section>

      <section className="practice-layout">
        <section className="question-list-panel" aria-label="Questions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activeCategoryName}</p>
              <h2>{t.questions}</h2>
            </div>
            <span className="match-count">
              {visibleStart}-{visibleEnd} / {filteredQuestions.length}
            </span>
          </div>

          {filteredQuestions.length ? (
            <>
              <div className="question-list">
                {pagedQuestions.map((item) => {
                  const isSelected = selectedQuestion?.id === item.id;
                  const isFavorite = favorites.has(item.id);
                  const questionDisplay = getLocalizedText(item.question, language);
                  const answerDisplay = getLocalizedText(item.answer, language);

                  return (
                    <article
                      className={isSelected ? "question-card selected" : "question-card"}
                      key={item.id}
                    >
                      <button
                        className="question-card__main"
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="card-kicker">
                          {categoryById.get(item.categoryId) ?? "Uncategorized"}
                        </span>
                        <h3>{questionDisplay.text}</h3>
                        <p>{answerDisplay.text}</p>
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

                  <span>
                    {t.page} {safeCurrentPage} / {totalPages}
                  </span>

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
                <MarkdownContent value={selectedAnswerDisplay?.text ?? ""} />
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
