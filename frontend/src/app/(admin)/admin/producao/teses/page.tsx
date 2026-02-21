'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { authedFetcher, getApiUrl, getToken, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface TaxThesis {
  id: string;
  code: string;
  name: string;
  description: string;
  tributo: string;
  fundamentacao: string;
  tribunal: string | null;
  tema: string | null;
  status: string;
  risco: string;
  probabilidade: number;
  setoresAplicaveis: string | null;
  regimesAplicaveis: string | null;
  formulaCalculo: string | null;
  fonte: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ThesisUpdate {
  id: string;
  type: string;
  title: string;
  description: string;
  source: string | null;
  tribunal: string | null;
  relevance: string;
  thesisCode: string | null;
  reviewed: boolean;
  approved: boolean | null;
  createdAt: string;
}

const TRIBUTOS = ['PIS', 'COFINS', 'PIS/COFINS', 'ICMS', 'ICMS/PIS/COFINS', 'INSS', 'FGTS', 'IRPJ', 'IRPJ/CSLL', 'CSLL', 'IPI', 'ISS'];
const SETORES = ['todos', 'saude', 'industria', 'comercio', 'varejo', 'tecnologia', 'servicos', 'agro', 'exportacao', 'mineracao', 'construcao', 'ecommerce', 'transporte', 'farmacia'];
const REGIMES = ['lucro_real', 'lucro_presumido', 'simples'];
const RISCOS = ['baixo', 'medio', 'alto'];
const STATUS_OPTIONS = ['active', 'pending', 'deprecated'];
const TRIBUNAIS = ['STF', 'STJ', 'CARF', 'TRF', 'RFB', 'SEFAZ'];

const RISCO_COLORS: Record<string, string> = {
  baixo: 'bg-green-100 text-green-800',
  medio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-red-100 text-red-800',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  deprecated: 'bg-gray-100 text-gray-500',
};
const RELEVANCE_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800',
};

