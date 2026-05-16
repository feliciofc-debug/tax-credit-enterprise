'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Metrics = {
  carteira: {
    total: number;
    ativas: number;
    pendentes: number;
    parciais: number;
    revogadas: number;
    ativacaoRate: number;
    vencendo30d: number;
  };
  tempoMedioOutorga: { horas: number | null; amostras: number };
  porModo: { auto_serpro: number; manual_invite: number; indefinido: number };
  convites: {
    total: number;
    pending: number;
    opened: number;
    acknowledged: number;
    completed: number;
    openRate: number;
    ackRate: number;
    completionRate: number;
  };
  notificacoes24h: { total: number; sent: number; failed: number; email: number; whatsapp: number };
  caixaPostal: { coletadosHoje: number; comMensagemNova: number; totalMensagensNovas: number; scoreMedio: number };
  funilSemanas: Record<string, { criadas: number; ativadas: number }>;
};

type Procurador = { id: string; cnpj: string; razaoSocial: string; ativo: boolean };

export default function MetricasConsultriPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procuradores, setProcuradores] = useState<Procurador[]>([]);
  const [filterProcuradorId, setFilterProcuradorId] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const qs = filterProcuradorId ? `?procuradorEntityId=${filterProcuradorId}` : '';
      const r = await fetch(`/api/consultri/metrics${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Falha ao carregar metricas');
      setData(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProcuradores() {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const r = await fetch('/api/consultri/procuradores', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setProcuradores(j.data || []);
    } catch { /* silent */ }
  }

  useEffect(() => { load(); }, [filterProcuradorId]);
  useEffect(() => { loadProcuradores(); }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: 32 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Link href="/consultri" style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>← Deck CONSULTRI</Link>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '8px 0', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Métricas Comerciais — Carteira CONSULTRI
            </h1>
            <p style={{ color: '#888', fontSize: 14 }}>KPIs em tempo real para acompanhar performance da carteira</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {procuradores.length > 0 && (
              <select
                value={filterProcuradorId}
                onChange={e => setFilterProcuradorId(e.target.value)}
                style={{ ...navBtn, paddingRight: 8 }}
              >
                <option value="">Todos procuradores</option>
                {procuradores.filter(p => p.ativo).map(p => (
                  <option key={p.id} value={p.id}>{p.razaoSocial}</option>
                ))}
              </select>
            )}
            <Link href="/consultri/carteira" style={navBtn}>Carteira</Link>
            <Link href="/consultri/conformidade" style={navBtn}>Conformidade</Link>
            <Link href="/consultri/configuracoes" style={navBtn}>Config</Link>
            <a
              href={`/api/consultri/executive-summary${filterProcuradorId ? `?procuradorEntityId=${filterProcuradorId}` : ''}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...navBtn, background: '#1e40af', color: '#dbeafe', borderColor: '#1e40af' }}
            >
              📄 Executive PDF
            </a>
            <button onClick={load} style={{ ...navBtn, background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}>
              {loading ? '...' : 'Atualizar'}
            </button>
          </div>
        </header>

        {error && (
          <div style={{ background: '#7f1d1d', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            Erro: {error}
          </div>
        )}

        {data && (
          <>
            {/* HERO KPIs */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              <KpiHero label="Taxa de Ativação" value={`${data.carteira.ativacaoRate}%`} sub={`${data.carteira.ativas} de ${data.carteira.total} procurações`} color="#10b981" />
              <KpiHero
                label="Tempo Médio de Outorga"
                value={data.tempoMedioOutorga.horas !== null ? `${data.tempoMedioOutorga.horas}h` : '—'}
                sub={`${data.tempoMedioOutorga.amostras} amostras ativadas`}
                color="#60a5fa"
              />
              <KpiHero
                label="Taxa de Conclusão (convites)"
                value={`${data.convites.completionRate}%`}
                sub={`${data.convites.completed} de ${data.convites.total} convites concluídos`}
                color="#a78bfa"
              />
              <KpiHero
                label="Vencendo em 30 dias"
                value={String(data.carteira.vencendo30d)}
                sub="acionar renovação preventiva"
                color="#f59e0b"
              />
            </section>

            {/* Carteira detalhe */}
            <section style={card}>
              <h2 style={h2}>Carteira</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
                <Stat label="Total" value={data.carteira.total} />
                <Stat label="Ativas" value={data.carteira.ativas} color="#10b981" />
                <Stat label="Parciais" value={data.carteira.parciais} color="#f59e0b" />
                <Stat label="Pendentes" value={data.carteira.pendentes} color="#60a5fa" />
                <Stat label="Revogadas" value={data.carteira.revogadas} color="#ef4444" />
              </div>
            </section>

            {/* Modo de outorga */}
            <section style={card}>
              <h2 style={h2}>Distribuição por Modo de Outorga</h2>
              <BarRow label="Automática (SERPRO)" value={data.porModo.auto_serpro} total={data.carteira.total} color="#10b981" />
              <BarRow label="Manual (convite guiado)" value={data.porModo.manual_invite} total={data.carteira.total} color="#60a5fa" />
              <BarRow label="Indefinido" value={data.porModo.indefinido} total={data.carteira.total} color="#6b7280" />
            </section>

            {/* Convites */}
            <section style={card}>
              <h2 style={h2}>Funil de Convites</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
                <FunilStep n={1} label="Enviados" value={data.convites.total} pct={100} />
                <FunilStep n={2} label="Abertos" value={data.convites.opened} pct={data.convites.openRate} />
                <FunilStep n={3} label="Reconhecidos" value={data.convites.acknowledged} pct={data.convites.ackRate} />
                <FunilStep n={4} label="Concluídos" value={data.convites.completed} pct={data.convites.completionRate} />
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>
                Taxa de abertura: <b style={{ color: '#fff' }}>{data.convites.openRate}%</b> &middot;
                {' '}Reconhecimento: <b style={{ color: '#fff' }}>{data.convites.ackRate}%</b> &middot;
                {' '}Conclusão: <b style={{ color: '#fff' }}>{data.convites.completionRate}%</b>
              </div>
            </section>

            {/* Notificacoes + caixa postal */}
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={card}>
                <h2 style={h2}>Notificações (últimas 24h)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  <Stat label="Enviadas" value={data.notificacoes24h.sent} color="#10b981" />
                  <Stat label="Falharam" value={data.notificacoes24h.failed} color="#ef4444" />
                  <Stat label="E-mail" value={data.notificacoes24h.email} />
                  <Stat label="WhatsApp" value={data.notificacoes24h.whatsapp} color="#25d366" />
                </div>
              </div>
              <div style={card}>
                <h2 style={h2}>Caixa Postal e-CAC (hoje)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  <Stat label="Clientes coletados" value={data.caixaPostal.coletadosHoje} />
                  <Stat label="Com nova mensagem" value={data.caixaPostal.comMensagemNova} color="#f59e0b" />
                  <Stat label="Mensagens novas" value={data.caixaPostal.totalMensagensNovas} color="#a78bfa" />
                  <Stat label="Score médio" value={data.caixaPostal.scoreMedio} color="#10b981" />
                </div>
              </div>
            </section>

            {/* Funil semanal */}
            <section style={card}>
              <h2 style={h2}>Funil Semanal — criadas vs ativadas (últimos 90 dias)</h2>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, padding: '12px 0' }}>
                {Object.entries(data.funilSemanas).sort(([a], [b]) => a.localeCompare(b)).map(([wk, v]) => {
                  const max = Math.max(...Object.values(data.funilSemanas).map(x => x.criadas), 1);
                  return (
                    <div key={wk} title={`${wk}: ${v.ativadas}/${v.criadas} ativadas`} style={{ flex: 1, position: 'relative', minWidth: 16 }}>
                      <div style={{ background: '#374151', height: `${(v.criadas / max) * 100}%`, position: 'relative' }}>
                        <div style={{ background: '#10b981', height: `${(v.ativadas / Math.max(v.criadas, 1)) * 100}%`, position: 'absolute', bottom: 0, left: 0, right: 0 }} />
                      </div>
                      <div style={{ fontSize: 9, color: '#666', textAlign: 'center', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'left' }}>{wk.split('-W')[1]}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, background: '#374151', marginRight: 4, verticalAlign: 'middle' }} /> criadas
                <span style={{ display: 'inline-block', width: 12, height: 12, background: '#10b981', marginLeft: 16, marginRight: 4, verticalAlign: 'middle' }} /> ativadas
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: '8px 14px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6,
  color: '#c0c0c0', textDecoration: 'none', fontSize: 13, cursor: 'pointer',
};

const card: React.CSSProperties = {
  background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12, padding: 20, marginBottom: 16,
};

const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#e0e0e0' };

function KpiHero({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#13131f,#1a1a2e)', border: `1px solid ${color}33`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
    </div>
  );
}

function Stat({ label, value, color = '#e0e0e0' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 8, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: '#888' }}>{value} ({pct}%)</span>
      </div>
      <div style={{ background: '#0a0a14', height: 10, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

function FunilStep({ n, label, value, pct }: { n: number; label: string; value: number; pct: number }) {
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>ETAPA {n}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{label}</div>
      <div style={{ background: '#1a1a2e', height: 6, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#a78bfa' }} />
      </div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{pct}%</div>
    </div>
  );
}
