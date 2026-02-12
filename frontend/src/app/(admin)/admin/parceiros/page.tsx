'use client';

import { useState, useEffect } from 'react';

interface Partner {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  oabNumber: string;
  oabState: string;
  status: string;
  commissionPercent: number;
  createdAt: string;
  approvedAt: string | null;
  _count: {
    contracts: number;
    viabilityAnalyses: number;
    invites: number;
  };
}

export default function AdminParceirosPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/partners', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPartners(data.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/partners/${id}/${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) fetchPartners();
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const filtered = partners.filter(p => filter === 'all' || p.status === filter);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'rejected': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'rejected': return 'Rejeitado';
      default: return s;
    }
  };

  const counts = {
    all: partners.length,
    pending: partners.filter(p => p.status === 'pending').length,
    active: partners.filter(p => p.status === 'active').length,
    rejected: partners.filter(p => p.status === 'rejected').length,
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Gerenciar Parceiros</h1>
        <p className="text-gray-500 mt-1">Visualize, aprove e gerencie os parceiros da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: counts.all, color: 'text-gray-900' },
          { label: 'Pendentes', value: counts.pending, color: 'text-yellow-600' },
          { label: 'Ativos', value: counts.active, color: 'text-green-600' },
          { label: 'Rejeitados', value: counts.rejected, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-gray-500 text-xs">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {([
          { key: 'all', label: 'Todos' },
          { key: 'pending', label: 'Pendentes' },
          { key: 'active', label: 'Ativos' },
          { key: 'rejected', label: 'Rejeitados' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-700 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({counts[tab.key]})
          </button>
        ))}
      </div>

      {/* Partner List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 font-medium">Nenhum parceiro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(partner => (
              <div key={partner.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-700 font-bold text-sm">
                          {partner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-gray-900 font-semibold text-sm">{partner.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(partner.status)}`}>
                            {statusLabel(partner.status)}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs">
                          {partner.company || partner.email}
                          {partner.oabNumber && ` | OAB ${partner.oabState} ${partner.oabNumber}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-3 text-xs text-gray-500 ml-[52px]">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {partner.email}
                      </span>
                      {partner.phone && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {partner.phone}
                        </span>
                      )}
                      <span>Comissão: <strong className="text-gray-900">{partner.commissionPercent}%</strong></span>
                      <span>{partner._count.viabilityAnalyses} viabilidades</span>
                      <span>{partner._count.contracts} contratos</span>
                      <span>{partner._count.invites} convites</span>
                      <span>Desde: {new Date(partner.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {partner.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction(partner.id, 'approve')}
                          disabled={actionLoading === partner.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === partner.id ? '...' : 'Aprovar'}
                        </button>
                        <button
                          onClick={() => handleAction(partner.id, 'reject')}
                          disabled={actionLoading === partner.id}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 border border-red-200"
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                    {partner.status === 'rejected' && (
                      <button
                        onClick={() => handleAction(partner.id, 'approve')}
                        disabled={actionLoading === partner.id}
                        className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 border border-green-200"
                      >
                        Reativar
                      </button>
                    )}
                    {partner.status === 'active' && (
                      <span className="text-green-600 text-xs flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Aprovado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
