import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./History.css";

export default function History() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("history/");

        console.log("HISTORY DATA:", response.data);

        setHistory(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("History yuklash xatosi:", error);

        setError(
          error.response?.data?.detail ||
          "History yuklanmadi."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  function openHistory(item) {
    console.log("OPEN HISTORY ITEM:", item);

    if (!item?.type || !item?.id) {
      console.error("History item ID/type yo'q:", item);
      return;
    }

    navigate(`/history/${item.type}/${item.id}`);
  }

  function formatDate(date) {
    if (!date) return "";

    return new Date(date).toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="history-page">
        <p>History yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="history-page">

      <div className="history-header">
        <div>
          <h1>History</h1>
          <p>Yechilgan testlaringiz</p>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="return-dashboard-btn"
        >
          ← Return to Dashboard
        </button>
      </div>


      {error && (
        <div className="history-error">
          {error}
        </div>
      )}


      {!error && history.length === 0 && (
        <div className="history-empty">
          <h2>Hozircha testlar yo'q</h2>
          <p>
            Yechgan testlaringiz shu yerda ko'rinadi.
          </p>
        </div>
      )}


      <div className="history-list">

        {history.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            className="history-item"
            onClick={() => openHistory(item)}
          >

            <div className="history-item-icon">
              {item.type === "reading"
                ? "📖"
                : item.type === "listening"
                ? "🎧"
                : "✍️"}
            </div>

            <div className="history-item-info">

              <h3>
                {item.title || "Untitled Test"}
              </h3>

              <p>
                {formatDate(item.date)}
              </p>

              <span className="history-type">
                {item.type === "reading"
                  ? "Reading"
                  : item.type === "listening"
                  ? "Listening"
                  : "Writing"}
              </span>

            </div>


            <div className="history-item-result">

              {item.type !== "writing" &&
                item.score !== undefined && (
                  <>
                    <strong>
                      {item.score} / {item.max_score}
                    </strong>

                    <span>
                      {Math.round(item.percentage)}%
                    </span>
                  </>
                )}

              {item.type === "writing" && (
                <span>
                  Writing Task 1
                </span>
              )}

            </div>


            <div className="history-arrow">
              →
            </div>

          </button>
        ))}

      </div>

    </div>
  );
}