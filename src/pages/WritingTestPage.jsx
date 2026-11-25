import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./WritingTestPage.css";


// =====================================================
// FULLSCREEN HELPERS
// =====================================================

const enterFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.log("Fullscreen yoqilmadi:", error);
  }
};

const exitFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.log("Fullscreen'dan chiqishda xatolik:", error);
  }
};


// =====================================================
// COMPONENT
// =====================================================

export default function WritingTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();


  // =====================================================
  // TEST DATA
  // =====================================================

  const [test, setTest] = useState(null);
  const [attemptId, setAttemptId] = useState(null);

  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(0);


  // =====================================================
  // START WARNING
  // =====================================================

  const [warningStep, setWarningStep] = useState(0);


  // =====================================================
  // FULLSCREEN WARNINGS
  // =====================================================

  const [fullscreenWarnings, setFullscreenWarnings] =
    useState(0);

  const [fullscreenWarningVisible, setFullscreenWarningVisible] =
    useState(false);

  const [fullscreenWarningMessage, setFullscreenWarningMessage] =
    useState("");


  // =====================================================
  // RESULT
  // =====================================================

  const [submittedResult, setSubmittedResult] =
    useState(null);


  // =====================================================
  // REFS
  // =====================================================

  const timerRef = useRef(null);

  const submittedRef = useRef(false);

  const isSubmittingRef = useRef(false);

  const fullscreenWarningsRef = useRef(0);


  // =====================================================
  // LOAD TEST
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadTest() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(
          `writing/tests/${testId}/`
        );

        if (!cancelled) {
          setTest(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Writing testni yuklashda xatolik:",
            error.response?.status,
            error.response?.data || error.message
          );

          setError(
            error.response?.data?.detail ||
              "Writing testni yuklab bo'lmadi."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTest();

    return () => {
      cancelled = true;
    };
  }, [testId]);


  // =====================================================
  // WORD COUNT
  // =====================================================

  const wordCount = useMemo(() => {
    if (!answer.trim()) {
      return 0;
    }

    return answer.trim().split(/\s+/).length;
  }, [answer]);


  // =====================================================
  // FORMAT TIME
  // =====================================================

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(
      0,
      Number(totalSeconds) || 0
    );

    const minutes = Math.floor(
      safeSeconds / 60
    );

    const seconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }


  function formatSpentTime(totalSeconds) {
    const safeSeconds = Math.max(
      0,
      Number(totalSeconds) || 0
    );

    const minutes = Math.floor(
      safeSeconds / 60
    );

    const seconds = safeSeconds % 60;

    if (minutes === 0) {
      return `${seconds} sec`;
    }

    if (seconds === 0) {
      return `${minutes} min`;
    }

    return `${minutes} min ${seconds} sec`;
  }


  // =====================================================
  // START TEST
  // =====================================================

  async function startTest() {
    if (!test || starting) {
      return;
    }

    setStarting(true);
    setError("");

    try {
      const response = await api.post(
        `writing/tests/${test.id}/start/`
      );

      const data = response.data;

      setAttemptId(data.attempt_id);

      setTest(data.test || test);

      const durationSeconds =
        Number(
          data.duration_minutes ||
            test.duration_minutes ||
            20
        ) * 60;

      setSecondsLeft(durationSeconds);

      // Fullscreen
      await enterFullscreen();

    } catch (error) {
      console.error(
        "Writing testni boshlashda xatolik:",
        error.response?.status,
        error.response?.data || error.message
      );

      setError(
        error.response?.data?.detail ||
          "Writing testni boshlashda xatolik yuz berdi."
      );
    } finally {
      setStarting(false);
    }
  }


  // =====================================================
  // START WARNING
  // =====================================================

  const warningMessages = [
    {
      title: "Diqqat!",
      text:
        "Writing test boshlanishidan oldin fullscreen rejimga o'tishingiz kerak.",
    },
    {
      title: "Muhim!",
      text:
        "Test davomida fullscreen rejimidan chiqmasdan ishlashga harakat qiling.",
    },
    {
      title: "Oxirgi ogohlantirish",
      text:
        "Keyingi tugmani bosganingizdan so'ng Writing test boshlanadi.",
    },
  ];


  function handleWarningNext() {
    if (
      warningStep <
      warningMessages.length - 1
    ) {
      setWarningStep((prev) => prev + 1);
      return;
    }

    startTest();
  }


  // =====================================================
  // SUBMIT WRITING
  // =====================================================

  async function submitWriting(autoSubmit = false) {
    // Bir vaqtning o'zida ikkita submit bo'lishining oldini olamiz
    if (
      !attemptId ||
      submitting ||
      isSubmittingRef.current ||
      submittedRef.current
    ) {
      return;
    }

    // Oddiy submit bo'lsa bo'sh javobga ruxsat yo'q
    if (!answer.trim() && !autoSubmit) {
      setSubmitError(
        "Writing matnini kiriting."
      );

      return;
    }

    isSubmittingRef.current = true;
    submittedRef.current = true;

    setSubmitting(true);
    setSubmitError("");
    setError("");

    try {
      const response = await api.post(
        `writing/attempts/${attemptId}/submit/`,
        {
          answer: answer.trim(),
        }
      );

      // Submitdan keyin fullscreen'dan chiqamiz
      await exitFullscreen();

      setSubmittedResult({
        ...response.data,

        // Backend true qaytarsa ham,
        // frontend automatic submit bo'lsa ham true
        submitted_automatically:
          autoSubmit ||
          response.data.submitted_automatically ||
          false,
      });

    } catch (error) {
      console.error(
        "Writing submit error:",
        error.response?.status,
        error.response?.data || error.message
      );

      // Submit xato bo'lsa yana urinib ko'rish mumkin
      isSubmittingRef.current = false;
      submittedRef.current = false;
      setSubmitting(false);

      if (autoSubmit) {
        setError(
          error.response?.data?.detail ||
            "Testni avtomatik topshirishda xatolik yuz berdi."
        );
      } else {
        setSubmitError(
          error.response?.data?.detail ||
            "Writing testni topshirishda xatolik yuz berdi."
        );
      }
    }
  }


  // =====================================================
  // TIMER
  // =====================================================

  useEffect(() => {
    if (
      !attemptId ||
      submittedRef.current ||
      secondsLeft <= 0
    ) {
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [attemptId]);


  // =====================================================
  // TIMER AUTO SUBMIT
  // =====================================================

  useEffect(() => {
    if (
      attemptId &&
      secondsLeft === 0 &&
      !submittedRef.current &&
      !submitting
    ) {
      submitWriting(true);
    }
  }, [
    secondsLeft,
    attemptId,
    submitting,
  ]);


  // =====================================================
  // FULLSCREEN MONITOR
  // =====================================================

  useEffect(() => {
    if (!attemptId || submittedResult) {
      return;
    }

    function handleFullscreenChange() {
      // Test allaqachon tugagan bo'lsa
      if (
        submittedRef.current ||
        isSubmittingRef.current ||
        submittedResult
      ) {
        return;
      }

      // User fullscreen ichida
      if (document.fullscreenElement) {
        setFullscreenWarningVisible(false);
        return;
      }

      // ================================================
      // USER FULLSCREEN'DAN CHIQDI
      // ================================================

      const nextCount =
        fullscreenWarningsRef.current + 1;

      fullscreenWarningsRef.current =
        nextCount;

      setFullscreenWarnings(nextCount);

      // ================================================
      // 3-MARTA
      // ================================================

      if (nextCount >= 3) {
        setFullscreenWarningVisible(false);

        // Avtomatik submit
        submitWriting(true);

        return;
      }

      // ================================================
      // 1-MARTA
      // ================================================

      if (nextCount === 1) {
        setFullscreenWarningMessage(
          "Fullscreen rejimidan chiqdingiz. Sizda yana 2 ta imkoniyat bor."
        );
      }

      // ================================================
      // 2-MARTA
      // ================================================

      if (nextCount === 2) {
        setFullscreenWarningMessage(
          "Fullscreen rejimidan yana chiqdingiz. Yana bir marta chiqsangiz, test avtomatik topshiriladi."
        );
      }

      setFullscreenWarningVisible(true);
    }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, [
    attemptId,
    submittedResult,
  ]);


  // =====================================================
  // FULLSCREEN WARNING
  // =====================================================

  async function handleReturnToFullscreen() {
    setFullscreenWarningVisible(false);

    await enterFullscreen();
  }


  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);


  // =====================================================
  // RETURN DASHBOARD
  // =====================================================

  async function returnToDashboard() {
    await exitFullscreen();

    navigate("/dashboard");
  }


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="writing-loading">
        <div className="writing-loading-box">

          <div className="writing-spinner"></div>

          <p>
            Writing test yuklanmoqda...
          </p>

        </div>
      </div>
    );
  }


  // =====================================================
  // ERROR
  // =====================================================

  if (error && !test) {
    return (
      <div className="writing-loading">

        <div className="writing-error-box">

          <div className="writing-result-icon error">
            !
          </div>

          <h2>
            Xatolik
          </h2>

          <p>
            {error}
          </p>

          <button
            onClick={returnToDashboard}
            className="writing-dashboard-btn"
          >
            ← Return to Dashboard
          </button>

        </div>

      </div>
    );
  }


  // =====================================================
  // SUCCESS PAGE
  // =====================================================

  if (submittedResult) {
    const spentSeconds =
      Number(
        submittedResult.spent_seconds
      ) || 0;

    return (
      <div className="writing-result-page">

        <div className="writing-result-card">

          <div className="writing-result-icon success">
            ✓
          </div>

          <h1>
            Testni muvaffaqiyatli topshirdingiz!
          </h1>

          <p className="writing-result-main-text">
            Writing testingiz muvaffaqiyatli saqlandi.
            Natijangizni va ketkazgan vaqtingizni
            guruhda ko'rishingiz mumkin.
          </p>


          {/* RESULT STATS */}

          <div className="writing-result-stats">

            <div className="writing-result-stat">

              <span>
                Test
              </span>

              <strong>
                {submittedResult.test_title ||
                  test?.title ||
                  "Writing"}
              </strong>

            </div>


            <div className="writing-result-stat">

              <span>
                Ketkazilgan vaqt
              </span>

              <strong>
                {formatSpentTime(
                  spentSeconds
                )}
              </strong>

            </div>


            <div className="writing-result-stat">

              <span>
                Task turi
              </span>

              <strong>
                {submittedResult.test_type ===
                "map"
                  ? "Map"
                  : submittedResult.test_type ===
                    "graph"
                  ? "Graph"
                  : submittedResult.test_type ===
                    "process"
                  ? "Process"
                  : "Writing Task 1"}
              </strong>

            </div>

          </div>


          {/* AUTO SUBMIT MESSAGE */}

          {submittedResult.submitted_automatically && (
            <div className="writing-auto-message">
              ⏱ Vaqt tugagani yoki fullscreen
              qoidasi buzilgani sababli test
              avtomatik yuborildi.
            </div>
          )}


          {/* TELEGRAM */}

          <p className="writing-result-group-note">
            📢 Batafsil natijani Telegram guruhida
            ko'rishingiz mumkin.
          </p>


          {/* DASHBOARD */}

          <button
            className="writing-dashboard-btn"
            onClick={returnToDashboard}
          >
            Return to Dashboard →
          </button>

        </div>

      </div>
    );
  }


  // =====================================================
  // START WARNING PAGE
  // =====================================================

  if (test && !attemptId) {
    const warning =
      warningMessages[warningStep];

    return (
      <div className="writing-warning-page">

        <div className="writing-warning-card">

          <div className="writing-warning-icon">
            ✍️
          </div>


          {/* PROGRESS */}

          <div className="writing-warning-progress">

            {warningMessages.map(
              (_, index) => (
                <span
                  key={index}
                  className={
                    warningStep >= index
                      ? "active"
                      : ""
                  }
                />
              )
            )}

          </div>


          <h1>
            {warning.title}
          </h1>

          <p>
            {warning.text}
          </p>


          {/* TEST INFO */}

          <div className="writing-test-info">

            <div>

              <span>
                Test
              </span>

              <strong>
                {test.title}
              </strong>

            </div>


            <div>

              <span>
                Task
              </span>

              <strong>
                {test.test_type ===
                "map"
                  ? "Map"
                  : test.test_type ===
                    "graph"
                  ? "Graph"
                  : "Process"}
              </strong>

            </div>


            <div>

              <span>
                Time
              </span>

              <strong>
                {test.duration_minutes}
                {" "}
                minutes
              </strong>

            </div>

          </div>


          {/* ERROR */}

          {error && (
            <div className="writing-inline-error">
              {error}
            </div>
          )}


          {/* NEXT */}

          <button
            className="writing-start-btn"
            onClick={handleWarningNext}
            disabled={starting}
          >
            {starting
              ? "Starting..."
              : warningStep ===
                warningMessages.length - 1
              ? "Start Writing Test →"
              : "Continue →"}
          </button>


          {/* CANCEL */}

          <button
            className="writing-cancel-btn"
            onClick={returnToDashboard}
          >
            Cancel
          </button>

        </div>

      </div>
    );
  }


  // =====================================================
  // TEST DATA
  // =====================================================

  const taskType =
    test.test_type === "map"
      ? "Map"
      : test.test_type === "graph"
      ? "Graph"
      : "Process";


  const timerDanger =
    secondsLeft <= 60;


  const timerWarning =
    secondsLeft <= 300;


  // =====================================================
  // TEST PAGE
  // =====================================================

  return (
    <div className="writing-test-page">


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="writing-test-header">

        <div className="writing-header-left">

          <div className="writing-brand">
            ✍️ Writing
          </div>


          <div className="writing-header-divider"></div>


          <div className="writing-test-title">

            <h2>
              {test.title}
            </h2>

            <span>
              IELTS Writing Task 1 · {taskType}
            </span>

          </div>

        </div>


        {/* TIMER */}

        <div className="writing-header-right">

          <div
            className={`writing-timer ${
              timerDanger
                ? "danger"
                : timerWarning
                ? "warning"
                : ""
            }`}
          >

            <span>
              ◷
            </span>

            <div>

              <small>
                Time remaining
              </small>

              <strong>
                {formatTime(
                  secondsLeft
                )}
              </strong>

            </div>

          </div>

        </div>

      </header>



      {/* =================================================
          MAIN
      ================================================= */}

      <main className="writing-workspace">


        {/* =================================================
            LEFT — QUESTION + IMAGE
        ================================================= */}

        <section className="writing-task-panel">

          <div className="writing-panel-header">

            <div>

              <span className="writing-task-badge">
                TASK 1
              </span>

              <span className="writing-task-badge secondary">
                {taskType}
              </span>

            </div>


            <span className="writing-minutes">
              {test.duration_minutes}
              {" "}
              min
            </span>

          </div>


          {/* QUESTION */}

          <div className="writing-question">
            {test.question}
          </div>


          {/* IMAGE */}

          {test.image_url && (
            <div className="writing-image-box">

              <img
                src={test.image_url}
                alt="Writing Task 1"
              />

            </div>
          )}

        </section>



        {/* =================================================
            RIGHT — ANSWER
        ================================================= */}

        <section className="writing-answer-panel">

          <div className="writing-answer-top">

            <div>

              <h3>
                Your answer
              </h3>

              <p>
                Write your response below.
              </p>

            </div>


            {/* WORD COUNT */}

            <div className="writing-word-count">

              <strong>
                {wordCount}
              </strong>

              <span>
                words
              </span>

            </div>

          </div>


          {/* TEXTAREA */}

          <textarea
            value={answer}
            onChange={(event) => {
              setAnswer(
                event.target.value
              );

              setSubmitError("");
            }}
            placeholder="Write your answer here..."
            disabled={submitting}
            spellCheck={false}
          />


          {/* BOTTOM */}

          <div className="writing-answer-bottom">

            <span>
              Recommended: at least 150 words
            </span>

            <span>
              {wordCount} words
            </span>

          </div>


          {/* SUBMIT ERROR */}

          {submitError && (
            <div className="writing-submit-error">
              {submitError}
            </div>
          )}


          {/* SUBMIT */}

          <div className="writing-submit-area">

            <button
              className="writing-submit-btn"
              onClick={() =>
                submitWriting(false)
              }
              disabled={
                submitting ||
                !answer.trim()
              }
            >
              {submitting
                ? "Submitting..."
                : "Submit Writing →"}
            </button>

          </div>

        </section>

      </main>


      {/* =================================================
          FULLSCREEN WARNING MODAL
      ================================================= */}

      {fullscreenWarningVisible && (
        <div className="fullscreen-warning-overlay">

          <div className="fullscreen-warning-modal">

            <div className="fullscreen-warning-icon">
              ⚠️
            </div>

            <h2>
              Fullscreen rejimi
            </h2>

            <p>
              {fullscreenWarningMessage}
            </p>


            {/* ATTEMPT CIRCLES */}

            <div className="fullscreen-warning-count">

              <span
                className={
                  fullscreenWarnings >= 1
                    ? "used"
                    : ""
                }
              >
                1
              </span>

              <span
                className={
                  fullscreenWarnings >= 2
                    ? "used"
                    : ""
                }
              >
                2
              </span>

              <span
                className={
                  fullscreenWarnings >= 3
                    ? "used danger"
                    : ""
                }
              >
                3
              </span>

            </div>


            <button
              className="fullscreen-warning-button"
              onClick={
                handleReturnToFullscreen
              }
            >
              Fullscreen'ga qaytish
            </button>

          </div>

        </div>
      )}

    </div>
  );
}