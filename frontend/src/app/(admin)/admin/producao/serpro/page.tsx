'use client';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface Connection {
  id: string;
  cnpj: string;
  companyName: string;
  consumerKey: string;
  status: string;
  environment: string;
  procuracaoOk: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  _count: { logs: number };
}

interface ServiceItem {
  name: string;
  key: string;
  description: string;
  tipo: string;
  status: string;
}

interface LogEntry {
  id: string;
  service: string;
  endpoint: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
}

export default function SerproPage() {
  const [view, setView] = useState<'list' | 'new' | 'detail' | 'execute'>('list');
  const [selected, setSelected] = useState<Connection | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [selectedService, setSelectedService] = useState('');
  const [execCnpj, setExecCnpj] = useState('');
  const [execDados, setExecDados] = useState('{}');

  const [form, setForm] = useState({
    cnpj: '', companyName: '', consumerKey: '', consumerSecret: '',
    certBase64: '', certPassword: '', environment: 'trial',
  });

  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';

  const { data: connections = [], isLoading } = useSWR<Connection[]>(
    '/api/serpro/connections',
    authedFetcher,
    SWR_OPTIONS_FAST,
  );

  const { data: services = [] } = useSWR<ServiceItem[]>(
    '/api/serpro/services',
    authedFetcher,
    SWR_OPTIONS_FAST,
  );

  const { data: logs = [] } = useSWR<LogEntry[]>(
    selected ? `/api/serpro/connections/${selected.id}/logs` : null,
    authedFetcher,
    SWR_OPTIONS_FAST,
  );

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const handleCreate = async () => {
    if (!form.cnpj || !form.companyName || !form.consumerKey || !form.consumerSecret) {
      alert('Preencha todos os campos obrigatorios');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/serpro/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        mutate('/api/serpro/connections');
        setView('list');
        setForm({ cnpj: '', companyName: '', consumerKey: '', consumerSecret: '', certBase64: '', certPassword: '', environment: 'trial' });
      } else {
        alert(data.error || 'Erro ao criar');
      }
    } catch { alert('Erro de conexao'); }
  };

  const handleTest = async (conn: Connection) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiBase}/api/serpro/connections/${conn.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult(data);
      mutate('/api/serpro/connections');
    } catch { setTestResult({ success: false, error: 'Erro de conexao' }); }
    setTesting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta conexao?')) return;
    await fetch(`${apiBase}/api/serpro/connections/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    mutate('/api/serpro/connections');
    if (selected?.id === id) { setSelected(null); setView('list'); }
  };

  const handleExecute = async () => {
    if (!selected || !selectedService) return;
    setExecuting(true);
    setExecResult(null);
    try {
      let dados = {};
      try { dados = JSON.parse(execDados); } catch { /* use empty */ }
      const res = await fetch(`${apiBase}/api/serpro/connections/${selected.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ service: selectedService, contribuinteCnpj: execCnpj || undefined, dados }),
      });
      const data = await res.json();
      setExecResult(data);
      mutate(`/api/serpro/connections/${selected.id}/logs`);
    } catch { setExecResult({ success: false, error: 'Erro de conexao' }); }
    setExecuting(false);
  };

  const handleQuickAction = async (action: string) => {
    if (!selected) return;
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await fetch(`${apiBase}/api/serpro/connections/${selected.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contribuinteCnpj: execCnpj || undefined }),
      });
      const data = await res.json();
      setExecResult(data);
      mutate(`/api/serpro/connections/${selected.id}/logs`);
    } catch { setExecResult({ success: false, error: 'Erro de conexao' }); }
    setExecuting(false);
  };

  const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-yellow-100 text-yellow-700',
      error: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[s] || colors.pending}`}>{s.toUpperCase()}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SERPRO / Integra Contador</h1>
          <p className="text-gray-500 text-sm mt-1">Conexao direta com e-CAC via API oficial SERPRO — consulta pagamentos, DCTFWeb, situacao fiscal, caixa postal</p>
        </div>
        <button onClick={() => setView('new')} className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700">
          + Nova Conexao
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 mb-6">
        <div className="grid md:grid-cols-4 gap-4 text-center">
          <div className="bg-white/60 rounded-xl p-3 border border-amber-100">
            <p className="text-2xl font-bold text-amber-700">{connections.length}</p>
            <p className="text-[10px] text-gray-500">Conexoes</p>
          </div>
          <div className="bg-white/60 rounded-xl p-3 border border-amber-100">
            <p className="text-2xl font-bold text-emerald-600">{connections.filter(c => c.status === 'active').length}</p>
            <p className="text-[10px] text-gray-500">Ativas</p>
          </div>
          <div className="bg-white/60 rounded-xl p-3 border border-amber-100">
            <p className="text-2xl font-bold text-blue-600">{services.length}</p>
            <p className="text-[10px] text-gray-500">Servicos Disponiveis</p>
          </div>
          <div className="bg-white/60 rounded-xl p-3 border border-amber-100">
            <p className="text-2xl font-bold text-purple-600">{connections.filter(c => c.procuracaoOk).length}</p>
            <p className="text-[10px] text-gray-500">Procuracoes OK</p>
          </div>
        </div>
      </div>

      {/* NEW CONNECTION */}
      {view === 'new' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Conexao SERPRO</h2>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4 text-xs text-blue-800">
            <p className="font-bold mb-1">Como obter credenciais:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Contrate o produto Integra Contador em <a href="https://cliente.serpro.gov.br" target="_blank" className="underline">cliente.serpro.gov.br</a></li>
              <li>Obtenha Consumer Key e Consumer Secret na Area do Cliente</li>
              <li>Para ambiente TRIAL (gratuito), use credenciais de teste</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CNPJ do Contratante *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome da Empresa *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Empresa XYZ Ltda" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Consumer Key *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" value={form.consumerKey} onChange={e => setForm(f => ({ ...f, consumerKey: e.target.value }))} placeholder="djaR21PGoYp1iyK2n2ACOH9REdUb" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Consumer Secret *</label>
              <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" value={form.consumerSecret} onChange={e => setForm(f => ({ ...f, consumerSecret: e.target.value }))} placeholder="ObRsAJWOL4fv2Tp27D1vd8fB3Ote" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ambiente</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
                <option value="trial">Trial (Demonstracao — gratuito)</option>
                <option value="production">Producao (contrato ativo)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Senha do Certificado (producao)</label>
              <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.certPassword} onChange={e => setForm(f => ({ ...f, certPassword: e.target.value }))} placeholder="Somente para producao" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleCreate} className="px-6 py-2.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700">Criar Conexao</button>
            <button onClick={() => setView('list')} className="px-6 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {/* CONNECTIONS LIST */}
      {view === 'list' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Carregando...</div>
          ) : connections.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-500 mb-3">Nenhuma conexao SERPRO configurada</p>
              <button onClick={() => setView('new')} className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700">Criar primeira conexao</button>
            </div>
          ) : connections.map(conn => (
            <div key={conn.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${conn.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                    {conn.environment === 'trial' ? 'T' : 'P'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{conn.companyName}</p>
                    <p className="text-xs text-gray-400">CNPJ: {conn.cnpj} — Key: {conn.consumerKey}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(conn.status)}
                  {conn.procuracaoOk && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">PROCURACAO OK</span>}
                  <span className="text-[10px] text-gray-400">{conn._count.logs} chamadas</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setSelected(conn); setView('detail'); setTestResult(null); setExecResult(null); }} className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-200">Abrir</button>
                <button onClick={() => handleTest(conn)} disabled={testing} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 disabled:opacity-50">{testing ? '...' : 'Testar'}</button>
                <button onClick={() => { setSelected(conn); setView('execute'); setExecResult(null); }} className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-200">Executar Servico</button>
                <button onClick={() => handleDelete(conn.id)} className="px-3 py-1.5 bg-red-50 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-100 ml-auto">Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && selected && (
        <div className="space-y-6">
          <button onClick={() => setView('list')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.companyName}</h2>
                <p className="text-sm text-gray-500">CNPJ: {selected.cnpj} — Ambiente: {selected.environment.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(selected.status)}
                {selected.procuracaoOk && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">PROCURACAO OK</span>}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">CNPJ do Contribuinte (deixe vazio para usar o contratante)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" value={execCnpj} onChange={e => setExecCnpj(e.target.value)} placeholder="CNPJ do cliente (opcional)" />
            </div>

            <p className="text-sm font-semibold text-gray-700 mb-3">Acoes Rapidas:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Pagamentos / DARFs', action: 'pagamentos', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'DCTFWeb', action: 'dctfweb', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: 'Situacao Fiscal', action: 'situacao-fiscal', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                { label: 'Caixa Postal', action: 'caixa-postal', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                { label: 'e-Processo', action: 'processos', color: 'bg-orange-50 text-orange-700 border-orange-200' },
              ].map(a => (
                <button
                  key={a.action}
                  onClick={() => handleQuickAction(a.action)}
                  disabled={executing || selected.status !== 'active'}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all hover:shadow-md disabled:opacity-50 ${a.color}`}
                >
                  {executing ? '...' : a.label}
                </button>
              ))}
              <button onClick={() => handleTest(selected)} disabled={testing} className="p-3 rounded-xl border bg-yellow-50 text-yellow-700 border-yellow-200 text-sm font-semibold hover:shadow-md disabled:opacity-50">
                {testing ? '...' : 'Re-testar Conexao'}
              </button>
            </div>

            {/* Test/Exec Result */}
            {(testResult || execResult) && (
              <div className={`rounded-xl p-4 border mb-4 ${(testResult?.success || execResult?.success) ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm font-bold mb-2 ${(testResult?.success || execResult?.success) ? 'text-emerald-800' : 'text-red-800'}`}>
                  {(testResult?.success || execResult?.success) ? 'Sucesso' : 'Erro'}
                  {execResult?.durationMs ? ` (${execResult.durationMs}ms)` : ''}
                </p>
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-700">
                  {JSON.stringify(testResult || execResult, null, 2)}
                </pre>
              </div>
            )}

            {selected.lastError && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200 mb-4">
                <p className="text-xs text-red-700"><strong>Ultimo erro:</strong> {selected.lastError}</p>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm">Historico de Chamadas ({logs.length})</h3>
            </div>
            {logs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Nenhuma chamada registrada</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="font-medium text-gray-900">{log.service}</span>
                      <span className="text-gray-400">{log.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {log.durationMs > 0 && <span className="text-gray-400">{log.durationMs}ms</span>}
                      {log.errorMessage && <span className="text-red-500 max-w-[200px] truncate">{log.errorMessage}</span>}
                      <span className="text-gray-400">{fmt(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXECUTE SERVICE VIEW */}
      {view === 'execute' && selected && (
        <div className="space-y-6">
          <button onClick={() => setView('list')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Executar Servico — {selected.companyName}</h2>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Servico SERPRO</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {services.map(s => (
                    <option key={s.key} value={s.key}>{s.name} — {s.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CNPJ do Contribuinte (opcional)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={execCnpj} onChange={e => setExecCnpj(e.target.value)} placeholder="Deixe vazio para usar CNPJ do contratante" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dados (JSON)</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono h-24" value={execDados} onChange={e => setExecDados(e.target.value)} placeholder='{ "periodo": "202401" }' />
              </div>
              <button onClick={handleExecute} disabled={!selectedService || executing} className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:bg-gray-300">
                {executing ? 'Executando...' : 'Executar'}
              </button>
            </div>
            {execResult && (
              <div className={`mt-4 rounded-xl p-4 border ${execResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm font-bold mb-2 ${execResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                  {execResult.success ? 'Sucesso' : 'Erro'} {execResult.durationMs ? `(${execResult.durationMs}ms)` : ''}
                </p>
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto text-gray-700 bg-white/50 rounded-lg p-3">
                  {JSON.stringify(execResult.data || execResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Services catalog */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm">Catalogo de Servicos SERPRO ({services.length})</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {services.map(s => (
                <div key={s.key} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedService(s.key)}>
                  <div>
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    <span className="text-gray-400 ml-2">{s.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{s.tipo}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
