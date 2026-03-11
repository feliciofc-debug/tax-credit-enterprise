'use client';

import { useState, useRef, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher } from '@/lib/fetcher';

interface DashboardData {
  monitors: number;
  totalEconomia: number;
  totalAlerts: number;
  totalUploads: number;
  alertsBySeverity: { critical: number; warning: number; info: number };
  alertsByCategory: Array<{ category: string; _sum: { economiaEstimada: number }; _count: number }>;
  recentAlerts: Array<{
    id: string;
    severity: string;
    category: string;
    tributo: string;
    title: string;
    description: string;
    valorEnvolvido: number;
    economiaEstimada: number;
    baseLegal: string;
    parecer: string;
    periodo: string;
    status: string;
    createdAt: string;
    monitor: { companyName: string; cnpj: string };
  }>;
  empresas: Array<{
    id: string;
    nome: string;
    cnpj: string;
    economia: number;
    alertas: number;
    lastUpload: string | null;
  }>;
}

const fmt = (v?: number | null) => {
  if (v == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const severityConfig: Record<string, { bg: string; text: string; label: string; dot: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', label: 'Crítico', dot: 'bg-red-500', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Atenção', dot: 'bg-amber-500', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Info', dot: 'bg-blue-500', border: 'border-blue-200' },
};

const categoryLabels: Record<string, string> = {
  overpayment: 'Pagamento indevido',
  missing_credit: 'Crédito não aproveitado',
  wrong_rate: 'Alíquota incorreta',
  wrong_cfop: 'CFOP incorreto',
  retention_excess: 'Retenção excedente',
  base_error: 'Erro na base de cálculo',
};

type ViewMode = 'dashboard' | 'upload';

export default function CompliancePage() {
  const { data: dashData, isLoading } = useSWR<{ success: boolean; data: DashboardData }>(
    '/api/compliance/dashboard',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const [view, setView] = useState<ViewMode>('dashboard');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cnpj, setCnpj] = useState('');
  const [companyName, setCompanyName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const dash = dashData?.data;
  const hasData = (dash?.monitors ?? 0) > 0;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.txt') || f.name.endsWith('.zip'));
    if (files.length) setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || !cnpj.trim()) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('cnpj', cnpj.replace(/\D/g, ''));
      fd.append('companyName', companyName || 'Empresa');
      selectedFiles.forEach(file => fd.append('files', file));

      const token = localStorage.getItem('token');
      const res = await fetch('/api/compliance/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: fd,
      });
      const data = await res.json();
      setUploadResult(data);
      if (data.success) {
        setSelectedFiles([]);
        setCnpj('');
        setCompanyName('');
        mutate('/api/compliance/dashboard');
      }
    } catch (err: any) {
      setUploadResult({ success: false, error: err.message });
    } finally {
      setUploading(false);
    }
  };

  const formatCnpj = (v: string) => {
    const nums = v.replace(/\D/g, '').slice(0, 14);
    if (nums.length <= 2) return nums;
    if (nums.length <= 5) return `${nums.slice(0,2)}.${nums.slice(2)}`;
    if (nums.length <= 8) return `${nums.slice(0,2)}.${nums.slice(2,5)}.${nums.slice(5)}`;
    if (nums.length <= 12) return `${nums.slice(0,2)}.${nums.slice(2,5)}.${nums.slice(5,8)}/${nums.slice(8)}`;
    return `${nums.slice(0,2)}.${nums.slice(2,5)}.${nums.slice(5,8)}/${nums.slice(8,12)}-${nums.slice(12)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance em Tempo Real</h1>
              <p className="text-gray-500 text-sm">Monitoramento fiscal contínuo — detecte pagamentos indevidos antes que aconteçam</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'dashboard' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('upload')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'upload' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Enviar SPEDs
            </button>
          </div>
        </div>
      </div>

      {view === 'upload' ? (
        /* ======================== UPLOAD VIEW ======================== */
        <div>
          {/* How It Works */}
          <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border border-orange-200 rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Como funciona o monitoramento?</h2>
            <p className="text-gray-600 mb-8">Não precisa integrar com nenhum ERP. O SPED já é a saída padronizada de qualquer sistema (Oracle, SAP, TOTVS, Sankhya, etc).</p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/80 backdrop-blur rounded-xl p-6 border border-orange-100">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-orange-700 font-black text-lg">1</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">ERP gera o SPED</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Seu ERP (Oracle, SAP, TOTVS, etc) já gera os arquivos SPED automaticamente — EFD ICMS/IPI, EFD Contribuições, ECF ou ECD. Não muda nada no seu processo.
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-6 border border-orange-100">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-orange-700 font-black text-lg">2</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Upload na plataforma</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  No final do dia, semana ou mês, o fiscal da empresa faz upload dos SPEDs aqui. Arrasta e solta. Aceita ZIP com vários arquivos de uma vez. Leva segundos.
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-6 border border-orange-100">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-orange-700 font-black text-lg">3</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Alertas instantâneos</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  O sistema analisa registro por registro e gera alertas com severidade, valor envolvido, base legal e parecer técnico. Você vê tudo no dashboard em tempo real.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 bg-white/60 rounded-xl p-4 border border-orange-100">
              <svg className="w-5 h-5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-700">
                <strong>Zero integração necessária.</strong> Funciona com qualquer ERP do mercado. O arquivo SPED é um formato padrão da Receita Federal — todos os sistemas geram no mesmo formato.
              </p>
            </div>
          </div>

          {/* Upload Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Enviar SPEDs para análise</h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ da empresa</label>
                <input
                  type="text"
                  value={formatCnpj(cnpj)}
                  onChange={e => setCnpj(e.target.value.replace(/\D/g, ''))}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Razão social"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30'
              }`}
            >
              <input ref={fileRef} type="file" multiple accept=".txt,.zip" className="hidden" onChange={handleFileSelect} />
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">Arraste os arquivos SPED aqui</p>
              <p className="text-sm text-gray-500 mb-3">ou clique para selecionar</p>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                <span className="bg-gray-100 px-2 py-1 rounded">.txt (SPED)</span>
                <span className="bg-gray-100 px-2 py-1 rounded">.zip (múltiplos)</span>
                <span className="bg-gray-100 px-2 py-1 rounded">EFD ICMS/IPI</span>
                <span className="bg-gray-100 px-2 py-1 rounded">EFD Contribuições</span>
                <span className="bg-gray-100 px-2 py-1 rounded">ECF</span>
                <span className="bg-gray-100 px-2 py-1 rounded">ECD</span>
              </div>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">{selectedFiles.length} arquivo(s) selecionado(s)</p>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

            {/* Submit */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Após o upload, a análise leva menos de 60 segundos por arquivo.
              </p>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFiles.length || !cnpj.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all shadow-lg shadow-orange-200"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analisando SPEDs...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Analisar {selectedFiles.length} arquivo{selectedFiles.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`mt-6 p-5 rounded-xl ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {uploadResult.success ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-800 font-bold">Análise concluída — {uploadResult.totalAlerts} alertas gerados</p>
                    </div>
                    {uploadResult.data?.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between mt-2 text-sm">
                        <span className="text-green-700">{r.file}</span>
                        <span className="text-green-800 font-semibold">{r.alerts} alertas | {fmt(r.economiaEstimada)}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => { setUploadResult(null); setView('dashboard'); }}
                      className="mt-4 text-sm font-medium text-green-700 hover:text-green-900 underline"
                    >
                      Ver no Dashboard →
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700">{uploadResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supported ERPs */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Compatível com qualquer ERP</h3>
            <div className="flex flex-wrap gap-3">
              {['Oracle EBS / Cloud', 'SAP S/4HANA', 'TOTVS Protheus', 'TOTVS RM', 'Sankhya', 'Senior Sistemas', 'Linx', 'Alterdata', 'Domínio Sistemas', 'Mastermaq', 'Questor', 'Fortes', 'Sage', 'Microsiga'].map(erp => (
                <span key={erp} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                  {erp}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Todos os ERPs homologados no Brasil geram arquivos SPED no formato padrão da Receita Federal. Não é necessária nenhuma integração — basta exportar o SPED e enviar aqui.
            </p>
          </div>
        </div>
      ) : (
        /* ======================== DASHBOARD VIEW ======================== */
        <div>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Empresas</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{dash?.monitors ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">monitoradas</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-orange-600 uppercase tracking-wide font-medium">Economia</p>
              </div>
              <p className="text-3xl font-bold text-orange-600">{fmt(dash?.totalEconomia)}</p>
              <p className="text-xs text-orange-400 mt-1">identificada</p>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-xs text-red-600 uppercase tracking-wide font-medium">Alertas</p>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold text-red-600">{dash?.alertsBySeverity?.critical ?? 0}</p>
                <span className="text-sm text-amber-600 font-medium">{dash?.alertsBySeverity?.warning ?? 0} <span className="text-xs text-amber-400">atenção</span></span>
              </div>
              <p className="text-xs text-gray-400 mt-1">críticos ativos</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">SPEDs</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{dash?.totalUploads ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">processados</p>
            </div>
          </div>

          {!hasData && !isLoading && (
            /* Empty State */
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Comece o monitoramento fiscal</h2>
              <p className="text-gray-500 max-w-lg mx-auto mb-8">
                Envie os arquivos SPED da empresa e o sistema vai analisar registro por registro, identificar pagamentos indevidos e gerar alertas com parecer técnico automático.
              </p>
              <button
                onClick={() => setView('upload')}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-200 hover:from-orange-500 hover:to-amber-500 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Enviar SPEDs
              </button>
              <div className="mt-8 grid md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-900 mb-1">ICMS</p>
                  <p className="text-xs text-gray-500">Saldo credor, ST, crédito extemporâneo</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-900 mb-1">PIS/COFINS</p>
                  <p className="text-xs text-gray-500">Tema 69 STF, monofásicos, insumos</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-900 mb-1">IRPJ/CSLL</p>
                  <p className="text-xs text-gray-500">Retenção a maior, LALUR exclusões</p>
                </div>
              </div>
            </div>
          )}

          {/* Alerts by Category */}
          {dash?.alertsByCategory && dash.alertsByCategory.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Economia por Categoria</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {dash.alertsByCategory.map((cat, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm font-medium text-gray-700">{categoryLabels[cat.category] || cat.category}</p>
                    <p className="text-xl font-bold text-orange-600 mt-1">{fmt(cat._sum?.economiaEstimada)}</p>
                    <p className="text-xs text-gray-500 mt-1">{cat._count} alerta(s)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Alerts */}
          {(hasData || isLoading) && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Alertas Recentes</h2>
                {dash?.recentAlerts?.length ? (
                  <span className="text-xs text-gray-400">{dash.recentAlerts.length} alerta(s)</span>
                ) : null}
              </div>

              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Carregando...</p>
                </div>
              ) : !dash?.recentAlerts?.length ? (
                <div className="p-12 text-center">
                  <p className="text-gray-500 text-sm">Nenhum alerta registrado ainda</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dash.recentAlerts.map(alert => {
                    const sev = severityConfig[alert.severity] || severityConfig.info;
                    const expanded = expandedAlert === alert.id;
                    return (
                      <div key={alert.id} className={`${expanded ? sev.bg : 'hover:bg-gray-50'} transition-colors`}>
                        <div
                          className="p-4 cursor-pointer flex items-start gap-4"
                          onClick={() => setExpandedAlert(expanded ? null : alert.id)}
                        >
                          <div className={`w-3 h-3 rounded-full ${sev.dot} mt-1.5 shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.bg} ${sev.text} border ${sev.border}`}>{sev.label}</span>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{alert.tributo}</span>
                              <span className="text-xs text-gray-400">{alert.periodo}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{alert.monitor?.companyName} — {alert.monitor?.cnpj}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-orange-600">{fmt(alert.economiaEstimada)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">economia estimada</p>
                          </div>
                          <svg className={`w-5 h-5 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {expanded && (
                          <div className="px-4 pb-4 ml-7">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Descrição</p>
                                <p className="text-sm text-gray-700 mt-1">{alert.description}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase">Base Legal</p>
                                  <p className="text-sm text-gray-700 mt-1">{alert.baseLegal}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase">Valor Envolvido</p>
                                  <p className="text-sm font-bold text-gray-900 mt-1">{fmt(alert.valorEnvolvido)}</p>
                                </div>
                              </div>
                              {alert.parecer && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                  <p className="text-xs font-bold text-orange-700 uppercase mb-1">Parecer / Recomendação</p>
                                  <p className="text-sm text-orange-800">{alert.parecer}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empresas Monitoradas */}
          {dash?.empresas && dash.empresas.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Empresas Monitoradas</h2>
              <div className="space-y-3">
                {dash.empresas.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-900">{emp.nome}</p>
                      <p className="text-xs text-gray-500">{emp.cnpj}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-600">{fmt(emp.economia)}</p>
                        <p className="text-[10px] text-gray-400">economia</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700">{emp.alertas}</p>
                        <p className="text-[10px] text-gray-400">alertas</p>
                      </div>
                      {emp.lastUpload && (
                        <p className="text-xs text-gray-400">{new Date(emp.lastUpload).toLocaleDateString('pt-BR')}</p>
                      )}
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
