import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, getHealth, logoutUser } from './api/client.js';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Catches from './pages/Catches.jsx';
import FishDatabase from './pages/FishDatabase.jsx';
import Register from './pages/Register.jsx';

const paths = new Set(['/', '/login', '/register', '/profile', '/catches', '/fish']);
function currentPath() {
  return paths.has(window.location.pathname) ? window.location.pathname : '/';
}

export default function App() {
  const [path, setPath] = useState(currentPath);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [apiState, setApiState] = useState({ kind: 'checking', message: 'Checking Django API…' });

  const navigate = useCallback((nextPath, replace = false) => {
    const safePath = paths.has(nextPath) ? nextPath : '/';
    if (window.location.pathname !== safePath) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', safePath);
    }
    setPath(safePath);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal })
      .then((result) => {
        setApiState(result.status === 'ok'
          ? { kind: 'connected', message: 'Django API connected' }
          : { kind: 'error', message: 'Unexpected API response' });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setApiState({ kind: 'error', message: 'API offline — start Django on port 8000' });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentUser({ signal: controller.signal })
      .then((currentUser) => setUser(currentUser))
      .catch((error) => {
        if (error.name !== 'AbortError') setAuthError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (checkingSession) return;
    if ((path === '/profile' || path === '/catches') && !user) navigate('/login', true);
    if (user && (path === '/login' || path === '/register')) navigate('/profile', true);
  }, [checkingSession, path, user, navigate]);

  function handleLogin(currentUser) {
    setUser(currentUser);
    setAuthError('');
    navigate('/profile');
  }

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setAuthError('Your session has expired. Please log in again.');
    navigate('/login', true);
  }, [navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError('');
    try {
      await logoutUser();
      setUser(null);
      navigate('/');
    } catch (error) {
      setAuthError(error.message || 'Could not log out.');
    } finally {
      setLoggingOut(false);
    }
  }

  let content;
  if (checkingSession) {
    content = <section className="session-loading">Checking your session…</section>;
  } else if (path === '/register' && !user) {
    content = <Register onBack={() => navigate('/')} onLogin={() => navigate('/login')} />;
  } else if (path === '/login' && !user) {
    content = <Login onBack={() => navigate('/')} onRegister={() => navigate('/register')} onLogin={handleLogin} />;
  } else if (path === '/fish') {
    content = <FishDatabase onNavigate={navigate} user={user} />;
  } else if (path === '/profile' && user) {
    content = <Profile onNavigate={navigate} onSessionExpired={handleSessionExpired} />;
  } else if (path === '/catches' && user) {
    content = <Catches onNavigate={navigate} onSessionExpired={handleSessionExpired} />;
  } else if ((path === '/login' || path === '/register') && user) {
    content = <Profile onNavigate={navigate} onSessionExpired={handleSessionExpired} />;
  } else if (path === '/profile' || path === '/catches') {
    content = <section className="session-loading">Redirecting to login…</section>;
  } else {
    content = <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <p className="eyebrow">YOUR FISHING JOURNAL</p>
          <h1 id="hero-title">Every catch<br />has a <em>story.</em></h1>
          <p className="hero-description">Log your catches, remember your favorite fishing spots, and hold onto the stories that brought you there.</p>
          <button type="button" className="button button-primary hero-cta" onClick={() => navigate(user ? '/profile' : '/register')}>
            {user ? 'View your profile' : 'Get started — it’s free'}
          </button>
          <div className={`status status--${apiState.kind}`} role="status">
            <span className="status-dot" /> {apiState.message}
          </div>
        </div>
      </section>
      <section className="coming-next" aria-labelledby="next-title">
        <div>
          <p className="eyebrow eyebrow-dark">BUILT FOR ANGLERS</p>
          <h2 id="next-title">Your memories deserve a place to live.</h2>
          <p>FishTories is your own fishing journal. Log your catches today, then revisit them on your profile. Maps, weather, and photos are on the way.</p>
        </div>
        <div className="feature-list">
          <div><span>01</span><strong>Your fishing profile</strong><small>Personal dashboard and stats</small></div>
          <div><span>02</span><strong>Catch journal</strong><small>Save catches and manage your history</small></div>
          <div><span>03</span><strong>Maps & weather</strong><small>Plan and commemorate fishing trips</small></div>
        </div>
      </section>
    </>;
  }

  return (
    <div className="app-shell">
      <Navbar user={user} checkingSession={checkingSession} loggingOut={loggingOut} onNavigate={navigate} onLogout={handleLogout} />
      {authError && <p className="auth-notice" role="alert">{authError}</p>}
      <main id="main-content">{content}</main>
      <Footer />
    </div>
  );
}
