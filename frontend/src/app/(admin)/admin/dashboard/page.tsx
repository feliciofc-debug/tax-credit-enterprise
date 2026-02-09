'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardData {
  users: { total: number };
  partners: { total: number; active: number };
  contracts: {
    total: number;
    active: number;
    totalRecovered: number;
    partnerEarnings: number;
    platformEarnings: number;
  };
  invites: { total: number; used: number };
  viabilities: { total: number };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const savedUser = localStorage.getItem('user');

    if (!token || role !== 'admin') {
      router.push('/admin');
      return;
    }

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    router.push('/admin');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Admin TaxCredit</h1>
              <p className="text-gray-500 text-xs">Painel Administrativo</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-gray-400 text-sm hidden sm:block">{user.name}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">
            Bem-vindo, {user?.name || 'Admin'}
          </h2>
          <p className="text-gray-500 mt-1">Visao geral da plataforma TaxCredit Enterprise</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                title="Usuarios"
                value={data.users.total}
                icon="U"
                color="blue"
                description="Total cadastrados"
              />
              <StatCard
                title="Parceiros"
                value={data.partners.total}
                icon="P"
                color="green"
                description={`${data.partners.active} ativos`}
              />
              <StatCard
                title="Contratos"
                value={data.contracts.total}
                icon="C"
                color="purple"
                description={`${data.contracts.active} ativos`}
              />
              <StatCard
                title="Analises de Viabilidade"
                value={data.viabilities.total}
                icon="V"
                color="amber"
                description="Total realizadas"
              />
            </div>

            {/* Financial Stats */}
            <h3 className="text-lg font-semibold text-white mb-4">Financeiro</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-500 text-sm mb-1">Total Recuperado</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data.contracts.totalRecovered)}
                </p>
                <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-500 text-sm mb-1">Receita Parceiros (40%)</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(data.contracts.partnerEarnings)}
                </p>
                <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-500 text-sm mb-1">Receita Plataforma (60%)</p>
                <p className="text-2xl font-bold text-indigo-400">
                  {formatCurrency(data.contracts.platformEarnings)}
                </p>
                <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            {/* Invites */}
            <h3 className="text-lg font-semibold text-white mb-4">Convites</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Convites Enviados</p>
                    <p className="text-3xl font-bold text-white mt-1">{data.invites.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-cyan-400 text-xl">E</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Convites Utilizados</p>
                    <p className="text-3xl font-bold text-white mt-1">{data.invites.used}</p>
                  </div>
                  <div className="w-12 h-12 bg-teal-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-teal-400 text-xl">U</span>
                  </div>
                </div>
                {data.invites.total > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Taxa de conversao</span>
                      <span>{((data.invites.used / data.invites.total) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${(data.invites.used / data.invites.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <h3 className="text-lg font-semibold text-white mb-4">Acoes Rapidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickAction
                label="Gerenciar Parceiros"
                description="Ver e aprovar parceiros"
                href="/admin/parceiros"
                color="green"
              />
              <QuickAction
                label="Ver Contratos"
                description="Todos os contratos ativos"
                href="/admin/contratos"
                color="purple"
              />
              <QuickAction
                label="Analises"
                description="Viabilidade e creditos"
                href="/admin/analises"
                color="amber"
              />
              <QuickAction
                label="Configuracoes"
                description="Ajustes da plataforma"
                href="/admin/config"
                color="red"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title, value, icon, color, description,
}: {
  title: string; value: number; icon: string; color: string; description: string;
}) {
  const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'border-blue-800/50', text: 'text-blue-400', iconBg: 'bg-blue-600/20' },
    green: { bg: 'border-green-800/50', text: 'text-green-400', iconBg: 'bg-green-600/20' },
    purple: { bg: 'border-purple-800/50', text: 'text-purple-400', iconBg: 'bg-purple-600/20' },
    amber: { bg: 'border-amber-800/50', text: 'text-amber-400', iconBg: 'bg-amber-600/20' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-gray-900 border border-gray-800 ${c.bg} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-500 text-sm">{title}</p>
        <div className={`w-10 h-10 ${c.iconBg} rounded-lg flex items-center justify-center`}>
          <span className={`${c.text} font-bold`}>{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function QuickAction({
  label, description, href, color,
}: {
  label: string; description: string; href: string; color: string;
}) {
  const colors: Record<string, string> = {
    green: 'hover:border-green-700 hover:bg-green-900/20',
    purple: 'hover:border-purple-700 hover:bg-purple-900/20',
    amber: 'hover:border-amber-700 hover:bg-amber-900/20',
    red: 'hover:border-red-700 hover:bg-red-900/20',
  };

  return (
    <a
      href={href}
      className={`bg-gray-900 border border-gray-800 rounded-xl p-5 transition-all cursor-pointer ${colors[color] || ''}`}
    >
      <p className="text-white font-semibold text-sm">{label}</p>
      <p className="text-gray-500 text-xs mt-1">{description}</p>
    </a>
  );
}
