import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./HistoryReview.css";

export default function HistoryReview() {
  const navigate = useNavigate();

  const {
    type,
    attemptId,
  } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReview() {

      console.log("History params:", {
        type,
        attemptId,
      });

      if (!type || !attemptId) {
        setError("History attempt ID topilmadi.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(
          `history/${type}/${attemptId}/`
        );

        console.log(
          "HISTORY REVIEW:",
          response.data
        );

        setData(response.data);

      } catch (error) {

        console.error(
          "History review xatosi:",
          error
        );

        setError(
          error.response?.data?.detail ||
          "Review yuklanmadi."
        );

      } finally {
        setLoading(false);
      }
    }

    loadReview();
  }, [type, attemptId]);


  if (loading) {
    return (
      <div className="history-review-page">
        <p>Review yuklanmoqda...</p>
      </div>
    );
  }


  if (error) {
    return (
      <div className="history-review-page">

        <div className="history-review-error">
          {error}
        </div>

        <button
          onClick={() => navigate("/history")}
        >
          ← Back to History
        </button>

      </div>
    );
  }


  if (!data) {
    return null;
  }


  return (
    <div className="history-review-page">

      <div className="review-header">

        <div>
          <h1>{data.title}</h1>

          <p>
            {type === "reading"
              ? "📖 Reading Review"
              : type === "listening"
              ? "🎧 Listening Review"
              : "✍️ Writing Review"}
          </p>
        </div>

        <div className="review-date">
          {data.date
            ? new Date(data.date).toLocaleString(
                "uz-UZ"
              )
            : ""}
        </div>

      </div>


      {/* READING / LISTENING SCORE */}

      {(type === "reading" ||
        type === "listening") && (
        <div className="review-score">

          <div>
            <span>Score</span>

            <strong>
              {data.score} / {data.max_score}
            </strong>
          </div>

          <div>
            <span>Percentage</span>

            <strong>
              {Math.round(data.percentage)}%
            </strong>
          </div>

        </div>
      )}


      {/* READING / LISTENING QUESTIONS */}

      {(type === "reading" ||
        type === "listening") && (
        <div className="review-questions">

          {data.questions?.map(
            (question, index) => {

              const selected =
                question.selected_answer;

              const correct =
                question.correct_answer;

              return (
                <div
                  key={question.id}
                  className={`review-question ${
                    question.correct
                      ? "correct"
                      : "incorrect"
                  }`}
                >

                  <div className="question-top">

                    <span>
                      Question{" "}
                      {question.number ||
                        index + 1}
                    </span>

                    <span>
                      {question.correct
                        ? "✓ Correct"
                        : "✗ Incorrect"}
                    </span>

                  </div>


                  <h3>
                    {question.prompt}
                  </h3>


                  {question.options?.length > 0 && (
                    <div className="question-options">

                      {question.options.map(
                        (option, optionIndex) => {

                          const value =
                            typeof option === "object"
                              ? option.value ??
                                option.label
                              : option;

                          const isSelected =
                            String(value) ===
                            String(selected);

                          const isCorrect =
                            String(value) ===
                            String(correct);

                          return (
                            <div
                              key={optionIndex}
                              className={`
                                answer-option
                                ${
                                  isSelected
                                    ? "selected"
                                    : ""
                                }
                                ${
                                  isCorrect
                                    ? "correct-answer"
                                    : ""
                                }
                              `}
                            >

                              <span>
                                {value}
                              </span>

                              {isSelected && (
                                <small>
                                  Your answer
                                </small>
                              )}

                              {isCorrect && (
                                <small>
                                  Correct answer
                                </small>
                              )}

                            </div>
                          );
                        }
                      )}

                    </div>
                  )}


                  {question.explanation && (
                    <div className="explanation">
                      <strong>
                        Explanation:
                      </strong>

                      <p>
                        {question.explanation}
                      </p>
                    </div>
                  )}

                </div>
              );
            }
          )}

        </div>
      )}


      {/* WRITING */}

      {type === "writing" && (
        <div className="writing-review">

          {data.image && (
            <div className="writing-image">
              <img
                src={data.image}
                alt={data.title}
              />
            </div>
          )}


          <div className="writing-question">

            <h2>Task</h2>

            <p>
              {data.question}
            </p>

          </div>


          <div className="writing-answer">

            <h2>Your Answer</h2>

            <div className="answer-text">
              {data.answer}
            </div>

          </div>


          <div className="writing-meta">

            <div>
              <span>Time spent</span>

              <strong>
                {Math.floor(
                  (data.spent_seconds || 0) /
                    60
                )}{" "}
                min{" "}
                {(data.spent_seconds || 0) %
                  60}{" "}
                sec
              </strong>
            </div>

            <div>
              <span>Submission</span>

              <strong>
                {data.submitted_automatically
                  ? "Automatically submitted"
                  : "Submitted normally"}
              </strong>
            </div>

          </div>

        </div>
      )}


      {/* RETURN */}

      <div className="review-bottom">

        <button
          onClick={() => navigate("/history")}
        >
          ← Back to History
        </button>

        <button
          onClick={() => navigate("/dashboard")}
        >
          Return to Dashboard
        </button>

      </div>

    </div>
  );
}