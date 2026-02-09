'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ClientDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Selecione pelo menos um arquivo');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      files.forEach(f => formData.append('documents', f));
      formData.append('documentType', 'DRE');

      const res = await fetch('/api/batch/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`${files.length} documento(s) enviado(s) com sucesso! Voce sera notificado quando a analise estiver pronta.`);
        setFiles([]);
      } else {
        setError(data.error || 'Erro no envio');
      }
    } catch {
      setError('Erro de conexao com o servidor');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">TaxCredit Enterprise</h1>
              <p className="text-gray-500 text-xs">Area do Cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Ola, {user?.name || 'Cliente'}
        </h2>
        <p className="text-gray-500 mb-8">Envie seus documentos fiscais para analise</p>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enviar Documentos</h3>
          <p className="text-gray-500 text-sm mb-6">
            Envie DREs, Balancos, Balancetes ou outros documentos fiscais em PDF. 
            Nossa IA vai analisar e identificar oportunidades de recuperacao de creditos tributarios.
          </p>

          <form onSubmit={handleUpload}>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4 hover:border-brand-400 transition-colors">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/>
              </svg>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={e => setFiles(Array.from(e.target.files || []))}
                className="w-full max-w-xs mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-brand-600 file:text-white hover:file:bg-brand-700 cursor-pointer"
              />
              <p className="text-xs text-gray-400 mt-2">PDF, Excel ou CSV - ate 10MB por arquivo</p>
            </div>

            {files.length > 0 && (
              <div className="mb-4 bg-brand-50 rounded-lg p-3">
                <p className="text-brand-800 text-sm font-medium">{files.length} arquivo(s) selecionado(s):</p>
                <ul className="mt-1 space-y-0.5">
                  {files.map((f, i) => (
                    <li key={i} className="text-brand-700 text-xs">{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : 'Enviar Documentos'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Como funciona</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-brand-700 text-xs font-bold">1</span>
              </div>
              <p className="text-sm text-gray-600">Envie seus documentos fiscais (DRE, Balancete, Balanco)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-brand-700 text-xs font-bold">2</span>
              </div>
              <p className="text-sm text-gray-600">Nossa IA analisa e identifica creditos tributarios recuperaveis</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-brand-700 text-xs font-bold">3</span>
              </div>
              <p className="text-sm text-gray-600">Voce recebe o resultado com valores estimados e documentacao completa</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
