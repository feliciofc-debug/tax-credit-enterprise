'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Procurador = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  presetKey: string | null;
  ativo: boolean;
  cor: string | null;
  observacao: string | null;
  _count?: { procurations: number };
};

export default function ProcuradoresPage() {
  const [list, setList] = useState<Procurador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Procurador | null>(null);

  const [cnpj, setCnpj] = useState('');
  const [razao, setRazao] = useState('');
  const [fantasia, setFantasia] = useState('');
  const [preset, setPreset] = useState('consultri');
  const [cor, setCor] = useState('#7c3aed');
  const [obs, setObs] = useState('');

  function token() { return localStorage.getItem('admin_token') || localStorage.getItem('token') || ''; }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/consultri/procuradores', { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'falha');
      setList(j.data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setCnpj(''); setRazao(''); setFantasia(''); setPreset('consultri'); setCor('#7c3aed'); setObs('');
    setEditing(null);
  }

  function openEdit(p: Procurador) {
    setEditing(p);
    setCnpj(p.cnpj); setRazao(p.razaoSocial); setFantasia(p.nomeFantasia || '');
    setPreset(p.presetKey || 'consultri'); setCor(p.cor || '#7c3aed'); setObs(p.observacao || '');
    setShowForm(true);
  }

  async function save() {
    setError(null);
    try {
      const body = { cnpj, razaoSocial: razao, nomeFantasia: fantasia, presetKey: preset, cor, observacao: obs };
      const url = editing ? `/api/consultri/procuradores/${editing.id}` : '/api/consultri/procuradores';
      const method = editing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'falha');
      resetForm(); setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
  }

  async function toggleAtivo(p: Procurador) {
    await fetch(`/api/consultri/procuradores/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ativo: !p.ativo }),
    });
    load();
  }

  async function remover(p: Procurador) {
    if (!confirm(`Remover procurador ${p.razaoSocial}?`)) return;
    await fetch(`/api/consultri/procuradores/${p.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    load();
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Link href="/consultri" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← Deck CONSULTRI</Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Procuradores — Multi-CNPJ
            </h1>
            <p style={{ color: '#888', fontSize: 14 }}>
              Cadastre cada CNPJ que pode atuar como procurador (Holding, Filial, Escritórios parceiros).
              Cada procuração no sistema pode ser vinculada a um destes.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ padding: '10px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
          >
            + Novo procurador
          </button>
        </header>

        {error && <div style={{ background: '#7f1d1d', padding: 12, borderRadius: 6, marginBottom: 12 }}>Erro: {error}</div>}

        {showForm && (
          <div style={{ background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>{editing ? 'Editar procurador' : 'Cadastrar novo procurador'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              <Field label="CNPJ" value={cnpj} onChange={setCnpj} disabled={!!editing} />
              <Field label="Razão Social" value={razao} onChange={setRazao} />
              <Field label="Nome Fantasia" value={fantasia} onChange={setFantasia} />
              <Field label="Preset (poderes padrão)" value={preset} onChange={setPreset} />
              <Field label="Cor (hex)" value={cor} onChange={setCor} />
              <Field label="Observação" value={obs} onChange={setObs} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={save} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                {editing ? 'Salvar alterações' : 'Cadastrar'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? <div>Carregando...</div> : (
          <div style={{ background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0a0a14' }}>
                  <th style={th}>Cor</th>
                  <th style={th}>CNPJ</th>
                  <th style={th}>Razão Social</th>
                  <th style={th}>Preset</th>
                  <th style={th}>Procurações</th>
                  <th style={th}>Status</th>
                  <th style={th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                    <td style={td}><div style={{ width: 24, height: 24, borderRadius: 12, background: p.cor || '#7c3aed' }} /></td>
                    <td style={td}>{p.cnpj}</td>
                    <td style={td}><b>{p.razaoSocial}</b>{p.nomeFantasia ? <div style={{ color: '#888', fontSize: 11 }}>{p.nomeFantasia}</div> : null}</td>
                    <td style={td}>{p.presetKey || '—'}</td>
                    <td style={td}>{p._count?.procurations || 0}</td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: p.ativo ? '#10b98133' : '#6b728033', color: p.ativo ? '#10b981' : '#9ca3af', fontSize: 11, fontWeight: 700 }}>
                        {p.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td style={td}>
                      <button onClick={() => openEdit(p)} style={actBtn}>editar</button>
                      <button onClick={() => toggleAtivo(p)} style={actBtn}>{p.ativo ? 'desativar' : 'ativar'}</button>
                      <button onClick={() => remover(p)} style={{ ...actBtn, color: '#ef4444' }}>excluir</button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#888', padding: 30 }}>Nenhum procurador cadastrado. Clique em "+ Novo procurador" para começar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: '#666', fontSize: 12, marginTop: 16 }}>
          Dica: cada procurador pode usar um <b>preset diferente</b> de poderes — útil quando o escritório atende clientes via Holding (preset CONSULTRI completo)
          e outros via Filial (preset reduzido). A página de Carteira passa a filtrar por procurador automaticamente.
        </p>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
const actBtn: React.CSSProperties = { padding: '4px 10px', background: 'transparent', border: '1px solid #2a2a3e', borderRadius: 4, color: '#a0a0c0', cursor: 'pointer', fontSize: 11, marginRight: 4 };

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: disabled ? '#1a1a2e' : '#0a0a14', border: '1px solid #2a2a3e', borderRadius: 6,
          color: disabled ? '#666' : '#fff', padding: '8px 12px', fontSize: 13, width: '100%',
        }}
      />
    </div>
  );
}
