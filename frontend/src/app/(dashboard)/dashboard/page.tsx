'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Demo data - will connect to real API
const demoStats = {
  overview: {
    totalBatches: 12,
    completedBatches: 9,
    totalDocuments: 142,
    completedDocuments: 128,
    totalEstimatedValue: 2847500.00,
  },
  recentBatches: [
    { id: '1', name: 'Lote Janeiro 2024', status: 'completed', totalDocuments: 45, processedDocs: 45, totalEstimatedValue: 850000, createdAt: '2026-02-01T10:00:00Z' },
    { id: '2', name: 'Lote Fevereiro 2024', status: 'completed', totalDocuments: 32, processedDocs: 32, totalEstimatedValue: 620000, createdAt: '2026-02-03T14:00:00Z' },
    { id: '3', name: 'Lote Marco 2024', status: 'processing', totalDocuments: 28, processedDocs: 15, totalEstimatedValue: 0, createdAt: '2026-02-08T09:00:00Z' },
    { id: '4', name: 'DRE Empresa ABC', status: 'completed', totalDocuments: 12, processedDocs: 12, totalEstimatedValue: 435000, createdAt: '2026-02-05T16:00:00Z' },
    { id: '5', name: 'Balancete Q4', status: 'pending', totalDocuments: 25, processedDocs: 0, totalEstimatedValue: 0, createdAt: '2026-02-08T11:00:00Z' },
  ],
};

const statCards = [
  {
    label: 'Valor Total Estimado',
    getValue: (s: typeof demoStats.overview) => `R$ ${s.totalEstimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    color: 'text-brand-700',
    bgColor: 'bg-brand-50',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    label: 'Documentos Analisados',
    getValue: (s: typeof demoStats.overview) => `${s.completedDocuments} / ${s.totalDocuments}`,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    label: 'Lotes Completos',
    getValue: (s: typeof demoStats.overview) => `${s.completedBatches} / ${s.totalBatches}`,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    label: 'Taxa de Sucesso',
    getValue: (s: typeof demoStats.overview) => `${Math.round((s.completedDocuments / s.totalDocuments) * 100)}%`,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

const statusBadge = (status: string) => {
  const config: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completo', cls: 'bg-green-100 text-green-700' },
    processing: { label: 'Processando', cls: 'bg-blue-100 text-blue-700' },
    pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
    failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700' },
  };
  const c = config[status] || config.pending;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>{c.label}</span>;
};

export default function DashboardPage() {
  const [stats] = useState(demoStats);
  // Simula status do contrato do cliente (conectar com API real)
  const [contractStatus] = useState({
    setupFeePaid: true, // false para mostrar pendente
    consultaLiberada: true,
    formalizacaoLiberada: true,
    setupFee: 2000,
  });

  return (
    <div>
      {/* Banner de status do contrato */}
      {!contractStatus.setupFeePaid ? (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-800">Pagamento da Taxa Pendente</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Para liberar a consulta completa e formalizacao do processo, efetue o pagamento da taxa de adesao de <strong>R$ {contractStatus.setupFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
              </p>
              <button className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-5 rounded-lg text-sm transition-colors">
                Efetuar Pagamento
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-green-800">Taxa paga</span>
              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">Consulta liberada</span>
              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">Formalizacao liberada</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visao geral do sistema de recuperacao de creditos</p>
        </div>
        <Link href="/upload" className="btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Upload
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                <svg className={`w-6 h-6 ${card.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.getValue(stats.overview)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Batches */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Lotes Recentes</h2>
          <Link href="/upload" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Documentos</th>
                <th className="px-6 py-3">Valor Estimado</th>
                <th className="px-6 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recentBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900 text-sm">{batch.name}</span>
                  </td>
                  <td className="px-6 py-4">{statusBadge(batch.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {batch.processedDocs}/{batch.totalDocuments}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {batch.totalEstimatedValue > 0
                      ? `R$ ${batch.totalEstimatedValue.toLocaleString('pt-BR')}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(batch.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
