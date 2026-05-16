'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Event = {
  ts: string;
  kind: string;
  icon: string;
  title: string;
  description?: string;
  meta?: any;
  severity?: string;
};

type Data = {
  cliente: { clientId: string; nome: string; cnpj: string };
  resumo: { procuracoes: number; ativas: number; totalEventos: number };
  procuracoes: any[];
  events: Event[];
};

const sevColors: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#60a5fa' };

export default function TimelinePage() {
  const params = useParams<{ id: string }>();
  // O id pode vir como procurationId; vou tentar resolver via /api/procurations/:id
  const idParam = params.id;
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'audit' | 'notif'>('all');

  function token() { return localStorage.getItem('admin_token') || localStorage.getItem('token') || ''; }

  async function resolveClientId() {
    if (idParam.startsWith('analysis_') || idParam.length > 20) {
      // tenta como procuration id primeiro
      try {
        const r = await fetch(`/api/procurations/${idParam}`, { headers: { Authorization: `Bearer ${token()}` } });
        const j = await r.json();
        if (j.success && j.data?.clientId) { setClientId(j.data.clientId); return; }
      } catch { /* fallback */ }
    }
    setClientId(idParam);
  }

  async function load(cid: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/consultri/cliente/${encodeURIComponent(cid)}/timeline?limit=300`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'falha');
      setData(j.data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { resolveClientId(); }, [idParam]);
  useEffect(() => { if (clientId) load(clientId); }, [clientId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.events;
    if (filter === 'critical') return data.events.filter(e => e.severity === 'critical' || e.severity === 'warning');
    if (filter === 'audit') return data.events.filter(e => e.kind.startsWith('audit:') || e.kind === 'procuration_created');
    if (filter === 'notif') return data.events.filter(e => e.kind.startsWith('notif:'));
    return data.events;
  }, [data, filter]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <Link href="/consultri/carteira" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← Carteira</Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🗓️ Timeline Consolidada
          </h1>
          {data?.cliente && (
            <p style={{ color: '#888', fontSize: 14 }}>
              <b style={{ color: '#fff' }}>{data.cliente.nome}</b> · CNPJ {data.cliente.cnpj} ·
              {' '}{data.resumo.procuracoes} procurações ({data.resumo.ativas} ativas) · {data.resumo.totalEventos} eventos
            </p>
          )}
        </header>

        {error && <div style={{ background: '#7f1d1d', padding: 12, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
        {loading && <div style={{ color: '#a78bfa' }}>Carregando...</div>}

        <div style={{ background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 10, padding: 12, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>Filtro:</span>
          {(['all', 'critical', 'audit', 'notif'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a3e',
              background: filter === f ? '#7c3aed' : '#0a0a14',
              color: filter === f ? '#fff' : '#888', cursor: 'pointer', fontSize: 12,
            }}>
              {f === 'all' ? 'Tudo' : f === 'critical' ? '🚨 Críticos/Alertas' : f === 'audit' ? '📌 Auditoria' : '🔔 Notificações'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>{filtered.length} de {data?.events?.length || 0}</span>
        </div>

        {/* Linha do tempo */}
        <div style={{ borderLeft: '2px solid #2a2a3e', marginLeft: 18, paddingLeft: 18 }}>
          {filtered.map((e, idx) => {
            const sev = sevColors[e.severity || 'info'] || '#60a5fa';
            return (
              <div key={idx} style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ position: 'absolute', left: -32, top: 4, width: 24, height: 24, borderRadius: 12, background: '#0a0a14', border: `2px solid ${sev}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  {e.icon}
                </div>
                <div style={{ background: '#13131f', border: `1px solid ${e.severity === 'critical' ? '#7f1d1d' : '#2a2a3e'}`, borderLeft: `3px solid ${sev}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>{new Date(e.ts).toLocaleString('pt-BR')}</div>
                  </div>
                  {e.description && <div style={{ color: '#a0a0c0', fontSize: 12, marginTop: 4 }}>{e.description}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <span style={{ padding: '1px 8px', borderRadius: 10, background: '#2a2a3e', color: '#888', fontSize: 10, fontFamily: 'monospace' }}>{e.kind}</span>
                    {e.meta?.link && (
                      <a href={e.meta.link} style={{ color: '#60a5fa', fontSize: 11, textDecoration: 'none' }}>→ abrir</a>
                    )}
                    {e.meta?.procurationId && (
                      <Link href={`/consultri/cliente/${e.meta.procurationId}/procuracao`} style={{ color: '#a78bfa', fontSize: 11, textDecoration: 'none' }}>
                        → procuração {e.meta.procurationId.slice(0, 8)}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div style={{ color: '#666', padding: 20 }}>Nenhum evento corresponde aos filtros.</div>
          )}
        </div>
      </div>
    </div>
  );
}
