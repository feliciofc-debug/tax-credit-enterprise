'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { authedFetcher, getApiUrl, getToken, SWR_OPTIONS_FAST } from '@/lib/fetcher';

interface TeseJurisprudencia {
  id: string;
  teseCodigo: string;
  temaVinculante: string | null;
  tribunal: string | null;
  dataJulgamento: string | null;
  resultado: string;
  probabilidadeMaxima: number | null;
  modulacao: string | null;
  notas: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClassifyResult {
  tesesAfetadas: string[];
  resultado: 'FAVORAVEL' | 'DESFAVORAVEL' | 'PARCIAL' | 'NEUTRO';
  impactoProbabilidade: number;
  resumo: string;
  modulacao?: string;
  acaoRecomendada: 'BLOQUEAR' | 'ALERTAR' | 'ATUALIZAR' | 'MONITORAR';
}

const RESULTADO_COLORS: Record<string, string> = {
  FAVORAVEL: 'bg-green-100 text-green-800',
  DESFAVORAVEL: 'bg-red-100 text-red-800',
  PARCIAL: 'bg-yellow-100 text-yellow-800',
  NEUTRO: 'bg-gray-100 text-gray-600',
};
const ACAO_COLORS: Record<string, string> = {
  BLOQUEAR: 'bg-red-100 text-red-800',
  ALERTAR: 'bg-orange-100 text-orange-800',
  ATUALIZAR: 'bg-blue-100 text-blue-800',
  MONITORAR: 'bg-gray-100 text-gray-700',
};

export default function JurisprudenciaPage() {
  const [tab, setTab] = useState<'list' | 'classify'>('list');
  const [filterTese, setFilterTese] = useState('');
  const [filterAtivo, setFilterAtivo] = useState<string>('');
  const [classifyTexto, setClassifyTexto] = useState('');
  const [classifyTipoFonte, setClassifyTipoFonte] = useState('acórdão');
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFromResult, setCreateFromResult] = useState<ClassifyResult | null>(null);
  const [editItem, setEditItem] = useState<TeseJurisprudencia | null>(null);
  const [saving, setSaving] = useState(false);

  const queryParts: string[] = [];
  if (filterTese) queryParts.push(`teseCodigo=${filterTese}`);
  if (filterAtivo !== '') queryParts.push(`ativo=${filterAtivo}`);
  const queryStr = queryParts.length ? `?${queryParts.join('&')}` : '';

