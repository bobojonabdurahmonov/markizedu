import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import api from "../api";
import "./Dashboard.css";

const readingCategories = [
  { value: "", label: "-" },
  { value: "full", label: "Full Test" },
  { value: "passage-1", label: "Passage 1" },
  { value: "passage-2", label: "Passage 2" },
  { value: "passage-3", label: "Passage 3" },
];

const listeningCategories = [
  { value: "", label: "-" },
  { value: "full", label: "Full Test" },
];

const writingCategories = [
  { value: "", label: "-" },
  { value: "map", label: "Map" },
  { value: "graph", label: "Graph" },
  { value: "process", label: "Process" },
];

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.tests)) return data.tests;
  return [];
}

function getPassages(test) {
  return test?.passages || test?.passage_list || [];
}

function getTestCategory(test) {
  const format = test?.test_format;
  const passages = getPassages(test);
  const count = test?.passage_count ?? passages.length;

  // Full Test faqat 3 ta passage bo‘lsa
  if (format === "full" && Number(count) === 3) {
    return "full";
  }

  // Alohida passage testini aniqlash
  if (Number(count) === 1) {
    const number =
      passages[0]?.number ??
      (format?.startsWith("passage_")
        ? format.replace("passage_", "")
        : null);

    if ([1, 2, 3].includes(Number(number))) {
      return `passage-${number}`;
    }
  }

  return null;
}

function getQuestionCount(passage) {
  if (typeof passage?.question_count === "number") {
    return passage.question_count;
  }

  const groups = passage?.question_groups || passage?.groups || [];

  return groups.reduce((total, group) => {
    const questions = group.questions || [];
    return total + questions.length;
  }, 0);
}

function getTestQuestionCount(test) {
  if (typeof test?.question_count === "number") {
    return test.question_count;
  }

  return getPassages(test).reduce(
    (total, passage) => total + getQuestionCount(passage),
    0
  );
}

