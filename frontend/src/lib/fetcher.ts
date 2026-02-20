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

export const SWR_OPTIONS_FAST = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 300000,
  keepPreviousData: true,
  errorRetryCount: 2,
} as const;

export const SWR_OPTIONS_MEDIUM = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 120000,
  keepPreviousData: true,
  errorRetryCount: 2,
} as const;

let warmPromise: Promise<void> | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

export async function warmBackend() {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    try {
      const base = getApiUrl();
      const url = base ? `${base}/api/health` : '/api/health';
      await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch {
      // silent
    } finally {
      warmPromise = null;
    }
  })();
  return warmPromise;
}

export function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    const token = getToken();
    if (!token) {
      stopKeepAlive();
      return;
    }
    const base = getApiUrl();
    const url = base ? `${base}/api/health` : '/api/health';
    fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => {});
  }, 4 * 60 * 1000);
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}
