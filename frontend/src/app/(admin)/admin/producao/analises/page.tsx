'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { authedFetcher } from '@/lib/fetcher';

/* ============================================================
   INTERFACES
   ============================================================ */

interface Oportunidade {
  tipo?: string;
  tributo?: string;
  descricao?: string;
  valorEstimado?: number;
  fundamentacaoLegal?: string;
  prazoRecuperacao?: string;
  complexidade?: string;
  probabilidadeRecuperacao?: number;
  risco?: string;
  documentacaoNecessaria?: string[];
  passosPraticos?: string[];
}

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
  oportunidades?: Oportunidade[];
  alertas?: string[];
  hasFullAnalysis?: boolean;
  partnerName?: string;
  source?: string;
  createdAt?: string;
}

interface AnalysisDetail {
  id?: string;
  companyName?: string;
  cnpj?: string;
  regime?: string;
  sector?: string;
  annualRevenue?: number;
  viabilityScore?: number | null;
  scoreLabel?: string;
  estimatedCredit?: number | null;
  resumoExecutivo?: string;
  fundamentacaoGeral?: string;
  periodoAnalisado?: string;
  regimeTributario?: string;
  riscoGeral?: string;
  recomendacoes?: string[];
  alertas?: string[];
  oportunidades?: Oportunidade[];
  hasFullAnalysis?: boolean;
  partnerName?: string;
  source?: string;
  createdAt?: string;
  demonstrativo?: {
    totalReal?: number;
    totalHipotese?: number;
    extratoBancarioHtml?: string;
    extratoHtml?: string;
  };
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function AdminAnalisesPage() {
  const { data: analyses = [], isLoading: loading } = useSWR<AnalysisItem[]>(
    '/api/viability/admin-analyses',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  );
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'full' | 'quick'>('all');
  const [search, setSearch] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

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

  /* ============================================================
     PRINT / PDF — Abre janela de impressao do navegador
     O usuario pode escolher "Salvar como PDF" ou imprimir
     ============================================================ */
  const handlePrint = () => {
    if (!printRef.current || !detail) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Extrato - ${detail.companyName || 'Analise'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1a1a1a;
            padding: 24px 28px;
            font-size: 12px;
            line-height: 1.6;
          }
          .header {
            background: linear-gradient(135deg, #4338ca, #7c3aed);
            color: white;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 20px;
          }
          .header h1 { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
          .header .company { font-size: 14px; opacity: 0.85; }
          .header .total { font-size: 26px; font-weight: 800; text-align: right; }
          .header .total-label { font-size: 11px; opacity: 0.7; text-align: right; }
          .header-row { display: flex; justify-content: space-between; align-items: center; }
          .header-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 10px; opacity: 0.7; }
          .section { margin-bottom: 20px; }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #312e81;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 2px solid #e0e7ff;
          }
          .summary-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 18px;
            font-size: 12px;
            line-height: 1.7;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th {
            background: #f1f5f9;
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
            vertical-align: top;
            line-height: 1.6;
          }
          tr:hover { background: #f8fafc; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-green { color: #15803d; font-weight: 700; }
          .text-indigo { color: #4338ca; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
          }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-yellow { background: #fef9c3; color: #854d0e; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-indigo { background: #e0e7ff; color: #3730a3; }
          .total-row {
            background: #eef2ff;
            font-weight: 700;
          }
          .total-row td { border-top: 2px solid #c7d2fe; padding: 10px; }
          .detail-block {
            background: #fafafa;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px 18px;
            margin-bottom: 14px;
            page-break-inside: avoid;
          }
          .detail-block h4 { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #1e1b4b; }
          .detail-block p { font-size: 11px; color: #4b5563; margin-bottom: 6px; line-height: 1.7; }
          .detail-block .label { font-weight: 600; color: #374151; }
          .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .rec-alert-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .rec-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; }
          .alert-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; }
          .rec-box h4 { color: #166534; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
          .alert-box h4 { color: #92400e; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
          .rec-box li, .alert-box li { font-size: 11px; margin-bottom: 4px; line-height: 1.6; }
          .footer {
            margin-top: 28px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 10px; }
            .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .rec-box, .alert-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  /* ============================================================
     HELPERS
     ============================================================ */
  const fmt = (v?: number | null) => {
    if (v == null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const scoreColor = (label?: string | null) => {
    switch (label) {
      case 'excelente': return 'text-green-700 bg-green-100';
      case 'bom': return 'text-blue-700 bg-blue-100';
      case 'medio': return 'text-yellow-700 bg-yellow-100';
      case 'baixo': return 'text-orange-700 bg-orange-100';
      default: return 'text-red-700 bg-red-100';
    }
  };

  const complexColor = (c?: string) => {
    if (c === 'baixa') return 'bg-green-100 text-green-700';
    if (c === 'media') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const probBadge = (p?: number) => {
    if (!p) return 'badge-red';
    if (p >= 80) return 'badge-green';
    if (p >= 60) return 'badge-yellow';
    return 'badge-red';
  };

  const complexBadge = (c?: string) => {
    if (c === 'baixa') return 'badge-green';
    if (c === 'media') return 'badge-yellow';
    return 'badge-red';
  };

  // Filtrar analises
  const filtered = analyses.filter(a => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'full' && a.hasFullAnalysis) ||
      (filter === 'quick' && !a.hasFullAnalysis);
    const matchSearch =
      !search ||
      (a.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.cnpj || '').includes(search);
    return matchFilter && matchSearch;
  });

  const ops = detail?.oportunidades || [];
  const recs = detail?.recomendacoes || [];
  const alerts = detail?.alertas || [];

  const opsConfirmadas = ops.filter(o => (o.probabilidadeRecuperacao ?? 0) >= 80);
  const opsProvaveis   = ops.filter(o => (o.probabilidadeRecuperacao ?? 0) >= 60 && (o.probabilidadeRecuperacao ?? 0) < 80);
  const opsCondicionais = ops.filter(o => (o.probabilidadeRecuperacao ?? 0) < 60);
  const totalConfirmado  = opsConfirmadas.reduce((s, o) => s + (o.valorEstimado || 0), 0);
  const totalProvavel    = opsProvaveis.reduce((s, o) => s + (o.valorEstimado || 0), 0);
  const totalCondicional = opsCondicionais.reduce((s, o) => s + (o.valorEstimado || 0), 0);

  const opsSorted = [...opsConfirmadas, ...opsProvaveis, ...opsCondicionais];
  const getStatusLabel = (prob: number) => prob >= 80 ? 'CONFIRMADO' : prob >= 60 ? 'PROVÁVEL' : 'CONDICIONAL';
  const getStatusColor = (prob: number) => prob >= 80 ? 'bg-green-100 text-green-800 border-green-300' : prob >= 60 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300';

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análises Realizadas</h1>
          <p className="text-gray-500 mt-1">
            Visão abrangente de hipóteses — oportunidades estimadas pela IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} analise(s)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar empresa ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'all' as const, label: 'Todas' },
            { key: 'full' as const, label: 'Completas' },
            { key: 'quick' as const, label: 'Quick Score' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detail View (quando uma análise está selecionada) */}
      {detail && (
        <div className="mb-6">
          {/* Toolbar */}
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
            <div className="flex gap-2">
              <a
                href="/admin/producao/extratos"
                className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Extratos (créditos reais SPED)
              </a>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir Relatório
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Salvar Relatório (PDF)
              </button>
            </div>
          </div>

          {/* Relatório — visão abrangente de hipóteses */}
          <>
          <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">EXTRATO DE CREDITOS TRIBUTARIOS</h2>
                  <p className="text-indigo-200 text-sm mt-1">
                    {detail.companyName || ''} {detail.cnpj ? `| ${detail.cnpj}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  {detail.demonstrativo && (detail.demonstrativo.totalReal ?? 0) > 0 ? (
                    <>
                      <p className="text-3xl font-extrabold">{fmt(detail.demonstrativo.totalReal!)}</p>
                      <p className="text-indigo-200 text-xs">Valor REAL (comprovado no SPED)</p>
                      {(detail.demonstrativo.totalHipotese ?? 0) > 0 && (
                        <p className="text-indigo-300 text-xs mt-1">+ {fmt(detail.demonstrativo.totalHipotese!)} estimativa IA</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-extrabold">{fmt(detail.estimatedCredit)}</p>
                      <p className="text-indigo-200 text-xs">Total Estimado de Recuperação</p>
                    </>
                  )}
                  {ops.length > 0 && (
                    <div className="flex gap-3 mt-2 justify-end text-xs">
                      {totalConfirmado > 0 && (
                        <span className="bg-green-500/20 text-green-200 px-2 py-0.5 rounded">
                          Confirmado: {fmt(totalConfirmado)}
                        </span>
                      )}
                      {totalProvavel > 0 && (
                        <span className="bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded">
                          Provável: {fmt(totalProvavel)}
                        </span>
                      )}
                      {totalCondicional > 0 && (
                        <span className="bg-red-500/20 text-red-200 px-2 py-0.5 rounded">
                          Condicional: {fmt(totalCondicional)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-indigo-200">
                {detail.periodoAnalisado && <span>Periodo: {detail.periodoAnalisado}</span>}
                {detail.regimeTributario && <><span>|</span><span>Regime: {detail.regimeTributario}</span></>}
                {detail.riscoGeral && <><span>|</span><span>Risco: <span className="font-bold text-white capitalize">{detail.riscoGeral}</span></span></>}
                <span>|</span>
                <span>Score: <span className="font-bold text-white">{detail.viabilityScore ?? 0}</span></span>
                {detail.partnerName && <><span>|</span><span>Parceiro: {detail.partnerName}</span></>}
              </div>
            </div>

            {/* Alerta Reforma Tributaria */}
            <div className="px-6 py-4 bg-amber-50 border-b-2 border-amber-200">
              <p className="text-sm font-bold text-amber-800 mb-2">JANELA DE RECUPERACAO — REFORMA TRIBUTARIA</p>
              <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
                <li>Creditos de PIS/COFINS: recuperar ANTES da extincao em 2027</li>
                <li>Creditos de ICMS/ISS: recuperar ANTES da extincao progressiva (2029-2033)</li>
                <li>Teses pacificadas (Tema 69, 985, 478, 72): executar AGORA — janela fechando</li>
                <li>Prazo decadencial: ultimos 5 anos de cada tributo</li>
              </ul>
            </div>

            {/* Resumo */}
            {detail.resumoExecutivo && (
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-1">Resumo Executivo</p>
                <p className="text-sm text-gray-600 leading-relaxed">{detail.resumoExecutivo}</p>
              </div>
            )}

            {/* Tabela de Oportunidades */}
            {ops.length > 0 && (
              <div className="px-6 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3">
                  EXTRATO DE OPORTUNIDADES ({ops.length})
                  <span className="ml-4 font-normal text-xs text-gray-500">
                    {opsConfirmadas.length > 0 && <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded mr-2">{opsConfirmadas.length} confirmado(s)</span>}
                    {opsProvaveis.length > 0 && <span className="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded mr-2">{opsProvaveis.length} provável(is)</span>}
                    {opsCondicionais.length > 0 && <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded">{opsCondicionais.length} condicional(is)</span>}
                  </span>
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                        <th className="px-4 py-3 text-left font-semibold">#</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Oportunidade</th>
                        <th className="px-4 py-3 text-left font-semibold">Tributo</th>
                        <th className="px-4 py-3 text-right font-semibold">Valor Estimado</th>
                        <th className="px-4 py-3 text-center font-semibold">Prob.</th>
                        <th className="px-4 py-3 text-center font-semibold">Complex.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {opsSorted.map((op, i) => (
                        <tr key={i} className="hover:bg-indigo-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${getStatusColor(op.probabilidadeRecuperacao ?? 0)}`}>
                              {getStatusLabel(op.probabilidadeRecuperacao ?? 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{op.tipo || ''}</p>
                            <p className="text-gray-600 text-xs mt-1 leading-relaxed whitespace-pre-line">{op.descricao || ''}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">{op.tributo || ''}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                            {fmt(op.valorEstimado)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${(op.probabilidadeRecuperacao || 0) >= 80 ? 'bg-green-100 text-green-700' : (op.probabilidadeRecuperacao || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {op.probabilidadeRecuperacao ?? 0}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${complexColor(op.complexidade)}`}>
                              {op.complexidade || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {totalConfirmado > 0 && (
                        <tr className="bg-green-50">
                          <td className="px-4 py-2" colSpan={4}><span className="text-green-800 font-semibold text-xs">CONFIRMADO (prob. {'>'}= 80%)</span></td>
                          <td className="px-4 py-2 text-right font-bold text-green-800 whitespace-nowrap">{fmt(totalConfirmado)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                      {totalProvavel > 0 && (
                        <tr className="bg-amber-50">
                          <td className="px-4 py-2" colSpan={4}><span className="text-amber-800 font-semibold text-xs">PROVÁVEL (prob. 60-79%)</span></td>
                          <td className="px-4 py-2 text-right font-bold text-amber-800 whitespace-nowrap">{fmt(totalProvavel)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                      {totalCondicional > 0 && (
                        <tr className="bg-red-50">
                          <td className="px-4 py-2" colSpan={4}><span className="text-red-800 font-semibold text-xs">CONDICIONAL (prob. {'<'} 60%)</span></td>
                          <td className="px-4 py-2 text-right font-bold text-red-800 whitespace-nowrap">{fmt(totalCondicional)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                      <tr className="bg-indigo-50 font-bold">
                        <td className="px-4 py-3" colSpan={4}>
                          <span className="text-indigo-900">TOTAL ESTIMADO DE RECUPERAÇÃO</span>
                        </td>
                        <td className="px-4 py-3 text-right text-green-800 text-lg whitespace-nowrap">
                          {fmt(detail.estimatedCredit)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Detalhes expandidos */}
            {ops.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-900 mb-3">DETALHAMENTO POR OPORTUNIDADE</p>
                <div className="space-y-3">
                  {opsSorted.map((op, i) => (
                    <details key={i} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <summary className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getStatusColor(op.probabilidadeRecuperacao ?? 0)}`}>
                            {getStatusLabel(op.probabilidadeRecuperacao ?? 0)}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">{op.tipo || ''}</span>
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">{op.tributo || ''}</span>
                        </div>
                        <span className="font-bold text-green-700 text-sm">{fmt(op.valorEstimado)}</span>
                      </summary>
                      <div className="px-4 py-4 bg-white border-t border-gray-200 space-y-3 text-sm">
                        {op.descricao && (
                          <div>
                            <p className="font-semibold text-gray-700">Descricao</p>
                            <p className="text-gray-600">{op.descricao}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {op.fundamentacaoLegal && (
                            <div>
                              <p className="font-semibold text-gray-700">Fundamentação Legal</p>
                              <p className="text-gray-600">{op.fundamentacaoLegal}</p>
                            </div>
                          )}
                          {op.prazoRecuperacao && (
                            <div>
                              <p className="font-semibold text-gray-700">Prazo de Recuperação</p>
                              <p className="text-gray-600">{op.prazoRecuperacao}</p>
                            </div>
                          )}
                        </div>
                        {op.risco && (
                          <div>
                            <p className="font-semibold text-gray-700">Risco</p>
                            <p className="text-yellow-700">{op.risco}</p>
                          </div>
                        )}
                        {(op.documentacaoNecessaria || []).length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">Documentação Necessária</p>
                            <ul className="list-disc list-inside text-gray-600">
                              {(op.documentacaoNecessaria || []).map((d, j) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(op.passosPraticos || []).length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">Passos Praticos</p>
                            <ol className="list-decimal list-inside text-gray-600">
                              {(op.passosPraticos || []).map((p, j) => (
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
            )}

            {/* Recomendacoes e Alertas */}
            {(recs.length > 0 || alerts.length > 0) && (
              <div className="px-6 py-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                {recs.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-800 text-sm mb-2">Recomendacoes</p>
                    <ul className="space-y-1">
                      {recs.map((r, i) => (
                        <li key={i} className="text-green-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">+</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {alerts.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-semibold text-yellow-800 text-sm mb-2">Alertas</p>
                    <ul className="space-y-1">
                      {alerts.map((a, i) => (
                        <li key={i} className="text-yellow-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">!</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Fundamentacao */}
            {detail.fundamentacaoGeral && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-700 text-sm mb-1">Fundamentação Geral</p>
                <p className="text-gray-600 text-xs leading-relaxed">{detail.fundamentacaoGeral}</p>
              </div>
            )}

            {/* Sem análise completa */}
            {!detail.hasFullAnalysis && (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500 text-sm">Esta análise possui apenas o Quick Score.</p>
                <p className="text-gray-400 text-xs mt-1">Execute a Análise Completa na página de Viabilidade para ver o extrato detalhado.</p>
              </div>
            )}

            {/* Nota conservadora */}
            <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700 italic">
                Valores sao estimativas conservadoras. O valor real recuperado pode ser superior ao estimado.
              </p>
            </div>

            {/* Rodape */}
            <div className="px-6 py-3 bg-gray-100 text-xs text-gray-400 flex justify-between">
              <span>Analise: IA Avancada {detail.source === 'hpc' ? '| HPC Go+Chapel + Claude Opus' : ''} | TaxCredit Enterprise</span>
              <span>{detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Hidden print content — renderizado para window.print() */}
          <div ref={printRef} style={{ display: 'none' }}>
            <div className="header">
              <div className="header-row">
                <div>
                  <h1>EXTRATO DE CREDITOS TRIBUTARIOS</h1>
                  <div className="company">{detail.companyName || ''} {detail.cnpj ? `| CNPJ: ${detail.cnpj}` : ''}</div>
                </div>
                <div>
                  <div className="total">{fmt(detail.estimatedCredit)}</div>
                  <div className="total-label">Total Estimado de Recuperação</div>
                </div>
              </div>
              {ops.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', justifyContent: 'flex-end' }}>
                  {totalConfirmado > 0 && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                      Confirmado: {fmt(totalConfirmado)}
                    </span>
                  )}
                  {totalProvavel > 0 && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                      Provável: {fmt(totalProvavel)}
                    </span>
                  )}
                  {totalCondicional > 0 && (
                    <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                      Condicional: {fmt(totalCondicional)}
                    </span>
                  )}
                </div>
              )}
              <div className="header-meta">
                {detail.periodoAnalisado && <span>Periodo: {detail.periodoAnalisado}</span>}
                {detail.regimeTributario && <span>| Regime: {detail.regimeTributario}</span>}
                {detail.riscoGeral && <span>| Risco: {detail.riscoGeral}</span>}
                <span>| Score: {detail.viabilityScore ?? 0}</span>
                {detail.partnerName && <span>| Parceiro: {detail.partnerName}</span>}
              </div>
            </div>

            {detail.resumoExecutivo && (
              <div className="section">
                <div className="section-title">Resumo Executivo</div>
                <div className="summary-box">{detail.resumoExecutivo}</div>
              </div>
            )}

            {ops.length > 0 && (
              <div className="section">
                <div className="section-title">Extrato de Oportunidades ({ops.length})</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Status</th>
                      <th>Oportunidade</th>
                      <th>Tributo</th>
                      <th className="text-right">Valor Estimado</th>
                      <th className="text-center">Prob.</th>
                      <th className="text-center">Complex.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsSorted.map((op, i) => {
                      const prob = op.probabilidadeRecuperacao ?? 0;
                      const statusBg = prob >= 80 ? '#dcfce7' : prob >= 60 ? '#fef3c7' : '#fee2e2';
                      const statusTxt = prob >= 80 ? '#166534' : prob >= 60 ? '#92400e' : '#991b1b';
                      return (
                        <tr key={i}>
                          <td>{String(i + 1).padStart(2, '0')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: statusBg, color: statusTxt, padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>
                              {getStatusLabel(prob)}
                            </span>
                          </td>
                          <td>
                            <strong>{op.tipo || ''}</strong>
                            <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px', lineHeight: '1.7' }}>{op.descricao || ''}</div>
                          </td>
                          <td><span className="badge badge-indigo">{op.tributo || ''}</span></td>
                          <td className="text-right text-green">{fmt(op.valorEstimado)}</td>
                          <td className="text-center">
                            <span className={`badge ${probBadge(op.probabilidadeRecuperacao)}`}>
                              {prob}%
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${complexBadge(op.complexidade)}`}>
                              {op.complexidade || '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {totalConfirmado > 0 && (
                      <tr style={{ background: '#dcfce7' }}>
                        <td colSpan={4}><strong style={{ color: '#166534', fontSize: '10px' }}>CONFIRMADO (prob. {'>'}= 80%)</strong></td>
                        <td className="text-right" style={{ color: '#166534', fontWeight: 'bold' }}>{fmt(totalConfirmado)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    {totalProvavel > 0 && (
                      <tr style={{ background: '#fef3c7' }}>
                        <td colSpan={4}><strong style={{ color: '#92400e', fontSize: '10px' }}>PROVÁVEL (prob. 60-79%)</strong></td>
                        <td className="text-right" style={{ color: '#92400e', fontWeight: 'bold' }}>{fmt(totalProvavel)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    {totalCondicional > 0 && (
                      <tr style={{ background: '#fee2e2' }}>
                        <td colSpan={4}><strong style={{ color: '#991b1b', fontSize: '10px' }}>CONDICIONAL (prob. {'<'} 60%)</strong></td>
                        <td className="text-right" style={{ color: '#991b1b', fontWeight: 'bold' }}>{fmt(totalCondicional)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td colSpan={4}><strong>TOTAL ESTIMADO DE RECUPERAÇÃO</strong></td>
                      <td className="text-right text-green" style={{ fontSize: '13px' }}>{fmt(detail.estimatedCredit)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {ops.length > 0 && (
              <div className="section">
                <div className="section-title">Detalhamento por Oportunidade</div>
                {opsSorted.map((op, i) => {
                  const prob = op.probabilidadeRecuperacao ?? 0;
                  const statusBg = prob >= 80 ? '#dcfce7' : prob >= 60 ? '#fef3c7' : '#fee2e2';
                  const statusTxt = prob >= 80 ? '#166534' : prob >= 60 ? '#92400e' : '#991b1b';
                  return (
                  <div key={i} className="detail-block">
                    <h4>
                      {String(i + 1).padStart(2, '0')}.{' '}
                      <span style={{ background: statusBg, color: statusTxt, padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold', marginRight: '6px' }}>
                        {getStatusLabel(prob)}
                      </span>
                      {op.tipo || ''} — <span className="text-indigo">{op.tributo || ''}</span> — {fmt(op.valorEstimado)}
                    </h4>
                    {op.descricao && <p>{op.descricao}</p>}
                    <div className="detail-grid" style={{ marginTop: '6px' }}>
                      {op.fundamentacaoLegal && <p><span className="label">Fundamentação:</span> {op.fundamentacaoLegal}</p>}
                      {op.prazoRecuperacao && <p><span className="label">Prazo:</span> {op.prazoRecuperacao}</p>}
                      {op.complexidade && <p><span className="label">Complexidade:</span> {op.complexidade}</p>}
                      {op.risco && <p><span className="label">Risco:</span> {op.risco}</p>}
                    </div>
                    {(op.documentacaoNecessaria || []).length > 0 && (
                      <p style={{ marginTop: '4px' }}><span className="label">Docs necessários:</span> {(op.documentacaoNecessaria || []).join(', ')}</p>
                    )}
                    {(op.passosPraticos || []).length > 0 && (
                      <p style={{ marginTop: '4px' }}><span className="label">Passos:</span> {(op.passosPraticos || []).join(' -> ')}</p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {(recs.length > 0 || alerts.length > 0) && (
              <div className="rec-alert-grid">
                {recs.length > 0 && (
                  <div className="rec-box">
                    <h4>Recomendacoes</h4>
                    <ul>
                      {recs.map((r, i) => <li key={i}>+ {r}</li>)}
                    </ul>
                  </div>
                )}
                {alerts.length > 0 && (
                  <div className="alert-box">
                    <h4>Alertas</h4>
                    <ul>
                      {alerts.map((a, i) => <li key={i}>! {a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {detail.fundamentacaoGeral && (
              <div className="section">
                <div className="section-title">Fundamentação Geral</div>
                <div className="summary-box">{detail.fundamentacaoGeral}</div>
              </div>
            )}

            <div className="summary-box" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', color: '#1d4ed8', fontStyle: 'italic' }}>
                Valores sao estimativas conservadoras. O valor real recuperado pode ser superior ao estimado.
              </p>
            </div>

            <div className="footer">
              <span>Analise: IA Avancada | TaxCredit Enterprise | taxcreditenterprise.com</span>
              <span>{detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          </>
        </div>
      )}

      {/* Lista de Analises */}
      {!detail && (
        <>
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Carregando analises...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-gray-500">Nenhuma análise encontrada.</p>
              <p className="text-gray-400 text-sm mt-1">As analises de viabilidade aparecerao aqui quando concluidas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => (
                <div
                  key={a.id}
                  onClick={() => fetchDetail(a.id)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-gray-900 font-semibold text-base truncate group-hover:text-indigo-700 transition-colors">
                          {a.companyName || 'Empresa'}
                        </h3>
                        {a.source === 'hpc' && (
                          <span className="shrink-0 text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                            HPC
                          </span>
                        )}
                        {a.hasFullAnalysis ? (
                          <span className="shrink-0 text-xs font-bold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                            Análise Completa
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                            Quick Score
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {a.cnpj && <span>{a.cnpj}</span>}
                        {a.partnerName && <span>Parceiro: {a.partnerName}</span>}
                        {a.createdAt && <span>{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {/* Score */}
                      <div className="text-center">
                        {a.viabilityScore != null ? (
                          <span className={`text-lg font-bold ${scoreColor(a.scoreLabel)} px-3 py-1 rounded-lg`}>
                            {a.viabilityScore}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </div>

                      {/* Valor */}
                      <div className="text-right min-w-[140px]">
                        {a.estimatedCredit ? (
                          <p className="text-green-700 font-bold text-base">{fmt(a.estimatedCredit)}</p>
                        ) : (
                          <p className="text-gray-400 text-xs">Pre-triagem</p>
                        )}
                        {a.hasFullAnalysis && a.oportunidades && (
                          <p className="text-gray-400 text-xs">{a.oportunidades.length} oportunidade(s)</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
            <span className="text-gray-700 text-sm">Carregando extrato...</span>
          </div>
        </div>
      )}
    </div>
  );
}
