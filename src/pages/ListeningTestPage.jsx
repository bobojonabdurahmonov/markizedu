import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../api";
import "./ListeningTestPage.css";


const TOTAL_DURATION_MINUTES = 40;
const MAX_WARNINGS = 3;


const QUESTION_TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  multiple_answer: "Multiple Answer",
  sentence_completion: "Sentence Completion",
  note_completion: "Note Completion",
  table_completion: "Table Completion",
  summary_completion: "Summary Completion",
  form_completion: "Form Completion",
  matching: "Matching",
  map_labeling: "Map / Plan Labeling",
  short_answer: "Short Answer",
};


function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));

  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    secs
  ).padStart(2, "0")}`;
}


function getQuestionKey(question) {
  return String(question.id);
}


function getInitialAnswer(question) {
  const type = question?.group?.question_type;

  if (type === "multiple_answer") {
    return [];
  }

  return "";
}


function normalizeAnswer(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        String(item).trim().toLowerCase()
      )
      .sort();
  }

  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function answersEqual(userAnswer, correctAnswer) {
  const user = normalizeAnswer(userAnswer);
  const correct = normalizeAnswer(correctAnswer);

  return JSON.stringify(user) === JSON.stringify(correct);
}


export default function ListeningTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const warningTimerRef = useRef(null);
  const submittingRef = useRef(false);

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [answers, setAnswers] = useState({});
  const [currentSection, setCurrentSection] = useState(0);

  const [timeLeft, setTimeLeft] = useState(
    TOTAL_DURATION_MINUTES * 60
  );

  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);

  const [warning, setWarning] = useState("");
  const [warningCount, setWarningCount] = useState(0);

  const [darkMode, setDarkMode] = useState(
    () =>
      localStorage.getItem("listening_theme") === "dark"
  );


  // =========================================================
  // FETCH TEST
  // =========================================================

  useEffect(() => {
    let mounted = true;

    async function loadTest() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `listening/tests/${testId}/`
        );

        if (!mounted) {
          return;
        }

        const data = response.data;

        setTest(data);

        const duration = Number(
          data.duration_minutes ||
            data.duration ||
            TOTAL_DURATION_MINUTES
        );

        setTimeLeft(duration * 60);

        const initialAnswers = {};

        (data.sections || []).forEach((section) => {
          (section.question_groups || []).forEach(
            (group) => {
              (group.questions || []).forEach(
                (question) => {
                  initialAnswers[
                    getQuestionKey(question)
                  ] = getInitialAnswer({
                    ...question,
                    group,
                  });
                }
              );
            }
          );
        });

        setAnswers(initialAnswers);
      } catch (err) {
        console.error(err);

        if (!mounted) {
          return;
        }

        setError(
          err.response?.data?.detail ||
            "Listening testni yuklashda xatolik yuz berdi."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTest();

    return () => {
      mounted = false;
    };
  }, [testId]);


  // =========================================================
  // DARK MODE
  // =========================================================

  useEffect(() => {
    localStorage.setItem(
      "listening_theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);


  // =========================================================
  // QUESTIONS
  // =========================================================

  const allQuestions = useMemo(() => {
    if (!test) {
      return [];
    }

    const result = [];

    (test.sections || []).forEach((section) => {
      (section.question_groups || []).forEach(
        (group) => {
          (group.questions || []).forEach(
            (question) => {
              result.push({
                ...question,
                group,
                section,
              });
            }
          );
        }
      );
    });

    return result;
  }, [test]);


  const currentSectionData =
    test?.sections?.[currentSection] || null;


  const currentSectionQuestions = useMemo(() => {
    if (!currentSectionData) {
      return [];
    }

    const result = [];

    (currentSectionData.question_groups || [])
      .forEach((group) => {
        (group.questions || []).forEach(
          (question) => {
            result.push({
              ...question,
              group,
              section: currentSectionData,
            });
          }
        );
      });

    return result;
  }, [currentSectionData]);


  const answeredCount = useMemo(() => {
    return allQuestions.filter((question) => {
      const value =
        answers[getQuestionKey(question)];

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return String(value ?? "").trim() !== "";
    }).length;
  }, [allQuestions, answers]);


  const totalQuestions = allQuestions.length;


  const progress =
    totalQuestions > 0
      ? Math.round(
          (answeredCount / totalQuestions) * 100
        )
      : 0;


  // =========================================================
  // ANSWERS
  // =========================================================

  const setQuestionAnswer = useCallback(
    (questionId, value) => {
      setAnswers((prev) => ({
        ...prev,
        [String(questionId)]: value,
      }));
    },
    []
  );


  function handleMultipleAnswer(
    questionId,
    option,
    checked
  ) {
    setAnswers((prev) => {
      const key = String(questionId);

      const current = Array.isArray(prev[key])
        ? prev[key]
        : [];

      let next;

      if (checked) {
        next = [
          ...new Set([
            ...current,
            option,
          ]),
        ];
      } else {
        next = current.filter(
          (item) => item !== option
        );
      }

      return {
        ...prev,
        [key]: next,
      };
    });
  }


  // =========================================================
  // FULLSCREEN
  // =========================================================

  async function enterFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn(
        "Fullscreen ishlamadi:",
        err
      );
    }
  }


  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn(err);
    }
  }


  // =========================================================
  // WARNING SYSTEM
  // =========================================================

  const showWarning = useCallback(
    (message) => {
      setWarningCount((prev) => {
        const next = prev + 1;

        if (next >= MAX_WARNINGS) {
          return MAX_WARNINGS;
        }

        return next;
      });

      setWarning(message);

      clearTimeout(
        warningTimerRef.current
      );

      warningTimerRef.current =
        setTimeout(() => {
          setWarning("");
        }, 5000);
    },
    []
  );


  // =========================================================
  // SECURITY / FULLSCREEN
  // =========================================================

  useEffect(() => {
    if (!started || result) {
      return undefined;
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        showWarning(
          "Siz test sahifasidan chiqdingiz."
        );
      }
    }


    function handleFullscreenChange() {
      if (
        started &&
        !document.fullscreenElement
      ) {
        showWarning(
          "Fullscreen rejimidan chiqdingiz."
        );
      }
    }


    function handleKeyDown(event) {
      const key =
        String(event.key).toLowerCase();

      if (
        key === "f12" ||
        (event.ctrlKey &&
          ["r", "w"].includes(key)) ||
        (event.ctrlKey &&
          event.shiftKey &&
          ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "u")
      ) {
        event.preventDefault();

        showWarning(
          "Bu tugma test vaqtida ishlatilmaydi."
        );
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

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    started,
    result,
    showWarning,
  ]);


  // =========================================================
  // 3-WARNING AUTO SUBMIT
  // =========================================================

  useEffect(() => {
    if (
      warningCount >= MAX_WARNINGS &&
      started &&
      !result &&
      !submittingRef.current
    ) {
      handleSubmit(true);
    }
  }, [
    warningCount,
    started,
    result,
  ]);


  // =========================================================
  // TIMER
  // =========================================================

  useEffect(() => {
    if (
      !started ||
      result ||
      submitting
    ) {
      return undefined;
    }

    if (timeLeft <= 0) {
      return undefined;
    }

    const timer =
      setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }

          return prev - 1;
        });
      }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [
    started,
    result,
    submitting,
    timeLeft,
  ]);


  // =========================================================
  // AUTO SUBMIT TIME
  // =========================================================

  useEffect(() => {
    if (
      started &&
      !result &&
      timeLeft === 0 &&
      !submittingRef.current
    ) {
      handleSubmit(true);
    }
  }, [
    started,
    result,
    timeLeft,
  ]);


  // =========================================================
  // START
  // =========================================================

  async function handleStart() {
    setWarningCount(0);
    setWarning("");

    setStarted(true);

    await enterFullscreen();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      if (
        submittingRef.current ||
        result
      ) {
        return;
      }

      const confirmed =
        autoSubmit ||
        window.confirm(
          "Testni yakunlab, javoblarni yubormoqchimisiz?"
        );

      if (!confirmed) {
        return;
      }

      try {
        submittingRef.current = true;

        setSubmitting(true);
        setError("");

        const payload = {
          test_id: Number(testId),
          answers,
        };

        const response =
          await api.post(
            "listening/submit/",
            payload
          );

        setResult(response.data);
        setStarted(false);

        await exitFullscreen();

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.detail ||
            err.response?.data?.error ||
            "Javoblarni yuborishda xatolik yuz berdi."
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [
      answers,
      result,
      testId,
    ]
  );


  // =========================================================
  // PREVENT EXIT
  // =========================================================

  useEffect(() => {
    if (!started || result) {
      return undefined;
    }

    function beforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      beforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        beforeUnload
      );
    };
  }, [
    started,
    result,
  ]);


  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      clearTimeout(
        warningTimerRef.current
      );
    };
  }, []);


  // =========================================================
  // NAVIGATION
  // =========================================================

  function goToQuestion(question) {
    const element =
      document.getElementById(
        `question-${question.id}`
      );

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }


  function goToSection(index) {
    setCurrentSection(index);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  // =========================================================
  // QUESTION RENDER
  // =========================================================

  function renderQuestion(question) {
    const key =
      getQuestionKey(question);

    const type =
      question.group?.question_type ||
      "short_answer";

    const value =
      answers[key];

    const options =
      Array.isArray(question.options)
        ? question.options
        : [];


    if (type === "multiple_choice") {
      return (
        <div className="blt-answer-options">
          {options.map((option, index) => {
            const optionValue =
              typeof option === "string"
                ? option
                : option?.value ??
                  option?.label ??
                  String(option);

            const optionLabel =
              typeof option === "string"
                ? option
                : option?.label ??
                  option?.value ??
                  String(option);

            return (
              <label
                className={`blt-option ${
                  value === optionValue
                    ? "selected"
                    : ""
                }`}
                key={`${key}-${index}`}
              >
                <input
                  type="radio"
                  name={`question-${key}`}
                  value={optionValue}
                  checked={
                    value === optionValue
                  }
                  onChange={() =>
                    setQuestionAnswer(
                      question.id,
                      optionValue
                    )
                  }
                />

                <span className="blt-option-letter">
                  {String.fromCharCode(
                    65 + index
                  )}
                </span>

                <span>
                  {optionLabel}
                </span>
              </label>
            );
          })}
        </div>
      );
    }


    if (type === "multiple_answer") {
      const selected =
        Array.isArray(value)
          ? value
          : [];

      return (
        <div className="blt-answer-options">
          {options.map((option, index) => {
            const optionValue =
              typeof option === "string"
                ? option
                : option?.value ??
                  option?.label ??
                  String(option);

            const optionLabel =
              typeof option === "string"
                ? option
                : option?.label ??
                  option?.value ??
                  String(option);

            const checked =
              selected.includes(
                optionValue
              );

            return (
              <label
                className={`blt-option ${
                  checked
                    ? "selected"
                    : ""
                }`}
                key={`${key}-${index}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    handleMultipleAnswer(
                      question.id,
                      optionValue,
                      event.target.checked
                    )
                  }
                />

                <span className="blt-option-check">
                  {checked ? "✓" : ""}
                </span>

                <span>
                  {optionLabel}
                </span>
              </label>
            );
          })}
        </div>
      );
    }


    if (type === "matching") {
      if (options.length > 0) {
        return (
          <select
            className="blt-select"
            value={value || ""}
            onChange={(event) =>
              setQuestionAnswer(
                question.id,
                event.target.value
              )
            }
          >
            <option value="">
              Select an answer
            </option>

            {options.map(
              (option, index) => {
                const optionValue =
                  typeof option === "string"
                    ? option
                    : option?.value ??
                      option?.label ??
                      String(option);

                const optionLabel =
                  typeof option === "string"
                    ? option
                    : option?.label ??
                      option?.value ??
                      String(option);

                return (
                  <option
                    key={`${key}-${index}`}
                    value={optionValue}
                  >
                    {optionLabel}
                  </option>
                );
              }
            )}
          </select>
        );
      }

      return (
        <input
          className="blt-text-input"
          type="text"
          value={value || ""}
          onChange={(event) =>
            setQuestionAnswer(
              question.id,
              event.target.value
            )
          }
          placeholder="Your answer"
          autoComplete="off"
        />
      );
    }


    return (
      <input
        className="blt-text-input"
        type="text"
        value={value || ""}
        onChange={(event) =>
          setQuestionAnswer(
            question.id,
            event.target.value
          )
        }
        placeholder="Type your answer"
        autoComplete="off"
      />
    );
  }


  // =========================================================
  // RESULT
  // =========================================================

  if (result) {
    const score =
      Number(result.score || 0);

    const maxScore =
      Number(
        result.max_score ||
          totalQuestions ||
          0
      );

    const percentage =
      Number(
        result.percentage || 0
      );

    const resultItems =
      Array.isArray(
        result.results
      )
        ? result.results
        : [];

    return (
      <div
        className={`blt-page ${
          darkMode ? "dark" : ""
        }`}
      >
        <div className="blt-result-page">
          <div className="blt-result-card">

            <div className="blt-result-icon">
              ✓
            </div>

            <div className="blt-result-label">
              LISTENING TEST
            </div>

            <h1>
              Test yakunlandi
            </h1>

            <p className="blt-result-subtitle">
              Natijangiz saqlandi.
            </p>

            <div className="blt-score">
              <strong>
                {score}
              </strong>

              <span>
                / {maxScore}
              </span>
            </div>

            <div className="blt-percentage">
              {percentage}%
            </div>

            <div className="blt-result-actions">

              <button
                className="blt-primary-btn"
                onClick={() =>
                  setReviewMode(
                    (prev) => !prev
                  )
                }
              >
                {reviewMode
                  ? "Natijaga qaytish"
                  : "Javoblarni ko‘rish"}
              </button>

              <button
                className="blt-secondary-btn"
                onClick={() =>
                  navigate("/")
                }
              >
                Bosh sahifa
              </button>

            </div>
          </div>


          {reviewMode && (
            <div className="blt-review-card">

              <div className="blt-review-header">
                <span>
                  Javoblar
                </span>

                <h2>
                  Natijani tekshirish
                </h2>
              </div>


              <div className="blt-review-list">

                {allQuestions.map(
                  (question) => {
                    const questionId =
                      question.id;

                    const userAnswer =
                      answers[
                        String(
                          questionId
                        )
                      ];

                    const resultItem =
                      resultItems.find(
                        (item) =>
                          Number(
                            item.question_id
                          ) ===
                          Number(
                            questionId
                          )
                      );

                    const correct =
                      resultItem
                        ? Boolean(
                            resultItem.correct
                          )
                        : false;

                    const correctAnswer =
                      question.correct_answer;

                    return (
                      <div
                        className={`blt-review-item ${
                          correct
                            ? "correct"
                            : "incorrect"
                        }`}
                        key={
                          questionId
                        }
                      >

                        <div className="blt-review-top">

                          <span>
                            Question{" "}
                            {question.number}
                          </span>

                          <span>
                            {correct
                              ? "✓ Correct"
                              : "✕ Incorrect"}
                          </span>

                        </div>

                        <p>
                          {question.prompt}
                        </p>

                        <div className="blt-review-answer">
                          <span>
                            Your answer:
                          </span>

                          <strong>
                            {Array.isArray(
                              userAnswer
                            )
                              ? userAnswer.join(
                                  ", "
                                )
                              : String(
                                  userAnswer ||
                                    "No answer"
                                )}
                          </strong>
                        </div>

                        {correctAnswer !==
                          undefined && (
                          <div className="blt-review-answer">
                            <span>
                              Correct answer:
                            </span>

                            <strong>
                              {Array.isArray(
                                correctAnswer
                              )
                                ? correctAnswer.join(
                                    ", "
                                  )
                                : String(
                                    correctAnswer
                                  )}
                            </strong>
                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    );
  }


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div
        className={`blt-page ${
          darkMode ? "dark" : ""
        }`}
      >
        <div className="blt-loading">
          <div className="blt-spinner" />

          <p>
            Listening test yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }


  // =========================================================
  // ERROR
  // =========================================================

  if (error && !test) {
    return (
      <div
        className={`blt-page ${
          darkMode ? "dark" : ""
        }`}
      >
        <div className="blt-error-page">

          <div className="blt-error-card">

            <div className="blt-error-icon">
              !
            </div>

            <h2>
              Xatolik
            </h2>

            <p>
              {error}
            </p>

            <button
              className="blt-primary-btn"
              onClick={() =>
                navigate(-1)
              }
            >
              Orqaga
            </button>

          </div>
        </div>
      </div>
    );
  }


  // =========================================================
  // START PAGE
  // =========================================================

  if (!started) {
    return (
      <div
        className={`blt-page ${
          darkMode ? "dark" : ""
        }`}
      >

        <div className="blt-start-page">

          <header className="blt-topbar">

            <div className="blt-brand">

              <div className="blt-brand-mark">
                EC
              </div>

              <div className="blt-brand-text">
                <strong>
                  englishCenterCds
                </strong>

                <span>
                  Listening
                </span>
              </div>

            </div>


            <button
              className="blt-theme-btn"
              onClick={() =>
                setDarkMode(
                  (prev) => !prev
                )
              }
              type="button"
            >
              {darkMode
                ? "☀"
                : "☾"}
            </button>

          </header>


          <main className="blt-start-container">

            <div className="blt-start-card">

              <div className="blt-start-badge">
                IELTS LISTENING
              </div>

              <h1>
                {test?.title ||
                  "Listening Test"}
              </h1>

              {test?.description && (
                <p className="blt-description">
                  {test.description}
                </p>
              )}


              <div className="blt-start-info">

                <div>
                  <span>
                    Sections
                  </span>

                  <strong>
                    {test?.sections?.length ||
                      4}
                  </strong>
                </div>

                <div>
                  <span>
                    Questions
                  </span>

                  <strong>
                    {totalQuestions}
                  </strong>
                </div>

                <div>
                  <span>
                    Time
                  </span>

                  <strong>
                    40 min
                  </strong>
                </div>

              </div>


              <div className="blt-instructions">

                <h3>
                  Testni boshlashdan oldin
                </h3>

                <ul>
                  <li>
                    Testni boshlaganingizdan
                    keyin vaqt hisoblanadi.
                  </li>

                  <li>
                    Listening uchun bitta
                    umumiy audio fayl ishlatiladi.
                  </li>

                  <li>
                    Test davomida fullscreen
                    rejimida ishlaysiz.
                  </li>

                  <li>
                    Fullscreen'dan chiqish
                    3 ta ogohlantirishdan keyin
                    testni avtomatik yakunlaydi.
                  </li>

                  <li>
                    Javoblaringizni test
                    tugashidan oldin tekshiring.
                  </li>
                </ul>

              </div>


              {test?.audio_url ? (
                <div className="blt-audio-check">

                  <div className="blt-audio-title">

                    <div className="blt-audio-icon">
                      ♪
                    </div>

                    <div>
                      <strong>
                        Listening audio
                      </strong>

                      <span>
                        Test uchun yagona audio
                      </span>
                    </div>

                  </div>

                  <audio
                    controls
                    preload="metadata"
                    src={
                      test.audio_url
                    }
                  >
                    Brauzeringiz audio
                    elementini qo‘llab-quvvatlamaydi.
                  </audio>

                </div>
              ) : (
                <div className="blt-no-audio">
                  Audio fayl mavjud emas.
                </div>
              )}


              {error && (
                <div className="blt-inline-error">
                  {error}
                </div>
              )}


              <button
                className="blt-start-btn"
                onClick={handleStart}
                disabled={
                  !test?.audio_url
                }
              >
                <span>
                  Testni boshlash
                </span>

                <span>
                  →
                </span>
              </button>

            </div>
          </main>
        </div>
      </div>
    );
  }


  // =========================================================
  // TEST PAGE
  // =========================================================

  return (
    <div
      className={`blt-page ${
        darkMode ? "dark" : ""
      }`}
    >

      {/* ================================================= */}
      {/* TEST HEADER */}
      {/* ================================================= */}

      <header className="blt-testbar">

        <div className="blt-test-brand">

          <div className="blt-brand-mark">
            EC
          </div>

          <div className="blt-brand-text">
            <strong>
              englishCenterCds
            </strong>

            <span>
              Listening Test
            </span>
          </div>

        </div>


        <div className="blt-test-center">

          <div className="blt-test-title">
            {test?.title}
          </div>

          <div className="blt-progress-text">
            {answeredCount} /{" "}
            {totalQuestions} answered
          </div>

        </div>


        <div className="blt-test-actions">

          <div
            className={`blt-timer ${
              timeLeft <= 300
                ? "danger"
                : ""
            }`}
          >
            <span>
              ⏱
            </span>

            <strong>
              {formatTime(
                timeLeft
              )}
            </strong>
          </div>


          <button
            type="button"
            className="blt-theme-btn"
            onClick={() =>
              setDarkMode(
                (prev) =>
                  !prev
              )
            }
          >
            {darkMode
              ? "☀"
              : "☾"}
          </button>

        </div>

      </header>


      {/* ================================================= */}
      {/* WARNING MODAL */}
      {/* ================================================= */}

      {warning && warningCount < MAX_WARNINGS && (
        <div className="blt-warning-overlay">

          <div className="blt-warning-card">

            <div className="blt-warning-number">
              {warningCount}
            </div>

            <div className="blt-warning-badge">
              WARNING {warningCount}
            </div>

            <h2>
              Diqqat!
            </h2>

            <p>
              {warning}
            </p>

            <div className="blt-warning-text">
              Test vaqtida fullscreen
              rejimidan chiqish mumkin emas.
              <br />
              {MAX_WARNINGS -
                warningCount} ta
              imkoniyat qoldi.
            </div>

            <button
              type="button"
              className="blt-warning-btn"
              onClick={async () => {
                setWarning("");
                await enterFullscreen();
              }}
            >
              Testga qaytish
            </button>

          </div>
        </div>
      )}


      {/* ================================================= */}
      {/* 3-WARNING SCREEN */}
      {/* ================================================= */}

      {warningCount >= MAX_WARNINGS &&
        !result && (
          <div className="blt-warning-overlay">

            <div className="blt-warning-card blt-warning-final">

              <div className="blt-warning-number">
                3
              </div>

              <div className="blt-warning-badge">
                FINAL WARNING
              </div>

              <h2>
                Test yakunlanmoqda
              </h2>

              <p>
                Fullscreen rejimidan
                3-marta chiqdingiz.
              </p>

              <div className="blt-warning-text">
                Test xavfsizlik qoidalari
                sababli avtomatik yakunlanadi.
              </div>

              <div className="blt-warning-loading">
                Natija yuborilmoqda...
              </div>

            </div>
          </div>
        )}


      {/* ================================================= */}
      {/* PROGRESS */}
      {/* ================================================= */}

      <div className="blt-progress-bar">

        <div
          className="blt-progress-fill"
          style={{
            width: `${progress}%`,
          }}
        />

      </div>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <main className="blt-layout">

        {/* ================================================= */}
        {/* SIDEBAR */}
        {/* ================================================= */}

        <aside className="blt-sidebar">

          <div className="blt-sidebar-card">

            <div className="blt-sidebar-heading">

              <span>
                SECTIONS
              </span>

              <strong>
                {currentSection + 1}/
                {test?.sections?.length ||
                  4}
              </strong>

            </div>


            <div className="blt-section-list">

              {(test?.sections || [])
                .map(
                  (section, index) => {

                    const sectionQuestions =
                      [];

                    (
                      section.question_groups ||
                      []
                    ).forEach(
                      (group) => {
                        (
                          group.questions ||
                          []
                        ).forEach(
                          (question) => {
                            sectionQuestions.push(
                              question
                            );
                          }
                        );
                      }
                    );


                    const sectionAnswered =
                      sectionQuestions.filter(
                        (question) => {
                          const value =
                            answers[
                              getQuestionKey(
                                question
                              )
                            ];

                          if (
                            Array.isArray(
                              value
                            )
                          ) {
                            return (
                              value.length >
                              0
                            );
                          }

                          return (
                            String(
                              value ??
                                ""
                            ).trim() !==
                            ""
                          );
                        }
                      ).length;


                    return (
                      <button
                        type="button"
                        className={`blt-section-btn ${
                          currentSection ===
                          index
                            ? "active"
                            : ""
                        }`}
                        key={
                          section.id
                        }
                        onClick={() =>
                          goToSection(
                            index
                          )
                        }
                      >

                        <span className="blt-section-number">
                          {index + 1}
                        </span>

                        <span className="blt-section-info">

                          <strong>
                            {section.title ||
                              `Section ${
                                index +
                                1
                              }`}
                          </strong>

                          <small>
                            {
                              sectionQuestions.length
                            }{" "}
                            questions
                          </small>

                        </span>

                        <span className="blt-section-check">
                          {sectionAnswered ===
                            sectionQuestions.length &&
                          sectionQuestions.length >
                            0
                            ? "✓"
                            : sectionAnswered}
                        </span>

                      </button>
                    );
                  }
                )}

            </div>


            <div className="blt-sidebar-progress">

              <div className="blt-sidebar-progress-header">
                <span>
                  Progress
                </span>

                <strong>
                  {progress}%
                </strong>
              </div>

              <div className="blt-mini-progress">
                <div
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

            </div>

          </div>


          {/* AUDIO */}

          <div className="blt-sidebar-audio">

            <div className="blt-audio-small-title">

              <div className="blt-audio-small-icon">
                ♪
              </div>

              <div>
                <strong>
                  Listening Audio
                </strong>

                <small>
                  One audio for all sections
                </small>
              </div>

            </div>


            <audio
              ref={audioRef}
              controls
              preload="metadata"
              src={
                test?.audio_url
              }
            />

          </div>

        </aside>


        {/* ================================================= */}
        {/* CONTENT */}
        {/* ================================================= */}

        <section className="blt-content">

          {currentSectionData && (
            <div className="blt-section-header">

              <div>

                <span className="blt-section-label">
                  SECTION{" "}
                  {currentSectionData.number ||
                    currentSection +
                      1}
                </span>

                <h1>
                  {currentSectionData.title ||
                    `Section ${
                      currentSection +
                      1
                    }`}
                </h1>

                {currentSectionData.instructions && (
                  <p>
                    {
                      currentSectionData.instructions
                    }
                  </p>
                )}

              </div>

              <div className="blt-section-counter">
                {currentSection +
                  1}{" "}
                /{" "}
                {test?.sections?.length ||
                  4}
              </div>

            </div>
          )}


          {error && (
            <div className="blt-inline-error">
              {error}
            </div>
          )}


          {/* GROUPS */}

          <div className="blt-question-groups">

            {(
              currentSectionData?.question_groups ||
              []
            ).map(
              (group) => {

                const groupQuestions =
                  currentSectionQuestions.filter(
                    (question) =>
                      question.group.id ===
                      group.id
                  );

                return (
                  <div
                    className="blt-group-card"
                    key={
                      group.id
                    }
                  >

                    <div className="blt-group-header">

                      <div>

                        <span className="blt-group-type">
                          {QUESTION_TYPE_LABELS[
                            group.question_type
                          ] ||
                            group.question_type}
                        </span>

                        <h2>
                          {group.title ||
                            "Questions"}
                        </h2>

                      </div>

                      <div className="blt-group-count">
                        {
                          groupQuestions.length
                        }{" "}
                        questions
                      </div>

                    </div>


                    {group.instructions && (
                      <div className="blt-group-instructions">

                        <strong>
                          Instructions
                        </strong>

                        <p>
                          {
                            group.instructions
                          }
                        </p>

                      </div>
                    )}


                    <div className="blt-questions">

                      {groupQuestions.map(
                        (question) => (
                          <div
                            id={`question-${question.id}`}
                            className="blt-question"
                            key={
                              question.id
                            }
                          >

                            <div className="blt-question-number">
                              {question.number}
                            </div>


                            <div className="blt-question-body">

                              <div className="blt-question-prompt">
                                {
                                  question.prompt
                                }
                              </div>


                              <div className="blt-question-answer">
                                {renderQuestion(
                                  question
                                )}
                              </div>

                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>


          {/* ================================================= */}
          {/* BOTTOM NAVIGATION */}
          {/* ================================================= */}

          <div className="blt-bottom-navigation">

            <button
              type="button"
              className="blt-secondary-btn"
              disabled={
                currentSection ===
                0
              }
              onClick={() =>
                goToSection(
                  currentSection -
                    1
                )
              }
            >
              ← Previous
            </button>


            <div className="blt-question-jump">

              {currentSectionQuestions.map(
                (question) => {

                  const value =
                    answers[
                      getQuestionKey(
                        question
                      )
                    ];

                  const answered =
                    Array.isArray(
                      value
                    )
                      ? value.length >
                        0
                      : String(
                          value ??
                            ""
                        ).trim() !==
                        "";

                  return (
                    <button
                      type="button"
                      className={`blt-jump-btn ${
                        answered
                          ? "answered"
                          : ""
                      }`}
                      key={
                        question.id
                      }
                      onClick={() =>
                        goToQuestion(
                          question
                        )
                      }
                    >
                      {question.number}
                    </button>
                  );
                }
              )}

            </div>


            {currentSection <
            (test?.sections?.length ||
              1) -
              1 ? (
              <button
                type="button"
                className="blt-primary-btn"
                onClick={() =>
                  goToSection(
                    currentSection +
                      1
                  )
                }
              >
                Next Section →
              </button>
            ) : (
              <button
                type="button"
                className="blt-submit-btn"
                disabled={
                  submitting
                }
                onClick={() =>
                  handleSubmit(
                    false
                  )
                }
              >
                {submitting
                  ? "Submitting..."
                  : "Finish & Submit"}
              </button>
            )}

          </div>

        </section>

      </main>


      {/* ================================================= */}
      {/* MOBILE NAV */}
      {/* ================================================= */}

      <div className="blt-mobile-actions">

        <button
          type="button"
          onClick={() =>
            goToSection(
              Math.max(
                0,
                currentSection -
                  1
              )
            )
          }
          disabled={
            currentSection ===
            0
          }
        >
          ←
        </button>

        <span>
          Section{" "}
          {currentSection +
            1}
          /
          {test?.sections?.length ||
            4}
        </span>

        {currentSection <
        (test?.sections?.length ||
          1) -
          1 ? (
          <button
            type="button"
            onClick={() =>
              goToSection(
                currentSection +
                  1
              )
            }
          >
            →
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              handleSubmit(
                false
              )
            }
            disabled={
              submitting
            }
          >
            ✓
          </button>
        )}

      </div>

    </div>
  );
}