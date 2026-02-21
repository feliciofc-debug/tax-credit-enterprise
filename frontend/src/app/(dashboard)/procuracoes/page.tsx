'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { authedFetcher } from '@/lib/fetcher';

interface Procuration {
  id: string;
  type: string;
  lawyerScenario: string;
  status: string;
  advogadoNome: string | null;
  advogadoOab: string | null;
  documentText: string | null;
  dataValidade: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  generated: { label: 'Gerada', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  signed: { label: 'Assinada', color: 'bg-purple-100 text-purple-700' },
  active: { label: 'Ativa', color: 'bg-green-100 text-green-700' },
  expired: { label: 'Expirada', color: 'bg-yellow-100 text-yellow-700' },
  revoked: { label: 'Revogada', color: 'bg-red-100 text-red-700' },
};

const TYPE_MAP: Record<string, string> = {
  particular: 'Procuração Particular',
  ecac_guide: 'Guia e-CAC',
  sefaz: 'Procuração SEFAZ',
};

export default function ClienteProcuracoesPage() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data: procurations, isLoading } = useSWR<Procuration[]>(
    '/api/procuration/my',
    authedFetcher,
    { revalidateOnFocus: false },
  );

  const handlePrint = (text: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Procuração</title>
<style>body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.8;margin:40px 60px;color:#000;}
pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:inherit;line-height:inherit;}
@media print{body{margin:20mm 25mm;}}</style>
</head><body><pre>${text}</pre></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const preview = procurations?.find(p => p.id === previewId);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48"/>
        <div className="h-4 bg-gray-100 rounded w-72"/>
        {[1,2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg"/>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procurações</h1>
        <p className="text-sm text-gray-500 mt-1">Documentos de procuração para representação perante a RFB/SEFAZ</p>
      </div>

      {preview && preview.documentText && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-gray-900">{TYPE_MAP[preview.type] || preview.type}</h2>
              <div className="flex gap-2">
                <button onClick={() => handlePrint(preview.documentText!)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Imprimir / Salvar PDF</button>
                <button onClick={() => setPreviewId(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-serif leading-relaxed">{preview.documentText}</pre>
            </div>
          </div>
        </div>
      )}

      {!procurations || procurations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="text-gray-500">Nenhuma procuração disponível</p>
          <p className="text-sm text-gray-400 mt-1">As procurações serão geradas pelo time da TaxCredit após a assinatura do contrato</p>
        </div>
      ) : (
        <div className="space-y-4">
          {procurations.map(p => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.generated;
            return (
              <div key={p.id} className="border rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{TYPE_MAP[p.type] || p.type}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    {p.advogadoNome && <p className="text-xs text-gray-500">Advogado: {p.advogadoNome} — OAB {p.advogadoOab}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Gerada em {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      {p.dataValidade && ` · Válida até ${new Date(p.dataValidade).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {p.documentText && (
                      <>
                        <button onClick={() => setPreviewId(p.id)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">
                          Visualizar
                        </button>
                        <button onClick={() => handlePrint(p.documentText!)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                          Baixar PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {p.type === 'ecac_guide' && p.status === 'generated' && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    <p className="font-medium">Ação necessária:</p>
                    <p>Siga as instruções do guia para conceder a procuração eletrônica no e-CAC da Receita Federal.</p>
                  </div>
                )}

                {p.type === 'particular' && p.status === 'generated' && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <p className="font-medium">Próximo passo:</p>
                    <p>Imprima a procuração, assine com firma reconhecida em cartório, e envie o documento digitalizado para a TaxCredit.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