function getDuration(test, mode) {
  if (mode === "full") {
    return test.duration_minutes || test.duration || 60;
  }

  const passageNumber = Number(mode.split("-")[1]);
  const passage = getPassages(test).find(
    (item) => Number(item.number) === passageNumber
  );

  return passage?.duration_minutes || 20;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [checking, setChecking] = useState(true);
  const [activeType, setActiveType] = useState("Reading");
  const [activeCategory, setActiveCategory] = useState("");

  const [readingTests, setReadingTests] = useState([]);
  const [listeningTests, setListeningTests] = useState([]);
  const [writingTests, setWritingTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [testsError, setTestsError] = useState("");

  useEffect(() => {
      let cancelled = false;

      api
        .get("auth/me/")
        .then((response) => {
          if (!cancelled) {
            setUser(response.data);
            localStorage.setItem("user", JSON.stringify(response.data));
          }
        })
        .catch(() => {
          if (!cancelled) {
            clearAuth();
            navigate("/login", { replace: true });
          }
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });

      return () => {
        cancelled = true;
      };
    }, [navigate]);

    useEffect(() => {
    let cancelled = false;

    async function loadTests() {
      setLoadingTests(true);
      setTestsError("");

      try {
        const [
          readingResponse,
          listeningResponse,
          writingResponse,
        ] = await Promise.all([
          api.get("reading/tests/"),
          api.get("listening/tests/"),
          api.get("writing/tests/"),
        ]);
        if (cancelled) return;

        const readingData = readingResponse.data;
        const listeningData = listeningResponse.data;
        const writingData = writingResponse.data;

        const readingItems = getList(readingData);
        const listeningItems = getList(listeningData);
        const writingItems = getList(writingData);

        setReadingTests(readingItems);
        setListeningTests(listeningItems);
        setWritingTests(writingItems);

        console.log("Reading testlar:", readingItems);
        console.log("Listening testlar:", listeningItems);
        console.log("Writing testlar:", writingItems);
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Testlarni yuklash xatosi:",
          error.response?.status,
          error.response?.data || error.message
        );

        setReadingTests([]);
        setListeningTests([]);

        setTestsError(
          `Testlarni yuklab bo‘lmadi. HTTP: ${
            error.response?.status || "Network error"
          }`
        );
      } finally {
        if (!cancelled) {
          setLoadingTests(false);
        }
      }
    }

    loadTests();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    clearAuth();
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  function changeType(type) {
    setActiveType(type);
    setActiveCategory("");
  }

  const categories =
    activeType === "Reading"
      ? readingCategories
      : activeType === "Listening"
      ? listeningCategories
      : writingCategories;

  const availableTests =
    activeType === "Reading"
      ? readingTests
      : activeType === "Listening"
      ? listeningTests
      : writingTests;

  const filteredTests = useMemo(() => {
    return availableTests
      .filter((test) => test.is_published !== false)
      .filter((test) => {
        if (activeCategory === "") {
          return true;
        }

        if (activeType === "Writing") {
          return test.test_type === activeCategory;
        }

        if (activeType === "Listening") {
          return true;
        }

        const testCategory = getTestCategory(test);
        return testCategory === activeCategory;
      })
      .map((test) => {
        // =========================
        // WRITING
        // =========================
        if (activeType === "Writing") {
          return {
            ...test,
            displayTitle: test.title,
            questionCount: 1,
            duration: test.duration_minutes || 20,
          };
        }

        // =========================
        // READING
        // =========================
        const testCategory = getTestCategory(test);

        const passageNumber =
          testCategory?.startsWith("passage-")
            ? Number(testCategory.split("-")[1])
            : null;

        const selectedPassage =
          activeCategory !== "" && passageNumber
            ? getPassages(test).find(
                (passage) => Number(passage.number) === passageNumber
              )
            : null;

        return {
          ...test,
          selectedPassage,
          displayTitle: selectedPassage
            ? `${test.title} — Passage ${passageNumber}`
            : test.title,
          questionCount: selectedPassage
            ? getQuestionCount(selectedPassage)
            : getTestQuestionCount(test),
          duration:
            activeCategory === ""
              ? testCategory === "full"
                ? 60
                : getPassages(test)[0]?.duration_minutes || 20
              : selectedPassage
              ? selectedPassage.duration_minutes || 20
              : testCategory === "full"
              ? 60
              : 20,
        };
      })
  }, [availableTests, activeType, activeCategory]);
  
  function handleStartTest(test) {
    if (activeType === "Writing") {
      navigate(`/writing/${test.id}`);
      return;
    }

    if (activeType === "Reading") {
      const passageCount = Number(test.passage_count);
      const passages = getPassages(test);

      // Full Test
      if (
        test.test_format === "full" &&
        passageCount === 3
      ) {
        navigate(`/reading/${test.id}/full`);
        return;
      }

      // Alohida passage
      if (passageCount === 1) {
        const passageNumber = Number(passages[0]?.number);

        if (![1, 2, 3].includes(passageNumber)) {
          console.error("Passage raqami topilmadi:", test);
          return;
        }

        navigate(`/reading/${test.id}/passage/${passageNumber}`);
        return;
      }

      console.error("Test formati yoki passage_count noto‘g‘ri:", test);
      return;
    }

    navigate(`/listening/${test.id}/full`);
  }

  if (checking) {
    return <p>Hisob tekshirilmoqda...</p>;
  }

  if (!user) return null;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="sidebar-logo">
          englishCenter<span>cds</span>
        </h2>

        <button className="sidebar-item active">
          📚 History
        </button>

        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>

            <div>
              <h4>{user?.username}</h4>
              <p>IELTS Student</p>
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Start today!</p>
          </div>

          <div className="header-badge">IELTS Practice</div>
        </header>

        <div className="test-controls">
          <div className="type-tabs">
            <button
              className={activeType === "Reading" ? "selected" : ""}
              onClick={() => changeType("Reading")}
            >
              📖 Reading
            </button>

            <button
              className={activeType === "Listening" ? "selected" : ""}
              onClick={() => changeType("Listening")}
            >
              🎧 Listening
            </button>

            <button
              className={activeType === "Writing" ? "selected" : ""}
              onClick={() => changeType("Writing")}
            >
              ✍️ Writing
            </button>
          </div>

          <select
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
            aria-label="Test turini tanlash"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="section-headingd">
          <div>
            <h2>
              {activeType} —{" "}
              {activeCategory === ""
                ? "All"
                : categories.find(
                    (category) => category.value === activeCategory
                  )?.label}
            </h2>

            <p>{filteredTests.length} ta test topildi</p>
          </div>
        </div>

        {loadingTests ? (
          <p className="empty-tests">Testlar yuklanmoqda...</p>
        ) : testsError ? (
          <p className="empty-tests">{testsError}</p>
        ) : (
          <>
            <div className="test-grid">
              {filteredTests.map((test) => (
                <article className="test-card" key={test.id}>
                  <div className="test-card-top">
                    <div className="test-icon">
                      <div className="test-icon">
                        {activeType === "Reading"
                          ? "📖"
                          : activeType === "Listening"
                          ? "🎧"
                          : "✍️"}
                      </div>
                    </div>

                   <span className="level-badge">
                      {activeType === "Writing"
                        ? activeCategory === ""
                          ? test.test_type === "map"
                            ? "Map"
                            : test.test_type === "graph"
                            ? "Graph"
                            : test.test_type === "process"
                            ? "Process"
                            : "Writing"
                          : categories.find(
                              (category) => category.value === activeCategory
                            )?.label
                        : activeCategory === ""
                        ? getTestCategory(test) === "full"
                          ? "Full Test"
                          : getTestCategory(test)?.replace("passage-", "Passage ")
                        : categories.find(
                            (category) => category.value === activeCategory
                          )?.label}
                    </span>
                  </div>

                  {activeType === "Writing" && test.image_url && (
                    <div className="writing-test-image">
                      <img
                        src={test.image_url}
                        alt={test.title}
                      />
                    </div>
                  )}

                  <h3>{test.displayTitle || test.title}</h3>

                  <p className="test-description">
                    {test.description || `${activeType} practice test`}
                  </p>

                  <div className="test-meta">
                    <span>☰ {test.questionCount} questions</span>
                    <span>◷ {test.duration} minutes</span>
                  </div>

                  <button
                    className="start-test-btn"
                    onClick={() => handleStartTest(test)}
                  >
                    Start Test →
                  </button>
                </article>
              ))}
            </div>

            {filteredTests.length === 0 && (
              <p className="empty-tests">
                Bu kategoriya uchun hozircha test mavjud emas.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );

}