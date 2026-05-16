'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
  documentText: string | null;
  poderes: string[] | null;
  createdAt: string;
  responsavelEmail?: string | null;
  responsavelPhone?: string | null;
  grantMode?: string | null;
  autoGrantStatus?: string | null;
  autoGrantAttemptedAt?: string | null;
  autoGrantError?: string | null;
  autoGrantProtocol?: string | null;
};

type AuditEvent = {
  id: string;
  event: string;
  message: string | null;
  actorType: string | null;
  payload: any;
  createdAt: string;
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

export default function ProcuracaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const procId = search.get('procId');
  const [proc, setProc] = useState<Procuration | null>(null);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ recipientName: '', recipientEmail: '', recipientPhone: '' });
  const [inviteResult, setInviteResult] = useState<{ link: string } | null>(null);
  const [autoCapability, setAutoCapability] = useState<{ supported: boolean; reason?: string } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoResult, setAutoResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    api('/procuration/auto-grant/capability')
      .then(r => setAutoCapability(r.data))
      .catch(() => setAutoCapability({ supported: false, reason: 'erro_consulta' }));
  }, []);

  async function tryAutoGrant() {
    if (!proc) return;
    setAutoBusy(true); setAutoResult(null);
    try {
      const r = await api(`/procuration/${proc.id}/auto-grant`, { method: 'POST', body: JSON.stringify({}) });
      if (r.success) {
        setAutoResult({ ok: true, message: `Outorga automatica concluida! Protocolo: ${r.protocol || '—'}` });
      } else {
        setAutoResult({ ok: false, message: `Modo automatico indisponivel (${r.reason}). Use o convite manual ao lado.` });
      }
      await load();
    } catch (e: any) {
      setAutoResult({ ok: false, message: `Erro: ${e.message}` });
    } finally {
      setAutoBusy(false);
    }
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      let target: Procuration | null = null;
      if (procId) {
        const r = await api(`/procuration/${procId}`);
        target = r.data;
      } else {
        const r = await api(`/procuration/list?clientId=${encodeURIComponent(params.id)}`);
        target = (r.data || [])[0] || null;
      }
      setProc(target);
      if (target) {
        const a = await api(`/procuration/${target.id}/audit`).catch(() => ({ data: [] }));
        setAudits(a.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar procuracao');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [procId, params.id]);

  async function sendInvite() {
    if (!proc) return;
    setBusy(true);
    try {
      const r = await api(`/procuration/${proc.id}/invite`, {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      setInviteResult({ link: r.data.link });
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    if (!proc) return;
    if (!confirm('Renovar esta procuracao? A atual sera marcada como expirada e uma nova sera criada.')) return;
    setBusy(true);
    try {
      const r = await api(`/procuration/${proc.id}/renew`, { method: 'POST' });
      window.location.href = `/consultri/cliente/${encodeURIComponent(params.id)}/procuracao?procId=${r.data.id}`;
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkSerpro() {
    if (!proc) return;
    setBusy(true);
    try {
      await api(`/procuration/${proc.id}/check-serpro`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e: any) {
      alert('Erro ao verificar SERPRO: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadGuide() {
    if (!proc?.documentText) return;
    const blob = new Blob([proc.documentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procuracao-consultri-${proc.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyGuide() {
    if (!proc?.documentText) return;
    navigator.clipboard.writeText(proc.documentText);
    alert('Guia copiado!');
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Carregando…</div>;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl p-6">
          {error}
        </div>
      </div>
    );
  }
  if (!proc) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gray-400 mb-4">Nenhuma procuracao encontrada para este cliente.</p>
          <Link href="/consultri/carteira" className="text-sky-400 hover:underline">
            ← Voltar a carteira
          </Link>
        </div>
      </div>
    );
  }

  const poderes: string[] = Array.isArray(proc.poderes) ? proc.poderes : [];
  const granted = proc.serproDiff?.granted || [];
  const missing = proc.serproDiff?.missing || [];
  const grantedSet = new Set(granted.map(g => g.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/60">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link href="/consultri/carteira" className="text-xs text-gray-400 hover:text-white">
              ← Carteira
            </Link>
            <h1 className="text-xl font-bold mt-1">Procuracao Eletronica · CONSULTRI</h1>
            <p className="text-xs text-gray-500">
              Procurador: {proc.procuradorNome || '—'} · CNPJ {proc.procuradorCnpj || '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/consultri/cliente/${proc.id}/timeline`}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
            >
              🗓️ Timeline
            </Link>
            <Link
              href={`/consultri/cliente/${proc.id}/coleta`}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
            >
              📊 Coleta Federal
            </Link>
            <a
              href={`/api/procurations/${proc.id}/report?anoBase=${new Date().getFullYear() - 1}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30"
            >
              📄 Relatório PDF
            </a>
            <button
              onClick={() => setShowInvite(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 hover:bg-purple-500/30"
            >
              📨 Enviar convite ao cliente
            </button>
            <button
              onClick={checkSerpro}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {busy ? 'Verificando…' : 'Verificar SERPRO'}
            </button>
            <button
              onClick={renew}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
            >
              Renovar
            </button>
            <button
              onClick={copyGuide}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
            >
              Copiar
            </button>
            <button
              onClick={downloadGuide}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-gray-950 hover:bg-emerald-400"
            >
              .txt
            </button>
          </div>
        </div>
      </header>

      {/* AVISO modo hibrido + escolha */}
      {proc.serproStatus !== 'active' && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="bg-gradient-to-br from-slate-900 to-gray-900 border border-purple-500/30 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">ℹ</span>
              <div>
                <h3 className="font-bold text-purple-200">Como funciona a outorga (modo hibrido)</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  A procuracao eletronica no e-CAC SO pode ser efetivada pelo representante legal da empresa
                  cliente usando o certificado digital dela. Nosso sistema oferece duas vias compativeis com a lei:
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {/* Card Auto */}
              <div className={`rounded-xl p-4 border ${autoCapability?.supported ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-gray-700 bg-gray-900/60 opacity-70'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs uppercase font-bold tracking-wider ${autoCapability?.supported ? 'text-emerald-300' : 'text-gray-500'}`}>
                    {autoCapability?.supported ? '✓ Disponivel' : '✗ Nao disponivel'}
                  </span>
                </div>
                <h4 className="font-bold text-white mb-1">Modo Automatico (SERPRO AUTENTICAPROCURADOR)</h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Quando o contrato SERPRO da CONSULTRI inclui o servico AUTENTICAPROCURADOR e ha XML
                  da procuracao previamente assinado pelo outorgante, a outorga e feita programaticamente
                  sem o cliente abrir o CAV.
                </p>
                {autoCapability?.supported ? (
                  <button
                    onClick={tryAutoGrant}
                    disabled={autoBusy}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {autoBusy ? 'Tentando…' : 'Tentar outorga automatica'}
                  </button>
                ) : (
                  <div className="text-[11px] text-gray-500 italic">
                    Motivo: {autoCapability?.reason || 'capacidade nao verificada ainda'}.
                    {autoCapability?.reason === 'sem_conexao_serpro_ativa' && (
                      <span> Cadastre em <Link href="/consultri/configuracoes" className="text-sky-400 underline">/consultri/configuracoes</Link>.</span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Manual */}
              <div className="rounded-xl p-4 border border-sky-500/40 bg-sky-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-sky-300">✓ Sempre disponivel</span>
                </div>
                <h4 className="font-bold text-white mb-1">Modo Guiado (link magico)</h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Cliente final recebe link unico no e-mail/WhatsApp com passo a passo visual (8 passos,
                  checklist dos 45 poderes, CNPJ do procurador). Ele faz a outorga no CAV com o cert digital
                  dele e nossa plataforma detecta automaticamente em ate 15 minutos via SERPRO.
                </p>
                <button
                  onClick={() => setShowInvite(true)}
                  className="w-full px-3 py-2 rounded-lg bg-sky-500/80 text-white font-semibold text-sm hover:bg-sky-500"
                >
                  Enviar convite ao cliente
                </button>
              </div>
            </div>

            {autoResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${autoResult.ok ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30' : 'bg-orange-500/10 text-orange-200 border border-orange-500/30'}`}>
                {autoResult.message}
              </div>
            )}

            {proc.grantMode && (
              <div className="mt-3 text-xs text-gray-500 italic">
                Modo atual desta procuracao: <strong className="text-gray-300">{
                  proc.grantMode === 'auto_serpro' ? 'Automatico (SERPRO)' :
                  proc.grantMode === 'manual_invite' ? 'Manual (link magico)' :
                  proc.grantMode
                }</strong>
                {proc.autoGrantProtocol && <> · protocolo {proc.autoGrantProtocol}</>}
                {proc.autoGrantError && <> · erro: {proc.autoGrantError}</>}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: status + diff */}
        <section className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Status SERPRO</p>
            <p className="text-2xl font-black mb-1">
              {proc.serproStatus === 'active' && <span className="text-emerald-300">Ativa</span>}
              {proc.serproStatus === 'partial' && <span className="text-orange-300">Poderes faltando</span>}
              {proc.serproStatus === 'not_found' && <span className="text-red-300">Nao encontrada</span>}
              {(!proc.serproStatus || proc.serproStatus === 'pending_serpro') && (
                <span className="text-sky-300">Aguardando outorga</span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {proc.lastSerproCheckAt
                ? `Ultima verificacao: ${new Date(proc.lastSerproCheckAt).toLocaleString('pt-BR')}`
                : 'Ainda nao verificada via OBTERPROCURACAO41'}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Vigencia</p>
            <p className="text-lg font-bold">
              {proc.dataValidade ? new Date(proc.dataValidade).toLocaleDateString('pt-BR') : '—'}
            </p>
            <p className="text-xs text-gray-500">
              Gerada em {new Date(proc.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">Resumo poderes</p>
            <div className="space-y-2 text-sm">
              <Row label="Requeridos" value={poderes.length} color="text-white" />
              <Row label="Outorgados" value={granted.length} color="text-emerald-300" />
              <Row label="Faltando"   value={missing.length} color={missing.length > 0 ? 'text-orange-300' : 'text-gray-500'} />
            </div>
          </div>
        </section>

        {/* Coluna direita: checklist de poderes */}
        <section className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Checklist de poderes (PDF CONSULTRI JUN2025)</h2>
            <p className="text-xs text-gray-500 mb-4">
              Marque cada item dentro do CAV. Apos cadastrar, clique em <strong>Verificar SERPRO agora</strong> para
              confirmar quais ja foram outorgados via OBTERPROCURACAO41.
            </p>
            <ul className="space-y-1.5">
              {poderes.map((pod, i) => {
                const isGranted = Array.from(grantedSet).some(g =>
                  g.includes(pod.toLowerCase().slice(0, 20)) ||
                  pod.toLowerCase().includes(g.slice(0, 20))
                );
                return (
                  <li key={i} className="flex items-start gap-3 text-sm border-b border-gray-800/50 py-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black flex-shrink-0 mt-0.5 ${
                        isGranted ? 'bg-emerald-500 text-gray-950' : 'bg-gray-800 text-gray-600 border border-gray-700'
                      }`}
                    >
                      {isGranted ? '✓' : ''}
                    </span>
                    <span className={isGranted ? 'text-gray-300' : 'text-gray-400'}>{pod}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {proc.documentText && (
            <details className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <summary className="cursor-pointer font-bold text-sm uppercase text-gray-400 tracking-wider">
                Guia completo (texto enviado ao cliente)
              </summary>
              <pre className="mt-4 text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {proc.documentText}
              </pre>
            </details>
          )}

          {/* Timeline de auditoria */}
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-3">Timeline</h2>
            {audits.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum evento registrado ainda.</p>
            ) : (
              <ol className="space-y-3">
                {audits.map(a => (
                  <li key={a.id} className="flex gap-3 text-sm border-l-2 border-gray-800 pl-3 py-1">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold flex-shrink-0 ${eventTone(a.event)}`}>
                      {eventIcon(a.event)}
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-200">
                        <strong>{eventLabel(a.event)}</strong>
                        {a.message ? ` — ${a.message}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleString('pt-BR')} · {a.actorType || 'system'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>

      {/* Modal convite */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowInvite(false); setInviteResult(null); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">Enviar convite ao cliente</h2>
            <p className="text-sm text-gray-400 mb-5">
              Gera um link unico de outorga (valido 14 dias). Cliente final segue o passo a passo
              guiado sem precisar criar conta.
            </p>

            {!inviteResult ? (
              <>
                <div className="space-y-3">
                  <Input label="Nome do responsavel" value={inviteForm.recipientName} onChange={v => setInviteForm({ ...inviteForm, recipientName: v })} />
                  <Input label="Email" type="email" value={inviteForm.recipientEmail} onChange={v => setInviteForm({ ...inviteForm, recipientEmail: v })} />
                  <Input label="WhatsApp (E.164: +5521...)" value={inviteForm.recipientPhone} onChange={v => setInviteForm({ ...inviteForm, recipientPhone: v })} />
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                  <button
                    onClick={sendInvite}
                    disabled={busy || (!inviteForm.recipientEmail && !inviteForm.recipientPhone)}
                    className="px-5 py-2 rounded-lg font-semibold bg-emerald-500 text-gray-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {busy ? 'Enviando…' : 'Gerar link + enviar'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-emerald-500/20 rounded-full flex items-center justify-center text-3xl">✓</div>
                <p className="text-gray-300 mb-4">Convite criado e notificacao enviada (ou registrada para envio).</p>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs font-mono break-all text-emerald-300">
                  {window.location.origin}{inviteResult.link}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.origin + inviteResult.link); alert('Link copiado!'); }}
                  className="mt-3 px-4 py-2 text-sm rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200"
                >
                  Copiar link
                </button>
                <button onClick={() => { setShowInvite(false); setInviteResult(null); }} className="ml-2 mt-3 px-4 py-2 text-sm text-gray-400">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
      />
    </div>
  );
}

function eventLabel(event: string): string {
  const map: Record<string, string> = {
    created: 'Procuracao criada',
    guide_generated: 'Guia gerado',
    invite_sent: 'Convite enviado',
    invite_opened: 'Convite aberto pelo cliente',
    invite_acknowledged: 'Cliente confirmou outorga',
    serpro_check: 'Verificacao SERPRO',
    serpro_active: 'Procuracao ATIVADA',
    serpro_partial: 'Procuracao parcial',
    alert_sent: 'Alerta de vencimento',
    renewed: 'Renovada',
    revoked: 'Revogada',
    note: 'Anotacao',
  };
  return map[event] || event;
}

function eventTone(event: string): string {
  if (event.startsWith('serpro_active')) return 'bg-emerald-500/20 text-emerald-300';
  if (event === 'serpro_partial' || event === 'alert_sent') return 'bg-yellow-500/20 text-yellow-300';
  if (event === 'revoked') return 'bg-red-500/20 text-red-300';
  if (event === 'invite_sent' || event === 'invite_opened' || event === 'invite_acknowledged') return 'bg-purple-500/20 text-purple-300';
  return 'bg-gray-700/40 text-gray-300';
}

function eventIcon(event: string): string {
  if (event === 'created' || event === 'guide_generated') return '+';
  if (event === 'serpro_active') return '✓';
  if (event === 'serpro_partial') return '~';
  if (event === 'invite_sent' || event === 'invite_opened') return '✉';
  if (event === 'invite_acknowledged') return '☑';
  if (event === 'alert_sent') return '!';
  if (event === 'renewed') return '↻';
  if (event === 'revoked') return '✕';
  return '•';
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={`font-black text-lg ${color}`}>{value}</span>
    </div>
  );
}
