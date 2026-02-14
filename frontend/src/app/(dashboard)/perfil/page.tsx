'use client';

import { useState, useEffect } from 'react';

export default function ClientProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    // Empresa
    company: '', cnpj: '', regime: '',
    endereco: '', cidade: '', estado: '', cep: '',
    // Representante Legal
    legalRepName: '', legalRepCpf: '', legalRepRg: '',
    legalRepCargo: '', legalRepEmail: '', legalRepPhone: '',
    // Dados Bancários
    bankName: '', bankAgency: '', bankAccount: '',
    bankAccountType: 'corrente', bankPixKey: '',
    bankAccountHolder: '', bankCpfCnpj: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setForm(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(prev)) {
            if (data.data[key] !== null && data.data[key] !== undefined) {
              (updated as any)[key] = data.data[key];
            }
          }
          return updated;
        });
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Dados salvos com sucesso!');
      } else {
        setError(data.error || 'Erro ao salvar');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Meu Perfil</h1>
              <p className="text-gray-500 text-xs">Dados para o contrato</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/dashboard" className="px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">Documentos</a>
            <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Dados da Empresa */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                <input value={form.company} onChange={e => updateField('company', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
                <input value={form.cnpj} onChange={e => updateField('cnpj', e.target.value)} className="input" placeholder="00.000.000/0000-00" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributário</label>
                <select value={form.regime} onChange={e => updateField('regime', e.target.value)} className="input">
                  <option value="">Selecione...</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="simples">Simples Nacional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <input value={form.cep} onChange={e => updateField('cep', e.target.value)} className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input value={form.endereco} onChange={e => updateField('endereco', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input value={form.cidade} onChange={e => updateField('cidade', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF)</label>
                <input value={form.estado} onChange={e => updateField('estado', e.target.value)} className="input" maxLength={2} placeholder="SP" />
              </div>
            </div>
          </div>

          {/* Representante Legal */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Representante Legal</h2>
            <p className="text-sm text-gray-500 mb-4">Dados do responsável pela assinatura do contrato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input value={form.legalRepName} onChange={e => updateField('legalRepName', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input value={form.legalRepCpf} onChange={e => updateField('legalRepCpf', e.target.value)} className="input" placeholder="000.000.000-00" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                <input value={form.legalRepRg} onChange={e => updateField('legalRepRg', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <input value={form.legalRepCargo} onChange={e => updateField('legalRepCargo', e.target.value)} className="input" placeholder="Ex: Sócio-Administrador" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.legalRepEmail} onChange={e => updateField('legalRepEmail', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input value={form.legalRepPhone} onChange={e => updateField('legalRepPhone', e.target.value)} className="input" placeholder="(11) 99999-0000" />
              </div>
            </div>
          </div>

          {/* Dados Bancários */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Dados Bancários</h2>
            <p className="text-sm text-gray-500 mb-4">Conta para recebimento de valores recuperados</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                <input value={form.bankName} onChange={e => updateField('bankName', e.target.value)} className="input" placeholder="Ex: Banco do Brasil, Itaú" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                <input value={form.bankAgency} onChange={e => updateField('bankAgency', e.target.value)} className="input" placeholder="0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conta *</label>
                <input value={form.bankAccount} onChange={e => updateField('bankAccount', e.target.value)} className="input" placeholder="00000-0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.bankAccountType} onChange={e => updateField('bankAccountType', e.target.value)} className="input">
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
                <input value={form.bankPixKey} onChange={e => updateField('bankPixKey', e.target.value)} className="input" placeholder="CPF, email, telefone ou chave aleatória" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titular da Conta</label>
                <input value={form.bankAccountHolder} onChange={e => updateField('bankAccountHolder', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ do Titular</label>
                <input value={form.bankCpfCnpj} onChange={e => updateField('bankCpfCnpj', e.target.value)} className="input" />
              </div>
            </div>
          </div>

          {/* Aviso de responsabilidade */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800 font-medium mb-1">Importante</p>
            <p className="text-xs text-yellow-700">
              É de inteira responsabilidade do cliente verificar os dados bancários e informações inseridas. 
              Em caso de erro em transferências ou depósitos para contas informadas neste cadastro, 
              a responsabilidade é 100% do contratante (cliente). Certifique-se de que todos os dados estão corretos antes de salvar.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Dados'}
          </button>
        </form>
      </main>
    </div>
  );
}
