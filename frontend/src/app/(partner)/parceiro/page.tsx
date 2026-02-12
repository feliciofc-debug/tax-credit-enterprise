'use client';

import { useState } from 'react';
import Link from 'next/link';

// Demo data - conectar com API real depois
const demoStats = {
  overview: {
    totalViabilities: 24,
    completedViabilities: 20,
    highScoreViabilities: 15,
    conversionRate: 75,
    totalInvites: 18,
    usedInvites: 12,
    activeContracts: 8,
    totalEarnings: 180000,
  },
  recentViabilities: [
    { id: '1', companyName: 'Metalurgica ABC Ltda', viabilityScore: 92, scoreLabel: 'excelente', estimatedCredit: 450000, status: 'completed', createdAt: '2026-02-08T10:00:00Z' },
    { id: '2', companyName: 'Comercio XYZ S.A.', viabilityScore: 78, scoreLabel: 'bom', estimatedCredit: 280000, status: 'completed', createdAt: '2026-02-07T14:00:00Z' },
    { id: '3', companyName: 'Transportes Fast Ltda', viabilityScore: 45, scoreLabel: 'baixo', estimatedCredit: 35000, status: 'completed', createdAt: '2026-02-06T09:00:00Z' },
    { id: '4', companyName: 'Industria Moderna ME', viabilityScore: 85, scoreLabel: 'excelente', estimatedCredit: 620000, status: 'completed', createdAt: '2026-02-05T16:00:00Z' },
    { id: '5', companyName: 'Tech Solutions Ltda', viabilityScore: 68, scoreLabel: 'medio', estimatedCredit: 120000, status: 'completed', createdAt: '2026-02-04T11:00:00Z' },
  ],
};

const scoreColor = (score: number) => {
  if (score >= 80) return { text: 'text-green-700', bg: 'bg-green-100' };
  if (score >= 60) return { text: 'text-yellow-700', bg: 'bg-yellow-100' };
  return { text: 'text-red-700', bg: 'bg-red-100' };
};

export default function PartnerDashboard() {
  const [stats] = useState(demoStats);
  const s = stats.overview;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard do Parceiro</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral das suas operações</p>
        </div>
        <Link href="/parceiro/viabilidade" className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nova Viabilidade
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Seus Ganhos', value: `R$ ${s.totalEarnings.toLocaleString('pt-BR')}`, color: 'text-green-700', bg: 'bg-green-50', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Contratos Ativos', value: String(s.activeContracts), color: 'text-indigo-700', bg: 'bg-indigo-50', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { label: 'Convites Aceitos', value: `${s.usedInvites}/${s.totalInvites}`, color: 'text-blue-700', bg: 'bg-blue-50', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
          { label: 'Taxa de Conversão', value: `${s.conversionRate}%`, color: 'text-purple-700', bg: 'bg-purple-50', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
        ].map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                <svg className={`w-6 h-6 ${card.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent viabilities */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Viabilidades Recentes</h2>
          <Link href="/parceiro/viabilidade" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Empresa</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Crédito Estimado</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recentViabilities.map(v => {
                const sc = scoreColor(v.viabilityScore);
                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 text-sm">{v.companyName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                        {v.viabilityScore} - {v.scoreLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      R$ {v.estimatedCredit.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      {v.viabilityScore >= 70 ? (
                        <Link href="/parceiro/convites" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                          Gerar Convite
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">Score baixo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