function parseSafeJSON(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function TesesPage() {
  const [tab, setTab] = useState<'list' | 'updates'>('list');
  const [filterTributo, setFilterTributo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTribunal, setFilterTribunal] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editThesis, setEditThesis] = useState<TaxThesis | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const queryParts: string[] = [];
  if (filterTributo) queryParts.push(`tributo=${filterTributo}`);
  if (filterStatus) queryParts.push(`status=${filterStatus}`);
  if (filterTribunal) queryParts.push(`tribunal=${filterTribunal}`);
  const queryStr = queryParts.length ? `?${queryParts.join('&')}` : '';

  const { data: theses, mutate: mutateTheses } = useSWR<TaxThesis[]>(
    `/api/thesis/list${queryStr}`,
    authedFetcher,
    SWR_OPTIONS_FAST,
  );
  const { data: stats } = useSWR('/api/thesis/stats', authedFetcher, SWR_OPTIONS_FAST);
  const { data: updates, mutate: mutateUpdates } = useSWR<ThesisUpdate[]>(
    tab === 'updates' ? '/api/thesis/updates?reviewed=false' : null,
    authedFetcher,
    SWR_OPTIONS_FAST,
  );

  const apiCall = useCallback(async (path: string, method: string, body?: any) => {
    const base = getApiUrl();
    const token = getToken();
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }, []);

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editThesis) {
        await apiCall(`/api/thesis/update/${editThesis.id}`, 'PUT', formData);
      } else {
        await apiCall('/api/thesis/create', 'POST', formData);
      }
      mutateTheses();
      setShowForm(false);
      setEditThesis(null);
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeprecate = async (id: string) => {
    if (!confirm('Deseja deprecar esta tese? Ela não será excluída, apenas desativada.')) return;
    await apiCall(`/api/thesis/${id}`, 'DELETE');
    mutateTheses();
  };

  const handleAiUpdate = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await apiCall('/api/thesis/ai-update', 'POST');
      if (result.success) {
        setAiResult(`${result.data.total} novidades encontradas: ${result.data.summary}`);
        mutateUpdates();
      } else {
        setAiResult(`Erro: ${result.error}`);
      }
    } catch (e: any) {
      setAiResult(`Erro: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleReview = async (id: string, approved: boolean) => {
    await apiCall(`/api/thesis/updates/${id}/review`, 'PUT', { approved });
    mutateUpdates();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teses Tributárias</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as teses usadas nas análises da plataforma</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAiUpdate}
            disabled={aiLoading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {aiLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            )}
            {aiLoading ? 'Buscando...' : 'Atualizar via IA'}
          </button>
          <button
            onClick={() => { setEditThesis(null); setShowForm(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nova Tese
          </button>
        </div>
      </div>

      {aiResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
          <p className="font-medium">Resultado da busca IA:</p>
          <p>{aiResult}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} color="blue" />
          <StatCard label="Ativas" value={stats.active} color="green" />
          <StatCard label="Pendentes" value={stats.pending} color="yellow" />
          <StatCard label="Deprecadas" value={stats.deprecated} color="gray" />
          <StatCard
            label="Atualizações"
            value={stats.pendingUpdates}
            color={stats.pendingUpdates > 0 ? 'red' : 'gray'}
            onClick={() => setTab('updates')}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-4">
        <button
          onClick={() => setTab('list')}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Teses ({theses?.length || 0})
        </button>
        <button
          onClick={() => setTab('updates')}
          className={`pb-2 text-sm font-medium border-b-2 relative ${tab === 'updates' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Feed de Atualizações
          {stats?.pendingUpdates > 0 && (
            <span className="absolute -top-1 -right-4 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
              {stats.pendingUpdates}
            </span>
          )}
        </button>
      </div>

      {/* Thesis Form Modal */}
      {showForm && (
        <ThesisForm
          thesis={editThesis}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditThesis(null); }}
          saving={saving}
        />
      )}

      {/* Tab content */}
      {tab === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select value={filterTributo} onChange={e => setFilterTributo(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
              <option value="">Todos tributos</option>
              {TRIBUTOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
              <option value="">Todos status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={filterTribunal} onChange={e => setFilterTribunal(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
              <option value="">Todos tribunais</option>
              {TRIBUNAIS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterTributo || filterStatus || filterTribunal) && (
              <button
                onClick={() => { setFilterTributo(''); setFilterStatus(''); setFilterTribunal(''); }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Thesis list */}
          {!theses ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
          ) : theses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhuma tese encontrada</div>
          ) : (
            <div className="space-y-2">
              {theses.map(thesis => (
                <div key={thesis.id} className={`border rounded-lg overflow-hidden ${!thesis.ativo ? 'opacity-60' : ''}`}>
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === thesis.id ? null : thesis.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">{thesis.code}</span>
                      <span className="font-medium text-sm text-gray-900 truncate">{thesis.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[thesis.status] || 'bg-gray-100 text-gray-500'}`}>{thesis.status}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${RISCO_COLORS[thesis.risco] || ''}`}>Risco: {thesis.risco}</span>
                      <span className="text-xs text-gray-500">{thesis.probabilidade}%</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{thesis.tributo}</span>
                      {thesis.tribunal && <span className="text-xs text-gray-400">{thesis.tribunal}{thesis.tema ? ` — ${thesis.tema}` : ''}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditThesis(thesis); setShowForm(true); }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Editar"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      {thesis.ativo && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeprecate(thesis.id); }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Deprecar"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        </button>
                      )}
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === thesis.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>

                  {expandedId === thesis.id && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Descrição</p>
                          <p className="text-gray-600 whitespace-pre-wrap">{thesis.description}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Fundamentação</p>
                          <p className="text-gray-600 whitespace-pre-wrap">{thesis.fundamentacao}</p>
                        </div>
                        {thesis.formulaCalculo && (
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Fórmula de Cálculo</p>
                            <p className="text-gray-600">{thesis.formulaCalculo}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Aplicabilidade</p>
                          <p className="text-gray-600">
                            Setores: {parseSafeJSON(thesis.setoresAplicaveis).join(', ') || 'Todos'}<br/>
                            Regimes: {parseSafeJSON(thesis.regimesAplicaveis).join(', ') || 'Todos'}
                          </p>
                        </div>
                        {thesis.fonte && (
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Fonte</p>
                            <a href={thesis.fonte} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{thesis.fonte}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'updates' && (
        <div className="space-y-3">
          {!updates ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
          ) : updates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Nenhuma atualização pendente</p>
              <p className="text-sm mt-1">Clique em "Atualizar via IA" para buscar novidades</p>
            </div>
          ) : (
            updates.map(u => (
              <div key={u.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RELEVANCE_COLORS[u.relevance] || ''}`}>{u.relevance}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{u.type}</span>
                      {u.tribunal && <span className="text-[10px] text-gray-500">{u.tribunal}</span>}
                      {u.thesisCode && <span className="text-[10px] font-mono text-blue-600">{u.thesisCode}</span>}
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm">{u.title}</h3>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{u.description}</p>
                    {u.source && <p className="text-xs text-gray-400 mt-1">Fonte: {u.source}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(u.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleReview(u.id, true)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleReview(u.id, false)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div
      className={`border rounded-lg p-3 text-center ${colors[color] || colors.gray} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function ThesisForm({
  thesis,
  onSave,
  onCancel,
  saving,
}: {
  thesis: TaxThesis | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    code: thesis?.code || '',
    name: thesis?.name || '',
    description: thesis?.description || '',
    tributo: thesis?.tributo || '',
    fundamentacao: thesis?.fundamentacao || '',
    tribunal: thesis?.tribunal || '',
    tema: thesis?.tema || '',
    status: thesis?.status || 'active',
    risco: thesis?.risco || 'medio',
    probabilidade: thesis?.probabilidade?.toString() || '70',
    setoresAplicaveis: parseSafeJSON(thesis?.setoresAplicaveis),
    regimesAplicaveis: parseSafeJSON(thesis?.regimesAplicaveis),
    formulaCalculo: thesis?.formulaCalculo || '',
    fonte: thesis?.fonte || '',
    dataDecisao: thesis ? '' : '',
  });

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      probabilidade: parseInt(form.probabilidade) || 70,
      setoresAplicaveis: JSON.stringify(form.setoresAplicaveis),
      regimesAplicaveis: JSON.stringify(form.regimesAplicaveis),
      dataDecisao: form.dataDecisao || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-lg font-bold text-gray-900">{thesis ? `Editar ${thesis.code}` : 'Nova Tese Tributária'}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder="TESE-038"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
              disabled={!!thesis}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tributo *</label>
            <select
              value={form.tributo}
              onChange={e => setForm({ ...form, tributo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            >
              <option value="">Selecione...</option>
              {TRIBUTOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Tese *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Descrição *</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fundamentação Legal *</label>
          <textarea
            value={form.fundamentacao}
            onChange={e => setForm({ ...form, fundamentacao: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={2}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tribunal</label>
            <select value={form.tribunal} onChange={e => setForm({ ...form, tribunal: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Nenhum</option>
              {TRIBUNAIS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tema</label>
            <input type="text" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} placeholder="Tema 69 STF" className="w-full px-3 py-2 border rounded-lg text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Risco</label>
            <select value={form.risco} onChange={e => setForm({ ...form, risco: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {RISCOS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Probabilidade (%)</label>
            <input type="number" min="0" max="100" value={form.probabilidade} onChange={e => setForm({ ...form, probabilidade: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data da Decisão</label>
            <input type="date" value={form.dataDecisao} onChange={e => setForm({ ...form, dataDecisao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"/>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fórmula de Cálculo</label>
          <input type="text" value={form.formulaCalculo} onChange={e => setForm({ ...form, formulaCalculo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"/>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fonte (URL)</label>
          <input type="url" value={form.fonte} onChange={e => setForm({ ...form, fonte: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg text-sm"/>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Setores Aplicáveis</label>
          <div className="flex flex-wrap gap-2">
            {SETORES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, setoresAplicaveis: toggleArray(form.setoresAplicaveis, s) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${form.setoresAplicaveis.includes(s) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Regimes Aplicáveis</label>
          <div className="flex flex-wrap gap-2">
            {REGIMES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, regimesAplicaveis: toggleArray(form.regimesAplicaveis, r) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${form.regimesAplicaveis.includes(r) ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {r === 'lucro_real' ? 'Lucro Real' : r === 'lucro_presumido' ? 'Lucro Presumido' : 'Simples'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : thesis ? 'Salvar Alterações' : 'Criar Tese'}
          </button>
        </div>
      </form>
    </div>
  );
}
