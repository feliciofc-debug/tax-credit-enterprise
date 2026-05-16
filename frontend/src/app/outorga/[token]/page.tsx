'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Payload = {
  invite: { id: string; status: string; recipientName: string | null; expiresAt: string };
  procuracao: {
    id: string;
    presetKey: string | null;
    procuradorCnpj: string | null;
    procuradorNome: string | null;
    poderes: string[] | null;
    dataValidade: string | null;
    documentText: string | null;
    serproStatus: string | null;
  };
  outorgante: { nome: string; cnpj: string };
};

const STEPS = [
  {
    n: 1,
    title: 'Acesse o e-CAC com seu certificado digital',
    desc: 'Va em https://cav.receita.fazenda.gov.br/autenticacao/login, clique em "Entrar com gov.br" -> "Seu certificado digital" e selecione o certificado da empresa.',
  },
  {
    n: 2,
    title: 'Va em "Senhas e Procuracoes"',
    desc: 'Dentro do e-CAC, selecione "Senhas e Procuracoes" -> "Cadastro, Consulta e Procuracao e-CAC" -> "Cadastrando Procuracao".',
  },
  {
    n: 3,
    title: 'Dados do Procurador',
    desc: 'Selecione "Pessoa Juridica" e cole o CNPJ do procurador abaixo. O nome sera preenchido automaticamente.',
  },
  {
    n: 4,
    title: 'Defina a vigencia',
    desc: 'Em "Dados da Procuracao", coloque data-fim de 12 meses a partir de hoje.',
  },
  {
    n: 5,
    title: 'Marque os poderes obrigatorios',
    desc: 'Use o checklist completo abaixo. Sao 45 poderes pre-definidos (eSocial, DCTFWeb, PER/DCOMP, SPED, Caixa Postal, etc.).',
  },
  {
    n: 6,
    title: 'Clique em "Cadastrar Procuracao"',
    desc: 'O sistema vai baixar o assinador SERPRO (.jnlp). Execute via Java atualizado.',
  },
  {
    n: 7,
    title: 'Assine digitalmente',
    desc: 'No assinador SERPRO, clique em "Assinar" e digite o PIN do certificado novamente.',
  },
  {
    n: 8,
    title: 'Confirme aqui',
    desc: 'Volte para esta pagina e clique em "Concluido!" abaixo. Nossa equipe verifica automaticamente em ate 15 minutos.',
  },
];

export default function OutorgaPublicPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/outorga/${token}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setData(j.data);
        // telemetria opcional
        fetch(`/api/public/outorga/${token}/open`, { method: 'POST' }).catch(() => {});
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function acknowledge() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/outorga/${token}/ack`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao confirmar');
      setDone(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <p className="text-slate-600">Carregando…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-md p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link invalido ou expirado</h1>
          <p className="text-slate-600 text-sm">{error || 'Solicite um novo link ao escritorio que enviou este convite.'}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-md p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Recebido!</h1>
          <p className="text-slate-600 mb-4">
            Vamos verificar a procuracao via SERPRO em ate 15 minutos. Voce e o escritorio recebem
            uma notificacao automatica assim que estiver ativa.
          </p>
          <p className="text-xs text-slate-400">Pode fechar esta pagina.</p>
        </div>
      </div>
    );
  }

  const poderes: string[] = (data.procuracao.poderes as any) || [];
  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Top brand bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Procuracao Eletronica</p>
            <p className="text-lg font-bold text-slate-800">TaxCredit Enterprise</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Procurador</p>
            <p className="text-sm font-bold text-slate-700">{data.procuracao.procuradorNome}</p>
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 pb-24">
        {/* Cabecalho de boas-vindas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Ola{data.invite.recipientName ? `, ${data.invite.recipientName}` : ''}!
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Para que <strong className="text-slate-800">{data.procuracao.procuradorNome}</strong> possa
            operar tributariamente em nome de <strong className="text-slate-800">{data.outorgante.nome}</strong>,
            precisamos que voce conceda uma procuracao eletronica no Centro Virtual de Atendimento (e-CAC)
            da Receita Federal.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <InfoChip label="Outorgante" value={data.outorgante.cnpj} />
            <InfoChip label="Procurador" value={data.procuracao.procuradorCnpj || '—'} />
            <InfoChip label="Vigencia" value="12 meses" />
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {STEPS.map(s => (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  step === s.n
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : s.n < step
                    ? 'border-transparent text-emerald-600 hover:bg-slate-50'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      s.n < step
                        ? 'bg-emerald-100 text-emerald-700'
                        : s.n === step
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.n < step ? '✓' : s.n}
                  </span>
                  Passo {s.n}
                </span>
              </button>
            ))}
          </div>

          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {STEPS[step - 1].title}
            </h2>
            <p className="text-slate-600 mb-5 leading-relaxed">{STEPS[step - 1].desc}</p>

            {/* Step 3 — copy CNPJ */}
            {step === 3 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-2">
                  CNPJ do Procurador
                </p>
                <div className="flex items-center gap-3">
                  <code className="bg-white px-4 py-3 rounded-lg border border-blue-200 text-blue-800 font-mono text-lg font-bold flex-1">
                    {data.procuracao.procuradorCnpj}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.procuracao.procuradorCnpj || '');
                      alert('CNPJ copiado!');
                    }}
                    className="px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  Nome esperado: <strong>{data.procuracao.procuradorNome}</strong>
                </p>
              </div>
            )}

            {/* Step 5 — checklist 45 poderes */}
            {step === 5 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                    Checklist obrigatorio ({poderes.length} poderes)
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(poderes.join('\n'));
                      alert('Lista copiada para colar como referencia!');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Copiar lista
                  </button>
                </div>
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-2">
                  {poderes.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm py-1 border-b border-slate-200/60"
                    >
                      <input type="checkbox" className="mt-1 accent-emerald-500" />
                      <span className="text-slate-700">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Step 6/7 — link assinador */}
            {(step === 6 || step === 7) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="font-bold text-amber-800 mb-2">Dica para o assinador SERPRO</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• O assinador roda em Java. Se nao tiver, baixe em <a className="underline" href="https://www.java.com/pt-BR/download/" target="_blank" rel="noreferrer">java.com</a></li>
                  <li>• O arquivo baixado tem extensao <code>.jnlp</code>. Clique 2x e clique "Permitir"</li>
                  <li>• Se travar, abra Chrome ou Edge atualizados (Firefox tem bloqueios)</li>
                </ul>
              </div>
            )}

            {/* Step 8 — botao conclusao */}
            {step === 8 && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-6 text-center">
                <p className="text-emerald-800 mb-4 leading-relaxed">
                  Finalizou no e-CAC? Clique abaixo. Nossa equipe verifica via SERPRO
                  automaticamente em ate <strong>15 minutos</strong>.
                </p>
                <button
                  onClick={acknowledge}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-bold text-lg hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {submitting ? 'Enviando…' : '✓ Concluido!'}
                </button>
              </div>
            )}

            {/* Navegacao */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-700 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <p className="text-sm text-slate-500 self-center">
                Passo {step} de {STEPS.length}
              </p>
              <button
                onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}
                disabled={step === STEPS.length}
                className="px-5 py-2 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 disabled:opacity-30"
              >
                Proximo →
              </button>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center text-xs text-slate-500">
          <p>Procuracao eletronica revogavel a qualquer momento por voce no proprio e-CAC.</p>
          <p className="mt-1">Powered by TaxCredit Enterprise · Verificacao automatica via SERPRO Integra Contador</p>
        </div>
      </main>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-sm font-bold text-slate-800 font-mono">{value}</p>
    </div>
  );
}
