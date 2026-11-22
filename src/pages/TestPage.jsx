
import { useEffect, useMemo,useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "./TestPage.css";

export default function TestPage() {
  const { testId, passageNumber } = useParams();
  const navigate = useNavigate();
  const isFull = passageNumber === undefined;

  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(60 * 60);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [split, setSplit] = useState(50);
  const [fontSize, setFontSize] = useState("medium");
  const [theme, setTheme] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [started, setStarted] = useState(false);
  const [markedWords, setMarkedWords] = useState([]);
  const [markMenu, setMarkMenu] = useState(null);

  const [warningCount, setWarningCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const awayRef = useRef(false);
  const warningCountRef = useRef(0);
  const submitTestRef = useRef(null);
  
  const passages = test?.passages || [];

  const questions = useMemo(
    () =>
      passages.flatMap((passage) =>
        (passage.question_groups || []).flatMap((group) =>
          (group.questions || []).map((question) => ({
            ...question,
            group,
            passage,
          }))
        )
      ),
    [passages]
  );

  const answeredCount = questions.filter(
    (q) => String(answers[q.id] ?? "").trim() !== ""
  ).length;

  async function handleStartTest() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen ochilmadi:", err);
    }

    // Countdown faqat foydalanuvchi Start Test tugmasini
    // bosgandan keyin boshlanadi.
    setCountdown(1);
  }

  useEffect(() => {
    if (loading || !test || result || started || countdown === 0) return;

    if (countdown < 4) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev + 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setStarted(true);
      setCountdown(null);
    }, 800);

    return () => clearTimeout(timer);
  }, [loading, test, result, started, countdown]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (
        event.key === "F12" ||
        event.key === "F5" ||
        (event.ctrlKey && key === "r") ||
        (event.ctrlKey && event.shiftKey && key === "r")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  function scrollToQuestion(questionId) {
    document.getElementById(`q-${questionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
  function handlePassageContextMenu(event, passage) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    const readingText = event.currentTarget;

    event.preventDefault();

    // Tanlangan so'z matn ichida bo'lishi kerak
    if (
      selectedText &&
      selection.rangeCount > 0 &&
      readingText.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      const range = selection.getRangeAt(0);

      // Bitta matn bo'lagidan tanlangan bo'lsin
      if (
        range.startContainer === range.endContainer &&
        range.startContainer.nodeType === Node.TEXT_NODE
      ) {
        const textNode = range.startContainer;
        const parent = textNode.parentElement;

        // Faqat oddiy passage matni; mark ichidagi matn emas
        if (parent?.closest(".marked-word")) {
          setMarkMenu({
            x: event.clientX,
            y: event.clientY,
            action: "remove",
            markId: parent.closest(".marked-word").dataset.markId,
          });
          return;
        }

        setMarkMenu({
          x: event.clientX,
          y: event.clientY,
          action: "mark",
          passageId: passage.id,
          start: range.startOffset,
          end: range.endOffset,
          text: textNode.textContent,
          selectedText,
        });
        return;
      }
    }

    // Belgilangan so'z ustiga o'ng tugma bosilganda Remove
    const markedElement = event.target.closest(".marked-word");

    if (markedElement) {
      setMarkMenu({
        x: event.clientX,
        y: event.clientY,
        action: "remove",
        markId: markedElement.dataset.markId,
      });
    } else {
      setMarkMenu(null);
    }
  }

  function addMark() {
    if (!markMenu || markMenu.action !== "mark") return;

    const { passageId, start, end, text, selectedText } = markMenu;

    // Faqat tanlangan matnni belgilash
    const selected = text.slice(start, end);

    if (selected.trim() !== selectedText) {
      setMarkMenu(null);
      return;
    }

    setMarkedWords((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        passageId,
        start,
        end,
        text: selected,
      },
    ]);

    window.getSelection()?.removeAllRanges();
    setMarkMenu(null);
  }

  function removeMark() {
    if (!markMenu?.markId) return;

    setMarkedWords((prev) =>
      prev.filter((mark) => mark.id !== markMenu.markId)
    );

    setMarkMenu(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTest() {
      setLoading(true);
      setError("");

      try {
        let data;
        let duration;

        if (isFull) {
          const response = await api.get(
            `reading/tests/${testId}/full/`
          );
          data = response.data;
          duration = data.duration_minutes || 60;
        } else {
          const response = await api.get(
            `reading/tests/${testId}/`
          );

          const selected = response.data.passages?.find(
            (p) => Number(p.number) === Number(passageNumber)
          );

          if (!selected) {
            throw new Error("Bu passage topilmadi.");
          }

          data = {
            ...response.data,
            passages: [selected],
          };

          duration = selected.duration_minutes || 20;
        }

        if (cancelled) return;

        setTest(data);
        setRemaining(duration * 60);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              err.message ||
              "Testni yuklashda xatolik yuz berdi."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTest();

    return () => {
      cancelled = true;
    };
  }, [testId, passageNumber, isFull]);

  function renderPassageText(passage) {
    const marks = markedWords
      .filter((mark) => mark.passageId === passage.id)
      .sort((a, b) => a.start - b.start);

    const content = passage.content || [];
    const text = String(content);

    const parts = [];
    let cursor = 0;

    marks.forEach((mark) => {
      // Ustma-ust belgilarni o'tkazib yuborish
      if (mark.start < cursor || mark.end > text.length) return;

      parts.push(text.slice(cursor, mark.start));

      parts.push(
        <mark
          key={mark.id}
          className="marked-word"
          data-mark-id={mark.id}
        >
          {text.slice(mark.start, mark.end)}
        </mark>
      );

      cursor = mark.end;
    });

    parts.push(text.slice(cursor));

    return parts;
  }

  useEffect(() => {
    if (!started || loading || result || remaining <= 0) return;

    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [started, loading, result, remaining > 0]);


  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  async function submitTest() {
    if (submitting || result || !test) return;

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        answers,
        ...(isFull
          ? { test_id: Number(testId) }
          : { passage_id: passages[0].id }),
      };

      const response = await api.post(
        "reading/submit/",
        payload
      );

      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Natijani saqlashda xatolik yuz berdi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Har renderda eng so'nggi submit funksiyasini saqlaymiz
  submitTestRef.current = submitTest;

  useEffect(() => {
    // Test boshlanmaguncha tashqariga chiqish/fullscreen warning
    // hisoblanmaydi.
    if (loading || result || !test || !started) return;

    function warnUser(reason = "tab") {
      // blur, visibilitychange va fullscreenchange bir hodisa uchun
      // ikkita ogohlantirish bermasligi kerak.
      if (awayRef.current) return;

      awayRef.current = true;

      const nextCount = warningCountRef.current + 1;

      warningCountRef.current = nextCount;
      setWarningCount(nextCount);

      if (nextCount === 1) {
        setWarningMessage(
          reason === "fullscreen"
            ? "Test vaqtida fullscreen rejimidan chiqish mumkin emas. Iltimos, fullscreen rejimiga qayting va testni davom ettiring."
            : "Iltimos, test vaqtida boshqa tab yoki oynalarga o'tmang. Tashqi omillardan foydalanmang!"
        );
        setShowWarning(true);
        return;
      }

      setWarningMessage(
        "Ikkinchi ogohlantirish qayd etildi. Test avtomatik topshirilmoqda."
      );
      setShowWarning(true);

      // Ikkinchi ogohlantirishda avtomatik topshirish
      submitTestRef.current?.();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        warnUser("tab");
      } else if (document.hasFocus()) {
        awayRef.current = false;
      }
    }

    function handleBlur() {
      warnUser("tab");
    }

    function handleFocus() {
      if (!document.hidden && document.fullscreenElement) {
        awayRef.current = false;
      }
    }

    function handleFullscreenChange() {
      // Foydalanuvchi ESC yoki browser controls orqali
      // fullscreen'dan chiqsa warning beramiz.
      if (!document.fullscreenElement) {
        warnUser("fullscreen");
      } else {
        awayRef.current = false;
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loading, result, test, started]);

  useEffect(() => {
    if (result && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [result]);

  if (loading) return <p>Test yuklanmoqda...</p>;
  if (error && !test) return <p>{error}</p>;
  if (!test) return <p>Test topilmadi.</p>;

  if (result && !reviewing) {
    return (
      <main className="res-page">
        <div className="res-card">
          <div className="res-success-icon">✓</div>

          <p className="res-eyebrow">IELTS READING</p>
          <h1>Test yakunlandi!</h1>
          <p className="res-subtitle">
            Ajoyib! Test natijangiz saqlandi.
          </p>

          <div className="res-score">
            <span>{result.score}</span>
            <span className="res-score-divider">/</span>
            <span>{result.max_score}</span>
          </div>

          <div className="res-progress-track">
            <div
              className="res-progress-fill"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, Number(result.percentage) || 0)
                )}%`,
              }}
            />
          </div>

          <div className="res-percentage">
            {result.percentage}% <span>natija</span>
          </div>

          <div className="res-saved">
            {Number(result.score) >= 1 && Number(result.score) <= 6
              ? "Ko‘proq mashq qiling, marra sizniki!"
              : Number(result.score) >= 7 && Number(result.score) <= 10
                ? "Yanada yaxshiroq harakat qiling, deyarli g‘olibsiz!"
                : Number(result.score) >= 11 && Number(result.score) <= 13
                  ? "Ajoyib, siz oldindasiz!"
                  : "Natija bazaga muvaffaqiyatli saqlandi"}
          </div>

          <div className="res-actions">
            <button
              className="res-review-button"
              onClick={() => setReviewing(true)}
            >
              <span>⌕</span>
              Review my answers
              <span className="res-review-arrow">→</span>
            </button>

            <button
              className="res-dashboard-button"
              onClick={() => navigate("/dashboard")}
            >
              ← Return to dashboard
            </button>
          </div>

          <p className="res-footer-text">
            Natijalaringizni ko‘rib chiqing va xatolaringizdan o‘rganing.
          </p>
        </div>
      </main>
    );
  }

  
  return (
    <main className={`cdi-app ${theme} ${reviewing ? "review-mode" : ""}`}>
      {!started && (
        <div className="countdown-overlay">
          {countdown === 0 ? (
            <div className="countdown-content">
              <div className="countdown-label">READY?</div>

              <div className="countdown-number">IELTS</div>

              <p>
                Test boshlanadi va avtomatik ravishda to'liq ekran rejimiga o'tadi!
              </p>

              <button
                type="button"
                className="start-test-button"
                onClick={handleStartTest}
              >
                Start Test →
              </button>
            </div>
          ) : (
            <div className="countdown-content" key={countdown}>
              <div className="countdown-label">GET READY</div>

              <div className="countdown-number">
                {countdown <= 3 ? countdown : "GO!"}
              </div>

              <p>
                {countdown <= 3
                  ? "Your test is about to begin..."
                  : "GOOD LUCK!"}
              </p>
            </div>
          )}
        </div>
      )}
      <header className="cdi-header">
        <div className="cdi-brand">
          <span className="brand-mark">EC</span>
          <strong>EnglishCentercds</strong>
          <span className="test-mode">
            {isFull ? "Full Reading" : `Passage ${passageNumber}`}
          </span>
        </div>

        <div className="cdi-header-right">
          <div className={`cdi-clock ${remaining < 300 ? "urgent" : ""}`}>
            <span className="clock-label">TIME REMAINING</span>
            <strong>{formatTime(remaining)}</strong>
          </div>

          <button
            className="settings-button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            aria-label="Open settings"
          >
            ⚙ <span>Settings</span>
          </button>

          {settingsOpen && (
            <div className="settings-menu">
              <h3>Display settings</h3>

              <label>Reading text size</label>
              <div className="setting-options">
                {[
                  ["small", "A− Small"],
                  ["medium", "A Medium"],
                  ["large", "A+ Large"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={fontSize === value ? "selected" : ""}
                    onClick={() => setFontSize(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label>Appearance</label>
              <div className="setting-options">
                <button
                  className={theme === "light" ? "selected" : ""}
                  onClick={() => setTheme("light")}
                >
                  ☀ Light
                </button>
                <button
                  className={theme === "dark" ? "selected" : ""}
                  onClick={() => setTheme("dark")}
                >
                  ☾ Dark
                </button>
              </div>

              <button
                className="settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                Close settings
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <div className="cdi-error">{error}</div>}

      <div className="cdi-workspace">
        <section
          className="reading-pane"
          style={{ width: `${split}%` }}
        >
          {passages.map((passage) => (
            <article className="reading-content" key={passage.id}>
              <div className="pane-heading">
                <span>READING PASSAGE {passage.number}</span>
                <span className="pane-count">Text</span>
              </div>

              <h2>{passage.title}</h2>

              <div
                className={`reading-text font-${fontSize}`}
                onContextMenu={(event) =>
                  handlePassageContextMenu(event, passage)
                }
              >
                {renderPassageText(passage)}
              </div>
            </article>
          ))}
        </section>

        <div
          className="pane-divider"
          role="separator"
          aria-label="Resize reading and questions panels"
          aria-orientation="vertical"
          title="Drag to resize panels"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.startX = String(event.clientX);
            event.currentTarget.dataset.startSplit = String(split);
            event.currentTarget.dataset.parentWidth = String(
              event.currentTarget.parentElement.getBoundingClientRect().width
            );
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

            const startX = Number(event.currentTarget.dataset.startX);
            const startSplit = Number(event.currentTarget.dataset.startSplit);
            const parentWidth = Number(
              event.currentTarget.dataset.parentWidth
            );

            if (!parentWidth) return;

            const delta = ((event.clientX - startX) / parentWidth) * 100;
            setSplit(Math.min(75, Math.max(25, startSplit + delta)));
          }}
        >
          <span>⋮</span>
        </div>

        <section
          className="questions-pane"
          style={{ width: `${100 - split}%` }}
        >
          <div className="questions-content">
            <div className="pane-heading">
              <span>QUESTIONS</span>
              <span className="pane-count">
                {answeredCount} / {questions.length} answered
              </span>
            </div>

            {passages.map((passage) => (
              <div key={passage.id}>
                {(passage.question_groups || []).map((group) => (
                  <section className="cdi-question-group" key={group.id}>
                    <h3>{group.title || group.question_type}</h3>

                    {group.instructions && (
                      <p className="group-instructions">
                        {group.instructions}
                      </p>
                    )}

                    {group.questions.map((question) => (
                      <div
                        className="cdi-question"
                        key={question.id}
                      >
                        <label htmlFor={`q-${question.id}`}>
                          <span className="question-number">
                            {question.number}.
                          </span>
                          <span>{question.prompt}</span>
                        </label>

                        {question.options?.length > 0 ? (
                          <select
                            id={`q-${question.id}`}
                            value={answers[question.id] ?? ""}
                            disabled={reviewing}
                            onChange={(event) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select your answer</option>

                            {question.options.map((option, index) => {
                              const value =
                                typeof option === "string"
                                  ? option
                                  : String(
                                      option.value ?? option.label ?? ""
                                    );

                              const label =
                                typeof option === "string"
                                  ? option
                                  : String(
                                      option.label ?? option.value ?? ""
                                    );

                              return (
                                <option key={index} value={value}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            id={`q-${question.id}`}
                            type="text"
                            readOnly={reviewing}
                            value={answers[question.id] ?? ""}
                            onChange={(event) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                            placeholder="Type your answer..."
                          />
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="cdi-footer">
        <div className="question-navigation">
          <span className="navigation-label">Questions</span>

          <div className="question-number-list">
            {questions.map((question, index) => {
              const answered =
                String(answers[question.id] ?? "").trim() !== "";

              return (
                <button
                  key={question.id}
                  className={`question-nav-item ${answered ? "answered" : ""}`}
                  onClick={() => scrollToQuestion(question.id)}
                  title={`Question ${question.number}`}
                >
                  {question.number ?? index + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="footer-actions">
          <span className="footer-progress">
            {answeredCount}/{questions.length} completed
          </span>

          {reviewing ? (
          <button
            className="submit-test-button"
            onClick={() => setReviewing(false)}
          >
            ← Back to results
          </button>
        ) : (
          <button
            className="submit-test-button"
            onClick={submitTest}
            disabled={submitting || remaining === 0}
          >
            {submitting ? "Submitting..." : "Submit Test"}
            <span> →</span>
          </button>
        )}
        </div>
      </footer>
      {markMenu && (
  <>
    <div
      className="mark-menu-dismiss"
      onClick={() => setMarkMenu(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMarkMenu(null);
      }}
    />

    <div
      className="mark-context-menu"
      style={{
        left: Math.min(markMenu.x, window.innerWidth - 160),
        top: Math.min(markMenu.y, window.innerHeight - 100),
      }}
    >
      {markMenu.action === "mark" ? (
        <button onClick={addMark}>
          🖍 Mark
        </button>
      ) : (
        <button onClick={removeMark}>
          ✕ Remove
        </button>
      )}
    </div>
  </>
)}
    {showWarning && (
  <div className="warning-overlay">
    <div
      className={`warning-modal ${
        warningCount >= 2 ? "warning-danger" : ""
      }`}
    >
      <div className="warning-icon">
        {warningCount >= 2 ? "⛔" : "⚠️"}
      </div>

      <h2>
        {warningCount >= 2
          ? "Test yakunlanmoqda!"
          : "Diqqat! Ogohlantirish"}
      </h2>

      <p>{warningMessage}</p>

      <div className="warning-counter">
        Ogohlantirish: {warningCount}/2
      </div>

      {warningCount < 2 && (
        <button
          className="warning-confirm"
          onClick={() => setShowWarning(false)}
        >
          Tushundim, davom etish
        </button>
      )}
    </div>
  </div>
)}
    </main>
  );

}
