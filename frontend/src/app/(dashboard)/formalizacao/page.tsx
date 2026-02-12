'use client';

import { useState } from 'react';

const demoProcesses = [
  {
    id: '1',
    analysisId: 'a1',
    opportunityIndex: 0,
    opportunityType: 'PIS/COFINS sobre Insumos',
    estimatedValue: 450000,
    status: 'docs_generated',
    protocolNumber: null,
    protocolDate: null,
  },
  {
    id: '2',
    analysisId: 'a3',
    opportunityIndex: 0,
    opportunityType: 'Exclusão ICMS da Base PIS/COFINS',
    estimatedValue: 620000,
    status: 'filed',
    protocolNumber: 'RFB-2026-00428751',
    protocolDate: '2026-02-05T10:00:00Z',
  },
];

const checklistItems = [
  'Notas fiscais separadas',
  'SPED transmitido',
  'Certificado digital válido',
  'Procuração eletrônica configurada',
  'Memória de cálculo revisada',
  'Parecer técnico conferido',
];

interface EcacData {
  perdcompData: {
    codigoReceita: string;
    periodoApuracao: string;
    valorCredito: number;
    naturezaCredito: string;
    fundamentacaoLegal: string;
  };
  instructions: string[];
  estimatedProcessingTime: string;
}

export default function FormalizacaoPage() {
  const [processes, setProcesses] = useState(demoProcesses);
  const [checklists, setChecklists] = useState<Record<string, Record<string, boolean>>>({});
  const [protocolInputs, setProtocolInputs] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [ecacData, setEcacData] = useState<EcacData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingEcac, setLoadingEcac] = useState(false);

  const toggleCheck = (processId: string, item: string) => {
    setChecklists(prev => ({
      ...prev,
      [processId]: { ...prev[processId], [item]: !prev[processId]?.[item] }
    }));
  };

  const getProgress = (processId: string) => {
    const checks = checklists[processId] || {};
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / checklistItems.length) * 100);
  };

  const handleViewEcac = async (analysisId: string, oppIndex: number) => {
    setLoadingEcac(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tax-credit/prepare-perdcomp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ analysisId, opportunityIndex: oppIndex }),
      });
      const data = await res.json();
      if (data.success) {
        setEcacData(data.data);
        setShowModal(true);
      }
    } catch (error) {
      alert('Erro ao buscar dados. Verifique se o backend está rodando.');
    } finally {
      setLoadingEcac(false);
    }
  };

  const handleSaveProtocol = (processId: string) => {
    const num = protocolInputs[processId];
    if (!num) return;
    setProcesses(prev =>
      prev.map(p => p.id === processId
        ? { ...p, protocolNumber: num, protocolDate: new Date().toISOString(), status: 'filed' }
        : p
      )
    );
    setProtocolInputs(prev => ({ ...prev, [processId]: '' }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig: Record<string, { label: string; cls: string }> = {
    docs_generated: { label: 'Docs Gerados', cls: 'bg-blue-100 text-blue-700' },
    ready_to_file: { label: 'Pronto p/ Protocolar', cls: 'bg-yellow-100 text-yellow-700' },
    filed: { label: 'Protocolado', cls: 'bg-purple-100 text-purple-700' },
    approved: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Indeferido', cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Formalização</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie os processos de recuperação de crédito tributário</p>
      </div>

      {processes.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-gray-500 font-medium">Nenhum processo de formalização</p>
          <p className="text-gray-400 text-sm mt-1">Gere documentação a partir de uma oportunidade identificada</p>
        </div>
      ) : (
        <div className="space-y-6">
          {processes.map((process) => {
            const progress = getProgress(process.id);
            const badge = statusConfig[process.status] || statusConfig.docs_generated;

            return (
              <div key={process.id} className="card">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{process.opportunityType}</h3>
                      <p className="text-2xl font-bold text-brand-700 mt-1">
                        R$ {process.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Checklist */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Checklist de Validação</h4>
                    <span className={`text-sm font-bold ${progress === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                      {progress}%
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-100 rounded-full mb-4">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {checklistItems.map((item) => (
                      <label
                        key={item}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          checklists[process.id]?.[item]
                            ? 'bg-green-50 text-green-700'
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checklists[process.id]?.[item] || false}
                          onChange={() => toggleCheck(process.id, item)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className={`text-sm ${checklists[process.id]?.[item] ? 'line-through' : ''}`}>
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6">
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => handleViewEcac(process.analysisId, process.opportunityIndex)}
                      disabled={loadingEcac}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      {loadingEcac ? 'Carregando...' : 'Ver Dados para e-CAC'}
                    </button>
                  </div>

                  {/* Protocol input */}
                  {process.status !== 'filed' && process.status !== 'approved' && (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Número do protocolo (ex: RFB-2026-...)"
                        value={protocolInputs[process.id] || ''}
                        onChange={(e) => setProtocolInputs(prev => ({ ...prev, [process.id]: e.target.value }))}
                        className="input flex-1"
                      />
                      <button
                        onClick={() => handleSaveProtocol(process.id)}
                        disabled={!protocolInputs[process.id]}
                        className="btn-primary text-sm whitespace-nowrap"
                      >
                        Salvar Protocolo
                      </button>
                    </div>
                  )}

                  {/* Saved protocol */}
                  {process.protocolNumber && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-green-600 uppercase">Protocolo Registrado</p>
                        <p className="text-lg font-bold text-green-800">{process.protocolNumber}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        {process.protocolDate ? new Date(process.protocolDate).toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* e-CAC Modal */}
      {showModal && ecacData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Dados para e-CAC</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* PER/DCOMP Data */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Dados PER/DCOMP</h3>
                {[
                  { label: 'Código Receita', value: ecacData.perdcompData.codigoReceita },
                  { label: 'Período', value: ecacData.perdcompData.periodoApuracao },
                  { label: 'Valor', value: `R$ ${ecacData.perdcompData.valorCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                  { label: 'Natureza', value: ecacData.perdcompData.naturezaCredito },
                  { label: 'Fund. Legal', value: ecacData.perdcompData.fundamentacaoLegal },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-500">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
                <button
                  onClick={() => copyToClipboard(JSON.stringify(ecacData.perdcompData, null, 2))}
                  className={`w-full mt-2 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    copied ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {copied ? 'Copiado!' : 'Copiar Todos os Dados'}
                </button>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Passo a Passo</h3>
                <div className="space-y-2">
                  {ecacData.instructions.map((inst, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700">{inst}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimated time */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Prazo estimado:</strong> {ecacData.estimatedProcessingTime}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href="https://cav.receita.fazenda.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 text-center text-sm"
                >
                  Abrir e-CAC
                </a>
                <button onClick={() => setShowModal(false)} className="btn-secondary text-sm">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
