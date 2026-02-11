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
  consultaLiberada: boolean;
  formalizacaoLiberada: boolean;
  partnerSigned: boolean;
  clientSigned: boolean;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  partnerName: string;
  partnerCompany: string;
  createdAt: string;
}

export default function AdminContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState('');

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

  const handleConfirmPayment = async (contractId: string) => {
    if (!adminPassword) {
      setConfirmError('Digite a senha master');
      return;
    }

    setConfirmLoading(true);
    setConfirmError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contract/${contractId}/confirm-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmSuccess('Pagamento confirmado! Consulta e formalizacao liberadas.');
        setConfirmModal(null);
        setAdminPassword('');
        fetchContracts();
        setTimeout(() => setConfirmSuccess(''), 5000);
      } else {
        setConfirmError(data.error || 'Erro ao confirmar');
      }
    } catch {
      setConfirmError('Erro de conexao');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contract/${contractId}/sign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        fetchContracts();
      }
    } catch {}
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'draft': return 'text-yellow-700 bg-yellow-100';
      case 'pending_payment': return 'text-orange-700 bg-orange-100';
      case 'payment_claimed': return 'text-blue-700 bg-blue-100 animate-pulse';
      case 'pending_signatures': return 'text-indigo-700 bg-indigo-100';
      case 'completed': return 'text-purple-700 bg-purple-100';
      case 'cancelled': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'pending_payment': return 'Aguardando Pagamento';
      case 'payment_claimed': return 'PAGAMENTO INFORMADO';
      case 'pending_signatures': return 'Aguardando Assinatura';
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

  const pendingPayments = contracts.filter(c => !c.setupFeePaid);
  const claimedPayments = contracts.filter(c => c.status === 'payment_claimed');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <p className="text-gray-500 mt-1">Todos os contratos da plataforma</p>
      </div>

      {/* Alerta de pagamentos informados */}
      {claimedPayments.length > 0 && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-blue-800 font-bold text-sm">
              {claimedPayments.length} cliente(s) informaram pagamento! Verifique no C6 Bank e confirme.
            </p>
          </div>
          {claimedPayments.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3 mt-2">
              <div>
                <p className="text-gray-900 font-medium text-sm">{c.clientCompany || c.clientName} — {c.contractNumber}</p>
                <p className="text-gray-500 text-xs">Taxa: {formatCurrency(c.setupFee)}</p>
              </div>
              <button
                onClick={() => { setConfirmModal(c.id); setConfirmError(''); setAdminPassword(''); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Confirmar Pagamento
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sucesso */}
      {confirmSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium text-sm">{confirmSuccess}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
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
          <p className="text-gray-500 text-xs">Pgto Pendente</p>
          <p className="text-2xl font-bold text-orange-600">{pendingPayments.length}</p>
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
              <div key={c.id} className={`p-4 hover:bg-gray-50 transition-colors ${c.status === 'payment_claimed' ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-gray-900 font-medium">{c.contractNumber}</p>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                      {c.setupFeePaid && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">
                          Taxa Paga
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      Cliente: {c.clientCompany || c.clientName || 'N/A'}
                      {c.clientEmail && ` (${c.clientEmail})`}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Parceiro: {c.partnerCompany || c.partnerName || 'Admin direto'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>Split: {c.partnerSplitPercent}% / {c.platformSplitPercent}%</span>
                      <span>Assinatura Parceiro: {c.partnerSigned ? 'Sim' : 'Nao'}</span>
                      <span>Assinatura Cliente: {c.clientSigned ? 'Sim' : 'Nao'}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="text-right">
                      <p className="text-green-700 font-bold">{formatCurrency(c.totalRecovered || 0)}</p>
                      <p className="text-gray-400 text-xs">recuperado</p>
                    </div>

                    {/* Botoes de acao */}
                    <div className="flex gap-2">
                      {!c.partnerSigned && (
                        <button
                          onClick={() => handleSignContract(c.id)}
                          className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Assinar (Admin)
                        </button>
                      )}
                      {!c.setupFeePaid && (
                        <button
                          onClick={() => { setConfirmModal(c.id); setConfirmError(''); setAdminPassword(''); }}
                          className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
                        >
                          Confirmar Pagamento
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmacao de pagamento */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
            <p className="text-gray-500 text-sm mb-4">
              Verifique no C6 Bank se o PIX de R$ 2.000,00 foi recebido.
              Digite sua senha master para confirmar.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1 font-medium">Senha Master</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="Digite a senha master..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleConfirmPayment(confirmModal)}
              />
            </div>

            {confirmError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{confirmError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmModal(null); setAdminPassword(''); setConfirmError(''); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmPayment(confirmModal)}
                disabled={confirmLoading || !adminPassword}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {confirmLoading ? 'Confirmando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
