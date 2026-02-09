const API_BASE = '/api';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erro de conexao' }));
    throw new Error(error.error || 'Erro na requisicao');
  }

  return res;
}

export async function login(email: string, password: string) {
  // Simulated login - replace with real endpoint
  const token = btoa(JSON.stringify({ email, userId: '1' }));
  localStorage.setItem('token', token);
  return { token };
}

export async function getDashboardStats() {
  const res = await fetchAPI('/dashboard/stats');
  return res.json();
}

export async function getBatches(limit = 10, offset = 0) {
  const res = await fetchAPI(`/batch?limit=${limit}&offset=${offset}`);
  return res.json();
}

export async function getBatchStatus(batchId: string) {
  const res = await fetchAPI(`/batch/${batchId}/status`);
  return res.json();
}

export async function uploadDocuments(files: File[], documentType: string, companyName?: string, cnpj?: string) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  files.forEach(file => formData.append('documents', file));
  formData.append('documentType', documentType);
  if (companyName) formData.append('companyName', companyName);
  if (cnpj) formData.append('cnpj', cnpj);

  const res = await fetch(`${API_BASE}/batch/upload`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  if (!res.ok) throw new Error('Erro no upload');
  return res.json();
}

export async function generateDocs(analysisId: string, opportunityIndex: number) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/tax-credit/generate-docs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ analysisId, opportunityIndex }),
  });

  if (!res.ok) throw new Error('Erro ao gerar documentacao');
  return res.blob();
}

export async function preparePerdcomp(analysisId: string, opportunityIndex: number) {
  const res = await fetchAPI('/tax-credit/prepare-perdcomp', {
    method: 'POST',
    body: JSON.stringify({ analysisId, opportunityIndex }),
  });
  return res.json();
}

export async function getFilingGuide(creditType: string) {
  const res = await fetchAPI(`/tax-credit/filing-guide/${creditType}`);
  return res.json();
}
