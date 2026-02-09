'use client';

import Link from 'next/link';

const features = [
  {
    title: 'Analise com IA',
    description: 'Claude AI analisa DREs, Balancos e Balancetes identificando creditos tributarios ocultos automaticamente.',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V5.846a2 2 0 00-1.636-1.967l-2.114-.353m0 0V3.5a2 2 0 00-2-2h-1.5a2 2 0 00-2 2v.026',
  },
  {
    title: 'Processamento em Lote',
    description: 'Envie ate 200 documentos de uma vez. 5 workers paralelos processam tudo automaticamente.',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    title: 'Documentacao Automatica',
    description: 'Gera memorias de calculo, pareceres tecnicos, peticoes e planilhas prontas para protocolo.',
    icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  },
  {
    title: 'Preparacao e-CAC',
    description: 'Dados formatados para PER/DCOMP com guia passo-a-passo para protocolo na Receita Federal.',
    icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418',
  },
  {
    title: '6 Tipos de Credito',
    description: 'IRPJ, CSLL, PIS, COFINS, ICMS e ISS. Cobertura completa dos principais tributos brasileiros.',
    icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  },
  {
    title: 'Relatorios Executivos',
    description: 'Dashboards consolidados, exportacao Excel, timeline de oportunidades e ranking por valor.',
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  },
];

const stats = [
  { value: 'R$ 2.8M+', label: 'Creditos identificados' },
  { value: '142+', label: 'Documentos analisados' },
  { value: '95%', label: 'Taxa de precisao' },
  { value: '<1min', label: 'Por documento' },
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
            <Link href="/parceiro-login" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              Sou Parceiro
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link href="/login" className="btn-primary text-sm">
              Comecar Agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-blue-50"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
              Powered by Claude AI
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              Recupere creditos tributarios com{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-800">
                inteligencia artificial
              </span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-10 max-w-2xl">
              Analise automatizada de DREs, Balancos e Balancetes. Identifique oportunidades de 
              IRPJ, CSLL, PIS, COFINS, ICMS e ISS em minutos, nao em semanas.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/login" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2">
                Comecar Gratuitamente
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
              <Link href="#features" className="btn-secondary text-base px-8 py-3.5">
                Ver Funcionalidades
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

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
            Tudo que voce precisa para recuperar creditos
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Da analise do documento ate o protocolo no e-CAC. Automacao completa do processo de recuperacao tributaria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Como funciona
            </h2>
            <p className="text-lg text-gray-500">3 passos simples para recuperar seus creditos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Upload dos Documentos',
                description: 'Envie DREs, Balancos Patrimoniais e Balancetes em PDF, Excel ou imagem. Ate 200 arquivos por lote.',
                color: 'from-brand-500 to-brand-700',
              },
              {
                step: '02',
                title: 'Analise com IA',
                description: 'Claude AI analisa cada documento identificando oportunidades de credito tributario com fundamentacao legal.',
                color: 'from-blue-500 to-blue-700',
              },
              {
                step: '03',
                title: 'Documentacao Pronta',
                description: 'Receba pareceres tecnicos, peticoes e dados formatados para protocolar diretamente no e-CAC.',
                color: 'from-purple-500 to-purple-700',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 shadow-lg`}>
                  <span className="text-white text-2xl font-extrabold">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 rounded-3xl p-12 lg:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjYSkiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-50"></div>
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
              Pronto para recuperar seus creditos?
            </h2>
            <p className="text-brand-200 text-lg mb-10 max-w-xl mx-auto">
              Comece agora e descubra quanto sua empresa pode recuperar em creditos tributarios.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold py-4 px-10 rounded-xl hover:bg-brand-50 transition-colors text-lg shadow-xl">
              Comecar Agora
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="font-bold text-gray-700 text-sm">Tax Credit Enterprise v2.0</span>
            </div>
            <p className="text-sm text-gray-500">
              2026 Tax Credit Enterprise. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
