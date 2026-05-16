'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Notification = {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  template: string | null;
  refType: string | null;
  refId: string | null;
  status: string;
  severity: string | null;
  link: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  lastError: string | null;
};

const sevColors: Record<string, { bg: string; fg: string }> = {
  critical: { bg: '#7f1d1d', fg: '#fee2e2' },
  warning:  { bg: '#451a03', fg: '#fde68a' },
  info:     { bg: '#1e3a8a', fg: '#dbeafe' },
};
const channelIcons: Record<string, string> = {
  email: '📧', whatsapp: '📱', inapp: '🔔', webhook: '🔌',
};

export default function HubNotificacoesPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  function token() { return localStorage.getItem('admin_token') || localStorage.getItem('token') || ''; }

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter === 'unread') qs.set('unreadOnly', 'true');
      if (filter === 'critical') qs.set('severity', 'critical');
      if (channelFilter !== 'all') qs.set('channel', channelFilter);
      qs.set('limit', '200');
      const r = await fetch(`/api/consultri/notifications?${qs}`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'falha');
      setList(j.data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter, channelFilter]);

  async function markRead(id: string) {
    await fetch(`/api/consultri/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    load();
  }

  async function markAllRead() {
    await fetch('/api/consultri/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    load();
  }

  const stats = useMemo(() => ({
    total: list.length,
    unread: list.filter(n => !n.readAt).length,
    critical: list.filter(n => n.severity === 'critical' && !n.readAt).length,
    failed: list.filter(n => n.status === 'failed').length,
  }), [list]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Link href="/consultri" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← Deck CONSULTRI</Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🔔 Hub de Notificações
            </h1>
            <p style={{ color: '#888', fontSize: 14 }}>Todas as notificações disparadas pela plataforma — e-mail, WhatsApp, in-app, webhook.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={markAllRead} style={btn}>Marcar todas como lidas</button>
            <button onClick={load} style={{ ...btn, background: '#7c3aed' }}>Atualizar</button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          <Stat label="Total exibidas" value={stats.total} />
          <Stat label="Não lidas" value={stats.unread} color="#a78bfa" />
          <Stat label="Críticas pendentes" value={stats.critical} color="#ef4444" />
          <Stat label="Com falha" value={stats.failed} color="#f59e0b" />
        </div>

        <div style={{ background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>Filtro:</span>
          {(['all', 'unread', 'critical'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...filterBtn, ...(filter === f ? activeFilter : {}) }}>
              {f === 'all' ? 'Todas' : f === 'unread' ? 'Não lidas' : 'Críticas'}
            </button>
          ))}
          <span style={{ borderLeft: '1px solid #2a2a3e', height: 18, margin: '0 8px' }} />
          <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>Canal:</span>
          {['all', 'email', 'whatsapp', 'inapp', 'webhook'].map(c => (
            <button key={c} onClick={() => setChannelFilter(c)} style={{ ...filterBtn, ...(channelFilter === c ? activeFilter : {}) }}>
              {c === 'all' ? 'Todos' : `${channelIcons[c] || ''} ${c}`}
            </button>
          ))}
        </div>

        {error && <div style={{ background: '#7f1d1d', padding: 12, borderRadius: 6, marginBottom: 12 }}>Erro: {error}</div>}
        {loading && <div style={{ color: '#a78bfa' }}>Carregando...</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(n => {
            const sev = sevColors[n.severity || 'info'] || sevColors.info;
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                style={{
                  background: isUnread ? '#13131f' : '#0a0a14',
                  border: `1px solid ${isUnread ? '#3a3a4e' : '#2a2a3e'}`,
                  borderLeft: `3px solid ${n.severity === 'critical' ? '#ef4444' : n.severity === 'warning' ? '#f59e0b' : '#60a5fa'}`,
                  borderRadius: 8, padding: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{channelIcons[n.channel] || '📬'}</span>
                      {n.severity && (
                        <span style={{ padding: '1px 8px', borderRadius: 10, background: sev.bg, color: sev.fg, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                          {n.severity}
                        </span>
                      )}
                      <span style={{ padding: '1px 8px', borderRadius: 10, background: n.status === 'sent' ? '#10b98133' : n.status === 'failed' ? '#ef444433' : '#6b728033', color: n.status === 'sent' ? '#10b981' : n.status === 'failed' ? '#ef4444' : '#9ca3af', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                        {n.status}
                      </span>
                      {isUnread && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#a78bfa' }} />}
                      {n.template && <span style={{ color: '#666', fontSize: 11 }}>{n.template}</span>}
                    </div>
                    {n.subject && <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 4 }}>{n.subject}</div>}
                    <div style={{ color: '#c0c0d0', fontSize: 13, lineHeight: 1.5 }}>{n.body}</div>
                    {n.lastError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>⚠ {n.lastError}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginTop: 6 }}>
                      <span>{new Date(n.createdAt).toLocaleString('pt-BR')}</span>
                      <span>→ {n.recipient}</span>
                      {n.refType && n.refId && <span>ref: {n.refType}/{n.refId.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {n.link && (
                      <a href={n.link} style={{ ...miniBtn, background: '#1e3a8a', color: '#dbeafe' }}>Abrir</a>
                    )}
                    {isUnread && (
                      <button onClick={() => markRead(n.id)} style={miniBtn}>marcar lida</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && list.length === 0 && (
            <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>Nenhuma notificação encontrada com esses filtros.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { padding: '8px 14px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, color: '#c0c0c0', cursor: 'pointer', fontSize: 13 };
const filterBtn: React.CSSProperties = { padding: '6px 10px', background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 6, color: '#888', cursor: 'pointer', fontSize: 12 };
const activeFilter: React.CSSProperties = { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' };
const miniBtn: React.CSSProperties = { padding: '4px 10px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 4, color: '#a0a0c0', cursor: 'pointer', fontSize: 11, textAlign: 'center', textDecoration: 'none' };

function Stat({ label, value, color = '#e0e0e0' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 8, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}
