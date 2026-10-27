import SpeciesImage from '../components/SpeciesImage.jsx';
import { useEffect, useState } from 'react';
import { getDashboard, uploadProfileAvatar, removeProfileAvatar } from '../api/client.js';
import UserAvatar from '../components/UserAvatar.jsx';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export default function Profile({ onSessionExpired, onNavigate, onAvatarChanged, avatarRevision = 0 }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');

  async function changeAvatar(remove = false) {
    setAvatarError('');
    setAvatarMessage('');
    if (!remove && !selectedImage) {
      setAvatarError('Choose a picture first.');
      return;
    }
    if (!remove && selectedImage.size > 8 * 1024 * 1024) {
      setAvatarError('Pictures must be smaller than 8 MB.');
      return;
    }
    setAvatarSaving(true);
    try {
      const nextUser = remove
        ? await removeProfileAvatar()
        : await uploadProfileAvatar(selectedImage);
      setDashboard((current) => current ? { ...current, user: nextUser } : current);
      onAvatarChanged(nextUser);
      setSelectedImage(null);
      // Reset the native file input after a successful submission.
      const fileInput = document.getElementById('profile-avatar-file');
      if (fileInput) fileInput.value = '';
      setAvatarMessage(remove ? 'Profile picture removed.' : 'Profile picture updated!');
    } catch (err) {
      if (err.status === 401 || err.status === 403) onSessionExpired();
      else setAvatarError(err.message || 'Unable to update picture.');
    } finally {
      setAvatarSaving(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getDashboard({ signal: controller.signal })
      .then((data) => setDashboard(data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err.status === 401) onSessionExpired();
        else setError(err.message || 'Unable to load dashboard.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onSessionExpired]);

  if (loading) return <div className="session-loading" role="status">Loading your fishing dashboard…</div>;
  if (error) return (
    <section className="account-page"><div className="account-card">
      <h1>Dashboard unavailable</h1><p role="alert">{error}</p>
      <button type="button" className="button button-secondary" onClick={() => onNavigate('/')}>Return home</button>
    </div></section>
  );
  if (!dashboard) return null;

  const { user, stats, recent_catches: recentCatches } = dashboard;
  return (
    <section className="profile-page">
      <div className="profile-container">
        <div className="profile-welcome">
          <UserAvatar user={user} revision={avatarRevision} />
          <div>
            <p className="eyebrow eyebrow-dark">YOUR FISHING JOURNAL</p>
            <h1>Welcome back, {user.username}!</h1>
            <p>Every great fishing story starts somewhere. Here's yours so far.</p>
          </div>
        </div>

        <div className="stats-grid" aria-label="Your catch statistics">
          <div className="stat-card"><span className="stat-icon" aria-hidden="true">🎣</span><strong>{stats.total_catches}</strong><span>Total catches</span></div>
          <div className="stat-card"><span className="stat-icon" aria-hidden="true">🐟</span><strong>{stats.species_count}</strong><span>Species caught</span></div>
          <div className="stat-card"><span className="stat-icon" aria-hidden="true">📍</span><strong>{stats.locations_count}</strong><span>Fishing locations</span></div>
        </div>

        <div className="profile-columns">
          <div className="dashboard-panel">
            <div className="panel-heading"><h2>Recent catches</h2><button type="button" className="inline-link" onClick={() => onNavigate('/catches')}>View all catches</button></div>
            {recentCatches.length ? (
              <ul className="recent-catches">
                {recentCatches.map((item) => (
                  <li key={item.id}>
                    <SpeciesImage name={item.species} className="catch-fish recent-species-photo" alt="" />
                    <div><strong>{item.species}</strong><small>{item.location_name || 'Location not recorded'}</small></div>
                    <time dateTime={item.caught_at}>{formatDate(item.caught_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-catches"><span aria-hidden="true">🎣</span><h3>No catches logged yet</h3>
                <p>Once you log your first catch, it will show up here.</p>
                <button type="button" className="button button-primary" onClick={() => onNavigate('/catches')}>Log your first catch</button>
              </div>
            )}
          </div>
          <div className="dashboard-panel account-panel">
            <h2>Your account</h2>
            <div className="profile-picture-editor">
              <h3>Profile picture</h3>
              <p>Choose a JPEG, PNG or WebP image (up to 8 MB). Only you can see it for now.</p>
              <label htmlFor="profile-avatar-file">Choose a picture</label>
              <input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp"
                disabled={avatarSaving} onChange={(e) => {
                  setSelectedImage(e.target.files?.[0] || null);
                  setAvatarError(''); setAvatarMessage('');
                }} />
              <div className="profile-picture-actions">
                <button type="button" className="button button-primary" disabled={avatarSaving || !selectedImage}
                  onClick={() => changeAvatar(false)}>{avatarSaving ? 'Saving…' : 'Upload picture'}</button>
                {user.avatar_url && <button type="button" className="button button-secondary"
                  disabled={avatarSaving} onClick={() => changeAvatar(true)}>Remove picture</button>}
              </div>
              {avatarError && <p role="alert" className="form-error">{avatarError}</p>}
              {avatarMessage && <p role="status" className="profile-avatar-success">{avatarMessage}</p>}
            </div>
            <dl className="profile-details">
              <div><dt>Username</dt><dd>{user.username}</dd></div>
              <div><dt>Email</dt><dd>{user.email || 'Not provided'}</dd></div>
              <div><dt>Member since</dt><dd>{formatDate(user.date_joined)}</dd></div>
            </dl>
            <div className="profile-map-actions">
              <button type="button" className="button button-primary" onClick={() => onNavigate('/catches')}>My catch journal</button>
              <button type="button" className="button button-secondary" onClick={() => onNavigate('/map')}>My catch map</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
