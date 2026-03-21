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

export default function SegurancaPage() {
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockRangeInput, setBlockRangeInput] = useState('');
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [attackReport, setAttackReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const { data, isLoading } = useSWR<SecurityData>(
    '/api/security/dashboard',
    authedFetcher,
    { ...SWR_OPTIONS_FAST, refreshInterval: 5000 },
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
    try {
      const res = await fetch(`${apiBase}/api/security/attack-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setAttackReport(json.data);
    } catch { /* ignore */ }
    setLoadingReport(false);
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
            {attackReport.byProvider && Object.keys(attackReport.byProvider).length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-100">
                <p className="text-xs font-bold text-gray-700 mb-2">Ataques por Provedor:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(attackReport.byProvider).sort((a: any, b: any) => b[1] - a[1]).map(([provider, count]: any) => (
                    <span key={provider} className="px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] font-mono">
                      {provider}: <b>{count}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {attackReport.events && attackReport.events.length > 0 && (
              <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 border-b border-red-100">
                  <p className="text-xs font-bold text-red-800">Log de Eventos ({attackReport.events.length})</p>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {attackReport.events.map((e: any, i: number) => (
                    <div key={i} className="px-3 py-2 text-[10px] flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-800">{e.ip}</span>
                        {e.geo && <span className="text-gray-400">{e.geo}</span>}
                        {e.org && <span className="text-blue-500">{e.org}</span>}
                        <span className="text-red-400 italic">{e.reason?.substring(0, 60)}</span>
                      </div>
                      <span className="text-gray-400 shrink-0 ml-2">{new Date(e.timestamp).toLocaleString('pt-BR')}</span>
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
