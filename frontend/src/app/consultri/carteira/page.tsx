'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Procuration = {
  id: string;
  clientId: string;
  presetKey: string | null;
  procuradorCnpj: string | null;
  procuradorNome: string | null;
  status: string;
  serproStatus: string | null;
  serproDiff: { granted: string[]; missing: string[]; extras: string[] } | null;
  lastSerproCheckAt: string | null;
  dataValidade: string | null;
  createdAt: string;
  grantMode?: string | null;
  client?: { id: string; name: string; company: string | null; cnpj: string | null; email?: string } | null;
};

type Preset = {
  key: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  prazoMeses: number;
  totalPoderes: number;
};

type ProcuradorEntity = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  cor: string | null;
  ativo: boolean;
  _count?: { procurations: number };
};

type ClientEntry = {
  id: string;
  name?: string;
  company?: string;
  cnpj?: string;
  _source?: string;
};

const CONSULTRI_BRAND = {
  primary: '#0ea5e9',
  accent: '#10b981',
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function statusBadge(p: Procuration): { label: string; color: string; bg: string } {
  const serpro = p.serproStatus || 'pending_serpro';
  const dias = daysUntil(p.dataValidade);
  if (serpro === 'active' && (dias === null || dias > 30)) {
    return { label: 'Ativa', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/40' };
  }
  if (serpro === 'active' && dias !== null && dias <= 30 && dias > 7) {
    return { label: `Vence em ${dias}d`, color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/40' };
  }
  if (serpro === 'active' && dias !== null && dias <= 7) {
    return { label: `URGENTE - ${dias}d`, color: 'text-red-300', bg: 'bg-red-500/15 border-red-500/40' };
  }
  if (serpro === 'partial') {
    return { label: 'Poderes faltando', color: 'text-orange-300', bg: 'bg-orange-500/15 border-orange-500/40' };
  }
  if (serpro === 'not_found') {
    return { label: 'Nao outorgada', color: 'text-red-300', bg: 'bg-red-500/15 border-red-500/40' };
  }
  if (serpro === 'pending_serpro') {
    return { label: 'Aguardando verificacao', color: 'text-sky-300', bg: 'bg-sky-500/15 border-sky-500/40' };
  }
  return { label: serpro, color: 'text-gray-300', bg: 'bg-gray-500/15 border-gray-500/40' };
}

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

export default function ConsultriCarteiraPage() {
  const [procs, setProcs] = useState<Procuration[]>([]);
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expiring' | 'missing'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [procuradores, setProcuradores] = useState<ProcuradorEntity[]>([]);
  const [filterProcuradorId, setFilterProcuradorId] = useState<string>('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const qs = filterProcuradorId ? `&procuradorEntityId=${filterProcuradorId}` : '';
      const [pRes, cRes, presetRes, procEntRes] = await Promise.all([
        api(`/procuration/list?type=ecac_preset${qs}`).catch(() => api(`/procuration/list?${qs.slice(1)}`)),
        api('/procuration/clients/list').catch(() => ({ data: [] })),
        api('/procuration/presets').catch(() => ({ data: [] })),
        fetch('/api/consultri/procuradores', { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token') || ''}` } })
          .then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      const filtered = (pRes.data || []).filter((p: Procuration) =>
        !p.presetKey || p.presetKey === 'consultri'
      );
      setProcs(filtered);
      setClients(cRes.data || []);
      setPresets(presetRes.data || []);
      setProcuradores(procEntRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar carteira');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterProcuradorId]);

  async function checkSerpro(id: string) {
    setBusyId(id);
    try {
      await api(`/procuration/${id}/check-serpro`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e: any) {
      alert('Erro ao verificar SERPRO: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function generatePreset(clientId: string) {
    setBusyId('new');
    try {
      await api('/procuration/generate-preset', {
        method: 'POST',
        body: JSON.stringify({ clientId, presetKey: 'consultri' }),
      });
      setShowAddModal(false);
      setSelectedClientId('');
      await load();
    } catch (e: any) {
      alert('Erro ao gerar procuracao: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    let active = 0, pending = 0, missing = 0, expiring = 0;
    for (const p of procs) {
      const s = p.serproStatus || 'pending_serpro';
      const d = daysUntil(p.dataValidade);
      if (s === 'active' && (d === null || d > 30)) active++;
      else if (s === 'active' && d !== null && d <= 30) expiring++;
      else if (s === 'partial') missing++;
      else pending++;
    }
    return { total: procs.length, active, pending, missing, expiring };
  }, [procs]);

  const visible = useMemo(() => {
    return procs.filter(p => {
      if (filter === 'all') return true;
      const s = p.serproStatus || 'pending_serpro';
      const d = daysUntil(p.dataValidade);
      if (filter === 'active') return s === 'active' && (d === null || d > 30);
      if (filter === 'pending') return s === 'pending_serpro' || s === 'not_found';
      if (filter === 'expiring') return s === 'active' && d !== null && d <= 30;
      if (filter === 'missing') return s === 'partial';
      return true;
    });
  }, [procs, filter]);

  const presetConsultri = presets.find(p => p.key === 'consultri');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg"
                style={{ background: CONSULTRI_BRAND.primary }}
              >
                C
              </div>
              <div>
                <h1 className="text-xl font-bold">CONSULTRI · Carteira de Procuracoes</h1>
                <p className="text-xs text-gray-400">
                  {presetConsultri
                    ? `Preset CNPJ ${presetConsultri.cnpj} · ${presetConsultri.prazoMeses} meses · ${presetConsultri.totalPoderes} poderes`
                    : 'Preset CONSULTRI'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/consultri"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              ← Deck
            </Link>
            {procuradores.length > 0 && (
              <select
                value={filterProcuradorId}
                onChange={e => setFilterProcuradorId(e.target.value)}
                className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200"
              >
                <option value="">Todos procuradores</option>
                {procuradores.filter(p => p.ativo).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.razaoSocial} ({p.cnpj})
                  </option>
                ))}
              </select>
            )}
            <Link
              href="/consultri/conformidade"
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
            >
              Conformidade
            </Link>
            <Link
              href="/consultri/configuracoes"
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
            >
              Configuracoes
            </Link>
            <a
              href="/api/procuration/carteira/csv?presetKey=consultri"
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
              download
            >
              Exportar CSV
            </a>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg font-semibold text-sm text-gray-950"
              style={{ background: CONSULTRI_BRAND.accent }}
            >
              + Nova procuracao
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={stats.total} tone="default" />
          <StatCard label="Ativas" value={stats.active} tone="emerald" />
          <StatCard label="Vencendo (<=30d)" value={stats.expiring} tone="yellow" />
          <StatCard label="Poderes faltando" value={stats.missing} tone="orange" />
          <StatCard label="Aguardando outorga" value={stats.pending} tone="sky" />
        </div>
      </section>

      {/* Filtros */}
      <section className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'all', label: 'Todas' },
            { k: 'active', label: 'Ativas' },
            { k: 'expiring', label: 'Vencendo' },
            { k: 'missing', label: 'Poderes faltando' },
            { k: 'pending', label: 'Aguardando' },
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
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tabela */}
      <main className="max-w-7xl mx-auto px-6 pt-6 pb-16">
        {loading && <p className="text-gray-400 py-12 text-center">Carregando carteira…</p>}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl p-4 my-4">
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-gray-300 text-lg mb-2">Nenhuma procuracao encontrada neste filtro.</p>
            <p className="text-gray-500 text-sm mb-6">
              Clique em <strong>+ Nova procuracao</strong> para gerar o guia CONSULTRI para um cliente.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 rounded-lg font-semibold text-gray-950"
              style={{ background: CONSULTRI_BRAND.accent }}
            >
              + Nova procuracao
            </button>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-800 text-xs uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="text-left p-4">Cliente outorgante</th>
                  <th className="text-left p-4">CNPJ</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Vigencia</th>
                  <th className="text-left p-4">Ult. verificacao</th>
                  <th className="text-right p-4">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const badge = statusBadge(p);
                  const dias = daysUntil(p.dataValidade);
                  const ultCheck = p.lastSerproCheckAt
                    ? new Date(p.lastSerproCheckAt).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })
                    : 'Nunca';
                  return (
                    <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="p-4">
                        <p className="font-semibold text-white">
                          {p.client?.company || p.client?.name || '(sem nome)'}
                        </p>
                      </td>
                      <td className="p-4 text-gray-400 font-mono text-xs">
                        {p.client?.cnpj || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                        {p.serproDiff && p.serproDiff.missing.length > 0 && (
                          <p className="text-xs text-orange-400 mt-1">
                            faltam {p.serproDiff.missing.length} poderes
                          </p>
                        )}
                        {p.grantMode && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            {p.grantMode === 'auto_serpro' ? 'auto SERPRO' : p.grantMode === 'manual_invite' ? 'link magico' : p.grantMode}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-gray-300">
                        {p.dataValidade
                          ? new Date(p.dataValidade).toLocaleDateString('pt-BR')
                          : '—'}
                        {dias !== null && (
                          <span className="text-xs text-gray-500 block">
                            {dias > 0 ? `${dias} dias` : `vencida ha ${-dias}d`}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 text-xs">{ultCheck}</td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => checkSerpro(p.id)}
                            disabled={busyId === p.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-50"
                          >
                            {busyId === p.id ? 'Verificando…' : 'Verificar SERPRO'}
                          </button>
                          <Link
                            href={`/consultri/cliente/${encodeURIComponent(p.clientId)}/procuracao?procId=${p.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700"
                          >
                            Detalhes
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal nova procuracao */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">Nova procuracao CONSULTRI</h2>
            <p className="text-gray-400 text-sm mb-5">
              Selecione um cliente. O sistema vai gerar o passo a passo personalizado
              (8 passos do CAV, vigencia {presetConsultri?.prazoMeses || 12} meses,
              {' '}{presetConsultri?.totalPoderes || 45} poderes) e ja deixa pronto para envio.
            </p>

            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">
              Cliente
            </label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full mt-2 mb-5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white"
            >
              <option value="">— Selecione —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {(c.company || c.name) + (c.cnpj ? ` · ${c.cnpj}` : '')}
                </option>
              ))}
            </select>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectedClientId && generatePreset(selectedClientId)}
                disabled={!selectedClientId || busyId === 'new'}
                className="px-5 py-2 rounded-lg font-semibold text-gray-950 disabled:opacity-50"
                style={{ background: CONSULTRI_BRAND.accent }}
              >
                {busyId === 'new' ? 'Gerando…' : 'Gerar guia + registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, tone,
}: { label: string; value: number; tone: 'default' | 'emerald' | 'yellow' | 'orange' | 'sky' }) {
  const tones: Record<typeof tone, string> = {
    default: 'border-gray-800',
    emerald: 'border-emerald-500/30',
    yellow: 'border-yellow-500/30',
    orange: 'border-orange-500/30',
    sky: 'border-sky-500/30',
  } as any;
  const colors: Record<typeof tone, string> = {
    default: 'text-white',
    emerald: 'text-emerald-300',
    yellow: 'text-yellow-300',
    orange: 'text-orange-300',
    sky: 'text-sky-300',
  } as any;
  return (
    <div className={`bg-gray-900 border ${tones[tone]} rounded-xl p-4`}>
      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</p>
      <p className={`text-3xl font-black ${colors[tone]}`}>{value}</p>
    </div>
  );
}
