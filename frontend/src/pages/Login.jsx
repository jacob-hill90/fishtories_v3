import { useState } from 'react';
import { loginUser } from '../api/client.js';

export default function Login({ onLogin, onBack, onRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await loginUser({ username, password });
      setPassword('');
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Could not log in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="register-page">
      <div className="register-card">
        <p className="eyebrow eyebrow-dark">WELCOME BACK</p>
        <h1>Log in</h1>
        <p>Pick up where you left off in your fishing journal.</p>
        <form className="register-form" onSubmit={submit}>
          <label htmlFor="login-username">Username</label>
          <input id="login-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="login-helper">New to Fishtories? <button className="inline-link" type="button" onClick={onRegister}>Create an account</button></p>
        <button type="button" className="back-link" onClick={onBack}>← Back to Fishtories</button>
      </div>
    </section>
  );
}
