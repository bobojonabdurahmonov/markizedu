import { useCallback, useEffect, useState } from "react";
import api from "../api";
import "./WritingAdmin.css";

const WRITING_TYPES = [
  {
    value: "map",
    label: "Map",
    icon: "🗺️",
    description: "Map / plan tasviri",
  },
  {
    value: "graph",
    label: "Graph",
    icon: "📈",
    description: "Graph / chart tasviri",
  },
  {
    value: "process",
    label: "Process",
    icon: "⚙️",
    description: "Process diagram",
  },
];

const DURATIONS = [15, 20, 30];

function typeLabel(type) {
  return WRITING_TYPES.find((x) => x.value === type)?.label || type;
}

export default function WritingAdmin() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editingTest, setEditingTest] = useState(null);

  const [title, setTitle] = useState("");
  const [testType, setTestType] = useState("map");
  const [question, setQuestion] = useState("");
  const [duration, setDuration] = useState("20");
  const [published, setPublished] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [toast, setToast] = useState({
    text: "",
    kind: "info",
  });

  const notify = useCallback((text, kind = "info") => {
    setToast({ text, kind });

    if (kind !== "error") {
      setTimeout(() => {
        setToast({ text: "", kind: "info" });
      }, 4000);
    }
  }, []);

  const loadTests = useCallback(async () => {
    setLoading(true);

    try {
      const { data } = await api.get("writing/admin/tests/");

      setTests(
        Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : []
      );
    } catch (error) {
      console.error(error);

      notify(
        error.response?.status === 401
          ? "Sessiya tugagan. Qayta login qiling."
          : "Writing testlarini yuklab bo‘lmadi.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  function resetForm() {
    setTitle("");
    setTestType("map");
    setQuestion("");
    setDuration("20");
    setPublished(false);
    setImage(null);
    setImagePreview("");
    setEditingTest(null);
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(test) {
    setEditingTest(test);

    setTitle(test.title || "");
    setTestType(test.test_type || "map");
    setQuestion(test.question || "");
    setDuration(String(test.duration_minutes || 20));
    setPublished(Boolean(test.is_published));

    setImage(null);
    setImagePreview(test.image_url || "");

    setShowCreate(true);
  }

  function closeModal() {
    if (saving) return;

    setShowCreate(false);
    resetForm();
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];

    if (!file) {
      setImage(null);
      return;
    }

    setImage(file);

    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  async function saveTest(e) {
    e.preventDefault();

    if (!title.trim()) {
      notify("Test nomini kiriting.", "error");
      return;
    }

    if (!question.trim()) {
      notify("Writing savol matnini kiriting.", "error");
      return;
    }

    if (!editingTest && !image) {
      notify("Test rasmi yuklanishi kerak.", "error");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("test_type", testType);
      formData.append("question", question.trim());
      formData.append("duration_minutes", duration);
      formData.append("is_published", published ? "true" : "false");

      if (image) {
        formData.append("image", image);
      }

      let response;

      if (editingTest) {
        response = await api.patch(
          `writing/admin/tests/${editingTest.id}/`,
          formData
        );
      } else {
        response = await api.post(
          "writing/admin/tests/",
          formData
        );
      }

      notify(
        editingTest
          ? `Test yangilandi: ${response.data.title}`
          : `Test yaratildi: ${response.data.title}`,
        "success"
      );

      setShowCreate(false);
      resetForm();

      await loadTests();
    } catch (error) {
      console.error(error);

      const data = error.response?.data;

      notify(
        error.response?.status === 403
          ? "Ruxsat yo‘q. Admin account staff bo‘lishi kerak."
          : data
          ? `Saqlanmadi: ${JSON.stringify(data).slice(0, 400)}`
          : "Writing testi saqlanmadi.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(test) {
    try {
      const formData = new FormData();

      formData.append(
        "is_published",
        test.is_published ? "false" : "true"
      );

      await api.patch(
        `writing/admin/tests/${test.id}/`,
        formData
      );

      notify(
        test.is_published
          ? "Test qoralamaga o'tkazildi."
          : "Test nashr qilindi.",
        "success"
      );

      await loadTests();
    } catch (error) {
      console.error(error);
      notify("Test holatini o‘zgartirib bo‘lmadi.", "error");
    }
  }

  async function deleteTest(test) {
    const ok = window.confirm(
      `"${test.title}" testini o‘chirmoqchimisiz?`
    );

    if (!ok) return;

    try {
      await api.delete(`writing/admin/tests/${test.id}/`);

      notify("Writing testi o‘chirildi.", "success");

      await loadTests();
    } catch (error) {
      console.error(error);
      notify("Testni o‘chirib bo‘lmadi.", "error");
    }
  }

  const filteredTests = tests.filter((test) => {
    const q = search.trim().toLowerCase();

    if (filter === "published" && !test.is_published) {
      return false;
    }

    if (filter === "draft" && test.is_published) {
      return false;
    }

    if (!q) return true;

    return `
      ${test.title || ""}
      ${test.question || ""}
      ${test.test_type || ""}
      ${test.id || ""}
    `
      .toLowerCase()
      .includes(q);
  });

  return (
    <main className="writing-admin-page">

      {/* HEADER */}
      <header className="writing-admin-head">
        <div>
          <h1>Writing</h1>
          <p>
            IELTS Writing Part 1 testlarini boshqaring
          </p>
        </div>

        <button
          className="wa-btn primary"
          onClick={openCreate}
        >
          ＋ Yangi Writing test
        </button>
      </header>

      {/* TOOLBAR */}
      <div className="wa-toolbar">

        <input
          className="wa-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Test nomi yoki ID bo‘yicha qidirish..."
        />

        <div className="wa-segment">
          {[
            ["all", "Hammasi"],
            ["published", "Nashr qilingan"],
            ["draft", "Qoralama"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* STATS */}
      <div className="wa-stats">

        <div className="wa-stat">
          <span>📝</span>
          <div>
            <strong>{tests.length}</strong>
            <small>Jami test</small>
          </div>
        </div>

        <div className="wa-stat">
          <span>🌐</span>
          <div>
            <strong>
              {tests.filter((x) => x.is_published).length}
            </strong>
            <small>Nashr qilingan</small>
          </div>
        </div>

        <div className="wa-stat">
          <span>🗺️</span>
          <div>
            <strong>
              {tests.filter((x) => x.test_type === "map").length}
            </strong>
            <small>Map</small>
          </div>
        </div>

        <div className="wa-stat">
          <span>📈</span>
          <div>
            <strong>
              {tests.filter((x) => x.test_type === "graph").length}
            </strong>
            <small>Graph</small>
          </div>
        </div>

        <div className="wa-stat">
          <span>⚙️</span>
          <div>
            <strong>
              {tests.filter((x) => x.test_type === "process").length}
            </strong>
            <small>Process</small>
          </div>
        </div>

      </div>

      {/* LIST */}
      {loading ? (
        <div className="wa-loading">
          <div className="wa-loader"></div>
          <p>Writing testlari yuklanmoqda...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="wa-empty">

          <div className="wa-empty-icon">
            ✍️
          </div>

          <h2>
            {tests.length
              ? "Hech narsa topilmadi"
              : "Hali Writing test yo‘q"}
          </h2>

          <p>
            {tests.length
              ? "Qidiruv yoki filtrni o‘zgartiring."
              : "Birinchi Writing Part 1 testini yarating."}
          </p>

          {!tests.length && (
            <button
              className="wa-btn primary"
              onClick={openCreate}
            >
              ＋ Birinchi testni yaratish
            </button>
          )}

        </div>
      ) : (
        <div className="wa-list">

          {filteredTests.map((test) => (
            <div className="wa-test-card" key={test.id}>

              {/* IMAGE */}
              <div className="wa-image">

                {test.image_url ? (
                  <img
                    src={test.image_url}
                    alt={test.title}
                  />
                ) : (
                  <div className="wa-no-image">
                    🖼️
                  </div>
                )}

                <span className={`wa-type type-${test.test_type}`}>
                  {typeLabel(test.test_type)}
                </span>

              </div>

              {/* CONTENT */}
              <div className="wa-content">

                <div className="wa-card-top">

                  <div>
                    <h2>{test.title}</h2>

                    <div className="wa-meta">
                      <span>
                        ID {test.id}
                      </span>

                      <span>
                        ⏱ {test.duration_minutes} daqiqa
                      </span>

                      <span
                        className={
                          test.is_published
                            ? "published"
                            : "draft"
                        }
                      >
                        {test.is_published
                          ? "● Nashr qilingan"
                          : "● Qoralama"}
                      </span>
                    </div>
                  </div>

                </div>

                <div className="wa-question">
                  <strong>Task:</strong>

                  <p>
                    {test.question}
                  </p>
                </div>

                <div className="wa-actions">

                  <button
                    className="wa-btn"
                    onClick={() => openEdit(test)}
                  >
                    ✏️ Tahrirlash
                  </button>

                  <button
                    className="wa-btn"
                    onClick={() => togglePublished(test)}
                  >
                    {test.is_published
                      ? "📥 Qoralama"
                      : "🌐 Nashr qilish"}
                  </button>

                  <button
                    className="wa-btn danger"
                    onClick={() => deleteTest(test)}
                  >
                    🗑 O‘chirish
                  </button>

                </div>

              </div>

            </div>
          ))}

        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showCreate && (
        <div
          className="wa-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >

          <form
            className="wa-modal"
            onSubmit={saveTest}
          >

            <div className="wa-modal-head">

              <div>
                <h2>
                  {editingTest
                    ? "Writing testni tahrirlash"
                    : "Yangi Writing test"}
                </h2>

                <p>
                  IELTS Writing Part 1
                </p>
              </div>

              <button
                type="button"
                className="wa-close"
                onClick={closeModal}
              >
                ✕
              </button>

            </div>

            <div className="wa-form">

              {/* TITLE */}
              <div>
                <label>Test nomi</label>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="IELTS Writing Task 1 — Test 01"
                  required
                />
              </div>

              {/* TYPE */}
              <div>
                <label>Task turi</label>

                <div className="wa-type-grid">

                  {WRITING_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type.value}
                      className={
                        testType === type.value
                          ? "selected"
                          : ""
                      }
                      onClick={() => setTestType(type.value)}
                    >

                      <span className="wa-type-icon">
                        {type.icon}
                      </span>

                      <strong>
                        {type.label}
                      </strong>

                      <small>
                        {type.description}
                      </small>

                    </button>
                  ))}

                </div>
              </div>

              {/* IMAGE */}
              <div>
                <label>Task rasmi</label>

                <div className="wa-upload">

                  {imagePreview ? (
                    <div className="wa-preview">

                      <img
                        src={imagePreview}
                        alt="Writing task preview"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setImage(null);
                          setImagePreview("");
                        }}
                      >
                        ✕
                      </button>

                    </div>
                  ) : (
                    <label className="wa-upload-box">

                      <span>🖼️</span>

                      <strong>
                        Rasm tanlang
                      </strong>

                      <small>
                        PNG, JPG yoki WEBP
                      </small>

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageChange}
                      />

                    </label>
                  )}

                </div>

                {!editingTest && (
                  <small className="wa-help">
                    Map, graph yoki process rasmini yuklang.
                  </small>
                )}
              </div>

              {/* QUESTION */}
              <div>
                <label>
                  Writing Task savoli
                </label>

                <textarea
                  rows={5}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="The maps below show the changes that have taken place..."
                  required
                />
              </div>

              {/* DURATION */}
              <div>
                <label>Vaqt</label>

                <div className="wa-duration">

                  {DURATIONS.map((minutes) => (
                    <button
                      type="button"
                      key={minutes}
                      className={
                        duration === String(minutes)
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setDuration(String(minutes))
                      }
                    >
                      {minutes} daqiqa
                    </button>
                  ))}

                </div>
              </div>

              {/* PUBLISHED */}
              <label className="wa-check">

                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) =>
                    setPublished(e.target.checked)
                  }
                />

                <span>
                  Testni darhol nashr qilish
                </span>

              </label>

            </div>

            {/* FOOTER */}
            <div className="wa-modal-footer">

              <button
                type="button"
                className="wa-btn"
                onClick={closeModal}
                disabled={saving}
              >
                Bekor qilish
              </button>

              <button
                type="submit"
                className="wa-btn primary"
                disabled={saving}
              >
                {saving
                  ? "Saqlanmoqda..."
                  : editingTest
                  ? "O‘zgarishlarni saqlash"
                  : "Testni yaratish"}
              </button>

            </div>

          </form>

        </div>
      )}

      {/* TOAST */}
      {toast.text && (
        <div className={`wa-toast ${toast.kind}`}>
          <span>{toast.text}</span>

          <button
            onClick={() =>
              setToast({
                text: "",
                kind: "info",
              })
            }
          >
            ✕
          </button>
        </div>
      )}

    </main>
  );
}