export async function getHealth({ signal } = {}) {
  const response = await fetch('/api/health/', { signal });
  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }
  return response.json();
}
