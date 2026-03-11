'use client';

import { useState, useRef, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher } from '@/lib/fetcher';

const fmt = (v?: number | null) => {
  if (v == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

type ViewMode = 'dashboard' | 'upload' | 'result';

interface AnalysisResult {
  analysisId: string;
  totalNfes: number;
  totalItens: number;
  itensMonofasicos: number;
  itensIcmsSt: number;
  totalRecuperavel: number;
  totalMonofasicoPis: number;
  totalMonofasicoCofins: number;
  totalIcmsSt: number;
  porGrupo: Record<string, { monofasico: number; icmsSt: number; total: number; itens: number }>;
  porCompetencia: Record<string, { monofasico: number; icmsSt: number; total: number }>;
  faixaSimples: { ate: number; aliquota: number; pis: number; cofins: number; icms: number } | null;
}

interface DashData {
  totalAnalises: number;
  totalRecuperavel: number;
  totalMonofasico: number;
  totalIcmsSt: number;
  totalNfes: number;
  empresas: Array<{
    id: string;
    cnpj: string;
    nome: string;
    recuperavel: number;
    monofasico: number;
    icmsSt: number;
    nfes: number;
    data: string;
  }>;
}

export default function SimplesPage() {
  const { data: dashResp, isLoading } = useSWR<{ success: boolean; data: DashData }>(
    '/api/simples/dashboard',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const [view, setView] = useState<ViewMode>('dashboard');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cnpj, setCnpj] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [faturamento, setFaturamento] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const dash = dashResp?.data;
  const hasData = (dash?.totalAnalises ?? 0) > 0;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.zip')
    );
    if (files.length) setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const handleAnalyze = async () => {
    if (!selectedFiles.length || !cnpj.trim()) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('cnpj', cnpj.replace(/\D/g, ''));
      fd.append('companyName', companyName || 'Empresa');
      if (faturamento) fd.append('faturamento12m', faturamento.replace(/\D/g, ''));
      selectedFiles.forEach(f => fd.append('files', f));

      const token = localStorage.getItem('token');
      const res = await fetch('/api/simples/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setView('result');
      mutate('/api/simples/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Simples Recovery</h1>
              <p className="text-gray-500 text-sm">Recuperação de PIS/COFINS monofásico e ICMS-ST para empresas do Simples Nacional</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'dashboard' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Dashboard
            </button>
            <button onClick={() => setView('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'upload' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Nova Análise
            </button>
            {result && (
              <button onClick={() => setView('result')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'result' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                Resultado
              </button>
            )}
          </div>
        </div>
      </div>

      {view === 'upload' && (
        <div>
          {/* How It Works */}
          <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 border border-violet-200 rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Como funciona a recuperação do Simples Nacional?</h2>
            <p className="text-gray-600 mb-8">Empresas do Simples pagam PIS/COFINS e ICMS no DAS sobre produtos que já tiveram esses impostos recolhidos na indústria.</p>

            <div className="grid md:grid-cols-4 gap-5">
              <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-violet-100">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-violet-700 font-black text-lg">1</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Fábrica paga PIS/COFINS</h3>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Produtos monofásicos (bebidas, remédios, cosméticos, autopeças, combustíveis) têm PIS/COFINS concentrado na indústria.
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-violet-100">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-violet-700 font-black text-lg">2</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Simples paga de novo no DAS</h3>
                <p className="text-gray-600 text-xs leading-relaxed">
                  O DAS inclui PIS/COFINS sobre TODA a receita, inclusive produtos que já tiveram imposto pago. Isso é pagamento indevido.
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-violet-100">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-violet-700 font-black text-lg">3</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Upload das NFes</h3>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Envie os XMLs das NFes de venda. O sistema identifica automaticamente cada produto monofásico pelo NCM e calcula o valor pago a mais.
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-violet-100">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-violet-700 font-black text-lg">4</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Recuperação via PER/DCOMP</h3>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Valor recuperável dos últimos 5 anos. Retificação do PGDAS-D + PER/DCOMP para compensar ou restituir.
                </p>
              </div>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="bg-white/60 rounded-xl p-4 border border-violet-100">
                <h4 className="text-sm font-bold text-violet-800 mb-2">Produtos monofásicos que analisamos</h4>
                <div className="flex flex-wrap gap-2">
                  {['Bebidas', 'Farmacêuticos', 'Cosméticos', 'Combustíveis', 'Autopeças', 'Veículos', 'Máquinas'].map(g => (
                    <span key={g} className="px-2.5 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg">{g}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-violet-100">
                <h4 className="text-sm font-bold text-violet-800 mb-2">Base legal</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>Lei 10.147/2000 — PIS/COFINS monofásico</li>
                  <li>LC 123/2006, Art. 18, §4º-A — Segregação no Simples</li>
                  <li>ADI RFB 15/2007 — Receitas monofásicas excluídas do DAS</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upload Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Dados da empresa e NFes</h2>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ da empresa</label>
                <input type="text" value={formatCnpj(cnpj)} onChange={e => setCnpj(e.target.value.replace(/\D/g, ''))}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="Razão social"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Faturamento 12 meses (R$)</label>
                <input type="text" value={faturamento} onChange={e => setFaturamento(e.target.value)}
                  placeholder="Ex: 1800000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">Determina a faixa do Simples e alíquotas</p>
              </div>
            </div>

            {/* Drag & Drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50/30'
              }`}
            >
              <input ref={fileRef} type="file" multiple accept=".xml,.zip" className="hidden" onChange={handleFileSelect} />
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">Arraste os XMLs das NFes aqui</p>
              <p className="text-sm text-gray-500 mb-3">ou clique para selecionar. Aceita ZIP com múltiplos XMLs</p>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                <span className="bg-gray-100 px-2 py-1 rounded">.xml (NFe)</span>
                <span className="bg-gray-100 px-2 py-1 rounded">.zip (múltiplos XMLs)</span>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">{selectedFiles.length} arquivo(s)</p>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-gray-400">Análise leva menos de 30 segundos por lote.</p>
              <button onClick={handleAnalyze} disabled={uploading || !selectedFiles.length || !cnpj.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all shadow-lg shadow-violet-200"
              >
                {uploading ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analisando NFes...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg> Analisar {selectedFiles.length} arquivo{selectedFiles.length > 1 ? 's' : ''}</>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'result' && result && (
        <div>
          {/* Result Summary */}
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-8 mb-8 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Resultado da Análise</h2>
                <p className="text-violet-200 mt-1">{result.totalNfes} NFes analisadas | {result.totalItens} itens processados</p>
              </div>
              <div className="text-right">
                <p className="text-violet-200 text-sm">Total Recuperável</p>
                <p className="text-4xl font-black">{fmt(result.totalRecuperavel)}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-violet-200 text-xs uppercase tracking-wide">PIS Monofásico</p>
                <p className="text-2xl font-bold mt-1">{fmt(result.totalMonofasicoPis)}</p>
                <p className="text-violet-300 text-xs mt-1">{result.itensMonofasicos} itens monofásicos</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-violet-200 text-xs uppercase tracking-wide">COFINS Monofásico</p>
                <p className="text-2xl font-bold mt-1">{fmt(result.totalMonofasicoCofins)}</p>
                <p className="text-violet-300 text-xs mt-1">Lei 10.147/2000</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-violet-200 text-xs uppercase tracking-wide">ICMS-ST no DAS</p>
                <p className="text-2xl font-bold mt-1">{fmt(result.totalIcmsSt)}</p>
                <p className="text-violet-300 text-xs mt-1">{result.itensIcmsSt} itens com ST</p>
              </div>
            </div>

            {result.faixaSimples && (
              <div className="mt-4 bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-violet-200 text-xs uppercase tracking-wide mb-2">Faixa do Simples Nacional (Anexo I)</p>
                <div className="flex items-center gap-6 text-sm">
                  <span>Alíquota: <strong>{pct(result.faixaSimples.aliquota)}</strong></span>
                  <span>PIS no DAS: <strong>{pct(result.faixaSimples.pis)}</strong></span>
                  <span>COFINS no DAS: <strong>{pct(result.faixaSimples.cofins)}</strong></span>
                  <span>ICMS no DAS: <strong>{pct(result.faixaSimples.icms)}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* By Group */}
          {Object.keys(result.porGrupo).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recuperação por Grupo de Produto</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(result.porGrupo).sort((a, b) => b[1].total - a[1].total).map(([grupo, data]) => (
                  <div key={grupo} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{grupo}</p>
                    <p className="text-xl font-bold text-violet-600 mt-1">{fmt(data.total)}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {data.monofasico > 0 && <span>PIS/COFINS: {fmt(data.monofasico)}</span>}
                      {data.icmsSt > 0 && <span>ICMS-ST: {fmt(data.icmsSt)}</span>}
                      <span>{data.itens} itens</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Period */}
          {Object.keys(result.porCompetencia).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recuperação por Competência</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Competência</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Monofásico (PIS/COFINS)</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">ICMS-ST</th>
                      <th className="text-right py-3 px-4 font-bold text-violet-700">Total Recuperável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.porCompetencia).sort().map(([comp, data]) => (
                      <tr key={comp} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-medium text-gray-900">{comp}</td>
                        <td className="py-2.5 px-4 text-right text-gray-600">{fmt(data.monofasico)}</td>
                        <td className="py-2.5 px-4 text-right text-gray-600">{fmt(data.icmsSt)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-violet-600">{fmt(data.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={() => { setView('upload'); setResult(null); setSelectedFiles([]); setError(null); }}
              className="px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-colors">
              Nova Análise
            </button>
            <button onClick={() => setView('dashboard')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              Ver Dashboard
            </button>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Análises</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dash?.totalAnalises ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">realizadas</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
              <p className="text-xs text-violet-600 uppercase tracking-wide font-medium">Total Recuperável</p>
              <p className="text-3xl font-bold text-violet-600 mt-2">{fmt(dash?.totalRecuperavel)}</p>
              <p className="text-xs text-violet-400 mt-1">identificado</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Monofásico</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{fmt(dash?.totalMonofasico)}</p>
              <p className="text-xs text-gray-400 mt-1">PIS/COFINS</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">ICMS-ST</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{fmt(dash?.totalIcmsSt)}</p>
              <p className="text-xs text-gray-400 mt-1">no DAS indevido</p>
            </div>
          </div>

          {!hasData && !isLoading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Comece a recuperar créditos do Simples</h2>
              <p className="text-gray-500 max-w-lg mx-auto mb-8">
                Envie os XMLs das NFes de venda de uma empresa do Simples Nacional. O sistema identifica automaticamente produtos monofásicos e ICMS-ST pago indevidamente no DAS.
              </p>
              <button onClick={() => setView('upload')}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-violet-200 hover:from-violet-500 hover:to-purple-500 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nova Análise
              </button>
            </div>
          )}

          {/* Empresas */}
          {dash?.empresas && dash.empresas.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Análises Realizadas</h2>
              <div className="space-y-3">
                {dash.empresas.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-900">{emp.nome}</p>
                      <p className="text-xs text-gray-500">{emp.cnpj} | {emp.nfes} NFes | {new Date(emp.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-bold text-violet-600">{fmt(emp.recuperavel)}</p>
                        <p className="text-[10px] text-gray-400">recuperável</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Mono: {fmt(emp.monofasico)}</p>
                        <p className="text-xs text-gray-500">ST: {fmt(emp.icmsSt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
