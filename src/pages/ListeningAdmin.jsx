import { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./ListeningAdmin.css";


// =========================================================
// CONSTANTS
// =========================================================

const QUESTION_TYPES = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "A, B yoki C dan bitta javob",
  },
  {
    value: "multiple_answer",
    label: "Multiple Answer",
    description: "Bir nechta to'g'ri javob",
  },
  {
    value: "sentence_completion",
    label: "Sentence Completion",
    description: "Gapni to'ldirish",
  },
  {
    value: "note_completion",
    label: "Note Completion",
    description: "Note to'ldirish",
  },
  {
    value: "table_completion",
    label: "Table Completion",
    description: "Jadvalni to'ldirish",
  },
  {
    value: "summary_completion",
    label: "Summary Completion",
    description: "Summary to'ldirish",
  },
  {
    value: "form_completion",
    label: "Form Completion",
    description: "Formani to'ldirish",
  },
  {
    value: "matching",
    label: "Matching",
    description: "Variantlarni moslashtirish",
  },
  {
    value: "map_labeling",
    label: "Map / Plan Labeling",
    description: "Xaritadagi joylarni belgilash",
  },
  {
    value: "short_answer",
    label: "Short Answer",
    description: "Qisqa javob",
  },
];

const DEFAULT_SECTIONS = [1, 2, 3, 4];


// =========================================================
// HELPERS
// =========================================================

function emptyQuestion(number = 1) {
  return {
    id: null,
    number,
    prompt: "",
    options: [],
    correct_answer: "",
    explanation: "",
    points: 1,
  };
}

function emptyGroup(order = 1) {
  return {
    id: null,
    title: "",
    instructions: "",
    question_type: "multiple_choice",
    order,
    questions: [emptyQuestion(1)],
  };
}

function emptySection(number) {
  return {
    id: null,
    test: null,
    number,
    title: `Section ${number}`,
    instructions: "",
    order: number,
    question_groups: [],
  };
}

function normalizeQuestion(question) {
  return {
    id: question.id ?? null,
    number: Number(question.number || 1),
    prompt: question.prompt || "",
    options: Array.isArray(question.options)
      ? question.options
      : [],
    correct_answer:
      question.correct_answer ?? "",
    explanation:
      question.explanation || "",
    points: Number(
      question.points || 1
    ),
  };
}

function normalizeGroup(group) {
  return {
    id: group.id ?? null,
    title: group.title || "",
    instructions:
      group.instructions || "",
    question_type:
      group.question_type ||
      "multiple_choice",
    order: Number(
      group.order || 1
    ),
    questions: (
      group.questions || []
    ).map(
      normalizeQuestion
    ),
  };
}

function normalizeSection(section) {
  return {
    id: section.id ?? null,
    test:
      section.test ?? null,
    number: Number(
      section.number
    ),
    title:
      section.title ||
      `Section ${section.number}`,
    instructions:
      section.instructions || "",
    order: Number(
      section.order ||
        section.number
    ),
    question_groups: (
      section.question_groups ||
      []
    ).map(
      normalizeGroup
    ),
  };
}


// =========================================================
// MAIN COMPONENT
// =========================================================

