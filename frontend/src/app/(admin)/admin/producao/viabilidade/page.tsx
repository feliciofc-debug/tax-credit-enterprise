'use client';

import { useState, useEffect } from 'react';

interface Oportunidade {
  tipo: string;
  tributo: string;
  descricao: string;
  valorEstimado: number;
  fundamentacaoLegal: string;
  prazoRecuperacao: string;
  complexidade: string;
  probabilidadeRecuperacao: number;
  risco: string;
  documentacaoNecessaria: string[];
  passosPraticos: string[];
}

interface FullAnalysisResult {
  id: string;
  companyName: string;
  cnpj?: string;
  score: number;
  scoreLabel: string;
  estimatedCredit: number;
  resumoExecutivo: string;
  fundamentacaoGeral: string;
  periodoAnalisado: string;
  regimeTributario: string;
  riscoGeral: string;
  recomendacoes: string[];
  alertas: string[];
  oportunidades: Oportunidade[];
}

interface ViabilityResult {
  id: string;
  companyName: string;
  score: number;
  scoreLabel: string;
  estimatedCredit?: number | null;
  opportunities?: any[];
  summary: string;
  risks?: string[];
  viable?: boolean;
  nextSteps?: string;
  aiPowered?: boolean;
}

interface ViabilityListItem {
  id: string;
  companyName: string;
  cnpj: string;
  viabilityScore: number;
  scoreLabel: string;
  estimatedCredit: number | null;
  status: string;
  createdAt: string;
}

