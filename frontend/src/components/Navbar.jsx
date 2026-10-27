import { useEffect, useState } from "react";

export default function Navbar({
  user,
  checkingSession,
  loggingOut,
  onNavigate,
  onLogout,
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <button
        type="button"
        className="brand brand-button"
        onClick={() => onNavigate("/")}
      >
        <span className="brand-icon" aria-hidden="true">
          🐟
        </span>{" "}
        FishTories<span className="brand-suffix">v3</span>
      </button>
      <nav className="header-actions" aria-label="Main navigation">
        <button
          type="button"
          className="header-text-link"
          onClick={() => onNavigate("/")}
        >
          Home
        </button>
        <button
          type="button"
          className="header-text-link header-fish-link"
          onClick={() => onNavigate("/fish")}
        >
          Fish Database
        </button>
        {checkingSession ? (
          <span className="header-caption">Checking session…</span>
        ) : user ? (
          <>
            <span className="header-caption">Hi, {user.username}!</span>
            <button
              type="button"
              className="header-text-link header-catches-link"
              onClick={() => onNavigate("/catches")}
            >
              My catches
            </button>
            <button
              type="button"
              className="button button-header"
              onClick={() => onNavigate("/profile")}
            >
              Profile
            </button>
            <button
              type="button"
              className="button button-header"
              disabled={loggingOut}
              onClick={onLogout}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button button-header"
              onClick={() => onNavigate("/login")}
            >
              Log in
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => onNavigate("/register")}
            >
              Register
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
