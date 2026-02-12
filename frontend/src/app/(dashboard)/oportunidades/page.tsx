'use client';

import { useState } from 'react';

const demoOpportunities = [
  {
    id: '1',
    analysisId: 'a1',
    tipo: 'PIS/COFINS sobre Insumos',
    valorEstimado: 450000,
    probabilidadeRecuperacao: 85,
    fundamentacaoLegal: 'Lei 10.833/2003, art. 3o - Créditos sobre insumos',
    descricao: 'Crédito de PIS/COFINS sobre aquisição de insumos utilizados na produção de bens e serviços',
    prazoRecuperacao: '3-6 meses',
    empresa: 'Empresa ABC Ltda',
    periodo: '2024-Q1',
  },
  {
    id: '2',
    analysisId: 'a2',
    tipo: 'ICMS-ST Retido Indevidamente',
    valorEstimado: 280000,
    probabilidadeRecuperacao: 72,
    fundamentacaoLegal: 'Art. 150, §7o CF - Restituição de ICMS-ST',
    descricao: 'ICMS-ST retido a maior em operações interestaduais com base de cálculo presumida superior ao valor real',
    prazoRecuperacao: '6-12 meses',
    empresa: 'Empresa ABC Ltda',
    periodo: '2024-Q1',
  },
  {
    id: '3',
    analysisId: 'a3',
    tipo: 'IRPJ - Exclusão ICMS da Base PIS/COFINS',
    valorEstimado: 620000,
    probabilidadeRecuperacao: 95,
    fundamentacaoLegal: 'RE 574.706/PR (STF) - Tese do Século',
    descricao: 'Exclusão do ICMS da base de cálculo do PIS e da COFINS conforme decisão do STF',
    prazoRecuperacao: '2-4 meses',
    empresa: 'Empresa XYZ S.A.',
    periodo: '2023',
  },
  {
    id: '4',
    analysisId: 'a4',
    tipo: 'COFINS - Crédito Energia Elétrica',
    valorEstimado: 95000,
    probabilidadeRecuperacao: 68,
    fundamentacaoLegal: 'Lei 10.833/2003, art. 3o, III',
    descricao: 'Crédito de COFINS sobre despesas com energia elétrica consumida nos estabelecimentos',
    prazoRecuperacao: '3-6 meses',
    empresa: 'Empresa ABC Ltda',
    periodo: '2024-01',
  },
];

export default function OportunidadesPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const handleGenerateDocs = async (analysisId: string, index: number, tipo: string) => {
    setDownloading(analysisId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tax-credit/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ analysisId, opportunityIndex: index }),
      });

      if (!res.ok) throw new Error('Erro ao gerar');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentacao-${tipo.replace(/\//g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao gerar documentação. Verifique se o backend está rodando.');
    } finally {
      setDownloading(null);
    }
  };

  const getProbColor = (prob: number) => {
    if (prob >= 80) return { text: 'text-green-700', bg: 'bg-green-100' };
    if (prob >= 50) return { text: 'text-yellow-700', bg: 'bg-yellow-100' };
    return { text: 'text-red-700', bg: 'bg-red-100' };
  };

  const totalValue = demoOpportunities.reduce((acc, o) => acc + o.valorEstimado, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oportunidades de Crédito</h1>
          <p className="text-gray-500 text-sm mt-1">
            {demoOpportunities.length} oportunidades identificadas - Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">Todos os tipos</option>
          <option value="PIS">PIS/COFINS</option>
          <option value="ICMS">ICMS</option>
          <option value="IRPJ">IRPJ/CSLL</option>
        </select>
      </div>

      {/* Summary bar */}
      <div className="card p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Valor Total</p>
            <p className="text-2xl font-bold text-brand-700">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Oportunidades</p>
            <p className="text-2xl font-bold text-gray-900">{demoOpportunities.length}</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Média Probabilidade</p>
            <p className="text-2xl font-bold text-green-600">
              {Math.round(demoOpportunities.reduce((a, o) => a + o.probabilidadeRecuperacao, 0) / demoOpportunities.length)}%
            </p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {demoOpportunities
          .filter(o => filter === 'all' || o.tipo.includes(filter))
          .map((opp, index) => {
          const probColor = getProbColor(opp.probabilidadeRecuperacao);
          return (
            <div key={opp.id} className="card p-6 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{opp.tipo}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{opp.empresa} - {opp.periodo}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${probColor.bg} ${probColor.text}`}>
                  {opp.probabilidadeRecuperacao}%
                </span>
              </div>

              {/* Value */}
              <p className="text-3xl font-bold text-brand-700 mb-3">
                R$ {opp.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>

              <p className="text-sm text-gray-500 mb-4">Prazo: {opp.prazoRecuperacao}</p>

              {/* Legal basis */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Fundamentação Legal</p>
                <p className="text-sm text-gray-700">{opp.fundamentacaoLegal}</p>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">{opp.descricao}</p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateDocs(opp.analysisId, index, opp.tipo)}
                  disabled={downloading === opp.analysisId}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  {downloading === opp.analysisId ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Gerando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Gerar Docs
                    </>
                  )}
                </button>
                <button className="btn-secondary text-sm">
                  Detalhes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
