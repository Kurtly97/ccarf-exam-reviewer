const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ───────────────────────────── Utilities ─────────────────────────────

const HISTORY_KEY = "ccarf_history_v1";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function arraysEqualAsSets(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function isCorrect(question, selected) {
  return arraysEqualAsSets(question.correctAnswers, selected || []);
}

const WHY_NOT_MARKER = "Why not the others:";
const LEADING_LETTERS_RE = /^([A-E](?:\s*,\s*[A-E])*(?:\s*,?\s*and\s*[A-E])?)\b[,:]?\s*/i;
const PAREN_LETTERS_RE = /\(\s*([A-E](?:\s*,\s*[A-E])*(?:\s*,?\s*and\s*[A-E])?)\s*\)/i;

function extractLetters(str) {
  return str
    .split(/,|and/i)
    .map((s) => s.trim())
    .filter((s) => /^[A-E]$/i.test(s))
    .map((s) => s.toUpperCase());
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function parseRationale(rationaleText) {
  const markerIdx = rationaleText.indexOf(WHY_NOT_MARKER);
  if (markerIdx === -1) {
    return { explanation: rationaleText.trim(), bullets: [] };
  }

  const explanation = rationaleText.slice(0, markerIdx).trim();
  const tail = rationaleText.slice(markerIdx + WHY_NOT_MARKER.length).trim();
  const rawClauses = tail
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  const bullets = [];
  for (const clause of rawClauses) {
    const leadingMatch = clause.match(LEADING_LETTERS_RE);
    if (leadingMatch) {
      const letters = extractLetters(leadingMatch[1]);
      const text = capitalizeFirst(clause.slice(leadingMatch[0].length).trim());
      bullets.push({ letters, text });
      continue;
    }

    const parenMatch = clause.match(PAREN_LETTERS_RE);
    if (parenMatch) {
      const letters = extractLetters(parenMatch[1]);
      const text = capitalizeFirst(clause.replace(PAREN_LETTERS_RE, "").replace(/\s{2,}/g, " ").trim());
      bullets.push({ letters, text });
      continue;
    }

    if (bullets.length > 0) {
      bullets[bullets.length - 1].text = `${bullets[bullets.length - 1].text}; ${clause}`;
    } else {
      bullets.push({ letters: [], text: capitalizeFirst(clause) });
    }
  }

  return { explanation, bullets };
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function domainName(id) {
  const d = DOMAINS.find((d) => d.id === id);
  return d ? d.name : `Domain ${id}`;
}

function scenarioTitle(id) {
  const s = SCENARIOS.find((s) => s.id === id);
  return s ? s.title : `Scenario ${id}`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveAttempt(attempt) {
  try {
    const history = loadHistory();
    history.push(attempt);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    /* storage unavailable — continue without persistence */
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {}
}

function scoreSession(questions, answers) {
  const byDomain = {};
  const byScenario = {};
  const byTopic = {};
  const wrongIds = [];
  let correctCount = 0;

  for (const q of questions) {
    const selected = answers[q.id] || [];
    const ok = isCorrect(q, selected);
    if (ok) correctCount++;
    else wrongIds.push(q.id);

    byDomain[q.domainId] = byDomain[q.domainId] || { correct: 0, total: 0 };
    byDomain[q.domainId].total++;
    if (ok) byDomain[q.domainId].correct++;

    byScenario[q.scenarioId] = byScenario[q.scenarioId] || { correct: 0, total: 0 };
    byScenario[q.scenarioId].total++;
    if (ok) byScenario[q.scenarioId].correct++;

    byTopic[q.topicTag] = byTopic[q.topicTag] || { correct: 0, total: 0 };
    byTopic[q.topicTag].total++;
    if (ok) byTopic[q.topicTag].correct++;
  }

  return {
    total: questions.length,
    correctCount,
    scorePct: questions.length ? Math.round((correctCount / questions.length) * 1000) / 10 : 0,
    byDomain,
    byScenario,
    byTopic,
    wrongIds,
  };
}

function aggregateWeakTopics(history, minAttempts = 1) {
  const agg = {};
  for (const attempt of history) {
    for (const [tag, stat] of Object.entries(attempt.byTopic || {})) {
      agg[tag] = agg[tag] || { correct: 0, total: 0 };
      agg[tag].correct += stat.correct;
      agg[tag].total += stat.total;
    }
  }
  return Object.entries(agg)
    .map(([tag, s]) => ({ tag, ...s, pct: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .filter((t) => t.total >= minAttempts)
    .sort((a, b) => a.pct - b.pct);
}

function aggregateByDomainHistory(history) {
  const agg = {};
  for (const attempt of history) {
    for (const [domainId, stat] of Object.entries(attempt.byDomain || {})) {
      agg[domainId] = agg[domainId] || { correct: 0, total: 0 };
      agg[domainId].correct += stat.correct;
      agg[domainId].total += stat.total;
    }
  }
  return agg;
}

// ───────────────────────────── Small UI bits ─────────────────────────────

function ProgressBar({ pct, colorClass }) {
  return (
    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-2.5 rounded-full transition-all ${colorClass || "bg-teal-600"}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function scoreColor(pct) {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-600";
}

function barColor(pct) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

const SCALED_SCORE_MIN = 100;
const SCALED_SCORE_MAX = 1000;
const SCALED_SCORE_PASS = 700;

function scaledScore(pct) {
  return Math.round(SCALED_SCORE_MIN + (pct / 100) * (SCALED_SCORE_MAX - SCALED_SCORE_MIN));
}

function Pill({ children, className }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function RationaleBlock({ rationale, isCorrect, meta }) {
  const { explanation, bullets } = useMemo(() => parseRationale(rationale), [rationale]);
  const boxCls = isCorrect ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200";
  const badgeCls = isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";

  return (
    <div className={`border rounded-lg p-4 text-sm text-slate-700 ${boxCls}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-slate-800">Rationale</p>
        <Pill className={badgeCls}>{isCorrect ? "✓ Correct" : "✗ Incorrect"}</Pill>
      </div>

      <p className="whitespace-pre-wrap leading-relaxed">{explanation}</p>

      {bullets.length > 0 && (
        <div className="mt-3">
          <p className="font-medium text-slate-700 mb-1">Why other options are incorrect:</p>
          <ul className="space-y-1 list-disc pl-5">
            {bullets.map((b, i) => (
              <li key={i}>
                {b.letters.length > 0 && <span className="font-semibold mr-1">{b.letters.join(", ")} —</span>}
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta}
    </div>
  );
}

// ───────────────────────────── Home ─────────────────────────────

function Home({ history, onStart, onClearHistory }) {
  const weakTopics = useMemo(() => aggregateWeakTopics(history, 1).slice(0, 6), [history]);
  const domainAgg = useMemo(() => aggregateByDomainHistory(history), [history]);
  const totalAttempts = history.length;
  const lastAttempt = history[history.length - 1];

  const [scenarioPick, setScenarioPick] = useState(() => new Set());
  const [domainPick, setDomainPick] = useState(() => new Set());
  const [quickCount, setQuickCount] = useState(15);

  const officialQuestionCount = useMemo(
    () => QUESTIONS.filter((q) => OFFICIAL_SCENARIO_IDS.includes(q.scenarioId)).length,
    []
  );

  function toggleSet(setFn, current, id) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-teal-700 font-semibold tracking-wide text-sm uppercase">Claude Certified Architect — Foundations</p>
          <button
            onClick={onClearHistory}
            className="text-xs text-slate-400 hover:text-rose-500 underline shrink-0 mt-0.5"
            title="Permanently deletes all locally saved attempt history and progress stats from this browser."
          >
            Clear my data
          </button>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">CCAR-F Exam Reviewer</h1>
        <p className="text-slate-600 max-w-2xl">
          {QUESTIONS.length} practice questions across {SCENARIOS.length} scenarios, tagged by the {DOMAINS.length} official
          blueprint domains. Recommended target:
          <span className="font-semibold text-slate-800"> 75% or better in every domain.</span>
        </p>
        <p className="text-xs text-slate-400">
          All progress is stored only in this browser (localStorage) — nothing is sent to a server.
        </p>
      </header>

      {totalAttempts > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Your Progress</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">{totalAttempts}</div>
              <div className="text-xs text-slate-500">Attempts recorded</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className={`text-2xl font-bold ${scoreColor(lastAttempt.scorePct)}`}>{lastAttempt.scorePct}%</div>
              <div className="text-xs text-slate-500">Most recent score ({lastAttempt.title})</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">
                {Math.round(
                  (history.reduce((a, h) => a + h.scorePct, 0) / history.length) * 10
                ) / 10}%
              </div>
              <div className="text-xs text-slate-500">Average score across attempts</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Domain accuracy (lifetime)</h3>
          <div className="space-y-2 mb-5">
            {DOMAINS.map((d) => {
              const stat = domainAgg[d.id] || { correct: 0, total: 0 };
              const pct = stat.total ? Math.round((stat.correct / stat.total) * 100) : null;
              return (
                <div key={d.id} className="flex items-center gap-3 text-sm">
                  <div className="w-64 shrink-0 truncate text-slate-700">{d.name}</div>
                  <ProgressBar pct={pct || 0} colorClass={barColor(pct || 0)} />
                  <div className="w-24 text-right text-slate-600 shrink-0">
                    {pct === null ? "—" : `${pct}% (${stat.correct}/${stat.total})`}
                  </div>
                </div>
              );
            })}
          </div>

          {weakTopics.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Weakest topics</h3>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((t) => (
                  <Pill
                    key={t.tag}
                    className={
                      t.pct < 50
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : t.pct < 75
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }
                  >
                    {t.tag} — {t.pct}% ({t.correct}/{t.total})
                  </Pill>
                ))}
              </div>
              <button
                onClick={() => onStart(buildWeakTopicsSession(weakTopics))}
                className="mt-3 text-sm font-medium text-teal-700 hover:text-teal-900 underline"
              >
                Drill weakest topics →
              </button>
            </div>
          )}
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <ModeCard
          title="Exam Simulation"
          badge="Timed · 120 min"
          description={`Mirrors the live exam: 4 scenarios drawn at random from the ${OFFICIAL_SCENARIO_IDS.length}, ~40 questions, one attempt at pace.`}
          action="Start simulation"
          onClick={() => onStart(buildExamSimulationSession())}
        />
        <ModeCard
          title="Full Practice Set"
          badge="Timed · 120 min"
          description={`All ${officialQuestionCount} questions across all ${OFFICIAL_SCENARIO_IDS.length} scenarios, shuffled, matching the live exam's 120-minute limit.`}
          action="Start full set"
          onClick={() => onStart(buildFullSetSession())}
        />
        <ModeCard
          title="Quick Practice"
          badge="Untimed · Instant feedback"
          description="A short, randomized set with immediate check-your-answer feedback after each question."
          action="Start quick practice"
          onClick={() => onStart(buildQuickSession(quickCount))}
          footer={
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Questions:</span>
              {[10, 15, 25].map((n) => (
                <button
                  key={n}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickCount(n);
                  }}
                  className={`px-2 py-0.5 rounded border ${
                    quickCount === n
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          }
        />
        <ModeCard
          title="Study / Review Mode"
          badge="No scoring"
          description="Browse every question with the answer and full rationale already shown — great for first-pass learning."
          action="Open study mode"
          onClick={() => onStart({ type: "study" })}
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Practice by Scenario</h2>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {SCENARIOS.map((s) => (
            <label
              key={s.id}
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer text-sm ${
                scenarioPick.has(s.id) ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={scenarioPick.has(s.id)}
                onChange={() => toggleSet(setScenarioPick, scenarioPick, s.id)}
              />
              <span>
                <span className="font-medium text-slate-800">Scenario {s.id}: {s.title}</span>
                <span className="block text-xs text-slate-500">{s.range}</span>
              </span>
            </label>
          ))}
        </div>
        <button
          disabled={scenarioPick.size === 0}
          onClick={() => onStart(buildScenarioSession([...scenarioPick]))}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-700"
        >
          Practice selected scenario{scenarioPick.size !== 1 ? "s" : ""} ({scenarioPick.size || 0})
        </button>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Practice by Blueprint Domain</h2>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {DOMAINS.map((d) => (
            <label
              key={d.id}
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer text-sm ${
                domainPick.has(d.id) ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={domainPick.has(d.id)}
                onChange={() => toggleSet(setDomainPick, domainPick, d.id)}
              />
              <span>
                <span className="font-medium text-slate-800">{d.name}</span>
                <span className="block text-xs text-slate-500">
                  {d.weight}% exam weight · {QUESTIONS.filter((q) => q.domainId === d.id).length} questions in bank
                </span>
              </span>
            </label>
          ))}
        </div>
        <button
          disabled={domainPick.size === 0}
          onClick={() => onStart(buildDomainSession([...domainPick]))}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-700"
        >
          Practice selected domain{domainPick.size !== 1 ? "s" : ""} ({domainPick.size || 0})
        </button>
      </section>

      <footer className="text-xs text-slate-400 text-center pb-4">
        Original practice questions by Matthew Purcell, written against the public CCAR-F exam guide. Not actual exam
        content; not affiliated with Anthropic.
      </footer>
    </div>
  );
}

function ModeCard({ title, badge, description, action, onClick, footer }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:border-teal-400 hover:shadow-md transition group flex flex-col"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-800 group-hover:text-teal-700">{title}</h3>
        <Pill className="bg-slate-100 text-slate-600">{badge}</Pill>
      </div>
      <p className="text-sm text-slate-500 flex-1">{description}</p>
      {footer && <div className="mt-3">{footer}</div>}
      <div className="mt-3 text-sm font-medium text-teal-700 group-hover:text-teal-900">{action} →</div>
    </div>
  );
}

// ───────────────────────────── Session builders ─────────────────────────────

const OFFICIAL_SCENARIO_IDS = [1, 2, 3, 4, 5, 6];

function buildExamSimulationSession() {
  const chosenScenarios = sample(OFFICIAL_SCENARIO_IDS, 4);
  const questions = shuffle(QUESTIONS.filter((q) => chosenScenarios.includes(q.scenarioId)));
  return {
    type: "quiz",
    mode: "exam",
    title: `Exam Simulation (Scenarios ${chosenScenarios.sort((a, b) => a - b).join(", ")})`,
    questions,
    timeLimitSec: 120 * 60,
  };
}

function buildFullSetSession() {
  const officialQuestions = QUESTIONS.filter((q) => OFFICIAL_SCENARIO_IDS.includes(q.scenarioId));
  return {
    type: "quiz",
    mode: "exam",
    title: `Full Practice Set (${officialQuestions.length} Questions)`,
    questions: shuffle(officialQuestions),
    timeLimitSec: 120 * 60,
  };
}

function buildQuickSession(n) {
  return {
    type: "quiz",
    mode: "practice",
    title: `Quick Practice (${n} Questions)`,
    questions: sample(QUESTIONS, n),
    timeLimitSec: null,
  };
}

function buildScenarioSession(scenarioIds) {
  return {
    type: "quiz",
    mode: "practice",
    title: `Scenario Practice: ${scenarioIds.map((id) => `#${id}`).join(", ")}`,
    questions: shuffle(QUESTIONS.filter((q) => scenarioIds.includes(q.scenarioId))),
    timeLimitSec: null,
  };
}

function buildDomainSession(domainIds) {
  return {
    type: "quiz",
    mode: "practice",
    title: `Domain Practice: ${domainIds.map((id) => domainName(id)).join(", ")}`,
    questions: shuffle(QUESTIONS.filter((q) => domainIds.includes(q.domainId))),
    timeLimitSec: null,
  };
}

function buildWeakTopicsSession(weakTopics) {
  const tags = new Set(weakTopics.map((t) => t.tag));
  return {
    type: "quiz",
    mode: "practice",
    title: "Weak Topics Drill",
    questions: shuffle(QUESTIONS.filter((q) => tags.has(q.topicTag))),
    timeLimitSec: null,
  };
}

function buildMissedSession(questions, title) {
  return {
    type: "quiz",
    mode: "practice",
    title: title || "Retake Missed Questions",
    questions: shuffle(questions),
    timeLimitSec: null,
  };
}

// ───────────────────────────── Quiz ─────────────────────────────

function Quiz({ session, onFinish, onExit }) {
  const { questions, mode, timeLimitSec, title } = session;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(() => new Set());
  const [checked, setChecked] = useState(() => new Set()); // practice mode: which questions have been "checked"
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const timerRef = useRef(null);

  const q = questions[index];
  const selected = answers[q.id] || [];
  const isMulti = q.type === "multi";
  const hasCheckedCurrent = checked.has(q.id);

  useEffect(() => {
    if (timeLimitSec == null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleOption(key) {
    setAnswers((prev) => {
      const cur = new Set(prev[q.id] || []);
      if (isMulti) {
        if (cur.has(key)) cur.delete(key);
        else cur.add(key);
      } else {
        cur.clear();
        cur.add(key);
      }
      return { ...prev, [q.id]: [...cur] };
    });
  }

  function toggleFlag() {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
  }

  function checkCurrent() {
    setChecked((prev) => new Set(prev).add(q.id));
  }

  function goTo(i) {
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
  }

  function finish() {
    clearInterval(timerRef.current);
    onFinish({ session, answers });
  }

  const answeredCount = Object.keys(answers).filter((id) => (answers[id] || []).length > 0).length;
  const unansweredRemaining = questions.length - answeredCount;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-xs text-slate-500">
            Question {index + 1} of {questions.length} · Scenario {q.scenarioId}: {scenarioTitle(q.scenarioId)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {timeLimitSec != null && (
            <Pill className={timeLeft < 300 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}>
              ⏱ {formatTime(timeLeft)}
            </Pill>
          )}
          <button onClick={onExit} className="text-xs text-slate-400 hover:text-rose-500 underline">
            Exit
          </button>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar pct={((index + 1) / questions.length) * 100} />
      </div>

      <div className="grid lg:grid-cols-[1fr_220px] gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <Pill className="bg-indigo-50 text-indigo-700">{domainName(q.domainId)}</Pill>
              <Pill className="bg-slate-100 text-slate-600">
                {isMulti ? `Select ${q.requiredSelections}` : "Select ONE"}
              </Pill>
            </div>
            <button
              onClick={toggleFlag}
              className={`text-xs px-2 py-1 rounded border ${
                flagged.has(q.id)
                  ? "bg-amber-100 border-amber-400 text-amber-700"
                  : "border-slate-300 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {flagged.has(q.id) ? "★ Flagged" : "☆ Flag for review"}
            </button>
          </div>

          <p className="text-slate-800 text-base leading-relaxed mb-5 whitespace-pre-wrap">{q.prompt}</p>

          <div className="space-y-2 mb-5">
            {q.options.map((opt) => {
              const isSel = selected.includes(opt.key);
              const showFeedback = mode === "practice" && hasCheckedCurrent;
              const isRight = q.correctAnswers.includes(opt.key);
              let cls = "border-slate-200 hover:bg-slate-50";
              if (showFeedback) {
                if (isRight) cls = "border-emerald-400 bg-emerald-50";
                else if (isSel && !isRight) cls = "border-rose-400 bg-rose-50";
              } else if (isSel) {
                cls = "border-teal-500 bg-teal-50";
              }
              return (
                <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer text-sm ${cls}`}>
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    className="mt-1"
                    checked={isSel}
                    disabled={showFeedback}
                    onChange={() => toggleOption(opt.key)}
                  />
                  <span>
                    <span className="font-semibold mr-1">{opt.key}.</span>
                    {opt.text}
                  </span>
                  {showFeedback && isRight && <span className="ml-auto text-emerald-600 text-xs font-medium">Correct</span>}
                  {showFeedback && isSel && !isRight && <span className="ml-auto text-rose-600 text-xs font-medium">Your pick</span>}
                </label>
              );
            })}
          </div>

          {mode === "practice" && hasCheckedCurrent && (
            <div className="mb-4">
              <RationaleBlock
                rationale={q.rationale}
                isCorrect={isCorrect(q, selected)}
                meta={<p className="mt-2 text-xs text-slate-500">Topic: {q.topicTag}</p>}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
            >
              ← Previous
            </button>
            <div className="flex gap-2">
              {mode === "practice" && !hasCheckedCurrent && (
                <button
                  onClick={checkCurrent}
                  disabled={selected.length === 0}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm disabled:opacity-40"
                >
                  Check answer
                </button>
              )}
              {index < questions.length - 1 ? (
                <button
                  onClick={() => goTo(index + 1)}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Finish & Score
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit lg:sticky lg:top-4">
          <p className="text-xs text-slate-500 mb-2">
            {answeredCount}/{questions.length} answered
            {unansweredRemaining > 0 ? ` · ${unansweredRemaining} remaining` : ""}
          </p>
          <div className="grid grid-cols-6 lg:grid-cols-5 gap-1.5 mb-4">
            {questions.map((qq, i) => {
              const ans = (answers[qq.id] || []).length > 0;
              const isCur = i === index;
              const isFlag = flagged.has(qq.id);
              const isGraded = mode === "practice" && checked.has(qq.id);
              let cls = "bg-slate-100 text-slate-600";
              if (ans) cls = "bg-teal-100 text-teal-800";
              if (isGraded) cls = isCorrect(qq, answers[qq.id]) ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
              if (isFlag) cls = "bg-amber-100 text-amber-800 ring-1 ring-amber-400";
              if (isCur) cls += " ring-2 ring-teal-600";
              return (
                <button key={qq.id} onClick={() => goTo(i)} className={`h-8 rounded text-xs font-medium ${cls}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={finish}
            className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Finish & Score
          </button>
        </aside>
      </div>
    </div>
  );
}

// ───────────────────────────── Results ─────────────────────────────

function Results({ result, onRetakeMissed, onHome }) {
  const { session, answers, score, attemptId } = result;
  const { questions } = session;
  const [showOnlyWrong, setShowOnlyWrong] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleQuestions = showOnlyWrong
    ? questions.filter((q) => score.wrongIds.includes(q.id))
    : questions;

  const scaled = scaledScore(score.scorePct);
  const scaledPass = scaled >= SCALED_SCORE_PASS;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500 mb-1">{session.title}</p>
        <div className={`text-5xl font-bold ${scoreColor(score.scorePct)}`}>{score.scorePct}%</div>
        <p className="text-slate-600 mt-2">
          {score.correctCount} of {score.total} correct
          {score.scorePct >= 75 ? " · 🎉 Meets the 75% target" : " · Below the 75% target"}
        </p>

        <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-sm text-slate-600">Scaled score:</span>
          <span className="text-sm font-bold text-slate-800">
            {scaled} / {SCALED_SCORE_MAX}
          </span>
          <Pill className={scaledPass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
            {scaledPass ? "Pass" : `Below ${SCALED_SCORE_PASS}`}
          </Pill>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
          Illustrative scaled score ({SCALED_SCORE_MIN}–{SCALED_SCORE_MAX} scale, informal {SCALED_SCORE_PASS} pass line) —
          not the official Anthropic scoring formula.
        </p>

        <div className="flex justify-center gap-3 mt-5 flex-wrap">
          <button onClick={onHome} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
            ← Back to home
          </button>
          {score.wrongIds.length > 0 && (
            <button
              onClick={() => onRetakeMissed(questions.filter((q) => score.wrongIds.includes(q.id)))}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700"
            >
              Retake the {score.wrongIds.length} missed question{score.wrongIds.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Score by Blueprint Domain</h2>
        <div className="space-y-2">
          {DOMAINS.map((d) => {
            const stat = score.byDomain[d.id];
            if (!stat) return null;
            const pct = Math.round((stat.correct / stat.total) * 100);
            return (
              <div key={d.id} className="flex items-center gap-3 text-sm">
                <div className="w-64 shrink-0 truncate text-slate-700">{d.name}</div>
                <ProgressBar pct={pct} colorClass={barColor(pct)} />
                <div className="w-28 text-right text-slate-600 shrink-0">
                  {pct}% ({stat.correct}/{stat.total})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Score by Scenario</h2>
        <div className="space-y-2">
          {SCENARIOS.map((s) => {
            const stat = score.byScenario[s.id];
            if (!stat) return null;
            const pct = Math.round((stat.correct / stat.total) * 100);
            return (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <div className="w-64 shrink-0 truncate text-slate-700">#{s.id} {s.title}</div>
                <ProgressBar pct={pct} colorClass={barColor(pct)} />
                <div className="w-28 text-right text-slate-600 shrink-0">
                  {pct}% ({stat.correct}/{stat.total})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Question Review</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showOnlyWrong} onChange={(e) => setShowOnlyWrong(e.target.checked)} />
            Show only missed
          </label>
        </div>
        <div className="space-y-2">
          {visibleQuestions.map((q) => {
            const selectedAns = answers[q.id] || [];
            const ok = isCorrect(q, selectedAns);
            const isOpen = expanded.has(q.id);
            return (
              <div key={q.id} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() => toggleExpand(q.id)}
                  className="w-full flex items-center justify-between gap-3 p-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className={ok ? "text-emerald-600" : "text-rose-600"}>{ok ? "✓" : "✗"}</span>
                    <span className="font-medium text-slate-700">Q{q.id}</span>
                    <span className="text-slate-500 truncate max-w-md">{q.prompt.slice(0, 80)}{q.prompt.length > 80 ? "…" : ""}</span>
                  </span>
                  <span className="text-xs text-slate-400">{isOpen ? "Hide" : "Show"}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-sm">
                    <p className="text-slate-800 mb-3 whitespace-pre-wrap">{q.prompt}</p>
                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt) => {
                        const isRight = q.correctAnswers.includes(opt.key);
                        const wasSel = selectedAns.includes(opt.key);
                        let cls = "border-slate-200";
                        if (isRight) cls = "border-emerald-400 bg-emerald-50";
                        else if (wasSel) cls = "border-rose-400 bg-rose-50";
                        return (
                          <div key={opt.key} className={`p-2 rounded border text-xs ${cls}`}>
                            <span className="font-semibold mr-1">{opt.key}.</span>
                            {opt.text}
                            {isRight && <span className="ml-2 text-emerald-600 font-medium">(correct)</span>}
                            {wasSel && !isRight && <span className="ml-2 text-rose-600 font-medium">(your answer)</span>}
                          </div>
                        );
                      })}
                    </div>
                    <RationaleBlock
                      rationale={q.rationale}
                      isCorrect={ok}
                      meta={
                        <p className="mt-2 text-xs text-slate-500">
                          Domain: {domainName(q.domainId)} · Topic: {q.topicTag}
                        </p>
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Study / Review Mode ─────────────────────────────

function StudyMode({ onExit }) {
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const filtered = QUESTIONS.filter((q) => {
    if (scenarioFilter !== "all" && q.scenarioId !== Number(scenarioFilter)) return false;
    if (domainFilter !== "all" && q.domainId !== Number(domainFilter)) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!q.prompt.toLowerCase().includes(s) && !q.topicTag.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-800">Study / Review Mode</h1>
        <button onClick={onExit} className="text-xs text-slate-400 hover:text-rose-500 underline">
          Exit
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm">
          <option value="all">All scenarios</option>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>#{s.id} {s.title}</option>
          ))}
        </select>
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm">
          <option value="all">All domains</option>
          {DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompt or topic…"
          className="border border-slate-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[180px]"
        />
        <span className="text-xs text-slate-400">{filtered.length} question{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2">
        {filtered.map((q) => {
          const isOpen = expanded.has(q.id);
          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-lg">
              <button onClick={() => toggleExpand(q.id)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                <span className="text-sm">
                  <span className="font-medium text-slate-700 mr-2">Q{q.id}</span>
                  <span className="text-slate-500">{q.prompt.slice(0, 90)}{q.prompt.length > 90 ? "…" : ""}</span>
                </span>
                <span className="text-xs text-slate-400 shrink-0 ml-2">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm">
                  <div className="flex gap-2 mb-2">
                    <Pill className="bg-indigo-50 text-indigo-700">{domainName(q.domainId)}</Pill>
                    <Pill className="bg-slate-100 text-slate-600">Scenario {q.scenarioId}</Pill>
                    <Pill className="bg-slate-100 text-slate-600">{q.topicTag}</Pill>
                  </div>
                  <p className="text-slate-800 mb-3 whitespace-pre-wrap">{q.prompt}</p>
                  <div className="space-y-1.5 mb-3">
                    {q.options.map((opt) => {
                      const isRight = q.correctAnswers.includes(opt.key);
                      return (
                        <div key={opt.key} className={`p-2 rounded border text-xs ${isRight ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                          <span className="font-semibold mr-1">{opt.key}.</span>
                          {opt.text}
                          {isRight && <span className="ml-2 text-emerald-600 font-medium">(correct)</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="font-semibold text-slate-800 mb-1">Rationale</p>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{q.rationale}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────── App root ─────────────────────────────

function App() {
  const [view, setView] = useState("home"); // 'home' | 'quiz' | 'results' | 'study'
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());

  function startSession(s) {
    if (s.type === "study") {
      setView("study");
      return;
    }
    setSession(s);
    setView("quiz");
  }

  function finishQuiz({ session, answers }) {
    const score = scoreSession(session.questions, answers);
    const attempt = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: session.mode,
      title: session.title,
      totalQuestions: score.total,
      correctCount: score.correctCount,
      scorePct: score.scorePct,
      byDomain: score.byDomain,
      byScenario: score.byScenario,
      byTopic: score.byTopic,
      wrongIds: score.wrongIds,
    };
    saveAttempt(attempt);
    setHistory(loadHistory());
    setResult({ session, answers, score, attemptId: attempt.id });
    setView("results");
  }

  function goHome() {
    setView("home");
    setSession(null);
    setResult(null);
  }

  function retakeMissed(questions) {
    startSession(buildMissedSession(questions, `Retake: ${result?.session?.title || "Missed Questions"}`));
  }

  function clearAllHistory() {
    if (confirm("Clear all saved attempt history on this device?")) {
      clearHistory();
      setHistory([]);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {view === "home" && <Home history={history} onStart={startSession} onClearHistory={clearAllHistory} />}
      {view === "quiz" && session && <Quiz session={session} onFinish={finishQuiz} onExit={goHome} />}
      {view === "results" && result && <Results result={result} onRetakeMissed={retakeMissed} onHome={goHome} />}
      {view === "study" && <StudyMode onExit={goHome} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
