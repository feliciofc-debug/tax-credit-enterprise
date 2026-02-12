'use client';

import { useState, useEffect, useRef } from 'react';
import { CHECKLISTS, UF_OPTIONS, TIPO_LABELS, TIPO_COLORS, type ChecklistEstado, type ChecklistEtapa } from '@/data/checklists';

interface AnalysisForFormalization {
  id: string;
  companyName: string;
  cnpj: string;
  estimatedCredit: number;
  viabilityScore: number;
  scoreLabel: string;
  partnerName: string;
  createdAt: string;
  opportunities: any[];
  contractId?: string;
  formalizacaoLiberada?: boolean;
}

type Tab = 'checklist' | 'sefaz' | 'perdcomp' | 'contrato';

export default function FormalizacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('checklist');
  const [selectedUf, setSelectedUf] = useState('SP');
  const [analyses, setAnalyses] = useState<AnalysisForFormalization[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisForFormalization | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/viability/admin-analyses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAnalyses(data.data || []);
      }
    } catch (e) {
      console.error('Erro ao buscar analises:', e);
    } finally {
      setLoading(false);
    }
  };

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
      const res = await fetch('/api/formalization/generate-sefaz', {
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
    if (!selectedAnalysis) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/formalization/generate-perdcomp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          analysisId: selectedAnalysis.id,
          ...perdcompFields,
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
    { id: 'contrato', label: 'Contrato Bipartite', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
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

      {/* CONTRATO BIPARTITE TAB */}
      {activeTab === 'contrato' && (
        <BipartiteContractTab analyses={analyses} loading={loading} formatCurrency={formatCurrency} formatDate={formatDate} />
      )}
    </div>
  );
}

// ==================================================================
// SUB-COMPONENT: Contrato Bipartite
// ==================================================================
function BipartiteContractTab({
  analyses, loading, formatCurrency, formatDate
}: {
  analyses: AnalysisForFormalization[];
  loading: boolean;
  formatCurrency: (v: number) => string;
  formatDate: (d: string) => string;
}) {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const [contractFields, setContractFields] = useState({
    percentualPlataforma: 60,
    clientId: '',
  });

  // Clients list
  const [clients, setClients] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setClients(d.data || []); })
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!contractFields.clientId) { alert('Selecione um cliente'); return; }
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/formalization/generate-bipartite-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: contractFields.clientId,
          percentualPlataforma: contractFields.percentualPlataforma,
          analysisId: selectedAnalysisId || undefined,
        }),
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
    w.document.write(`
      <html><head><title>Contrato Bipartite - TaxCredit Enterprise</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.7; margin: 40px; color: #111; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        @media print { body { margin: 20mm; } }
      </style></head><body><pre>${generatedContract}</pre></body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
          Contrato Bipartite (Venda Direta)
        </h3>
        <p className="text-purple-700 text-sm mt-1">
          Contrato entre a plataforma (ATOM BRASIL DIGITAL) e o cliente, sem parceiro intermediario.
          100% da taxa e do percentual sobre creditos recuperados fica com a plataforma.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Configurar Contrato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Cliente</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={contractFields.clientId}
              onChange={e => setContractFields(p => ({ ...p, clientId: e.target.value }))}
            >
              <option value="">-- Selecione o cliente --</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name || c.email} {c.cnpj ? `(${c.cnpj})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">% Plataforma sobre Creditos Recuperados</label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={contractFields.percentualPlataforma}
              onChange={e => setContractFields(p => ({ ...p, percentualPlataforma: Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-400 mt-1">Padrao: 60% (sem parceiro, 100% plataforma)</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Analise Vinculada (Opcional)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={selectedAnalysisId}
              onChange={e => setSelectedAnalysisId(e.target.value)}
            >
              <option value="">-- Nenhuma --</option>
              {analyses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.companyName} — {formatCurrency(a.estimatedCredit || 0)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !contractFields.clientId}
          className="mt-5 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Gerando...
            </>
          ) : 'Gerar Contrato Bipartite'}
        </button>
      </div>

      {generatedContract && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">Contrato Gerado</h3>
            <div className="flex gap-2">
              <button onClick={handlePrintContract} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700">
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
