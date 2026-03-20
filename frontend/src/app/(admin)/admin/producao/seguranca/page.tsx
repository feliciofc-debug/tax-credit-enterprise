'use client';
import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface SecurityData {
  summary: { totalBlocked: number; totalWatching: number; totalTracked: number };
  blocked: Array<{ ip: string; record: any }>;
  watching: Array<{ ip: string; record: any }>;
  allConnected: Array<{ ip: string; record: any }>;
}

export default function SegurancaPage() {
  const [blockIpInput, setBlockIpInput] = useState('');

  const { data, isLoading } = useSWR<SecurityData>(
    '/api/security/dashboard',
    authedFetcher,
    { ...SWR_OPTIONS_FAST, refreshInterval: 10000 },
  );

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const handleBlock = useCallback(async () => {
    if (!blockIpInput) return;
    await fetch(`${apiBase}/api/security/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ip: blockIpInput }),
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

  const summary = data?.summary || { totalBlocked: 0, totalWatching: 0, totalTracked: 0 };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Seguranca e Monitoramento</h1>
        <p className="text-gray-500 text-sm mt-1">Anti-scraping, watermark em documentos, bloqueio de IPs suspeitos — atualiza a cada 10s</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-red-600">{summary.totalBlocked}</p>
          <p className="text-xs text-red-500 font-medium">IPs Bloqueados</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-amber-600">{summary.totalWatching}</p>
          <p className="text-xs text-amber-500 font-medium">Em Observacao</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{summary.totalTracked}</p>
          <p className="text-xs text-blue-500 font-medium">Total Rastreados</p>
        </div>
      </div>

      {/* Manual Block */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-semibold text-gray-900 mb-3">Bloquear IP Manualmente</p>
        <div className="flex gap-3">
          <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={blockIpInput} onChange={e => setBlockIpInput(e.target.value)} placeholder="Ex: 192.168.1.100" />
          <button onClick={handleBlock} disabled={!blockIpInput} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-300 text-sm">Bloquear</button>
        </div>
      </div>

      {/* Protection Features */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-fuchsia-50 border border-indigo-200 rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-gray-900 mb-3">Protecoes Ativas</p>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { title: 'Anti-Scraping', desc: 'Detecta bots, crawlers e automacao', status: true },
            { title: 'Rate Limiting', desc: 'Limita requisicoes por IP e rota', status: true },
            { title: 'Watermark', desc: 'Marca digital em documentos gerados', status: true },
            { title: 'CORS + Helmet', desc: 'Headers de seguranca e origens', status: true },
          ].map(p => (
            <div key={p.title} className="bg-white/60 rounded-xl p-3 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-gray-900">{p.title}</span>
              </div>
              <p className="text-[10px] text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked IPs */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {(data?.blocked?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-200">
                <h3 className="font-semibold text-red-800 text-sm">IPs Bloqueados ({data!.blocked.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data!.blocked.map(item => (
                  <div key={item.ip} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-gray-900">{item.ip}</span>
                        {item.record.geo && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
                            {item.record.geo.city}, {item.record.geo.region} — {item.record.geo.country}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">Score: {item.record.suspicionScore} | Requests: {item.record.count} | Endpoints: {item.record.endpointCount}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.record.geo?.isp ? `ISP: ${item.record.geo.isp} | ` : ''}UA: {item.record.userAgent?.substring(0, 80) || '—'}
                      </p>
                    </div>
                    <button onClick={() => handleUnblock(item.ip)} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 shrink-0">Desbloquear</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data?.watching?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                <h3 className="font-semibold text-amber-800 text-sm">Em Observacao ({data!.watching.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data!.watching.map(item => (
                  <div key={item.ip} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-gray-900">{item.ip}</span>
                        {item.record.geo && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                            {item.record.geo.city}, {item.record.geo.region} — {item.record.geo.country}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">Score: {item.record.suspicionScore} | Requests: {item.record.count}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.record.geo?.isp ? `ISP: ${item.record.geo.isp} | ` : ''}UA: {item.record.userAgent?.substring(0, 80) || '—'}
                      </p>
                    </div>
                    <button onClick={() => { setBlockIpInput(item.ip); handleBlock(); }} className="px-3 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200 shrink-0">Bloquear</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data?.blocked?.length && !data?.watching?.length && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400">Nenhuma atividade suspeita detectada</p>
            </div>
          )}

          {/* All Connected IPs */}
          {(data?.allConnected?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm">Todos os IPs Conectados ({data!.allConnected.length})</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {data!.allConnected.map(item => (
                  <div key={item.ip} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${item.record.blocked ? 'bg-red-500' : item.record.suspicionScore >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="font-mono font-bold text-sm text-gray-900">{item.ip}</span>
                      {item.record.geo && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                          {item.record.geo.city}{item.record.geo.region ? `, ${item.record.geo.region}` : ''} — {item.record.geo.country}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      {item.record.geo?.isp && <span className="text-[10px] max-w-[150px] truncate">{item.record.geo.isp}</span>}
                      <span>Score: {item.record.suspicionScore}</span>
                      <span>{item.record.count} reqs</span>
                      <span>{item.record.endpointCount} endpoints</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
