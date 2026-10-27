import { useEffect, useState } from "react";
import "./catches.css";
import {
  createCatch,
  deleteCatch,
  getCatches,
  getCurrentUser,
  getFishSpecies,
  updateCatch,
} from "../api/client.js";

// let browsers display and edit the time in each users local time zone
function toLocalInput(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm() {
  return {
    species: "",
    caught_at: toLocalInput(),
    location_name: "",
    weight_lb: "",
    length_in: "",
    notes: "",
  };
}

function formatCaughtAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unknown"
    : new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}

function CatchEditor({ initialCatch, submitting, onSave, onCancel }) {
  const [form, setForm] = useState(() =>
    initialCatch
      ? {
          species: initialCatch.species,
          caught_at: toLocalInput(initialCatch.caught_at),
          location_name: initialCatch.location_name || "",
          weight_lb: initialCatch.weight_lb ?? "",
          length_in: initialCatch.length_in ?? "",
          notes: initialCatch.notes || "",
        }
      : emptyForm(),
  );
  const [formError, setFormError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const editing = Boolean(initialCatch);

  // suggestions are optional 
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getFishSpecies(form.species, { signal: controller.signal })
        .then(setSuggestions)
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.species]);

  function setField(event) {
    const { name, value } = event.target;
    setForm((old) => ({ ...old, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.species.trim())
      return setFormError("Please enter a fish species.");
    const timestamp = new Date(form.caught_at);
    if (!form.caught_at || Number.isNaN(timestamp.getTime())) {
      return setFormError("Please choose a valid catch date and time.");
    }
    const payload = {
      species: form.species.trim(),
      caught_at: timestamp.toISOString(),
      location_name: form.location_name.trim(),
      weight_lb: form.weight_lb === "" ? null : form.weight_lb,
      length_in: form.length_in === "" ? null : form.length_in,
      notes: form.notes.trim(),
    };
    await onSave(payload);
  }

  return (
    <section
      className="journal-editor"
      aria-label={editing ? "Edit catch" : "New catch"}
    >
      <div className="journal-editor-heading">
        <div>
          <p className="eyebrow eyebrow-dark">YOUR CATCH JOURNAL</p>
          <h2>{editing ? "Edit your catch" : "Log a new catch"}</h2>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      <form className="catch-form" onSubmit={submit}>
        <div className="catch-field">
          <label htmlFor="catch-species">
            Fish species <span aria-hidden="true">*</span>
          </label>
          <input
            id="catch-species"
            name="species"
            value={form.species}
            onChange={setField}
            placeholder="e.g. Smallmouth bass"
            required
            maxLength={120}
            list="catch-fish-suggestions"
            autoFocus
          />
          <datalist id="catch-fish-suggestions">
            {suggestions.map((fish) => (
              <option key={fish.id} value={fish.common_name} />
            ))}
          </datalist>
          <small>
            Choose a suggestion from the Fish Database, or type your own
            species.
          </small>
        </div>
        <div className="catch-field">
          <label htmlFor="catch-date">
            Date and time caught <span aria-hidden="true">*</span>
          </label>
          <input
            id="catch-date"
            type="datetime-local"
            name="caught_at"
            value={form.caught_at}
            onChange={setField}
            required
          />
        </div>
        <div className="catch-field catch-field-wide">
          <label htmlFor="catch-location">Location (optional)</label>
          <input
            id="catch-location"
            name="location_name"
            value={form.location_name}
            onChange={setField}
            placeholder="e.g. Huron River, Michigan"
            maxLength={255}
          />
          <small>Location names are private to your account for now.</small>
        </div>
        <div className="catch-field">
          <label htmlFor="catch-weight">Weight, in pounds (optional)</label>
          <input
            id="catch-weight"
            name="weight_lb"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="99999.99"
            value={form.weight_lb}
            onChange={setField}
            placeholder="2.75"
          />
        </div>
        <div className="catch-field">
          <label htmlFor="catch-length">Length, in inches (optional)</label>
          <input
            id="catch-length"
            name="length_in"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="99999.99"
            value={form.length_in}
            onChange={setField}
            placeholder="16.50"
          />
        </div>
        <div className="catch-field catch-field-wide">
          <label htmlFor="catch-notes">The story (optional)</label>
          <textarea
            id="catch-notes"
            name="notes"
            rows={4}
            value={form.notes}
            onChange={setField}
            placeholder="What bait did you use? Who were you fishing with?"
          />
        </div>
        {formError && (
          <p className="form-error catch-field-wide" role="alert">
            {formError}
          </p>
        )}
        <div className="catch-field-wide catch-form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Saving…" : editing ? "Save changes" : "Save catch"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function Catches({ onNavigate, onSessionExpired }) {
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleError(err) {
    if (err.status === 401 || err.status === 403) {
      try {
        const current = await getCurrentUser();
        if (!current) {
          onSessionExpired();
          return;
        }
      } catch {
        
      }
    }
    setError(err.message || "Something went wrong.");
  }

  useEffect(() => {
    const controller = new AbortController();
    getCatches({ signal: controller.signal })
      .then(setCatches)
      .catch((err) => {
        if (!controller.signal.aborted) handleError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    
  }, [onSessionExpired]);

  async function save(payload) {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (editing && editing !== "new") await updateCatch(editing.id, payload);
      else await createCatch(payload);
      const refreshed = await getCatches();
      setCatches(refreshed);
      setNotice(
        editing === "new" ? "Catch saved to your journal!" : "Catch updated.",
      );
      setEditing(null);
    } catch (err) {
      await handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(item) {
    if (
      !window.confirm(
        `Delete your ${item.species} catch? This cannot be undone.`,
      )
    )
      return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await deleteCatch(item.id);
      setCatches((current) =>
        current.filter((catchItem) => catchItem.id !== item.id),
      );
      setNotice("Catch deleted.");
    } catch (err) {
      await handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function startEditor(item) {
    setError("");
    setNotice("");
    setEditing(item ?? "new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="journal-page">
      <div className="journal-container">
        <div className="journal-heading">
          <div>
            <p className="eyebrow eyebrow-dark">FISHTORIES V3</p>
            <h1>My catch journal</h1>
            <p>
              Your fishing memories, all in one place. Only you can view and
              manage these catches.
            </p>
          </div>
          <div className="journal-heading-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onNavigate("/profile")}
            >
              My profile
            </button>
            {editing === null && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => startEditor()}
              >
                + Log a catch
              </button>
            )}
          </div>
        </div>
        {notice && (
          <p className="form-success journal-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="form-error journal-notice" role="alert">
            {error}
          </p>
        )}
        {editing !== null && (
          <CatchEditor
            key={editing === "new" ? "new" : editing.id}
            initialCatch={editing === "new" ? null : editing}
            submitting={submitting}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
        <div className="journal-list-heading">
          <h2>Saved catches</h2>
          <span>{loading ? "Loading…" : `${catches.length} total`}</span>
        </div>
        {loading ? (
          <p className="journal-muted" role="status">
            Loading your catches…
          </p>
        ) : catches.length === 0 ? (
          <div className="empty-catches journal-empty">
            <span aria-hidden="true">🎣</span>
            <h3>Your journal is waiting</h3>
            <p>Log your first catch to get started.</p>
            {editing === null && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => startEditor()}
              >
                Log my first catch
              </button>
            )}
          </div>
        ) : (
          <ul className="journal-list">
            {catches.map((item) => (
              <li key={item.id} className="journal-card">
                <div className="journal-catch-icon" aria-hidden="true">
                  🐟
                </div>
                <div className="journal-catch-body">
                  <h3>{item.species}</h3>
                  <p className="journal-muted">
                    <time dateTime={item.caught_at}>
                      {formatCaughtAt(item.caught_at)}
                    </time>
                    {item.location_name && <> · 📍 {item.location_name}</>}
                  </p>
                  {(item.weight_lb !== null || item.length_in !== null) && (
                    <div className="catch-measurements">
                      {item.weight_lb !== null && (
                        <span>{item.weight_lb} lb</span>
                      )}
                      {item.length_in !== null && (
                        <span>{item.length_in} in</span>
                      )}
                    </div>
                  )}
                  {item.notes && <p className="journal-notes">{item.notes}</p>}
                </div>
                <div className="journal-card-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={submitting}
                    onClick={() => startEditor(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={submitting}
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
