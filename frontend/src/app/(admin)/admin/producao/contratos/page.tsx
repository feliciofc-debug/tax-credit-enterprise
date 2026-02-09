'use client';

import { useState, useEffect } from 'react';

interface Contract {
  id: string;
  contractNumber: string;
  status: string;
  setupFee: number;
  setupFeePaid: boolean;
  partnerSplitPercent: number;
  platformSplitPercent: number;
  totalRecovered: number;
  partnerEarnings: number;
  platformEarnings: number;
  consultaLiberada: boolean;
  formalizacaoLiberada: boolean;
  createdAt: string;
  partner: { name: string; company: string };
  client: { name: string; company: string; email: string };
}

export default function AdminContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/contract/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setContracts(data.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'draft': return 'text-yellow-700 bg-yellow-100';
      case 'pending_signature': return 'text-blue-700 bg-blue-100';
      case 'completed': return 'text-purple-700 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'pending_signature': return 'Aguardando Assinatura';
      case 'completed': return 'Concluido';
      case 'cancelled': return 'Cancelado';
      default: return s;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <p className="text-gray-500 mt-1">Todos os contratos da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Total</p>
          <p className="text-2xl font-bold text-gray-900">{contracts.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Ativos</p>
          <p className="text-2xl font-bold text-green-600">{contracts.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Taxas Pagas</p>
          <p className="text-2xl font-bold text-indigo-600">{contracts.filter(c => c.setupFeePaid).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-xs">Total Recuperado</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(contracts.reduce((sum, c) => sum + (c.totalRecovered || 0), 0))}
          </p>
        </div>
      </div>

      {/* Contracts List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {contracts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhum contrato criado ainda.</p>
            <p className="text-gray-400 text-sm mt-1">Crie convites e os clientes poderao assinar contratos.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contracts.map(c => (
              <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-gray-900 font-medium">{c.contractNumber}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      Cliente: {c.client?.name || c.client?.company || 'N/A'} 
                      {c.client?.email && ` (${c.client.email})`}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Split: {c.partnerSplitPercent}% / {c.platformSplitPercent}%</span>
                      <span>Taxa: {c.setupFeePaid ? 'Paga' : 'Pendente'}</span>
                      <span>Consulta: {c.consultaLiberada ? 'Liberada' : 'Bloqueada'}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-700 font-bold">{formatCurrency(c.totalRecovered || 0)}</p>
                    <p className="text-gray-400 text-xs">recuperado</p>
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
