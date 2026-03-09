'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { authedFetcher } from '@/lib/fetcher';

/* ============================================================
   INTERFACES
   ============================================================ */

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
    extratoBancarioHtml?: string;
    extratoHtml?: string;
  };
  periodoAnalisado?: string;
  regimeTributario?: string;
  partnerName?: string;
  createdAt?: string;
}

/* ============================================================
   PÁGINA EXTRATOS — Probabilidade real dos créditos (SPED)
   ============================================================ */

export default function AdminExtratosPage() {
  const { data: analyses = [], isLoading: loading } = useSWR<AnalysisItem[]>(
    '/api/viability/admin-analyses',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  );
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

  const handleSalvarExtrato = () => {
    const html = detail?.demonstrativo?.extratoBancarioHtml || detail?.demonstrativo?.extratoHtml;
    if (!html) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
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

  // Apenas análises com extrato disponível
  const comExtrato = analyses.filter(a => a.hasExtrato);
  const filtered = comExtrato.filter(a => {
    const matchSearch =
      !search ||
      (a.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.cnpj || '').includes(search);
    return matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extratos Bancários</h1>
          <p className="text-gray-500 mt-1">
            Probabilidade real dos créditos — fundamentado em dados do SPED original do período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} extrato(s) disponível(is)</span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar empresa ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-green-500 outline-none"
        />
      </div>

      {/* Detail View (extrato selecionado) */}
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
            <button
              onClick={handleSalvarExtrato}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Salvar Extrato (PDF)
            </button>
          </div>

          {/* Extrato Bancário */}
          <div className="bg-white border-2 border-green-200 rounded-xl shadow-lg overflow-hidden">
            {(detail.demonstrativo?.extratoBancarioHtml || detail.demonstrativo?.extratoHtml) ? (
              <>
                <div className="bg-green-700 px-6 py-4 text-white flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">EXTRATO BANCÁRIO DISCRIMINADO</h2>
                    <p className="text-green-100 text-sm mt-0.5">
                      {detail.companyName || ''} {detail.cnpj ? `| ${detail.cnpj}` : ''}
                    </p>
                    <p className="text-green-200 text-xs mt-1">
                      Formato aceito pela fazenda (RFB/SEFAZ) — valores confirmados no SPED
                    </p>
                  </div>
                  <div className="text-right">
                    {(detail.demonstrativo.totalReal ?? 0) > 0 && (
                      <>
                        <p className="text-2xl font-extrabold">{fmt(detail.demonstrativo.totalReal)}</p>
                        <p className="text-green-200 text-xs">Valor REAL (comprovado no SPED)</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 border-t border-green-100">
                  <iframe
                    srcDoc={detail.demonstrativo.extratoBancarioHtml || detail.demonstrativo.extratoHtml}
                    title="Extrato Bancário"
                    className="w-full border border-gray-200 rounded-lg"
                    style={{ minHeight: 500 }}
                  />
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Extrato não disponível para esta análise.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Extratos */}
      {!detail && (
        <>
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Carregando extratos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum extrato disponível</h3>
              <p className="text-gray-600 text-sm max-w-md mx-auto">
                Os extratos são gerados quando a análise inclui arquivos SPED processados. Execute a análise na página <strong>HPC Motor</strong> enviando um ZIP com SPEDs EFD Fiscal para obter o extrato no formato aceito pela fazenda.
              </p>
              <a
                href="/admin/producao/hpc"
                className="inline-block mt-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Ir para HPC Motor
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => (
                <div
                  key={a.id}
                  onClick={() => fetchDetail(a.id)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-gray-900 font-semibold text-base truncate group-hover:text-green-700 transition-colors">
                          {a.companyName || 'Empresa'}
                        </h3>
                        <span className="shrink-0 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">
                          Extrato SPED
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {a.cnpj && <span>{a.cnpj}</span>}
                        {a.partnerName && <span>Parceiro: {a.partnerName}</span>}
                        {a.createdAt && <span>{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right min-w-[120px]">
                        {a.estimatedCredit ? (
                          <p className="text-green-700 font-bold text-base">{fmt(a.estimatedCredit)}</p>
                        ) : (
                          <p className="text-gray-400 text-xs">—</p>
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

      {/* Loading detail overlay */}
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
