'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { authedFetcher } from '@/lib/fetcher';

interface AnalysisItem {
  id: string;
  companyName?: string;
  cnpj?: string;
  regime?: string;
  sector?: string;
  annualRevenue?: number;
  viabilityScore?: number | null;
  scoreLabel?: string;
  estimatedCredit?: number | null;
  aiSummary?: string;
  oportunidades?: unknown[];
  alertas?: string[];
  hasFullAnalysis?: boolean;
  hasExtrato?: boolean;
  partnerName?: string;
  source?: string;
  createdAt?: string;
}

interface AnalysisDetail {
  id?: string;
  companyName?: string;
  cnpj?: string;
  regime?: string;
  demonstrativo?: {
    totalReal?: number;
    totalHipotese?: number;
    totalGeral?: number;
    empresa?: { nome: string; cnpj: string } | null;
    periodoAnalisado?: string;
    resumoReal?: string;
    resumoHipotese?: string;
    extratoBancarioHtml?: string;
    extratoHtml?: string;
    extratoOperacaoHtml?: string;
    extratoCruzadoHtml?: string;
    itens?: Array<{
      tributo: string;
      ponto: string;
      periodo: string;
      baseCalculo: number;
      vlrPis: number;
      vlrCofins: number;
      total: number;
      tipo: 'real' | 'hipotese';
    }>;
  };
  periodoAnalisado?: string;
  regimeTributario?: string;
  partnerName?: string;
  createdAt?: string;
}

