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
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'partners'>('overview');

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
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const scoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-700', bg: 'bg-green-100', label: 'Excelente' };
    if (score >= 60) return { text: 'text-blue-700', bg: 'bg-blue-100', label: 'Bom' };
    if (score >= 40) return { text: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Médio' };
    return { text: 'text-red-700', bg: 'bg-red-100', label: 'Baixo' };
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: 'text-green-700 bg-green-100',
      pending: 'text-yellow-700 bg-yellow-100',
      draft: 'text-gray-600 bg-gray-100',
      pending_signature: 'text-blue-700 bg-blue-100',
      completed: 'text-purple-700 bg-purple-100',
      used: 'text-blue-700 bg-blue-100',
      rejected: 'text-red-700 bg-red-100',
    };
    return map[s] || 'text-gray-600 bg-gray-100';
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: 'Ativo', pending: 'Pendente', draft: 'Rascunho',
      pending_signature: 'Aguardando Assinatura', completed: 'Concluído',
      cancelled: 'Cancelado', used: 'Utilizado', rejected: 'Rejeitado',
    };
    return map[s] || s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.name || 'Administrador'}
          </h1>
          <p className="text-gray-500 mt-1">Painel completo da plataforma TaxCredit Enterprise</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/producao/viabilidade"
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Nova Viabilidade
          </Link>
          <Link
            href="/admin/producao/convites"
            className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm border border-gray-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Novo Convite
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Alert: Pending Partners */}
          {data.partners.pending > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-amber-800 font-semibold text-sm">
                    {data.partners.pending} parceiro(s) aguardando aprovação
                  </p>
                  <p className="text-amber-600 text-xs">Acesse a página de parceiros para aprovar ou rejeitar</p>
                </div>
              </div>
              <Link href="/admin/parceiros" className="text-amber-700 hover:text-amber-800 text-sm font-medium px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors">
                Ver Pendentes
              </Link>
            </div>
          )}

          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[
              {
                label: 'Receita Plataforma',
                value: fmt(data.contracts.platformEarnings),
                icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                color: 'green',
              },
              {
                label: 'Contratos Ativos',
                value: String(data.contracts.active),
                icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                color: 'indigo',
              },
              {
                label: 'Parceiros Ativos',
                value: `${data.partners.active}/${data.partners.total}`,
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
                color: 'purple',
              },
              {
                label: 'Viabilidades',
                value: String(data.viabilities.total),
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                color: 'cyan',
              },
              {
                label: 'Clientes',
                value: String(data.users.clients),
                icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
                color: 'blue',
              },
            ].map(card => {
              const colors: Record<string, { iconBg: string; iconText: string; valueTxt: string }> = {
                green: { iconBg: 'bg-green-50', iconText: 'text-green-600', valueTxt: 'text-green-700' },
                indigo: { iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', valueTxt: 'text-indigo-700' },
                purple: { iconBg: 'bg-purple-50', iconText: 'text-purple-600', valueTxt: 'text-purple-700' },
                cyan: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-600', valueTxt: 'text-cyan-700' },
                blue: { iconBg: 'bg-blue-50', iconText: 'text-blue-600', valueTxt: 'text-blue-700' },
              };
              const c = colors[card.color] || colors.green;
              return (
                <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{card.label}</p>
                    <div className={`w-9 h-9 ${c.iconBg} rounded-lg flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${c.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                      </svg>
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${c.valueTxt}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Financial Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Resumo Financeiro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Total Recuperado</p>
                <p className="text-xl font-bold text-gray-900">{fmt(data.contracts.totalRecovered)}</p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Receita Plataforma (60%)</p>
                <p className="text-xl font-bold text-indigo-700">{fmt(data.contracts.platformEarnings)}</p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Receita Parceiros (40%)</p>
                <p className="text-xl font-bold text-green-700">{fmt(data.contracts.partnerEarnings)}</p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Convites</p>
                <p className="text-xl font-bold text-gray-900">
                  {data.invites.used}<span className="text-gray-400 text-sm font-normal">/{data.invites.total} usados</span>
                </p>
                {data.invites.total > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${(data.invites.used / data.invites.total) * 100}%` }}></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
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
                    ? 'bg-indigo-700 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Viabilities Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-gray-900 font-semibold">Viabilidades Recentes</h3>
                  <Link href="/admin/producao/viabilidade" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Ver todas / Nova análise
                  </Link>
                </div>
                {data.recentViabilities.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhuma análise realizada ainda</p>
                    <p className="text-gray-400 text-sm mt-1">Faça sua primeira análise de viabilidade</p>
                    <Link href="/admin/producao/viabilidade" className="inline-block mt-4 px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold rounded-lg transition-colors">
                      Iniciar Análise
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          <th className="px-6 py-3">Empresa</th>
                          <th className="px-6 py-3">Score</th>
                          <th className="px-6 py-3">Crédito Estimado</th>
                          <th className="px-6 py-3">Parceiro</th>
                          <th className="px-6 py-3">Data</th>
                          <th className="px-6 py-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.recentViabilities.map((v: any) => {
                          const sc = scoreColor(v.viabilityScore || 0);
                          return (
                            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-gray-900 font-medium text-sm">{v.companyName}</p>
                                <p className="text-gray-400 text-xs">{v.cnpj || 'Sem CNPJ'}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                                  {v.viabilityScore || 0} - {sc.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-green-700">
                                {v.estimatedCredit ? fmt(v.estimatedCredit) : <span className="text-gray-400 font-normal">Após consulta</span>}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {v.partner?.name || v.partner?.company || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4">
                                {(v.viabilityScore || 0) >= 70 ? (
                                  <Link href="/admin/producao/convites" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
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
              </>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
              <>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-gray-900 font-semibold">Contratos Recentes</h3>
                  <Link href="/admin/producao/contratos" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Ver todos
                  </Link>
                </div>
                {data.recentContracts.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum contrato ainda</p>
                    <p className="text-gray-400 text-sm mt-1">Os contratos aparecem aqui conforme forem criados</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.recentContracts.map((c: any) => (
                      <div key={c.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <p className="text-gray-900 font-medium text-sm">{c.contractNumber}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
                                {statusLabel(c.status)}
                              </span>
                              {c.setupFeePaid && (
                                <span className="text-xs px-2 py-0.5 rounded-full text-green-700 bg-green-100">
                                  Taxa Paga
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs">
                              Cliente: {c.client?.name || c.client?.company || 'N/A'}
                              {c.client?.email && ` (${c.client.email})`}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              Parceiro: {c.partner?.name || c.partner?.company || 'Plataforma'}
                              {' | '}Split: {c.partnerSplitPercent}% / {c.platformSplitPercent}%
                              {' | '}{new Date(c.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-700 font-bold text-sm">{fmt(c.totalRecovered || 0)}</p>
                            <p className="text-gray-400 text-xs">recuperado</p>
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
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-gray-900 font-semibold">Parceiros</h3>
                  <Link href="/admin/parceiros" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Gerenciar Parceiros
                  </Link>
                </div>
                {data.recentPartners.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum parceiro cadastrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          <th className="px-6 py-3">Parceiro</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Comissão</th>
                          <th className="px-6 py-3">Viabilidades</th>
                          <th className="px-6 py-3">Contratos</th>
                          <th className="px-6 py-3">Convites</th>
                          <th className="px-6 py-3">Desde</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.recentPartners.map((p: any) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-gray-900 font-medium text-sm">{p.name}</p>
                              <p className="text-gray-400 text-xs">{p.company || p.email}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                                {statusLabel(p.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{p.commissionPercent}%</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p._count?.viabilityAnalyses || 0}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p._count?.contracts || 0}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p._count?.invites || 0}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
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
            <h3 className="text-gray-900 font-semibold mb-4">Ações Rápidas</h3>
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
                  indigo: 'hover:border-indigo-300 hover:bg-indigo-50 text-indigo-600',
                  cyan: 'hover:border-cyan-300 hover:bg-cyan-50 text-cyan-600',
                  purple: 'hover:border-purple-300 hover:bg-purple-50 text-purple-600',
                  green: 'hover:border-green-300 hover:bg-green-50 text-green-600',
                  blue: 'hover:border-blue-300 hover:bg-blue-50 text-blue-600',
                  emerald: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-600',
                };
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`bg-white border border-gray-200 rounded-xl p-4 transition-all shadow-sm ${colorMap[action.color] || ''} group`}
                  >
                    <svg className="w-6 h-6 mb-2 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                    <p className="text-gray-900 font-medium text-sm">{action.label}</p>
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
