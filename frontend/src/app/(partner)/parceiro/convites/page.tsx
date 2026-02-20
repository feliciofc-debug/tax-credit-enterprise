'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { authedFetcher, SWR_OPTIONS_MEDIUM } from '@/lib/fetcher';

interface Invite {
  id: string;
  inviteCode: string;
  companyName: string;
  clientName: string | null;
  clientEmail: string | null;
  status: string;
  createdAt: string;
  usedAt: string | null;
}

export default function ConvitesPage() {
  const { data: invites = [], mutate: mutateInvites } = useSWR<Invite[]>(
    '/api/invite/list',
    authedFetcher,
    SWR_OPTIONS_MEDIUM,
  );
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ companyName: '', cnpj: '', clientName: '', clientEmail: '' });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) return;
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const apiBase = localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/invite/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedCode({ code: data.data.inviteCode, link: data.data.inviteLink });
        setForm({ companyName: '', cnpj: '', clientName: '', clientEmail: '' });
        mutateInvites();
      } else {
        alert(data.error);
      }
    } catch {
      alert('Erro ao gerar convite');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { label: string; cls: string }> = {
      active: { label: 'Ativo', cls: 'bg-green-100 text-green-700' },
      used: { label: 'Utilizado', cls: 'bg-blue-100 text-blue-700' },
      expired: { label: 'Expirado', cls: 'bg-gray-100 text-gray-700' },
      revoked: { label: 'Revogado', cls: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || config.active;
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.cls}`}>{c.label}</span>;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Convites para Clientes</h1>
        <p className="text-gray-500 text-sm mt-1">Gere codigos de acesso para seus clientes se cadastrarem</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Generate form */}
        <div>
          <form onSubmit={handleGenerate} className="card p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Gerar Novo Convite</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
              <input value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do contato</label>
              <input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email do contato</label>
              <input type="email" value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} className="input" />
            </div>
            <button type="submit" disabled={loading || !form.companyName} className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Gerando...' : 'Gerar Codigo de Acesso'}
            </button>
          </form>

          {generatedCode && (
            <div className="card p-6 mt-5 bg-green-50 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3">Convite Gerado!</h4>
              <div className="bg-white rounded-lg p-4 mb-3">
                <p className="text-xs text-gray-500 mb-1">Codigo</p>
                <p className="text-2xl font-mono font-bold text-gray-900">{generatedCode.code}</p>
              </div>
              <div className="bg-white rounded-lg p-4 mb-3">
                <p className="text-xs text-gray-500 mb-1">Link de cadastro</p>
                <p className="text-sm text-indigo-600 break-all">{generatedCode.link}</p>
              </div>
              <button
                onClick={() => copyToClipboard(generatedCode.link)}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          )}
        </div>

        {/* Invite list */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Convites Enviados</h3>
            </div>
            {invites.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-gray-500 font-medium">Nenhum convite enviado</p>
                <p className="text-gray-400 text-sm mt-1">Gere seu primeiro convite ao lado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Codigo</th>
                      <th className="px-6 py-3">Empresa</th>
                      <th className="px-6 py-3">Contato</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Criado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invites.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">{inv.inviteCode}</td>
                        <td className="px-6 py-4 text-sm">{inv.companyName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {inv.clientName || inv.clientEmail || '-'}
                        </td>
                        <td className="px-6 py-4">{statusBadge(inv.status)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
