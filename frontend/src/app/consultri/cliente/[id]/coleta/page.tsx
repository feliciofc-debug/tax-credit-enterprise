'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Tab = 'perdcomp' | 'dctf' | 'dirf' | 'fontes' | 'parcelamentos' | 'caixa' | 'cruzamento';

type Connection = { id: string; nome: string; cnpj: string };
type Procuration = {
  id: string;
  presetKey: string | null;
  serproStatus: string | null;
  client?: { id: string; name: string; cnpj: string | null; company: string | null };
};

export default function ColetaPage() {
  const params = useParams<{ id: string }>();
  const procId = params.id;

  const [proc, setProc] = useState<Procuration | null>(null);
  const [conns, setConns] = useState<Connection[]>([]);
  const [connId, setConnId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('perdcomp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Filtros por tab
  const [periodoInicio, setPeriodoInicio] = useState('202401');
  const [periodoFim, setPeriodoFim] = useState('202612');
  const [numero, setNumero] = useState('');
  const [anoBase, setAnoBase] = useState('2025');
  const [pa, setPa] = useState('202512');
  const [isn, setIsn] = useState('');

  function token() { return localStorage.getItem('admin_token') || localStorage.getItem('token') || ''; }

  async function loadProcuration() {
    try {
      const r = await fetch(`/api/procurations/${procId}`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (j.success) setProc(j.data);
    } catch { /* ignore */ }
  }

  async function loadConnections() {
    try {
      const r = await fetch('/api/serpro/connections', { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (j.success && j.data?.length) {
        setConns(j.data.map((c: any) => ({ id: c.id, nome: c.nome, cnpj: c.cnpj })));
        setConnId(j.data[0].id);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { loadProcuration(); loadConnections(); }, [procId]);

  async function call(endpoint: string, body: any, service: string) {
    if (!connId) { setError('Selecione uma conexão SERPRO'); return; }
    setError(null); setResult(null); setLoading(true);
    try {
      const r = await fetch(`/api/serpro/connections/${connId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setResult({ service, ...j });
      if (!j.success) setError(j.error || 'Falha na chamada');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const cnpj = proc?.client?.cnpj || '';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'perdcomp', label: 'PER/DCOMP', icon: '💰' },
    { id: 'dctf', label: 'DCTF', icon: '📋' },
    { id: 'dirf', label: 'DIRF', icon: '🧾' },
    { id: 'fontes', label: 'Fontes Pagadoras', icon: '💼' },
    { id: 'parcelamentos', label: 'Parcelamentos', icon: '📅' },
    { id: 'caixa', label: 'Caixa Postal', icon: '📬' },
    { id: 'cruzamento', label: 'Análise Cruzada', icon: '🔬' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: 32 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <Link href={`/consultri/cliente/${procId}/procuracao`} style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← Voltar para procuração</Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Coleta Federal via Procuração
          </h1>
          {proc && (
            <p style={{ color: '#888', fontSize: 14 }}>
              Cliente: <b style={{ color: '#e0e0e0' }}>{proc.client?.company || proc.client?.name}</b> &middot; CNPJ {cnpj} &middot;
              {' '}Status SERPRO: <span style={{ color: proc.serproStatus === 'active' ? '#10b981' : '#f59e0b' }}>{proc.serproStatus || '—'}</span>
            </p>
          )}
        </header>

        {!proc?.serproStatus || proc.serproStatus !== 'active' ? (
          <div style={{ background: '#451a03', border: '1px solid #f59e0b', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            ⚠️ Esta coleta requer procuração ATIVA no SERPRO. Status atual: <b>{proc?.serproStatus || 'desconhecido'}</b>.
          </div>
        ) : null}

        {/* Seletor de conexão SERPRO */}
        <div style={card}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Conexão SERPRO</label>
          {conns.length === 0 ? (
            <div style={{ color: '#f59e0b' }}>Nenhuma conexão SERPRO configurada. Vá em <Link href="/consultri/configuracoes" style={{ color: '#60a5fa' }}>Configurações</Link>.</div>
          ) : (
            <select value={connId} onChange={e => setConnId(e.target.value)} style={input}>
              {conns.map(c => <option key={c.id} value={c.id}>{c.nome} — CNPJ {c.cnpj}</option>)}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #2a2a3e' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(null); }}
              style={{
                padding: '10px 16px',
                background: tab === t.id ? '#13131f' : 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
                color: tab === t.id ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={card}>
          {tab === 'perdcomp' && (
            <div>
              <h3 style={h3}>PER/DCOMP — Pedidos Eletrônicos de Restituição/Compensação</h3>
              <div style={row}>
                <Field label="Período Início (AAAAMM)" value={periodoInicio} onChange={setPeriodoInicio} />
                <Field label="Período Fim (AAAAMM)" value={periodoFim} onChange={setPeriodoFim} />
                <button style={btn} disabled={loading} onClick={() => call('perdcomp/lista', { contribuinteCnpj: cnpj, periodoInicio, periodoFim }, 'PER/DCOMP — Lista')}>Listar PER/DCOMP</button>
              </div>
              <div style={row}>
                <Field label="Número PER/DCOMP" value={numero} onChange={setNumero} />
                <button style={btn} disabled={loading || !numero} onClick={() => call('perdcomp/consulta', { contribuinteCnpj: cnpj, numero }, 'PER/DCOMP — Consulta')}>Consultar</button>
                <button style={btn} disabled={loading || !numero} onClick={() => call('perdcomp/despacho', { contribuinteCnpj: cnpj, numero }, 'PER/DCOMP — Despacho')}>Despacho</button>
              </div>
            </div>
          )}
          {tab === 'dctf' && (
            <div>
              <h3 style={h3}>DCTF — Declaração de Débitos e Créditos Tributários</h3>
              <div style={row}>
                <Field label="Período Apuração (AAAAMM)" value={pa} onChange={setPa} />
                <button style={btn} disabled={loading} onClick={() => call('dctf', { contribuinteCnpj: cnpj, periodoApuracao: pa }, 'DCTF — Consulta')}>Consultar DCTF</button>
              </div>
            </div>
          )}
          {tab === 'dirf' && (
            <div>
              <h3 style={h3}>DIRF — Declaração de Imposto de Renda Retido na Fonte</h3>
              <div style={row}>
                <Field label="Ano-Base" value={anoBase} onChange={setAnoBase} />
                <button style={btn} disabled={loading} onClick={() => call('dirf', { contribuinteCnpj: cnpj, anoBase }, 'DIRF — Consulta')}>Consultar DIRF</button>
              </div>
            </div>
          )}
          {tab === 'fontes' && (
            <div>
              <h3 style={h3}>Fontes Pagadoras — Rendimentos recebidos por terceiros</h3>
              <div style={row}>
                <Field label="Ano-Base" value={anoBase} onChange={setAnoBase} />
                <button style={btn} disabled={loading} onClick={() => call('fontes-pagadoras', { contribuinteCnpj: cnpj, anoBase }, 'Fontes Pagadoras')}>Consultar Fontes</button>
              </div>
            </div>
          )}
          {tab === 'parcelamentos' && (
            <div>
              <h3 style={h3}>Parcelamentos — PGFN e RFB</h3>
              <div style={row}>
                <button style={btn} disabled={loading} onClick={() => call('parcelamento-pgfn', { contribuinteCnpj: cnpj }, 'Parcelamento PGFN')}>Consultar PGFN</button>
                <button style={btn} disabled={loading} onClick={() => call('parcelamento-rfb', { contribuinteCnpj: cnpj }, 'Parcelamento RFB')}>Consultar RFB</button>
              </div>
            </div>
          )}
          {tab === 'caixa' && (
            <div>
              <h3 style={h3}>Caixa Postal e-CAC — Detalhe da Mensagem</h3>
              <div style={row}>
                <Field label="ISN (identificador da mensagem)" value={isn} onChange={setIsn} />
                <button style={btn} disabled={loading || !isn} onClick={() => call('caixa-postal/detalhe', { contribuinteCnpj: cnpj, isn }, 'Caixa Postal — Detalhe')}>Detalhar mensagem</button>
              </div>
            </div>
          )}
          {tab === 'cruzamento' && (
            <div>
              <h3 style={h3}>🔬 Detector de Divergências — DIRF × Fontes Pagadoras</h3>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
                Cruza o que a empresa <b>declarou</b> na DIRF com o que <b>terceiros declararam ter pago</b> a ela.
                Divergências = teses tributárias prontas (IR retido a maior, omissões, malha fiscal preventiva).
              </p>
              <div style={row}>
                <Field label="Ano-Base" value={anoBase} onChange={setAnoBase} />
                <button
                  style={{ ...btn, background: '#7c3aed' }}
                  disabled={loading}
                  onClick={() => call('analise-cruzada/dirf-fontes', { contribuinteCnpj: cnpj, anoBase: parseInt(anoBase, 10) }, 'Análise Cruzada — DIRF × Fontes')}
                >
                  Rodar análise cruzada
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Renderizacao especial da analise cruzada */}
        {result?.service?.startsWith('Análise Cruzada') && result?.data && (
          <div style={card}>
            <CrossAnalysisView data={result.data} />
          </div>
        )}

        {loading && <div style={{ color: '#a78bfa', marginBottom: 12 }}>⏳ Consultando SERPRO...</div>}
        {error && <div style={{ background: '#7f1d1d', padding: 12, borderRadius: 6, marginBottom: 12 }}>Erro: {error}</div>}

        {result && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📦 Resposta — {result.service}</h3>
              <span style={{ padding: '4px 10px', borderRadius: 12, background: result.success ? '#10b98133' : '#ef444433', color: result.success ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: 700 }}>
                {result.success ? 'SUCESSO' : 'FALHA'}
              </span>
            </div>
            <pre style={{ background: '#0a0a14', padding: 14, borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 500, color: '#a0a0c0' }}>
              {JSON.stringify(result.data || result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12, padding: 20, marginBottom: 16,
};
const h3: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#e0e0e0' };
const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 };
const input: React.CSSProperties = {
  background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 6, color: '#fff',
  padding: '8px 12px', fontSize: 13, width: '100%',
};
const btn: React.CSSProperties = {
  padding: '8px 16px', background: '#7c3aed', border: 'none', borderRadius: 6,
  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 160 }}>
      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={input} />
    </div>
  );
}

function CrossAnalysisView({ data }: { data: any }) {
  const r = data.resumo || {};
  const classColors: Record<string, string> = { baixo: '#10b981', medio: '#f59e0b', alto: '#f97316', critico: '#ef4444' };
  const sevColors: Record<string, string> = { low: '#6b7280', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🔬 Resultado — Análise Cruzada DIRF × Fontes</h3>
        <span style={{ padding: '6px 14px', borderRadius: 14, background: classColors[r.classificacao] + '33', color: classColors[r.classificacao], fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
          Risco {r.classificacao} — Score {r.scoreRisco}/100
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <SmallStat label="DIRF total" value={`R$ ${(r.totalDeclaradoDirf || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <SmallStat label="Fontes total" value={`R$ ${(r.totalRecebidoFontes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <SmallStat label="Diferença" value={`R$ ${(r.diferencaTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color={Math.abs(r.diferencaTotal || 0) > 1000 ? '#f59e0b' : '#10b981'} />
        <SmallStat label="Divergências" value={r.qtdDivergencias} color={r.qtdDivergencias > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {data.teses?.length > 0 && (
        <div style={{ background: '#0a0a14', border: '1px solid #a78bfa', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#a78bfa', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>💡 Teses tributárias detectadas</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
            {data.teses.map((t: string, i: number) => <li key={i} style={{ color: '#e0e0e0' }}>{t}</li>)}
          </ul>
        </div>
      )}

      {data.divergencias?.length > 0 ? (
        <div style={{ background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#13131f', borderBottom: '1px solid #2a2a3e' }}>
                <th style={th}>Severidade</th>
                <th style={th}>Tipo</th>
                <th style={th}>Fonte</th>
                <th style={th}>DIRF</th>
                <th style={th}>Fonte</th>
                <th style={th}>Diferença</th>
                <th style={th}>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {data.divergencias.map((d: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #2a2a3e' }}>
                  <td style={td}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, background: sevColors[d.severity] + '33', color: sevColors[d.severity], fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{d.severity}</span>
                  </td>
                  <td style={td}>{d.tipo}</td>
                  <td style={td}><div style={{ fontWeight: 600 }}>{d.nomeFonte}</div><div style={{ color: '#666', fontSize: 10 }}>{d.cnpjFonte}</div></td>
                  <td style={{ ...td, textAlign: 'right' }}>R$ {(d.valorDirf || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...td, textAlign: 'right' }}>R$ {(d.valorFonte || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...td, textAlign: 'right', color: (d.diferenca || 0) > 0 ? '#f59e0b' : '#10b981' }}>R$ {(d.diferenca || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...td, fontSize: 11, color: '#888' }}>{d.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: '#0a0a14', padding: 20, borderRadius: 8, textAlign: 'center', color: '#10b981' }}>
          ✓ Nenhuma divergência detectada — declaração consistente
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#888', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top', color: '#e0e0e0' };

function SmallStat({ label, value, color = '#e0e0e0' }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
