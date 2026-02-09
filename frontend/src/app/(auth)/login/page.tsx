'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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
      // Simulated login - later connect to real auth endpoint
      if (email && password) {
        const token = btoa(JSON.stringify({ email, userId: '1', name: 'Usuario' }));
        localStorage.setItem('token', token);
        router.push('/dashboard');
      } else {
        setError('Preencha todos os campos');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Tax Credit</h1>
              <p className="text-brand-200 text-sm">Enterprise</p>
            </div>
          </div>
          
          <h2 className="text-white text-4xl font-bold leading-tight mb-6">
            Recuperacao de Creditos Tributarios com IA
          </h2>
          <p className="text-brand-200 text-lg leading-relaxed">
            Analise automatizada de DREs, Balancos e Balancetes. 
            Identificacao inteligente de oportunidades de credito 
            com Claude AI.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-brand-200">
            <svg className="w-5 h-5 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Ate 200 documentos por lote</span>
          </div>
          <div className="flex items-center gap-3 text-brand-200">
            <svg className="w-5 h-5 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Geracao automatica de documentos</span>
          </div>
          <div className="flex items-center gap-3 text-brand-200">
            <svg className="w-5 h-5 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Preparacao para e-CAC e PER/DCOMP</span>
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="font-bold text-gray-900">Tax Credit Enterprise</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h2>
          <p className="text-gray-500 mb-8">Acesse sua conta para continuar</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Sua senha"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Versao Enterprise v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
