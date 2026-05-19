'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { authedFetcher, getApiUrl, getToken, SWR_OPTIONS_MEDIUM } from '@/lib/fetcher';

// ─────────────────────────────────────────────────────────────────────
// Tipos esperados das respostas SERPRO (parciais — apenas campos usados)
// ─────────────────────────────────────────────────────────────────────
type SerproConnection = {
  id: string;
  cnpj: string;
  companyName: string;
  status: 'pending' | 'active' | 'error' | string;
  environment: string;
  procuracaoOk?: boolean;
  lastSyncAt?: string | null;
};

type ApiResp<T> = { success: boolean; data?: T; error?: string };

type LooseObj = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────────────
const formatCnpj = (v: string) => {
  const d = (v || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

const formatCurrency = (v: number | string | undefined) => {
  if (v === undefined || v === null || v === '') return '—';
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

type Tab = 'perdcomp' | 'caixa' | 'fiscal' | 'processos' | 'parcelamento';

const TABS: Array<{ id: Tab; label: string; icon: string; color: string }> = [
  { id: 'perdcomp', label: 'PER/DCOMPs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'indigo' },
  { id: 'caixa', label: 'Caixa Postal', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'amber' },
  { id: 'fiscal', label: 'Situacao Fiscal', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'emerald' },
  { id: 'processos', label: 'Processos', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'rose' },
  { id: 'parcelamento', label: 'Parcelamentos', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', color: 'violet' },
];

// ─────────────────────────────────────────────────────────────────────
export default function AcompanhamentoPage() {
  // Setup
  const { data: connsResp } = useSWR<ApiResp<SerproConnection[]>>(
    '/api/serpro/connections',
    authedFetcher,
    SWR_OPTIONS_MEDIUM,
  );
  const conns = connsResp?.data || [];
  const activeConns = useMemo(() => conns.filter(c => c.status === 'active'), [conns]);

  const [connId, setConnId] = useState<string>('');
  const [contribuinteCnpj, setContribuinteCnpj] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('perdcomp');

  // Estados por tab
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ perdcomp: false, caixa: false, fiscal: false, processos: false, parcelamento: false });
  const [results, setResults] = useState<Record<Tab, LooseObj | null>>({ perdcomp: null, caixa: null, fiscal: null, processos: null, parcelamento: null });
  const [errors, setErrors] = useState<Record<Tab, string | null>>({ perdcomp: null, caixa: null, fiscal: null, processos: null, parcelamento: null });

  // Campos auxiliares
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [perdcompNumero, setPerdcompNumero] = useState('');

  const conn = useMemo(() => conns.find(c => c.id === connId), [conns, connId]);
  const ready = !!conn && !!contribuinteCnpj && contribuinteCnpj.replace(/\D/g, '').length === 14;

  const apiBase = getApiUrl();
  const token = typeof window !== 'undefined' ? getToken() : '';

  async function callSerpro(path: string, body: LooseObj, tab: Tab) {
    if (!conn) return;
    setLoading(s => ({ ...s, [tab]: true }));
    setErrors(s => ({ ...s, [tab]: null }));
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data: ApiResp<LooseObj> = await res.json();
      if (!data.success) {
        setErrors(s => ({ ...s, [tab]: data.error || 'Falha na consulta SERPRO' }));
        setResults(s => ({ ...s, [tab]: null }));
      } else {
        setResults(s => ({ ...s, [tab]: data.data || {} }));
      }
    } catch (e: any) {
      setErrors(s => ({ ...s, [tab]: e?.message || 'Erro de rede' }));
    } finally {
      setLoading(s => ({ ...s, [tab]: false }));
    }
  }

  // Loaders por tab
  const loadPerdcomp = () => {
    if (!conn) return;
    const numeroLimpo = perdcompNumero.replace(/\s/g, '');
    if (numeroLimpo) {
      callSerpro(`/api/serpro/connections/${conn.id}/perdcomp/consulta`, {
        contribuinteCnpj: contribuinteCnpj.replace(/\D/g, ''),
        numero: numeroLimpo,
      }, 'perdcomp');
    } else {
      callSerpro(`/api/serpro/connections/${conn.id}/perdcomp/lista`, {
        contribuinteCnpj: contribuinteCnpj.replace(/\D/g, ''),
        periodoInicio: periodoInicio || undefined,
        periodoFim: periodoFim || undefined,
      }, 'perdcomp');
    }
  };

  const loadCaixa = () => conn && callSerpro(`/api/serpro/connections/${conn.id}/caixa-postal`, { contribuinteCnpj: contribuinteCnpj.replace(/\D/g, '') }, 'caixa');
  const loadFiscal = () => conn && callSerpro(`/api/serpro/connections/${conn.id}/situacao-fiscal`, { contribuinteCnpj: contribuinteCnpj.replace(/\D/g, '') }, 'fiscal');
  const loadProcessos = () => conn && callSerpro(`/api/serpro/connections/${conn.id}/processos`, { contribuinteCnpj: contribuinteCnpj.replace(/\D/g, '') }, 'processos');
  const loadParcelamento = async () => {
    if (!conn) return;
    setLoading(s => ({ ...s, parcelamento: true }));
    setErrors(s => ({ ...s, parcelamento: null }));
    try {
      const cnpjLimpo = contribuinteCnpj.replace(/\D/g, '');
      const [rfb, pgfn] = await Promise.all([
        fetch(`${apiBase}/api/serpro/connections/${conn.id}/parcelamento-rfb`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ contribuinteCnpj: cnpjLimpo }) }).then(r => r.json()),
        fetch(`${apiBase}/api/serpro/connections/${conn.id}/parcelamento-pgfn`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ contribuinteCnpj: cnpjLimpo }) }).then(r => r.json()),
      ]);
      setResults(s => ({ ...s, parcelamento: { rfb: rfb?.data, pgfn: pgfn?.data, rfbOk: !!rfb?.success, pgfnOk: !!pgfn?.success } }));
    } catch (e: any) {
      setErrors(s => ({ ...s, parcelamento: e?.message || 'Erro de rede' }));
    } finally {
      setLoading(s => ({ ...s, parcelamento: false }));
    }
  };

  const triggerLoad = () => {
    if (!ready) { alert('Selecione uma conexao SERPRO ativa e informe o CNPJ do contribuinte (14 digitos)'); return; }
    if (activeTab === 'perdcomp') loadPerdcomp();
    else if (activeTab === 'caixa') loadCaixa();
    else if (activeTab === 'fiscal') loadFiscal();
    else if (activeTab === 'processos') loadProcessos();
    else if (activeTab === 'parcelamento') loadParcelamento();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Acompanhamento Receita Federal</h1>
              <p className="text-sm text-gray-500">Consulta automatica de PER/DCOMPs, caixa postal, situacao fiscal e processos via integracao SERPRO oficial</p>
            </div>
          </div>
        </div>

        {/* Setup card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Conexao SERPRO (procurador)</label>
              <select
                value={connId}
                onChange={e => setConnId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Escolha a conexao SERPRO --</option>
                {conns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({formatCnpj(c.cnpj)}) — {c.status === 'active' ? 'Ativa' : c.status} {c.procuracaoOk ? '· Procuracao OK' : ''}
                  </option>
                ))}
              </select>
              {conns.length === 0 && (
                <p className="text-xs text-amber-700 mt-1.5">Nenhuma conexao SERPRO cadastrada. Configure em <a href="/admin/producao/serpro" className="underline font-semibold">SERPRO / e-CAC</a> primeiro.</p>
              )}
              {conns.length > 0 && activeConns.length === 0 && (
                <p className="text-xs text-amber-700 mt-1.5">Nenhuma conexao SERPRO esta ativa. Teste/ative em <a href="/admin/producao/serpro" className="underline font-semibold">SERPRO / e-CAC</a>.</p>
              )}
            </div>
            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">CNPJ do contribuinte</label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={contribuinteCnpj}
                onChange={e => setContribuinteCnpj(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">CNPJ do cliente final (a empresa cuja procuracao ja foi outorgada para a conexao acima)</p>
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={triggerLoad}
                disabled={!ready || loading[activeTab]}
                className="w-full px-4 py-2.5 text-sm font-bold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading[activeTab] ? 'Consultando...' : 'Consultar SERPRO'}
              </button>
            </div>
          </div>

          {/* Filtros adicionais por tab */}
          {activeTab === 'perdcomp' && (
            <div className="grid md:grid-cols-12 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div className="md:col-span-3">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Periodo Inicio (opcional)</label>
                <input type="text" placeholder="MM/AAAA" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 rounded-md" />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Periodo Fim (opcional)</label>
                <input type="text" placeholder="MM/AAAA" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 rounded-md" />
              </div>
              <div className="md:col-span-6">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Numero PER/DCOMP especifico (opcional, ignora os periodos)</label>
                <input type="text" placeholder="Ex: 12345678901234567890" value={perdcompNumero} onChange={e => setPerdcompNumero(e.target.value)} className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 rounded-md" />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap border-b border-gray-100 bg-gray-50">
            {TABS.map(t => {
              const isActive = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    isActive
                      ? `text-${t.color}-700 border-${t.color}-500 bg-white`
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                  </svg>
                  {t.label}
                  {results[t.id] && <span className="ml-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {!ready && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium">Selecione uma conexao SERPRO ativa e informe o CNPJ do contribuinte</p>
                <p className="text-xs text-gray-400 mt-1">Cliente precisa ter procuracao eletronica outorgada para o CNPJ da conexao</p>
              </div>
            )}

            {ready && errors[activeTab] && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-900">Erro na consulta SERPRO</p>
                <p className="text-xs text-red-700 mt-0.5">{errors[activeTab]}</p>
              </div>
            )}

            {ready && !results[activeTab] && !loading[activeTab] && !errors[activeTab] && (
              <div className="text-center py-12 text-sm text-gray-500">
                Clique em <strong>Consultar SERPRO</strong> para buscar os dados deste contribuinte
              </div>
            )}

            {loading[activeTab] && (
              <div className="text-center py-12">
                <svg className="animate-spin w-8 h-8 text-indigo-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <p className="text-sm text-gray-500">Consultando SERPRO em tempo real...</p>
              </div>
            )}

            {ready && results[activeTab] && !loading[activeTab] && (
              <div>
                {/* Bandeira tab */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">SERPRO OFICIAL</span>
                    <span className="text-gray-500">Contribuinte: <strong className="text-gray-800">{formatCnpj(contribuinteCnpj)}</strong></span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">Procurador: <strong className="text-gray-800">{conn?.companyName}</strong></span>
                  </div>
                  <button
                    onClick={triggerLoad}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    Atualizar
                  </button>
                </div>

                {/* Render bruto + amigavel */}
                <ResultRenderer tab={activeTab} data={results[activeTab]} />
              </div>
            )}
          </div>
        </div>

        {/* Aviso transparencia */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
          <p className="font-bold mb-1">Sobre esta integracao</p>
          <p>Esta tela consulta a Receita Federal via API oficial do SERPRO usando o convenio da conexao escolhida. Cliente precisa ter outorgado procuracao eletronica para o CNPJ procurador. <strong>Esta integracao consulta dados — nao submete PER/DCOMP</strong> (a Receita nao oferece API publica de submissao). Para submeter, use o Guia PER/DCOMP em <a href="/admin/producao/formalizacao" className="underline font-semibold">Formalizacao</a>.</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Renderer dos resultados — fallback amigavel + JSON colapsado
// ─────────────────────────────────────────────────────────────────────
function ResultRenderer({ tab, data }: { tab: Tab; data: LooseObj | null }) {
  if (!data) return null;

  if (tab === 'perdcomp') return <PerdcompResult data={data} />;
  if (tab === 'caixa') return <CaixaPostalResult data={data} />;
  if (tab === 'fiscal') return <SituacaoFiscalResult data={data} />;
  if (tab === 'processos') return <ProcessosResult data={data} />;
  if (tab === 'parcelamento') return <ParcelamentoResult data={data} />;
  return <RawJson data={data} />;
}

function RawJson({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center justify-between">
        <span>{open ? 'Ocultar' : 'Mostrar'} resposta SERPRO completa (JSON)</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <pre className="px-4 pb-4 text-[10px] font-mono whitespace-pre-wrap break-all text-gray-700 max-h-96 overflow-y-auto">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

function PerdcompResult({ data }: { data: any }) {
  // SERPRO retorna em geral { listaPerdcomp: [...] } ou { dados: {...} } para consulta unica
  const lista: any[] = data?.listaPerdcomp || data?.lista || data?.perdcomps || (Array.isArray(data) ? data : []);
  const isLista = lista && lista.length > 0;
  const single = !isLista ? (data?.perdcomp || data?.dados || data) : null;

  if (!isLista && !single) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Nenhum PER/DCOMP encontrado para os filtros informados.
        <RawJson data={data} />
      </div>
    );
  }

  if (isLista) {
    return (
      <div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-900">{lista.length} PER/DCOMP{lista.length === 1 ? '' : 's'} encontrado{lista.length === 1 ? '' : 's'}</p>
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(lista, null, 2))} className="text-xs px-2 py-1 bg-white text-emerald-700 rounded font-bold hover:bg-emerald-100">Copiar lista</button>
        </div>
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-gray-600 uppercase tracking-wide">Numero</th>
                <th className="px-3 py-2.5 text-left font-bold text-gray-600 uppercase tracking-wide">Tipo</th>
                <th className="px-3 py-2.5 text-left font-bold text-gray-600 uppercase tracking-wide">Tributo</th>
                <th className="px-3 py-2.5 text-left font-bold text-gray-600 uppercase tracking-wide">Periodo</th>
                <th className="px-3 py-2.5 text-right font-bold text-gray-600 uppercase tracking-wide">Valor</th>
                <th className="px-3 py-2.5 text-center font-bold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-center font-bold text-gray-600 uppercase tracking-wide">Transmitido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((p, i) => {
                const numero = p?.numero || p?.numeroPerdcomp || p?.protocolo || `(linha ${i + 1})`;
                const tipo = p?.tipoDocumento || p?.tipo || '—';
                const tributo = p?.tributo || p?.codigoReceita || '—';
                const periodo = p?.periodoApuracao || p?.periodo || '—';
                const valor = p?.valorTotal || p?.valor || p?.valorCredito;
                const status = p?.situacao || p?.status || '—';
                const transmitido = p?.dataTransmissao || p?.transmitidoEm || p?.dataEnvio || '—';
                const statusLow = String(status).toLowerCase();
                const statusColor = statusLow.includes('homolog') || statusLow.includes('deferido')
                  ? 'bg-emerald-100 text-emerald-800'
                  : statusLow.includes('analise') || statusLow.includes('processo') || statusLow.includes('ativ')
                  ? 'bg-blue-100 text-blue-800'
                  : statusLow.includes('nao') || statusLow.includes('indef') || statusLow.includes('cancel')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-700';
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-bold text-indigo-700">{numero}</td>
                    <td className="px-3 py-2">{tipo}</td>
                    <td className="px-3 py-2">{tributo}</td>
                    <td className="px-3 py-2 font-mono">{periodo}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(valor)}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{status}</span></td>
                    <td className="px-3 py-2 text-center text-gray-500">{transmitido}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <RawJson data={data} />
        </div>
      </div>
    );
  }

  // Single
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid md:grid-cols-2 gap-4">
        <Field label="Numero PER/DCOMP" value={single?.numero || single?.numeroPerdcomp} mono />
        <Field label="Tipo" value={single?.tipoDocumento || single?.tipo} />
        <Field label="Tributo" value={single?.tributo || single?.codigoReceita} />
        <Field label="Periodo Apuracao" value={single?.periodoApuracao || single?.periodo} mono />
        <Field label="Valor do Credito" value={formatCurrency(single?.valorTotal || single?.valor || single?.valorCredito)} highlight />
        <Field label="Situacao" value={single?.situacao || single?.status} />
        <Field label="Transmitido em" value={single?.dataTransmissao || single?.dataEnvio} />
        <Field label="Despacho" value={single?.despacho || single?.dataDespacho} />
      </div>
      <div className="mt-4"><RawJson data={data} /></div>
    </div>
  );
}

function CaixaPostalResult({ data }: { data: any }) {
  const mensagens: any[] = data?.mensagens || data?.lista || (Array.isArray(data) ? data : []);
  if (!mensagens || mensagens.length === 0) {
    return <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">Caixa postal vazia. <RawJson data={data} /></div>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700 mb-2">{mensagens.length} mensagem{mensagens.length === 1 ? '' : 'ns'} na caixa postal</p>
      {mensagens.map((m, i) => {
        const lida = m?.lida || m?.statusLeitura;
        const titulo = m?.titulo || m?.assunto || `Mensagem ${i + 1}`;
        const data2 = m?.dataEnvio || m?.data || '—';
        return (
          <div key={i} className={`rounded-xl border p-4 ${lida ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-bold ${lida ? 'text-gray-700' : 'text-amber-900'}`}>{titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{data2}</p>
                {m?.descricao && <p className="text-xs text-gray-700 mt-2">{m.descricao}</p>}
              </div>
              {!lida && <span className="text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">NAO LIDA</span>}
            </div>
          </div>
        );
      })}
      <RawJson data={data} />
    </div>
  );
}

function SituacaoFiscalResult({ data }: { data: any }) {
  const cnd = data?.cnd || data?.situacaoCnd || data?.situacao;
  const irregularidades: any[] = data?.irregularidades || data?.pendencias || [];
  return (
    <div className="space-y-4">
      {cnd && (
        <div className={`rounded-xl border p-4 ${
          String(cnd).toLowerCase().includes('regular') ? 'bg-emerald-50 border-emerald-200' :
          String(cnd).toLowerCase().includes('positiv') ? 'bg-amber-50 border-amber-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Situacao Fiscal</p>
          <p className="text-lg font-bold text-gray-900">{cnd}</p>
        </div>
      )}
      {irregularidades.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Pendencias detectadas ({irregularidades.length})</p>
          <div className="space-y-2">
            {irregularidades.map((p: any, i: number) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-red-900">{p?.descricao || p?.tipo || 'Pendencia'}</p>
                {p?.valor && <p className="text-red-700">{formatCurrency(p.valor)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      <RawJson data={data} />
    </div>
  );
}

function ProcessosResult({ data }: { data: any }) {
  const lista: any[] = data?.processos || data?.lista || (Array.isArray(data) ? data : []);
  if (!lista || lista.length === 0) return <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">Nenhum processo administrativo localizado. <RawJson data={data} /></div>;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700 mb-2">{lista.length} processo{lista.length === 1 ? '' : 's'} administrativo{lista.length === 1 ? '' : 's'}</p>
      {lista.map((p, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 grid md:grid-cols-4 gap-3">
          <Field label="Numero" value={p?.numero || p?.numeroProcesso} mono />
          <Field label="Assunto" value={p?.assunto || p?.tipo} />
          <Field label="Situacao" value={p?.situacao || p?.status} />
          <Field label="Data" value={p?.dataAbertura || p?.data} />
        </div>
      ))}
      <RawJson data={data} />
    </div>
  );
}

function ParcelamentoResult({ data }: { data: any }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Parcelamento RFB (Receita Federal)</p>
        {data?.rfbOk ? (
          <pre className="text-[10px] font-mono whitespace-pre-wrap text-gray-700 max-h-64 overflow-y-auto">{JSON.stringify(data?.rfb || {}, null, 2)}</pre>
        ) : (
          <p className="text-sm text-gray-400">Sem parcelamento ativo na RFB</p>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Parcelamento PGFN (Procuradoria)</p>
        {data?.pgfnOk ? (
          <pre className="text-[10px] font-mono whitespace-pre-wrap text-gray-700 max-h-64 overflow-y-auto">{JSON.stringify(data?.pgfn || {}, null, 2)}</pre>
        ) : (
          <p className="text-sm text-gray-400">Sem parcelamento ativo na PGFN</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono, highlight }: { label: string; value: any; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`${mono ? 'font-mono' : ''} ${highlight ? 'text-emerald-700 font-bold text-base' : 'text-gray-900'} text-sm`}>{value || '—'}</p>
    </div>
  );
}
