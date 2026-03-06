'use client';

import { useState, useEffect, useRef } from 'react';

interface HPCStatus {
  success: boolean;
  gateway: { enabled: boolean; baseUrl: string; hasApiKey: boolean };
  hpc: {
    service?: string;
    status?: string;
    capabilities?: string[];
    maxUploadMB?: number;
    parserVersion?: string;
    registros?: string[];
    message?: string;
  };
}

interface HPCResult {
  arquivo: string;
  tipo: string;
  periodo: { inicio: string; fim: string };
  empresa: { cnpj: string; razaoSocial: string; uf: string; ie: string };
  resumo: {
    totalEntradas: number;
    totalSaidas: number;
    icmsCreditos: number;
    icmsDebitos: number;
    saldoCredor: number;
    saldoDevedor: number;
    numNfes: number;
  };
  processadoEm: number;
}

interface AnalysisOportunidade {
  tipo: string;
  tributo: string;
  descricao: string;
  valorEstimado: number;
  fundamentacaoLegal: string;
  prazoRecuperacao: string;
  complexidade: string;
  probabilidadeRecuperacao: number;
  risco: string;
  documentacaoNecessaria: string[];
  passosPraticos: string[];
}

interface FullAnalysisResult {
  savedId?: string | null;
  saveError?: string | null;
  pipeline?: string;
  timing?: { hpcProcessingMs?: number; claudeAnalysisMs?: number; totalMs?: number };
  hpc?: { arquivosProcessados?: number; resultados?: HPCResult[]; erros?: string[] };
  analysis: {
    score: number;
    regimeTributario: string;
    riscoGeral: string;
    valorTotalEstimado: number;
    periodoAnalisado: string;
    resumoExecutivo: string;
    fundamentacaoGeral: string;
    oportunidades: AnalysisOportunidade[];
    recomendacoes: string[];
    alertas: string[];
  };
}

type Mode = 'process-only' | 'full-analysis';

