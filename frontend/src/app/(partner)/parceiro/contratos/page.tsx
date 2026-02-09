'use client';

import { useState } from 'react';

// Modal para criar contrato com regra de negociacao
function NewContractModal({ onClose }: { onClose: () => void }) {
  const [partnerPercent, setPartnerPercent] = useState(50);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
  const [error, setError] = useState('');

  const platformPercent = 100 - partnerPercent;

  const handlePercentChange = (val: number) => {
    setPartnerPercent(val);
    setShowAdminField(val < 20);
    setError('');
  };

  const handleCreate = async () => {
    if (partnerPercent < 20 && !adminPassword) {
      setError('Comissao abaixo de 20% requer senha de autorizacao do administrador');
      return;
    }
    // Aqui conectaria com a API /api/contract/create
    alert(`Contrato seria criado: Parceiro ${partnerPercent}% / Plataforma ${platformPercent}%`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Novo Contrato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Info da taxa */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h3 className="font-semibold text-indigo-900 mb-2">Taxa de Adesao: R$ 2.000,00</h3>
            <p className="text-xs text-indigo-700 mb-3">Paga pelo cliente demandante da operacao.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Voce recebe</p>
                <p className="text-lg font-bold text-green-600">R$ 800,00</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Plataforma recebe</p>
                <p className="text-lg font-bold text-indigo-600">R$ 1.200,00</p>
              </div>
            </div>
            <p className="text-xs text-indigo-700 mt-2">
              Ao pagar, o cliente libera: consulta completa com IA + formalizacao de todo o processo tributario.
            </p>
          </div>

          {/* Split de creditos recuperados */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Split sobre Creditos Recuperados</label>
            <p className="text-xs text-gray-500 mb-3">Padrao: 50/50. Sem limite de ganho - quanto maior o credito, maior o retorno.</p>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm text-gray-500 w-28">Parceiro:</span>
              <input
                type="range"
                min={5}
                max={80}
                value={partnerPercent}
                onChange={(e) => handlePercentChange(parseInt(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-lg font-bold text-indigo-700 w-16 text-right">{partnerPercent}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 w-28">Plataforma:</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${platformPercent}%` }} />
              </div>
              <span className="text-lg font-bold text-brand-700 w-16 text-right">{platformPercent}%</span>
            </div>
          </div>

          {/* Simulacao de ganho */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Simulacao de ganho (exemplo: credito de R$ 500.000)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Voce recebe</p>
                <p className="text-lg font-bold text-green-600">R$ {(500000 * partnerPercent / 100).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Plataforma recebe</p>
                <p className="text-lg font-bold text-indigo-600">R$ {(500000 * platformPercent / 100).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Indicador visual */}
          <div className={`rounded-lg p-4 ${
            partnerPercent >= 20
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            {partnerPercent >= 20 ? (
              <p className="text-sm text-green-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                <strong>Aprovado automaticamente.</strong> Sem limite superior - negocie livremente!
              </p>
            ) : (
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <strong>Requer autorizacao.</strong> Comissao abaixo de 20% precisa de senha do administrador.
              </p>
            )}
          </div>

          {/* Campo de senha admin */}
          {showAdminField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Senha de Autorizacao (Administrador)
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
              className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors"
            >
              Criar Contrato
            </button>
            <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const demoContracts = [
  { id: '1', contractNumber: 'TC-2026-A1B2C3D4', clientName: 'Joao Silva', clientCompany: 'Metalurgica ABC Ltda', setupFee: 2000, setupFeePartner: 800, setupFeePlatform: 1200, setupFeePaid: true, partnerSplitPercent: 50, platformSplitPercent: 50, status: 'active', partnerSigned: true, clientSigned: true, totalRecovered: 450000, partnerEarnings: 225000, createdAt: '2026-01-15' },
  { id: '2', contractNumber: 'TC-2026-E5F6G7H8', clientName: 'Maria Santos', clientCompany: 'Comercio XYZ S.A.', setupFee: 2000, setupFeePartner: 800, setupFeePlatform: 1200, setupFeePaid: true, partnerSplitPercent: 50, platformSplitPercent: 50, status: 'active', partnerSigned: true, clientSigned: true, totalRecovered: 0, partnerEarnings: 0, createdAt: '2026-02-01' },
  { id: '3', contractNumber: 'TC-2026-I9J0K1L2', clientName: 'Carlos Oliveira', clientCompany: 'Industria Moderna ME', setupFee: 2000, setupFeePartner: 800, setupFeePlatform: 1200, setupFeePaid: false, partnerSplitPercent: 50, platformSplitPercent: 50, status: 'pending_payment', partnerSigned: true, clientSigned: false, totalRecovered: 0, partnerEarnings: 0, createdAt: '2026-02-08' },
];

export default function ContratosPage() {
  const [contracts] = useState(demoContracts);
  const [showNewContract, setShowNewContract] = useState(false);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-700' },
    pending_payment: { label: 'Aguardando Pagamento', cls: 'bg-yellow-100 text-yellow-700' },
    pending_signatures: { label: 'Aguardando Assinaturas', cls: 'bg-orange-100 text-orange-700' },
    active: { label: 'Ativo', cls: 'bg-green-100 text-green-700' },
    completed: { label: 'Concluido', cls: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
  };

  const totalEarnings = contracts.reduce((a, c) => a + c.partnerEarnings, 0);
  const totalRecovered = contracts.reduce((a, c) => a + c.totalRecovered, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">Acompanhe seus contratos e ganhos</p>
        </div>
        <button
          onClick={() => setShowNewContract(true)}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Novo Contrato
        </button>
      </div>

      {showNewContract && <NewContractModal onClose={() => setShowNewContract(false)} />}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Recuperado (seus clientes)</p>
          <p className="text-2xl font-bold text-brand-700">R$ {totalRecovered.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Seus Ganhos (50%)</p>
          <p className="text-2xl font-bold text-green-600">R$ {totalEarnings.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Contratos Ativos</p>
          <p className="text-2xl font-bold text-indigo-600">{contracts.filter(c => c.status === 'active').length}</p>
        </div>
      </div>

      {/* Contracts list */}
      <div className="space-y-4">
        {contracts.map(contract => {
          const badge = statusConfig[contract.status] || statusConfig.draft;
          return (
            <div key={contract.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{contract.clientCompany}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {contract.contractNumber} | {contract.clientName} | Criado em {contract.createdAt}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Seus ganhos</p>
                  <p className="text-xl font-bold text-green-600">R$ {contract.partnerEarnings.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Taxa Inicial</p>
                  <p className="font-semibold text-gray-900">R$ {contract.setupFee.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-gray-500">Voce: R$ 800 | Plataforma: R$ 1.200</p>
                  <p className={`text-xs font-medium ${contract.setupFeePaid ? 'text-green-600' : 'text-yellow-600'}`}>
                    {contract.setupFeePaid ? 'Pago - Consulta liberada' : 'Pendente - Aguardando pagamento'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Split</p>
                  <p className="font-semibold text-gray-900">{contract.partnerSplitPercent}% / {contract.platformSplitPercent}%</p>
                  <p className="text-xs text-gray-500">Voce / Plataforma</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Total Recuperado</p>
                  <p className="font-semibold text-gray-900">R$ {contract.totalRecovered.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Assinaturas</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-3 h-3 rounded-full ${contract.partnerSigned ? 'bg-green-500' : 'bg-gray-300'}`} title="Parceiro" />
                    <span className={`w-3 h-3 rounded-full ${contract.clientSigned ? 'bg-green-500' : 'bg-gray-300'}`} title="Cliente" />
                    <span className="text-xs text-gray-500">{contract.partnerSigned && contract.clientSigned ? 'Ambos' : 'Pendente'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
