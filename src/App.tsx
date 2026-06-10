import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Database,
  Filter,
  Github,
  Layers3,
  Plus,
  Search,
  Star,
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
  category: "Frontend",
  role: "React Developer",
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
        setQuestions(items.length ? items : loadLocalQuestions());
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
      category: draft.category.trim(),
      role: draft.role.trim(),
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

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Interview handbook toolbar">
        <div>
          <p className="eyebrow">Interview Handbook</p>
          <h1>Question bank for focused interview prep</h1>
        </div>

        <div className="topbar-actions">
          <span className={isFirebaseConfigured ? "status online" : "status"}>
            <Database size={16} aria-hidden="true" />
            {status}
          </span>
          <a
            className="icon-link"
            href="https://github.com/"
            title="Open GitHub"
            aria-label="Open GitHub"
          >
            <Github size={20} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar" aria-label="Filters">
          <div className="visual-panel" aria-hidden="true">
            <div className="visual-panel__label">
              <BookOpenCheck size={22} />
              Prep board
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric">
              <span>{questions.length}</span>
              <p>Total</p>
            </div>
            <div className="metric">
              <span>{favoriteQuestions}</span>
              <p>Saved</p>
            </div>
          </div>

          <div className="filter-title">
            <Filter size={18} aria-hidden="true" />
            Filters
          </div>

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
        </aside>

        <section className="question-column" aria-label="Questions">
          <div className="search-row">
            <div className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search question, answer, tag..."
              />
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={() => setShowForm((value) => !value)}
            >
              <Plus size={18} aria-hidden="true" />
              Add question
            </button>
          </div>

          {showForm && (
            <form className="question-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    placeholder="React rendering flow"
                  />
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
              </div>

              <label>
                Question
                <textarea
                  value={draft.question}
                  onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                  rows={3}
                  placeholder="What would you ask?"
                />
              </label>

              <label>
                Answer
                <textarea
                  value={draft.answer}
                  onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
                  rows={5}
                  placeholder="Expected answer, signals, trade-offs..."
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
                    placeholder="Internal notes"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save
                </button>
              </div>
            </form>
          )}

          <div className="results-meta">
            <Layers3 size={18} aria-hidden="true" />
            {filteredQuestions.length} matches
          </div>

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
                    <span className="pill">{item.level}</span>
                    <h2>{item.title}</h2>
                    <p>{item.question}</p>
                    <span className="meta-line">
                      {item.category} / {item.role}
                    </span>
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
        </section>

        <section className="answer-panel" aria-label="Selected answer">
          {selectedQuestion ? (
            <>
              <div className="answer-panel__header">
                <div>
                  <p className="eyebrow">{selectedQuestion.category}</p>
                  <h2>{selectedQuestion.title}</h2>
                </div>
                <button
                  className="star-button panel-star"
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

              <div className="answer-block">
                <div className="block-heading">
                  <ChevronDown size={18} aria-hidden="true" />
                  Question
                </div>
                <p>{selectedQuestion.question}</p>
              </div>

              <div className="answer-block answer">
                <div className="block-heading">
                  <ChevronUp size={18} aria-hidden="true" />
                  Expected answer
                </div>
                <p>{selectedQuestion.answer}</p>
              </div>

              <div className="tag-row">
                {selectedQuestion.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <dl className="detail-list">
                <div>
                  <dt>Role</dt>
                  <dd>{selectedQuestion.role}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{selectedQuestion.level}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedQuestion.source || "Manual"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="empty-state">No question matched.</div>
          )}
        </section>
      </section>
    </main>
  );
}
