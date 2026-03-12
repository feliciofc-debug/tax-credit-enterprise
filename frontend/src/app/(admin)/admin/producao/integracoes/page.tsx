'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher } from '@/lib/fetcher';

const fmt = (v?: number | null) => v == null ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const providers = [
  { id: 'omie', name: 'Omie', desc: 'ERP com API nativa — puxa NFes automaticamente', color: 'blue', fields: ['appKey', 'appSecret'] },
  { id: 'oracle', name: 'Oracle', desc: 'EBS / Cloud — conecta via webhook', color: 'red', fields: [] },
  { id: 'sap', name: 'SAP', desc: 'S/4HANA — conecta via webhook', color: 'indigo', fields: [] },
  { id: 'totvs', name: 'TOTVS', desc: 'Protheus / RM — conecta via webhook', color: 'green', fields: [] },
  { id: 'webhook', name: 'Webhook Genérico', desc: 'Qualquer sistema — recebe dados via POST', color: 'gray', fields: [] },
];

type View = 'list' | 'new' | 'detail';

export default function IntegracoesPage() {
  const { data: resp, isLoading } = useSWR<{ success: boolean; data: any[] }>('/api/integrations', authedFetcher, { revalidateOnFocus: false });
  const [view, setView] = useState<View>('list');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [form, setForm] = useState({ cnpj: '', companyName: '', appKey: '', appSecret: '', regime: 'simples' });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const integrations = resp?.data || [];

  const formatCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  };

  const handleCreate = async () => {
    if (!selectedProvider || !form.cnpj) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = { cnpj: form.cnpj.replace(/\D/g, ''), companyName: form.companyName, provider: selectedProvider, regime: form.regime };
      if (selectedProvider === 'omie') body.configJson = { appKey: form.appKey, appSecret: form.appSecret };
      const res = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      setResult(data);
      mutate('/api/integrations');
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setCreating(false);
    }
  };

  const loadDetail = async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/integrations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) { setDetail(data.data); setView('detail'); }
  };

  const handleSync = async (id: string) => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/integrations/${id}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
      const data = await res.json();
      alert(data.success ? `Sync completo: ${data.totalNfes} NFes, ${fmt(data.totalRecuperavel)} recuperável` : `Erro: ${data.error}`);
      loadDetail(id);
      mutate('/api/integrations');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrações ERP</h1>
            <p className="text-gray-500 text-sm">Conecte ERPs para receber dados automaticamente via webhook ou API</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setView('list'); setResult(null); }} className={`px-4 py-2 text-sm font-medium rounded-lg ${view === 'list' ? 'bg-white shadow text-gray-900 border' : 'text-gray-500'}`}>Lista</button>
          <button onClick={() => { setView('new'); setResult(null); setSelectedProvider(null); }} className={`px-4 py-2 text-sm font-medium rounded-lg ${view === 'new' ? 'bg-white shadow text-gray-900 border' : 'text-gray-500'}`}>Nova Integração</button>
        </div>
      </div>

      {view === 'new' && (
        <div>
          {!result ? (
            <>
              <div className="grid md:grid-cols-5 gap-4 mb-8">
                {providers.map(p => (
                  <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${selectedProvider === p.id ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 hover:border-cyan-300'}`}>
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
              {selectedProvider && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8">
                  <h2 className="text-lg font-bold mb-6">Configurar {providers.find(p => p.id === selectedProvider)?.name}</h2>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                      <input type="text" value={formatCnpj(form.cnpj)} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
                      <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Razão social" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Regime</label>
                      <select value={form.regime} onChange={e => setForm({ ...form, regime: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                        <option value="simples">Simples Nacional</option>
                        <option value="lucro_real">Lucro Real</option>
                        <option value="lucro_presumido">Lucro Presumido</option>
                      </select>
                    </div>
                  </div>
                  {selectedProvider === 'omie' && (
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Omie App Key</label>
                        <input type="text" value={form.appKey} onChange={e => setForm({ ...form, appKey: e.target.value })} placeholder="Encontre em Omie > Configurações > API" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Omie App Secret</label>
                        <input type="password" value={form.appSecret} onChange={e => setForm({ ...form, appSecret: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                      </div>
                    </div>
                  )}
                  {selectedProvider !== 'omie' && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-6">
                      <p className="text-sm text-cyan-800">Ao criar a integração, você receberá uma <strong>URL de webhook</strong> e uma <strong>API Key</strong> para configurar no seu ERP.</p>
                    </div>
                  )}
                  <button onClick={handleCreate} disabled={creating || !form.cnpj} className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold disabled:opacity-40 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg">
                    {creating ? 'Criando...' : 'Criar Integração'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              {result.success ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <h2 className="text-xl font-bold text-green-800">Integração criada com sucesso!</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">API Key (copie e guarde — não será exibida novamente)</p>
                      <code className="text-sm bg-gray-900 text-green-400 px-4 py-2 rounded-lg block break-all">{result.data?.apiKey}</code>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">Webhook URL</p>
                      <code className="text-sm bg-gray-900 text-cyan-400 px-4 py-2 rounded-lg block break-all">{result.data?.webhookUrl}</code>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                      <p className="text-sm text-cyan-800">{result.data?.instructions}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-2">Exemplo de envio (curl)</p>
                      <code className="text-xs bg-gray-900 text-gray-300 px-4 py-2 rounded-lg block whitespace-pre-wrap">
{`curl -X POST "${result.data?.webhookUrl}" \\
  -F "files=@nota_fiscal.xml"`}
                      </code>
                    </div>
                  </div>
                  <button onClick={() => { setView('list'); setResult(null); }} className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Ver integrações</button>
                </div>
              ) : (
                <p className="text-red-600">Erro: {result.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && detail && (
        <div>
          <button onClick={() => setView('list')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> Voltar
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{detail.companyName}</h2>
                <p className="text-gray-500 text-sm">{detail.cnpj} | {detail.provider.toUpperCase()} | {detail.status}</p>
              </div>
              {detail.provider === 'omie' && (
                <button onClick={() => handleSync(detail.id)} disabled={syncing} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-50">
                  {syncing ? 'Sincronizando...' : 'Sincronizar Omie'}
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500">Eventos</p><p className="text-2xl font-bold">{detail.totalEvents}</p></div>
              <div className="bg-cyan-50 rounded-xl p-4"><p className="text-xs text-cyan-600">Créditos</p><p className="text-2xl font-bold text-cyan-600">{fmt(detail.totalCreditos)}</p></div>
              <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-green-600">Comissão</p><p className="text-2xl font-bold text-green-600">{fmt(detail.totalComissao)}</p></div>
              <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500">Último evento</p><p className="text-sm font-medium mt-1">{detail.lastEventAt ? new Date(detail.lastEventAt).toLocaleString('pt-BR') : 'Nenhum'}</p></div>
            </div>
          </div>
          {detail.apiKeys?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-3">API Keys</h3>
              {detail.apiKeys.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-2">
                  <div>
                    <code className="text-sm font-mono text-gray-700">{k.keyPrefix}••••••••</code>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{k.isActive ? 'Ativa' : 'Inativa'}</span>
                  </div>
                  <p className="text-xs text-gray-400">{k.usageCount} usos | Último: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('pt-BR') : 'nunca'}</p>
                </div>
              ))}
            </div>
          )}
          {detail.logs?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-3">Log de Eventos</h3>
              <div className="space-y-2">
                {detail.logs.map((log: any) => (
                  <div key={log.id} className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${log.status === 'error' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${log.status === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="font-medium text-gray-700">{log.eventType}</span>
                      {log.fileName && <span className="text-gray-400">{log.fileName}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {log.creditosFound > 0 && <span className="text-cyan-600 font-medium">{fmt(log.creditosFound)}</span>}
                      {log.alertsGenerated > 0 && <span>{log.alertsGenerated} alertas</span>}
                      {log.processingMs && <span>{log.processingMs}ms</span>}
                      <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <div>
          {isLoading ? (
            <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto" /></div>
          ) : !integrations.length ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Conecte seu primeiro ERP</h2>
              <p className="text-gray-500 max-w-lg mx-auto mb-8">Receba NFes e SPEDs automaticamente via webhook. Compatível com Omie, Oracle, SAP, TOTVS e qualquer outro sistema.</p>
              <button onClick={() => setView('new')} className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:from-cyan-500 hover:to-blue-500 transition-all">
                Nova Integração
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((int: any) => (
                <div key={int.id} onClick={() => loadDetail(int.id)} className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-cyan-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900">{int.companyName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${int.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{int.status}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 font-medium">{int.provider.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-gray-500">{int.cnpj} | {int._count?.logs || 0} eventos | {int._count?.revenueEvents || 0} receitas</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right"><p className="text-sm font-bold text-cyan-600">{fmt(int.totalCreditos)}</p><p className="text-[10px] text-gray-400">créditos</p></div>
                      <div className="text-right"><p className="text-sm font-bold text-green-600">{fmt(int.totalComissao)}</p><p className="text-[10px] text-gray-400">comissão</p></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
