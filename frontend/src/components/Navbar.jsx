import { formatTemp } from '../weather/weather.js';
import { useEffect, useState } from 'react';
import UserAvatar from './UserAvatar.jsx';

export default function Navbar({ user, avatarRevision = 0, checkingSession, loggingOut, onNavigate, onLogout, weather }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <button type="button" className="brand brand-button" onClick={() => onNavigate('/')}>
        <span className="brand-icon" aria-hidden="true"><img src="/fish_icon.ico" alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/fish.svg"; }} /></span> Fishtories
      </button>
      <nav className="header-actions" aria-label="Main navigation">
        <button type="button" className="header-text-link" onClick={() => onNavigate('/')}>Home</button>
        <button type="button" className="header-text-link header-fish-link" onClick={() => onNavigate('/fish')}>Fish Database</button>
        {!checkingSession && !user && (
          <button type="button" className="header-text-link" onClick={() => onNavigate('/map')}>Community Map</button>
        )}
        {checkingSession ? <span className="header-caption">Checking session…</span> : user ? (
          <>
            <span className="header-user"><UserAvatar user={user} revision={avatarRevision} small /><span className="header-caption">Hi, {user.username}!</span></span>
            <button type="button" className="header-weather-link" onClick={() => onNavigate('/weather')}
              title="View weather forecast (data from Open-Meteo)" aria-label={weather.status === 'ready'
                ? `${weather.data.condition.label}, ${formatTemp(weather.data.temperature)}. Open four-day weather forecast.`
                : 'Open weather forecast and set your location.'}>
              <span className="weather-badge-icon" aria-hidden="true">{weather.status === 'ready' ? weather.data.condition.icon : '🌦️'}</span>
              <span>{weather.status === 'ready' ? formatTemp(weather.data.temperature)
                : ['loading', 'locating'].includes(weather.status) ? 'Loading…' : 'Weather'}</span>
            </button>
            <button type="button" className="header-text-link header-catches-link" onClick={() => onNavigate('/catches')}>My catches</button>
            <button type="button" className="header-text-link" onClick={() => onNavigate('/map')}>Catch Map</button>
            <button type="button" className="button button-header" onClick={() => onNavigate('/profile')}>Profile</button>
            <button type="button" className="button button-header" disabled={loggingOut} onClick={onLogout}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button button-header" onClick={() => onNavigate('/login')}>Log in</button>
            <button type="button" className="button button-primary" onClick={() => onNavigate('/register')}>Register</button>
          </>
        )}
      </nav>
    </header>
  );
}
