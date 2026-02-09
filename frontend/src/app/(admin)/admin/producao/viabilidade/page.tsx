'use client';

import { useState, useEffect } from 'react';

interface ViabilityResult {
  id: string;
  companyName: string;
  score: number;
  scoreLabel: string;
  estimatedCredit: number;
  opportunities: any[];
  summary: string;
  risks: string[];
  aiPowered?: boolean;
}

interface ViabilityListItem {
  id: string;
  companyName: string;
  cnpj: string;
  viabilityScore: number;
  scoreLabel: string;
  estimatedCredit: number;
  status: string;
  createdAt: string;
}

export default function AdminViabilidadePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ViabilityResult | null>(null);
  const [history, setHistory] = useState<ViabilityListItem[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    cnpj: '',
    regime: '',
    sector: '',
    annualRevenue: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/viability/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      setError('Nome da empresa e obrigatorio');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('companyName', form.companyName);
      if (form.cnpj) formData.append('cnpj', form.cnpj);
      if (form.regime) formData.append('regime', form.regime);
      if (form.sector) formData.append('sector', form.sector);
      if (form.annualRevenue) formData.append('annualRevenue', form.annualRevenue);
      files.forEach(f => formData.append('documents', f));

      const res = await fetch('/api/viability/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        fetchHistory();
      } else {
        setError(data.error || 'Erro na analise');
      }
    } catch {
      setError('Erro de conexao');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const scoreColor = (label: string) => {
    switch (label) {
      case 'excelente': return 'text-green-400 bg-green-900/30';
      case 'bom': return 'text-blue-400 bg-blue-900/30';
      case 'medio': return 'text-yellow-400 bg-yellow-900/30';
      case 'baixo': return 'text-orange-400 bg-orange-900/30';
      default: return 'text-red-400 bg-red-900/30';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analise de Viabilidade</h1>
        <p className="text-gray-500 mt-1">Analise o potencial de recuperacao de creditos com IA</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold mb-2">Nova Analise</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Empresa *</label>
              <input
                value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">CNPJ</label>
              <input
                value={form.cnpj}
                onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Regime Tributario</label>
              <select
                value={form.regime}
                onChange={e => setForm(p => ({ ...p, regime: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="lucro_real">Lucro Real</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="simples">Simples Nacional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Setor</label>
              <input
                value={form.sector}
                onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ex: Comercio, Industria..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Faturamento Anual (R$)</label>
              <input
                type="number"
                value={form.annualRevenue}
                onChange={e => setForm(p => ({ ...p, annualRevenue: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="5000000"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Documentos (PDF)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={e => setFiles(Array.from(e.target.files || []))}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              {files.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{files.length} arquivo(s) selecionado(s)</p>
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Analisando com IA...' : 'Analisar Viabilidade'}
            </button>
          </form>
        </div>

        {/* Result + History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Result */}
          {result && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Resultado: {result.companyName}</h3>
                {result.aiPowered && (
                  <span className="text-xs bg-purple-900/40 text-purple-400 px-2 py-1 rounded-full">IA Claude</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${scoreColor(result.scoreLabel)} inline-block px-4 py-2 rounded-xl`}>
                    {result.score}
                  </div>
                  <p className="text-gray-500 text-xs mt-1 capitalize">{result.scoreLabel}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(result.estimatedCredit)}</p>
                  <p className="text-gray-500 text-xs">Credito Estimado</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{result.opportunities.length}</p>
                  <p className="text-gray-500 text-xs">Oportunidades</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <p className="text-gray-300 text-sm">{result.summary}</p>
              </div>

              {result.opportunities.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-gray-400 text-sm font-semibold">Oportunidades:</p>
                  {result.opportunities.map((op: any, i: number) => (
                    <div key={i} className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white text-sm font-medium">{op.tipo}</p>
                        <p className="text-gray-500 text-xs">{op.estimativa}</p>
                      </div>
                      <span className="text-green-400 font-bold text-sm">{op.probabilidade}%</span>
                    </div>
                  ))}
                </div>
              )}

              {result.risks.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold mb-2">Riscos:</p>
                  {result.risks.map((r: string, i: number) => (
                    <p key={i} className="text-yellow-400 text-xs mb-1">- {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Historico de Analises</h3>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma analise realizada ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                    <div>
                      <p className="text-white text-sm font-medium">{h.companyName}</p>
                      <p className="text-gray-500 text-xs">{h.cnpj || 'Sem CNPJ'} - {new Date(h.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${scoreColor(h.scoreLabel)} px-2 py-1 rounded`}>
                        {h.viabilityScore}
                      </span>
                      <p className="text-green-400 text-xs mt-1">{formatCurrency(h.estimatedCredit || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
