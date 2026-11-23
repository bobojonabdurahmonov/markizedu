
import "./App.css";
import { Link } from "react-router-dom";

function App() {
  return (
    <div className="landing">
      <header className="navbar">
        <Link to="/" className="logo">
          <span className="logo-icon">E</span>
          <span>englishCentercds</span>
        </Link>

        <div className="nav-buttons">
          <Link to="/login" className="btn btn-outline">
            Login
          </Link>
          <Link to="/register" className="btn btn-primary">
            Register
          </Link>
        </div>
      </header>

      <main className="landing-main">
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
            <br />
            Prepare for success.
          </p>

          <Link to="/login" className="btn btn-primary get-started">
            Get Started <span>→</span>
          </Link>
        </section>

        <section className="features">
          <article className="feature-card">
            <div className="feature-icon">📖</div>
            <h2>Reading</h2>
            <p>
              Improve your reading skills with structured
              IELTS practice tests.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">🎧</div>
            <h2>Listening</h2>
            <p>
              Train your listening skills with realistic
              audio-based IELTS tests.
            </p>
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
