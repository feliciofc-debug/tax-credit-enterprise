'use client';

import { useState, useEffect } from 'react';

interface Invite {
  id: string;
  inviteCode: string;
  clientEmail: string;
  clientName: string;
  companyName: string;
  cnpj: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function AdminConvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    clientEmail: '',
    clientName: '',
    companyName: '',
    cnpj: '',
  });

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/invite/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setInvites(data.data);
    } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      setError('Nome da empresa e obrigatorio');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Convite criado! Codigo: ${data.data.inviteCode}\nLink: ${data.data.inviteLink}`);
        setForm({ clientEmail: '', clientName: '', companyName: '', cnpj: '' });
        fetchInvites();
      } else {
        setError(data.error || 'Erro ao criar convite');
      }
    } catch {
      setError('Erro de conexao');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/invite/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchInvites();
    } catch {}
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'text-green-400 bg-green-900/30';
      case 'used': return 'text-blue-400 bg-blue-900/30';
      case 'revoked': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'used': return 'Utilizado';
      case 'revoked': return 'Revogado';
      case 'expired': return 'Expirado';
      default: return s;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Convites de Clientes</h1>
        <p className="text-gray-500 mt-1">Envie convites para clientes iniciarem o processo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold mb-2">Novo Convite</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Empresa *</label>
              <input
                value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">CNPJ</label>
              <input
                value={form.cnpj}
                onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome do Contato</label>
              <input
                value={form.clientName}
                onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email do Cliente</label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="cliente@empresa.com"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                <p className="text-green-400 text-sm whitespace-pre-line">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Gerar Convite'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Convites Enviados ({invites.length})</h3>
            {invites.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum convite enviado ainda.</p>
            ) : (
              <div className="space-y-3">
                {invites.map(inv => (
                  <div key={inv.id} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{inv.companyName}</p>
                        <p className="text-gray-500 text-xs">{inv.clientName} {inv.clientEmail && `- ${inv.clientEmail}`}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <code className="text-indigo-400 text-sm bg-indigo-900/20 px-2 py-0.5 rounded">{inv.inviteCode}</code>
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor(inv.status)}`}>
                            {statusLabel(inv.status)}
                          </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-1">
                          Criado em {new Date(inv.createdAt).toLocaleDateString('pt-BR')} - 
                          Expira em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {inv.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/20"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
