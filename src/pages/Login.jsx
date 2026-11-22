
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Auth.css";
import { saveAuth } from "../auth";

export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

        
    try {
      const response = await api.post("auth/login/", {
        username: name.trim(),
        password,
      });

      const tokens = response.data;

      // Token bilan joriy foydalanuvchini olamiz.
      const userResponse = await api.get("auth/me/", {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      });

      saveAuth(tokens, userResponse.data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;

      if (err.response?.status === 401) {
        setError("Ism yoki parol noto‘g‘ri.");
      } else {
        setError(
          data?.detail || "Serverga ulanishda xatolik yuz berdi."
        );
      }
    } finally {
      setLoading(false);
    }

  };

  return (
    <main className="auth-page">
      <Link to="/" className="auth-brand">
        englishCentercds
      </Link>

      <section className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-subtitle">
          Login to continue your IELTS practice.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-name">Name</label>
          <input
            id="login-name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
