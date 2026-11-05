import { useEffect, useMemo, useRef, useState } from "react";
import { exams, subjects, type ExamId, type Subject, type Topic } from "./data/topics";

const STORAGE_KEY = "yks-sayisal-v1";
const MAX_SOLVED = 99999;

type Entry = {
  lesson: boolean;
  solved: number;
};

type Progress = Record<string, Entry>;

const emptyEntry: Entry = { lesson: false, solved: 0 };

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeProgress(JSON.parse(raw));
  } catch {
    return {};
  }
}

function sanitizeProgress(value: unknown): Progress {
  if (!value || typeof value !== "object") return {};
  const source =
    "progress" in value && value.progress && typeof value.progress === "object"
      ? (value.progress as Record<string, unknown>)
      : (value as Record<string, unknown>);

  const next: Progress = {};
  for (const [key, item] of Object.entries(source)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<Entry>;
    const solvedRaw = Number(record.solved);
    const solved =
      Number.isFinite(solvedRaw) && solvedRaw > 0
        ? Math.min(MAX_SOLVED, Math.floor(solvedRaw))
        : 0;
    const lesson = Boolean(record.lesson);
    if (lesson || solved > 0) next[key] = { lesson, solved };
  }
  return next;
}

function readEntry(progress: Progress, id: string): Entry {
  return progress[id] ?? emptyEntry;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR").trim();
}

