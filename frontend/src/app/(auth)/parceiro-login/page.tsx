'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/partner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      localStorage.setItem('token', data.data.token);
      localStorage.setItem('userRole', 'partner');
      localStorage.setItem('partnerName', data.data.name);
      router.push('/parceiro');
    } catch (err: any) {
      setError('Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Tax Credit</h1>
              <p className="text-indigo-200 text-sm">Portal do Parceiro</p>
            </div>
          </div>

          <h2 className="text-white text-4xl font-bold leading-tight mb-6">
            Area exclusiva para parceiros
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Analise viabilidade, gere convites para clientes e acompanhe seus contratos e comissoes.
          </p>
        </div>

        <div className="space-y-4 text-indigo-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            <span>Analise de viabilidade com IA</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            <span>Comissao de 40% sobre creditos recuperados</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            <span>Contratos digitais automaticos</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            <span>R$ 800 por cliente (o cliente paga a taxa)</span>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso do Parceiro</h2>
          <p className="text-gray-500 mb-8">Entre com suas credenciais</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="seu@escritorio.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Sua senha" required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-500">
              Nao tem conta? <Link href="/parceiro-cadastro" className="text-indigo-600 font-medium hover:underline">Cadastre-se como parceiro</Link>
            </p>
            <p className="text-sm text-gray-500">
              E cliente? <Link href="/login" className="text-brand-600 font-medium hover:underline">Acesse aqui</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
