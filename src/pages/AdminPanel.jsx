import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./AdminPanel.css";

const PASSAGE_TYPES = [
  { id: "general", title: "General Interest", description: "Kundalik hayot, e'lonlar, umumiy mavzular", icon: "🌍" },
  { id: "social", title: "Social & Work", description: "Ish, ta'lim, jamiyat", icon: "🏢" },
  { id: "academic", title: "Academic", description: "Ilm-fan, tarix, tabiat", icon: "🎓" },
];
const DEFAULT_START = { 1: 1, 2: 14, 3: 27 };
const FORMAT_LABEL = {
  full: "Full Test",
  passage_1: "Passage 1",
  passage_2: "Passage 2",
  passage_3: "Passage 3",
};

const QUESTION_TYPES = [
  { id: "multiple_choice", label: "Multiple Choice", short: "MCQ", instructions: "Choose the correct letter, A, B, C or D." },
  {
    id: "true_false_not_given",
    label: "True / False / Not Given",
    short: "T/F/NG",
    instructions:
      "Do the following statements agree with the information given in the Reading Passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.",
  },
  {
    id: "yes_no_not_given",
    label: "Yes / No / Not Given",
    short: "Y/N/NG",
    instructions:
      "Do the following statements agree with the views of the writer in the Reading Passage? Write YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, NOT GIVEN if it is impossible to say what the writer thinks about this.",
  },
  { id: "sentence_completion", label: "Sentence Completion", short: "Sentence", instructions: "Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer." },
  { id: "short_answer", label: "Short Answer", short: "Short", instructions: "Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer." },
  {
    id: "matching_headings",
    label: "Matching Headings",
    short: "Headings",
    instructions: "The Reading Passage has several paragraphs. Choose the correct heading for each paragraph from the list of headings below.",
  },
  { id: "matching_information", label: "Matching Information", short: "Matching", instructions: "Which paragraph contains the following information? Write the correct letter." },
  { id: "summary_completion", label: "Summary Completion", short: "Summary", instructions: "Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer." },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const letter = (i) => String.fromCharCode(65 + i);
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi"];
const splitAlts = (s) => s.split("/").map((x) => x.trim()).filter(Boolean);
const gapCount = (text) => (text.match(/_{3,}/g) || []).length;
const typeMeta = (id) => QUESTION_TYPES.find((t) => t.id === id);
const emptyBlocks = () => [{ uid: uid(), type: "paragraph", text: "" }];
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function newItem(type) {
  if (type === "multiple_choice") return { uid: uid(), prompt: "", options: ["", "", "", ""], answer: "" };
  return { uid: uid(), prompt: "", answer: "" };
}
function newGroup(type) {
  return {
    uid: uid(),
    type,
    title: "",
    instructions: typeMeta(type).instructions,
    items: type === "summary_completion" ? [] : [newItem(type)],
    choices: "",
    summary: "",
  };
}
function cloneGroup(g) {
  return { ...g, uid: uid(), items: g.items.map((it) => ({ ...it, uid: uid(), options: it.options ? [...it.options] : undefined })) };
}
function moveItem(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
function parsePaste(raw) {
  return raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("#")
        ? { uid: uid(), type: "heading", text: s.replace(/^#+\s*/, "") }
        : { uid: uid(), type: "paragraph", text: s }
    );
}
function serializePassage(blocks, labelled) {
  let p = 0;
  return blocks
    .filter((b) => b.text.trim())
    .map((b) => {
      const t = b.text.trim();
      if (b.type === "heading") return `## ${t}`;
      return labelled ? `[${letter(p++)}] ${t}` : t;
    })
    .join("\n\n");
}
function isAnswered(g, it) {
  if (g.type === "matching_headings") return !!it.prompt && !!it.answer;
  return String(it.answer).trim() !== "" && (g.type === "summary_completion" || !!it.prompt.trim());
}
function buildQuestions(g, startNo) {
  const base = (i) => ({ number: startNo + i, points: 1 });
  const headingList = lines(g.choices);
  return g.items.map((it, i) => {
    switch (g.type) {
      case "multiple_choice":
        return { ...base(i), prompt: it.prompt.trim(), options: it.options.map((o, k) => `${letter(k)}. ${o.trim()}`), correct_answer: it.answer };
      case "true_false_not_given":
        return { ...base(i), prompt: it.prompt.trim(), options: ["TRUE", "FALSE", "NOT GIVEN"], correct_answer: it.answer };
      case "yes_no_not_given":
        return { ...base(i), prompt: it.prompt.trim(), options: ["YES", "NO", "NOT GIVEN"], correct_answer: it.answer };
      case "matching_headings":
        return { ...base(i), prompt: `Paragraph ${it.prompt}`, options: headingList.map((h, k) => `${ROMAN[k]}. ${h}`), correct_answer: it.answer };
      case "matching_information":
        return { ...base(i), prompt: it.prompt.trim(), options: g._letters, correct_answer: it.answer };
      case "summary_completion":
        return { ...base(i), prompt: `Gap ${startNo + i}`, options: [], correct_answer: splitAlts(it.answer) };
      default:
        return { ...base(i), prompt: it.prompt.trim(), options: [], correct_answer: splitAlts(it.answer) };
    }
  });
}

function answerToText(value) {
  if (Array.isArray(value)) return value.join(" / ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function parsePassageBlocks(content) {
  const chunks = String(content || "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const parsed = chunks.map((chunk) => {
    if (chunk.startsWith("## ")) return { uid: uid(), type: "heading", text: chunk.slice(3).trim() };
    return { uid: uid(), type: "paragraph", text: chunk.replace(/^\[[A-Z]\]\s*/, "").trim() };
  });
  return parsed.length ? parsed : emptyBlocks();
}

function parsePassageGroups(rawGroups) {
  return (rawGroups || []).map((raw) => {
    const type = raw.question_type || raw.type || "multiple_choice";
    let instructions = raw.instructions || typeMeta(type)?.instructions || "";
    let summary = "";
    const marker = instructions.indexOf("[[SUMMARY]]");
    if (marker >= 0) {
      summary = instructions.slice(marker + "[[SUMMARY]]".length).trim();
      instructions = instructions.slice(0, marker).trim();
      summary = summary.replace(/\[(\d+)\]/g, "____");
    }
    const rawItems = raw.questions || raw.items || [];
    const choices = type === "matching_headings"
      ? [...new Set(rawItems.flatMap((q) => (q.options || []).map((o) => String(o).replace(/^[ivxlcdm]+\.\s*/i, ""))))].join("\n")
      : "";
    const items = rawItems.map((q) => {
      const answer = answerToText(q.correct_answer ?? q.answer);
      const prompt = String(q.prompt || "").replace(/^Paragraph\s+/i, "");
      if (type === "multiple_choice") {
        const opts = (q.options || []).map((o) => String(o).replace(/^[A-F]\.\s*/, ""));
        while (opts.length < 4) opts.push("");
        return { uid: uid(), prompt, options: opts, answer };
      }
      if (type === "matching_headings") {
        return { uid: uid(), prompt, answer: answer.replace(/^[ivxlcdm]+\.\s*/i, "") };
      }
      if (type === "summary_completion") return { uid: uid(), prompt: "", answer };
      return { uid: uid(), prompt, answer };
    });
    return {
      uid: uid(),
      type,
      title: raw.title || "",
      instructions,
      items: type === "summary_completion" && !items.length ? [] : items,
      choices,
      summary,
    };
  });
}

const draftKey = (testId, n) => `ap-draft:${testId}:${n}`;
const readDraft = (testId, n) => {
  try {
    const raw = localStorage.getItem(draftKey(testId, n));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeDraft = (testId, n, data) => {
  try { localStorage.setItem(draftKey(testId, n), JSON.stringify(data)); } catch {  }
};
const dropDraft = (testId, n) => {
  try { localStorage.removeItem(draftKey(testId, n)); } catch {  }
};

function ChoiceButtons({ options, value, onChange }) {
  return (
    <div className="ap-seg">
      {options.map((o) => (
        <button type="button" key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Shell({ active, onNav, onLogout, theme, onTheme, children }) {
  const items = [
    { id: "", icon: "◧", label: "Bosh sahifa" },
    { id: "reading", icon: "▤", label: "Reading" },
    { id: "listening", icon: "♪", label: "Listening" },
  ];
  return (
    <div className="ap-shell">
      <aside className="ap-rail">
        <div className="ap-brand">
          <span className="ap-logo">E</span>
          <div>
            <strong>englishCenter</strong>
            <small>Admin studio</small>
          </div>
        </div>
        <nav>
          {items.map((it) => (
            <button key={it.id} className={`ap-nav ${active === it.id ? "active" : ""}`} onClick={() => onNav(it.id)}>
              <i>{it.icon}</i>
              <span>{it.label}</span>
            </button>
          ))}
        </nav>
        <div className="ap-rail-foot">
          <button className="ap-nav" onClick={onTheme}>
            <i>{theme === "dark" ? "☀" : "☾"}</i>
            <span>{theme === "dark" ? "Yorug‘ rejim" : "Qorong‘i rejim"}</span>
          </button>
          <button className="ap-nav" onClick={onLogout}>
            <i>⎋</i>
            <span>Chiqish</span>
          </button>
        </div>
      </aside>
      <div className="ap-body">{children}</div>
    </div>
  );
}

function Toast({ text, kind, onClose }) {
  useEffect(() => {
    if (!text || kind === "error") return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [text, kind, onClose]);
  if (!text) return null;
  return (
    <div className={`ap-toast ${kind}`} role="status">
      <span>{text}</span>
      <button type="button" onClick={onClose} aria-label="Yopish">✕</button>
    </div>
  );
}

function GroupEditor({ group, index, total, startNo, letters, open, onToggle, onPatch, onItem, onAddItem, onRemoveItem, onRemove, onMove, onDuplicate }) {
  const meta = typeMeta(group.type);
  const count = group.items.length;
  const endNo = startNo + Math.max(count, 1) - 1;
  const headingList = lines(group.choices);
  const answered = group.items.filter((it) => isAnswered(group, it)).length;
  const num = (i) => startNo + i;

  function changeType(type) {
    if (count && !window.confirm("Savol turi o‘zgarsa, shu guruhdagi savollar tozalanadi. Davom etasizmi?")) return;
    onPatch({ ...newGroup(type), uid: group.uid });
  }
  function changeSummary(text) {
    const n = gapCount(text);
    const items = Array.from({ length: n }, (_, i) => group.items[i] || newItem("summary_completion"));
    onPatch({ summary: text, items });
  }

  return (
    <div className={`ap-group ${open ? "open" : ""}`}>
      <div className="ap-group-head" onClick={onToggle}>
        <span className="ap-range">{count ? (count > 1 ? `${startNo}–${endNo}` : startNo) : "—"}</span>
        <div className="ap-group-title">
          <strong>{meta.label}</strong>
          <small>
            {count} ta savol · {answered === count && count > 0 ? "javoblar to‘liq" : `${answered}/${count} to‘ldirilgan`}
          </small>
        </div>
        <div className="ap-tools" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Yuqoriga">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Pastga">↓</button>
          <button type="button" onClick={onDuplicate} title="Nusxalash">⧉</button>
          <button type="button" className="danger" onClick={onRemove} title="Guruhni o‘chirish">✕</button>
        </div>
        <span className="ap-chevron">{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div className="ap-group-body">
          <div className="ap-form">
            <div className="ap-row-2">
              <div>
                <label>Savol turi</label>
                <select value={group.type} onChange={(e) => changeType(e.target.value)}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Guruh sarlavhasi (ixtiyoriy)</label>
                <input value={group.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder={`Questions ${startNo}–${endNo}`} />
              </div>
            </div>

            <label>Ko‘rsatma</label>
            <textarea rows={3} value={group.instructions} onChange={(e) => onPatch({ instructions: e.target.value })} />

            {group.type === "matching_headings" && (
              <>
                <label>List of Headings — har qatorda bittadan</label>
                <textarea
                  rows={6}
                  value={group.choices}
                  onChange={(e) => onPatch({ choices: e.target.value })}
                  placeholder={"The rise of urban farming\nA surprising discovery\nEconomic consequences"}
                />
                {headingList.length > 0 && (
                  <div className="ap-hint-list">
                    {headingList.map((h, k) => (
                      <span key={k}><b>{ROMAN[k]}</b> {h}</span>
                    ))}
                  </div>
                )}
              </>
            )}

            {group.type === "summary_completion" && (
              <>
                <label>Summary matni — bo‘sh joyga ____ (4 ta pastki chiziq) yozing</label>
                <textarea
                  rows={6}
                  value={group.summary}
                  onChange={(e) => changeSummary(e.target.value)}
                  placeholder="The city was founded in ____ by traders who needed a ____ along the river."
                />
                <div className="ap-counter">{count} ta bo‘sh joy</div>
              </>
            )}
          </div>

          <div className="ap-qlist">
            {group.items.map((it, i) => {
              const done = isAnswered(group, it);
              return (
                <div className={`ap-qrow ${done ? "done" : ""}`} key={it.uid}>
                  <div className="ap-qnum">{num(i)}</div>
                  <div className="ap-qbody">
                    {group.type === "multiple_choice" && (
                      <>
                        <input value={it.prompt} onChange={(e) => onItem(it.uid, { prompt: e.target.value })} placeholder="Savol matni" />
                        {it.options.map((o, k) => (
                          <div className="ap-opt" key={k}>
                            <button
                              type="button"
                              className={`ap-radio ${it.answer === letter(k) ? "on" : ""}`}
                              onClick={() => onItem(it.uid, { answer: letter(k) })}
                              title="To‘g‘ri javob sifatida belgilash"
                            >
                              {letter(k)}
                            </button>
                            <input
                              value={o}
                              onChange={(e) => onItem(it.uid, { options: it.options.map((x, j) => (j === k ? e.target.value : x)) })}
                              placeholder={`${letter(k)} variant`}
                            />
                            {it.options.length > 2 && (
                              <button
                                type="button"
                                className="ap-mini"
                                onClick={() => onItem(it.uid, { options: it.options.filter((_, j) => j !== k), answer: "" })}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        {it.options.length < 6 && (
                          <button type="button" className="ap-link" onClick={() => onItem(it.uid, { options: [...it.options, ""] })}>
                            ＋ Variant qo‘shish
                          </button>
                        )}
                      </>
                    )}

                    {(group.type === "true_false_not_given" || group.type === "yes_no_not_given") && (
                      <>
                        <textarea rows={2} value={it.prompt} onChange={(e) => onItem(it.uid, { prompt: e.target.value })} placeholder="Statement" />
                        <ChoiceButtons
                          options={group.type === "true_false_not_given" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"]}
                          value={it.answer}
                          onChange={(v) => onItem(it.uid, { answer: v })}
                        />
                      </>
                    )}

                    {(group.type === "sentence_completion" || group.type === "short_answer") && (
                      <>
                        <textarea
                          rows={2}
                          value={it.prompt}
                          onChange={(e) => onItem(it.uid, { prompt: e.target.value })}
                          placeholder={group.type === "sentence_completion" ? "The museum was built in ____ by local workers." : "Savol matni"}
                        />
                        <input
                          value={it.answer}
                          onChange={(e) => onItem(it.uid, { answer: e.target.value })}
                          placeholder="To‘g‘ri javob (muqobillar “/” bilan: colour / color)"
                        />
                      </>
                    )}

                    {group.type === "matching_headings" && (
                      <div className="ap-row-2">
                        <select value={it.prompt} onChange={(e) => onItem(it.uid, { prompt: e.target.value })}>
                          <option value="">Paragraf…</option>
                          {letters.map((l) => (
                            <option key={l} value={l}>Paragraph {l}</option>
                          ))}
                        </select>
                        <select value={it.answer} onChange={(e) => onItem(it.uid, { answer: e.target.value })}>
                          <option value="">Sarlavha…</option>
                          {headingList.map((h, k) => (
                            <option key={k} value={ROMAN[k]}>{ROMAN[k]}. {h}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {group.type === "matching_information" && (
                      <>
                        <textarea rows={2} value={it.prompt} onChange={(e) => onItem(it.uid, { prompt: e.target.value })} placeholder="a reference to a scientific experiment" />
                        <ChoiceButtons options={letters} value={it.answer} onChange={(v) => onItem(it.uid, { answer: v })} />
                      </>
                    )}

                    {group.type === "summary_completion" && (
                      <input
                        value={it.answer}
                        onChange={(e) => onItem(it.uid, { answer: e.target.value })}
                        placeholder={`${num(i)}-bo‘sh joy javobi (muqobillar “/” bilan)`}
                      />
                    )}
                  </div>

                  {group.type !== "summary_completion" && count > 1 && (
                    <button type="button" className="ap-mini" onClick={() => onRemoveItem(it.uid)} title="O‘chirish">✕</button>
                  )}
                </div>
              );
            })}

            {group.type !== "summary_completion" && (
              <button type="button" className="ap-link" onClick={onAddItem}>＋ Savol qo‘shish</button>
            )}
            {group.type === "summary_completion" && count === 0 && (
              <p className="ap-empty">Summary matniga ____ yozing — har bir bo‘sh joy uchun javob maydoni paydo bo‘ladi.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("ap-theme") || "dark"; } catch { return "dark"; }
  });
  const [section, setSection] = useState("");
  const [tests, setTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentPassageId, setCurrentPassageId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFormat, setNewFormat] = useState("full");
  const [newPublished, setNewPublished] = useState(false);

  const [passageNumber, setPassageNumber] = useState("1");
  const [startNo, setStartNo] = useState("1");
  const [passageType, setPassageType] = useState("general");
  const [passageTitle, setPassageTitle] = useState("");
  const [duration, setDuration] = useState("20");
  const [labelled, setLabelled] = useState(true);
  const [blocks, setBlocks] = useState(emptyBlocks);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [groups, setGroups] = useState([]);
  const [closed, setClosed] = useState({}); // groupUid -> true when collapsed
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const [toast, setToast] = useState({ text: "", kind: "info" });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const skipDraft = useRef(false);

  const notify = useCallback((text, kind = "info") => setToast({ text, kind }), []);
  const closeToast = useCallback(() => setToast({ text: "", kind: "info" }), []);

  const testId = selectedTest ? String(selectedTest.id) : "";
  const testFormat = selectedTest?.test_format || newFormat;

  
  useEffect(() => {
    document.documentElement.dataset.apTheme = theme;
    try { localStorage.setItem("ap-theme", theme); } catch {  }
  }, [theme]);

  
  const loadTests = useCallback(async () => {
    setTestsLoading(true);
    try {
      const { data } = await api.get("reading/admin/tests/");
      setTests(Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      notify(
        error.response?.status === 401
          ? "API so‘rovi ruxsatdan o‘tmadi (401). Backend ruxsatlarini tekshiring."
          : "Testlarni yuklab bo‘lmadi. Backend API manzilini tekshiring.",
        "error"
      );
    } finally {
      setTestsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (section === "reading") loadTests();
  }, [section, loadTests]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (filter === "published" && !t.is_published) return false;
      if (filter === "draft" && t.is_published) return false;
      return !q || `${t.title} ${t.description || ""} ${t.id}`.toLowerCase().includes(q);
    });
  }, [tests, search, filter]);

  async function createTest(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("reading/admin/tests/", {
        title: newTitle,
        description: newDesc,
        test_format: newFormat,
        is_published: newPublished,
      });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      notify(`Test yaratildi: ${data.title}`, "success");
      await loadTests();
      openTest(data);
    } catch (error) {
      notify(
        error.response?.status === 403
          ? "Ruxsat yo‘q: backend admin API ruxsatlarini sozlash kerak."
          : "Test yaratilmadi. Backend va API manzilini tekshiring.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  
  const allowedPassages = testFormat === "full" ? ["1", "2", "3"] : [testFormat.replace("passage_", "")];

  function applyLocalDraft(tid, n) {
    const d = readDraft(tid, n);
    setPassageNumber(String(n));
    setCurrentPassageId(null);
    setStartNo(d?.startNo ?? String(DEFAULT_START[n] || 1));
    setPassageType(d?.passageType ?? "general");
    setPassageTitle(d?.passageTitle ?? "");
    setDuration(d?.duration ?? "20");
    setLabelled(d?.labelled ?? true);
    setBlocks(d?.blocks?.length ? d.blocks : emptyBlocks());
    setGroups(d?.groups ?? []);
    setClosed({});
    setErrors([]);
    setDraftSavedAt(d ? new Date() : null);
  }

  async function applyDraft(tid, n) {
    skipDraft.current = true;
    applyLocalDraft(tid, n);
    try {
      const { data } = await api.get("reading/admin/passages/");
      const all = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
      let saved = all.find((p) => String(p.test?.id ?? p.test) === String(tid) && Number(p.number) === Number(n));
      if (!saved) return;
      if (!(saved.question_groups || saved.groups)) {
        try {
          const detail = await api.get(`reading/admin/passages/${saved.id}/`);
          saved = detail.data;
        } catch {}
      }
      skipDraft.current = true;
      setPassageNumber(String(n));
      setCurrentPassageId(saved.id ?? null);
      setStartNo(String(saved.number) === "1" ? "1" : String(saved.number) === "2" ? "14" : "27");
      setPassageTitle(saved.title || "");
      setDuration(String(saved.duration_minutes || 20));
      const content = String(saved.content || "");
      setLabelled(/\[[A-Z]\]\s/.test(content));
      setBlocks(parsePassageBlocks(content));
      setGroups(parsePassageGroups(saved.question_groups || saved.groups || []));
      setPassageType(saved.passage_type || "general");
      setClosed({});
      setErrors([]);
      setDraftSavedAt(null);
      notify(`Passage ${n} va uning savollari backenddan yuklandi.`, "success");
    } catch (error) {
      if (error.response?.status !== 404) {
        notify("Backenddagi mavjud savollarni yuklab bo‘lmadi. Lokal qoralama ko‘rsatildi.", "error");
      }
    }
  }

  function openTest(test) {
    setSelectedTest(test);
    const fmt = test.test_format || "full";
    const first = fmt.startsWith("passage_") ? fmt.replace("passage_", "") : "1";
    applyDraft(String(test.id), first);
    closeToast();
  }

  
  useEffect(() => {
    if (!selectedTest) return;
    if (skipDraft.current) {
      skipDraft.current = false;
      return;
    }
    const empty = !passageTitle && !groups.length && !blocks.some((b) => b.text.trim());
    if (empty) return;
    const t = setTimeout(() => {
      writeDraft(testId, passageNumber, { startNo, passageType, passageTitle, duration, labelled, blocks, groups });
      setDraftSavedAt(new Date());
    }, 700);
    return () => clearTimeout(t);
  }, [selectedTest, testId, passageNumber, startNo, passageType, passageTitle, duration, labelled, blocks, groups]);

  
  const paragraphs = blocks.filter((b) => b.type === "paragraph" && b.text.trim());
  const labels = labelled ? paragraphs.map((_, i) => letter(i)) : [];
  const pickerLetters = labels.length ? labels : ["A", "B", "C", "D", "E", "F", "G"];
  const wordCount = paragraphs.reduce((n, b) => n + b.text.trim().split(/\s+/).length, 0);

  const startNumbers = useMemo(() => {
    let n = Number(startNo) || 1;
    return groups.map((g) => {
      const s = n;
      n += g.items.length;
      return s;
    });
  }, [groups, startNo]);
  const totalQuestions = groups.reduce((n, g) => n + g.items.length, 0);
  const answeredTotal = groups.reduce((n, g) => n + g.items.filter((it) => isAnswered(g, it)).length, 0);
  const progress = totalQuestions ? Math.round((answeredTotal / totalQuestions) * 100) : 0;

  
  const patchBlock = (id, text) => setBlocks((bs) => bs.map((b) => (b.uid === id ? { ...b, text } : b)));
  const addBlock = (type) => setBlocks((bs) => [...bs, { uid: uid(), type, text: "" }]);
  const removeBlock = (id) => setBlocks((bs) => (bs.length > 1 ? bs.filter((b) => b.uid !== id) : bs));
  const moveBlock = (i, dir) => setBlocks((bs) => moveItem(bs, i, dir));
  function applyPaste() {
    const parsed = parsePaste(pasteText);
    if (!parsed.length) return;
    setBlocks(parsed);
    setPasteText("");
    setPasteOpen(false);
    notify(`${parsed.length} ta blok yaratildi.`, "success");
  }

  
  const addGroup = (type) => {
    const g = newGroup(type);
    setGroups((gs) => [...gs, g]);
    setClosed((c) => {
      const next = { ...c };
      groups.forEach((x) => (next[x.uid] = true));
      return next;
    });
  };
  const patchGroup = (id, patch) => setGroups((gs) => gs.map((g) => (g.uid === id ? { ...g, ...patch } : g)));
  const removeGroup = (id) => {
    const g = groups.find((x) => x.uid === id);
    if (g && g.items.length > 1 && !window.confirm("Guruhni va undagi savollarni o‘chirasizmi?")) return;
    setGroups((gs) => gs.filter((x) => x.uid !== id));
  };
  const moveGroup = (i, dir) => setGroups((gs) => moveItem(gs, i, dir));
  const dupGroup = (i) => setGroups((gs) => [...gs.slice(0, i + 1), cloneGroup(gs[i]), ...gs.slice(i + 1)]);
  const patchItem = (gid, iid, patch) =>
    setGroups((gs) => gs.map((g) => (g.uid === gid ? { ...g, items: g.items.map((it) => (it.uid === iid ? { ...it, ...patch } : it)) } : g)));
  const addItem = (gid) => setGroups((gs) => gs.map((g) => (g.uid === gid ? { ...g, items: [...g.items, newItem(g.type)] } : g)));
  const removeItem = (gid, iid) => setGroups((gs) => gs.map((g) => (g.uid === gid ? { ...g, items: g.items.filter((it) => it.uid !== iid) } : g)));
  const toggleGroup = (id) => setClosed((c) => ({ ...c, [id]: !c[id] }));

  
  function validate() {
    const errs = [];
    if (!testId) errs.push("Avval testni tanlang yoki yarating.");
    if (!passageTitle.trim()) errs.push("Passage sarlavhasi bo‘sh.");
    if (!paragraphs.length) errs.push("Passage matniga kamida bitta paragraf kiriting.");
    if (!groups.length) errs.push("Kamida bitta savol guruhi qo‘shing.");

    groups.forEach((g, gi) => {
      const where = `${gi + 1}-guruh (${typeMeta(g.type).label})`;
      if (!g.items.length) errs.push(`${where}: savollar yo‘q.`);
      if (g.type === "matching_headings" && lines(g.choices).length < 2) errs.push(`${where}: List of Headings kamida 2 ta bo‘lsin.`);
      if (g.type === "summary_completion" && !g.summary.trim()) errs.push(`${where}: summary matni bo‘sh.`);
      g.items.forEach((it, i) => {
        const q = `${startNumbers[gi] + i}-savol`;
        const needsPrompt = !["matching_headings", "summary_completion"].includes(g.type);
        if (needsPrompt && !it.prompt.trim()) errs.push(`${q}: savol matni bo‘sh.`);
        if (g.type === "matching_headings" && !it.prompt) errs.push(`${q}: paragraf tanlanmagan.`);
        if (g.type === "multiple_choice" && it.options.some((o) => !o.trim())) errs.push(`${q}: bo‘sh variant bor.`);
        if (!String(it.answer).trim()) errs.push(`${q}: to‘g‘ri javob belgilanmagan.`);
      });
    });
    return errs;
  }

  async function saveAll() {
    const errs = validate();
    setErrors(errs);
    closeToast();
    if (errs.length) {
      document.getElementById("ap-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        test: Number(testId),
        number: Number(passageNumber),
        title: passageTitle.trim(),
        content: serializePassage(blocks, labelled),
        duration_minutes: Number(duration),
        question_groups: groups.map((g, gi) => {
          const start = startNumbers[gi];
          let instructions = g.instructions.trim();
          if (g.type === "summary_completion") {
            let k = 0;
            const text = g.summary.trim().replace(/_{3,}/g, () => `[${start + k++}]`);
            instructions += `\n\n[[SUMMARY]]\n${text}`;
          }
          return {
            title: g.title.trim() || `Questions ${start}–${start + g.items.length - 1}`,
            instructions,
            question_type: g.type,
            order: gi + 1,
            questions: buildQuestions({ ...g, _letters: pickerLetters }, start),
          };
        }),
      };
      let savedResponse;
      if (currentPassageId) {
        savedResponse = await api.patch(`reading/admin/passages/${currentPassageId}/`, payload);
      } else {
        savedResponse = await api.post("reading/admin/passages/", payload);
      }
      if (savedResponse?.data?.id) setCurrentPassageId(savedResponse.data.id);

      notify(`Passage ${passageNumber} va ${totalQuestions} ta savol saqlandi.`, "success");
      dropDraft(testId, passageNumber);
      const idx = allowedPassages.indexOf(String(passageNumber));
      const next = allowedPassages[Math.min(idx + 1, allowedPassages.length - 1)];
      applyDraft(testId, next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      const detail = data ? JSON.stringify(data).slice(0, 300) : "";
      notify(
        status === 401
          ? "Sessiya tugagan: admin (staff) hisobi bilan qayta kiring."
          : status === 403
          ? "Ruxsat yo‘q: bu hisob staff (is_staff) emas."
          : `Saqlanmadi${detail ? `: ${detail}` : ""}. Hech narsa yozilmadi — tuzatib qayta urinib ko‘ring.`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  
  useEffect(() => {
    if (!selectedTest) return;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!loading) saveAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function logout() {
    sessionStorage.removeItem("adminLoggedIn");
    navigate("/admin", { replace: true });
  }
  function nav(id) {
    setSection(id);
    setSelectedTest(null);
    setCurrentPassageId(null);
    closeToast();
  }

  
  if (sessionStorage.getItem("adminLoggedIn") !== "true") {
    return (
      <main className="ap-locked" data-theme={theme}>
        <div className="ap-lock-card">
          <span>🔒</span>
          <h2>Admin panel yopiq</h2>
          <p>Davom etish uchun admin sifatida tizimga kiring.</p>
          <button className="ap-btn primary" onClick={() => navigate("/admin")}>Kirish sahifasi</button>
        </div>
      </main>
    );
  }

  const shell = (children) => (
    <Shell active={section} onNav={nav} onLogout={logout} theme={theme} onTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
      {children}
      <Toast text={toast.text} kind={toast.kind} onClose={closeToast} />
    </Shell>
  );

  if (!section) {
    return shell(
      <main className="ap-page">
        <header className="ap-pagehead">
          <h1>Boshqaruv paneli</h1>
          <p>Qaysi bo‘limda ishlaymiz?</p>
        </header>
        <div className="ap-home">
          <button className="ap-home-card" onClick={() => setSection("reading")}>
            <span className="ap-home-icon">📖</span>
            <h2>Reading</h2>
            <p>Testlar, passage matnlari va savollar</p>
          </button>
          <button className="ap-home-card" onClick={() => setSection("listening")}>
            <span className="ap-home-icon">🎧</span>
            <h2>Listening</h2>
            <p>Audio va savollar (tez orada)</p>
          </button>
        </div>
      </main>
    );
  }

  if (section === "listening") {
    return shell(
      <main className="ap-page">
        <header className="ap-pagehead">
          <h1>Listening</h1>
          <p>Listening uchun alohida audio va savollar backend API modeli kerak. Model tayyor bo‘lgach, shu yerda boshqariladi.</p>
        </header>
      </main>
    );
  }

  
  if (!selectedTest) {
    return shell(
      <main className="ap-page">
        <header className="ap-pagehead row">
          <div>
            <h1>Reading testlari</h1>
            <p>{tests.length} ta test</p>
          </div>
          <button className="ap-btn primary" onClick={() => setShowCreate(true)}>＋ Yangi test</button>
        </header>

        <div className="ap-toolbar">
          <input className="ap-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nomi yoki ID bo‘yicha qidirish…" />
          <div className="ap-seg">
            {[["all", "Hammasi"], ["published", "Nashr qilingan"], ["draft", "Qoralama"]].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>

        {testsLoading ? (
          <div className="ap-skeletons">{[0, 1, 2].map((i) => <div key={i} className="ap-skel" />)}</div>
        ) : filteredTests.length === 0 ? (
          <div className="ap-emptybox">
            <h3>{tests.length ? "Hech narsa topilmadi" : "Hali test yo‘q"}</h3>
            <p>{tests.length ? "Qidiruv yoki filtrni o‘zgartiring." : "Birinchi Reading testini yarating va unga passage qo‘shing."}</p>
            {!tests.length && <button className="ap-btn primary" onClick={() => setShowCreate(true)}>＋ Yangi test</button>}
          </div>
        ) : (
          <div className="ap-testlist">
            {filteredTests.map((t) => (
              <button key={t.id} className="ap-test" onClick={() => openTest(t)}>
                <div className="ap-test-main">
                  <h3>{t.title}</h3>
                  <p>{t.description || "Tavsif kiritilmagan"}</p>
                </div>
                <div className="ap-test-meta">
                  <span className="ap-pill">{FORMAT_LABEL[t.test_format] || "Full Test"}</span>
                  <span className={`ap-pill ${t.is_published ? "ok" : "warn"}`}>{t.is_published ? "Nashr qilingan" : "Qoralama"}</span>
                  <small>ID {t.id}</small>
                </div>
              </button>
            ))}
          </div>
        )}

        {showCreate && (
          <div className="ap-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setShowCreate(false)}>
            <form className="ap-modal ap-form" onSubmit={createTest}>
              <div className="ap-modal-head">
                <h2>Yangi Reading test</h2>
                <button type="button" className="ap-mini" onClick={() => setShowCreate(false)}>✕</button>
              </div>
              <label>Test nomi</label>
              <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="IELTS Reading Test 01" required />
              <label>Qisqacha tavsif</label>
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Test haqida qisqacha ma’lumot" />
              <label>Test formati</label>
              <select value={newFormat} onChange={(e) => setNewFormat(e.target.value)}>
                <option value="full">Full Test — 3 ta passage, 60 daqiqa</option>
                <option value="passage_1">Faqat Passage 1</option>
                <option value="passage_2">Faqat Passage 2</option>
                <option value="passage_3">Faqat Passage 3</option>
              </select>
              <label className="ap-check-row">
                <input type="checkbox" checked={newPublished} onChange={(e) => setNewPublished(e.target.checked)} />
                Darhol nashr qilish
              </label>
              <div className="ap-modal-foot">
                <button type="button" className="ap-btn" onClick={() => setShowCreate(false)}>Bekor qilish</button>
                <button className="ap-btn primary" disabled={loading}>{loading ? "Saqlanmoqda…" : "Testni yaratish"}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    );
  }

  
  let paraIdx = -1;
  const draftLabel = draftSavedAt
    ? `Qoralama saqlandi · ${draftSavedAt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`
    : "Qoralama avtomatik saqlanadi";

  return shell(
    <main className="ap-page wide">
      <div className="ap-sticky">
        <div className="ap-sticky-l">
          <button className="ap-btn ghost" onClick={() => { setSelectedTest(null); setCurrentPassageId(null); loadTests(); }}>← Testlar</button>
          <div className="ap-sticky-title">
            <strong>{selectedTest.title}</strong>
            <small>{FORMAT_LABEL[testFormat] || "Full Test"} · ID {testId}</small>
          </div>
        </div>
        <div className="ap-tabs" role="tablist">
          {allowedPassages.map((n) => (
            <button
              key={n}
              role="tab"
              aria-selected={passageNumber === n}
              className={passageNumber === n ? "on" : ""}
              onClick={() => passageNumber !== n && applyDraft(testId, n)}
            >
              Passage {n}
            </button>
          ))}
        </div>
        <div className="ap-sticky-r">
          <span className="ap-draft">{draftLabel}</span>
          <button className="ap-btn primary" onClick={saveAll} disabled={loading}>
            {loading ? "Saqlanmoqda…" : `Saqlash · ${totalQuestions} savol`}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="ap-errors" id="ap-errors">
          <strong>Saqlashdan oldin {errors.length} ta narsani tuzating</strong>
          <ul>{errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>
          {errors.length > 8 && <small>…va yana {errors.length - 8} ta</small>}
        </div>
      )}

      <div className="ap-grid">
        <div className="ap-col">
          {}
          <section className="ap-card">
            <div className="ap-card-head">
              <h2>Passage {passageNumber}</h2>
              <p>Sarlavha, turi va matn bloklari.</p>
            </div>
            <div className="ap-form">
              <label>Matn turi</label>
              <div className="ap-type-grid">
                {PASSAGE_TYPES.map((t) => (
                  <button type="button" key={t.id} className={`ap-type-card ${passageType === t.id ? "selected" : ""}`} onClick={() => setPassageType(t.id)}>
                    <span>{t.icon}</span>
                    <strong>{t.title}</strong>
                    <small>{t.description}</small>
                  </button>
                ))}
              </div>

              <label>Passage sarlavhasi</label>
              <input value={passageTitle} onChange={(e) => setPassageTitle(e.target.value)} placeholder="Masalan: The History of Public Libraries" />

              <div className="ap-row-2">
                <div>
                  <label>Vaqt</label>
                  <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                    {[15, 20, 25, 30].map((m) => <option key={m} value={m}>{m} daqiqa</option>)}
                  </select>
                </div>
                <div>
                  <label>Birinchi savol raqami</label>
                  <input type="number" min="1" max="40" value={startNo} onChange={(e) => setStartNo(e.target.value)} />
                </div>
              </div>

              <div className="ap-blocks-head">
                <label>Matn bloklari</label>
                <button type="button" className="ap-link" onClick={() => setPasteOpen((v) => !v)}>
                  {pasteOpen ? "Yopish" : "📋 Butun matnni joylash"}
                </button>
              </div>

              {pasteOpen && (
                <div className="ap-paste">
                  <textarea
                    rows={8}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Matnni shu yerga joylang.\nParagraflar bo‘sh qator bilan ajratiladi.\nSarlavha uchun qator boshiga # qo‘ying."}
                  />
                  <button type="button" className="ap-btn primary" onClick={applyPaste} disabled={!pasteText.trim()}>Bloklarga ajratish</button>
                </div>
              )}

              <label className="ap-check-row">
                <input type="checkbox" checked={labelled} onChange={(e) => setLabelled(e.target.checked)} />
                Paragraflarni A, B, C… bilan belgilash (Matching savollari uchun kerak)
              </label>

              {blocks.map((b, i) => {
                const isPara = b.type === "paragraph";
                if (isPara && b.text.trim()) paraIdx++;
                const tag = isPara ? (labelled && b.text.trim() ? letter(paraIdx) : "¶") : "H";
                return (
                  <div className={`ap-block ${b.type}`} key={b.uid}>
                    <span className="ap-block-tag" title={isPara ? "Paragraf" : "Sarlavha"}>{tag}</span>
                    {isPara ? (
                      <textarea rows={4} value={b.text} onChange={(e) => patchBlock(b.uid, e.target.value)} placeholder="Paragraf matni…" />
                    ) : (
                      <input value={b.text} onChange={(e) => patchBlock(b.uid, e.target.value)} placeholder="Sarlavha (subheading)" />
                    )}
                    <div className="ap-tools col">
                      <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
                      <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                      <button type="button" className="danger" onClick={() => removeBlock(b.uid)}>✕</button>
                    </div>
                  </div>
                );
              })}

              <div className="ap-btn-row">
                <button type="button" className="ap-btn" onClick={() => addBlock("paragraph")}>＋ Paragraf</button>
                <button type="button" className="ap-btn" onClick={() => addBlock("heading")}>＋ Sarlavha</button>
                <span className="ap-counter">{wordCount} so‘z · {paragraphs.length} paragraf</span>
              </div>
            </div>
          </section>

          {}
          <section className="ap-card">
            <div className="ap-card-head">
              <h2>Savollar</h2>
              <p>Har bir savol turi uchun alohida guruh — xuddi real IELTS’dagidek.</p>
            </div>

            {groups.length === 0 && <p className="ap-empty">Hali savol guruhi yo‘q. Pastdan savol turini tanlang.</p>}

            {groups.map((g, gi) => (
              <GroupEditor
                key={g.uid}
                group={g}
                index={gi}
                total={groups.length}
                startNo={startNumbers[gi]}
                letters={pickerLetters}
                open={!closed[g.uid]}
                onToggle={() => toggleGroup(g.uid)}
                onPatch={(patch) => patchGroup(g.uid, patch)}
                onItem={(iid, patch) => patchItem(g.uid, iid, patch)}
                onAddItem={() => addItem(g.uid)}
                onRemoveItem={(iid) => removeItem(g.uid, iid)}
                onRemove={() => removeGroup(g.uid)}
                onMove={(dir) => moveGroup(gi, dir)}
                onDuplicate={() => dupGroup(gi)}
              />
            ))}

            <div className="ap-add-types">
              <span>Guruh qo‘shish</span>
              {QUESTION_TYPES.map((t) => (
                <button type="button" key={t.id} onClick={() => addGroup(t.id)}>＋ {t.label}</button>
              ))}
            </div>
          </section>
        </div>

        {}
        <aside className="ap-aside">
          <section className="ap-card ap-summary">
            <div className="ap-sum-row">
              <div><strong>{wordCount}</strong><small>so‘z</small></div>
              <div><strong>{totalQuestions}</strong><small>savol</small></div>
              <div>
                <strong>{totalQuestions ? `${startNo}–${Number(startNo) + totalQuestions - 1}` : "—"}</strong>
                <small>raqamlar</small>
              </div>
            </div>
            <div className="ap-progress" title={`${answeredTotal}/${totalQuestions} savol to‘ldirilgan`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <small className="ap-progress-label">{answeredTotal}/{totalQuestions} savol to‘ldirilgan</small>
          </section>

          <section className="ap-card ap-preview">
            <div className="ap-preview-top">
              <span>Jonli ko‘rinish</span>
              <span className="ap-pill">{PASSAGE_TYPES.find((t) => t.id === passageType)?.title}</span>
            </div>
            <h2>{passageTitle || "Passage sarlavhasi"}</h2>
            <div className="ap-preview-meta">Passage {passageNumber} · {duration} daqiqa</div>
            <div className="ap-preview-passage">
              {blocks.some((b) => b.text.trim()) ? (
                (() => {
                  let pi = -1;
                  return blocks
                    .filter((b) => b.text.trim())
                    .map((b) => {
                      if (b.type === "heading") return <h4 key={b.uid}>{b.text}</h4>;
                      pi++;
                      return (
                        <p key={b.uid}>
                          {labelled && <b className="ap-pl">{letter(pi)}</b>}
                          {b.text.length > 220 ? b.text.slice(0, 220) + "…" : b.text}
                        </p>
                      );
                    });
                })()
              ) : (
                <p className="ap-muted">Matn kiritganingizda u shu yerda ko‘rinadi.</p>
              )}
            </div>
            {groups.length > 0 && (
              <ul className="ap-preview-qs">
                {groups.map((g, gi) => (
                  <li key={g.uid}>
                    <b>{startNumbers[gi]}{g.items.length > 1 ? `–${startNumbers[gi] + g.items.length - 1}` : ""}</b>
                    <span>{typeMeta(g.type).label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ap-card ap-tip">
            <strong>Maslahat</strong>
            <p>Real IELTS’da 40 ta savol: 1–13, 14–26, 27–40. Raqamlar guruhlar bo‘yicha avtomatik davom etadi. Ctrl/⌘ + S — saqlash.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}