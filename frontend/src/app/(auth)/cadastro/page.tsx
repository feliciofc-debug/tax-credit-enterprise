'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ClientRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('code') || '';

  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [codeInput, setCodeInput] = useState(inviteCode);
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
  });

  // Validar código ao carregar se veio pela URL
  useEffect(() => {
    if (inviteCode) {
      validateCode(inviteCode);
    }
  }, [inviteCode]);

  const validateCode = async (code: string) => {
    setValidatingCode(true);
    setError('');
    try {
      const res = await fetch(`/api/invite/validate/${code}`);
      const data = await res.json();
      if (data.success) {
        setInviteInfo(data.data);
        setCodeInput(code);
      } else {
        setError(data.error);
        setInviteInfo(null);
      }
    } catch {
      setError('Erro ao validar código');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Senhas não conferem');
      return;
    }
    if (!inviteInfo) {
      setError('Código de convite inválido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simulação de cadastro - conectar com backend real
      const token = btoa(JSON.stringify({
        email: form.email,
        userId: crypto.randomUUID(),
        name: form.name,
        inviteCode: codeInput,
      }));
      localStorage.setItem('token', token);
      localStorage.setItem('userRole', 'client');
      router.push('/onboarding');
    } catch (err: any) {
      setError('Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="font-bold text-gray-900">Tax Credit Enterprise</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastro do Cliente</h1>
          <p className="text-gray-500 mt-1">Use o código recebido do seu parceiro</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="card p-8 space-y-6">
          {/* Código de convite */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de Acesso *</label>
            <div className="flex gap-3">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="input flex-1 font-mono text-lg tracking-wider"
                placeholder="TC-XXXXXXXX"
                required
              />
              <button
                type="button"
                onClick={() => validateCode(codeInput)}
                disabled={validatingCode || !codeInput}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {validatingCode ? '...' : 'Validar'}
              </button>
            </div>
          </div>

          {/* Info do convite */}
          {inviteInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">Convite válido!</p>
              <div className="space-y-1 text-sm text-green-800">
                <p><strong>Empresa:</strong> {inviteInfo.companyName}</p>
                {inviteInfo.cnpj && <p><strong>CNPJ:</strong> {inviteInfo.cnpj}</p>}
                <p><strong>Parceiro:</strong> {inviteInfo.partnerName} {inviteInfo.partnerCompany ? `- ${inviteInfo.partnerCompany}` : ''}</p>
                {inviteInfo.partnerOab && <p><strong>OAB:</strong> {inviteInfo.partnerOab}</p>}
              </div>
            </div>
          )}

          {/* Form de cadastro */}
          {inviteInfo && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" placeholder="(00) 00000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input" required minLength={6} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar *</label>
                  <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} className="input" required />
                </div>
              </div>

              {/* Info da taxa */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-800 font-semibold">Taxa de Adesão: R$ 2.000,00</p>
                <p className="text-xs text-indigo-700 mt-1">
                  Ao efetuar o pagamento da taxa, você libera:
                </p>
                <ul className="text-xs text-indigo-700 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Consulta completa com Inteligência Artificial</li>
                  <li>Formalização de todo o processo tributário</li>
                  <li>Acompanhamento jurídico pelo escritório parceiro</li>
                </ul>
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  Recupere créditos tributários com apoio de IA e assessoria jurídica completa.
                </p>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 btn-primary">
                {loading ? 'Cadastrando...' : 'Criar Conta e Continuar'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500">
            Já tem conta? <Link href="/login" className="text-brand-600 font-medium hover:underline">Fazer login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Carregando...</p></div>}>
      <ClientRegisterContent />
    </Suspense>
  );
}