type Mode = "all" | "lesson" | "unsolved";

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [exam, setExam] = useState<ExamId>("tyt");
  const [subjectId, setSubjectId] = useState("all");
  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const examSubjects = useMemo(
    () => subjects.filter((subject) => subject.exam === exam),
    [exam],
  );

  const activeSubject =
    subjectId !== "all" && examSubjects.some((subject) => subject.id === subjectId)
      ? subjectId
      : "all";

  const stats = useMemo(() => {
    let lessons = 0;
    let solved = 0;
    let total = 0;
    for (const subject of subjects) {
      for (const topic of subject.topics) {
        total += 1;
        const entry = readEntry(progress, topic.id);
        if (entry.lesson) lessons += 1;
        solved += entry.solved;
      }
    }
    return { lessons, solved, total, left: total - lessons };
  }, [progress]);

  const visibleSubjects = useMemo(() => {
    const text = normalize(query);
    return examSubjects
      .filter((subject) => activeSubject === "all" || subject.id === activeSubject)
      .map((subject) => {
        const subjectMatch = text.length > 0 && normalize(subject.name).includes(text);
        const topics = subject.topics.filter((topic) => {
          const entry = readEntry(progress, topic.id);
          const matchesText = text.length === 0 || subjectMatch || normalize(topic.name).includes(text);
          if (!matchesText) return false;
          if (mode === "lesson") return !entry.lesson;
          if (mode === "unsolved") return entry.solved <= 0;
          return true;
        });
        return { subject, topics };
      })
      .filter((group) => group.topics.length > 0);
  }, [activeSubject, examSubjects, mode, progress, query]);

  function patch(id: string, update: Partial<Entry>) {
    setMessage("");
    setProgress((current) => {
      const previous = readEntry(current, id);
      const next = { ...previous, ...update };
      const copy = { ...current };
      if (!next.lesson && next.solved <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function setSolved(id: string, value: number) {
    const solved = Number.isFinite(value) ? Math.min(MAX_SOLVED, Math.max(0, Math.floor(value))) : 0;
    patch(id, { solved });
  }

  function downloadBackup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            savedAt: new Date().toISOString(),
            progress,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "yks-sayisal-yedek.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const next = sanitizeProgress(JSON.parse(await file.text()));
      setProgress(next);
      setMessage("Yedek yüklendi.");
    } catch {
      setMessage("Yedek dosyası okunamadı.");
    }
  }

  function resetProgress() {
    if (!window.confirm("Tüm konu anlatımı işaretleri ve soru sayıları silinsin mi?")) return;
    setProgress({});
    setMessage("İlerleme silindi.");
  }

  const examMeta = exams.find((item) => item.id === exam)!;
  const lessonRatio = stats.total === 0 ? 0 : Math.round((stats.lessons / stats.total) * 100);
  const examDone = examSubjects.reduce(
    (sum, subject) => sum + subject.topics.filter((topic) => readEntry(progress, topic.id).lesson).length,
    0,
  );
  const examTotal = examSubjects.reduce((sum, subject) => sum + subject.topics.length, 0);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <p>YKS Sayısal</p>
            <h1>Konu defteri</h1>
          </div>
        </div>

        <dl className="stats">
          <div>
            <dt>Konu anlatımı</dt>
            <dd>
              {formatNumber(stats.lessons)}
              <span>/{formatNumber(stats.total)}</span>
            </dd>
          </div>
          <div>
            <dt>Çözülen soru</dt>
            <dd>{formatNumber(stats.solved)}</dd>
          </div>
          <div>
            <dt>Kalan konu</dt>
            <dd>{formatNumber(stats.left)}</dd>
          </div>
        </dl>
        <div className="total-bar" aria-hidden="true">
          <span style={{ width: `${lessonRatio}%` }} />
        </div>
        <p className="save-note">Bu tarayıcıda saklanır.</p>

        <div className="exam-switch" role="tablist" aria-label="Sınav">
          {exams.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={exam === item.id}
              className={exam === item.id ? "on" : ""}
              onClick={() => {
                setExam(item.id);
                setSubjectId("all");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="exam-hint">{examMeta.hint}</p>

        <nav className="nav" aria-label="Ders">
          <button
            type="button"
            className={activeSubject === "all" ? "on" : ""}
            onClick={() => setSubjectId("all")}
          >
            <span className="nav-row">
              <span>Tüm dersler</span>
              <span>
                {examDone}/{examTotal}
              </span>
            </span>
          </button>
          {examSubjects.map((subject) => {
            const done = subject.topics.filter((topic) => readEntry(progress, topic.id).lesson).length;
            return (
              <button
                key={subject.id}
                type="button"
                className={activeSubject === subject.id ? "on" : ""}
                onClick={() => setSubjectId(subject.id)}
              >
                <span className="nav-row">
                  <span className="nav-name">
                    <i style={{ background: subject.color }} />
                    {subject.name}
                  </span>
                  <span>
                    {done}/{subject.topics.length}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <div className="filters">
          <div className="modes" role="group" aria-label="Liste süzgeci">
            <button type="button" className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>
              Hepsi
            </button>
            <button type="button" className={mode === "lesson" ? "on" : ""} onClick={() => setMode("lesson")}>
              Konu anlatımı eksik
            </button>
            <button
              type="button"
              className={mode === "unsolved" ? "on" : ""}
              onClick={() => setMode("unsolved")}
            >
              Soru yazılmamış
            </button>
          </div>
          <label className="search">
            <span className="sr">Konu ara</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Konu ara"
              type="search"
            />
          </label>
        </div>

        {visibleSubjects.length === 0 ? (
          <p className="empty">Bu süzgeçte konu yok.</p>
        ) : (
          visibleSubjects.map(({ subject, topics }) => (
            <SubjectBlock
              key={subject.id}
              subject={subject}
              topics={topics}
              progress={progress}
              onToggle={(id) => patch(id, { lesson: !readEntry(progress, id).lesson })}
              onSolved={setSolved}
            />
          ))
        )}

        <footer className="foot">
          {message ? <p className="message">{message}</p> : null}
          <div className="foot-actions">
            <button type="button" onClick={downloadBackup}>
              Yedek indir
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Yedek yükle
            </button>
            <button type="button" className="danger" onClick={resetProgress}>
              İlerlemeyi sil
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importBackup(file);
            }}
          />
        </footer>
      </main>
    </div>
  );
}

function SubjectBlock({
  subject,
  topics,
  progress,
  onToggle,
  onSolved,
}: {
  subject: Subject;
  topics: Topic[];
  progress: Progress;
  onToggle: (id: string) => void;
  onSolved: (id: string, value: number) => void;
}) {
  const done = subject.topics.filter((topic) => readEntry(progress, topic.id).lesson).length;
  const solved = subject.topics.reduce(
    (sum, topic) => sum + readEntry(progress, topic.id).solved,
    0,
  );
  const ratio = Math.round((done / subject.topics.length) * 100);

  return (
    <section className="subject" aria-labelledby={subject.id}>
      <header>
        <div className="subject-title">
          <i style={{ background: subject.color }} />
          <div>
            <h2 id={subject.id}>{subject.name}</h2>
            <p>{subject.weight}</p>
          </div>
        </div>
        <p className="subject-meta">
          <strong>
            {done}/{subject.topics.length}
          </strong>{" "}
          konu anlatımı
          <span>·</span>
          {formatNumber(solved)} soru
        </p>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${ratio}%` }} />
        </div>
        {subject.note ? <p className="subject-note">{subject.note}</p> : null}
      </header>
      <div className="colhead">
        <span>Konu</span>
        <span>Konu anlatımı</span>
        <span>Çözülen soru</span>
      </div>
      <ul>
        {topics.map((topic) => {
          const entry = readEntry(progress, topic.id);
          return (
            <li key={topic.id} className={entry.lesson ? "topic done" : "topic"}>
              <h3>{topic.name}</h3>
              <button
                type="button"
                className={entry.lesson ? "check on" : "check"}
                role="checkbox"
                aria-checked={entry.lesson}
                aria-label={`${topic.name} konu anlatımı`}
                onClick={() => onToggle(topic.id)}
              >
                <span className="box" aria-hidden="true">
                  {entry.lesson ? "✓" : ""}
                </span>
                Konu anlatımı
              </button>
              <div className="solved">
                <span className="solved-label">Çözülen soru</span>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`${topic.name} çözülen soruyu azalt`}
                    disabled={entry.solved <= 0}
                    onClick={() => onSolved(topic.id, entry.solved - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_SOLVED}
                    step={1}
                    placeholder="0"
                    aria-label={`${topic.name} çözülen soru sayısı`}
                    value={entry.solved === 0 ? "" : entry.solved}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") onSolved(topic.id, 0);
                      else onSolved(topic.id, Number(raw));
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`${topic.name} çözülen soruyu artır`}
                    disabled={entry.solved >= MAX_SOLVED}
                    onClick={() => onSolved(topic.id, entry.solved + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
