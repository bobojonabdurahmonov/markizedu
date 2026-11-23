
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "12345";

export default function Admin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e) {
    e.preventDefault();

    if (
      username.trim() === ADMIN_USERNAME &&
      password === ADMIN_PASSWORD
    ) {
      sessionStorage.setItem("adminLoggedIn", "true");
      navigate("/admin/panel", { replace: true });
    } else {
      setError("Login yoki parol noto‘g‘ri.");
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <div className="admin-login-icon">🔐</div>
        <h1>Admin Panel</h1>
        <p>englishCentercds boshqaruv tizimi</p>

        <label htmlFor="admin-username">Login</label>
        <input
          id="admin-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Admin login"
          autoComplete="username"
          required
        />

        <label htmlFor="admin-password">Parol</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin paroli"
          autoComplete="current-password"
          required
        />

        {error && <p className="admin-error">{error}</p>}

        <button type="submit">Kirish →</button>
      </form>
    </main>
  );
}
