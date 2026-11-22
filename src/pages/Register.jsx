
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Auth.css";
import { saveAuth } from "../auth";

export default function Register() {
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
      // Yangi hisob yaratamiz.
      await api.post("auth/register/", {
        username: name.trim(),
        password,
      });

      // Yangi hisobga avtomatik login qilamiz.
      const loginResponse = await api.post("auth/login/", {
        username: name.trim(),
        password,
      });

      const tokens = loginResponse.data;

      // Foydalanuvchi ma'lumotlarini olamiz.
      const userResponse = await api.get("auth/me/", {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      });

      saveAuth(tokens, userResponse.data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;

      if (data?.username) {
        setError("Bu username band. Boshqa nom tanlang.");
      } else if (data?.password) {
        setError(data.password.join(" "));
      } else if (err.response?.status === 401) {
        setError("Hisob yaratildi, lekin avtomatik login amalga oshmadi. Login sahifasidan kiring.");
      } else {
        setError("Ro‘yxatdan o‘tishda xatolik yuz berdi.");
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
        <h1>Create account</h1>
        <p className="auth-subtitle">
          Start your IELTS preparation today.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
