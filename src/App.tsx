import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Database,
  FileQuestion,
  Filter,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { isFirebaseConfigured } from "./lib/firebaseConfig";
import {
  loadFavoriteIds,
  loadLocalQuestions,
  saveFavoriteIds,
  saveLocalQuestion,
} from "./lib/localQuestions";
import type { InterviewQuestion, QuestionDraft, QuestionLevel } from "./types";

const levels: QuestionLevel[] = ["Intern", "Junior", "Middle", "Senior"];

const emptyDraft: QuestionDraft = {
  title: "",
  question: "",
  answer: "",
  category: "",
  role: "",
  level: "Junior",
  tags: [],
  source: "",
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matches(value: string, selected: string) {
  return selected === "All" || value === selected;
}

function normaliseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export default function App() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>(() => loadLocalQuestions());
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteIds());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [role, setRole] = useState("All");
  const [level, setLevel] = useState<QuestionLevel | "All">("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("Local mode");
      return undefined;
    }

    setStatus("Connecting Firestore");
    let unsubscribe: () => void = () => undefined;

    void import("./lib/firebase").then(({ subscribeToQuestions }) => {
      unsubscribe = subscribeToQuestions(
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

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    saveFavoriteIds(favorites);
  }, [favorites]);

  const categories = useMemo(() => unique(questions.map((item) => item.category)), [questions]);
  const roles = useMemo(() => unique(questions.map((item) => item.role)), [questions]);

  const filteredQuestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return questions.filter((item) => {
      const haystack = [
        item.title,
        item.question,
        item.answer,
        item.category,
        item.role,
        item.level,
        item.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!keyword || haystack.includes(keyword)) &&
        matches(item.category, category) &&
        matches(item.role, role) &&
        matches(item.level, level)
      );
    });
  }, [category, level, questions, role, search]);

  const selectedQuestion =
    filteredQuestions.find((item) => item.id === selectedId) ?? filteredQuestions[0] ?? null;

  const favoriteQuestions = questions.filter((item) => favorites.has(item.id)).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDraft = {
      ...draft,
      tags: normaliseTags(tagInput),
      title: draft.title.trim(),
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      category: draft.category.trim() || "General",
      role: draft.role.trim() || "General",
      source: draft.source?.trim(),
    };

    if (!nextDraft.title || !nextDraft.question || !nextDraft.answer) {
      setStatus("Title, question va answer la bat buoc");
      return;
    }

    if (isFirebaseConfigured) {
      const { createQuestion } = await import("./lib/firebase");
      await createQuestion(nextDraft);
      setStatus("Saved to Firestore");
    } else {
      const created = saveLocalQuestion(nextDraft);
      setQuestions(loadLocalQuestions());
      setSelectedId(created.id);
      setStatus("Saved locally");
    }

    setDraft(emptyDraft);
    setTagInput("");
    setShowForm(false);
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

  function resetFilters() {
    setSearch("");
    setCategory("All");
    setRole("All");
    setLevel("All");
  }

  const hasFilters = Boolean(search) || category !== "All" || role !== "All" || level !== "All";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="eyebrow">Interview Handbook</p>
            <h1>Practice questions, organized.</h1>
          </div>
        </div>

        <div className="header-actions">
          <span className={isFirebaseConfigured ? "status online" : "status"}>
            <Database size={16} aria-hidden="true" />
            {status}
          </span>
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}>
            <Plus size={18} aria-hidden="true" />
            New question
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Question summary">
        <div className="summary-item">
          <span>{questions.length}</span>
          <p>Total questions</p>
        </div>
        <div className="summary-item">
          <span>{filteredQuestions.length}</span>
          <p>Current view</p>
        </div>
        <div className="summary-item">
          <span>{favoriteQuestions}</span>
          <p>Favorites</p>
        </div>
      </section>

      <section className="toolbar" aria-label="Search and filters">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, question, answer, tag..."
          />
        </div>

        <div className="filter-grid">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>All</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option>All</option>
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Level
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as QuestionLevel | "All")}
            >
              <option>All</option>
              {levels.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        {hasFilters && (
          <button className="icon-button" type="button" onClick={resetFilters} title="Clear filters">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </section>

      {showForm && (
        <section className="editor-panel" aria-label="Create question">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Create</p>
              <h2>Add interview question</h2>
            </div>
            <button className="icon-button" type="button" onClick={() => setShowForm(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form className="question-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Title
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="VD: React rendering flow"
                />
              </label>
              <label>
                Level
                <select
                  value={draft.level}
                  onChange={(event) =>
                    setDraft({ ...draft, level: event.target.value as QuestionLevel })
                  }
                >
                  {levels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <input
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  placeholder="Frontend"
                />
              </label>
              <label>
                Role
                <input
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                  placeholder="React Developer"
                />
              </label>
            </div>

            <label>
              Question
              <textarea
                value={draft.question}
                onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                rows={3}
                placeholder="Nhap cau hoi can on tap"
              />
            </label>

            <label>
              Answer
              <textarea
                value={draft.answer}
                onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
                rows={6}
                placeholder="Ghi dap an mong doi, y chinh, trade-off..."
              />
            </label>

            <div className="form-grid">
              <label>
                Tags
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="react, state, hooks"
                />
              </label>
              <label>
                Source
                <input
                  value={draft.source}
                  onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Save question
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="practice-layout">
        <section className="question-list-panel" aria-label="Questions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Questions</h2>
            </div>
            <span className="match-count">
              <Filter size={16} aria-hidden="true" />
              {filteredQuestions.length}
            </span>
          </div>

          {filteredQuestions.length ? (
            <div className="question-list">
              {filteredQuestions.map((item) => {
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
                        {item.category} / {item.level}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.question}</p>
                      <span className="meta-line">{item.role}</span>
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
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>{questions.length ? "No questions match your filters" : "No questions yet"}</h3>
              <p>
                {questions.length
                  ? "Try clearing filters or search with another keyword."
                  : "Add your first interview question to start building the handbook."}
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={questions.length ? resetFilters : () => setShowForm(true)}
              >
                {questions.length ? "Clear filters" : "New question"}
              </button>
            </div>
          )}
        </section>

        <section className="answer-panel" aria-label="Selected answer">
          {selectedQuestion ? (
            <>
              <div className="answer-panel__header">
                <div>
                  <p className="eyebrow">{selectedQuestion.role}</p>
                  <h2>{selectedQuestion.title}</h2>
                </div>
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

              <div className="answer-meta">
                <span>{selectedQuestion.category}</span>
                <span>{selectedQuestion.level}</span>
                <span>{selectedQuestion.source || "Manual"}</span>
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
                  Expected answer
                </div>
                <p>{selectedQuestion.answer}</p>
              </div>

              {selectedQuestion.tags.length > 0 && (
                <div className="tag-row">
                  {selectedQuestion.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileQuestion size={34} aria-hidden="true" />
              <h3>Select a question</h3>
              <p>Your answer notes will appear here.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
