'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { authedFetcher } from '@/lib/fetcher';
import BrazilTileMap from '@/components/BrazilTileMap';

type StateTier = 'A' | 'B' | 'C';
type StateStatus = 'covered' | 'planned' | 'pending';
type Regiao = 'N' | 'NE' | 'CO' | 'SE' | 'S';

interface CoberturaItem {
  uf: string;
  nome: string;
  regiao: Regiao;
  status: StateStatus;
  tier: StateTier;
  pibPct: number;
  sistemaCreditoAcumulado?: string;
}

interface CoberturaSummary {
  total: number;
  porStatus: Record<StateStatus, number>;
  pibCoberto: number;
  pibPlanejado: number;
  pibPendente: number;
  porRegiao: Record<Regiao, { total: number; covered: number; planned: number; pending: number; pibPct: number }>;
  porTier: Record<StateTier, number>;
}

interface CoberturaResp {
  summary: CoberturaSummary;
  items: CoberturaItem[];
}

const REGIAO_LABEL: Record<Regiao, string> = {
  N: 'Norte',
  NE: 'Nordeste',
  CO: 'Centro-Oeste',
  SE: 'Sudeste',
  S: 'Sul',
};

const REGIAO_ORDER: Regiao[] = ['N', 'NE', 'CO', 'SE', 'S'];

const STATUS_LABEL: Record<StateStatus, string> = {
  covered: 'Coberto',
  planned: 'Em planejamento',
  pending: 'Pendente',
};

const STATUS_COLOR: Record<StateStatus, { bg: string; border: string; text: string }> = {
  covered: { bg: '#10b981', border: '#059669', text: '#fff' },
  planned: { bg: '#f59e0b', border: '#d97706', text: '#fff' },
  pending: { bg: '#e5e7eb', border: '#9ca3af', text: '#4b5563' },
};

const TIER_LABEL: Record<StateTier, string> = {
  A: 'API oficial',
  B: 'Portal/RPA',
  C: 'Manual',
};

