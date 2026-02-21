'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl, getToken } from '@/lib/fetcher';

interface ContractStatus {
  hasActiveContract: boolean;
  bankConfirmed: boolean;
  contractStatus: string;
}

export default function OportunidadesPage() {
  const [access, setAccess] = useState<ContractStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const token = getToken();
      const base = getApiUrl();
      const res = await fetch(`${base}/api/procuration/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) { setLoading(false); return; }

      const contractRes = await fetch(`${base}/api/contract/my-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (contractRes.ok) {
        const data = await contractRes.json();
        if (data.success) {
          setAccess(data.data);
          setLoading(false);
          return;
        }
      }
      setAccess({ hasActiveContract: false, bankConfirmed: false, contractStatus: 'none' });
    } catch {
      setAccess({ hasActiveContract: false, bankConfirmed: false, contractStatus: 'none' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64"/>
        <div className="h-48 bg-gray-100 rounded-xl"/>
      </div>
    );
  }

  if (!access?.hasActiveContract || !access?.bankConfirmed) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Área Restrita</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            As oportunidades de crédito tributário serão liberadas após a conclusão do processo de formalização.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 text-left mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Etapas necessárias:</h3>
            <div className="space-y-3">
              <StepItem done={true} label="Cadastro na plataforma" />
              <StepItem done={true} label="Upload dos documentos fiscais" desc="Envie DRE, Balanço ou Balancete na aba Upload" />
              <StepItem done={access?.hasActiveContract || false} label="Assinatura do contrato" desc="Contrato assinado com firma reconhecida em cartório" />
              <StepItem done={access?.bankConfirmed || false} label="Registro no Banco Fibra" desc="Contrato registrado e operação confirmada pelo banco" />
              <StepItem done={false} label="Liberação das oportunidades" desc="Análise completa, Parecer DCOMP, Requerimento SEFAZ e Procuração" />
            </div>
          </div>

          {!access?.hasActiveContract && (
            <p className="text-sm text-gray-400">
              Entre em contato com a TaxCredit para dar andamento ao seu processo.
              <br/>WhatsApp: <a href="https://wa.me/5521967520706" className="text-blue-600 hover:underline">(21) 96752-0706</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  return <ActiveOpportunities />;
}

function StepItem({ done, label, desc }: { done: boolean; label: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${done ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
        {done ? (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
        ) : (
          <span className="w-2 h-2 bg-gray-400 rounded-full"/>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-green-700' : 'text-gray-600'}`}>{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

function ActiveOpportunities() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const token = getToken();
      const base = getApiUrl();
      const res = await fetch(`${base}/api/dashboard/my-opportunities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setOpportunities(data.data || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleGenerateDocs = async (analysisId: string, index: number, tipo: string) => {
    setDownloading(analysisId);
    try {
      const token = getToken();
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
    } catch {
      alert('Erro ao gerar documentação.');
    } finally {
      setDownloading(null);
    }
  };

  const getProbColor = (prob: number) => {
    if (prob >= 80) return { text: 'text-green-700', bg: 'bg-green-100' };
    if (prob >= 50) return { text: 'text-yellow-700', bg: 'bg-yellow-100' };
    return { text: 'text-red-700', bg: 'bg-red-100' };
  };

  if (loading) {
    return <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl"/>)}</div>;
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <p className="text-gray-500">Sua análise está sendo processada</p>
        <p className="text-sm text-gray-400 mt-1">As oportunidades aparecerão aqui assim que a análise for concluída</p>
      </div>
    );
  }

  const totalValue = opportunities.reduce((acc: number, o: any) => acc + (o.valorEstimado || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oportunidades de Crédito</h1>
          <p className="text-gray-500 text-sm mt-1">
            {opportunities.length} oportunidades identificadas — Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="card p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Valor Total</p>
            <p className="text-2xl font-bold text-brand-700">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="h-10 w-px bg-gray-200"/>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Oportunidades</p>
            <p className="text-2xl font-bold text-gray-900">{opportunities.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {opportunities.map((opp: any, index: number) => {
          const probColor = getProbColor(opp.probabilidadeRecuperacao || 0);
          return (
            <div key={opp.id || index} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{opp.tipo}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{opp.tributo}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${probColor.bg} ${probColor.text}`}>
                  {opp.probabilidadeRecuperacao}%
                </span>
              </div>
              <p className="text-3xl font-bold text-brand-700 mb-3">
                R$ {(opp.valorEstimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mb-4">Prazo: {opp.prazoRecuperacao || '3-12 meses'}</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Fundamentação Legal</p>
                <p className="text-sm text-gray-700">{opp.fundamentacaoLegal}</p>
              </div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed line-clamp-3">{opp.descricao}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateDocs(opp.analysisId, index, opp.tipo)}
                  disabled={downloading === opp.analysisId}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  {downloading === opp.analysisId ? 'Gerando...' : 'Gerar Docs'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
