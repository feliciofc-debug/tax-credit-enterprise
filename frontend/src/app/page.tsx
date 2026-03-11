'use client';

import Link from 'next/link';

const tributos = [
  {
    sigla: 'ICMS',
    nome: 'Imposto sobre Circulação de Mercadorias',
    teses: ['Saldo credor acumulado', 'Ressarcimento ICMS-ST', 'TUSD/TUST energia', 'CIAP ativo imobilizado', 'Crédito extemporâneo', 'Transferência entre filiais (ADC 49)'],
    cor: 'from-teal-500 to-teal-700',
    bgCor: 'bg-teal-50',
    textCor: 'text-teal-700',
  },
  {
    sigla: 'PIS',
    nome: 'Programa de Integração Social',
    teses: ['Exclusão ICMS da base (Tema 69 STF)', 'Créditos sobre insumos (Tema 779 STJ)', 'Monofásicos pagos a maior', 'PIS-Importação não aproveitado', 'Receitas financeiras'],
    cor: 'from-blue-500 to-blue-700',
    bgCor: 'bg-blue-50',
    textCor: 'text-blue-700',
  },
  {
    sigla: 'COFINS',
    nome: 'Contribuição para Financiamento da Seguridade',
    teses: ['Exclusão ICMS da base (Tema 69 STF)', 'Créditos sobre insumos (Tema 779 STJ)', 'Monofásicos pagos a maior', 'COFINS-Importação não aproveitado', 'ISS fora da base'],
    cor: 'from-indigo-500 to-indigo-700',
    bgCor: 'bg-indigo-50',
    textCor: 'text-indigo-700',
  },
  {
    sigla: 'IRPJ',
    nome: 'Imposto de Renda Pessoa Jurídica',
    teses: ['Benefícios fiscais ICMS fora da base (LC 160)', 'SELIC sobre repetição de indébito', 'PAT dedução integral', 'Equiparação hospitalar'],
    cor: 'from-amber-500 to-amber-700',
    bgCor: 'bg-amber-50',
    textCor: 'text-amber-700',
  },
  {
    sigla: 'CSLL',
    nome: 'Contribuição Social sobre Lucro Líquido',
    teses: ['Benefícios fiscais ICMS fora da base', 'SELIC sobre repetição de indébito (Tema 1.079 STF)', 'Equiparação hospitalar para saúde'],
    cor: 'from-orange-500 to-orange-700',
    bgCor: 'bg-orange-50',
    textCor: 'text-orange-700',
  },
  {
    sigla: 'INSS',
    nome: 'Contribuição Previdenciária Patronal',
    teses: ['Verbas indenizatórias (aviso prévio, terço férias)', 'RAT/FAP incorreto', 'Salário-maternidade (Tema 72 STF)', 'FGTS sobre verbas indenizatórias'],
    cor: 'from-rose-500 to-rose-700',
    bgCor: 'bg-rose-50',
    textCor: 'text-rose-700',
  },
];

const capacidades = [
  {
    titulo: 'SPED EFD Fiscal',
    descricao: 'O EFD Fiscal contém dados de ICMS, PIS e COFINS: C170 (VL_PIS, VL_COFINS por item), C120 (PIS/COFINS-Importação nas DIs) e E520 (apuração resumida). Analisamos 60 meses retroativos.',
    icone: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    titulo: 'Cruzamento Inteligente',
    descricao: 'Cruzamos dados de notas fiscais, DIs de importação, registros de apuração e saldo credor para identificar inconsistências e créditos ocultos.',
    icone: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  },
  {
    titulo: '34 Teses Tributárias',
    descricao: 'Base de conhecimento com jurisprudência atualizada do STF, STJ e CARF. Cada oportunidade vem com fundamentação legal completa e acórdãos reais.',
    icone: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  },
  {
    titulo: 'Supercomputação Tributária',
    descricao: 'Tecnologia de supercomputação que analisa SPEDs de centenas de MB em segundos. Processamento paralelo massivo com precisão de 99,9%.',
    icone: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  },
  {
    titulo: 'IA Avançada',
    descricao: 'Inteligência artificial de última geração analisa cada registro do SPED, identifica padrões e gera relatórios com memória de cálculo transparente.',
    icone: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V5.846a2 2 0 00-1.636-1.967l-2.114-.353m0 0V3.5a2 2 0 00-2-2h-1.5a2 2 0 00-2 2v.026',
  },
  {
    titulo: 'Documentação Completa',
    descricao: 'Gera automaticamente parecer técnico, PER/DCOMP, petição SEFAZ, memória de cálculo e declaração de não utilização prévia dos créditos.',
    icone: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  },
];

