import { useEffect, useState } from 'react';
import { getHealth } from './api/client.js';

export default function App() {
  const [apiState, setApiState] = useState({ kind: 'checking', message: 'Checking Django API…' });

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal })
      .then((result) => {
        if (result.status === 'ok') {
          setApiState({ kind: 'connected', message: 'Django API connected' });
        } else {
          setApiState({ kind: 'error', message: 'Unexpected API response' });
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setApiState({ kind: 'error', message: 'API offline — start the Django server on port 8000' });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-icon">🐟</span> FishTories<span className="brand-suffix">v3</span></div>
        <span className="header-caption">A fresh start</span>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">YOUR FISHING JOURNAL</p>
            <h1>Every catch<br />has a <em>story.</em></h1>
            <p className="hero-description">A new home for your catch history, favorite fishing spots, and the memories worth keeping.</p>
            <div className={`status status--${apiState.kind}`} role="status">
              <span className="status-dot" /> {apiState.message}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="fish-illustration">🐟</div>
          </div>
        </section>

        <section className="coming-next" aria-labelledby="next-title">
          <div>
            <p className="eyebrow eyebrow-dark">BUILDING VERSION 3</p>
            <h2 id="next-title">Fresh foundation. Familiar features.</h2>
            <p>The new React frontend is running. Next, we'll connect secure signup and login, then bring over the best parts of the older FishTories projects.</p>
          </div>
          <div className="feature-list">
            <div><span>01</span><strong>User accounts</strong><small>Secure signup, login & profiles</small></div>
            <div><span>02</span><strong>Catch journal</strong><small>Save catches and manage your history</small></div>
            <div><span>03</span><strong>Maps & weather</strong><small>Rebuild useful fishing tools</small></div>
          </div>
        </section>
      </main>
      <footer>FishTories v3 · Built one good piece at a time.</footer>
    </div>
  );
}
