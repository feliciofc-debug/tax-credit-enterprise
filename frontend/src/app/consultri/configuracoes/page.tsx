'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Conn = {
  id: string;
  cnpj: string;
  companyName: string;
  status: string;
  environment: string;
  procuracaoOk: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
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

export default function ConsultriConfiguracoesPage() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobBusy, setJobBusy] = useState<string | null>(null);
  const [jobLog, setJobLog] = useState<string>('');

  const [form, setForm] = useState({
    cnpj: '',
    companyName: '',
    consumerKey: '',
    consumerSecret: '',
    environment: 'trial',
    certBase64: '',
    certPassword: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api('/consultri/serpro-connections');
      setConns(r.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveConnection() {
    setSaving(true);
    try {
      await api('/consultri/serpro-connections', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      alert('Conexao SERPRO salva!');
      setForm({ ...form, consumerSecret: '', certBase64: '', certPassword: '' });
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function runJob(name: 'poll-serpro' | 'expiry-alerts' | 'collect-conformidade' | 'preventive-renewal') {
    setJobBusy(name); setJobLog('');
    try {
      const r = await api(`/procuration/jobs/${name}`, { method: 'POST' });
      setJobLog(JSON.stringify(r.data, null, 2));
    } catch (e: any) {
      setJobLog('ERRO: ' + e.message);
    } finally {
      setJobBusy(null);
    }
  }

  async function handleCertFile(file: File) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    setForm(f => ({ ...f, certBase64: btoa(binary) }));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/60">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/consultri/carteira" className="text-gray-400 hover:text-white">← Carteira</Link>
            <span className="text-gray-700">/</span>
            <span className="text-gray-300">Configuracoes</span>
          </div>
          <h1 className="text-xl font-bold mt-1">Configuracoes · Conexao SERPRO + Jobs</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: form */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Cadastrar / atualizar conexao SERPRO Integra Contador</h2>
            <p className="text-xs text-gray-500 mb-5">
              Esta conexao e usada para verificar procuracoes (OBTERPROCURACAO41) e coletar Caixa Postal,
              DCTFWeb e Situacao Fiscal. O CNPJ deve ser o do <em>contratante</em> SERPRO.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="CNPJ Contratante" value={form.cnpj} onChange={v => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0001-00" />
              <Field label="Razao Social"     value={form.companyName} onChange={v => setForm({ ...form, companyName: v })} />
              <Field label="Consumer Key"     value={form.consumerKey} onChange={v => setForm({ ...form, consumerKey: v })} />
              <Field label="Consumer Secret"  value={form.consumerSecret} onChange={v => setForm({ ...form, consumerSecret: v })} type="password" />
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Ambiente</label>
                <select
                  value={form.environment}
                  onChange={e => setForm({ ...form, environment: e.target.value })}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5"
                >
                  <option value="trial">trial</option>
                  <option value="production">production</option>
                </select>
              </div>
              <Field label="Senha do Certificado A1 (.pfx)" value={form.certPassword} onChange={v => setForm({ ...form, certPassword: v })} type="password" />
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                Certificado A1 (.pfx) — opcional
              </label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={e => e.target.files?.[0] && handleCertFile(e.target.files[0])}
                className="block w-full mt-2 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-500/20 file:text-sky-200 hover:file:bg-sky-500/30"
              />
              {form.certBase64 && (
                <p className="text-xs text-emerald-400 mt-2">✓ Certificado carregado ({Math.round(form.certBase64.length * 0.75 / 1024)} KB)</p>
              )}
            </div>

            <button
              onClick={saveConnection}
              disabled={saving || !form.cnpj || !form.consumerKey || !form.consumerSecret}
              className="mt-5 px-5 py-2.5 rounded-lg font-semibold bg-emerald-500 text-gray-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar conexao'}
            </button>
          </div>

          {/* Lista de conexoes */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-3">Conexoes ativas</h2>
            {loading && <p className="text-gray-500 text-sm">Carregando…</p>}
            {!loading && conns.length === 0 && (
              <p className="text-gray-500 text-sm">Nenhuma conexao cadastrada ainda. Cadastre acima.</p>
            )}
            {!loading && conns.length > 0 && (
              <div className="divide-y divide-gray-800">
                {conns.map(c => (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{c.companyName}</p>
                      <p className="text-xs text-gray-500 font-mono">{c.cnpj}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                        c.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {c.status} · {c.environment}
                      </span>
                      {c.lastError && (
                        <p className="text-xs text-red-400 mt-1 max-w-md">{c.lastError.substring(0, 80)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Coluna direita: triggers manuais */}
        <aside className="space-y-4">
          <CapabilityWidget />

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Jobs automaticos</h2>
            <p className="text-xs text-gray-500 mb-4">
              Os jobs rodam sozinhos quando <code>CONSULTRI_SCHEDULER_ENABLED=true</code>. Aqui voce
              executa manualmente pra testar.
            </p>

            <div className="space-y-2">
              <JobButton
                label="Verificar procuracoes via SERPRO"
                sub="a cada 15 min"
                onClick={() => runJob('poll-serpro')}
                busy={jobBusy === 'poll-serpro'}
              />
              <JobButton
                label="Enviar alertas vencimento"
                sub="60/30/7 dias · diario 08h BRT"
                onClick={() => runJob('expiry-alerts')}
                busy={jobBusy === 'expiry-alerts'}
              />
              <JobButton
                label="Coletar Conformidade"
                sub="Caixa Postal + Sitfis · diario 06h"
                onClick={() => runJob('collect-conformidade')}
                busy={jobBusy === 'collect-conformidade'}
              />
              <JobButton
                label="Renovacao Preventiva (hibrida)"
                sub="60d antes · auto-grant ou convite · diario 09h"
                onClick={() => runJob('preventive-renewal')}
                busy={jobBusy === 'preventive-renewal'}
              />
            </div>

            {jobLog && (
              <pre className="mt-4 p-3 bg-black/40 rounded-lg text-xs text-emerald-300 overflow-x-auto max-h-60 border border-gray-800">
                {jobLog}
              </pre>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-xs text-gray-400 leading-relaxed">
            <h3 className="font-bold text-white text-sm mb-2">Variaveis de ambiente</h3>
            <p>Para ativar envio real de email/WhatsApp configure no <code className="text-emerald-400">.env</code>:</p>
            <ul className="mt-2 space-y-1 font-mono text-[11px]">
              <li><code>CONSULTRI_SCHEDULER_ENABLED=true</code></li>
              <li><code>APP_URL=https://app.taxcredit.com.br</code></li>
              <li><code>SMTP_URL=smtp://user:pass@host:587</code></li>
              <li><code>SMTP_FROM=no-reply@taxcredit.com.br</code></li>
              <li><code>WHATSAPP_TOKEN=...</code></li>
              <li><code>WHATSAPP_PHONE_ID=...</code></li>
            </ul>
            <p className="mt-3">
              Sem essas, o sistema entra em modo <strong>log-only</strong> (registra na tabela
              Notification e exibe no log do servidor, sem enviar).
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
      />
    </div>
  );
}

function CapabilityWidget() {
  const [state, setState] = useState<{ supported?: boolean; reason?: string; loading: boolean; error?: string }>({ loading: false });

  async function check() {
    setState({ loading: true });
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const r = await fetch('/api/procuration/auto-grant/capability', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'falha');
      setState({ supported: j.data?.supported, reason: j.data?.reason, loading: false });
    } catch (e: any) {
      setState({ loading: false, error: e.message });
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-bold mb-1">Capability AUTENTICAPROCURADOR</h2>
      <p className="text-xs text-gray-500 mb-3">
        Verifica se o contrato SERPRO da Consultri permite outorga programatica (modo automatico hibrido).
      </p>
      <div className="flex gap-2 items-center">
        <button
          onClick={check}
          disabled={state.loading}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {state.loading ? 'Verificando…' : 'Testar capability'}
        </button>
        {state.supported === true && (
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold">
            ✓ DISPONIVEL — auto-grant pode ser usado
          </span>
        )}
        {state.supported === false && (
          <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold">
            ✗ INDISPONIVEL — {state.reason || 'verifique contrato SERPRO'}
          </span>
        )}
        {state.error && <span className="text-xs text-red-400">{state.error}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Se disponivel, a Renovacao Preventiva tenta auto-grant antes de cair pro convite manual.
        Sem essa capability, o sistema opera no modo guiado (universalmente compativel).
      </p>
    </div>
  );
}

function JobButton({
  label, sub, onClick, busy,
}: { label: string; sub: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full text-left p-3 rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 disabled:opacity-50 transition"
    >
      <p className="font-semibold text-sm">{busy ? 'Executando…' : label}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </button>
  );
}
