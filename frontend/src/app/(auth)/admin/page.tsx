'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', adminPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'register' ? '/api/admin/register' : '/api/admin/login';
      const body = mode === 'register'
        ? { name: form.name, email: form.email, password: form.password, adminPassword: form.adminPassword }
        : { email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao processar');
        return;
      }

      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      localStorage.setItem('role', 'admin');
      router.push('/admin/dashboard');
    } catch (err) {
      setError('Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin TaxCredit</h1>
          <p className="text-gray-400 mt-1">Painel administrativo</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Primeiro Acesso
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                required
              />
            </div>
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Senha Master (Admin)</label>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={e => setForm(p => ({ ...p, adminPassword: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Senha de administrador TaxCredit"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">A mesma senha usada para autorizar negociacoes</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Processando...' : mode === 'register' ? 'Criar Conta Admin' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