export default function AdminExtratosPage() {
  const { data: analyses = [], isLoading: loading } = useSWR<AnalysisItem[]>(
    '/api/viability/admin-analyses',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  );
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'sped'>('all');
  const [extratoTab, setExtratoTab] = useState<'fiscal' | 'cruzado'>('fiscal');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const fiscalHtml = detail?.demonstrativo?.extratoBancarioHtml || detail?.demonstrativo?.extratoHtml;
    const cruzadoHtml = detail?.demonstrativo?.extratoCruzadoHtml;
    const html = extratoTab === 'cruzado' && cruzadoHtml ? cruzadoHtml : fiscalHtml;
    if (!html) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/viability/admin-analysis/${id}`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDetail(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setDetailLoading(false);
    }
  };

  const fmt = (v?: number | null) => {
    if (v == null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    const resizeObserver = new ResizeObserver(() => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          iframe.style.height = `${doc.body.scrollHeight + 40}px`;
        }
      } catch {}
    });
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          iframe.style.height = `${doc.body.scrollHeight + 40}px`;
          resizeObserver.observe(doc.body);
        }
      } catch {}
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      resizeObserver.disconnect();
    };
  }, [detail, extratoTab]);

  const completedAnalyses = analyses.filter(a => a.hasFullAnalysis);
  const filtered = completedAnalyses.filter(a => {
    const matchSearch =
      !search ||
      (a.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.cnpj || '').includes(search);
    const matchFilter = filterMode === 'all' || a.hasExtrato;
    return matchSearch && matchFilter;
  });

  const totalComExtrato = completedAnalyses.filter(a => a.hasExtrato).length;
  const totalSemExtrato = completedAnalyses.length - totalComExtrato;

  const extratoFiscalHtml = detail?.demonstrativo?.extratoBancarioHtml || detail?.demonstrativo?.extratoHtml;
  const extratoCruzadoHtml = detail?.demonstrativo?.extratoCruzadoHtml;
  const activeExtratoHtml = extratoTab === 'cruzado' && extratoCruzadoHtml ? extratoCruzadoHtml : extratoFiscalHtml;
  const hasRealData = (detail?.demonstrativo?.totalReal ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Extratos de Créditos Tributários</h1>
        <p className="text-gray-500 mt-1">
          Créditos reais identificados nos arquivos SPED — valores exatos para formalização junto à Receita/SEFAZ
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total de análises</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{completedAnalyses.length}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 uppercase tracking-wide">Com dados SPED</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalComExtrato}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 uppercase tracking-wide">Sem SPED (somente IA)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalSemExtrato}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="text"
          placeholder="Buscar empresa ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-green-500 outline-none"
        />
        <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${filterMode === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Todas ({completedAnalyses.length})
          </button>
          <button
            onClick={() => setFilterMode('sped')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${filterMode === 'sped' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Com SPED ({totalComExtrato})
          </button>
        </div>
      </div>

      {/* Detail View */}
      {detail && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setDetail(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar para lista
            </button>
            {activeExtratoHtml && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir / Salvar PDF
              </button>
            )}
          </div>

          {/* Status Banner */}
          {hasRealData ? (
            <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-green-800 font-semibold text-sm">Dados reais SPED — Extrato para formalização</p>
                <p className="text-green-700 text-xs mt-1">
                  Valores extraídos das escriturações digitais (EFD ICMS/IPI, EFD Contribuições, ECF, ECD conforme disponibilidade).
                  Este extrato pode ser apresentado à Receita Federal / SEFAZ.
                </p>
                <div className="mt-2 flex items-center gap-6 text-sm">
                  <span className="font-bold text-green-800">Total Real: {fmt(detail.demonstrativo?.totalReal)}</span>
                  {(detail.demonstrativo?.totalHipotese ?? 0) > 0 && (
                    <span className="text-amber-700">Hipóteses adicionais: {fmt(detail.demonstrativo?.totalHipotese)}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-amber-800 font-semibold text-sm">Sem dados SPED processados</p>
                <p className="text-amber-700 text-xs mt-1">
                  Esta análise não possui arquivos SPED processados. Para gerar o extrato com valores reais,
                  execute novamente a análise enviando um ZIP com os arquivos SPED (EFD ICMS/IPI, EFD Contribuições, ECF, ECD).
                </p>
              </div>
            </div>
          )}

          {/* Tab Switcher */}
          {(extratoFiscalHtml || extratoCruzadoHtml) && (
            <div className="flex bg-white border border-gray-300 rounded-xl overflow-hidden mb-4">
              <button
                onClick={() => setExtratoTab('fiscal')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  extratoTab === 'fiscal' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Extrato Fiscal (SPED EFD)
              </button>
              <button
                onClick={() => setExtratoTab('cruzado')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  extratoTab === 'cruzado'
                    ? 'bg-purple-700 text-white'
                    : extratoCruzadoHtml
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-300 cursor-not-allowed'
                }`}
                disabled={!extratoCruzadoHtml}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Extrato Cruzado Contábil (ECD)
                {!extratoCruzadoHtml && <span className="text-[10px] opacity-60 ml-1">(sem ECD)</span>}
              </button>
            </div>
          )}

          {/* Extrato Render */}
          <div className={`bg-white border-2 rounded-xl shadow-lg overflow-hidden ${extratoTab === 'cruzado' ? 'border-purple-200' : 'border-green-200'}`}>
            {activeExtratoHtml ? (
              <div className="p-1">
                <iframe
                  ref={iframeRef}
                  srcDoc={activeExtratoHtml}
                  title="Extrato de Créditos Tributários"
                  className="w-full border-0"
                  style={{ minHeight: 600 }}
                />
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Extrato não disponível</h3>
                <p className="text-gray-600 text-sm max-w-md mx-auto">
                  Para gerar o extrato com valores reais, execute a análise com arquivos SPED EFD Fiscal (ZIP ou TXT).
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {!detail && (
        <>
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Carregando análises...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma análise encontrada</h3>
              <p className="text-gray-600 text-sm max-w-md mx-auto">
                Execute análises com arquivos SPED EFD Fiscal para gerar extratos com valores reais.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <a href="/admin/producao/hpc" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                  HPC Motor
                </a>
                <a href="/admin/producao/analises" className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors">
                  Análises
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => (
                <div
                  key={a.id}
                  onClick={() => fetchDetail(a.id)}
                  className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group ${
                    a.hasExtrato ? 'border-green-200 hover:border-green-400' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-gray-900 font-semibold text-base truncate group-hover:text-green-700 transition-colors">
                          {a.companyName || 'Empresa'}
                        </h3>
                        {a.hasExtrato ? (
                          <span className="shrink-0 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Dados reais SPED
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full">
                            Somente IA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {a.cnpj && <span>{a.cnpj}</span>}
                        {a.partnerName && <span>Parceiro: {a.partnerName}</span>}
                        {a.source && <span className="capitalize">{a.source}</span>}
                        {a.createdAt && <span>{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right min-w-[130px]">
                        {a.estimatedCredit ? (
                          <p className={`font-bold text-base ${a.hasExtrato ? 'text-green-700' : 'text-gray-600'}`}>
                            {fmt(a.estimatedCredit)}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-xs">—</p>
                        )}
                        {a.hasExtrato && (
                          <p className="text-green-600 text-[10px] mt-0.5">Valor comprovado</p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full"></div>
            <span className="text-gray-700 text-sm">Carregando extrato...</span>
          </div>
        </div>
      )}
    </div>
  );
}
