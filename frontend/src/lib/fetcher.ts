export function getApiUrl() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '';
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function authedFetcher(path: string) {
  const token = getToken();
  if (!token) throw new Error('No token');
  const base = getApiUrl();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.success === false) throw new Error(json.error || 'API error');
  return json.data ?? json;
}

export async function warmBackend() {
  try {
    const base = getApiUrl();
    const url = base ? `${base}/api/health` : '/api/health';
    await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    // silent — just warming up
  }
}
