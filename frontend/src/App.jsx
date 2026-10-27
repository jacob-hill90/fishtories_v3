import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, getHealth, logoutUser } from './api/client.js';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Catches from './pages/Catches.jsx';
import FishDatabase from './pages/FishDatabase.jsx';
import CatchMap from './pages/CatchMap.jsx';
import Register from './pages/Register.jsx';
import Weather from './pages/Weather.jsx';
import useWeather from './weather/useWeather.js';

const paths = new Set(['/', '/login', '/register', '/profile', '/catches', '/fish', '/map', '/weather']);
function currentPath() {
  return paths.has(window.location.pathname) ? window.location.pathname : '/';
}

export default function App() {
  const [path, setPath] = useState(currentPath);
  const [user, setUser] = useState(null);
  // Refresh the avatar image URL after an upload/replacement (same endpoint).
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [apiState, setApiState] = useState({ kind: 'checking', message: 'Checking Django API…' });
  const weatherTools = useWeather(Boolean(user));

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
    if ((path === '/profile' || path === '/catches' || path === '/weather') && !user) navigate('/login', true);
    if (user && (path === '/login' || path === '/register')) navigate('/profile', true);
  }, [checkingSession, path, user, navigate]);

  function handleAvatarChanged(nextUser) {
    setUser(nextUser);
    setAvatarRevision((current) => current + 1);
  }

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
  } else if (path === '/weather' && user) {
    content = <Weather weather={weatherTools.weather} onUseMyLocation={weatherTools.useBrowserLocation}
      onChooseCity={weatherTools.chooseCity} searchCities={weatherTools.searchCities} />;
  } else if (path === '/fish') {
    content = <FishDatabase onNavigate={navigate} user={user} />;
  } else if (path === '/profile' && user) {
    content = <Profile onNavigate={navigate} onSessionExpired={handleSessionExpired} onAvatarChanged={handleAvatarChanged} avatarRevision={avatarRevision} />;
  } else if (path === '/catches' && user) {
    content = <Catches onNavigate={navigate} onSessionExpired={handleSessionExpired} />;
  } else if (path === '/map') {
    content = <CatchMap user={user} onNavigate={navigate} onSessionExpired={handleSessionExpired} />;
  } else if ((path === '/login' || path === '/register') && user) {
    content = <Profile onNavigate={navigate} onSessionExpired={handleSessionExpired} onAvatarChanged={handleAvatarChanged} avatarRevision={avatarRevision} />;
  } else if (path === '/profile' || path === '/catches' || path === '/weather') {
    content = <section className="session-loading">Redirecting to login…</section>;
  } else {
    content = <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <p className="eyebrow">WELCOME TO FISHTORIES</p>
          <h1 id="hero-title">Fish smarter with <span>Fishtories</span></h1>
          <p className="hero-description">
            Whether you are an angling amateur or a seasoned pro, Fishtories provides the tools
            and information you need to make the most of every trip to the water. See what other
            anglers have been catching on our community catch map, keep track of your best spots,
            and share your stories with other anglers.
          </p>
          <button type="button" className="button button-primary hero-cta" onClick={() => navigate(user ? '/profile' : '/register')}>
            {user ? 'Go to your profile' : 'Start fishing smarter — it’s free'}
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
          <p>Fishtories is your personal fishing journal. Log catches, upload photos, save your favorite spots, and check the weather before your next trip.</p>
        </div>
        <div className="feature-list">
          <div><span>01</span><strong>Your fishing profile</strong><small>Personal dashboard and statistics</small></div>
          <div><span>02</span><strong>Catch journal</strong><small>Save photos, notes and your catch history</small></div>
          <div><span>03</span><strong>Private or public catches</strong><small>You decide which fishing stories to share</small></div>
        </div>
      </section>
      <section className="community-teaser" aria-labelledby="community-title">
        <div className="community-teaser-copy">
          <p className="eyebrow">DISCOVER FISHING STORIES</p>
          <h2 id="community-title">Explore the Community Catch Map.</h2>
          <p>See catches anglers have chosen to share—along with their photos, stories and fishing locations. Your private catches always stay yours.</p>
          <button type="button" className="button button-primary" onClick={() => navigate('/map')}>
            Explore the Community Map <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="community-map-preview" aria-hidden="true">
          <span className="preview-river" />
          <span className="preview-pin preview-pin-one">●</span>
          <span className="preview-pin preview-pin-two">●</span>
          <span className="preview-pin preview-pin-three">●</span>
          <span className="preview-map-label">Shared stories from the water</span>
        </div>
      </section>
      <section className="join-section" aria-labelledby="join-title">
        <p className="eyebrow eyebrow-dark">THERE'S ROOM FOR ONE MORE</p>
        <h2 id="join-title">Join nearly half a dozen other anglers.</h2>
        <p>Keep your best fishing memories, discover shared catches, and make your next trip one to remember.</p>
        <button type="button" className="button button-primary" onClick={() => navigate(user ? '/catches' : '/register')}>
          {user ? 'Open your catch journal' : 'Join Fishtories — free'}
        </button>
      </section>
    </>;
  }

  return (
    <div className={`app-shell ${path === '/' ? 'app-shell--home' : ''}`}>
      <Navbar user={user} avatarRevision={avatarRevision} checkingSession={checkingSession} loggingOut={loggingOut} onNavigate={navigate} onLogout={handleLogout} weather={weatherTools.weather} />
      {authError && <p className="auth-notice" role="alert">{authError}</p>}
      <main id="main-content">{content}</main>
      <Footer />
    </div>
  );
}
