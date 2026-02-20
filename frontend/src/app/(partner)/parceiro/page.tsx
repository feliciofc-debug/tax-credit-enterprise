'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { authedFetcher, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface DashboardData {
  overview: {
    totalViabilities: number;
    completedViabilities: number;
    highScoreViabilities: number;
    conversionRate: number;
    totalInvites: number;
    usedInvites: number;
    activeContracts: number;
    totalEarnings: number;
  };
  recentViabilities: {
    id: string;
    companyName: string;
    viabilityScore: number;
    scoreLabel: string;
    estimatedCredit: number;
    status: string;
    createdAt: string;
  }[];
}

const scoreColor = (score: number) => {
  if (score >= 80) return { text: 'text-green-700', bg: 'bg-green-100' };
  if (score >= 60) return { text: 'text-yellow-700', bg: 'bg-yellow-100' };
  return { text: 'text-red-700', bg: 'bg-red-100' };
};

export default function PartnerDashboard() {
  const { data, isLoading } = useSWR<DashboardData>(
    '/api/partner/dashboard',
    authedFetcher,
    SWR_OPTIONS_FAST,
  );

  const s = data?.overview;
  const recentViabilities = data?.recentViabilities || [];

  if (isLoading && !data) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5"><div className="h-16 bg-gray-200 rounded" /></div>
          ))}
        </div>
        <div className="card p-6"><div className="h-40 bg-gray-200 rounded" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard do Parceiro</h1>
          <p className="text-gray-500 text-sm mt-1">Visao geral das suas operacoes</p>
        </div>
        <Link href="/parceiro/viabilidade" className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nova Viabilidade
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Seus Ganhos', value: s ? `R$ ${s.totalEarnings.toLocaleString('pt-BR')}` : 'R$ 0', color: 'text-green-700', bg: 'bg-green-50', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Contratos Ativos', value: String(s?.activeContracts ?? 0), color: 'text-indigo-700', bg: 'bg-indigo-50', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { label: 'Convites Aceitos', value: `${s?.usedInvites ?? 0}/${s?.totalInvites ?? 0}`, color: 'text-blue-700', bg: 'bg-blue-50', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
          { label: 'Viabilidades', value: `${s?.completedViabilities ?? 0}`, color: 'text-purple-700', bg: 'bg-purple-50', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
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
        {recentViabilities.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <p className="text-gray-500 font-medium">Nenhuma viabilidade ainda</p>
            <p className="text-gray-400 text-sm mt-1">Faca sua primeira analise de viabilidade</p>
            <Link href="/parceiro/viabilidade" className="mt-4 inline-block text-indigo-600 font-semibold text-sm hover:text-indigo-700">
              Iniciar Analise
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Empresa</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Credito Estimado</th>
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentViabilities.map(v => {
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
                        {v.estimatedCredit ? `R$ ${v.estimatedCredit.toLocaleString('pt-BR')}` : '-'}
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
        )}
      </div>
    </div>
  );
}
