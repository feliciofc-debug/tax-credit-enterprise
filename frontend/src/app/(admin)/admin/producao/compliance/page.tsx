'use client';

import { useState, useRef } from 'react';
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

const severityConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', label: 'Crítico', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Atenção', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Info', dot: 'bg-blue-500' },
};

const categoryLabels: Record<string, string> = {
  overpayment: 'Pagamento indevido',
  missing_credit: 'Crédito não aproveitado',
  wrong_rate: 'Alíquota incorreta',
  wrong_cfop: 'CFOP incorreto',
  retention_excess: 'Retenção excedente',
  base_error: 'Erro na base de cálculo',
};

export default function CompliancePage() {
  const { data: dashData, isLoading } = useSWR<{ success: boolean; data: DashboardData }>(
    '/api/compliance/dashboard',
    authedFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dash = dashData?.data;

  const handleUpload = async () => {
    const input = fileRef.current;
    if (!input?.files?.length) return;

    const cnpj = prompt('CNPJ da empresa (apenas números):');
    if (!cnpj) return;
    const companyName = prompt('Nome da empresa:') || 'Empresa';

    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('cnpj', cnpj.replace(/\D/g, ''));
      fd.append('companyName', companyName);
      for (const file of Array.from(input.files)) {
        fd.append('files', file);
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/compliance/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: fd,
      });
      const data = await res.json();
      setUploadResult(data);
      mutate('/api/compliance/dashboard');
    } catch (err: any) {
      setUploadResult({ success: false, error: err.message });
    } finally {
      setUploading(false);
      if (input) input.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance em Tempo Real</h1>
            <p className="text-gray-500 text-sm">Monitoramento fiscal contínuo — detecte pagamentos indevidos antes que aconteçam</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Empresas Monitoradas</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dash?.monitors ?? 0}</p>
        </div>
        <div className="bg-white border border-orange-200 rounded-xl p-5">
          <p className="text-xs text-orange-600 uppercase tracking-wide">Economia Identificada</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{fmt(dash?.totalEconomia)}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-5">
          <p className="text-xs text-red-600 uppercase tracking-wide">Alertas Ativos</p>
          <div className="flex items-baseline gap-3 mt-2">
            <p className="text-3xl font-bold text-red-600">{dash?.alertsBySeverity?.critical ?? 0}</p>
            <span className="text-sm text-amber-600">{dash?.alertsBySeverity?.warning ?? 0} atenção</span>
            <span className="text-sm text-blue-500">{dash?.alertsBySeverity?.info ?? 0} info</span>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">SPEDs Processados</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dash?.totalUploads ?? 0}</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Upload de SPED para Análise</h2>
            <p className="text-gray-600 text-sm mt-1">Envie arquivos SPED (EFD ICMS/IPI, EFD Contribuições, ECF, ECD) ou ZIP para análise instantânea</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.zip"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium transition-colors"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Enviar SPED
                </>
              )}
            </button>
          </div>
        </div>

        {uploadResult && (
          <div className={`mt-4 p-4 rounded-lg ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {uploadResult.success ? (
              <div>
                <p className="text-green-800 font-semibold">{uploadResult.totalAlerts} alertas gerados em {uploadResult.totalFiles} arquivo(s)</p>
                {uploadResult.data?.map((r: any, i: number) => (
                  <p key={i} className="text-green-700 text-sm mt-1">
                    {r.file}: {r.alerts ?? 0} alertas | Economia: {fmt(r.economiaEstimada)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-red-700">{uploadResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Alerts by Category */}
      {dash?.alertsByCategory && dash.alertsByCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Economia por Categoria</h2>
          <div className="grid grid-cols-3 gap-4">
            {dash.alertsByCategory.map((cat, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700">{categoryLabels[cat.category] || cat.category}</p>
                <p className="text-xl font-bold text-orange-600 mt-1">{fmt(cat._sum?.economiaEstimada)}</p>
                <p className="text-xs text-gray-500 mt-1">{cat._count} alerta(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Alertas Recentes</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Carregando...</p>
          </div>
        ) : !dash?.recentAlerts?.length ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum alerta ainda</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto">
              Envie arquivos SPED para começar o monitoramento. O sistema analisará automaticamente e gerará alertas sobre pagamentos indevidos.
            </p>
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
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
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

      {/* Empresas Monitoradas */}
      {dash?.empresas && dash.empresas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Empresas Monitoradas</h2>
          <div className="space-y-3">
            {dash.empresas.map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
  );
}
