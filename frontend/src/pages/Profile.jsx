import { useEffect, useState } from "react";
import { getDashboard } from "../api/client.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

export default function Profile({ onSessionExpired, onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getDashboard({ signal: controller.signal })
      .then((data) => setDashboard(data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err.status === 401) onSessionExpired();
        else setError(err.message || "Unable to load dashboard.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onSessionExpired]);

  if (loading)
    return (
      <div className="session-loading" role="status">
        Loading your fishing dashboard…
      </div>
    );
  if (error)
    return (
      <section className="account-page">
        <div className="account-card">
          <h1>Dashboard unavailable</h1>
          <p role="alert">{error}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onNavigate("/")}
          >
            Return home
          </button>
        </div>
      </section>
    );
  if (!dashboard) return null;

  const { user, stats, recent_catches: recentCatches } = dashboard;
  return (
    <section className="profile-page">
      <div className="profile-container">
        <div className="profile-welcome">
          <div className="profile-avatar" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow eyebrow-dark">YOUR FISHING JOURNAL</p>
            <h1>Welcome back, {user.username}!</h1>
            <p>
              Every great fishing story starts somewhere. Here's yours so far.
            </p>
          </div>
        </div>

        <div className="stats-grid" aria-label="Your catch statistics">
          <div className="stat-card">
            <span className="stat-icon" aria-hidden="true">
              🎣
            </span>
            <strong>{stats.total_catches}</strong>
            <span>Total catches</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon" aria-hidden="true">
              🐟
            </span>
            <strong>{stats.species_count}</strong>
            <span>Species caught</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon" aria-hidden="true">
              📍
            </span>
            <strong>{stats.locations_count}</strong>
            <span>Fishing locations</span>
          </div>
        </div>

        <div className="profile-columns">
          <div className="dashboard-panel">
            <div className="panel-heading">
              <h2>Recent catches</h2>
              <button
                type="button"
                className="inline-link"
                onClick={() => onNavigate("/catches")}
              >
                View all catches
              </button>
            </div>
            {recentCatches.length ? (
              <ul className="recent-catches">
                {recentCatches.map((item) => (
                  <li key={item.id}>
                    <span className="catch-fish" aria-hidden="true">
                      🐟
                    </span>
                    <div>
                      <strong>{item.species}</strong>
                      <small>
                        {item.location_name || "Location not recorded"}
                      </small>
                    </div>
                    <time dateTime={item.caught_at}>
                      {formatDate(item.caught_at)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-catches">
                <span aria-hidden="true">🎣</span>
                <h3>No catches logged yet</h3>
                <p>Once you log your first catch, it will show up here.</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => onNavigate("/catches")}
                >
                  Log your first catch
                </button>
              </div>
            )}
          </div>
          <div className="dashboard-panel account-panel">
            <h2>Your account</h2>
            <dl className="profile-details">
              <div>
                <dt>Username</dt>
                <dd>{user.username}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email || "Not provided"}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(user.date_joined)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="button button-primary"
              onClick={() => onNavigate("/catches")}
            >
              My catch journal
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
