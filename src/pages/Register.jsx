import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Auth.css";
import { saveAuth } from "../auth";

export default function Register() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState([]);
  const [telegramGroupId, setTelegramGroupId] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Telegram guruhlarini olish
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.get("telegram/groups/");
        setGroups(response.data);

        // Birinchi guruhni avtomatik tanlash
        if (response.data.length > 0) {
          setTelegramGroupId(String(response.data[0].id));
        }
      } catch (err) {
        console.error("Telegram guruhlarini olishda xatolik:", err);
        setError("Telegram guruhlarini yuklab bo‘lmadi.");
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!telegramGroupId) {
      setError("Telegram guruhini tanlang.");
      return;
    }

    setLoading(true);

    try {
      // Yangi hisob yaratamiz.
      await api.post("auth/register/", {
        username: name.trim(),
        password,
        telegram_group_id: Number(telegramGroupId),
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
      } else if (data?.telegram_group_id) {
        setError(
          Array.isArray(data.telegram_group_id)
            ? data.telegram_group_id.join(" ")
            : data.telegram_group_id
        );
      } else if (err.response?.status === 401) {
        setError(
          "Hisob yaratildi, lekin avtomatik login amalga oshmadi. Login sahifasidan kiring."
        );
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
          <label htmlFor="register-name">
            Name
          </label>

          <input
            id="register-name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="register-password">
            Password
          </label>

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

          <label htmlFor="telegram-group">
            Telegram group
          </label>

          {groupsLoading ? (
            <p className="auth-subtitle">
              Loading groups...
            </p>
          ) : groups.length === 0 ? (
            <p className="auth-error">
              Hozircha ro‘yxatdan o‘tish uchun Telegram guruhi mavjud emas.
            </p>
          ) : (
            <select
              id="telegram-group"
              value={telegramGroupId}
              onChange={(e) => setTelegramGroupId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select Telegram group
              </option>

              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          )}

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={
              loading ||
              groupsLoading ||
              groups.length === 0
            }
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}