  const { data: listData, mutate: mutateItems } = useSWR<TeseJurisprudencia[]>(
    `/api/jurisprudencia/list${queryStr}`,
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

  const [varreduraLoading, setVarreduraLoading] = useState(false);
  const [varreduraResult, setVarreduraResult] = useState<string | null>(null);

  const handleVarredura = async () => {
    setVarreduraLoading(true);
    setVarreduraResult(null);
    try {
      const result = await apiCall('/api/jurisprudencia/trigger-varredura', 'POST');
      if (result.success) {
        setVarreduraResult(`${result.data.total} itens encontrados. ${result.data.summary}`);
      } else {
        setVarreduraResult(`Erro: ${result.error}`);
      }
    } catch (e: any) {
      setVarreduraResult(`Erro: ${e.message}`);
    } finally {
      setVarreduraLoading(false);
    }
  };

  const handleClassify = async () => {
    if (!classifyTexto.trim() || classifyTexto.length < 50) {
      alert('Digite ou cole o texto do acórdão/decisão (mínimo 50 caracteres)');
      return;
    }
    setClassifyLoading(true);
    setClassifyResult(null);
    try {
      const result = await apiCall('/api/jurisprudencia/classify', 'POST', {
        texto: classifyTexto,
        tipoFonte: classifyTipoFonte,
      });
      if (result.success) {
        setClassifyResult(result.data);
      } else {
        alert(result.error || 'Erro ao classificar');
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao classificar');
    } finally {
      setClassifyLoading(false);
    }
  };

  const handleCreateFromResult = (r: ClassifyResult) => {
    setCreateFromResult(r);
    setShowCreateForm(true);
  };

  const handleSaveCreate = async (formData: any) => {
    setSaving(true);
    try {
      const result = await apiCall('/api/jurisprudencia/create', 'POST', formData);
      if (result.success) {
        mutateItems();
        setShowCreateForm(false);
        setCreateFromResult(null);
      } else {
        alert(result.error || 'Erro ao criar');
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, formData: any) => {
    setSaving(true);
    try {
      const result = await apiCall(`/api/jurisprudencia/update/${id}`, 'PUT', formData);
      if (result.success) {
        mutateItems();
        setEditItem(null);
      } else {
        alert(result.error || 'Erro ao atualizar');
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este item de jurisprudência?')) return;
    const result = await apiCall(`/api/jurisprudencia/${id}`, 'DELETE');
    if (result.success) mutateItems();
    else alert(result.error || 'Erro ao excluir');
  };

  const list = listData ?? [];
  const total = list.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jurisprudência Vinculante</h1>
          <p className="text-sm text-gray-500 mt-1">Classifique acórdãos e gerencie overrides de probabilidade por tese</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleVarredura}
            disabled={varreduraLoading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {varreduraLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Varrendo...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Varredura automática
              </>
            )}
          </button>
          <button
            onClick={() => { setTab('classify'); setClassifyResult(null); setClassifyTexto(''); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Classificar com IA
          </button>
        </div>
      </div>

      {varreduraResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
          {varreduraResult}
          <p className="text-xs mt-1 text-purple-600">Itens criados em Feed de Atualizações (Teses). Revise em Teses → Feed de Atualizações.</p>
        </div>
      )}

      <div className="border-b border-gray-200 flex gap-4">
        <button
          onClick={() => setTab('list')}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Lista ({total})
        </button>
        <button
          onClick={() => setTab('classify')}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === 'classify' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Classificar texto
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={filterTese}
              onChange={e => setFilterTese(e.target.value)}
              placeholder="Filtrar por código da tese (ex: 3.2)"
              className="px-3 py-1.5 text-sm border rounded-lg bg-white w-48"
            />
            <select value={filterAtivo} onChange={e => setFilterAtivo(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-white">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
            {(filterTese || filterAtivo) && (
              <button onClick={() => { setFilterTese(''); setFilterAtivo(''); }} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 underline">Limpar</button>
            )}
          </div>

          {!items ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>Nenhum item de jurisprudência cadastrado</p>
              <p className="text-sm mt-1">Use &quot;Classificar com IA&quot; para analisar um acórdão e criar um override</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(item => (
                <div key={item.id} className={`border rounded-lg p-4 flex items-center justify-between ${!item.ativo ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.teseCodigo}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RESULTADO_COLORS[item.resultado] || 'bg-gray-100 text-gray-600'}`}>{item.resultado}</span>
                    {item.tribunal && <span className="text-xs text-gray-500">{item.tribunal}</span>}
                    {item.temaVinculante && <span className="text-xs text-gray-500">{item.temaVinculante}</span>}
                    {item.probabilidadeMaxima != null && <span className="text-xs text-gray-600">Prob. máx: {item.probabilidadeMaxima}%</span>}
                    {item.dataJulgamento && <span className="text-xs text-gray-400">{new Date(item.dataJulgamento).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditItem(item)} className="p-1 text-gray-400 hover:text-indigo-600" title="Editar">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600" title="Excluir">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'classify' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de documento</label>
            <select value={classifyTipoFonte} onChange={e => setClassifyTipoFonte(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-full max-w-xs">
              <option value="acórdão">Acórdão</option>
              <option value="decisão">Decisão</option>
              <option value="norma">Norma / Instrução</option>
              <option value="documento jurídico">Documento jurídico</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cole o texto do acórdão, decisão ou norma (mín. 50 caracteres)</label>
            <textarea
              value={classifyTexto}
              onChange={e => setClassifyTexto(e.target.value)}
              placeholder="Ex: Ementa do acórdão ou trecho da decisão..."
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              rows={10}
            />
          </div>
          <button
            onClick={handleClassify}
            disabled={classifyLoading || classifyTexto.length < 50}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {classifyLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Classificando...
              </>
            ) : (
              'Classificar'
            )}
          </button>

          {classifyResult && (
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <h3 className="font-medium text-gray-900">Resultado da classificação</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${RESULTADO_COLORS[classifyResult.resultado]}`}>{classifyResult.resultado}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACAO_COLORS[classifyResult.acaoRecomendada]}`}>{classifyResult.acaoRecomendada}</span>
                <span className="text-xs text-gray-600">Impacto: {classifyResult.impactoProbabilidade > 0 ? '+' : ''}{classifyResult.impactoProbabilidade}</span>
              </div>
              <p className="text-sm text-gray-700">{classifyResult.resumo}</p>
              {classifyResult.tesesAfetadas.length > 0 && (
                <p className="text-xs text-gray-600">Teses afetadas: {classifyResult.tesesAfetadas.join(', ')}</p>
              )}
              {classifyResult.modulacao && <p className="text-xs text-gray-500">Modulação: {classifyResult.modulacao}</p>}
              <button
                onClick={() => handleCreateFromResult(classifyResult)}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Criar override a partir deste resultado
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: criar a partir do resultado */}
      {showCreateForm && createFromResult && (
        <CreateFormModal
          result={createFromResult}
          onSave={handleSaveCreate}
          onCancel={() => { setShowCreateForm(false); setCreateFromResult(null); }}
          saving={saving}
        />
      )}

      {/* Modal: editar */}
      {editItem && (
        <EditFormModal
          item={editItem}
          onSave={(data) => handleUpdate(editItem.id, data)}
          onCancel={() => setEditItem(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function CreateFormModal({
  result,
  onSave,
  onCancel,
  saving,
}: {
  result: ClassifyResult;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    teseCodigo: result.tesesAfetadas[0] || '',
    temaVinculante: '',
    tribunal: '',
    dataJulgamento: '',
    resultado: result.resultado,
    probabilidadeMaxima: result.impactoProbabilidade < 0 ? String(Math.max(0, 70 + result.impactoProbabilidade)) : '',
    modulacao: result.modulacao || '',
    notas: result.resumo || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      probabilidadeMaxima: form.probabilidadeMaxima ? parseInt(form.probabilidadeMaxima) : null,
      dataJulgamento: form.dataJulgamento || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-8 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-lg font-bold text-gray-900">Criar override de jurisprudência</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código da tese *</label>
            <input type="text" value={form.teseCodigo} onChange={e => setForm({ ...form, teseCodigo: e.target.value })} placeholder="3.2" className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resultado *</label>
            <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="FAVORAVEL">FAVORAVEL</option>
              <option value="DESFAVORAVEL">DESFAVORAVEL</option>
              <option value="PARCIAL">PARCIAL</option>
              <option value="NEUTRO">NEUTRO</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tema vinculante</label>
            <input type="text" value={form.temaVinculante} onChange={e => setForm({ ...form, temaVinculante: e.target.value })} placeholder="Tema 1.079" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tribunal</label>
            <select value={form.tribunal} onChange={e => setForm({ ...form, tribunal: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">—</option>
              <option value="STF">STF</option>
              <option value="STJ">STJ</option>
              <option value="CARF">CARF</option>
              <option value="TRF">TRF</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data do julgamento</label>
            <input type="date" value={form.dataJulgamento} onChange={e => setForm({ ...form, dataJulgamento: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Probabilidade máxima (%)</label>
            <input type="number" min="0" max="100" value={form.probabilidadeMaxima} onChange={e => setForm({ ...form, probabilidadeMaxima: e.target.value })} placeholder="Ex: 10 para desfavorável" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Modulação</label>
          <textarea value={form.modulacao} onChange={e => setForm({ ...form, modulacao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
          <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditFormModal({
  item,
  onSave,
  onCancel,
  saving,
}: {
  item: TeseJurisprudencia;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    teseCodigo: item.teseCodigo,
    temaVinculante: item.temaVinculante || '',
    tribunal: item.tribunal || '',
    dataJulgamento: item.dataJulgamento ? item.dataJulgamento.slice(0, 10) : '',
    resultado: item.resultado,
    probabilidadeMaxima: item.probabilidadeMaxima?.toString() || '',
    modulacao: item.modulacao || '',
    notas: item.notas || '',
    ativo: item.ativo,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      probabilidadeMaxima: form.probabilidadeMaxima ? parseInt(form.probabilidadeMaxima) : null,
      dataJulgamento: form.dataJulgamento || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-8 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-lg font-bold text-gray-900">Editar jurisprudência</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código da tese *</label>
            <input type="text" value={form.teseCodigo} onChange={e => setForm({ ...form, teseCodigo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resultado *</label>
            <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="FAVORAVEL">FAVORAVEL</option>
              <option value="DESFAVORAVEL">DESFAVORAVEL</option>
              <option value="PARCIAL">PARCIAL</option>
              <option value="NEUTRO">NEUTRO</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tema vinculante</label>
            <input type="text" value={form.temaVinculante} onChange={e => setForm({ ...form, temaVinculante: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tribunal</label>
            <select value={form.tribunal} onChange={e => setForm({ ...form, tribunal: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">—</option>
              <option value="STF">STF</option>
              <option value="STJ">STJ</option>
              <option value="CARF">CARF</option>
              <option value="TRF">TRF</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data do julgamento</label>
            <input type="date" value={form.dataJulgamento} onChange={e => setForm({ ...form, dataJulgamento: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Probabilidade máxima (%)</label>
            <input type="number" min="0" max="100" value={form.probabilidadeMaxima} onChange={e => setForm({ ...form, probabilidadeMaxima: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
            <span className="text-sm">Ativo</span>
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Modulação</label>
          <textarea value={form.modulacao} onChange={e => setForm({ ...form, modulacao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
          <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
