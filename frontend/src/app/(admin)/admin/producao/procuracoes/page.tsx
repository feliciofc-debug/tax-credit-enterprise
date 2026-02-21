'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { authedFetcher, getApiUrl, getToken, SWR_OPTIONS_MEDIUM } from '@/lib/fetcher';

interface Procuration {
  id: string;
  contractId: string | null;
  clientId: string;
  partnerId: string | null;
  type: string;
  lawyerScenario: string;
  status: string;
  outorgadoAtom: boolean;
  outorgadoAdv: boolean;
  advogadoNome: string | null;
  advogadoOab: string | null;
  advogadoCpf: string | null;
  advogadoEndereco: string | null;
  uf: string | null;
  prazoAnos: number;
  documentText: string | null;
  dataAssinatura: string | null;
  dataValidade: string | null;
  createdAt: string;
  client?: { id: string; name: string; company: string; cnpj: string; email: string } | null;
}

interface Client {
  id: string;
  name: string;
  company: string;
  cnpj: string;
  email: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  legalRepName: string | null;
  legalRepCpf: string | null;
  legalRepRg: string | null;
  legalRepCargo: string | null;
}

interface ContractOption {
  id: string;
  contractNumber: string;
  contractType: string;
  status: string;
  clientId: string;
  partnerId: string | null;
  lawyerName: string | null;
  lawyerOab: string | null;
  client: { id: string; name: string; company: string; cnpj: string } | null;
  partner: { id: string; name: string; company: string; oabNumber: string; oabState: string } | null;
}

interface AnalysisOption {
  id: string;
  analysisId: string;
  source: 'analysis';
  companyName: string;
  cnpj: string | null;
  estimatedCredit: number | null;
  viabilityScore: number | null;
  scoreLabel: string | null;
  partnerId: string | null;
  partner: { id: string; name: string; company: string; oabNumber: string; oabState: string } | null;
  createdAt: string;
}

interface ContractsListData {
  contracts: ContractOption[];
  analyses: AnalysisOption[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  generated: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Gerada' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Enviada' },
  signed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Assinada' },
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativa' },
  expired: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Expirada' },
  revoked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Revogada' },
};

const TYPE_LABELS: Record<string, string> = {
  particular: 'Procuração Particular',
  ecac_guide: 'Guia e-CAC',
  sefaz: 'Procuração SEFAZ',
};

