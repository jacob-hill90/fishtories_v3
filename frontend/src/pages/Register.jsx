import { useState } from "react";
import { registerUser } from "../api/client.js";

const emptyForm = {
  username: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

export default function Register({ onBack, onLogin }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const user = await registerUser(form);
      setSuccess(`Account created for ${user.username}! You can now log in.`);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message || "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="register-page">
      <div className="register-card">
        <p className="eyebrow eyebrow-dark">JOIN THE CREW</p>
        <h1>Create your account</h1>
        <p>Start your fishing journal with a free FishTories account.</p>

        {success ? (
          <div className="form-success" role="status">
            <strong>You're signed up!</strong>
            <p>{success}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={onLogin}
            >
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="register-form">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={update}
              autoComplete="username"
              maxLength={150}
              required
            />

            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={update}
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={update}
              autoComplete="new-password"
              minLength={8}
              required
            />

            <label htmlFor="passwordConfirm">Confirm password</label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              value={form.passwordConfirm}
              onChange={update}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to FishTories
        </button>
      </div>
    </section>
  );
}
