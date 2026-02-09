'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PartnerRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    oabNumber: '', oabState: '', company: '', cnpj: '', phone: '',
  });

  const states = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Senhas nao conferem');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
      setError('Erro de conexao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="font-bold text-gray-900">Tax Credit <span className="text-indigo-600">Parceiros</span></span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastro de Parceiro</h1>
          <p className="text-gray-500 mt-1">Advogados tributaristas e escritorios</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          {/* Dados pessoais */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input name="name" value={form.name} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="input" placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>

          {/* OAB */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Registro OAB</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero OAB</label>
                <input name="oabNumber" value={form.oabNumber} onChange={handleChange} className="input" placeholder="123456" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UF da OAB</label>
                <select name="oabState" value={form.oabState} onChange={handleChange} className="input">
                  <option value="">Selecione</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Escritorio */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Escritorio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do escritorio</label>
                <input name="company" value={form.company} onChange={handleChange} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ do escritorio</label>
                <input name="cnpj" value={form.cnpj} onChange={handleChange} className="input" placeholder="00.000.000/0000-00" />
              </div>
            </div>
          </div>

          {/* Senha */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Seguranca</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} className="input" required minLength={6} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha *</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} className="input" required />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Cadastrando...' : 'Criar Conta de Parceiro'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Ja tem conta? <Link href="/parceiro-login" className="text-indigo-600 font-medium hover:underline">Fazer login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
