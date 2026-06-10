import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileQuestion,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { isFirebaseConfigured } from "./lib/firebaseConfig";
import {
  loadFavoriteIds,
  loadLocalCategories,
  loadLocalQuestions,
  saveFavoriteIds,
  saveLocalCategory,
  saveLocalQuestion,
  updateLocalQuestion,
} from "./lib/localQuestions";
import type { Category, CategoryDraft, InterviewQuestion, QuestionDraft } from "./types";

const ALL_CATEGORIES_ID = "all";
const QUESTIONS_PER_PAGE = 10;

const emptyQuestionDraft: QuestionDraft = {
  categoryId: "",
  question: "",
  answer: "",
};

const emptyCategoryDraft: CategoryDraft = {
  name: "",
};

export default function App() {
  const [categories, setCategories] = useState<Category[]>(() => loadLocalCategories());
  const [questions, setQuestions] = useState<InterviewQuestion[]>(() => loadLocalQuestions());
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteIds());
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORIES_ID);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestionDraft);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategoryDraft);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

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
          setCategories(items);
          setStatus("Firestore connected");
        },
        (error) => {
          setStatus(error.message);
          setCategories(loadLocalCategories());
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
        !keyword || [item.question, item.answer].join(" ").toLowerCase().includes(keyword);

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
  const hasSearch = search.trim().length > 0;
  const activeCategoryName =
    selectedCategoryId === ALL_CATEGORIES_ID
      ? "All categories"
      : categoryById.get(selectedCategoryId) ?? "Uncategorized";

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
      setStatus("Category name la bat buoc");
      return;
    }

    if (isFirebaseConfigured) {
      const { createCategory } = await import("./lib/firebase");
      await createCategory(nextDraft);
      setStatus("Saved category to Firestore");
    } else {
      const created = saveLocalCategory(nextDraft);
      setCategories(loadLocalCategories());
      setSelectedCategoryId(created.id);
      setStatus("Saved category locally");
    }

    setCategoryDraft(emptyCategoryDraft);
    setShowCategoryForm(false);
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryId =
      questionDraft.categoryId ||
      (selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id : selectedCategoryId);

    const nextDraft = {
      categoryId: categoryId ?? "",
      question: questionDraft.question.trim(),
      answer: questionDraft.answer.trim(),
    };

    if (!nextDraft.categoryId || !nextDraft.question || !nextDraft.answer) {
      setStatus("Category, question va answer la bat buoc");
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

  function openQuestionForm() {
    setEditingQuestionId(null);
    setQuestionDraft({
      ...emptyQuestionDraft,
      categoryId: selectedCategoryId === ALL_CATEGORIES_ID ? categories[0]?.id ?? "" : selectedCategoryId,
    });
    setShowQuestionForm(true);
  }

  function openEditQuestionForm(question: InterviewQuestion) {
    setEditingQuestionId(question.id);
    setQuestionDraft({
      categoryId: question.categoryId,
      question: question.question,
      answer: question.answer,
    });
    setShowQuestionForm(true);
  }

  function closeQuestionForm() {
    setQuestionDraft(emptyQuestionDraft);
    setEditingQuestionId(null);
    setShowQuestionForm(false);
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
            <h1>Practice by category.</h1>
          </div>
        </div>

        <div className="header-actions">
          <span className={isFirebaseConfigured ? "status online" : "status"}>
            <Database size={16} aria-hidden="true" />
            {status}
          </span>
          <button className="primary-button" type="button" onClick={openQuestionForm}>
            <Plus size={18} aria-hidden="true" />
            New question
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Question summary">
        <div className="summary-item">
          <span>{categories.length}</span>
          <p>Categories</p>
        </div>
        <div className="summary-item">
          <span>{filteredQuestions.length}</span>
          <p>Visible questions</p>
        </div>
        <div className="summary-item">
          <span>{favoriteQuestions}</span>
          <p>Favorites</p>
        </div>
      </section>

      <section className="toolbar simple-toolbar" aria-label="Search">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search in ${activeCategoryName}...`}
          />
        </div>

        {hasSearch && (
          <button className="icon-button" type="button" onClick={() => setSearch("")} title="Clear search">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </section>

      {showCategoryForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCategoryForm(false)}>
          <section
            className="modal-panel compact-modal"
            aria-label="Create category"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Create</p>
                <h2>Add category</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowCategoryForm(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="question-form" onSubmit={handleCategorySubmit}>
              <label>
                Category name
                <input
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft({ name: event.target.value })}
                  placeholder="VD: Frontend, Backend, System Design..."
                />
              </label>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={() => setShowCategoryForm(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save category
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
                <p className="eyebrow">{editingQuestionId ? "Edit" : "Create"}</p>
                <h2>{editingQuestionId ? "Edit question and answer" : "Add question and answer"}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeQuestionForm}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="question-form" onSubmit={handleQuestionSubmit}>
              <label>
                Category
                <select
                  value={questionDraft.categoryId}
                  onChange={(event) =>
                    setQuestionDraft({ ...questionDraft, categoryId: event.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Question
                <textarea
                  value={questionDraft.question}
                  onChange={(event) =>
                    setQuestionDraft({ ...questionDraft, question: event.target.value })
                  }
                  rows={4}
                  placeholder="Nhap cau hoi can on tap"
                />
              </label>

              <label>
                Answer
                <textarea
                  value={questionDraft.answer}
                  onChange={(event) =>
                    setQuestionDraft({ ...questionDraft, answer: event.target.value })
                  }
                  rows={8}
                  placeholder="Nhap cau tra loi, y chinh, vi du, trade-off..."
                />
              </label>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeQuestionForm}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  {editingQuestionId ? "Update question" : "Save question"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="category-strip" aria-label="Categories">
        <div className="category-tabs">
          <button
            className={selectedCategoryId === ALL_CATEGORIES_ID ? "category-chip active" : "category-chip"}
            type="button"
            onClick={() => setSelectedCategoryId(ALL_CATEGORIES_ID)}
          >
            <Folder size={17} aria-hidden="true" />
            <span>All categories</span>
            <strong>{questions.length}</strong>
          </button>

          {categories.map((item) => (
            <button
              className={selectedCategoryId === item.id ? "category-chip active" : "category-chip"}
              key={item.id}
              type="button"
              onClick={() => setSelectedCategoryId(item.id)}
            >
              <Folder size={17} aria-hidden="true" />
              <span>{item.name}</span>
              <strong>{questionsByCategory[item.id] ?? 0}</strong>
            </button>
          ))}
        </div>

        <button className="secondary-button" type="button" onClick={() => setShowCategoryForm(true)}>
          <FolderPlus size={18} aria-hidden="true" />
          New category
        </button>
      </section>

      <section className="practice-layout">
        <section className="question-list-panel" aria-label="Questions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activeCategoryName}</p>
              <h2>Questions</h2>
            </div>
            <span className="match-count">
              {visibleStart}-{visibleEnd} / {filteredQuestions.length}
            </span>
          </div>

          {filteredQuestions.length ? (
            <>
              <div className="question-list">
                {pagedQuestions.map((item, index) => {
                  const isSelected = selectedQuestion?.id === item.id;
                  const isFavorite = favorites.has(item.id);

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
                          {categoryById.get(item.categoryId) ?? "Uncategorized"} / Question{" "}
                          {pageStartIndex + index + 1}
                        </span>
                        <h3>{item.question}</h3>
                        <p>{item.answer}</p>
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
                    Previous
                  </button>

                  <span>
                    Page {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Next
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>{questions.length ? "No matching questions" : "No questions yet"}</h3>
              <p>
                {categories.length
                  ? "Add a question to this category or try another search keyword."
                  : "Create a category first, then add questions into it."}
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={categories.length ? openQuestionForm : () => setShowCategoryForm(true)}
              >
                {categories.length ? "New question" : "New category"}
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
                  <h2>{selectedQuestion.question}</h2>
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

              <div className="answer-block">
                <div className="block-heading">
                  <FileQuestion size={18} aria-hidden="true" />
                  Question
                </div>
                <p>{selectedQuestion.question}</p>
              </div>

              <div className="answer-block answer">
                <div className="block-heading">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  Answer
                </div>
                <p>{selectedQuestion.answer}</p>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>Select a question</h3>
              <p>The answer will appear here.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