export default function SefazCoberturaPage() {
  const { data, isLoading } = useSWR<CoberturaResp>('/api/sefaz/cobertura', authedFetcher);
  const [filtroStatus, setFiltroStatus] = useState<StateStatus | 'all'>('all');
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const itemsByRegiao = useMemo(() => {
    const map: Record<Regiao, CoberturaItem[]> = { N: [], NE: [], CO: [], SE: [], S: [] };
    (data?.items || []).forEach(i => map[i.regiao].push(i));
    REGIAO_ORDER.forEach(r => map[r].sort((a, b) => b.pibPct - a.pibPct));
    return map;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filtroStatus === 'all') return data.items;
    return data.items.filter(i => i.status === filtroStatus);
  }, [data, filtroStatus]);

  if (isLoading) {
    return <div style={{ padding: 40, color: '#fff' }}>Carregando cobertura nacional...</div>;
  }

  if (!data) {
    return <div style={{ padding: 40, color: '#fff' }}>Falha ao carregar dados.</div>;
  }

  const s = data.summary;
  const pibTotal = s.pibCoberto + s.pibPlanejado + s.pibPendente;

  return (
    <div style={{ padding: 24, color: '#fff', background: '#0a0e1a', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Cobertura Nacional SEFAZ
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>
          Mapa de integracao das 27 UFs brasileiras. Verde = em producao, Amarelo = em planejamento, Cinza = pendente.
        </p>
      </header>

      {/* KPIs principais */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Kpi label="UFs cobertas" value={`${s.porStatus.covered}/27`} sub={`${((s.porStatus.covered / 27) * 100).toFixed(0)}% do pais`} color="#10b981" />
        <Kpi label="PIB coberto" value={`${s.pibCoberto.toFixed(1)}%`} sub={`R$ ~${(s.pibCoberto * 110 / 100).toFixed(1)} tri PIB (2024)`} color="#10b981" />
        <Kpi label="Em planejamento" value={`${s.porStatus.planned} UFs`} sub={`+${s.pibPlanejado.toFixed(1)}% PIB`} color="#f59e0b" />
        <Kpi label="Pendentes" value={`${s.porStatus.pending} UFs`} sub={`${s.pibPendente.toFixed(1)}% PIB restante`} color="#6b7280" />
      </section>

      {/* Mapa do Brasil em tiles */}
      <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Mapa do Brasil — cobertura SEFAZ</h2>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
          Cada UF e' um tile com o mesmo peso visual. Cor = status de integracao. Click para ver autoridade, RICMS, sistema e regras de procuracao.
        </p>
        <BrazilTileMap
          items={(data.items || []).map(i => ({
            uf: i.uf,
            status: i.status,
            tier: i.tier,
            pibPct: i.pibPct,
            nome: i.nome,
            sistema: i.sistemaCreditoAcumulado,
          }))}
          selecionada={selecionada}
          onSelect={uf => setSelecionada(prev => (prev === uf ? null : uf))}
        />
      </section>

      {/* Distribuicao por regiao (mantida abaixo como visao alternativa) */}
      <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Distribuicao por regiao</h2>
          <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <Legend color={STATUS_COLOR.covered.bg} label="Coberto" />
            <Legend color={STATUS_COLOR.planned.bg} label="Planejado" />
            <Legend color={STATUS_COLOR.pending.bg} label="Pendente" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {REGIAO_ORDER.map(r => {
            const list = itemsByRegiao[r];
            const reg = s.porRegiao[r];
            return (
              <div key={r} style={{ background: '#1e293b', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>{REGIAO_LABEL[r]}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {reg.covered}/{reg.total} · {reg.pibPct.toFixed(1)}% PIB
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {list.map(uf => {
                    const c = STATUS_COLOR[uf.status];
                    const sel = selecionada === uf.uf;
                    return (
                      <button
                        key={uf.uf}
                        onClick={() => setSelecionada(sel ? null : uf.uf)}
                        title={`${uf.nome} — ${STATUS_LABEL[uf.status]} (Tier ${uf.tier}: ${TIER_LABEL[uf.tier]})${uf.sistemaCreditoAcumulado ? ` · ${uf.sistemaCreditoAcumulado}` : ''}`}
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `2px solid ${sel ? '#fff' : c.border}`,
                          borderRadius: 6,
                          padding: '6px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          minWidth: 32,
                          cursor: 'pointer',
                          transition: 'transform 80ms',
                          transform: sel ? 'scale(1.08)' : 'scale(1)',
                        }}
                      >
                        {uf.uf}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detalhe da UF selecionada */}
      {selecionada && (
        <SelectedDetail uf={selecionada} onClose={() => setSelecionada(null)} />
      )}

      {/* Tabela detalhada */}
      <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Detalhamento por UF</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'covered', 'planned', 'pending'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroStatus(f)}
                style={{
                  background: filtroStatus === f ? '#3b82f6' : '#1e293b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e293b', textAlign: 'left' }}>
              <th style={th}>UF</th>
              <th style={th}>Nome</th>
              <th style={th}>Regiao</th>
              <th style={th}>Status</th>
              <th style={th}>Tier</th>
              <th style={th}>PIB</th>
              <th style={th}>Sistema</th>
              <th style={th}>Acao</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const c = STATUS_COLOR[i.status];
              return (
                <tr key={i.uf} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{i.uf}</td>
                  <td style={td}>{i.nome}</td>
                  <td style={td}>{REGIAO_LABEL[i.regiao]}</td>
                  <td style={td}>
                    <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, color: '#cbd5e1' }}>{i.tier} · {TIER_LABEL[i.tier]}</span>
                  </td>
                  <td style={td}>{i.pibPct.toFixed(1)}%</td>
                  <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{i.sistemaCreditoAcumulado || '-'}</td>
                  <td style={td}>
                    <button onClick={() => setSelecionada(i.uf)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
      <span style={{ width: 12, height: 12, background: color, borderRadius: 3, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function SelectedDetail({ uf, onClose }: { uf: string; onClose: () => void }) {
  const { data, isLoading } = useSWR(`/api/sefaz/uf/${uf}`, authedFetcher);

  return (
    <section style={{ background: '#0f172a', border: '1px solid #3b82f6', borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          {uf} {data?.nome ? `— ${data.nome}` : ''}
        </h2>
        <button onClick={onClose} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
          Fechar
        </button>
      </div>
      {isLoading && <div style={{ color: '#94a3b8' }}>Carregando...</div>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
          <Info label="Orgao oficial" value={data.sefaz?.nomeOficial || data.sefaz?.nomeOrgao} />
          <Info label="Autoridade" value={data.sefaz?.autoridadeOficial || data.sefaz?.autoridade} />
          <Info label="Cadastro estadual" value={data.sefaz?.cadastroEstadual} />
          <Info label="Sistema credito acumulado" value={data.sefaz?.sistemaCreditoAcumulado} />
          <Info label="Portal de processos" value={data.sefaz?.portalProcessos} />
          <Info label="Site oficial" value={data.sefaz?.siteUrl} link={data.sefaz?.siteUrl} />
          <Info label="RICMS" value={data.baseLegal?.ricms} />
          <Info label="Lei Complementar" value={data.baseLegal?.leiComplementar} />
          <Info label="Procuracao especifica" value={data.procuracao?.requerInstrumentoProprio ? `Sim (${data.procuracao?.nomeInstrumento || ''})` : 'Aceita generica'} />
        </div>
      )}
    </section>
  );
}

function Info({ label, value, link }: { label: string; value?: string; link?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontWeight: 500 }}>
          {value || '-'}
        </a>
      ) : (
        <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{value || '-'}</div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#cbd5e1' };
const td: React.CSSProperties = { padding: '10px 12px' };
