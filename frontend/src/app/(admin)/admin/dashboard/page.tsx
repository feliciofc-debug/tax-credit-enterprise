'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardData {
  users: { total: number; clients: number };
  partners: { total: number; active: number; pending: number };
  contracts: {
    total: number;
    active: number;
    paid: number;
    totalRecovered: number;
    partnerEarnings: number;
    platformEarnings: number;
  };
  invites: { total: number; used: number; active: number };
  viabilities: { total: number };
  recentViabilities: any[];
  recentContracts: any[];
  recentPartners: any[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'viabilities' | 'contracts' | 'partners'>('overview');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token) return;
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
    fetchDashboard(token);
  }, []);

  const fetchDashboard = async (token: string) => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Erro ao carregar dados');
      }
    } catch {
      setError('Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const scoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-900/30', label: 'Excelente' };
    if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Bom' };
    if (score >= 40) return { text: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'Medio' };
    return { text: 'text-red-400', bg: 'bg-red-900/30', label: 'Baixo' };
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: 'text-green-400 bg-green-900/30',
      pending: 'text-yellow-400 bg-yellow-900/30',
      draft: 'text-gray-400 bg-gray-800',
      pending_signature: 'text-blue-400 bg-blue-900/30',
      completed: 'text-purple-400 bg-purple-900/30',
      used: 'text-blue-400 bg-blue-900/30',
      rejected: 'text-red-400 bg-red-900/30',
    };
    return map[s] || 'text-gray-400 bg-gray-800';
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: 'Ativo',
      pending: 'Pendente',
      draft: 'Rascunho',
      pending_signature: 'Aguardando Assinatura',
      completed: 'Concluido',
      cancelled: 'Cancelado',
      used: 'Utilizado',
      rejected: 'Rejeitado',
    };
    return map[s] || s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Ola, {user?.name || 'Administrador'}
          </h1>
          <p className="text-gray-500 mt-1">Painel completo da plataforma TaxCredit Enterprise</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/producao/viabilidade"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Nova Viabilidade
          </Link>
          <Link
            href="/admin/producao/convites"
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm border border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Novo Convite
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Alert: Pending Partners */}
          {data.partners.pending > 0 && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">
                    {data.partners.pending} parceiro(s) aguardando aprovacao
                  </p>
                  <p className="text-amber-500 text-xs">Acesse a pagina de parceiros para aprovar ou rejeitar</p>
                </div>
              </div>
              <Link href="/admin/parceiros" className="text-amber-400 hover:text-amber-300 text-sm font-medium px-4 py-2 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 transition-colors">
                Ver Pendentes
              </Link>
            </div>
          )}

          {/* Main Stats - 5 cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[
              {
                label: 'Receita Plataforma',
                value: fmt(data.contracts.platformEarnings),
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                color: 'green',
              },
              {
                label: 'Contratos Ativos',
                value: String(data.contracts.active),
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                color: 'indigo',
              },
              {
                label: 'Parceiros Ativos',
                value: `${data.partners.active}/${data.partners.total}`,
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                color: 'purple',
              },
              {
                label: 'Viabilidades',
                value: String(data.viabilities.total),
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                color: 'cyan',
              },
              {
                label: 'Clientes',
                value: String(data.users.clients),
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
                color: 'blue',
              },
            ].map(card => {
              const colors: Record<string, { iconBg: string; iconText: string; valueTxt: string }> = {
                green: { iconBg: 'bg-green-600/20', iconText: 'text-green-400', valueTxt: 'text-green-400' },
                indigo: { iconBg: 'bg-indigo-600/20', iconText: 'text-indigo-400', valueTxt: 'text-indigo-400' },
                purple: { iconBg: 'bg-purple-600/20', iconText: 'text-purple-400', valueTxt: 'text-purple-400' },
                cyan: { iconBg: 'bg-cyan-600/20', iconText: 'text-cyan-400', valueTxt: 'text-cyan-400' },
                blue: { iconBg: 'bg-blue-600/20', iconText: 'text-blue-400', valueTxt: 'text-blue-400' },
              };
              const c = colors[card.color] || colors.green;
              return (
                <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{card.label}</p>
                    <div className={`w-9 h-9 ${c.iconBg} rounded-lg flex items-center justify-center ${c.iconText}`}>
                      {card.icon}
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${c.valueTxt}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Financial Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Resumo Financeiro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Total Recuperado</p>
                <p className="text-xl font-bold text-white">{fmt(data.contracts.totalRecovered)}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Receita Plataforma (60%)</p>
                <p className="text-xl font-bold text-indigo-400">{fmt(data.contracts.platformEarnings)}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Receita Parceiros (40%)</p>
                <p className="text-xl font-bold text-emerald-400">{fmt(data.contracts.partnerEarnings)}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Convites</p>
                <p className="text-xl font-bold text-white">
                  {data.invites.used}<span className="text-gray-500 text-sm font-normal">/{data.invites.total} usados</span>
                </p>
                {data.invites.total > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${(data.invites.used / data.invites.total) * 100}%` }}></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs for tables */}
          <div className="flex items-center gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
            {[
              { key: 'overview' as const, label: 'Viabilidades Recentes' },
              { key: 'contracts' as const, label: 'Contratos Recentes' },
              { key: 'partners' as const, label: 'Parceiros' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Viabilities Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-white font-semibold">Viabilidades Recentes</h3>
                  <Link href="/admin/producao/viabilidade" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                    Ver todas / Nova analise
                  </Link>
                </div>
                {data.recentViabilities.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhuma analise realizada ainda</p>
                    <p className="text-gray-600 text-sm mt-1">Faca sua primeira analise de viabilidade</p>
                    <Link href="/admin/producao/viabilidade" className="inline-block mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
                      Iniciar Analise
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-800">
                          <th className="px-6 py-3">Empresa</th>
                          <th className="px-6 py-3">Score</th>
                          <th className="px-6 py-3">Credito Estimado</th>
                          <th className="px-6 py-3">Parceiro</th>
                          <th className="px-6 py-3">Data</th>
                          <th className="px-6 py-3">Acao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {data.recentViabilities.map((v: any) => {
                          const sc = scoreColor(v.viabilityScore || 0);
                          return (
                            <tr key={v.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-white font-medium text-sm">{v.companyName}</p>
                                <p className="text-gray-500 text-xs">{v.cnpj || 'Sem CNPJ'}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                                  {v.viabilityScore || 0} - {sc.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-green-400">
                                {fmt(v.estimatedCredit || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-400">
                                {v.partner?.name || v.partner?.company || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4">
                                {(v.viabilityScore || 0) >= 70 ? (
                                  <Link href="/admin/producao/convites" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                                    Gerar Convite
                                  </Link>
                                ) : (
                                  <span className="text-sm text-gray-600">Score baixo</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
              <>
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-white font-semibold">Contratos Recentes</h3>
                  <Link href="/admin/producao/contratos" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                    Ver todos
                  </Link>
                </div>
                {data.recentContracts.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum contrato ainda</p>
                    <p className="text-gray-600 text-sm mt-1">Os contratos aparecem aqui conforme forem criados</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {data.recentContracts.map((c: any) => (
                      <div key={c.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <p className="text-white font-medium text-sm">{c.contractNumber}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
                                {statusLabel(c.status)}
                              </span>
                              {c.setupFeePaid && (
                                <span className="text-xs px-2 py-0.5 rounded-full text-green-400 bg-green-900/30">
                                  Taxa Paga
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs">
                              Cliente: {c.client?.name || c.client?.company || 'N/A'}
                              {c.client?.email && ` (${c.client.email})`}
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              Parceiro: {c.partner?.name || c.partner?.company || 'Plataforma'}
                              {' | '}Split: {c.partnerSplitPercent}% / {c.platformSplitPercent}%
                              {' | '}{new Date(c.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold text-sm">{fmt(c.totalRecovered || 0)}</p>
                            <p className="text-gray-600 text-xs">recuperado</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Partners Tab */}
            {activeTab === 'partners' && (
              <>
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-white font-semibold">Parceiros</h3>
                  <Link href="/admin/parceiros" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                    Gerenciar Parceiros
                  </Link>
                </div>
                {data.recentPartners.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum parceiro cadastrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-800">
                          <th className="px-6 py-3">Parceiro</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Comissao</th>
                          <th className="px-6 py-3">Viabilidades</th>
                          <th className="px-6 py-3">Contratos</th>
                          <th className="px-6 py-3">Convites</th>
                          <th className="px-6 py-3">Desde</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {data.recentPartners.map((p: any) => (
                          <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-white font-medium text-sm">{p.name}</p>
                              <p className="text-gray-500 text-xs">{p.company || p.email}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                                {statusLabel(p.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-white font-medium">
                              {p.commissionPercent}%
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {p._count?.viabilityAnalyses || 0}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {p._count?.contracts || 0}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {p._count?.invites || 0}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-white font-semibold mb-4">Acoes Rapidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Nova Viabilidade', href: '/admin/producao/viabilidade', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'indigo' },
                { label: 'Novo Convite', href: '/admin/producao/convites', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'cyan' },
                { label: 'Contratos', href: '/admin/producao/contratos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'purple' },
                { label: 'Parceiros', href: '/admin/parceiros', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'green' },
                { label: 'Clientes', href: '/admin/clientes', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'blue' },
                { label: 'Financeiro', href: '/admin/producao/contratos', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'emerald' },
              ].map(action => {
                const colorMap: Record<string, string> = {
                  indigo: 'hover:border-indigo-700 hover:bg-indigo-900/20 text-indigo-400',
                  cyan: 'hover:border-cyan-700 hover:bg-cyan-900/20 text-cyan-400',
                  purple: 'hover:border-purple-700 hover:bg-purple-900/20 text-purple-400',
                  green: 'hover:border-green-700 hover:bg-green-900/20 text-green-400',
                  blue: 'hover:border-blue-700 hover:bg-blue-900/20 text-blue-400',
                  emerald: 'hover:border-emerald-700 hover:bg-emerald-900/20 text-emerald-400',
                };
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all ${colorMap[action.color] || ''} group`}
                  >
                    <svg className="w-6 h-6 mb-2 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                    <p className="text-white font-medium text-sm">{action.label}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
