'use client';

import { useState, useEffect } from 'react';

interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  cnpj: string;
  onboardingComplete: boolean;
  createdAt: string;
  _count: {
    documents: number;
    contracts: number;
  };
}

export default function AdminClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setClients(data.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.company || '').toLowerCase().includes(s) ||
      (c.cnpj || '').toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 mt-1">Visão geral de todos os clientes da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Total Clientes</p>
          <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Cadastro Completo</p>
          <p className="text-2xl font-bold text-green-600">{clients.filter(c => c.onboardingComplete).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Cadastro Pendente</p>
          <p className="text-2xl font-bold text-yellow-600">{clients.filter(c => !c.onboardingComplete).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Com Contratos</p>
          <p className="text-2xl font-bold text-indigo-600">{clients.filter(c => c._count.contracts > 0).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, empresa ou CNPJ..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-gray-500 font-medium">
              {search ? 'Nenhum cliente encontrado para essa busca' : 'Nenhum cliente cadastrado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Empresa</th>
                  <th className="px-6 py-3">CNPJ</th>
                  <th className="px-6 py-3">Cadastro</th>
                  <th className="px-6 py-3">Documentos</th>
                  <th className="px-6 py-3">Contratos</th>
                  <th className="px-6 py-3">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 font-bold text-xs">
                            {(client.name || client.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium text-sm">{client.name || '-'}</p>
                          <p className="text-gray-400 text-xs">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{client.company || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{client.cnpj || '-'}</td>
                    <td className="px-6 py-4">
                      {client.onboardingComplete ? (
                        <span className="text-xs px-2 py-0.5 rounded-full text-green-700 bg-green-100">Completo</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full text-yellow-700 bg-yellow-100">Pendente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{client._count.documents}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{client._count.contracts}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
