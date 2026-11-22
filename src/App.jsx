
import "./App.css";
import { Link } from "react-router-dom";
import api from "./api";
import { useEffect } from "react";

function App() {

  return (
    <div className="landing">
      <header className="navbar">
        <a href="/" className="logo">
          <span className="logo-icon">E</span>
          <span>englishCentercds</span>
        </a>

        <div className="nav-buttons">
          <button className="btn btn-outline"><Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>Login</Link></button>
          <button className="btn btn-primary"><Link to="/register" style={{ textDecoration: 'none', color: 'inherit' }}>Register</Link></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">
            YOUR IELTS JOURNEY STARTS HERE
          </span>

          <h1>
            DISCOVER AND DEVELOP
            <br />
            YOUR IELTS IN CD TEST
          </h1>

          <p className="hero-description">
            Practice your skills. Build your confidence.
            Prepare for success.
          </p>

          <button className="btn btn-primary get-started">
            <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>
              Get Started <span>→</span>
            </Link>
          </button>
        </section>

        <section className="features">
          <article className="feature-card">
            <div className="feature-icon">📖</div>
            <h2>Reading</h2>
            <p>Improve your reading skills with practice tests.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">🎧</div>
            <h2>Listening</h2>
            <p>Train your listening skills with audio tests.</p>
          </article>
        </section>
      </main>

      <footer>
        © 2026 englishCentercds · IELTS Practice Platform
      </footer>
    </div>
  );
}

export default App;