export default function HPCTestPage() {
  const [status, setStatus] = useState<HPCStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('process-only');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [regime, setRegime] = useState('');
  const [sector, setSector] = useState('');

  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);
  const [fullResult, setFullResult] = useState<FullAnalysisResult | null>(null);
  const [processError, setProcessError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [jobProgress, setJobProgress] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const extratoRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<boolean>(false);

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';

  useEffect(() => {
    checkStatus();
  }, [apiBase]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      pollingRef.current = false;
    };
  }, []);

  const checkStatus = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/hpc/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatusError('Erro ao verificar status do HPC');
    } finally {
      setStatusLoading(false);
    }
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const pollJob = async (jobId: string) => {
    const token = localStorage.getItem('token');
    pollingRef.current = true;
    let networkErrors = 0;

    // Use same-origin relative URL for polling to avoid CORS entirely.
    // Next.js rewrites /api/* to the backend automatically.
    const pollUrl = `/api/hpc/job/${jobId}`;

    while (pollingRef.current) {
      try {
        const res = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 404) {
          pollingRef.current = false;
          setProcessError('Processamento foi interrompido. Tente novamente.');
          setProcessing(false);
          stopTimer();
          return;
        }

        const data = await res.json();
        networkErrors = 0;

        if (data.status === 'completed') {
          pollingRef.current = false;
          setFullResult(data);
          setJobProgress('');
          setProcessing(false);
          stopTimer();
          return;
        }

        if (data.status === 'failed') {
          pollingRef.current = false;
          setProcessError(data.error || 'Erro na analise');
          setJobProgress('');
          setProcessing(false);
          stopTimer();
          return;
        }

        setJobProgress(data.progress || 'Processando...');
      } catch {
        networkErrors++;
        if (networkErrors > 20) {
          pollingRef.current = false;
          setProcessError('Perda de conexao com o servidor. Tente novamente.');
          setProcessing(false);
          stopTimer();
          return;
        }
      }

      await new Promise(r => setTimeout(r, 5000));
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    if (mode === 'full-analysis' && !companyName) {
      setProcessError('Nome da empresa é obrigatório para análise completa');
      return;
    }

    setProcessing(true);
    setProcessError('');
    setProcessResult(null);
    setFullResult(null);
    setJobProgress('Enviando arquivos...');
    startTimer();

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      files.forEach(f => formData.append('documents', f));

      if (mode === 'full-analysis') {
        formData.append('companyName', companyName);
        if (cnpj) formData.append('cnpj', cnpj);
        if (regime) formData.append('regime', regime);
        if (sector) formData.append('sector', sector);
        formData.append('documentType', 'sped');
      }

      const endpoint = mode === 'process-only' ? `${apiBase}/api/hpc/process-only` : `${apiBase}/api/hpc/analyze`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setProcessError(data.error || `Erro ${res.status}`);
        setProcessing(false);
        stopTimer();
      } else if (mode === 'process-only') {
        setProcessResult(data);
        setProcessing(false);
        stopTimer();
      } else if (data.jobId) {
        setJobProgress('Arquivos recebidos, processamento em andamento...');
        pollJob(data.jobId);
      } else {
        setFullResult(data);
        setProcessing(false);
        stopTimer();
      }
    } catch (e: any) {
      setProcessError(e.message || 'Erro de conexão');
      setProcessing(false);
      stopTimer();
    }
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatNumber = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(v);

  const hpcOnline = status?.hpc?.status === 'ok' || status?.hpc?.status === 'online';

  const handlePrintExtrato = () => {
    if (!extratoRef.current || !fullResult) return;
    const content = extratoRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Extrato - ${companyName || 'Analise'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#1a1a1a;padding:0;font-size:11px;line-height:1.5;background:white}
.extrato-print>div:first-child{background:linear-gradient(135deg,#4338ca,#7c3aed)!important;color:white;padding:24px;border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.extrato-print .text-3xl{font-size:22px;font-weight:800}
.extrato-print .text-xl{font-size:16px;font-weight:700}
.extrato-print .text-indigo-200{opacity:0.85;font-size:11px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
.text-right{text-align:right}
.text-center{text-align:center}
.font-bold{font-weight:700}
.text-green-700{color:#15803d}
.text-green-800{color:#166534}
.text-indigo-900{color:#312e81}
.text-gray-900{color:#111827}
.text-gray-700{color:#374151}
.text-gray-600{color:#4b5563}
.text-gray-500{color:#6b7280}
.text-gray-400{color:#9ca3af}
.text-yellow-700{color:#a16207}
.text-blue-700{color:#1d4ed8}
.bg-indigo-50{background:#eef2ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-gray-50{background:#f9fafb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-gray-100{background:#f3f4f6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-green-50{background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-yellow-50{background:#fefce8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-blue-50{background:#eff6ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-indigo-100{background:#e0e7ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-green-100{background:#dcfce7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-yellow-100{background:#fef9c3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg-red-100{background:#fee2e2;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rounded{border-radius:4px}.rounded-lg{border-radius:8px}.rounded-xl{border-radius:12px}
.px-6{padding-left:24px;padding-right:24px}
.py-4{padding-top:16px;padding-bottom:16px}
.py-3{padding-top:12px;padding-bottom:12px}
.px-3{padding-left:12px;padding-right:12px}
.px-2{padding-left:8px;padding-right:8px}
.py-1{padding-top:4px;padding-bottom:4px}
.mb-1{margin-bottom:4px}.mb-2{margin-bottom:8px}.mb-3{margin-bottom:12px}
.mt-0\\.5{margin-top:2px}
.gap-4{gap:16px}.gap-3{gap:12px}.gap-2{gap:8px}.gap-1{gap:4px}
.text-xs{font-size:10px}.text-sm{font-size:12px}.text-lg{font-size:16px}
.font-medium{font-weight:500}.font-semibold{font-weight:600}
.border-t{border-top:1px solid #e5e7eb}.border-b{border-bottom:1px solid #e5e7eb}
.border{border:1px solid #e5e7eb}
.border-gray-200{border-color:#e5e7eb}
.border-green-200{border-color:#bbf7d0}
.border-yellow-200{border-color:#fde68a}
.border-blue-100{border-color:#dbeafe}
.space-y-3>*+*{margin-top:12px}
.space-y-1>*+*{margin-top:4px}
.line-clamp-2{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.whitespace-nowrap{white-space:nowrap}
.capitalize{text-transform:capitalize}
.italic{font-style:italic}
.flex{display:flex}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-between{justify-content:space-between}
.grid{display:grid}.grid-cols-1{grid-template-columns:1fr}.grid-cols-2{grid-template-columns:1fr 1fr}
.overflow-x-auto{overflow-x:auto}
.list-disc{list-style:disc}.list-decimal{list-style:decimal}.list-inside{list-style-position:inside}
.leading-relaxed{line-height:1.625}
.whitespace-pre-line{white-space:pre-line}
details{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid}
summary{padding:12px 16px;cursor:pointer;font-size:12px}
details>div{padding:16px;border-top:1px solid #e5e7eb;font-size:11px}
details[open]{background:white}
.border-blue-200{border:1px solid #bfdbfe}.border-yellow-200{border:1px solid #fde68a}
.text-blue-800{color:#1e40af}.text-blue-700{color:#1d4ed8}
.text-yellow-800{color:#854d0e}
.capitalize{text-transform:capitalize}
@media print{
  body{padding:0!important}
  .extrato-print>div:first-child{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  details{break-inside:avoid}
  table{break-inside:auto}
  tr{break-inside:avoid}
  .bg-blue-50,.bg-yellow-50,.bg-green-50,.bg-gray-50,.bg-gray-100,.bg-indigo-100{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
</style>
</head>
<body>
<div class="extrato-print">${content}</div>
</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          HPC Motor — Teste de Pipeline
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Envie arquivos SPED (.txt ou .zip), PDF, Excel para processamento com supercomputacao e IA avancada
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Status do Pipeline</h2>
          <button
            onClick={checkStatus}
            disabled={statusLoading}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
          >
            {statusLoading ? 'Verificando...' : 'Verificar novamente'}
          </button>
        </div>

        {statusError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-sm">{statusError}</p>
          </div>
        )}

        {status && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Gateway */}
            <div className={`rounded-lg p-4 border ${status.gateway?.enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${status.gateway?.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                <p className="font-medium text-sm text-gray-900">Gateway</p>
              </div>
              <p className="text-xs text-gray-500 break-all">{status.gateway?.baseUrl}</p>
              <p className={`text-xs font-medium mt-1 ${status.gateway?.hasApiKey ? 'text-green-600' : 'text-orange-600'}`}>
                API Key: {status.gateway?.hasApiKey ? 'Configurada' : 'Ausente'}
              </p>
            </div>

            {/* HPC */}
            <div className={`rounded-lg p-4 border ${hpcOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${hpcOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <p className="font-medium text-sm text-gray-900">HPC Go+Chapel</p>
              </div>
              {hpcOnline ? (
                <>
                  <p className="text-xs text-gray-500">{status.hpc?.service} v{status.hpc?.parserVersion}</p>
                  <p className="text-xs text-green-600 font-medium mt-1">Max: {status.hpc?.maxUploadMB}MB</p>
                </>
              ) : (
                <p className="text-xs text-red-600">{status.hpc?.message || 'Offline'}</p>
              )}
            </div>

            {/* Registros */}
            <div className="rounded-lg p-4 border bg-gray-50 border-gray-200">
              <p className="font-medium text-sm text-gray-900 mb-1">Registros SPED</p>
              {status.hpc?.registros ? (
                <div className="flex flex-wrap gap-1">
                  {status.hpc.registros.map(r => (
                    <span key={r} className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                      {r}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Indisponível</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload + Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Enviar Arquivos SPED</h2>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setMode('process-only')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'process-only'
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">Apenas Parse (HPC)</p>
            <p className="text-xs text-gray-500 mt-1">
              Envia para Go+Chapel e retorna dados parseados. Sem Claude. Rápido.
            </p>
          </button>
          <button
            onClick={() => setMode('full-analysis')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'full-analysis'
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">Análise Completa (HPC + Claude)</p>
            <p className="text-xs text-gray-500 mt-1">
              Parse no HPC + análise jurídica com Claude Opus. Aceita ZIP. Fallback automático.
            </p>
          </button>
        </div>

        {/* Company info for full analysis */}
        {mode === 'full-analysis' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Nome da Empresa *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Razão Social da empresa"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">CNPJ</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Regime Tributário</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={regime}
                onChange={e => setRegime(e.target.value)}
              >
                <option value="">-- Selecione --</option>
                <option value="lucro_real">Lucro Real</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="simples">Simples Nacional</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Setor</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={sector}
                onChange={e => setSector(e.target.value)}
                placeholder="Ex: Comércio atacadista"
              />
            </div>
          </div>
        )}

        {/* File upload */}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-amber-400 transition-colors mb-4">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/>
          </svg>
          <input
            type="file"
            multiple
            accept=".txt,.zip,.pdf,.xlsx,.xls,.csv"
            onChange={e => setFiles(Array.from(e.target.files || []))}
            className="w-full max-w-xs mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-2">Arquivos SPED (.txt), ZIP, PDF, Excel — até 100MB</p>
        </div>

        {files.length > 0 && (
          <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="text-amber-800 text-sm font-medium">{files.length} arquivo(s):</p>
            <ul className="mt-1 space-y-0.5">
              {files.map((f, i) => (
                <li key={i} className="text-amber-700 text-xs font-mono">
                  {f.name} ({(f.size / 1024).toFixed(0)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}

        {processError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{processError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleProcess}
          disabled={processing || files.length === 0 || (mode === 'process-only' && !hpcOnline)}
          className={`w-full py-3.5 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white ${
            mode === 'process-only'
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {processing ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {jobProgress || 'Processando...'} {formatMs(elapsed)}
            </>
          ) : mode === 'process-only' ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Enviar para HPC (Parse)
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Análise Completa (HPC + Claude)
            </>
          )}
        </button>
      </div>

      {/* ============================================================ */}
      {/* RESULTS: Process Only */}
      {/* ============================================================ */}
      {processResult && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Resultado — Parse HPC</h3>
            <span className="text-xs bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full font-bold">
              {formatMs(processResult.hpcResult?.tempoTotalMs || 0)}
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Arquivos</p>
                <p className="text-xl font-bold text-gray-900">{processResult.hpcResult?.arquivosProcessados || 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Tempo HPC</p>
                <p className="text-xl font-bold text-amber-600">{formatMs(processResult.hpcResult?.tempoTotalMs || 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Texto Gerado</p>
                <p className="text-xl font-bold text-gray-900">{((processResult.hpcResult?.textoUnificado?.length || 0) / 1000).toFixed(0)}K chars</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Erros</p>
                <p className={`text-xl font-bold ${(processResult.hpcResult?.erros?.length || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {processResult.hpcResult?.erros?.length || 0}
                </p>
              </div>
            </div>

            {/* Resultado por arquivo */}
            {processResult.hpcResult?.resultados?.map((r: HPCResult, i: number) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.arquivo}</p>
                    <p className="text-xs text-gray-500">
                      {r.tipo} | {r.periodo?.inicio} a {r.periodo?.fim} | {formatMs(r.processadoEm)}
                    </p>
                  </div>
                </div>
                {r.empresa && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Empresa Identificada</p>
                    <p className="text-sm font-medium text-gray-900">{r.empresa.razaoSocial}</p>
                    <p className="text-xs text-gray-500">CNPJ: {r.empresa.cnpj} | UF: {r.empresa.uf} | IE: {r.empresa.ie}</p>
                  </div>
                )}
                {r.resumo && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-blue-500">Entradas</p>
                      <p className="font-bold text-blue-700">R$ {formatNumber(r.resumo.totalEntradas)}</p>
                    </div>
                    <div className="bg-orange-50 rounded p-2">
                      <p className="text-orange-500">Saídas</p>
                      <p className="font-bold text-orange-700">R$ {formatNumber(r.resumo.totalSaidas)}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-green-500">ICMS Créditos</p>
                      <p className="font-bold text-green-700">R$ {formatNumber(r.resumo.icmsCreditos)}</p>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-red-500">ICMS Débitos</p>
                      <p className="font-bold text-red-700">R$ {formatNumber(r.resumo.icmsDebitos)}</p>
                    </div>
                    {r.resumo.saldoCredor > 0 && (
                      <div className="bg-emerald-50 rounded p-2 sm:col-span-2">
                        <p className="text-emerald-500">Saldo Credor</p>
                        <p className="font-bold text-emerald-700">R$ {formatNumber(r.resumo.saldoCredor)}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-500">NF-es</p>
                      <p className="font-bold text-gray-700">{r.resumo.numNfes}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Erros */}
            {processResult.hpcResult?.erros?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                <p className="text-red-700 text-sm font-medium mb-1">Erros:</p>
                {processResult.hpcResult.erros.map((e: string, i: number) => (
                  <p key={i} className="text-red-600 text-xs">{e}</p>
                ))}
              </div>
            )}

            {/* Raw text preview */}
            {processResult.hpcResult?.textoUnificado && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                  Ver texto consolidado ({((processResult.hpcResult.textoUnificado.length) / 1000).toFixed(0)}K chars)
                </summary>
                <pre className="mt-2 text-[10px] font-mono bg-gray-900 text-green-400 p-4 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
                  {processResult.hpcResult.textoUnificado.substring(0, 5000)}
                  {processResult.hpcResult.textoUnificado.length > 5000 && '\n\n... [truncado] ...'}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RESULTS: Full Analysis — EXTRATO PROFISSIONAL */}
      {/* ============================================================ */}
      {fullResult && fullResult.analysis && (
        <div className="space-y-6">
          {/* Timing bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Pipeline</span>
              <span className="text-xs font-mono text-gray-400">{fullResult.pipeline || 'unknown'}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                <p className="text-[10px] text-amber-600 font-medium">Supercomputacao HPC</p>
                <p className="text-lg font-bold text-amber-700">{formatMs(fullResult.timing?.hpcProcessingMs || 0)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                <p className="text-[10px] text-indigo-600 font-medium">IA Avancada (34 teses)</p>
                <p className="text-lg font-bold text-indigo-700">{formatMs(fullResult.timing?.claudeAnalysisMs || 0)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                <p className="text-[10px] text-green-600 font-medium">Total</p>
                <p className="text-lg font-bold text-green-700">{formatMs(fullResult.timing?.totalMs || 0)}</p>
              </div>
            </div>
          </div>

          {/* Banner — Análise salva */}
          {fullResult.savedId ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-800 font-semibold text-sm">Analise salva com sucesso</p>
                  <p className="text-green-600 text-xs">Disponivel no Dashboard e em Analises a qualquer momento</p>
                </div>
              </div>
              <a
                href="/admin/producao/analises"
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Ver em Analises
              </a>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-semibold text-sm">Analise NAO foi salva no banco de dados</p>
              </div>
              <p className="text-red-600 text-xs">Salve o PDF para nao perder o resultado.</p>
              {fullResult.saveError && (
                <p className="text-red-500 text-xs mt-1 font-mono bg-red-100 px-2 py-1 rounded">
                  Erro: {fullResult.saveError}
                </p>
              )}
            </div>
          )}

          {/* EXTRATO — Mesmo template da plataforma original */}
          <div ref={extratoRef} className="bg-white border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">EXTRATO DE CREDITOS TRIBUTARIOS</h2>
                  <p className="text-indigo-200 text-sm mt-1">
                    {companyName || ''} {cnpj ? `| CNPJ: ${cnpj}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold">{formatCurrency(fullResult.analysis.valorTotalEstimado)}</p>
                  <p className="text-indigo-200 text-xs">Total Estimado de Recuperacao</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-indigo-200">
                {fullResult.analysis.periodoAnalisado && <span>Periodo: {fullResult.analysis.periodoAnalisado}</span>}
                {fullResult.analysis.regimeTributario && <><span>|</span><span>Regime: {fullResult.analysis.regimeTributario}</span></>}
                {fullResult.analysis.riscoGeral && <><span>|</span><span>Risco: <span className="font-bold text-white capitalize">{fullResult.analysis.riscoGeral}</span></span></>}
                <span>|</span>
                <span>Score: <span className="font-bold text-white">{fullResult.analysis.score}</span></span>
              </div>
            </div>

            {/* Resumo Executivo */}
            {fullResult.analysis.resumoExecutivo && (
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-1">Resumo Executivo</p>
                <p className="text-sm text-gray-600 leading-relaxed">{fullResult.analysis.resumoExecutivo}</p>
              </div>
            )}

            {/* Tabela de Oportunidades */}
            {fullResult.analysis.oportunidades?.length > 0 && (
              <div className="px-6 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3">
                  EXTRATO DE OPORTUNIDADES ({fullResult.analysis.oportunidades.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                        <th className="px-3 py-3 text-left font-semibold">#</th>
                        <th className="px-3 py-3 text-left font-semibold">Oportunidade</th>
                        <th className="px-3 py-3 text-left font-semibold">Tributo</th>
                        <th className="px-3 py-3 text-right font-semibold">Valor Estimado</th>
                        <th className="px-3 py-3 text-center font-semibold">Prob.</th>
                        <th className="px-3 py-3 text-center font-semibold">Complex.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fullResult.analysis.oportunidades.map((op, i) => (
                        <tr key={i} className="hover:bg-indigo-50 transition-colors">
                          <td className="px-3 py-3 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-gray-900">{op.tipo || ''}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{op.descricao || ''}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">{op.tributo || ''}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                            {formatCurrency(op.valorEstimado)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${(op.probabilidadeRecuperacao || 0) >= 80 ? 'bg-green-100 text-green-700' : (op.probabilidadeRecuperacao || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {op.probabilidadeRecuperacao ?? 0}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${op.complexidade === 'baixa' ? 'bg-green-100 text-green-700' : op.complexidade === 'media' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {op.complexidade || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50 font-bold">
                        <td className="px-3 py-3" colSpan={3}>
                          <span className="text-indigo-900">TOTAL ESTIMADO DE RECUPERACAO</span>
                        </td>
                        <td className="px-3 py-3 text-right text-green-800 text-lg whitespace-nowrap">
                          {formatCurrency(fullResult.analysis.valorTotalEstimado)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Detalhamento por Oportunidade */}
            {fullResult.analysis.oportunidades?.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-900 mb-3">DETALHAMENTO POR OPORTUNIDADE</p>
                <div className="space-y-3">
                  {fullResult.analysis.oportunidades.map((op, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-100 flex items-center justify-between border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs font-bold">{String(i + 1).padStart(2, '0')}.</span>
                          <span className="font-bold text-gray-900 text-sm">{op.tipo || ''}</span>
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">{op.tributo || ''}</span>
                        </div>
                        <span className="font-bold text-green-700 text-sm">{formatCurrency(op.valorEstimado)}</span>
                      </div>
                      <div className="px-4 py-4 bg-white space-y-3 text-sm">
                        {op.descricao && (
                          <div>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{op.descricao}</p>
                          </div>
                        )}
                        {op.fundamentacaoLegal && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="font-semibold text-blue-800 text-xs mb-1">Fundamentacao Legal</p>
                            <p className="text-blue-700 text-xs leading-relaxed">{op.fundamentacaoLegal}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {op.prazoRecuperacao && (
                            <div>
                              <p className="font-semibold text-gray-700 text-xs">Prazo de Recuperacao</p>
                              <p className="text-gray-600 text-xs">{op.prazoRecuperacao}</p>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-700 text-xs">Complexidade</p>
                            <p className="text-gray-600 text-xs capitalize">{op.complexidade || '-'}</p>
                          </div>
                        </div>
                        {op.risco && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="font-semibold text-yellow-800 text-xs mb-1">Risco</p>
                            <p className="text-yellow-700 text-xs leading-relaxed">{op.risco}</p>
                          </div>
                        )}
                        {(op.documentacaoNecessaria || []).length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700 text-xs mb-1">Documentacao Necessaria</p>
                            <ul className="list-disc list-inside text-gray-600 text-xs space-y-0.5">
                              {(op.documentacaoNecessaria || []).map((d: string, j: number) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(op.passosPraticos || []).length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700 text-xs mb-1">Passos Praticos</p>
                            <ol className="list-decimal list-inside text-gray-600 text-xs space-y-0.5">
                              {(op.passosPraticos || []).map((p: string, j: number) => (
                                <li key={j}>{p}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendacoes e Alertas */}
            {((fullResult.analysis.recomendacoes?.length || 0) > 0 || (fullResult.analysis.alertas?.length || 0) > 0) && (
              <div className="px-6 py-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                {(fullResult.analysis.recomendacoes?.length || 0) > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-800 text-sm mb-2">Recomendacoes</p>
                    <ul className="space-y-1">
                      {fullResult.analysis.recomendacoes.map((r: string, i: number) => (
                        <li key={i} className="text-green-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">+</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(fullResult.analysis.alertas?.length || 0) > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-semibold text-yellow-800 text-sm mb-2">Alertas</p>
                    <ul className="space-y-1">
                      {fullResult.analysis.alertas.map((a: string, i: number) => (
                        <li key={i} className="text-yellow-700 text-xs flex items-start gap-1">
                          <span className="mt-0.5">!</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Fundamentacao Geral */}
            {fullResult.analysis.fundamentacaoGeral && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-700 text-sm mb-1">Fundamentacao Geral</p>
                <p className="text-gray-600 text-xs leading-relaxed">{fullResult.analysis.fundamentacaoGeral}</p>
              </div>
            )}

            {/* Nota conservadora */}
            <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700 italic">
                Valores sao estimativas conservadoras. O valor real recuperado pode ser superior ao estimado.
              </p>
            </div>

            {/* Rodape */}
            <div className="px-6 py-3 bg-gray-100 text-xs text-gray-400 flex justify-between">
              <span>Analise: IA Avancada (34 teses) | HPC Go+Chapel + Claude Opus | TaxCredit Enterprise</span>
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* HPC Details (collapsed) */}
          {fullResult.hpc && (fullResult.hpc.arquivosProcessados > 0 || (fullResult.hpc.resultados?.length || 0) > 0) && (
            <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <summary className="px-5 py-4 cursor-pointer hover:bg-gray-50 font-semibold text-gray-900 text-sm">
                Detalhes do Parse HPC ({fullResult.hpc?.arquivosProcessados || 0} arquivo(s))
              </summary>
              <div className="px-5 pb-5">
                {fullResult.hpc?.resultados?.map((r: HPCResult, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 mt-3">
                    <p className="font-medium text-sm text-gray-900">{r.arquivo}</p>
                    <p className="text-xs text-gray-500">
                      {r.tipo} | {r.periodo?.inicio} a {r.periodo?.fim} | {r.empresa?.razaoSocial}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Print button */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handlePrintExtrato}
              className="px-5 py-2.5 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
