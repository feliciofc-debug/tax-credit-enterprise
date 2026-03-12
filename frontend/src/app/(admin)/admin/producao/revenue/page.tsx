'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { authedFetcher } from '@/lib/fetcher';

const fmt = (v?: number | null) => v == null ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const fonteLabels: Record<string, { label: string; color: string; bg: string }> = {
  compliance_rt: { label: 'Compliance RT', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  simples_recovery: { label: 'Simples Recovery', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  recuperacao_5anos: { label: 'Recuperação 5 Anos', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  manual: { label: 'Manual', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

interface DashData {
  totals: {
    allTime: { creditos: number; comissao: number; events: number };
    today: { creditos: number; comissao: number; events: number };
    week: { creditos: number; comissao: number; events: number };
    month: { creditos: number; comissao: number; events: number };
  };
  byFonte: Array<{ fonte: string; _sum: { valorCredito: number; comissaoValor: number }; _count: number }>;
  byTributo: Array<{ tributo: string; _sum: { valorCredito: number; comissaoValor: number }; _count: number }>;
  recentEvents: Array<{ id: string; cnpj: string; companyName: string; eventType: string; fonte: string; tributo: string; valorCredito: number; comissaoPerc: number; comissaoValor: number; descricao: string; createdAt: string }>;
  config: { comissaoPadraoPerc: number; faturamentoGlobal: number; metaMensal: number; metaAnual: number };
}

export default function RevenuePage() {
  const { data: resp } = useSWR<{ success: boolean; data: DashData }>('/api/revenue/dashboard', authedFetcher, { refreshInterval: 5000, revalidateOnFocus: true });
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ faturamentoGlobal: '', comissaoPadraoPerc: '', metaMensal: '', metaAnual: '' });
  const [saving, setSaving] = useState(false);

  const dash = resp?.data;
  const config = dash?.config;

  const saveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = {};
      if (configForm.faturamentoGlobal) body.faturamentoGlobal = parseFloat(configForm.faturamentoGlobal);
      if (configForm.comissaoPadraoPerc) body.comissaoPadraoPerc = parseFloat(configForm.comissaoPadraoPerc) / 100;
      if (configForm.metaMensal) body.metaMensal = parseFloat(configForm.metaMensal);
      if (configForm.metaAnual) body.metaAnual = parseFloat(configForm.metaAnual);
      await fetch('/api/revenue/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      mutate('/api/revenue/dashboard');
      setEditingConfig(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue Tracker</h1>
            <p className="text-gray-500 text-sm">Faturamento Atom em tempo real — atualiza a cada 5 segundos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Ao vivo</span>
        </div>
      </div>

      {/* Faturamento Global Atom */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">Faturamento Global — Atom Brasil Digital</p>
            <p className="text-4xl font-black mt-1">{fmt(config?.faturamentoGlobal || 0)}</p>
          </div>
          <button onClick={() => { setEditingConfig(!editingConfig); setConfigForm({ faturamentoGlobal: String(config?.faturamentoGlobal || 0), comissaoPadraoPerc: String((config?.comissaoPadraoPerc || 0.175) * 100), metaMensal: String(config?.metaMensal || 0), metaAnual: String(config?.metaAnual || 0) }); }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
            Configurar
          </button>
        </div>
        {editingConfig && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 mb-6">
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400">Faturamento Global (R$)</label>
                <input type="number" value={configForm.faturamentoGlobal} onChange={e => setConfigForm({ ...configForm, faturamentoGlobal: e.target.value })} className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Comissão Padrão (%)</label>
                <input type="number" value={configForm.comissaoPadraoPerc} onChange={e => setConfigForm({ ...configForm, comissaoPadraoPerc: e.target.value })} className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Meta Mensal (R$)</label>
                <input type="number" value={configForm.metaMensal} onChange={e => setConfigForm({ ...configForm, metaMensal: e.target.value })} className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Meta Anual (R$)</label>
                <input type="number" value={configForm.metaAnual} onChange={e => setConfigForm({ ...configForm, metaAnual: e.target.value })} className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
              </div>
            </div>
            <button onClick={saveConfig} disabled={saving} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        )}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-gray-400 text-xs">Hoje</p>
            <p className="text-xl font-bold mt-1">{fmt(dash?.totals.today.comissao)}</p>
            <p className="text-green-400 text-xs mt-1">{dash?.totals.today.events || 0} eventos</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-gray-400 text-xs">Esta Semana</p>
            <p className="text-xl font-bold mt-1">{fmt(dash?.totals.week.comissao)}</p>
            <p className="text-green-400 text-xs mt-1">{dash?.totals.week.events || 0} eventos</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-gray-400 text-xs">Este Mês</p>
            <p className="text-xl font-bold mt-1">{fmt(dash?.totals.month.comissao)}</p>
            <p className="text-green-400 text-xs mt-1">{dash?.totals.month.events || 0} eventos</p>
          </div>
          <div className="bg-green-500/20 rounded-xl p-4 border border-green-500/30">
            <p className="text-green-300 text-xs">Total Acumulado</p>
            <p className="text-2xl font-black mt-1">{fmt(dash?.totals.allTime.comissao)}</p>
            <p className="text-green-400 text-xs mt-1">{fmt(dash?.totals.allTime.creditos)} em créditos</p>
          </div>
        </div>
        {config?.metaMensal ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Meta mensal: {fmt(config.metaMensal)}</span>
              <span>{Math.min(100, Math.round(((dash?.totals.month.comissao || 0) / config.metaMensal) * 100))}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, ((dash?.totals.month.comissao || 0) / config.metaMensal) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Stats by Source */}
      {dash?.byFonte && dash.byFonte.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {dash.byFonte.map((f, i) => {
            const cfg = fonteLabels[f.fonte] || fonteLabels.manual;
            return (
              <div key={i} className={`border rounded-xl p-5 ${cfg.bg}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{fmt(f._sum.comissaoValor)}</p>
                <p className="text-xs text-gray-500 mt-1">{f._count} evento(s) | {fmt(f._sum.valorCredito)} em créditos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Feed */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Feed de Receita</h2>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-gray-400">Atualiza automaticamente</p>
        </div>

        {!dash?.recentEvents?.length ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum evento ainda</h3>
            <p className="text-gray-500 text-sm">Quando as integrações processarem dados e encontrarem créditos, os eventos aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dash.recentEvents.map(ev => {
              const cfg = fonteLabels[ev.fonte] || fonteLabels.manual;
              return (
                <div key={ev.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-400 font-mono w-14 shrink-0">
                        {new Date(ev.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{ev.tributo}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.companyName}</p>
                        {ev.descricao && <p className="text-xs text-gray-400 truncate">{ev.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700">{fmt(ev.valorCredito)}</p>
                        <p className="text-[10px] text-gray-400">crédito</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-green-600">{fmt(ev.comissaoValor)}</p>
                        <p className="text-[10px] text-green-500">{pct(ev.comissaoPerc)} comissão</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
