'use client';
import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface SecurityData {
  summary: { totalBlocked: number; totalWatching: number; totalTracked: number; totalRanges: number };
  blocked: Array<{ ip: string; record: any }>;
  watching: Array<{ ip: string; record: any }>;
  allConnected: Array<{ ip: string; record: any }>;
  blockedRanges: Array<{ prefix: string; reason: string }>;
}

interface EscalationData {
  active: boolean;
  level: 'normal' | 'watch' | 'alert' | 'lockdown';
  windowMinutes: number;
  uniqueIpsInWindow: number;
  blocksInWindow: number;
  topProvidersInWindow: Array<{ provider: string; count: number }>;
  topPathsInWindow: Array<{ path: string; count: number }>;
  coordinatedProviders: string[];
  coordinatedPaths: string[];
  lockdownActive: boolean;
  lockdownUntil: string | null;
  recommendation: string;
}

export default function SegurancaPage() {
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockRangeInput, setBlockRangeInput] = useState('');
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [attackReport, setAttackReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const { data, isLoading } = useSWR<SecurityData>(
    '/api/security/dashboard',
    authedFetcher,
    { ...SWR_OPTIONS_FAST, refreshInterval: 5000 },
  );

  const { data: escalation } = useSWR<EscalationData>(
    '/api/security/escalation',
    authedFetcher,
    { ...SWR_OPTIONS_FAST, refreshInterval: 10000 },
  );

  const { data: deception } = useSWR<any>(
    '/api/security/deception/report',
    authedFetcher,
    { ...SWR_OPTIONS_FAST, refreshInterval: 15000 },
  );

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const handleBlock = useCallback(async (ipOverride?: string) => {
    const ip = ipOverride || blockIpInput;
    if (!ip) return;
    await fetch(`${apiBase}/api/security/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ip }),
    });
    setBlockIpInput('');
    mutate('/api/security/dashboard');
  }, [blockIpInput, apiBase, token]);

  const handleUnblock = useCallback(async (ip: string) => {
    await fetch(`${apiBase}/api/security/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ip }),
    });
    mutate('/api/security/dashboard');
  }, [apiBase, token]);

  const handleLockdown = useCallback(async (activate: boolean) => {
    const url = activate ? '/api/security/lockdown/activate' : '/api/security/lockdown/deactivate';
    await fetch(`${apiBase}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(activate ? { minutes: 60 } : {}),
    });
    mutate('/api/security/escalation');
  }, [apiBase, token]);

  const handleBlockRange = useCallback(async () => {
    if (!blockRangeInput) return;
    await fetch(`${apiBase}/api/security/block-range`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prefix: blockRangeInput, reason: `Faixa bloqueada: ${blockRangeInput}*` }),
    });
    setBlockRangeInput('');
    mutate('/api/security/dashboard');
  }, [blockRangeInput, apiBase, token]);

  const loadAttackReport = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      if (!token) throw new Error('Sem token de autenticacao — faca login novamente');
      const url = `${apiBase}/api/security/attack-report`;
      console.log('[AttackReport] GET', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[AttackReport] status', res.status);
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error(`Resposta nao-JSON (HTTP ${res.status}): ${text.substring(0, 200)}`); }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error || text.substring(0, 200)}`);
      if (json.success === false) throw new Error(json.error || 'API retornou success=false');
      setAttackReport(json.data ?? json);
      console.log('[AttackReport] OK', json.data);
    } catch (err: any) {
      console.error('[AttackReport] ERRO', err);
      setReportError(err?.message || 'Erro desconhecido ao buscar relatorio');
    } finally {
      setLoadingReport(false);
    }
  }, [apiBase, token]);

  const summary = data?.summary || { totalBlocked: 0, totalWatching: 0, totalTracked: 0, totalRanges: 0 };

  function IpRow({ item, variant }: { item: { ip: string; record: any }; variant: 'blocked' | 'watching' | 'connected' }) {
    const r = item.record;
    const isExpanded = expandedIp === item.ip;
    const colors = {
      blocked: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
      watching: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
      connected: { badge: 'bg-blue-50 text-blue-700', dot: r.blocked ? 'bg-red-500' : r.suspicionScore >= 30 ? 'bg-amber-500' : 'bg-emerald-500' },
    }[variant];

    return (
      <div className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
              <button onClick={() => setExpandedIp(isExpanded ? null : item.ip)} className="font-mono font-bold text-sm text-gray-900 hover:text-indigo-600 transition-colors">
                {item.ip}
              </button>
              {r.permanentlyBlocked && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider">Permanente</span>
              )}
              {r.hitHoneypot && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold uppercase">Honeypot</span>
              )}
              {r.geo && (
                <span className={`px-2 py-0.5 rounded-full ${colors.badge} text-[10px] font-medium`}>
                  {r.geo.city}{r.geo.region ? `, ${r.geo.region}` : ''} — {r.geo.country}
                </span>
              )}
              {r.geo?.hosting && (
                <span className="px-2 py-0.5 rounded-full bg-gray-800 text-white text-[9px] font-bold">CLOUD/HOSTING</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
              <span>Score: <b className={r.suspicionScore >= 50 ? 'text-red-600' : r.suspicionScore >= 30 ? 'text-amber-600' : 'text-gray-600'}>{r.suspicionScore}</b></span>
              <span>{r.count} reqs</span>
              <span>{r.endpointCount} endpoints</span>
              {r.blockCount > 0 && <span className="text-red-500">{r.blockCount}x bloqueado</span>}
              {r.blockReason && <span className="text-red-400 italic max-w-[300px] truncate">{r.blockReason}</span>}
            </div>
            {r.geo?.isp && (
              <p className="text-[10px] text-gray-300 mt-0.5">ISP: {r.geo.isp} {r.geo.org ? `| Org: ${r.geo.org}` : ''}</p>
            )}
            <p className="text-[10px] text-gray-300 mt-0.5 truncate max-w-[500px]">UA: {r.userAgent?.substring(0, 100) || '—'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {variant === 'blocked' && (
              <button onClick={() => handleUnblock(item.ip)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 transition-colors">Desbloquear</button>
            )}
            {variant === 'watching' && (
              <button onClick={() => handleBlock(item.ip)} className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors">Bloquear</button>
            )}
            {variant === 'connected' && !r.blocked && (
              <button onClick={() => handleBlock(item.ip)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors">Bloquear</button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 ml-5 p-3 bg-gray-50 rounded-lg border border-gray-100 text-[11px] text-gray-600 space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Primeiro acesso: <b>{r.firstSeen}</b></span>
              <span>Ultimo acesso: <b>{r.lastSeen}</b></span>
              {r.geo?.timezone && <span>Timezone: <b>{r.geo.timezone}</b></span>}
              {r.geo?.hosting !== undefined && <span>Hosting: <b>{r.geo.hosting ? 'Sim (Cloud/VPS)' : 'Nao (Residencial)'}</b></span>}
            </div>
            {r.endpoints && r.endpoints.length > 0 && (
              <div className="mt-2">
                <span className="font-semibold text-gray-700">Endpoints acessados:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.endpoints.map((ep: string) => (
                    <span key={ep} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">{ep}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shield — Seguranca e Monitoramento</h1>
        <p className="text-gray-500 text-sm mt-1">Protecao maxima: anti-bot, honeypot, geo-tracking, fingerprint, rate limiting — atualiza a cada 5s</p>
      </div>

      {/* Escalation / Lockdown Alert */}
      {escalation && escalation.level !== 'normal' && (
        <div className={`mb-6 rounded-2xl p-5 border-2 ${
          escalation.level === 'lockdown' ? 'bg-red-100 border-red-600 animate-pulse' :
          escalation.level === 'alert' ? 'bg-orange-50 border-orange-500' :
          'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${
                  escalation.level === 'lockdown' ? 'bg-red-600' :
                  escalation.level === 'alert' ? 'bg-orange-500' :
                  'bg-amber-400'
                } animate-pulse`} />
                <h2 className={`text-base font-bold uppercase tracking-wide ${
                  escalation.level === 'lockdown' ? 'text-red-800' :
                  escalation.level === 'alert' ? 'text-orange-800' :
                  'text-amber-800'
                }`}>
                  {escalation.level === 'lockdown' ? 'LOCKDOWN ATIVO — Ataque Coordenado' :
                   escalation.level === 'alert' ? 'ALERTA DE ESCALONAMENTO' :
                   'Atividade Sob Observacao'}
                </h2>
              </div>
              <p className="text-sm text-gray-700 mb-2">{escalation.recommendation}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3">
                <div className="bg-white/70 rounded p-2">
                  <p className="text-gray-500 text-[10px]">IPs bloqueados (ultimos {escalation.windowMinutes}min)</p>
                  <p className="font-bold text-lg">{escalation.uniqueIpsInWindow}</p>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <p className="text-gray-500 text-[10px]">Total de bloqueios</p>
                  <p className="font-bold text-lg">{escalation.blocksInWindow}</p>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <p className="text-gray-500 text-[10px]">Provedores coordenados</p>
                  <p className="font-bold text-sm truncate">{escalation.coordinatedProviders.length > 0 ? escalation.coordinatedProviders.slice(0, 2).join(', ') : '—'}</p>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <p className="text-gray-500 text-[10px]">Endpoints alvejados</p>
                  <p className="font-bold text-sm truncate">{escalation.coordinatedPaths.length > 0 ? escalation.coordinatedPaths[0] : '—'}</p>
                </div>
              </div>
              {escalation.topProvidersInWindow.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-gray-500 mb-1">Top provedores na janela:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {escalation.topProvidersInWindow.slice(0, 8).map(p => (
                      <span key={p.provider} className="px-2 py-0.5 bg-white rounded text-[10px] font-mono border border-gray-200">
                        {p.provider}: <b className="text-red-600">{p.count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {escalation.lockdownActive ? (
                <>
                  <button onClick={() => handleLockdown(false)} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
                    Desativar Lockdown
                  </button>
                  {escalation.lockdownUntil && (
                    <p className="text-[10px] text-gray-500 text-center">Ate {new Date(escalation.lockdownUntil).toLocaleTimeString('pt-BR')}</p>
                  )}
                </>
              ) : (
                <button onClick={() => handleLockdown(true)} className="px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800">
                  Ativar Lockdown 60min
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deception / Honeypot Ativo */}
      {deception && deception.totalEvents > 0 && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-300 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                Honeypot Ativo — Atacantes que Morderam o Bait
              </h2>
              <p className="text-[10px] text-purple-500 mt-0.5">Conteudo falso servido em rotas-isca + canary tokens rastreaveis</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
              <p className="text-2xl font-bold text-purple-700">{deception.totalEvents}</p>
              <p className="text-[10px] text-gray-500">Bait Hits Total</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
              <p className="text-2xl font-bold text-fuchsia-700">{deception.topVictims?.length || 0}</p>
              <p className="text-[10px] text-gray-500">Atacantes Unicos</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
              <p className="text-2xl font-bold text-pink-700">{((deception.totalBytesServed || 0) / 1024).toFixed(1)} kB</p>
              <p className="text-[10px] text-gray-500">Lixo Servido</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
              <p className="text-2xl font-bold text-violet-700">{deception.totalTarpitMinutes || 0}min</p>
              <p className="text-[10px] text-gray-500">Tempo Tarpit</p>
            </div>
          </div>

          {/* CANARY ALERTS — quando alguem tenta usar credencial falsa */}
          {deception.triggeredCanaries && deception.triggeredCanaries.length > 0 && (
            <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-xl p-4">
              <p className="text-xs font-bold text-red-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                CANARY DISPARADO ({deception.triggeredCanaries.length}) — credenciais falsas que vazaram foram USADAS!
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {deception.triggeredCanaries.map((c: any, i: number) => (
                  <div key={i} className="bg-white rounded p-2 text-[10px]">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-mono text-red-700 font-bold">{c.token}</span>
                      <span className="text-gray-400">{new Date(c.triggeredAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="mt-1 text-gray-600">
                      Servido para <b className="font-mono">{c.servedToIp}</b> ({c.baitType}) → <b className="text-red-600">usado por {c.triggerSource}</b>
                    </div>
                    {c.triggerNote && <div className="text-gray-400 italic">{c.triggerNote}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tipos de bait mais usados */}
          {deception.byBaitType && Object.keys(deception.byBaitType).length > 0 && (
            <div className="bg-white rounded-lg p-3 border border-purple-100 mb-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Baits Mais Mordidos:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(deception.byBaitType).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]: any) => (
                  <span key={type} className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-[10px] font-mono">
                    {type}: <b className="text-purple-700">{count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top vítimas (atacantes que mais morderam) */}
          {deception.topVictims && deception.topVictims.length > 0 && (
            <div className="bg-white rounded-lg p-3 border border-purple-100 mb-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Top Atacantes Iludidos (clique para bloquear):</p>
              <div className="flex flex-wrap gap-1.5">
                {deception.topVictims.slice(0, 15).map((v: any) => (
                  <button
                    key={v.ip}
                    onClick={() => handleBlock(v.ip)}
                    className="px-2 py-1 bg-purple-50 border border-purple-300 rounded text-[10px] font-mono hover:bg-purple-200 transition-colors"
                  >
                    {v.ip} <b className="text-purple-700">({v.count}x)</b>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Eventos recentes */}
          {deception.recentEvents && deception.recentEvents.length > 0 && (
            <div className="bg-white rounded-lg border border-purple-100 overflow-hidden">
              <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                <p className="text-xs font-bold text-purple-900">Bait Hits Recentes ({deception.recentEvents.length})</p>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(deception, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `deception-report-${new Date().toISOString().substring(0, 19).replace(/:/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded hover:bg-purple-700"
                >
                  Download JSON
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                {deception.recentEvents.slice(0, 30).map((e: any, i: number) => (
                  <div key={i} className="px-3 py-1.5 text-[10px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-800">{e.ip}</span>
                      <span className="px-1.5 py-0 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">{e.baitType}</span>
                      <span className="text-gray-500 font-mono truncate flex-1">{e.path}</span>
                      <span className="text-purple-600">{e.responseSize}b</span>
                      <span className="text-violet-600">{e.durationMs}ms</span>
                      <span className="text-gray-400 shrink-0">{new Date(e.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attack Report */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-red-800">Relatorio de Ataques (Banco de Dados)</h2>
            <p className="text-[10px] text-red-500">Dados persistentes — nao se perdem com restart do servidor</p>
          </div>
          <button onClick={loadAttackReport} disabled={loadingReport} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-300">
            {loadingReport ? 'Carregando...' : attackReport ? 'Atualizar Relatorio' : 'Gerar Relatorio'}
          </button>
        </div>
        {reportError && (
          <div className="mb-3 px-3 py-2 bg-red-100 border border-red-300 rounded-lg text-[11px] text-red-800 font-mono break-all">
            <b>Erro ao carregar relatorio:</b> {reportError}
          </div>
        )}
        {attackReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                <p className="text-2xl font-bold text-red-600">{attackReport.totalAttacks}</p>
                <p className="text-[10px] text-gray-500">Total Ataques</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                <p className="text-2xl font-bold text-orange-600">{attackReport.uniqueIps}</p>
                <p className="text-[10px] text-gray-500">IPs Unicos</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                <p className="text-2xl font-bold text-purple-600">{attackReport.durationHours || 0}h</p>
                <p className="text-[10px] text-gray-500">Duracao</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                <p className="text-[11px] font-bold text-gray-700">{attackReport.firstAttack ? new Date(attackReport.firstAttack).toLocaleString('pt-BR') : '—'}</p>
                <p className="text-[10px] text-gray-500">Primeiro Ataque</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                <p className="text-[11px] font-bold text-gray-700">{attackReport.lastAttack ? new Date(attackReport.lastAttack).toLocaleString('pt-BR') : '—'}</p>
                <p className="text-[10px] text-gray-500">Ultimo Ataque</p>
              </div>
            </div>
            {/* Classificacao Forense de Ataques */}
            {attackReport.byAttackType && Object.keys(attackReport.byAttackType).length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-200">
                <p className="text-xs font-bold text-gray-700 mb-2">Classificacao Forense por Tipo de Ataque:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(attackReport.byAttackType).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]: any) => {
                    const labels: Record<string, { label: string; color: string }> = {
                      sql_injection: { label: 'SQL Injection', color: 'bg-red-600 text-white' },
                      xss: { label: 'XSS', color: 'bg-pink-600 text-white' },
                      path_traversal: { label: 'Path Traversal', color: 'bg-orange-600 text-white' },
                      rce_attempt: { label: 'RCE / Log4Shell', color: 'bg-purple-700 text-white' },
                      config_probe: { label: 'Config Probe (.env/.git)', color: 'bg-yellow-600 text-white' },
                      admin_probe: { label: 'Admin Probe (wp-admin etc)', color: 'bg-amber-600 text-white' },
                      api_recon: { label: 'API Recon (swagger/graphql)', color: 'bg-cyan-700 text-white' },
                      brute_force: { label: 'Brute Force (login)', color: 'bg-red-700 text-white' },
                      scanner_tool: { label: 'Scanner (sqlmap/nikto)', color: 'bg-fuchsia-700 text-white' },
                      bot_scraper: { label: 'Bot/Scraper', color: 'bg-blue-600 text-white' },
                      honeypot_hit: { label: 'Honeypot Hit', color: 'bg-purple-600 text-white' },
                      cloud_hosting: { label: 'Cloud/Hosting IP', color: 'bg-gray-700 text-white' },
                      other: { label: 'Outros', color: 'bg-gray-400 text-white' },
                    };
                    const info = labels[type] || { label: type, color: 'bg-gray-500 text-white' };
                    return (
                      <span key={type} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${info.color}`}>
                        {info.label}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {attackReport.byProvider && Object.keys(attackReport.byProvider).length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">Ataques por Provedor:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Object.entries(attackReport.byProvider).sort((a: any, b: any) => b[1] - a[1]).slice(0, 20).map(([provider, count]: any) => (
                      <span key={provider} className="px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] font-mono">
                        {provider}: <b>{count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {attackReport.byCountry && Object.keys(attackReport.byCountry).length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">Ataques por Pais:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Object.entries(attackReport.byCountry).sort((a: any, b: any) => b[1] - a[1]).map(([country, count]: any) => (
                      <span key={country} className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-[10px] font-mono">
                        {country}: <b>{count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top IPs Atacantes */}
            {attackReport.topIps && attackReport.topIps.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-100">
                <p className="text-xs font-bold text-gray-700 mb-2">Top IPs Atacantes (clique pra bloquear):</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {attackReport.topIps.slice(0, 20).map((item: any) => (
                    <button
                      key={item.key}
                      onClick={() => handleBlock(item.key)}
                      className="px-2 py-1 bg-red-50 border border-red-300 rounded text-[10px] font-mono hover:bg-red-200 transition-colors"
                    >
                      {item.key} <b className="text-red-700">({item.count})</b>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top Endpoints Atacados */}
            {attackReport.topPaths && attackReport.topPaths.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-100">
                <p className="text-xs font-bold text-gray-700 mb-2">Top Endpoints Atacados:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {attackReport.topPaths.slice(0, 15).map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between text-[10px] font-mono px-2 py-0.5 bg-red-50 rounded">
                      <span className="truncate">{item.key}</span>
                      <b className="text-red-700 ml-2">{item.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top User-Agents */}
            {attackReport.topUserAgents && attackReport.topUserAgents.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-100">
                <p className="text-xs font-bold text-gray-700 mb-2">Top User-Agents Atacantes:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {attackReport.topUserAgents.slice(0, 10).map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between text-[10px] font-mono px-2 py-0.5 bg-red-50 rounded">
                      <span className="truncate">{item.key || '(vazio)'}</span>
                      <b className="text-red-700 ml-2 shrink-0">{item.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline horaria */}
            {attackReport.timeline && attackReport.timeline.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-100">
                <p className="text-xs font-bold text-gray-700 mb-2">
                  Timeline Horaria de Ataques
                  {attackReport.peakHour && <span className="ml-2 text-red-600">— Pico: {attackReport.peakHour.hour} ({attackReport.peakHour.count} ataques)</span>}
                </p>
                <div className="flex items-end gap-0.5 h-20 overflow-x-auto">
                  {attackReport.timeline.map((bucket: any) => {
                    const maxCount = Math.max(...attackReport.timeline.map((b: any) => b.count));
                    const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                    return (
                      <div key={bucket.hour} className="flex flex-col items-center group relative shrink-0" style={{ width: '8px' }}>
                        <div
                          className="w-full bg-red-500 hover:bg-red-700 transition-colors rounded-t"
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          title={`${bucket.hour}: ${bucket.count} ataques`}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Cada barra = 1 hora — passe o mouse para detalhes</p>
              </div>
            )}

            {attackReport.events && attackReport.events.length > 0 && (
              <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-red-800">Log de Eventos ({attackReport.events.length})</p>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(attackReport, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `attack-report-${new Date().toISOString().substring(0, 19).replace(/:/g, '-')}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                  >
                    Download JSON Forense
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {attackReport.events.map((e: any, i: number) => (
                    <div key={i} className="px-3 py-2 text-[10px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-800">{e.ip}</span>
                        {e.attackTypes && e.attackTypes.map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">{t}</span>
                        ))}
                        {e.geo && <span className="text-gray-400">{e.geo}</span>}
                        {e.org && <span className="text-blue-500 text-[9px]">{e.org}</span>}
                        <span className="text-gray-400 ml-auto shrink-0">{new Date(e.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="text-red-500 italic mt-0.5 truncate">{e.reason}</div>
                      {e.path && <div className="text-gray-500 font-mono mt-0.5 truncate">path: {e.path}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-red-600">{summary.totalBlocked}</p>
          <p className="text-xs text-red-500 font-medium">IPs Bloqueados</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-amber-600">{summary.totalWatching}</p>
          <p className="text-xs text-amber-500 font-medium">Em Observacao</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-purple-600">{summary.totalRanges || 0}</p>
          <p className="text-xs text-purple-500 font-medium">Faixas Bloqueadas</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{summary.totalTracked}</p>
          <p className="text-xs text-blue-500 font-medium">Total Rastreados</p>
        </div>
      </div>

      {/* Manual Block */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Bloquear IP (permanente)</p>
          <div className="flex gap-3">
            <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={blockIpInput} onChange={e => setBlockIpInput(e.target.value)} placeholder="Ex: 35.247.111.159" />
            <button onClick={() => handleBlock()} disabled={!blockIpInput} className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-300 text-sm">Bloquear</button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Bloquear Faixa de IPs (subnet)</p>
          <div className="flex gap-3">
            <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={blockRangeInput} onChange={e => setBlockRangeInput(e.target.value)} placeholder="Ex: 178.156. (bloqueia 178.156.*)" />
            <button onClick={handleBlockRange} disabled={!blockRangeInput} className="px-5 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:bg-gray-300 text-sm">Bloquear Faixa</button>
          </div>
        </div>
      </div>

      {/* Blocked Ranges */}
      {(data?.blockedRanges?.length ?? 0) > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-purple-800 mb-2">Faixas de IP Bloqueadas ({data!.blockedRanges.length})</p>
          <div className="flex flex-wrap gap-2">
            {data!.blockedRanges.map((r, i) => (
              <span key={i} className="px-3 py-1 bg-white border border-purple-200 rounded-lg text-xs font-mono">
                <span className="text-purple-700 font-bold">{r.prefix}*</span>
                <span className="text-gray-400 ml-2">{r.reason}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Protection Layers */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-fuchsia-50 border border-indigo-200 rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-gray-900 mb-3">8 Camadas de Protecao Ativas</p>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { title: 'Bot Killer', desc: 'Bloqueia Go, Python, curl, wget, Scrapy, etc.', color: 'text-red-500' },
            { title: 'Honeypot', desc: 'Armadilhas invisiveis (.env, /wp-admin, /api/docs)', color: 'text-purple-500' },
            { title: 'Fingerprint', desc: 'Rejeita requests sem headers de navegador real', color: 'text-blue-500' },
            { title: 'Rate Limit', desc: '30 req/min em rotas sensiveis', color: 'text-amber-500' },
            { title: 'Geo Tracking', desc: 'IP → Cidade, ISP, Cloud vs Residencial', color: 'text-cyan-500' },
            { title: 'Cloud Detect', desc: 'Flag Google Cloud, AWS, Azure, DigitalOcean', color: 'text-orange-500' },
            { title: 'Watermark', desc: 'SHA-256 em todos os documentos gerados', color: 'text-emerald-500' },
            { title: 'Permanent Ban', desc: 'Bloqueio permanente apos 2 infrações', color: 'text-gray-700' },
          ].map(p => (
            <div key={p.title} className="bg-white/60 rounded-xl p-3 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={`text-xs font-bold ${p.color}`}>{p.title}</span>
              </div>
              <p className="text-[10px] text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* IP Lists */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {/* Blocked */}
          {(data?.blocked?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <h3 className="font-semibold text-red-800 text-sm">IPs Bloqueados ({data!.blocked.length})</h3>
                <span className="text-[10px] text-red-400">Clique no IP para detalhes</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {data!.blocked.map(item => <IpRow key={item.ip} item={item} variant="blocked" />)}
              </div>
            </div>
          )}

          {/* Watching */}
          {(data?.watching?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                <h3 className="font-semibold text-amber-800 text-sm">Em Observacao ({data!.watching.length})</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {data!.watching.map(item => <IpRow key={item.ip} item={item} variant="watching" />)}
              </div>
            </div>
          )}

          {!data?.blocked?.length && !data?.watching?.length && (
            <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
              <p className="text-emerald-600 font-semibold">Nenhuma ameaca detectada — sistema operando normalmente</p>
            </div>
          )}

          {/* All Connected */}
          {(data?.allConnected?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm">Todos os IPs Conectados ({data!.allConnected.length})</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {data!.allConnected.map(item => <IpRow key={item.ip} item={item} variant="connected" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
