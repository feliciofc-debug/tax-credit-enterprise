'use client';

import { useState } from 'react';

export default function ViabilidadePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    companyName: '', cnpj: '', regime: '', sector: '', annualRevenue: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) return;
    setLoading(true);
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
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert(data.error || 'Erro na analise');
      }
    } catch (error) {
      alert('Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const getScoreConfig = (score: number) => {
    if (score >= 85) return { label: 'EXCELENTE', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', ring: 'ring-green-500', bar: 'bg-green-500' };
    if (score >= 70) return { label: 'BOM', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-500', bar: 'bg-blue-500' };
    if (score >= 50) return { label: 'MEDIO', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', ring: 'ring-yellow-500', bar: 'bg-yellow-500' };
    return { label: 'BAIXO', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', ring: 'ring-red-500', bar: 'bg-red-500' };
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analise de Viabilidade</h1>
        <p className="text-gray-500 text-sm mt-1">Avalie o potencial de recuperacao antes de abordar o cliente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <form onSubmit={handleAnalyze} className="card p-6 space-y-5">
            <h3 className="font-semibold text-gray-900">Dados da Empresa</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa *</label>
              <input name="companyName" value={form.companyName} onChange={handleChange} className="input" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input name="cnpj" value={form.cnpj} onChange={handleChange} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributario</label>
                <select name="regime" value={form.regime} onChange={handleChange} className="input">
                  <option value="">Selecione</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="simples">Simples Nacional</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                <input name="sector" value={form.sector} onChange={handleChange} className="input" placeholder="Ex: Industria, Comercio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Faturamento Anual (R$)</label>
                <input name="annualRevenue" type="number" value={form.annualRevenue} onChange={handleChange} className="input" placeholder="10000000" />
              </div>
            </div>

            {/* Upload docs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Documentos (opcional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.txt,.zip"
                onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                className="input text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">PDF, Excel, SPED (.txt) ou ZIP com toda documentacao</p>
            </div>

            <button
              type="submit"
              disabled={loading || !form.companyName}
              className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Analisando com IA...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  Analisar Viabilidade
                </>
              )}
            </button>
          </form>
        </div>

        {/* Result */}
        <div>
          {!result && !loading && (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <p className="text-gray-500 font-medium">Preencha os dados e clique em analisar</p>
              <p className="text-gray-400 text-sm mt-1">O score aparecera aqui</p>
            </div>
          )}

          {loading && (
            <div className="card p-12 text-center">
              <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-indigo-600 font-semibold">Analisando com IA...</p>
              <p className="text-gray-400 text-sm mt-1">Isso pode levar alguns segundos</p>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              {/* Score principal */}
              {(() => {
                const config = getScoreConfig(result.score);
                return (
                  <div className={`card p-6 ${config.bg} border ${config.border}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600 uppercase">Score de Viabilidade</p>
                        <p className={`text-5xl font-extrabold ${config.color}`}>{result.score}</p>
                        <p className={`text-sm font-bold ${config.color} mt-1`}>{config.label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Credito Estimado</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {result.estimatedCredit ? `R$ ${result.estimatedCredit.toLocaleString('pt-BR')}` : 'Após consulta completa'}
                        </p>
                      </div>
                    </div>
                    {/* Barra */}
                    <div className="w-full h-3 bg-white rounded-full">
                      <div className={`h-full rounded-full ${config.bar} transition-all duration-1000`} style={{ width: `${result.score}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Resumo */}
              <div className="card p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Parecer da IA</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{result.summary}</p>
              </div>

              {/* Oportunidades */}
              {result.opportunities && result.opportunities.length > 0 && (
                <div className="card p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Oportunidades Identificadas</h4>
                  <div className="space-y-3">
                    {result.opportunities.map((opp: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{opp.tipo}</p>
                          <p className="text-sm text-gray-500">{opp.estimativa}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          opp.probabilidade >= 80 ? 'bg-green-100 text-green-700' : 
                          opp.probabilidade >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {opp.probabilidade}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Riscos */}
              {result.risks && result.risks.length > 0 && (
                <div className="card p-6 bg-red-50 border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-2">Riscos</h4>
                  <ul className="space-y-1">
                    {result.risks.map((risk: string, i: number) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="mt-1 text-red-400">!</span> {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Modelo de receita */}
              <div className="card p-6">
                <h4 className="font-semibold text-gray-900 mb-3">Modelo de Receita</h4>
                
                {/* Taxa de adesao */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                  <p className="text-sm text-gray-800 font-semibold mb-2">Taxa de Adesao: R$ 2.000,00 (paga pelo cliente)</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white rounded p-2 text-center">
                      <p className="text-xs text-gray-500">Voce recebe</p>
                      <p className="font-bold text-green-600">R$ 800,00</p>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <p className="text-xs text-gray-500">Plataforma recebe</p>
                      <p className="font-bold text-indigo-600">R$ 1.200,00</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">O cliente paga a taxa e recebe: consulta completa com IA + formalizacao de todo o processo.</p>
                </div>

                {/* Split de creditos */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-3">
                  <p className="text-sm text-indigo-800">
                    <strong>Creditos recuperados: 40% parceiro / 60% plataforma</strong> (padrao)
                  </p>
                  <p className="text-sm text-indigo-700 mt-1">
                    Quanto maior o credito recuperado, maior seu retorno.
                  </p>
                </div>

                {/* Regra de negociacao */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                  <p className="text-sm text-green-800">
                    <strong>40% padrao:</strong> Aprovado automaticamente, sem necessidade de autorizacao.
                  </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Negociacao diferente:</strong> Qualquer alteracao no percentual requer senha do administrador TaxCredit.
                  </p>
                </div>
              </div>

              {/* Acoes */}
              {result.score >= 70 && (
                <div className="card p-6 bg-green-50 border border-green-200 text-center">
                  <p className="text-green-800 font-semibold mb-3">Score aprovado! Gere um convite para o cliente.</p>
                  <a href="/parceiro/convites" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors">
                    Gerar Convite para Cliente
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
