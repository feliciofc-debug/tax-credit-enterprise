'use client';

import { useState } from 'react';

export default function ApresentacaoPage() {
  const [faturamento, setFaturamento] = useState(300);
  const [lojas, setLojas] = useState(10);
  const taxRate = 0.12;
  const inefficiency = 0.035;

  const impostosMensais = (faturamento * 1_000_000 / 12) * taxRate;
  const economiaMensalRT = impostosMensais * inefficiency;
  const economiaAnualRT = economiaMensalRT * 12;
  const recuperacao5anos = economiaAnualRT * 4.2;
  const mensalidade = faturamento <= 50 ? 3200 : faturamento <= 300 ? 5300 : 8900;
  const feePerc = faturamento <= 50 ? 0.20 : faturamento <= 300 ? 0.175 : 0.15;
  const feeMensal = economiaMensalRT * feePerc;
  const custoTotalMensal = mensalidade + feeMensal;
  const roi = economiaMensalRT / custoTotalMensal;
  const lucroLiquidoExtraMensal = economiaMensalRT - custoTotalMensal;
  const lucroLiquidoExtraAnual = lucroLiquidoExtraMensal * 12;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  const fmtFull = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-gray-950 to-orange-900/20" />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Plataforma de Inteligência Fiscal</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
              Tax<span className="text-emerald-400">Credit</span> Enterprise
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Recupere créditos tributários dos últimos 5 anos e <span className="text-orange-400 font-semibold">nunca mais pague impostos indevidos</span> com monitoramento fiscal em tempo real.
            </p>
          </div>

          {/* Two Products */}
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="bg-gradient-to-br from-emerald-950/80 to-emerald-900/30 border border-emerald-700/40 rounded-2xl p-8 backdrop-blur">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Recuperação de Créditos</h2>
              <p className="text-gray-400 mb-6">Análise profunda dos últimos 5 anos de escriturações fiscais. Identificamos cada centavo pago a mais com extrato linha por linha.</p>
              <ul className="space-y-3 text-sm">
                {['SPED EFD ICMS/IPI — Créditos de ICMS', 'EFD Contribuições — PIS/COFINS reais', 'ECF — IRPJ/CSLL retidos a maior', 'ECD — Cruzamento contábil conta por conta', 'Extrato detalhado para formalização junto à Receita'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-emerald-400 text-sm font-bold">Resultado médio</p>
                <p className="text-3xl font-black text-white mt-1">3% a 5%</p>
                <p className="text-gray-400 text-sm">do total de impostos pagos nos últimos 5 anos recuperados</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-950/80 to-orange-900/30 border border-orange-700/40 rounded-2xl p-8 backdrop-blur">
              <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Compliance em Tempo Real</h2>
              <p className="text-gray-400 mb-6">Monitoramento contínuo dos SPEDs. O sistema analisa cada escrituração e gera alertas antes do pagamento indevido.</p>
              <ul className="space-y-3 text-sm">
                {['Alertas instantâneos de pagamento indevido', 'Detecção de créditos não aproveitados', 'Verificação automática Tema 69 STF', 'Parecer técnico com base legal para cada alerta', 'Dashboard com posição fiscal em tempo real', 'Relatório mensal de economia acumulada'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <p className="text-orange-400 text-sm font-bold">Impacto mensal</p>
                <p className="text-3xl font-black text-white mt-1">R$ 80K — R$ 500K</p>
                <p className="text-gray-400 text-sm">economia mensal por empresa monitorada</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Como funciona</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Da escrituração fiscal à economia comprovada em minutos, não meses.</p>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Upload dos SPEDs', desc: 'Envie os arquivos SPED direto do ERP (EFD, EFD Contribuições, ECF, ECD). ZIP ou individual.', color: 'emerald' },
              { step: '02', title: 'Análise Instantânea', desc: 'IA analisa registro por registro, cruza dados contábeis com fiscais, identifica divergências.', color: 'blue' },
              { step: '03', title: 'Alertas e Extrato', desc: 'Alertas por severidade com parecer técnico. Extrato detalhado conta por conta, ano a ano.', color: 'orange' },
              { step: '04', title: 'Economia Real', desc: 'Documentação pronta para formalização junto à Receita Federal e SEFAZ. Valores com centavos.', color: 'purple' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-black text-gray-800 mb-4">{item.step}</div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section className="py-20" id="simulador">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Simulador de Impacto</h2>
          <p className="text-gray-400 text-center mb-12">Descubra quanto sua empresa pode economizar</p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Faturamento anual (R$ milhões)</label>
                <input
                  type="range" min={10} max={2000} step={10} value={faturamento}
                  onChange={e => setFaturamento(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-2xl font-bold text-emerald-400 mt-2">R$ {faturamento}M /ano</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Unidades / Filiais</label>
                <input
                  type="range" min={1} max={200} step={1} value={lojas}
                  onChange={e => setLojas(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <p className="text-2xl font-bold text-orange-400 mt-2">{lojas} unidade{lojas > 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl p-5">
                <p className="text-xs text-emerald-500 uppercase tracking-wide font-bold">Recuperação 5 anos</p>
                <p className="text-3xl font-black text-emerald-400 mt-2">{fmt(recuperacao5anos)}</p>
                <p className="text-gray-500 text-xs mt-1">Créditos passados recuperáveis</p>
              </div>
              <div className="bg-orange-950/50 border border-orange-800/50 rounded-xl p-5">
                <p className="text-xs text-orange-500 uppercase tracking-wide font-bold">Economia mensal RT</p>
                <p className="text-3xl font-black text-orange-400 mt-2">{fmt(economiaMensalRT)}</p>
                <p className="text-gray-500 text-xs mt-1">Pagamentos indevidos evitados/mês</p>
              </div>
              <div className="bg-purple-950/50 border border-purple-800/50 rounded-xl p-5">
                <p className="text-xs text-purple-500 uppercase tracking-wide font-bold">Lucro líquido extra/ano</p>
                <p className="text-3xl font-black text-purple-400 mt-2">{fmt(lucroLiquidoExtraAnual)}</p>
                <p className="text-gray-500 text-xs mt-1">Após custos da plataforma</p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">Detalhamento do investimento</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Impostos pagos/mês</span>
                    <span className="font-bold">{fmt(impostosMensais)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ineficiência média (3,5%)</span>
                    <span className="font-bold text-orange-400">{fmt(economiaMensalRT)}/mês</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Economia anual RT</span>
                    <span className="font-bold text-orange-400">{fmt(economiaAnualRT)}/ano</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Mensalidade fixa</span>
                    <span className="font-bold">{fmtFull(mensalidade)}/mês</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Fee performance ({(feePerc * 100).toFixed(1)}%)</span>
                    <span className="font-bold">{fmt(feeMensal)}/mês</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                    <span className="text-gray-300 font-bold">ROI</span>
                    <span className="font-black text-emerald-400 text-lg">{roi.toFixed(1)}x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Technology */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Tecnologia de Ponta</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', title: 'IA Claude (Anthropic)', desc: 'Inteligência artificial de última geração para análise tributária profunda. Identifica oportunidades que humanos levariam semanas.' },
              { icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', title: '4 Escriturações Digitais', desc: 'Parser nativo para EFD ICMS/IPI, EFD Contribuições, ECF e ECD. Leitura registro por registro com precisão de centavos.' },
              { icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Processamento em Segundos', desc: 'Análise completa de anos de escrituração em menos de 60 segundos. Sem esperar dias por um relatório.' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Setores de maior impacto</h2>
          <p className="text-gray-400 text-center mb-12">Quanto mais complexa a tributação, maior a economia</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Varejo & Supermercados', economy: 'R$ 80K-500K/mês', reason: 'Monofásico, ST, cesta básica, alto volume de NFes' },
              { name: 'Indústria', economy: 'R$ 100K-1M/mês', reason: 'Insumos, crédito ativo permanente, exportação, Bloco K' },
              { name: 'Energia & Óleo/Gás', economy: 'R$ 200K-2M/mês', reason: 'Regime especial, ICMS diferido, PIS/COFINS não-cumulativo' },
              { name: 'Agronegócio', economy: 'R$ 50K-300K/mês', reason: 'Crédito presumido, isenções, diferimento ICMS' },
            ].map((seg, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-emerald-700/50 transition-colors">
                <h3 className="font-bold mb-2">{seg.name}</h3>
                <p className="text-emerald-400 font-bold text-lg mb-2">{seg.economy}</p>
                <p className="text-gray-500 text-xs">{seg.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-gray-950 to-emerald-950/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black mb-6">Pronto para transformar<br />impostos em lucro?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Agende uma demonstração ao vivo. Trazemos seus SPEDs, rodamos a análise na hora e mostramos exatamente quanto sua empresa pode recuperar e economizar.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="https://wa.me/5521999999999?text=Quero%20conhecer%20o%20TaxCredit%20Enterprise" target="_blank" className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors text-lg">
              Agendar demonstração
            </a>
            <a href="#simulador" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors text-lg border border-gray-700">
              Simular economia
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">TaxCredit Enterprise &copy; {new Date().getFullYear()}</p>
            <p className="text-gray-600 text-xs mt-1">Plataforma de Inteligência Fiscal com IA</p>
          </div>
          <div className="text-right">
            <p className="text-gray-600 text-xs">Powered by Claude AI (Anthropic)</p>
            <p className="text-gray-600 text-xs">Parsers nativos SPED EFD, EFD Contribuições, ECF, ECD</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
