'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Snapshot = {
  id: string;
  clientId: string;
  cnpj: string;
  procurationId: string | null;
  caixaPostalUnread: number;
  situacaoStatus: string | null;
  situacaoPendencias: number;
  dctfwebAtrasos: number;
  score: number | null;
  collectedAt: string;
  client?: { id: string; name: string | null; company: string | null; cnpj: string | null };
};

type Stats = {
  total: number;
  caixaPendente: number;
  situacaoComPendencia: number;
  scoreMedio: number;
};

async function api(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type Procurador = { id: string; cnpj: string; razaoSocial: string; ativo: boolean };
type Top5Item = { clientId: string; nome: string; cnpj: string; score: number; caixaPostalUnread: number; situacaoStatus: string | null; situacaoPendencias: number };

export default function ConsultriConformidadePage() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [top5, setTop5] = useState<Top5Item[]>([]);
  const [procuradores, setProcuradores] = useState<Procurador[]>([]);
  const [filterProcuradorId, setFilterProcuradorId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'risk' | 'caixa' | 'pend'>('all');
  const [sort, setSort] = useState<'score' | 'pend' | 'caixa' | 'date'>('score');

  async function loadProcuradores() {
    try {
      const r = await api('/consultri/procuradores');
      setProcuradores(r.data || []);
    } catch { /* silent */ }
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const qs = filterProcuradorId ? `?procuradorEntityId=${filterProcuradorId}` : '';
      const r = await api(`/consultri/conformidade${qs}`);
      setSnaps(r.data || []);
      setStats(r.stats || null);
      setTop5(r.top5 || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCollect() {
    setCollecting(true);
    try {
      const r = await api('/procuration/jobs/collect-conformidade', { method: 'POST' });
      alert(`Coleta concluida: ${JSON.stringify(r.data)}`);
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setCollecting(false);
    }
  }

  useEffect(() => { load(); }, [filterProcuradorId]);
  useEffect(() => { loadProcuradores(); }, []);

  const visible = useMemo(() => {
    let arr = [...snaps];
    if (filter === 'risk')  arr = arr.filter(s => (s.score ?? 100) < 60);
    if (filter === 'caixa') arr = arr.filter(s => s.caixaPostalUnread > 0);
    if (filter === 'pend')  arr = arr.filter(s => s.situacaoStatus === 'pendencias');

    arr.sort((a, b) => {
      if (sort === 'score') return (a.score ?? 100) - (b.score ?? 100);
      if (sort === 'pend')  return b.situacaoPendencias - a.situacaoPendencias;
      if (sort === 'caixa') return b.caixaPostalUnread - a.caixaPostalUnread;
      return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
    });
    return arr;
  }, [snaps, filter, sort]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/consultri/carteira" className="text-gray-400 hover:text-white">← Carteira</Link>
              <span className="text-gray-700">/</span>
              <span className="text-gray-300">Conformidade</span>
            </div>
            <h1 className="text-xl font-bold mt-1">Conformidade Tributaria · CONSULTRI</h1>
            <p className="text-xs text-gray-400">
              Caixa Postal e-CAC · Situacao Fiscal · DCTFWeb · score automatico
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {procuradores.length > 0 && (
              <select
                value={filterProcuradorId}
                onChange={e => setFilterProcuradorId(e.target.value)}
                className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200"
              >
                <option value="">Todos procuradores</option>
                {procuradores.filter(p => p.ativo).map(p => (
                  <option key={p.id} value={p.id}>{p.razaoSocial}</option>
                ))}
              </select>
            )}
            <button
              onClick={runCollect}
              disabled={collecting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {collecting ? 'Coletando…' : 'Coletar agora'}
            </button>
            <button
              onClick={load}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
            >
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Clientes monitorados" value={stats?.total ?? '—'} tone="white" />
          <Card label="Caixa Postal pendente" value={stats?.caixaPendente ?? '—'} tone="yellow" />
          <Card label="Situacao com pendencia" value={stats?.situacaoComPendencia ?? '—'} tone="red" />
          <Card label="Score medio" value={stats?.scoreMedio ?? '—'} tone="emerald" suffix="/100" />
        </div>
      </section>

      {/* Top 5 em risco */}
      {snaps.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pt-6">
          <h2 className="text-xs uppercase tracking-wider font-bold text-red-400 mb-3">
            Top 5 carteira CONSULTRI em risco (menor score)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[...snaps].sort((a, b) => (a.score ?? 100) - (b.score ?? 100)).slice(0, 5).map(s => (
              <Link
                key={s.id}
                href={s.procurationId
                  ? `/consultri/cliente/${encodeURIComponent(s.clientId)}/procuracao?procId=${s.procurationId}`
                  : '#'}
                className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/30 rounded-xl p-4 hover:border-red-400 transition"
              >
                <p className="text-xs text-gray-400 truncate" title={s.client?.company || s.cnpj}>
                  {s.client?.company || s.client?.name || s.cnpj}
                </p>
                <p className="text-3xl font-black text-red-300 mt-1">{s.score ?? 0}</p>
                <div className="flex gap-2 mt-2 text-[10px] text-gray-400">
                  {s.caixaPostalUnread > 0 && <span className="text-yellow-300">📬{s.caixaPostalUnread}</span>}
                  {s.situacaoPendencias > 0 && <span className="text-red-300">⚠{s.situacaoPendencias}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 pt-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'all',   l: 'Todos' },
            { k: 'risk',  l: 'Risco (<60)' },
            { k: 'caixa', l: 'Caixa pendente' },
            { k: 'pend',  l: 'Situacao com pendencia' },
          ].map(f => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === f.k
                  ? 'bg-white text-gray-950 border-white'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-300"
        >
          <option value="score">Ordenar por: Score (menor primeiro)</option>
          <option value="pend">Pendencias fiscais</option>
          <option value="caixa">Mensagens Caixa Postal</option>
          <option value="date">Ultima coleta</option>
        </select>
      </section>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-16">
        {loading && <p className="text-gray-500 text-center py-12">Carregando snapshots…</p>}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl p-4">{error}</div>
        )}
        {!loading && visible.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-gray-300 mb-2">Nenhum snapshot coletado ainda.</p>
            <p className="text-gray-500 text-sm mb-6">
              O job <code className="text-emerald-400">collectConformidade</code> roda
              diariamente as 06:00 BRT. Clique "Coletar agora" para rodar manualmente.
            </p>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-800 text-xs uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="text-left p-4">Cliente</th>
                  <th className="text-center p-4">Score</th>
                  <th className="text-center p-4">Caixa Postal</th>
                  <th className="text-center p-4">Situacao Fiscal</th>
                  <th className="text-center p-4">DCTFWeb</th>
                  <th className="text-left p-4">Ultima coleta</th>
                  <th className="text-right p-4">Acao</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(s => {
                  const score = s.score ?? 0;
                  const scoreColor = score >= 80 ? 'text-emerald-300' : score >= 60 ? 'text-yellow-300' : 'text-red-300';
                  const scoreBar = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                  return (
                    <tr key={s.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                      <td className="p-4">
                        <p className="font-semibold">
                          {s.client?.company || s.client?.name || s.cnpj}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{s.cnpj}</p>
                      </td>
                      <td className="p-4 text-center">
                        <p className={`text-2xl font-black ${scoreColor}`}>{score}</p>
                        <div className="w-16 h-1 mx-auto bg-gray-800 rounded-full overflow-hidden mt-1">
                          <div className={`h-full ${scoreBar}`} style={{ width: `${score}%` }} />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {s.caixaPostalUnread > 0 ? (
                          <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                            {s.caixaPostalUnread} novas
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {s.situacaoStatus === 'limpo' && (
                          <span className="text-emerald-300 text-xs font-bold">Regular</span>
                        )}
                        {s.situacaoStatus === 'pendencias' && (
                          <span className="text-red-300 text-xs font-bold">{s.situacaoPendencias} pend.</span>
                        )}
                        {(!s.situacaoStatus || s.situacaoStatus === 'nao_consultado' || s.situacaoStatus === 'desconhecido') && (
                          <span className="text-gray-500 text-xs">{s.situacaoStatus || '—'}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {s.dctfwebAtrasos > 0 ? (
                          <span className="text-orange-300 text-xs font-bold">{s.dctfwebAtrasos} atrasos</span>
                        ) : (
                          <span className="text-gray-600 text-xs">ok</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 text-xs">
                        {new Date(s.collectedAt).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="p-4 text-right">
                        {s.procurationId && (
                          <Link
                            href={`/consultri/cliente/${encodeURIComponent(s.clientId)}/procuracao?procId=${s.procurationId}`}
                            className="text-xs text-sky-400 hover:underline"
                          >
                            Detalhes →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({
  label, value, tone, suffix,
}: { label: string; value: string | number; tone: 'white' | 'emerald' | 'yellow' | 'red'; suffix?: string }) {
  const colors: Record<string, string> = {
    white:   'border-gray-700 text-white',
    emerald: 'border-emerald-500/40 text-emerald-300',
    yellow:  'border-yellow-500/40 text-yellow-300',
    red:     'border-red-500/40 text-red-300',
  };
  return (
    <div className={`bg-gray-900 border ${colors[tone]} rounded-xl p-4`}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</p>
      <p className="text-3xl font-black">
        {value}{suffix && <span className="text-base text-gray-500 font-normal">{suffix}</span>}
      </p>
    </div>
  );
}