const stats = [
  { value: '34', label: 'Teses tributárias analisadas' },
  { value: '5 anos', label: 'De SPED retroativo (60 meses)' },
  { value: '< 3 min', label: 'Para análise completa' },
  { value: '100%', label: 'Fundamentação legal com CARF' },
];

const diferenciais = [
  { texto: 'Análise de SPED EFD Fiscal completo — 60 meses retroativos (ICMS, PIS e COFINS via C170, C120, E520)', icone: 'check' },
  { texto: 'Metodologia em duas etapas: identificação no EFD Fiscal → confirmação no EFD Contribuições', icone: 'check' },
  { texto: 'Cruzamento automático entre NFs, DIs, C197 e registros de apuração', icone: 'check' },
  { texto: 'Jurisprudência STF, STJ e CARF citada em cada oportunidade', icone: 'check' },
  { texto: 'Memória de cálculo transparente — cada número é rastreável', icone: 'check' },
  { texto: 'Relatório blindado para auditoria e banca jurídica', icone: 'check' },
  { texto: 'PER/DCOMP e petição SEFAZ gerados automaticamente', icone: 'check' },
  { texto: 'Declaração de não utilização prévia dos créditos inclusa', icone: 'check' },
  { texto: 'Suporte a Lucro Real, Lucro Presumido e Simples Nacional', icone: 'check' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-base">T</span>
            </div>
            <span className="font-bold text-gray-900">Tax Credit <span className="text-brand-600">Enterprise</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#tributos" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:inline">
              Tributos
            </Link>
            <Link href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:inline">
              Como Funciona
            </Link>
            <Link href="/apresentacao" className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors hidden sm:inline">
              Apresentação Comercial
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn-primary text-sm">
              Contratar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-blue-50"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
              Supercomputação + IA
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              Recuperação tributária com{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-800">
                precisão de máquina
              </span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-4 max-w-2xl">
              Analisamos 5 anos de SPED EFD Fiscal e identificamos créditos de ICMS, PIS, COFINS, IRPJ, CSLL e INSS com fundamentação legal completa — STF, STJ e CARF.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-2xl">
              34 teses tributárias auditadas. Memória de cálculo transparente. Relatório pronto para protocolo.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/cadastro" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2">
                Contratar Agora
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
              <Link href="#tributos" className="btn-secondary text-base px-8 py-3.5">
                Ver Tributos Analisados
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-extrabold text-brand-700">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tributos */}
      <section id="tributos" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
            Tributos que analisamos
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Cada tributo é analisado com teses específicas, jurisprudência atualizada e cruzamento de dados do SPED.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tributos.map((tributo) => (
            <div key={tributo.sigla} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tributo.cor} flex items-center justify-center shadow-sm`}>
                  <span className="text-white font-extrabold text-lg">{tributo.sigla}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{tributo.sigla}</h3>
                  <p className="text-xs text-gray-400">{tributo.nome}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {tributo.teses.map((tese) => (
                  <li key={tese} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tributo.textCor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {tese}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Metodologia — EFD Fiscal vs EFD Contribuições */}
        <div className="mt-16 p-6 rounded-2xl bg-blue-50 border border-blue-100">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Metodologia em duas etapas
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            O <strong>SPED EFD Fiscal</strong> já contém dados de PIS e COFINS nos registros C170 (valores por item de NF), C120 (PIS/COFINS-Importação nas DIs) e E520 (apuração resumida). Com isso, identificamos oportunidades como Tema 69 STF, créditos de importação e monofásicos. O <strong>SPED EFD Contribuições</strong> é solicitado em seguida para confirmar se os créditos foram ou não aproveitados e fechar o cálculo definitivo antes do protocolo. Duas fases: identificação (Fiscal) → confirmação (Contribuições).
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 text-gray-700 font-medium">EFD Fiscal = triagem e identificação</span>
            <span className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 text-gray-700 font-medium">EFD Contribuições = confirmação e precisão</span>
          </div>
        </div>
      </section>

      {/* Capacidades Técnicas */}
      <section id="como-funciona" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Como encontramos seus créditos
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Tecnologia de ponta combinada com expertise tributária. Cada etapa é automatizada e auditável.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capacidades.map((cap) => (
              <div key={cap.titulo} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cap.icone} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{cap.titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{cap.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Relatório blindado para auditoria
            </h2>
            <p className="text-lg text-gray-500 mb-8">
              Nossos relatórios são preparados para passar pelo crivo de bancas jurídicas, auditorias Big Four e análise do CARF. Cada oportunidade é um mini-parecer técnico completo.
            </p>
            <ul className="space-y-3">
              {diferenciais.map((dif) => (
                <li key={dif.texto} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm leading-relaxed">{dif.texto}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-sm font-mono text-green-400 leading-relaxed shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-gray-500">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2 text-xs">extrato_tributario.json</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="text-gray-500">{'{'}</span></p>
              <p>  <span className="text-blue-400">&quot;empresa&quot;</span>: <span className="text-yellow-300">&quot;EMPRESA LTDA&quot;</span>,</p>
              <p>  <span className="text-blue-400">&quot;regime&quot;</span>: <span className="text-yellow-300">&quot;Lucro Real&quot;</span>,</p>
              <p>  <span className="text-blue-400">&quot;periodo&quot;</span>: <span className="text-yellow-300">&quot;60 meses&quot;</span>,</p>
              <p>  <span className="text-blue-400">&quot;oportunidades&quot;</span>: <span className="text-purple-400">9</span>,</p>
              <p>  <span className="text-blue-400">&quot;totalEstimado&quot;</span>: <span className="text-green-300">&quot;R$ 395.000,00&quot;</span>,</p>
              <p>  <span className="text-blue-400">&quot;tributos&quot;</span>: [</p>
              <p>    <span className="text-yellow-300">&quot;ICMS&quot;</span>, <span className="text-yellow-300">&quot;PIS&quot;</span>, <span className="text-yellow-300">&quot;COFINS&quot;</span>,</p>
              <p>    <span className="text-yellow-300">&quot;IRPJ&quot;</span>, <span className="text-yellow-300">&quot;CSLL&quot;</span></p>
              <p>  ],</p>
              <p>  <span className="text-blue-400">&quot;fundamentacao&quot;</span>: <span className="text-yellow-300">&quot;STF + STJ + CARF&quot;</span>,</p>
              <p>  <span className="text-blue-400">&quot;score&quot;</span>: <span className="text-purple-400">58</span></p>
              <p><span className="text-gray-500">{'}'}</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 rounded-3xl p-12 lg:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjYSkiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-50"></div>
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
              Contrate e descubra seus créditos
            </h2>
            <p className="text-brand-200 text-lg mb-4 max-w-xl mx-auto">
              Assinatura mensal com acesso completo à plataforma. Análise ilimitada de SPEDs, relatórios com jurisprudência e documentação para protocolo.
            </p>
            <p className="text-brand-300 text-sm mb-10 max-w-lg mx-auto">
              Fale com nosso time comercial para conhecer os planos disponíveis para escritórios, consultorias e empresas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/cadastro" className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold py-4 px-10 rounded-xl hover:bg-brand-50 transition-colors text-lg shadow-xl">
                Contratar Agora
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
              <a href="mailto:comercial@taxcreditenterprise.com" className="inline-flex items-center gap-2 border-2 border-white/30 text-white font-semibold py-4 px-8 rounded-xl hover:bg-white/10 transition-colors text-base">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                comercial@taxcreditenterprise.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Presentation Banner */}
          <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 rounded-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Conheça nossa apresentação comercial completa</h3>
                <p className="text-gray-600 text-sm mt-1">Recuperação de 5 anos + Compliance em Tempo Real com simulador de impacto financeiro</p>
              </div>
              <Link href="/apresentacao" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold py-3 px-8 rounded-xl hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-lg text-sm whitespace-nowrap">
                Ver Apresentação
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="font-bold text-gray-700 text-sm">Tax Credit Enterprise</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/apresentacao" className="text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
                Apresentação Comercial
              </Link>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href="mailto:comercial@taxcreditenterprise.com" className="hover:text-brand-700 transition-colors font-medium">
                  comercial@taxcreditenterprise.com
                </a>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 Tax Credit Enterprise. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
