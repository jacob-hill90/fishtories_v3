export async function getHealth({ signal } = {}) {
  const response = await fetch("/api/health/", { signal });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
  return response.json();
}

// The Vite dev proxy makes /api same-origin; browser cookies are managed automatically.
// Ask for a fresh token before EACH POST because Django rotates CSRF after login.
async function getCsrfToken() {
  const response = await fetch("/api/auth/csrf/", {
    credentials: "same-origin",
  });
  if (!response.ok)
    throw new Error("Could not contact the authentication service.");
  const data = await response.json();
  return data.csrfToken;
}

async function postJson(url, body = {}) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Object.entries(data)
      .map(([field, messages]) => {
        const label =
          field === "detail" ? "" : `${field.replaceAll("_", " ")}: `;
        return `${label}${Array.isArray(messages) ? messages.join(" ") : String(messages)}`;
      })
      .join(" ");
    throw new Error(details || `Request failed (${response.status}).`);
  }
  return data;
}

export function registerUser({ username, email, password, passwordConfirm }) {
  return postJson("/api/auth/register/", {
    username,
    email,
    password,
    password_confirm: passwordConfirm,
  });
}

export function loginUser({ username, password }) {
  return postJson("/api/auth/login/", { username, password });
}

export function logoutUser() {
  return postJson("/api/auth/logout/");
}

export async function getCurrentUser({ signal } = {}) {
  const response = await fetch("/api/auth/me/", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(`Could not load your session (${response.status}).`);
  return response.json();
}

/** Dashboard data is always derived from the current cookie session. */
export async function getDashboard({ signal } = {}) {
  const response = await fetch("/api/auth/dashboard/", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) {
    const error = new Error("Your session has expired. Please log in again.");
    error.status = 401;
    throw error;
  }
  if (!response.ok)
    throw new Error(`Could not load your dashboard (${response.status}).`);
  return response.json();
}

// Step 4: Private catch journal. Every request uses the current Django session.
// Never accept an owner ID from the browser: the Django view assigns it.
async function catchRequest(url, { method = "GET", body, signal } = {}) {
  const headers = {};
  if (method !== "GET") {
    headers["X-CSRFToken"] = await getCsrfToken();
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Object.entries(data)
      .map(([field, value]) => {
        const label =
          field === "detail" ? "" : `${field.replaceAll("_", " ")}: `;
        return `${label}${Array.isArray(value) ? value.join(" ") : String(value)}`;
      })
      .join(" ");
    const error = new Error(
      message || `Catch request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getCatches({ signal } = {}) {
  return catchRequest("/api/catches/", { signal });
}

export function createCatch(values) {
  return catchRequest("/api/catches/", { method: "POST", body: values });
}

export function updateCatch(id, values) {
  return catchRequest(`/api/catches/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    body: values,
  });
}

export function deleteCatch(id) {
  return catchRequest(`/api/catches/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
}

// Public, read-only Fish Database. Server returns up to 75 matching species.
export async function getFishSpecies(query = "", { signal } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const url = `/api/fish/${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`Unable to load the Fish Database (${response.status}).`);
  return response.json();
}