export default function ListeningAdmin() {
  const [tests, setTests] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [selectedTestId, setSelectedTestId] =
    useState(null);

  const [test, setTest] =
    useState(null);

  const [sections, setSections] =
    useState([]);

  const [activeSection, setActiveSection] =
    useState(1);

  const [audioFile, setAudioFile] =
    useState(null);

  const [creating, setCreating] =
    useState(false);

  const [search, setSearch] =
    useState("");


  // =======================================================
  // LOAD TESTS
  // =======================================================

  async function loadTests() {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          "listening/admin/tests/"
        );

      setTests(
        Array.isArray(
          response.data
        )
          ? response.data
          : response.data.results ||
              []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Listening testlarni yuklashda xatolik."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadTests();
  }, []);


  // =======================================================
  // FILTER
  // =======================================================

  const filteredTests =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return tests;
      }

      return tests.filter(
        (item) =>
          String(
            item.title || ""
          )
            .toLowerCase()
            .includes(value)
      );
    }, [
      tests,
      search,
    ]);


  // =======================================================
  // CREATE NEW TEST
  // =======================================================

  function createNewTest() {
    setSelectedTestId(null);

    setTest({
      id: null,
      title: "",
      description: "",
      audio: null,
      audio_url: null,
      is_published: false,
      created_at: null,
    });

    setSections(
      DEFAULT_SECTIONS.map(
        (number) =>
          emptySection(
            number
          )
      )
    );

    setAudioFile(null);

    setActiveSection(1);

    setError("");

    setSuccess("");

    setCreating(true);
  }


  // =======================================================
  // EDIT TEST
  // =======================================================

  async function openTest(
    testId
  ) {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          `listening/admin/tests/${testId}/`
        );

      const data =
        response.data;

      setSelectedTestId(
        testId
      );

      setTest({
        ...data,
        id: testId,
      });

      const loadedSections =
        (
          data.sections ||
          []
        ).map(
          normalizeSection
        );

      const finalSections =
        DEFAULT_SECTIONS.map(
          (number) => {
            const existing =
              loadedSections.find(
                (section) =>
                  Number(
                    section.number
                  ) ===
                  number
              );

            return (
              existing ||
              emptySection(
                number
              )
            );
          }
        );

      setSections(
        finalSections
      );

      setAudioFile(null);

      setActiveSection(1);

      setCreating(true);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Listening testni ochishda xatolik."
      );
    } finally {
      setLoading(false);
    }
  }


  // =======================================================
  // BACK TO LIST
  // =======================================================

  function closeEditor() {
    setCreating(false);
    setSelectedTestId(null);
    setTest(null);
    setSections([]);
    setAudioFile(null);
    setError("");
    setSuccess("");
  }


  // =======================================================
  // TEST FIELD
  // =======================================================

  function updateTestField(
    field,
    value
  ) {
    setTest(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  }


  // =======================================================
  // SECTION
  // =======================================================

  function updateSection(
    sectionNumber,
    field,
    value
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) =>
            section.number ===
            sectionNumber
              ? {
                  ...section,
                  [field]:
                    value,
                }
              : section
        )
    );
  }


  function getActiveSection() {
    return (
      sections.find(
        (section) =>
          section.number ===
          activeSection
      ) ||
      null
    );
  }


  // =======================================================
  // GROUP
  // =======================================================

  function addGroup() {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const nextOrder =
              section.question_groups
                .length + 1;

            return {
              ...section,
              question_groups: [
                ...section.question_groups,
                emptyGroup(
                  nextOrder
                ),
              ],
            };
          }
        )
    );
  }


  function updateGroup(
    groupIndex,
    field,
    value
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups = [
              ...section.question_groups,
            ];

            groups[
              groupIndex
            ] = {
              ...groups[
                groupIndex
              ],
              [field]:
                value,
            };

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  function removeGroup(
    groupIndex
  ) {
    if (
      !window.confirm(
        "Bu question group va ichidagi savollar o'chiriladi. Davom etasizmi?"
      )
    ) {
      return;
    }

    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.filter(
                (_, index) =>
                  index !==
                  groupIndex
              );

            return {
              ...section,
              question_groups:
                groups.map(
                  (
                    group,
                    index
                  ) => ({
                    ...group,
                    order:
                      index +
                      1,
                  })
                ),
            };
          }
        )
    );
  }


  // =======================================================
  // QUESTION
  // =======================================================

  function addQuestion(
    groupIndex
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  index
                ) => {
                  if (
                    index !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const nextNumber =
                    group.questions
                      .length +
                    1;

                  return {
                    ...group,
                    questions: [
                      ...group.questions,
                      emptyQuestion(
                        nextNumber
                      ),
                    ],
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  function updateQuestion(
    groupIndex,
    questionIndex,
    field,
    value
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  gi
                ) => {
                  if (
                    gi !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const questions =
                    group.questions.map(
                      (
                        question,
                        qi
                      ) =>
                        qi ===
                        questionIndex
                          ? {
                              ...question,
                              [field]:
                                value,
                            }
                          : question
                    );

                  return {
                    ...group,
                    questions,
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  function removeQuestion(
    groupIndex,
    questionIndex
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  gi
                ) => {
                  if (
                    gi !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const questions =
                    group.questions
                      .filter(
                        (
                          _,
                          qi
                        ) =>
                          qi !==
                          questionIndex
                      )
                      .map(
                        (
                          question,
                          index
                        ) => ({
                          ...question,
                          number:
                            index +
                            1,
                        })
                      );

                  return {
                    ...group,
                    questions,
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  // =======================================================
  // OPTIONS
  // =======================================================

  function addOption(
    groupIndex,
    questionIndex
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  gi
                ) => {
                  if (
                    gi !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const questions =
                    group.questions.map(
                      (
                        question,
                        qi
                      ) => {
                        if (
                          qi !==
                          questionIndex
                        ) {
                          return question;
                        }

                        return {
                          ...question,
                          options: [
                            ...question.options,
                            "",
                          ],
                        };
                      }
                    );

                  return {
                    ...group,
                    questions,
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  function updateOption(
    groupIndex,
    questionIndex,
    optionIndex,
    value
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  gi
                ) => {
                  if (
                    gi !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const questions =
                    group.questions.map(
                      (
                        question,
                        qi
                      ) => {
                        if (
                          qi !==
                          questionIndex
                        ) {
                          return question;
                        }

                        const options =
                          [
                            ...question.options,
                          ];

                        options[
                          optionIndex
                        ] =
                          value;

                        return {
                          ...question,
                          options,
                        };
                      }
                    );

                  return {
                    ...group,
                    questions,
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  function removeOption(
    groupIndex,
    questionIndex,
    optionIndex
  ) {
    setSections(
      (prev) =>
        prev.map(
          (section) => {
            if (
              section.number !==
              activeSection
            ) {
              return section;
            }

            const groups =
              section.question_groups.map(
                (
                  group,
                  gi
                ) => {
                  if (
                    gi !==
                    groupIndex
                  ) {
                    return group;
                  }

                  const questions =
                    group.questions.map(
                      (
                        question,
                        qi
                      ) => {
                        if (
                          qi !==
                          questionIndex
                        ) {
                          return question;
                        }

                        const options =
                          question.options.filter(
                            (
                              _,
                              oi
                            ) =>
                              oi !==
                              optionIndex
                          );

                        return {
                          ...question,
                          options,
                        };
                      }
                    );

                  return {
                    ...group,
                    questions,
                  };
                }
              );

            return {
              ...section,
              question_groups:
                groups,
            };
          }
        )
    );
  }


  // =======================================================
  // SAVE TEST
  // =======================================================

  const saveTest = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let testId = test.id;

      // =====================================================
      // 1. YANGI TEST YARATISH
      // =====================================================

      if (!testId) {
        const formData = new FormData();

        formData.append(
          "title",
          test.title || ""
        );

        formData.append(
          "description",
          test.description || ""
        );

        formData.append(
          "is_published",
          test.is_published
            ? "true"
            : "false"
        );

        if (audioFile) {
          formData.append(
            "audio",
            audioFile
          );
        }

        console.log("TEST YARATILMOQDA...");

        const response = await api.post(
          "listening/admin/tests/",
          formData
        );

        testId = response.data.id;

        console.log(
          "YANGI TEST ID:",
          testId
        );

        if (!testId) {
          throw new Error(
            "Backend test ID qaytarmadi."
          );
        }
      }

      // =====================================================
      // 2. TEST DETAILNI BACKENDDAN QAYTA OLISH
      // =====================================================

      console.log(
        "TEST DETAIL QAYTA OLINMOQDA:",
        testId
      );

      const detailResponse =
        await api.get(
          `listening/admin/tests/${testId}/`
        );

      console.log(
        "BACKEND TEST DETAIL:",
        detailResponse.data
      );

      const backendSections = (
        detailResponse.data.sections || []
      ).map(normalizeSection);

      console.log(
        "BACKEND SECTIONLAR:",
        backendSections
      );

      if (
        backendSections.length === 0
      ) {
        throw new Error(
          "Backendda ushbu test uchun Sectionlar topilmadi."
        );
      }

      // =====================================================
      // 3. FRONTEND MA'LUMOT + BACKEND ID
      // =====================================================

      const sectionsToSave =
        DEFAULT_SECTIONS.map(
          (number) => {

            // Hozirgi React state
            const localSection =
              sections.find(
                (section) =>
                  Number(
                    section.number
                  ) === number
              );

            // Backenddagi haqiqiy section
            const backendSection =
              backendSections.find(
                (section) =>
                  Number(
                    section.number
                  ) === number
              );

            console.log(
              `SECTION ${number} MERGE:`,
              {
                localSection,
                backendSection,
              }
            );

            if (!backendSection) {
              throw new Error(
                `Section ${number} backenddan topilmadi.`
              );
            }

            if (!backendSection.id) {
              throw new Error(
                `Section ${number} backenddan ID qaytarmadi.`
              );
            }

            return {
              // frontenddagi title,
              // instructions,
              // groups,
              // questions saqlanadi
              ...(localSection ||
                emptySection(number)),

              // ID FAQAT backenddan
              id:
                backendSection.id,

              // test ham backenddan
              test:
                backendSection.test ||
                testId,

              number:
                backendSection.number ||
                number,

              title:
                localSection?.title ||
                backendSection.title ||
                `Section ${number}`,

              instructions:
                localSection?.instructions ??
                backendSection.instructions ??
                "",

              order:
                localSection?.order ||
                backendSection.order ||
                number,

              question_groups:
                localSection?.question_groups ||
                [],
            };
          }
        );

      console.log(
        "PATCH QILINADIGAN SECTIONLAR:",
        sectionsToSave
      );

      // =====================================================
      // 4. TESTNI UPDATE QILISH
      // =====================================================

      const testFormData =
        new FormData();

      testFormData.append(
        "title",
        test.title || ""
      );

      testFormData.append(
        "description",
        test.description || ""
      );

      testFormData.append(
        "is_published",
        test.is_published
          ? "true"
          : "false"
      );

      if (audioFile) {
        testFormData.append(
          "audio",
          audioFile
        );
      }

      await api.patch(
        `listening/admin/tests/${testId}/`,
        testFormData
      );

      console.log(
        "TEST UPDATE QILINDI:",
        testId
      );

      // =====================================================
      // 5. SECTIONLARNI PATCH QILISH
      // =====================================================

      for (
        const section of sectionsToSave
      ) {
        console.log(
          `SECTION ${section.number} SAQLANMOQDA:`,
          section
        );

        if (!section.id) {
          throw new Error(
            `Section ${section.number} uchun ID topilmadi.`
          );
        }

        const payload = {
          number:
            section.number,

          title:
            section.title ||
            `Section ${section.number}`,

          instructions:
            section.instructions ||
            "",

          order:
            section.order ||
            section.number,

          question_groups:
            section.question_groups ||
            [],
        };

        const sectionResponse =
          await api.patch(
            `listening/admin/sections/${section.id}/`,
            payload
          );

        console.log(
          `SECTION ${section.number} SAQLANDI:`,
          sectionResponse.data
        );
      }

      // =====================================================
      // 6. STATE YANGILASH
      // =====================================================

      setSections(
        sectionsToSave
      );

      setTest(
        (prev) => ({
          ...prev,
          ...detailResponse.data,
          id: testId,
        })
      );

      setAudioFile(null);

      await loadTests();

      setSelectedTestId(
        testId
      );

      setSuccess(
        "Listening test muvaffaqiyatli saqlandi."
      );

    } catch (err) {

      console.error(
        "SAVE LISTENING ERROR:",
        err
      );

      console.error(
        "Status:",
        err.response?.status
      );

      console.error(
        "Response:",
        err.response?.data
      );

      let message =
        "Saqlashda xatolik yuz berdi.";

      if (
        err.response?.status === 401
      ) {
        message =
          "Avtorizatsiya muddati tugagan. Qaytadan login qiling.";

      } else if (
        err.response?.data
      ) {
        message =
          typeof err.response.data ===
          "string"
            ? err.response.data
            : JSON.stringify(
                err.response.data
              );

      } else if (
        err.message
      ) {
        message =
          err.message;
      }

      setError(
        message
      );

    } finally {
      setSaving(false);
    }
  };

  // =======================================================
  // DELETE TEST
  // =======================================================

  async function deleteTest(
    testId
  ) {
    if (
      !window.confirm(
        "Bu Listening test va barcha section/questionlar o'chiriladi. Davom etasizmi?"
      )
    ) {
      return;
    }

    try {
      setError("");

      await api.delete(
        `listening/admin/tests/${testId}/`
      );

      if (
        selectedTestId ===
        testId
      ) {
        closeEditor();
      }

      await loadTests();

      setSuccess(
        "Listening test o'chirildi."
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Testni o'chirishda xatolik."
      );
    }
  }


  // =======================================================
  // RENDER TEST LIST
  // =======================================================

  if (!creating) {
    return (
      <div className="lap-page">

        <div className="lap-page-head">

          <div>
            <div className="lap-eyebrow">
              IELTS LISTENING
            </div>

            <h1>
              Listening Tests
            </h1>

            <p>
              Listening testlar,
              audio va savollarni
              boshqaring.
            </p>
          </div>

          <button
            className="lap-primary-btn"
            onClick={
              createNewTest
            }
          >
            <span>
              +
            </span>

            Yangi Listening test
          </button>

        </div>


        {error && (
          <div className="lap-alert error">
            {error}
          </div>
        )}

        {success && (
          <div className="lap-alert success">
            {success}
          </div>
        )}


        <div className="lap-toolbar">

          <div className="lap-search">
            <span>
              ⌕
            </span>

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Listening test qidirish..."
            />
          </div>

          <div className="lap-count">
            {filteredTests.length}
            {" "}
            ta test
          </div>

        </div>


        {loading ? (
          <div className="lap-loading">
            <div className="lap-spinner" />
            <p>
              Listening testlar
              yuklanmoqda...
            </p>
          </div>
        ) : filteredTests.length ===
          0 ? (
          <div className="lap-empty">

            <div className="lap-empty-icon">
              🎧
            </div>

            <h2>
              Hozircha Listening test yo'q
            </h2>

            <p>
              Birinchi Listening
              testingizni yarating.
            </p>

            <button
              className="lap-primary-btn"
              onClick={
                createNewTest
              }
            >
              + Test yaratish
            </button>

          </div>
        ) : (
          <div className="lap-test-grid">

            {filteredTests.map(
              (item) => (
                <article
                  className="lap-test-card"
                  key={
                    item.id
                  }
                >

                  <div className="lap-card-top">

                    <div className="lap-audio-icon">
                      🎧
                    </div>

                    <span
                      className={`lap-status ${
                        item.is_published
                          ? "published"
                          : "draft"
                      }`}
                    >
                      {item.is_published
                        ? "Published"
                        : "Draft"}
                    </span>

                  </div>


                  <h3>
                    {item.title}
                  </h3>

                  <p>
                    {item.description ||
                      "IELTS Listening test"}
                  </p>


                  <div className="lap-meta">

                    <span>
                      🎧 Audio
                    </span>

                    <span>
                      4 Sections
                    </span>

                    <span>
                      {item.section_count ??
                        item.sections?.length ??
                        0}{" "}
                      sections
                    </span>

                  </div>


                  <div className="lap-card-actions">

                    <button
                      className="lap-edit-btn"
                      onClick={() =>
                        openTest(
                          item.id
                        )
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="lap-delete-btn"
                      onClick={() =>
                        deleteTest(
                          item.id
                        )
                      }
                    >
                      Delete
                    </button>

                  </div>

                </article>
              )
            )}

          </div>
        )}
      </div>
    );
  }


  // =======================================================
  // EDITOR
  // =======================================================

  const activeSectionData =
    getActiveSection();


  const totalQuestions =
    sections.reduce(
      (
        total,
        section
      ) =>
        total +
        section.question_groups.reduce(
          (
            groupTotal,
            group
          ) =>
            groupTotal +
            group.questions.length,
          0
        ),
      0
    );


  return (
    <div className="lap-page">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="lap-editor-head">

        <div className="lap-editor-title">

          <button
            className="lap-back-btn"
            onClick={
              closeEditor
            }
          >
            ←
          </button>

          <div>

            <div className="lap-eyebrow">
              LISTENING EDITOR
            </div>

            <h1>
              {test?.id
                ? "Listening testni tahrirlash"
                : "Yangi Listening test"}
            </h1>

          </div>

        </div>


        <div className="lap-editor-actions">

          <button
            className="lap-secondary-btn"
            onClick={
              closeEditor
            }
          >
            Cancel
          </button>

          <button
            className="lap-primary-btn"
            disabled={
              saving
            }
            onClick={
              saveTest
            }
          >
            {saving
              ? "Saqlanmoqda..."
              : "✓ Saqlash"}
          </button>

        </div>

      </div>


      {error && (
        <div className="lap-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="lap-alert success">
          {success}
        </div>
      )}


      {/* ================================================= */}
      {/* TEST INFORMATION */}
      {/* ================================================= */}

      <div className="lap-editor-grid">

        <section className="lap-card">

          <div className="lap-card-header">

            <div>
              <span>
                TEST INFORMATION
              </span>

              <h2>
                Asosiy ma'lumotlar
              </h2>
            </div>

            <div className="lap-step">
              01
            </div>

          </div>


          <div className="lap-form-grid">

            <div className="lap-field full">

              <label>
                Test nomi
              </label>

              <input
                type="text"
                value={
                  test?.title ||
                  ""
                }
                onChange={(
                  event
                ) =>
                  updateTestField(
                    "title",
                    event.target.value
                  )
                }
                placeholder="IELTS Listening Test 1"
              />

            </div>


            <div className="lap-field full">

              <label>
                Description
              </label>

              <textarea
                rows="4"
                value={
                  test?.description ||
                  ""
                }
                onChange={(
                  event
                ) =>
                  updateTestField(
                    "description",
                    event.target.value
                  )
                }
                placeholder="Full IELTS Listening practice test..."
              />

            </div>


            <div className="lap-field">

              <label>
                Duration
              </label>

              <div className="lap-readonly-field">
                <strong>
                  40
                </strong>

                <span>
                  minutes
                </span>
              </div>

            </div>


            <div className="lap-field">

              <label>
                Status
              </label>

              <label className="lap-switch-row">

                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      test?.is_published
                    )
                  }
                  onChange={(
                    event
                  ) =>
                    updateTestField(
                      "is_published",
                      event.target.checked
                    )
                  }
                />

                <span className="lap-switch" />

                <span>
                  {test?.is_published
                    ? "Published"
                    : "Draft"}
                </span>

              </label>

            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* AUDIO */}
        {/* ================================================= */}

        <section className="lap-card lap-audio-card">

          <div className="lap-card-header">

            <div>
              <span>
                AUDIO
              </span>

              <h2>
                Listening audio
              </h2>
            </div>

            <div className="lap-step">
              02
            </div>

          </div>


          <div className="lap-audio-box">

            <div className="lap-big-audio-icon">
              🎧
            </div>

            <div className="lap-audio-info">

              <strong>
                Bitta umumiy audio
              </strong>

              <p>
                Bu audio Section 1,
                2, 3 va 4 uchun
                ishlatiladi.
              </p>

              {test?.audio_url && (
                <audio
                  controls
                  src={
                    test.audio_url
                  }
                />
              )}

            </div>

          </div>


          <label className="lap-upload">

            <input
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,audio/*"
              onChange={(
                event
              ) => {
                const file =
                  event.target
                    .files?.[0] ||
                  null;

                setAudioFile(
                  file
                );
              }}
            />

            <div className="lap-upload-icon">
              ↑
            </div>

            <div>

              <strong>
                {audioFile
                  ? audioFile.name
                  : test?.audio_url
                    ? "Yangi audio tanlash"
                    : "Audio fayl tanlang"}
              </strong>

              <span>
                MP3, WAV, M4A yoki OGG
              </span>

            </div>

          </label>

        </section>

      </div>


      {/* ================================================= */}
      {/* SECTIONS */}
      {/* ================================================= */}

      <section className="lap-card lap-sections-card">

        <div className="lap-card-header">

          <div>
            <span>
              TEST STRUCTURE
            </span>

            <h2>
              Listening Sections
            </h2>

            <p className="lap-muted">
              IELTS Listening odatda
              4 ta sectiondan iborat.
            </p>
          </div>

          <div className="lap-summary">

            <div>
              <strong>
                {totalQuestions}
              </strong>

              <span>
                Questions
              </span>
            </div>

            <div>
              <strong>
                4
              </strong>

              <span>
                Sections
              </span>
            </div>

          </div>

        </div>


        {/* SECTION TABS */}

        <div className="lap-section-tabs">

          {DEFAULT_SECTIONS.map(
            (number) => {
              const section =
                sections.find(
                  (
                    item
                  ) =>
                    item.number ===
                    number
                );

              const questionCount =
                section?.question_groups?.reduce(
                  (
                    total,
                    group
                  ) =>
                    total +
                    group.questions.length,
                  0
                ) ||
                0;

              return (
                <button
                  type="button"
                  key={
                    number
                  }
                  className={`lap-section-tab ${
                    activeSection ===
                    number
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActiveSection(
                      number
                    )
                  }
                >

                  <span className="lap-tab-number">
                    {number}
                  </span>

                  <span className="lap-tab-content">

                    <strong>
                      Section{" "}
                      {number}
                    </strong>

                    <small>
                      {questionCount}{" "}
                      questions
                    </small>

                  </span>

                </button>
              );
            }
          )}

        </div>


        {/* ACTIVE SECTION */}

        {activeSectionData && (
          <div className="lap-section-editor">

            <div className="lap-section-info">

              <div className="lap-section-number-large">
                {activeSection}
              </div>

              <div className="lap-section-fields">

                <div className="lap-field">

                  <label>
                    Section title
                  </label>

                  <input
                    value={
                      activeSectionData.title
                    }
                    onChange={(
                      event
                    ) =>
                      updateSection(
                        activeSection,
                        "title",
                        event.target.value
                      )
                    }
                    placeholder={`Section ${activeSection}`}
                  />

                </div>


                <div className="lap-field">

                  <label>
                    Instructions
                  </label>

                  <textarea
                    rows="3"
                    value={
                      activeSectionData.instructions
                    }
                    onChange={(
                      event
                    ) =>
                      updateSection(
                        activeSection,
                        "instructions",
                        event.target.value
                      )
                    }
                    placeholder="Listen and answer questions..."
                  />

                </div>

              </div>

            </div>


            {/* GROUPS */}

            <div className="lap-groups-header">

              <div>

                <span>
                  QUESTION GROUPS
                </span>

                <h3>
                  Savol bloklari
                </h3>

              </div>

              <button
                type="button"
                className="lap-add-btn"
                onClick={
                  addGroup
                }
              >
                + Question Group
              </button>

            </div>


            {activeSectionData.question_groups.length ===
            0 ? (
              <div className="lap-no-groups">

                <div>
                  +
                </div>

                <h3>
                  Hali question group yo'q
                </h3>

                <p>
                  Savollarni boshlash
                  uchun question group
                  qo'shing.
                </p>

                <button
                  className="lap-primary-btn"
                  onClick={
                    addGroup
                  }
                >
                  + Group qo'shish
                </button>

              </div>
            ) : (
              <div className="lap-groups">

                {activeSectionData.question_groups.map(
                  (
                    group,
                    groupIndex
                  ) => (
                    <div
                      className="lap-group-card"
                      key={
                        group.id ||
                        `group-${groupIndex}`
                      }
                    >

                      {/* GROUP HEADER */}

                      <div className="lap-group-top">

                        <div className="lap-group-number">
                          {groupIndex +
                            1}
                        </div>

                        <div className="lap-group-title">

                          <input
                            value={
                              group.title
                            }
                            onChange={(
                              event
                            ) =>
                              updateGroup(
                                groupIndex,
                                "title",
                                event.target.value
                              )
                            }
                            placeholder="Questions 1-10"
                          />

                          <span>
                            Group{" "}
                            {groupIndex +
                              1}
                          </span>

                        </div>


                        <div className="lap-group-type">

                          <select
                            value={
                              group.question_type
                            }
                            onChange={(
                              event
                            ) =>
                              updateGroup(
                                groupIndex,
                                "question_type",
                                event.target.value
                              )
                            }
                          >
                            {QUESTION_TYPES.map(
                              (
                                type
                              ) => (
                                <option
                                  key={
                                    type.value
                                  }
                                  value={
                                    type.value
                                  }
                                >
                                  {
                                    type.label
                                  }
                                </option>
                              )
                            )}
                          </select>

                        </div>


                        <button
                          type="button"
                          className="lap-icon-delete"
                          onClick={() =>
                            removeGroup(
                              groupIndex
                            )
                          }
                        >
                          🗑
                        </button>

                      </div>


                      {/* GROUP INSTRUCTIONS */}

                      <div className="lap-group-instructions">

                        <div className="lap-field">

                          <label>
                            Instructions
                          </label>

                          <textarea
                            rows="2"
                            value={
                              group.instructions
                            }
                            onChange={(
                              event
                            ) =>
                              updateGroup(
                                groupIndex,
                                "instructions",
                                event.target.value
                              )
                            }
                            placeholder="Choose the correct answer, A, B or C."
                          />

                        </div>

                      </div>


                      {/* QUESTIONS */}

                      <div className="lap-questions-header">

                        <div>

                          <span>
                            QUESTIONS
                          </span>

                          <strong>
                            {
                              group.questions.length
                            }
                          </strong>

                        </div>

                        <button
                          type="button"
                          className="lap-small-add"
                          onClick={() =>
                            addQuestion(
                              groupIndex
                            )
                          }
                        >
                          + Question
                        </button>

                      </div>


                      <div className="lap-questions">

                        {group.questions.map(
                          (
                            question,
                            questionIndex
                          ) => (
                            <div
                              className="lap-question-card"
                              key={
                                question.id ||
                                `question-${groupIndex}-${questionIndex}`
                              }
                            >

                              <div className="lap-question-head">

                                <div className="lap-question-num">
                                  {
                                    question.number
                                  }
                                </div>

                                <div>

                                  <span>
                                    Question{" "}
                                    {
                                      question.number
                                    }
                                  </span>

                                  <strong>
                                    {
                                      group.question_type
                                    }
                                  </strong>

                                </div>


                                <button
                                  type="button"
                                  className="lap-question-delete"
                                  onClick={() =>
                                    removeQuestion(
                                      groupIndex,
                                      questionIndex
                                    )
                                  }
                                >
                                  Remove
                                </button>

                              </div>


                              <div className="lap-question-body">

                                <div className="lap-field full">

                                  <label>
                                    Savol / prompt
                                  </label>

                                  <textarea
                                    rows="3"
                                    value={
                                      question.prompt
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateQuestion(
                                        groupIndex,
                                        questionIndex,
                                        "prompt",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Enter the question..."
                                  />

                                </div>


                                {/* OPTIONS */}

                                {(
                                  group.question_type ===
                                    "multiple_choice" ||
                                  group.question_type ===
                                    "multiple_answer" ||
                                  group.question_type ===
                                    "matching"
                                ) && (
                                  <div className="lap-options-area">

                                    <div className="lap-options-header">

                                      <label>
                                        Options
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          addOption(
                                            groupIndex,
                                            questionIndex
                                          )
                                        }
                                      >
                                        + Option
                                      </button>

                                    </div>


                                    {question.options.length ===
                                    0 ? (
                                      <div className="lap-no-options">
                                        Variant qo'shilmagan.
                                      </div>
                                    ) : (
                                      <div className="lap-options">

                                        {question.options.map(
                                          (
                                            option,
                                            optionIndex
                                          ) => (
                                            <div
                                              className="lap-option-row"
                                              key={
                                                optionIndex
                                              }
                                            >

                                              <span>
                                                {String.fromCharCode(
                                                  65 +
                                                    optionIndex
                                                )}
                                              </span>

                                              <input
                                                value={
                                                  option
                                                }
                                                onChange={(
                                                  event
                                                ) =>
                                                  updateOption(
                                                    groupIndex,
                                                    questionIndex,
                                                    optionIndex,
                                                    event.target.value
                                                  )
                                                }
                                                placeholder={`Option ${String.fromCharCode(
                                                  65 +
                                                    optionIndex
                                                )}`}
                                              />

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeOption(
                                                    groupIndex,
                                                    questionIndex,
                                                    optionIndex
                                                  )
                                                }
                                              >
                                                ×
                                              </button>

                                            </div>
                                          )
                                        )}

                                      </div>
                                    )}
                                  </div>
                                )}


                                {/* CORRECT ANSWER */}

                                <div className="lap-answer-grid">

                                  <div className="lap-field">

                                    <label>
                                      Correct answer
                                    </label>

                                    <input
                                      value={
                                        Array.isArray(
                                          question.correct_answer
                                        )
                                          ? question.correct_answer.join(
                                              ", "
                                            )
                                          : question.correct_answer
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        const value =
                                          event.target.value;

                                        if (
                                          group.question_type ===
                                          "multiple_answer"
                                        ) {
                                          updateQuestion(
                                            groupIndex,
                                            questionIndex,
                                            "correct_answer",
                                            value
                                              .split(
                                                ","
                                              )
                                              .map(
                                                (
                                                  item
                                                ) =>
                                                  item.trim()
                                              )
                                              .filter(
                                                Boolean
                                              )
                                          );
                                        } else {
                                          updateQuestion(
                                            groupIndex,
                                            questionIndex,
                                            "correct_answer",
                                            value
                                          );
                                        }
                                      }}
                                      placeholder={
                                        group.question_type ===
                                        "multiple_answer"
                                          ? "A, C"
                                          : "A"
                                      }
                                    />

                                    <small>
                                      Multiple answer uchun:
                                      <b>
                                        A, C
                                      </b>
                                    </small>

                                  </div>


                                  <div className="lap-field">

                                    <label>
                                      Points
                                    </label>

                                    <input
                                      type="number"
                                      min="1"
                                      value={
                                        question.points
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateQuestion(
                                          groupIndex,
                                          questionIndex,
                                          "points",
                                          Number(
                                            event.target.value
                                          )
                                        )
                                      }
                                    />

                                  </div>

                                </div>


                                <div className="lap-field full">

                                  <label>
                                    Explanation
                                  </label>

                                  <textarea
                                    rows="2"
                                    value={
                                      question.explanation
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateQuestion(
                                        groupIndex,
                                        questionIndex,
                                        "explanation",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Why is this answer correct?"
                                  />

                                </div>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </div>
        )}

      </section>


      {/* ================================================= */}
      {/* BOTTOM SAVE */}
      {/* ================================================= */}

      <div className="lap-bottom-save">

        <div>

          <strong>
            {totalQuestions}
          </strong>

          <span>
            ta savol
          </span>

        </div>

        <div>

          <button
            className="lap-secondary-btn"
            onClick={
              closeEditor
            }
          >
            Cancel
          </button>

          <button
            className="lap-primary-btn"
            disabled={
              saving
            }
            onClick={
              saveTest
            }
          >
            {saving
              ? "Saqlanmoqda..."
              : "✓ Listening testni saqlash"}
          </button>

        </div>

      </div>

    </div>
  );
}