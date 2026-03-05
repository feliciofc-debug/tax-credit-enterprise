'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { authedFetcher, SWR_OPTIONS_FAST } from '@/lib/fetcher';
import { CHECKLISTS, UF_OPTIONS, TIPO_LABELS, TIPO_COLORS, type ChecklistEstado, type ChecklistEtapa } from '@/data/checklists';

interface PartnerData {
  id: string;
  name: string;
  company?: string;
  cnpj?: string;
  oabNumber?: string;
  oabState?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  bankCpfCnpj?: string;
}

interface AnalysisForFormalization {
  id: string;
  companyName: string;
  cnpj: string;
  estimatedCredit: number;
  viabilityScore: number;
  scoreLabel: string;
  partnerId?: string;
  partnerName: string;
  partner?: PartnerData | null;
  createdAt: string;
  opportunities: any[];
  contractId?: string;
  formalizacaoLiberada?: boolean;
}

type Tab = 'checklist' | 'sefaz' | 'perdcomp' | 'contrato';

export default function FormalizacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('checklist');
  const [selectedUf, setSelectedUf] = useState('SP');
  const { data: analyses = [], isLoading: loading } = useSWR<AnalysisForFormalization[]>(
    '/api/viability/admin-analyses',
    authedFetcher,
    SWR_OPTIONS_FAST,
  );
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisForFormalization | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const printRef = useRef<HTMLDivElement>(null);

  // Campos do requerimento SEFAZ
  const [sefazFields, setSefazFields] = useState({
    advogadoNome: '',
    advogadoOab: '',
    advogadoUf: '',
    advogadoEmail: '',
    advogadoEndereco: '',
    tipoPedido: 'COMPENSACAO',
    inscricaoEstadual: '',
    atividadeEmpresa: '',
    cnaePrincipal: '',
  });

  // Campos do PER/DCOMP
  const [perdcompFields, setPerdcompFields] = useState({
    advogadoNome: '',
    advogadoOab: '',
    advogadoUf: '',
    tipoCredito: 'Saldo Negativo de IRPJ',
    periodoCredito: '',
    codigoReceitaDebito: '',
    periodoDebito: '',
  });

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checklist: ChecklistEstado | null = CHECKLISTS[selectedUf] || null;

  const getEtapaProgress = (etapa: ChecklistEtapa) => {
    const total = etapa.itens.filter(i => i.obrigatorio).length;
    const checked = etapa.itens.filter(i => i.obrigatorio && checkedItems[i.id]).length;
    return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
  };

  const getTotalProgress = () => {
    if (!checklist) return { total: 0, checked: 0, percent: 0 };
    const allRequired = checklist.etapas.flatMap(e => e.itens.filter(i => i.obrigatorio));
    const total = allRequired.length;
    const checked = allRequired.filter(i => checkedItems[i.id]).length;
    return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR');

  const handleGenerateSefaz = async () => {
    if (!selectedAnalysis) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/formalization/generate-sefaz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          analysisId: selectedAnalysis.id,
          uf: selectedUf,
          ...sefazFields,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedDoc(data.data.document);
      } else {
        alert(data.error || 'Erro ao gerar documento');
      }
    } catch (e) {
      alert('Erro de conexao');
    } finally {
      setGenerating(false);
    }
  };

  const handleGeneratePerdcomp = async () => {
    if (!selectedAnalysis) {
      alert('Selecione uma analise primeiro.');
      return;
    }
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${apiBase}/api/formalization/generate-perdcomp`;
      console.log('[PER/DCOMP] Requesting:', url, 'analysisId:', selectedAnalysis.id);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          analysisId: selectedAnalysis.id,
          ...perdcompFields,
        }),
      });
      const data = await res.json();
      console.log('[PER/DCOMP] Response:', JSON.stringify(data).substring(0, 500));
      if (data.success && data.data) {
        const docs = data.data.documents;
        if (Array.isArray(docs) && docs.length > 0) {
          const combined = docs.map((d: any) =>
            `${'='.repeat(80)}\n  PARECER PER/DCOMP — ${d.tributo} (${d.naturezaCredito})\n  Valor: R$ ${Number(d.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n${'='.repeat(80)}\n\n${d.document}`
          ).join('\n\n\n');
          setGeneratedDoc(combined);
        } else {
          alert('Nenhuma oportunidade federal encontrada para gerar PER/DCOMP.\n\nOportunidades estaduais (ICMS) devem usar a aba "Requerimento SEFAZ".');
        }
        if (data.data.avisoEstaduais) {
          alert(data.data.avisoEstaduais);
        }
      } else {
        alert('Erro: ' + (data.error || 'Resposta inesperada do servidor'));
      }
    } catch (e: any) {
      console.error('[PER/DCOMP] Error:', e);
      alert('Erro de conexao: ' + (e.message || 'Falha na comunicacao com o servidor'));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!generatedDoc) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Documento - TaxCredit Enterprise</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6; margin: 40px; color: #111; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        @media print { body { margin: 20mm; } }
      </style>
      </head><body><pre>${generatedDoc}</pre></body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'checklist', label: 'Checklist por Estado', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'sefaz', label: 'Requerimento SEFAZ', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'perdcomp', label: 'Parecer PER/DCOMP', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'contrato', label: 'Gerar Contrato', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formalizacao Processual</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gere documentos oficiais para protocolo SEFAZ e PER/DCOMP, acompanhe checklists por estado
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setGeneratedDoc(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span className="text-xs sm:text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CHECKLIST TAB */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {/* UF Selector */}
          <div className="flex flex-wrap gap-2">
            {UF_OPTIONS.map(uf => (
              <button
                key={uf.value}
                onClick={() => { setSelectedUf(uf.value); setCheckedItems({}); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedUf === uf.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
                }`}
              >
                {uf.value === 'FEDERAL' ? 'Federal' : uf.value}
                <span className="hidden sm:inline ml-1 text-xs opacity-75">({uf.label})</span>
              </button>
            ))}
          </div>

          {checklist && (
            <>
              {/* Info Bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{checklist.nome}</h2>
                    <p className="text-gray-500 text-sm">Sistema: <span className="font-medium text-gray-700">{checklist.sistema}</span></p>
                    <p className="text-gray-400 text-xs mt-1">{checklist.legislacao}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">{getTotalProgress().percent}%</div>
                    <p className="text-gray-500 text-xs">{getTotalProgress().checked}/{getTotalProgress().total} obrigatorios</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${getTotalProgress().percent}%` }}
                  />
                </div>
              </div>

              {/* Etapas */}
              {checklist.etapas.map(etapa => {
                const prog = getEtapaProgress(etapa);
                return (
                  <div key={etapa.ordem} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          prog.percent === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {prog.percent === 100 ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : etapa.ordem}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{etapa.titulo}</h3>
                          {etapa.prazo && <p className="text-gray-400 text-xs">{etapa.prazo}</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        prog.percent === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {prog.checked}/{prog.total}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {etapa.itens.map(item => (
                        <label
                          key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                            checkedItems[item.id] ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!!checkedItems[item.id]}
                            onChange={() => toggleCheck(item.id)}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm ${checkedItems[item.id] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                {item.descricao}
                              </span>
                              {!item.obrigatorio && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Opcional</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${TIPO_COLORS[item.tipo] || 'bg-gray-100 text-gray-500'}`}>
                                {TIPO_LABELS[item.tipo] || item.tipo}
                              </span>
                              {item.condicao && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                  {item.condicao}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-300 font-mono mt-1">{item.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* SEFAZ TAB */}
      {activeTab === 'sefaz' && (
        <div className="space-y-6">
          {/* Analysis selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Selecionar Analise</h3>
            {loading ? (
              <p className="text-gray-400 text-sm">Carregando...</p>
            ) : analyses.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhuma analise completa encontrada</p>
            ) : (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={selectedAnalysis?.id || ''}
                onChange={e => setSelectedAnalysis(analyses.find(a => a.id === e.target.value) || null)}
              >
                <option value="">-- Escolha uma analise --</option>
                {analyses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.companyName} — {a.cnpj || 'S/CNPJ'} — {formatCurrency(a.estimatedCredit || 0)} ({formatDate(a.createdAt)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* UF Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Estado (SEFAZ)</h3>
            <div className="flex flex-wrap gap-2">
              {UF_OPTIONS.filter(u => u.value !== 'FEDERAL').map(uf => (
                <button
                  key={uf.value}
                  onClick={() => setSelectedUf(uf.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedUf === uf.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {uf.value}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Dados do Advogado / Requerimento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nome do Advogado</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.advogadoNome}
                  onChange={e => setSefazFields(p => ({ ...p, advogadoNome: e.target.value }))}
                  placeholder="Dr. Joao Silva"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">OAB</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.advogadoOab}
                  onChange={e => setSefazFields(p => ({ ...p, advogadoOab: e.target.value }))}
                  placeholder="123.456"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">UF OAB</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.advogadoUf}
                  onChange={e => setSefazFields(p => ({ ...p, advogadoUf: e.target.value }))}
                  placeholder="SP"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">E-mail Advogado</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.advogadoEmail}
                  onChange={e => setSefazFields(p => ({ ...p, advogadoEmail: e.target.value }))}
                  placeholder="advogado@escritorio.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Endereco do Escritorio</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.advogadoEndereco}
                  onChange={e => setSefazFields(p => ({ ...p, advogadoEndereco: e.target.value }))}
                  placeholder="Rua X, 123 - Centro, Sao Paulo/SP"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo do Pedido</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.tipoPedido}
                  onChange={e => setSefazFields(p => ({ ...p, tipoPedido: e.target.value }))}
                >
                  <option value="COMPENSACAO">Compensacao</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="UTILIZACAO">Utilizacao</option>
                  <option value="RESTITUICAO">Restituicao</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Inscricao Estadual</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.inscricaoEstadual}
                  onChange={e => setSefazFields(p => ({ ...p, inscricaoEstadual: e.target.value }))}
                  placeholder="123.456.789.000"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Atividade da Empresa</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.atividadeEmpresa}
                  onChange={e => setSefazFields(p => ({ ...p, atividadeEmpresa: e.target.value }))}
                  placeholder="Comercio atacadista de..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CNAE Principal</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={sefazFields.cnaePrincipal}
                  onChange={e => setSefazFields(p => ({ ...p, cnaePrincipal: e.target.value }))}
                  placeholder="4639-7/99"
                />
              </div>
            </div>
            <button
              onClick={handleGenerateSefaz}
              disabled={!selectedAnalysis || generating}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Gerar Requerimento SEFAZ/{selectedUf}
                </>
              )}
            </button>
          </div>

          {/* Generated Document */}
          {generatedDoc && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-semibold text-gray-900">Documento Gerado</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                  >
                    Imprimir / PDF
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedDoc);
                      alert('Copiado!');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <div ref={printRef} className="p-6 max-h-[600px] overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">{generatedDoc}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PER/DCOMP TAB */}
      {activeTab === 'perdcomp' && (
        <div className="space-y-6">
          {/* Analysis selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Selecionar Analise</h3>
            {loading ? (
              <p className="text-gray-400 text-sm">Carregando...</p>
            ) : (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={selectedAnalysis?.id || ''}
                onChange={e => setSelectedAnalysis(analyses.find(a => a.id === e.target.value) || null)}
              >
                <option value="">-- Escolha uma analise --</option>
                {analyses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.companyName} — {a.cnpj || 'S/CNPJ'} — {formatCurrency(a.estimatedCredit || 0)} ({formatDate(a.createdAt)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Dados para o Parecer Tecnico</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nome do Advogado</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.advogadoNome}
                  onChange={e => setPerdcompFields(p => ({ ...p, advogadoNome: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">OAB</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.advogadoOab}
                  onChange={e => setPerdcompFields(p => ({ ...p, advogadoOab: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">UF OAB</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.advogadoUf}
                  onChange={e => setPerdcompFields(p => ({ ...p, advogadoUf: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo de Credito</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.tipoCredito}
                  onChange={e => setPerdcompFields(p => ({ ...p, tipoCredito: e.target.value }))}
                >
                  <option>Saldo Negativo de IRPJ</option>
                  <option>Saldo Negativo de CSLL</option>
                  <option>PIS nao-cumulativo (insumos)</option>
                  <option>COFINS nao-cumulativo (insumos)</option>
                  <option>IPI credito presumido</option>
                  <option>Pagamento indevido ou a maior (DARF)</option>
                  <option>Retencoes na fonte (IRRF/CSRF)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Periodo do Credito</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.periodoCredito}
                  onChange={e => setPerdcompFields(p => ({ ...p, periodoCredito: e.target.value }))}
                  placeholder="01/2024 a 12/2024"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Codigo Receita Debito</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.codigoReceitaDebito}
                  onChange={e => setPerdcompFields(p => ({ ...p, codigoReceitaDebito: e.target.value }))}
                  placeholder="5856"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Periodo do Debito</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={perdcompFields.periodoDebito}
                  onChange={e => setPerdcompFields(p => ({ ...p, periodoDebito: e.target.value }))}
                  placeholder="01/2025"
                />
              </div>
            </div>
            <button
              onClick={handleGeneratePerdcomp}
              disabled={!selectedAnalysis || generating}
              className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Gerar Parecer Tecnico PER/DCOMP
                </>
              )}
            </button>
          </div>

          {/* Generated Document */}
          {generatedDoc && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-semibold text-gray-900">Parecer Gerado</h3>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                    Imprimir / PDF
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedDoc); alert('Copiado!'); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">{generatedDoc}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTRATO TAB (auto-detects bipartite/tripartite) */}
      {activeTab === 'contrato' && (
        <ContractTab analyses={analyses} loading={loading} formatCurrency={formatCurrency} formatDate={formatDate} apiBase={apiBase} />
      )}
    </div>
  );
}

// ==================================================================
// SUB-COMPONENT: Contrato inteligente — Auto-detecta bipartite/tripartite
// ==================================================================
function ContractTab({
  analyses, loading, formatCurrency, formatDate, apiBase
}: {
  analyses: AnalysisForFormalization[];
  loading: boolean;
  formatCurrency: (v: number) => string;
  formatDate: (d: string) => string;
  apiBase: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisForFormalization | null>(null);
  const [contractType, setContractType] = useState<'bipartite' | 'tripartite'>('bipartite');

  const [fields, setFields] = useState({
    empresaNome: '',
    cnpj: '',
    ieCliente: '',
    endereco: '',
    cidade: '',
    uf: '',
    cep: '',
    representanteNome: '',
    representanteCargo: '',
    representanteCpf: '',
    percentualCliente: 80,
    percentualPlataforma: 20,
    percentualParceiro: 0,
    taxaAdesao: 2000,
    valorEstimado: 0,
    advogadoNome: '',
    advogadoOab: '',
    escrowAgencia: '',
    escrowConta: '',
  });

  const [partnerFields, setPartnerFields] = useState({
    parceiroNome: '',
    parceiroCnpjCpf: '',
    parceiroTipoPessoa: 'juridica',
    parceiroOab: '',
    parceiroEndereco: '',
    parceiroCidade: '',
    parceiroUf: '',
    parceiroBanco: '',
    parceiroAgencia: '',
    parceiroConta: '',
    parceiroTitular: '',
    parceiroDocBanco: '',
  });

  const handleSelectAnalysis = (id: string) => {
    const a = analyses.find(x => x.id === id);
    if (!a) {
      setSelectedAnalysis(null);
      return;
    }
    setSelectedAnalysis(a);

    setFields(prev => ({
      ...prev,
      empresaNome: a.companyName || prev.empresaNome,
      cnpj: a.cnpj || prev.cnpj,
      valorEstimado: a.estimatedCredit || prev.valorEstimado,
    }));

    const hasPartner = a.partner && a.partnerName !== 'Admin direto';
    if (hasPartner && a.partner) {
      setContractType('tripartite');
      setFields(prev => ({
        ...prev,
        percentualCliente: 80,
        percentualPlataforma: 12,
        percentualParceiro: 8,
      }));
      setPartnerFields({
        parceiroNome: a.partner.company || a.partner.name || '',
        parceiroCnpjCpf: a.partner.cnpj || '',
        parceiroTipoPessoa: a.partner.cnpj ? 'juridica' : 'fisica',
        parceiroOab: a.partner.oabNumber ? `${a.partner.oabNumber}/${a.partner.oabState || ''}` : '',
        parceiroEndereco: a.partner.endereco || '',
        parceiroCidade: a.partner.cidade || '',
        parceiroUf: a.partner.estado || '',
        parceiroBanco: a.partner.bankName || '',
        parceiroAgencia: a.partner.bankAgency || '',
        parceiroConta: a.partner.bankAccount || '',
        parceiroTitular: a.partner.bankAccountHolder || '',
        parceiroDocBanco: a.partner.bankCpfCnpj || '',
      });
    } else {
      setContractType('bipartite');
      setFields(prev => ({
        ...prev,
        percentualCliente: 80,
        percentualPlataforma: 20,
        percentualParceiro: 0,
      }));
    }
  };

  const handleGenerate = async () => {
    if (!fields.empresaNome) { alert('Preencha pelo menos o nome da empresa'); return; }
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = {
        manual: true,
        contractType,
        empresaNome: fields.empresaNome,
        cnpj: fields.cnpj,
        ieCliente: fields.ieCliente,
        endereco: fields.endereco,
        cidade: fields.cidade,
        uf: fields.uf,
        cep: fields.cep,
        representanteNome: fields.representanteNome,
        representanteCargo: fields.representanteCargo,
        representanteCpf: fields.representanteCpf,
        percentualCliente: fields.percentualCliente,
        percentualPlataforma: fields.percentualPlataforma,
        taxaAdesao: fields.taxaAdesao,
        valorEstimado: fields.valorEstimado,
        advogadoNome: fields.advogadoNome,
        advogadoOab: fields.advogadoOab,
        escrowAgencia: fields.escrowAgencia,
        escrowConta: fields.escrowConta,
      };
      if (contractType === 'tripartite') {
        body.percentualParceiro = fields.percentualParceiro;
        Object.assign(body, partnerFields);
      }

      const res = await fetch(`${apiBase}/api/formalization/generate-bipartite-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedContract(data.data.contractText);
      } else {
        alert(data.error || 'Erro ao gerar contrato');
      }
    } catch (e) {
      alert('Erro de conexao');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintContract = () => {
    if (!generatedContract) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const title = contractType === 'tripartite' ? 'Contrato Tripartite' : 'Contrato Bipartite';
    w.document.write(`
      <html><head><title>${title} - TaxCredit Enterprise</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.7; margin: 40px; color: #111; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        @media print { body { margin: 20mm; } }
      </style></head><body><pre>${generatedContract}</pre></body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const f = (key: string, val: string | number) => setFields(p => ({ ...p, [key]: val }));
  const pf = (key: string, val: string) => setPartnerFields(p => ({ ...p, [key]: val }));

  const isTripartite = contractType === 'tripartite';
  const iColor = isTripartite ? 'emerald' : 'purple';

  return (
    <div className="space-y-6">
      {/* Header com tipo detectado */}
      <div className={`bg-gradient-to-r ${isTripartite ? 'from-emerald-50 to-teal-50 border-emerald-200' : 'from-purple-50 to-indigo-50 border-purple-200'} rounded-xl border p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-bold ${isTripartite ? 'text-emerald-900' : 'text-purple-900'} flex items-center gap-2`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
              {isTripartite ? 'Contrato Tripartite (Parceiro + TaxCredit + Cliente)' : 'Contrato Bipartite (TaxCredit + Cliente)'}
            </h3>
            <p className={`${isTripartite ? 'text-emerald-700' : 'text-purple-700'} text-sm mt-1`}>
              {isTripartite
                ? 'Empresa indicada por parceiro. O parceiro recebe parte dos creditos recuperados (da fatia da TaxCredit).'
                : 'Venda direta. Contrato entre ATOM BRASIL DIGITAL e o cliente, sem parceiro intermediario.'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setContractType('bipartite'); setFields(p => ({ ...p, percentualPlataforma: 20, percentualParceiro: 0 })); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isTripartite ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >Bipartite</button>
            <button
              onClick={() => { setContractType('tripartite'); setFields(p => ({ ...p, percentualPlataforma: 12, percentualParceiro: 8 })); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isTripartite ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >Tripartite</button>
          </div>
        </div>
      </div>

      {/* Selecionar analise */}
      {analyses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Preencher a partir de uma Analise (opcional)</h3>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={selectedAnalysis?.id || ''}
            onChange={e => handleSelectAnalysis(e.target.value)}
          >
            <option value="">-- Selecionar analise para preencher dados --</option>
            {analyses.map(a => (
              <option key={a.id} value={a.id}>
                {a.companyName} — {a.cnpj || 'S/CNPJ'} — {formatCurrency(a.estimatedCredit || 0)} — [{a.partnerName}]
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-2">
            Ao selecionar, os dados serao preenchidos automaticamente.
            {' '}<strong>Empresas de parceiro geram contrato tripartite automaticamente.</strong>
          </p>
        </div>
      )}

      {/* Percentuais */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Distribuicao de Percentuais</h3>
        <div className={`grid ${isTripartite ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">% Cliente</label>
            <input type="number" min={50} max={90} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-green-700" value={fields.percentualCliente} onChange={e => {
              const v = Number(e.target.value);
              const rest = 100 - v;
              if (isTripartite) {
                f('percentualCliente', v);
                f('percentualPlataforma', rest - fields.percentualParceiro);
              } else {
                f('percentualCliente', v);
                f('percentualPlataforma', rest);
              }
            }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">% TaxCredit</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-indigo-700 bg-gray-50" value={fields.percentualPlataforma} readOnly />
          </div>
          {isTripartite && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">% Parceiro</label>
              <input type="number" min={0} max={20} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700" value={fields.percentualParceiro} onChange={e => {
                const v = Number(e.target.value);
                f('percentualParceiro', v);
                f('percentualPlataforma', 100 - fields.percentualCliente - v);
              }} />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className={`text-xs font-bold px-2 py-1 rounded ${(fields.percentualCliente + fields.percentualPlataforma + fields.percentualParceiro) === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Total: {fields.percentualCliente + fields.percentualPlataforma + fields.percentualParceiro}%
          </div>
          <span className="text-xs text-gray-400">Deve ser sempre 100%</span>
        </div>
      </div>

      {/* Dados do Cliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Dados do Cliente (Contratante)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Razao Social *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.empresaNome} onChange={e => f('empresaNome', e.target.value)} placeholder="Ex: SERTECPET DO BRASIL LTDA" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">CNPJ</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.cnpj} onChange={e => f('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">IE</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.ieCliente} onChange={e => f('ieCliente', e.target.value)} placeholder="Inscricao Estadual" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Endereco</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.endereco} onChange={e => f('endereco', e.target.value)} placeholder="Rua X, 123" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cidade</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.cidade} onChange={e => f('cidade', e.target.value)} placeholder="Rio de Janeiro" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">UF</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.uf} onChange={e => f('uf', e.target.value)} placeholder="RJ" maxLength={2} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">CEP</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.cep} onChange={e => f('cep', e.target.value)} placeholder="00000-000" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Representante Legal</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.representanteNome} onChange={e => f('representanteNome', e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cargo</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.representanteCargo} onChange={e => f('representanteCargo', e.target.value)} placeholder="Socio-Administrador" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">CPF Representante</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.representanteCpf} onChange={e => f('representanteCpf', e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Valor Estimado dos Creditos</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.valorEstimado} onChange={e => f('valorEstimado', Number(e.target.value))} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Dados do Parceiro (tripartite) */}
      {isTripartite && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-5">
          <h3 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Dados do Parceiro
            {selectedAnalysis?.partnerName && selectedAnalysis.partnerName !== 'Admin direto' && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">
                Preenchido: {selectedAnalysis.partnerName}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Razao Social / Nome do Parceiro</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroNome} onChange={e => pf('parceiroNome', e.target.value)} placeholder="Escritorio XYZ Advogados" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CNPJ/CPF</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroCnpjCpf} onChange={e => pf('parceiroCnpjCpf', e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">OAB (se advogado)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroOab} onChange={e => pf('parceiroOab', e.target.value)} placeholder="123.456/RJ" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Endereco</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroEndereco} onChange={e => pf('parceiroEndereco', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cidade</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroCidade} onChange={e => pf('parceiroCidade', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">UF</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroUf} onChange={e => pf('parceiroUf', e.target.value)} maxLength={2} />
            </div>
          </div>
          <h4 className="font-medium text-gray-700 mt-5 mb-3 text-sm">Dados Bancarios do Parceiro (para split escrow)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Banco</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroBanco} onChange={e => pf('parceiroBanco', e.target.value)} placeholder="Banco do Brasil" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Agencia</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroAgencia} onChange={e => pf('parceiroAgencia', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Conta</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroConta} onChange={e => pf('parceiroConta', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Titular</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroTitular} onChange={e => pf('parceiroTitular', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CPF/CNPJ Titular</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={partnerFields.parceiroDocBanco} onChange={e => pf('parceiroDocBanco', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Dados Contrato (advogado + escrow) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Dados do Contrato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Taxa de Adesao (R$)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.taxaAdesao} onChange={e => f('taxaAdesao', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Advogado Vinculado</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.advogadoNome} onChange={e => f('advogadoNome', e.target.value)} placeholder="Nome do advogado" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">OAB</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.advogadoOab} onChange={e => f('advogadoOab', e.target.value)} placeholder="123.456/RJ" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Escrow - Agencia (Banco Fibra)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.escrowAgencia} onChange={e => f('escrowAgencia', e.target.value)} placeholder="0001" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Escrow - Conta (Banco Fibra)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={fields.escrowConta} onChange={e => f('escrowConta', e.target.value)} placeholder="123456-7" />
          </div>
        </div>
      </div>

      {/* Botao gerar */}
      <button
        onClick={handleGenerate}
        disabled={generating || !fields.empresaNome || (fields.percentualCliente + fields.percentualPlataforma + fields.percentualParceiro) !== 100}
        className={`w-full py-3.5 font-bold rounded-xl transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 ${isTripartite ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'}`}
      >
        {generating ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Gerando...
          </>
        ) : isTripartite ? 'Gerar Contrato Tripartite' : 'Gerar Contrato Bipartite'}
      </button>

      {/* Contrato gerado */}
      {generatedContract && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">
              {isTripartite ? 'Contrato Tripartite' : 'Contrato Bipartite'} Gerado
            </h3>
            <div className="flex gap-2">
              <button onClick={handlePrintContract} className={`px-4 py-2 text-white text-sm font-medium rounded-lg ${isTripartite ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                Imprimir / PDF
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(generatedContract); alert('Copiado!'); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="p-6 max-h-[600px] overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">{generatedContract}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