const SCENARIO_LABELS: Record<string, string> = {
  atom_lawyer: 'Adv. indicado pela TaxCredit',
  partner_lawyer: 'Adv. parceiro (tripartite)',
  client_lawyer: 'Adv. do próprio cliente',
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function ProcuracoesAdminPage() {
  const [showForm, setShowForm] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const queryParts: string[] = [];
  if (filterStatus) queryParts.push(`status=${filterStatus}`);
  if (filterType) queryParts.push(`type=${filterType}`);
  const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

  const { data: procurations, error: listError, mutate } = useSWR<Procuration[]>(
    `/api/procuration/list${qs}`,
    authedFetcher,
    { ...SWR_OPTIONS_MEDIUM, onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => { if (retryCount >= 2) return; setTimeout(() => revalidate({ retryCount }), 3000); } },
  );

  const apiCall = useCallback(async (path: string, method: string, body?: any) => {
    const base = getApiUrl();
    const token = getToken();
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await apiCall(`/api/procuration/${id}/status`, 'PUT', { status });
    mutate();
  };

  const handlePrint = (text: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Procuração</title>
<style>body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.8;margin:40px 60px;color:#000;}
pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:inherit;line-height:inherit;}
@media print{body{margin:20mm 25mm;}}</style>
</head><body><pre>${text}</pre></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const previewProc = procurations?.find(p => p.id === previewId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurações</h1>
          <p className="text-sm text-gray-500 mt-1">Gere e acompanhe procurações para protocolar na RFB/SEFAZ</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Gerar Procuração
        </button>
      </div>

      {/* Stats */}
      {Array.isArray(procurations) && procurations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Object.entries(STATUS_COLORS).map(([key, val]) => {
            const count = procurations.filter(p => p.status === key).length;
            return (
              <div key={key} className={`${val.bg} rounded-lg p-3 text-center cursor-pointer hover:opacity-80`} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}>
                <p className={`text-xl font-bold ${val.text}`}>{count}</p>
                <p className={`text-xs ${val.text}`}>{val.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
          <option value="">Todos status</option>
          {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
          <option value="">Todos tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); }} className="text-sm text-gray-500 underline">Limpar</button>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <GenerateForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); mutate(); }}
          apiCall={apiCall}
        />
      )}

      {/* Preview modal */}
      {previewProc && previewProc.documentText && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-gray-900">Preview — {TYPE_LABELS[previewProc.type] || previewProc.type}</h2>
              <div className="flex gap-2">
                <button onClick={() => handlePrint(previewProc.documentText!)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Imprimir PDF</button>
                <button onClick={() => setPreviewId(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-serif leading-relaxed">{previewProc.documentText}</pre>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {!procurations && !listError ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
      ) : !Array.isArray(procurations) || procurations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p>Nenhuma procuração gerada</p>
          <p className="text-sm mt-1">Clique em "Gerar Procuração" para começar</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cenário Advogado</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {procurations.map(p => {
                const st = STATUS_COLORS[p.status] || STATUS_COLORS.generated;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.client?.company || p.client?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{p.client?.cnpj || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[p.type] || p.type}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{SCENARIO_LABELS[p.lawyerScenario] || p.lawyerScenario}</span>
                      {p.advogadoNome && <p className="text-[10px] text-gray-400 mt-0.5">{p.advogadoNome} — OAB {p.advogadoOab}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={p.status}
                        onChange={e => handleStatusChange(p.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${st.bg} ${st.text}`}
                      >
                        {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.documentText && (
                          <>
                            <button onClick={() => setPreviewId(p.id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Preview">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                            <button onClick={() => handlePrint(p.documentText!)} className="p-1.5 text-gray-400 hover:text-green-600" title="Imprimir PDF">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            </button>
                          </>
                        )}
                        {p.client?.email && (
                          <a
                            href={`mailto:${p.client.email}?subject=Procuração para Assinatura — TaxCredit Enterprise&body=Prezado(a),%0A%0ASegue em anexo a procuração para assinatura com firma reconhecida.%0A%0AAtenciosamente,%0ATaxCredit Enterprise`}
                            className="p-1.5 text-gray-400 hover:text-purple-600"
                            title="Enviar por email"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FORM DE GERAÇÃO
// ============================================================
function GenerateForm({
  onClose,
  onSuccess,
  apiCall,
}: {
  onClose: () => void;
  onSuccess: () => void;
  apiCall: (path: string, method: string, body?: any) => Promise<any>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sourceType, setSourceType] = useState<'manual' | 'contract' | 'analysis'>('manual');
  const [selectedContract, setSelectedContract] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [lawyerScenario, setLawyerScenario] = useState('atom_lawyer');
  const [types, setTypes] = useState({ particular: true, ecac_guide: true, sefaz: false });
  const [advNome, setAdvNome] = useState('');
  const [advOab, setAdvOab] = useState('');
  const [advCpf, setAdvCpf] = useState('');
  const [advEndereco, setAdvEndereco] = useState('');
  const [uf, setUf] = useState('');
  const [prazo, setPrazo] = useState(2);
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisOption | null>(null);

  const { data: clients } = useSWR<Client[]>(
    '/api/procuration/clients/list',
    authedFetcher,
    { revalidateOnFocus: false },
  );

  const contractsFetcher = async (url: string) => {
    try {
      const base = getApiUrl();
      const token = getToken();
      const r = await fetch(`${base}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return { contracts: [], analyses: [] };
      const json = await r.json();
      const d = json.data ?? json;
      if (d && d.contracts) return d;
      if (Array.isArray(d)) return { contracts: d, analyses: [] };
      return { contracts: [], analyses: [] };
    } catch {
      return { contracts: [], analyses: [] };
    }
  };

  const { data: sourceData } = useSWR<ContractsListData>(
    '/api/procuration/contracts/list',
    contractsFetcher,
    { revalidateOnFocus: false },
  );

  const contracts = sourceData?.contracts || [];
  const analyses = sourceData?.analyses || [];

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  useEffect(() => {
    if (sourceType === 'contract' && selectedContract && contracts.length) {
      const c = contracts.find(ct => ct.id === selectedContract);
      if (c) {
        setSelectedClient(c.clientId);
        if (c.contractType === 'tripartite' && c.partner) {
          setLawyerScenario('partner_lawyer');
          setAdvNome(c.partner.name || '');
          setAdvOab(`${c.partner.oabNumber || ''}/${c.partner.oabState || ''}`);
        }
        if (c.lawyerName) {
          setAdvNome(c.lawyerName);
          setAdvOab(c.lawyerOab || '');
        }
      }
    }
  }, [selectedContract, contracts, sourceType]);

  useEffect(() => {
    if (sourceType === 'analysis' && selectedAnalysis && analyses.length) {
      const a = analyses.find(an => an.id === selectedAnalysis);
      if (a) {
        setAnalysisInfo(a);
        if (a.partner) {
          setLawyerScenario('partner_lawyer');
          setAdvNome(a.partner.name || '');
          setAdvOab(`${a.partner.oabNumber || ''}/${a.partner.oabState || ''}`);
        }
        const matchingClient = clients?.find(c => c.cnpj === a.cnpj || c.company === a.companyName);
        if (matchingClient) {
          setSelectedClient(matchingClient.id);
        }
      }
    }
  }, [selectedAnalysis, analyses, clients, sourceType]);

  const handleGenerate = async () => {
    setSaving(true);
    setError('');
    try {
      const selectedTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k);
      if (selectedTypes.length === 0) {
        setError('Selecione pelo menos um tipo de procuração');
        setSaving(false);
        return;
      }
      if (!selectedClient) {
        setError('Selecione um cliente');
        setSaving(false);
        return;
      }

      const realContractId = sourceType === 'contract' ? selectedContract : undefined;

      for (const type of selectedTypes) {
        const result = await apiCall('/api/procuration/generate', 'POST', {
          clientId: selectedClient,
          contractId: realContractId || undefined,
          type,
          lawyerScenario,
          advogadoNome: advNome || undefined,
          advogadoOab: advOab || undefined,
          advogadoCpf: advCpf || undefined,
          advogadoEndereco: advEndereco || undefined,
          uf: uf || undefined,
          prazoAnos: prazo,
        });
        if (!result.success) {
          setError(result.error || 'Erro ao gerar procuração');
          setSaving(false);
          return;
        }
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const selectedClientData = clients?.find(c => c.id === selectedClient);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Gerar Procuração</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

          {/* Source selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Selecionar fonte dos dados</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setSourceType('analysis'); setSelectedContract(''); setSelectedAnalysis(''); setAnalysisInfo(null); }}
                className={`p-3 rounded-lg border text-center transition-all ${
                  sourceType === 'analysis' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">Análise com Crédito</p>
                <p className="text-xs text-gray-500 mt-0.5">{analyses.length} disponível(eis)</p>
              </button>
              <button
                type="button"
                onClick={() => { setSourceType('contract'); setSelectedContract(''); setSelectedAnalysis(''); setAnalysisInfo(null); }}
                className={`p-3 rounded-lg border text-center transition-all ${
                  sourceType === 'contract' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">Contrato Existente</p>
                <p className="text-xs text-gray-500 mt-0.5">{contracts.length} disponível(eis)</p>
              </button>
              <button
                type="button"
                onClick={() => { setSourceType('manual'); setSelectedContract(''); setSelectedAnalysis(''); setAnalysisInfo(null); }}
                className={`p-3 rounded-lg border text-center transition-all ${
                  sourceType === 'manual' ? 'border-gray-500 bg-gray-50 ring-1 ring-gray-500' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">Selecionar Manual</p>
              </button>
            </div>
          </div>

          {/* Analysis selection */}
          {sourceType === 'analysis' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Análise com crédito identificado *</label>
              {analyses.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                  Nenhuma análise com crédito encontrada. Gere uma análise de viabilidade primeiro.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analyses.map(a => (
                    <label
                      key={a.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                        selectedAnalysis === a.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="analysis"
                          checked={selectedAnalysis === a.id}
                          onChange={() => setSelectedAnalysis(a.id)}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.companyName}</p>
                          <p className="text-xs text-gray-500">
                            CNPJ: {a.cnpj || '—'}
                            {a.partner && <span className="ml-2">| Parceiro: {a.partner.name}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">
                          {a.estimatedCredit ? formatCurrency(a.estimatedCredit) : '—'}
                        </p>
                        {a.viabilityScore && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            a.viabilityScore >= 70 ? 'bg-green-100 text-green-700'
                            : a.viabilityScore >= 40 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            Score {a.viabilityScore}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contract selection */}
          {sourceType === 'contract' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contrato</label>
              {contracts.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                  Nenhum contrato encontrado. Gere um contrato na aba de Formalização primeiro.
                </div>
              ) : (
                <select value={selectedContract} onChange={e => setSelectedContract(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Selecionar contrato...</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contractNumber} — {c.client?.company || c.client?.name || '?'} ({c.contractType})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Client selection — SEMPRE visível para o admin */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cliente / Empresa *</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Selecione o cliente ou empresa...</option>
              {(clients || []).filter((c: any) => !c._source).length > 0 && (
                <optgroup label="Clientes cadastrados">
                  {(clients || []).filter((c: any) => !c._source).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company || c.name} — {c.cnpj || c.email}</option>
                  ))}
                </optgroup>
              )}
              {(clients || []).filter((c: any) => c._source === 'analysis').length > 0 && (
                <optgroup label="Empresas analisadas (com crédito)">
                  {(clients || []).filter((c: any) => c._source === 'analysis').map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name} — {c.cnpj || 'S/CNPJ'} — R$ {Number(c.estimatedCredit || 0).toLocaleString('pt-BR')}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {sourceType === 'analysis' && analysisInfo && !selectedClient && (
              <p className="text-xs text-amber-600 mt-1">
                Selecione o cliente correspondente à análise de &quot;{analysisInfo.companyName}&quot;
              </p>
            )}
          </div>

          {/* Selected client info */}
          {selectedClientData && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-800">{selectedClientData.company || selectedClientData.name}</p>
              <p>CNPJ: {selectedClientData.cnpj || '—'} | Rep. Legal: {selectedClientData.legalRepName || '—'} | CPF: {selectedClientData.legalRepCpf || '—'}</p>
              {selectedClientData.endereco && <p>Endereço: {[selectedClientData.endereco, selectedClientData.cidade, selectedClientData.estado].filter(Boolean).join(', ')}</p>}
              {(selectedClientData as any)._source === 'analysis' && (
                <p className="text-green-700 mt-1 font-medium">Crédito estimado: R$ {Number((selectedClientData as any).estimatedCredit || 0).toLocaleString('pt-BR')}</p>
              )}
            </div>
          )}

          {/* Lawyer scenario */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Quem será o advogado responsável? *</label>
            <div className="space-y-2">
              {[
                { value: 'atom_lawyer', label: 'Advogado indicado pela TaxCredit', desc: 'Bipartite — custo do advogado sai dos 20% da ATOM' },
                { value: 'partner_lawyer', label: 'Advogado parceiro (tripartite)', desc: 'Tripartite — advogado recebe % via escrow' },
                { value: 'client_lawyer', label: 'Advogado do próprio cliente', desc: 'Bipartite — honorários são responsabilidade do cliente' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${lawyerScenario === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="scenario" value={opt.value} checked={lawyerScenario === opt.value} onChange={() => setLawyerScenario(opt.value)} className="mt-0.5"/>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Lawyer details — sempre visível */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-gray-700">Dados do Advogado <span className="text-gray-400 font-normal">(preencha se houver advogado no processo)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Nome</label>
                  <input type="text" value={advNome} onChange={e => setAdvNome(e.target.value)} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="Dr. Nome Completo"/>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">OAB</label>
                  <input type="text" value={advOab} onChange={e => setAdvOab(e.target.value)} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="RJ 123.456"/>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">CPF</label>
                  <input type="text" value={advCpf} onChange={e => setAdvCpf(e.target.value)} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="000.000.000-00"/>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Endereço</label>
                  <input type="text" value={advEndereco} onChange={e => setAdvEndereco(e.target.value)} className="w-full px-3 py-1.5 border rounded text-sm"/>
                </div>
              </div>
          </div>

          {/* Types */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipo(s) de procuração a gerar *</label>
            <div className="flex gap-4">
              {[
                { key: 'particular', label: 'Procuração Particular', desc: 'Com firma reconhecida' },
                { key: 'ecac_guide', label: 'Guia e-CAC', desc: 'Instrução para o cliente' },
                { key: 'sefaz', label: 'Procuração SEFAZ', desc: 'Específica para ICMS' },
              ].map(t => (
                <label key={t.key} className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${(types as any)[t.key] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={(types as any)[t.key]}
                    onChange={e => setTypes({ ...types, [t.key]: e.target.checked })}
                    className="hidden"
                  />
                  <p className="text-sm font-medium text-gray-900">{t.label}</p>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {types.sefaz && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">UF (para SEFAZ)</label>
              <select value={uf} onChange={e => setUf(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Selecionar UF...</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prazo de validade (anos)</label>
            <select value={prazo} onChange={e => setPrazo(Number(e.target.value))} className="w-40 px-3 py-2 border rounded-lg text-sm">
              <option value={1}>1 ano</option>
              <option value={2}>2 anos</option>
              <option value={3}>3 anos</option>
              <option value={5}>5 anos</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button
              onClick={handleGenerate}
              disabled={saving || !selectedClient}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Gerando...' : 'Gerar Procuração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