export default function AdminViabilidadePage() {
  const [loading, setLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ViabilityResult | null>(null);
  const [fullResult, setFullResult] = useState<FullAnalysisResult | null>(null);
  const [history, setHistory] = useState<ViabilityListItem[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    cnpj: '',
    regime: '',
    sector: '',
    annualRevenue: '',
    documentType: 'dre',
  });
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/viability/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      setError('Nome da empresa e obrigatorio');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setFullResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('companyName', form.companyName);
      formData.append('documentType', form.documentType);
      if (form.cnpj) formData.append('cnpj', form.cnpj);
      if (form.regime) formData.append('regime', form.regime);
      if (form.sector) formData.append('sector', form.sector);
      if (form.annualRevenue) formData.append('annualRevenue', form.annualRevenue);
      files.forEach(f => formData.append('documents', f));

      const res = await fetch('/api/viability/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        fetchHistory();
      } else {
        setError(data.error || 'Erro na analise');
      }
    } catch {
      setError('Erro de conexao');
    } finally {
      setLoading(false);
    }
  };

  // ANÁLISE COMPLETA COM OPUS 4.6 — ASSÍNCRONA COM POLLING
  const handleFullAnalysis = async (viabilityId: string) => {
    setFullLoading(viabilityId);
    setError('');
    setFullResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('documentType', form.documentType || 'dre');

      // 1. Iniciar análise em background (retorna imediatamente)
      const startRes = await fetch(`/api/viability/${viabilityId}/admin-full-analysis`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const startData = await startRes.json();
      if (!startData.success) {
        setError(startData.error || 'Erro ao iniciar analise completa');
        setFullLoading(null);
        return;
      }

      // 2. Polling: verificar status a cada 5 segundos
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/viability/${viabilityId}/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pollData = await pollRes.json();

          if (pollData.status === 'completed' && pollData.success) {
            clearInterval(pollInterval);
            setFullResult(pollData.data);
            setFullLoading(null);
            fetchHistory();
          } else if (pollData.status === 'failed') {
            clearInterval(pollInterval);
            setError(pollData.error || 'Analise falhou. Tente novamente.');
            setFullLoading(null);
          }
          // Se 'analyzing', continua polling...
        } catch {
          // Erro de rede no polling — não parar, tentar de novo
        }
      }, 5000);

      // Timeout máximo de 5 minutos para o polling
      setTimeout(() => {
        clearInterval(pollInterval);
        if (fullLoading) {
          setError('Analise demorou mais que o esperado. Verifique no historico em breve.');
          setFullLoading(null);
        }
      }, 300000);

    } catch {
      setError('Erro de conexao ao iniciar analise.');
      setFullLoading(null);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const scoreColor = (label: string) => {
    switch (label) {
      case 'excelente': return 'text-green-700 bg-green-100';
      case 'bom': return 'text-blue-700 bg-blue-100';
      case 'medio': return 'text-yellow-700 bg-yellow-100';
      case 'baixo': return 'text-orange-700 bg-orange-100';
      default: return 'text-red-700 bg-red-100';
    }
  };

  const complexColor = (c: string) => {
    if (c === 'baixa') return 'bg-green-100 text-green-700';
    if (c === 'media') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analise de Viabilidade</h1>
        <p className="text-gray-500 mt-1">Analise o potencial de recuperacao de creditos com IA</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-2">Nova Analise</h3>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Empresa *</label>
              <input
                value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">CNPJ</label>
              <input
                value={form.cnpj}
                onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Regime Tributario</label>
              <select
                value={form.regime}
                onChange={e => setForm(p => ({ ...p, regime: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="lucro_real">Lucro Real</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="simples">Simples Nacional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Tipo de Documento Principal</label>
              <select
                value={form.documentType}
                onChange={e => setForm(p => ({ ...p, documentType: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="dre">DRE - Demonstracao do Resultado</option>
                <option value="balanco">Balanco Patrimonial</option>
                <option value="balancete">Balancete de Verificacao</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Setor</label>
              <input
                value={form.sector}
                onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ex: Comercio, Industria..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Faturamento Anual (R$)</label>
              <input
                type="number"
                value={form.annualRevenue}
                onChange={e => setForm(p => ({ ...p, annualRevenue: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="5000000"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Documentos (PDF, ZIP, SPED, Excel)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.txt,.zip"
                onChange={e => setFiles(Array.from(e.target.files || []))}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              {files.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{files.length} arquivo(s) selecionado(s)</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!fullLoading}
              className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Analisando com IA...' : 'Quick Score (Sonnet)'}
            </button>
          </form>
        </div>

        {/* Result + Full Analysis + History */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Score Result */}
          {result && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-900 font-semibold text-lg">Quick Score: {result.companyName}</h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Sonnet 4.5</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${scoreColor(result.scoreLabel)} inline-block px-4 py-2 rounded-xl`}>
                    {result.score}
                  </div>
                  <p className="text-gray-500 text-xs mt-1 capitalize">{result.scoreLabel}</p>
                </div>
                <div className="text-center flex items-center justify-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${result.viable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {result.viable ? 'Viavel' : 'Baixa viabilidade'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-gray-700 text-sm">{result.summary}</p>
              </div>

              {result.nextSteps && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 text-sm font-semibold mb-1">Proximos Passos:</p>
                  <p className="text-blue-700 text-sm">{result.nextSteps}</p>
                </div>
              )}

              {/* Botão ANÁLISE COMPLETA */}
              <button
                onClick={() => handleFullAnalysis(result.id)}
                disabled={!!fullLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {fullLoading === result.id ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Opus 4.6 analisando em background...
                    </div>
                    <span className="text-xs text-indigo-200">Aguarde 1-3 min. Resultado aparece automaticamente.</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    Analise Completa (Opus 4.6) — Extrato Detalhado
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* EXTRATO DETALHADO — Resultado da Análise Completa (Opus 4.6) */}
          {/* ============================================================ */}
          {fullResult && (
            <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">EXTRATO DE CREDITOS TRIBUTARIOS</h2>
                    <p className="text-indigo-200 text-sm mt-1">{fullResult.companyName} {fullResult.cnpj ? `| ${fullResult.cnpj}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold">{fmt(fullResult.estimatedCredit)}</p>
                    <p className="text-indigo-200 text-xs">Total Estimado de Recuperacao</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-indigo-200">
                  <span>Periodo: {fullResult.periodoAnalisado}</span>
                  <span>|</span>
                  <span>Regime: {fullResult.regimeTributario}</span>
                  <span>|</span>
                  <span>Risco Geral: <span className="font-bold text-white capitalize">{fullResult.riscoGeral}</span></span>
                  <span>|</span>
                  <span>Score: <span className="font-bold text-white">{fullResult.score}</span></span>
                </div>
              </div>

              {/* Resumo Executivo */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-1">Resumo Executivo</p>
                <p className="text-sm text-gray-600 leading-relaxed">{fullResult.resumoExecutivo}</p>
              </div>

              {/* Tabela de Oportunidades — EXTRATO */}
              <div className="px-6 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  EXTRATO DE OPORTUNIDADES ({fullResult.oportunidades.length})
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                        <th className="px-4 py-3 text-left font-semibold">#</th>
                        <th className="px-4 py-3 text-left font-semibold">Oportunidade</th>
                        <th className="px-4 py-3 text-left font-semibold">Tributo</th>
                        <th className="px-4 py-3 text-right font-semibold">Valor Estimado</th>
                        <th className="px-4 py-3 text-center font-semibold">Prob.</th>
                        <th className="px-4 py-3 text-center font-semibold">Complex.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fullResult.oportunidades.map((op, i) => (
                        <tr key={i} className="hover:bg-indigo-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{op.tipo}</p>
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{op.descricao}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">{op.tributo}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                            {fmt(op.valorEstimado)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${op.probabilidadeRecuperacao >= 80 ? 'bg-green-100 text-green-700' : op.probabilidadeRecuperacao >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {op.probabilidadeRecuperacao}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${complexColor(op.complexidade)}`}>
                              {op.complexidade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50 font-bold">
                        <td className="px-4 py-3" colSpan={3}>
                          <span className="text-indigo-900">TOTAL ESTIMADO DE RECUPERACAO</span>
                        </td>
                        <td className="px-4 py-3 text-right text-green-800 text-lg whitespace-nowrap">
                          {fmt(fullResult.estimatedCredit)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Detalhes expandidos de cada oportunidade */}
              <div className="px-6 py-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-900 mb-3">DETALHAMENTO POR OPORTUNIDADE</p>
                <div className="space-y-3">
                  {fullResult.oportunidades.map((op, i) => (
                    <details key={i} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <summary className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                          <span className="font-medium text-gray-900 text-sm">{op.tipo}</span>
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">{op.tributo}</span>
                        </div>
                        <span className="font-bold text-green-700 text-sm">{fmt(op.valorEstimado)}</span>
                      </summary>
                      <div className="px-4 py-4 bg-white border-t border-gray-200 space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-gray-700">Descricao</p>
                          <p className="text-gray-600">{op.descricao}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold text-gray-700">Fundamentacao Legal</p>
                            <p className="text-gray-600">{op.fundamentacaoLegal}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700">Prazo de Recuperacao</p>
                            <p className="text-gray-600">{op.prazoRecuperacao}</p>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Risco</p>
                          <p className="text-yellow-700">{op.risco}</p>
                        </div>
                        {op.documentacaoNecessaria.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">Documentacao Necessaria</p>
                            <ul className="list-disc list-inside text-gray-600">
                              {op.documentacaoNecessaria.map((d: string, j: number) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {op.passosPraticos.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">Passos Praticos</p>
                            <ol className="list-decimal list-inside text-gray-600">
                              {op.passosPraticos.map((p: string, j: number) => (
                                <li key={j}>{p}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              {/* Recomendações e Alertas */}
              <div className="px-6 py-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fullResult.recomendacoes.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-800 text-sm mb-2">Recomendacoes</p>
                    <ul className="space-y-1">
                      {fullResult.recomendacoes.map((r, i) => (
                        <li key={i} className="text-green-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">+</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {fullResult.alertas.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-semibold text-yellow-800 text-sm mb-2">Alertas</p>
                    <ul className="space-y-1">
                      {fullResult.alertas.map((a, i) => (
                        <li key={i} className="text-yellow-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">!</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Fundamentação Geral */}
              {fullResult.fundamentacaoGeral && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="font-semibold text-gray-700 text-sm mb-1">Fundamentacao Geral</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{fullResult.fundamentacaoGeral}</p>
                </div>
              )}

              {/* Rodapé */}
              <div className="px-6 py-3 bg-gray-100 text-xs text-gray-400 flex justify-between">
                <span>Analise realizada por Claude Opus 4.6 | TaxCredit Enterprise</span>
                <span>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>
          )}

          {/* History */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-4">Historico de Analises</h3>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma analise realizada ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-gray-900 text-sm font-medium">{h.companyName}</p>
                      <p className="text-gray-500 text-xs">{h.cnpj || 'Sem CNPJ'} - {new Date(h.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-sm font-bold ${scoreColor(h.scoreLabel)} px-2 py-1 rounded`}>
                          {h.viabilityScore}
                        </span>
                        <p className="text-green-700 text-xs mt-1">{h.estimatedCredit ? fmt(h.estimatedCredit) : 'Pre-triagem'}</p>
                      </div>
                      {!h.estimatedCredit && h.status === 'completed' && (
                        <button
                          onClick={() => handleFullAnalysis(h.id)}
                          disabled={!!fullLoading}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                          {fullLoading === h.id ? 'Analisando...' : 'Opus 4.6'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
