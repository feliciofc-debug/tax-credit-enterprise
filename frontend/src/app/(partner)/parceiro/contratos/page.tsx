'use client';

import { useState, useEffect } from 'react';

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  clientName: string;
  clientCompany: string;
  setupFee: number;
  setupFeePaid: boolean;
  clientSplitPercent: number;
  partnerSplitPercent: number;
  platformSplitPercent: number;
  status: string;
  partnerSigned: boolean;
  clientSigned: boolean;
  totalRecovered: number;
  partnerEarnings: number;
  estimatedCredits: number;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
  company: string;
  cnpj: string;
  hasContract: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-700' },
  pending_payment: { label: 'Aguardando Pagamento', cls: 'bg-yellow-100 text-yellow-700' },
  payment_claimed: { label: 'Pagamento Informado', cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  pending_signatures: { label: 'Aguardando Assinaturas', cls: 'bg-orange-100 text-orange-700' },
  active: { label: 'Ativo', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Concluido', cls: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
};

function NewContractModal({
  onClose,
  onCreated,
  clients,
  loadingClients,
}: {
  onClose: () => void;
  onCreated: () => void;
  clients: ClientOption[];
  loadingClients: boolean;
}) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [pctCliente, setPctCliente] = useState(80);
  const [pctParceiro, setPctParceiro] = useState(8);
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const pctPlataforma = 100 - pctCliente - pctParceiro;
  const isDefault = pctCliente === 80 && pctParceiro === 8;

  const handleCreate = async () => {
    if (!selectedClientId) {
      setError('Selecione um cliente');
      return;
    }
    if (pctPlataforma < 0 || pctCliente + pctParceiro + pctPlataforma !== 100) {
      setError('Percentuais invalidos');
      return;
    }
    if (!isDefault && !adminPassword) {
      setError('Alterar percentuais padrao requer senha do administrador');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const apiBase = localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/contract/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          contractType: 'tripartite',
          clientSplitPercent: pctCliente,
          partnerSplitPercent: pctParceiro,
          platformSplitPercent: pctPlataforma,
          ...(!isDefault ? { adminPassword } : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        onCreated();
        onClose();
      } else {
        setError(data.error || 'Erro ao criar contrato');
      }
    } catch {
      setError('Erro de conexao com o servidor');
    } finally {
      setCreating(false);
    }
  };

  const availableClients = clients.filter(c => !c.hasContract);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Novo Contrato Tripartite</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente</label>
            {loadingClients ? (
              <p className="text-gray-400 text-sm">Carregando clientes...</p>
            ) : availableClients.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-700 text-sm">
                  Nenhum cliente disponivel. Envie convites primeiro.
                </p>
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Selecione um cliente --</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name || c.email} {c.cnpj ? `(${c.cnpj})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Modelo de distribuicao */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h3 className="font-semibold text-indigo-900 mb-2">Distribuicao sobre Creditos Recuperados</h3>
            <p className="text-xs text-indigo-700 mb-3">
              O cliente fica com a maior parte. Voce recebe dos 20% da TaxCredit.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-lg font-bold text-gray-900">{pctCliente}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Voce (Parceiro)</p>
                <p className="text-lg font-bold text-green-600">{pctParceiro}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">TaxCredit</p>
                <p className="text-lg font-bold text-indigo-600">{pctPlataforma}%</p>
              </div>
            </div>
          </div>

          {/* Percentage adjusters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ajustar Percentuais</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20">Cliente:</span>
                <input
                  type="range" min={50} max={90}
                  value={pctCliente}
                  onChange={e => setPctCliente(Number(e.target.value))}
                  className="flex-1 accent-gray-600"
                />
                <span className="text-sm font-bold text-gray-900 w-12 text-right">{pctCliente}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20">Parceiro:</span>
                <input
                  type="range" min={1} max={Math.min(20, 100 - pctCliente - 1)}
                  value={pctParceiro}
                  onChange={e => setPctParceiro(Number(e.target.value))}
                  className="flex-1 accent-green-600"
                />
                <span className="text-sm font-bold text-green-600 w-12 text-right">{pctParceiro}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20">TaxCredit:</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.max(0, pctPlataforma)}%` }} />
                </div>
                <span className={`text-sm font-bold w-12 text-right ${pctPlataforma < 0 ? 'text-red-600' : 'text-indigo-600'}`}>{pctPlataforma}%</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Seu percentual sai da parte da TaxCredit. O cliente nunca e afetado.
            </p>
          </div>

          {/* Simulacao */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Simulacao: credito de R$ 1.000.000</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-base font-bold text-gray-900">R$ {(1000000 * pctCliente / 100).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Voce</p>
                <p className="text-base font-bold text-green-600">R$ {(1000000 * pctParceiro / 100).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">TaxCredit</p>
                <p className="text-base font-bold text-indigo-600">R$ {(1000000 * pctPlataforma / 100).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className={`rounded-lg p-3 ${isDefault ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm ${isDefault ? 'text-green-800' : 'text-amber-800'}`}>
              {isDefault
                ? 'Percentuais padrao. Aprovado automaticamente.'
                : 'Percentuais personalizados. Requer senha do administrador.'}
            </p>
          </div>

          {!isDefault && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha de Autorizacao</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => { setAdminPassword(e.target.value); setError(''); }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Senha do administrador TaxCredit"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || !selectedClientId || pctPlataforma < 0}
              className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Criando...' : 'Criar Contrato'}
            </button>
            <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showNewContract, setShowNewContract] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState('');

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/contract/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setContracts(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/contract/my-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setClients(data.data || []);
    } catch {} finally {
      setLoadingClients(false);
    }
  };

  const handleOpenNew = () => {
    fetchClients();
    setShowNewContract(true);
  };

  const handleSignContract = async (contractId: string) => {
    setSigningId(contractId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/contract/${contractId}/sign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setSignSuccess('Contrato assinado com sucesso!');
        fetchContracts();
        setTimeout(() => setSignSuccess(''), 5000);
      }
    } catch {} finally {
      setSigningId(null);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalEarnings = contracts.reduce((a, c) => a + (c.partnerEarnings || 0), 0);
  const totalRecovered = contracts.reduce((a, c) => a + (c.totalRecovered || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">Acompanhe seus contratos tripartite e ganhos</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Novo Contrato
        </button>
      </div>

      {showNewContract && (
        <NewContractModal
          onClose={() => setShowNewContract(false)}
          onCreated={fetchContracts}
          clients={clients}
          loadingClients={loadingClients}
        />
      )}

      {signSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium text-sm">{signSuccess}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Recuperado (seus clientes)</p>
          <p className="text-2xl font-bold text-brand-700">{formatCurrency(totalRecovered)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Seus Ganhos</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEarnings)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Contratos Ativos</p>
          <p className="text-2xl font-bold text-indigo-600">{contracts.filter(c => c.status === 'active').length}</p>
        </div>
      </div>

      {/* Contracts list */}
      {contracts.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 font-medium">Nenhum contrato criado ainda</p>
          <p className="text-gray-400 text-sm mt-1">Envie convites para seus clientes e crie contratos.</p>
          <button
            onClick={handleOpenNew}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-5 rounded-lg"
          >
            Criar Primeiro Contrato
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map(contract => {
            const badge = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
            return (
              <div key={contract.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{contract.clientCompany || contract.clientName}</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700">
                        {contract.contractType === 'tripartite' ? 'Tripartite' : 'Bipartite'}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {contract.contractNumber} | {new Date(contract.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Seus ganhos</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(contract.partnerEarnings || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Distribuicao</p>
                    <p className="font-semibold text-gray-900 text-xs mt-1">
                      Cliente {contract.clientSplitPercent}% | Voce {contract.partnerSplitPercent}% | TC {contract.platformSplitPercent}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Taxa Adesao</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(contract.setupFee)}</p>
                    <p className={`text-xs font-medium ${contract.setupFeePaid ? 'text-green-600' : 'text-yellow-600'}`}>
                      {contract.setupFeePaid ? 'Pago' : 'Pendente'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Total Recuperado</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(contract.totalRecovered || 0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Assinaturas</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-3 h-3 rounded-full ${contract.partnerSigned ? 'bg-green-500' : 'bg-gray-300'}`} title="Parceiro" />
                      <span className={`w-3 h-3 rounded-full ${contract.clientSigned ? 'bg-green-500' : 'bg-gray-300'}`} title="Cliente" />
                      <span className="text-xs text-gray-500">
                        {contract.partnerSigned && contract.clientSigned ? 'Ambos' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {!contract.partnerSigned && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleSignContract(contract.id)}
                      disabled={signingId === contract.id}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {signingId === contract.id ? 'Assinando...' : 'Assinar Contrato'}
                    </button>
                    <span className="text-xs text-gray-400 ml-3">Sua assinatura digital sera registrada</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
