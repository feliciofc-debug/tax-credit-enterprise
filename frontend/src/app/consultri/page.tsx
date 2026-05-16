'use client';

import { useState, useEffect, useMemo } from 'react';

type Slide = {
  id: string;
  num: string;
  title: string;
  subtitle?: string;
};

const SLIDES: Slide[] = [
  { id: 'capa', num: '00', title: 'Capa' },
  { id: 'consultri', num: '01', title: 'A Consultri em números' },
  { id: 'desafio', num: '02', title: 'O desafio de escalar' },
  { id: 'solucao', num: '03', title: 'A solução em dois produtos' },
  { id: 'p1-overview', num: '04', title: 'Produto 1 — Recuperação 5 Anos' },
  { id: 'p1-tributos', num: '05', title: 'Tributos cobertos' },
  { id: 'p1-fluxo', num: '06', title: 'Fluxo operacional' },
  { id: 'p1-cruzamento', num: '07', title: 'Cruzamento Contábil ECD' },
  { id: 'p1-docs', num: '08', title: 'Documentação automatizada' },
  { id: 'p2-overview', num: '09', title: 'Produto 2 — Compliance em Tempo Real' },
  { id: 'p2-alertas', num: '10', title: 'Alertas automáticos' },
  { id: 'p3-simples', num: '11', title: 'Produto 3 — Simples Nacional' },
  { id: 'erp', num: '12', title: 'Integrações com ERPs' },
  { id: 'serpro', num: '13', title: 'SERPRO / Integra Contador' },
  { id: 'procuracoes', num: '14', title: 'Procurações Digitais' },
  { id: 'consultri-procuracao', num: '14b', title: 'Procuração CONSULTRI — de 45min para 1 clique' },
  { id: 'consultri-carteira', num: '14c', title: 'Painel de Carteira — visão do escritório' },
  { id: 'consultri-convite', num: '14d', title: 'Convite mágico — onboarding em minutos' },
  { id: 'consultri-automacao', num: '14e', title: 'Automação 24x7 — jobs SERPRO' },
  { id: 'consultri-conformidade', num: '14f', title: 'Conformidade da Carteira' },
  { id: 'consultri-hibrido', num: '14g', title: 'Modo Híbrido — auto + manual' },
  { id: 'consultri-coletas', num: '14h', title: 'Coletas Federais via Procuração' },
  { id: 'consultri-metricas', num: '14i', title: 'Métricas Comerciais — KPIs da Carteira' },
  { id: 'consultri-realtime', num: '14j', title: 'Real-Time + Detector de Teses + Relatório PDF' },
  { id: 'consultri-multiproc', num: '14k', title: 'Multi-Procurador — uma carteira, vários CNPJs' },
  { id: 'consultri-hub-timeline', num: '14l', title: 'Hub de Notificações + Timeline Unificada' },
  { id: 'consultri-autorenew', num: '14m', title: 'Auto-Renovação Híbrida — zero gap' },
  { id: 'consultri-executive', num: '14n', title: 'Executive Summary + Filtros por Procurador' },
  { id: 'consultri-cobertura', num: '14o', title: 'Cobertura Nacional SEFAZ — engine + 27 UFs' },
  { id: 'contratos', num: '15', title: 'Contratos Tripartite' },
  { id: 'ia', num: '16', title: 'IA + Teses + Jurisprudência' },
  { id: 'seguranca', num: '17', title: 'Segurança nível bancário' },
  { id: 'comercial', num: '18', title: 'Modelo Comercial' },
  { id: 'projecao', num: '19', title: 'Projeção financeira' },
  { id: 'roadmap', num: '20', title: 'Próximos passos' },
  { id: 'cta', num: '21', title: 'Vamos construir juntos' },
];

export default function ConsultriDeckPage() {
  const [current, setCurrent] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrent(c => Math.min(c + 1, SLIDES.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrent(c => Math.max(c - 1, 0));
      } else if (e.key === 'Home') {
        setCurrent(0);
      } else if (e.key === 'End') {
        setCurrent(SLIDES.length - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        setMenuOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="min-h-screen bg-gray-950 text-white antialiased print:bg-white print:text-black">
      <style jsx global>{`
        @media print {
          .slide {
            page-break-after: always;
            min-height: auto !important;
            padding: 40px !important;
          }
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      {/* Top Bar */}
      <header className="no-print fixed top-0 left-0 right-0 z-40 bg-gray-950/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-orange-500 rounded" />
            <div>
              <p className="text-sm font-bold leading-tight">TaxCredit Enterprise</p>
              <p className="text-[10px] text-gray-500 leading-tight">Apresentação institucional · Consultri</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 hidden lg:block">Slide {current + 1}/{SLIDES.length}</span>
            <a href="/consultri/carteira" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 hidden sm:inline-block">
              Carteira
            </a>
            <a href="/consultri/conformidade" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 hidden sm:inline-block">
              Conformidade
            </a>
            <a href="/consultri/metricas" className="px-3 py-1.5 bg-purple-800/40 hover:bg-purple-800/60 rounded text-xs font-medium border border-purple-700/60 hidden sm:inline-block">
              Métricas
            </a>
            <a href="/consultri/procuradores" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 hidden md:inline-block">
              Procuradores
            </a>
            <a href="/consultri/notificacoes" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 hidden md:inline-block">
              Hub
            </a>
            <a href="/admin/sefaz/cobertura" className="px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 rounded text-xs font-medium border border-emerald-700/60 hidden md:inline-block" title="Mapa nacional SEFAZ">
              Cobertura BR
            </a>
            <NotifBell />
            
            <a href="/consultri/configuracoes" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 hidden md:inline-block">
              Config
            </a>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700"
            >
              {menuOpen ? 'Fechar' : 'Sumário'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-medium"
            >
              PDF
            </button>
          </div>
        </div>
        <div className="h-1 bg-gray-800">
          <div
            className="h-1 bg-gradient-to-r from-emerald-500 to-orange-500 transition-all"
            style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Sidebar Menu */}
      {menuOpen && (
        <aside className="no-print fixed top-16 right-4 z-30 w-72 max-h-[80vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl">
          <div className="p-3">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrent(i); setMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-3 transition-colors ${
                  i === current ? 'bg-emerald-600 text-white' : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <span className="text-xs opacity-50 font-mono">{s.num}</span>
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Slides */}
      <main className="pt-16">
        {/* Slide 0 — Capa */}
        <Slide active={current === 0} id="capa">
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-8">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium tracking-wider uppercase">Apresentação Institucional</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">
              Tax<span className="text-emerald-400">Credit</span> Enterprise
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed mb-12">
              A infraestrutura tecnológica que falta no setor de recuperação tributária
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
              <Card className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Preparado para</p>
                <p className="text-2xl font-bold">Consultri</p>
                <p className="text-xs text-gray-500 mt-1">Av. Paulista · São Paulo</p>
              </Card>
              <Card className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reunião com</p>
                <p className="text-2xl font-bold">Tadeu</p>
                <p className="text-xs text-gray-500 mt-1">CEO</p>
              </Card>
              <Card className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Apresentado por</p>
                <p className="text-2xl font-bold">TaxCredit</p>
                <p className="text-xs text-gray-500 mt-1">Enterprise Edition</p>
              </Card>
            </div>
            <p className="text-xs text-gray-600">15 de maio de 2026 · 11h00</p>
          </div>
        </Slide>

        {/* Slide 1 — A Consultri em números */}
        <Slide active={current === 1} id="consultri">
          <SlideHeader num="01" title="A Consultri" subtitle="Uma operação que respeitamos" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <Stat label="Desde" value="2017" sub="9 anos de mercado" color="emerald" />
            <Stat label="Consultores" value="120+" sub="rede nacional" color="orange" />
            <Stat label="Projetos" value="800+" sub="ponta a ponta" color="blue" />
            <Stat label="Recuperado" value="R$ 400M" sub="em créditos tributários" color="purple" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Em <span className="text-emerald-400 font-bold">9 anos</span> a Consultri consolidou uma operação
              nacional com cobertura completa em tributação federal e estadual. Atua nas esferas{' '}
              <span className="text-orange-400 font-bold">administrativa e judicial</span> com escritórios em
              São Paulo e parceiros em todo o Brasil.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mt-6 text-sm">
              <div>
                <p className="text-xs text-emerald-500 uppercase tracking-wider mb-3 font-bold">Esfera Administrativa</p>
                <ul className="space-y-1.5 text-gray-400">
                  <li>• PIS/COFINS (insumos, monofásico, ST, decisões do STJ/STF)</li>
                  <li>• IRPJ e CSLL</li>
                  <li>• IPI e ICMS</li>
                  <li>• Créditos previdenciários (folha)</li>
                  <li>• Simples Nacional</li>
                  <li>• Regimes especiais</li>
                </ul>
              </div>
              <div>
                <p className="text-xs text-orange-500 uppercase tracking-wider mb-3 font-bold">Esfera Judicial</p>
                <ul className="space-y-1.5 text-gray-400">
                  <li>• Exclusão ISS da base PIS/COFINS</li>
                  <li>• Exclusão PIS/COFINS de suas próprias bases</li>
                  <li>• Aproveitamento de créditos ICMS-ST</li>
                  <li>• Exclusão PIS/COFINS da base ICMS</li>
                  <li>• Subvenções para investimento</li>
                  <li>• Manutenção de benefícios fiscais</li>
                </ul>
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-8 italic border-l-2 border-emerald-500 pl-4">
              Clientes referência incluem grandes operações de varejo nacional. A Consultri é uma das poucas
              consultorias do Brasil que entrega projeto fim-a-fim, do diagnóstico até a homologação.
            </p>
          </div>
        </Slide>

        {/* Slide 2 — O desafio */}
        <Slide active={current === 2} id="desafio">
          <SlideHeader num="02" title="O desafio de escalar" subtitle="Como dobrar resultado sem dobrar o time?" />
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-red-950/40 to-gray-900 border border-red-900/40 rounded-2xl p-8">
              <p className="text-xs text-red-400 uppercase tracking-wider font-bold mb-4">Modelo Atual (Tradicional)</p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex gap-3"><span className="text-red-400">○</span> Cada projeto exige consultor dedicado por semanas</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Coleta manual de SPED, planilhas, conferência</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Tempo médio de diagnóstico: 15-45 dias</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Auditoria de qualidade depende de revisão humana</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Atualização de jurisprudência é manual</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Escala = contratação de mais consultores</li>
                <li className="flex gap-3"><span className="text-red-400">○</span> Compliance contínuo é inviável operacionalmente</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-950/40 to-gray-900 border border-emerald-900/40 rounded-2xl p-8">
              <p className="text-xs text-emerald-400 uppercase tracking-wider font-bold mb-4">Modelo com TaxCredit</p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Plataforma faz a triagem em minutos</li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Upload de SPED com parser nativo (registro a registro)</li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Diagnóstico completo em <span className="text-emerald-300 font-bold">menos de 3 minutos</span></li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Memória de cálculo transparente e auditável</li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Base de teses atualizável <span className="text-emerald-300 font-bold">sem deploy</span></li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Escala = mais uso da plataforma (sem novos consultores)</li>
                <li className="flex gap-3"><span className="text-emerald-400">●</span> Compliance contínuo vira receita recorrente</li>
              </ul>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">
              <span className="text-emerald-400 font-bold">Premissa:</span> A TaxCredit não substitui consultor.
              Ela multiplica a capacidade de cada um por <span className="text-emerald-300 font-bold">10x a 50x</span>.
            </p>
          </div>
        </Slide>

        {/* Slide 3 — Dois produtos */}
        <Slide active={current === 3} id="solucao">
          <SlideHeader num="03" title="Dois produtos integrados" subtitle="O passado e o presente da empresa-cliente" />
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-emerald-950/80 to-emerald-900/30 border border-emerald-700/40 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Produto 1 · Passado</p>
                  <h3 className="text-2xl font-bold">Recuperação 5 Anos</h3>
                </div>
              </div>
              <p className="text-gray-300 mb-4">
                Análise retroativa de 60 meses de escrituração fiscal e contábil para identificar todos os créditos
                tributários pagos a maior nos últimos 5 anos.
              </p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>✓ 4 escriturações: EFD ICMS/IPI, EFD Contribuições, ECF, ECD</li>
                <li>✓ 7 tributos: ICMS, PIS, COFINS, IRPJ, CSLL, IPI, INSS</li>
                <li>✓ 34 teses tributárias auditadas (STF, STJ, CARF)</li>
                <li>✓ Documentação completa pra protocolo (PER/DCOMP, parecer, petição)</li>
              </ul>
              <div className="mt-6 p-4 bg-emerald-500/10 rounded-xl">
                <p className="text-emerald-400 text-xs font-bold uppercase">Recuperação típica</p>
                <p className="text-3xl font-black mt-1">3% a 5%</p>
                <p className="text-gray-500 text-xs">do total pago em impostos nos últimos 5 anos</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-950/80 to-orange-900/30 border border-orange-700/40 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <p className="text-xs text-orange-400 uppercase font-bold tracking-wider">Produto 2 · Presente</p>
                  <h3 className="text-2xl font-bold">Compliance em Tempo Real</h3>
                </div>
              </div>
              <p className="text-gray-300 mb-4">
                Monitoramento contínuo das escriturações mensais. A plataforma analisa cada SPED e gera alertas
                de pagamento indevido <span className="text-orange-400 font-bold">antes do recolhimento</span>.
              </p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>✓ Análise mensal automática de SPEDs novos</li>
                <li>✓ Alertas por severidade (crítico, warning, info)</li>
                <li>✓ Parecer técnico e base legal em cada alerta</li>
                <li>✓ Dashboard com economia comprovada em tempo real</li>
              </ul>
              <div className="mt-6 p-4 bg-orange-500/10 rounded-xl">
                <p className="text-orange-400 text-xs font-bold uppercase">Economia mensal típica</p>
                <p className="text-3xl font-black mt-1">R$ 80K — R$ 500K</p>
                <p className="text-gray-500 text-xs">por empresa monitorada (varia por porte e setor)</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-center text-gray-400 text-sm">
              <span className="text-emerald-400 font-bold">Passado + Presente.</span> O cliente recupera o que pagou
              indevidamente nos últimos 5 anos <span className="text-orange-400 font-bold">e nunca mais paga a mais</span>{' '}
              a partir de hoje.
            </p>
          </div>
        </Slide>

        {/* Slide 4 — P1 Overview */}
        <Slide active={current === 4} id="p1-overview">
          <SlideHeader num="04" title="Produto 1 — Recuperação 5 Anos" subtitle="A engenharia por trás do diagnóstico retroativo" />
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Feature title="4 Escriturações nativas" desc="Parser próprio para EFD ICMS/IPI, EFD Contribuições, ECF e ECD. Leitura registro por registro com precisão de centavos." />
            <Feature title="Análise via IA Claude" desc="Modelo de última geração analisa cada registro, cruza dados contábeis com fiscais e identifica oportunidades em segundos." />
            <Feature title="34 Teses + Jurisprudência" desc="Base de conhecimento STF, STJ e CARF. Cada oportunidade vem com acórdão real, tema vinculante e fundamentação completa." />
            <Feature title="Cruzamento contábil ECD" desc="Análise conta por conta da ECD para identificar insumos sob o conceito amplo do STJ (Tema 779)." />
            <Feature title="OCR para PDFs digitalizados" desc="Tesseract.js + OCR Space para escrituração antiga digitalizada. Suporte a PDFs de até 30 páginas." />
            <Feature title="Documentação automatizada" desc="Gera memória de cálculo, planilha de apuração, parecer técnico e petição administrativa em PDFs prontos pra protocolo." />
            <Feature title="Validação contábil automática" desc="Regras de consistência: somas batem, períodos coerentes, CFOPs válidos, CNPJs válidos." />
            <Feature title="Extração automática de períodos" desc="Identifica ano, mês, trimestre, regime tributário e dados da empresa direto do documento." />
            <Feature title="Processamento em batch" desc="Até 200 arquivos simultâneos. Bull + Redis. 5 workers paralelos. Análise de 5 anos em ~30 min." />
          </div>
          <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-700/30 rounded-xl p-6">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-black text-emerald-400">60 meses</p>
                <p className="text-xs text-gray-500 mt-1">de SPED retroativo analisado</p>
              </div>
              <div>
                <p className="text-3xl font-black text-emerald-400">&lt; 3 min</p>
                <p className="text-xs text-gray-500 mt-1">por análise completa</p>
              </div>
              <div>
                <p className="text-3xl font-black text-emerald-400">99,9%</p>
                <p className="text-xs text-gray-500 mt-1">de precisão (memória rastreável)</p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 5 — Tributos */}
        <Slide active={current === 5} id="p1-tributos">
          <SlideHeader num="05" title="Tributos cobertos" subtitle="7 tributos · 34 teses · jurisprudência atualizada" />
          <div className="space-y-4">
            <TributoRow sigla="ICMS" cor="teal" teses={['Saldo credor acumulado (LC 87/96 art. 25)', 'Ressarcimento ICMS-ST (ADI 2.777 STF)', 'TUSD/TUST energia', 'CIAP ativo imobilizado', 'Crédito extemporâneo', 'Transferência entre filiais (ADC 49)']} />
            <TributoRow sigla="PIS" cor="blue" teses={['Exclusão ICMS da base (Tema 69 STF — RE 574.706)', 'Créditos sobre insumos (Tema 779 STJ)', 'Monofásicos pagos a maior', 'PIS-Importação não aproveitado', 'Receitas financeiras']} />
            <TributoRow sigla="COFINS" cor="indigo" teses={['Exclusão ICMS da base (Tema 69 STF)', 'Créditos sobre insumos (Tema 779 STJ)', 'Monofásicos pagos a maior', 'COFINS-Importação não aproveitado', 'ISS fora da base']} />
            <TributoRow sigla="IRPJ" cor="amber" teses={['Benefícios fiscais ICMS fora da base (LC 160/17)', 'SELIC sobre repetição de indébito', 'PAT — dedução integral', 'Equiparação hospitalar']} />
            <TributoRow sigla="CSLL" cor="orange" teses={['Benefícios fiscais ICMS fora da base (LC 160)', 'SELIC sobre repetição de indébito (Tema 1.079 STF)', 'Equiparação hospitalar para saúde']} />
            <TributoRow sigla="INSS" cor="rose" teses={['Verbas indenizatórias (aviso prévio, terço férias)', 'RAT/FAP incorreto', 'Salário-maternidade (Tema 72 STF)', 'FGTS sobre verbas indenizatórias']} />
            <TributoRow sigla="IPI" cor="violet" teses={['Crédito sobre produtos finais não tributados (STJ unânime)', 'Crédito presumido (exportação)', 'Estorno indevido']} />
          </div>
          <p className="text-xs text-gray-500 mt-6 italic text-center">
            Cada tese tem fundamentação legal explícita, acórdão real, tema vinculante (quando aplicável) e
            probabilidade ajustada por jurisprudência mais recente do tribunal competente.
          </p>
        </Slide>

        {/* Slide 6 — Fluxo */}
        <Slide active={current === 6} id="p1-fluxo">
          <SlideHeader num="06" title="Fluxo operacional" subtitle="Da escrituração ao protocolo, sem intervenção manual" />
          <div className="space-y-4">
            {[
              { etapa: '1', titulo: 'Upload do SPED', desc: 'Consultor sobe arquivos direto do ERP do cliente. Aceita ZIP, individual, ou conexão direta via webhook (Omie, SAP, Oracle, TOTVS).', tempo: '~30 seg', color: 'emerald' },
              { etapa: '2', titulo: 'Parser nativo SPED', desc: 'Leitura registro por registro. C170 (PIS/COFINS por item), C120 (importação), E110 (apuração ICMS), E520 (apuração PIS/COFINS), I150-I355 (plano de contas ECD).', tempo: '~5 seg', color: 'blue' },
              { etapa: '3', titulo: 'Cruzamento + IA Claude', desc: 'IA cruza dados fiscais com contábeis, aplica 34 teses tributárias, ajusta probabilidade por jurisprudência vinculante.', tempo: '~60 seg', color: 'purple' },
              { etapa: '4', titulo: 'Memória de cálculo', desc: 'Cada R$ 1,00 de crédito identificado é rastreável até a linha do SPED original. Memória de cálculo blindada para auditoria.', tempo: 'instantâneo', color: 'orange' },
              { etapa: '5', titulo: 'Documentação completa', desc: 'Geração automática de parecer técnico (PDF), memória (PDF), planilha de apuração (Excel), petição administrativa, declaração de não utilização prévia.', tempo: '~15 seg', color: 'rose' },
              { etapa: '6', titulo: 'Protocolo PER/DCOMP', desc: 'Documentos prontos para protocolo na Receita Federal (PER/DCOMP) e SEFAZ estadual. Cliente apenas assina e envia.', tempo: 'manual', color: 'pink' },
            ].map((s) => (
              <div key={s.etapa} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-5">
                <div className={`w-12 h-12 rounded-xl bg-${s.color}-500/20 border border-${s.color}-500/30 flex items-center justify-center text-${s.color}-400 font-black text-xl shrink-0`}>
                  {s.etapa}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-lg">{s.titulo}</h4>
                    <span className="text-xs text-gray-500 font-mono">{s.tempo}</span>
                  </div>
                  <p className="text-sm text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* Slide 7 — Cruzamento Contábil ECD */}
        <Slide active={current === 7} id="p1-cruzamento">
          <SlideHeader num="07" title="Cruzamento Contábil ECD" subtitle="Análise conta por conta — conceito amplo de insumo (STJ Tema 779)" />
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
            <p className="text-gray-300 mb-6 leading-relaxed">
              Diferente dos concorrentes que olham só o SPED Fiscal, a TaxCredit lê o{' '}
              <span className="text-emerald-400 font-bold">plano de contas completo da ECD</span> e classifica cada
              conta de despesa/custo aplicando o conceito amplo de insumo definido pelo STJ no julgamento do{' '}
              <span className="text-emerald-400 font-bold">REsp 1.221.170 (Tema 779)</span>.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-5">
                <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-3">Elegíveis (créditos identificados)</p>
                <p className="text-xs text-gray-400 mb-3">A plataforma classifica como insumo:</p>
                <div className="text-xs text-gray-300 space-y-1 columns-2">
                  <p>• Energia elétrica</p>
                  <p>• Água e saneamento</p>
                  <p>• Telecomunicações</p>
                  <p>• Aluguel / locação</p>
                  <p>• Frete e transporte</p>
                  <p>• Manutenção e reparos</p>
                  <p>• Seguros</p>
                  <p>• Embalagens</p>
                  <p>• Matéria-prima</p>
                  <p>• Serviços de consultoria</p>
                  <p>• Publicidade e marketing</p>
                  <p>• Limpeza e zeladoria</p>
                  <p>• Materiais de escritório</p>
                  <p>• Uniformes e EPI</p>
                  <p>• Comissões comerciais</p>
                  <p>• Software e licenças</p>
                  <p>• Vigilância</p>
                  <p>• Capacitação e treinamento</p>
                </div>
              </div>
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5">
                <p className="text-xs text-red-400 uppercase font-bold tracking-wider mb-3">Excluídas (não geram crédito)</p>
                <p className="text-xs text-gray-400 mb-3">A plataforma exclui automaticamente:</p>
                <div className="text-xs text-gray-300 space-y-1 columns-2">
                  <p>• Depreciação</p>
                  <p>• Provisões</p>
                  <p>• Impostos</p>
                  <p>• Multas</p>
                  <p>• Folha de pagamento</p>
                  <p>• Encargos sociais</p>
                  <p>• Doações</p>
                  <p>• Receitas e vendas</p>
                  <p>• Ativos e investimentos</p>
                  <p>• Dividendos</p>
                  <p>• Perdas e baixas</p>
                  <p>• 13º salário e férias</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-emerald-700/30 rounded-xl p-6">
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="text-emerald-400 font-bold">Resultado prático:</span> Para uma empresa do Lucro Real
              com R$ 50M de despesas operacionais anuais elegíveis, a recuperação de PIS/COFINS no conceito amplo
              pode chegar a <span className="text-emerald-300 font-bold">R$ 4,6 milhões/ano</span> (9,25% × despesas)
              — valores que <span className="text-emerald-300 font-bold">passam despercebidos</span> em análises só
              do SPED Fiscal.
            </p>
          </div>
        </Slide>

        {/* Slide 8 — Documentação */}
        <Slide active={current === 8} id="p1-docs">
          <SlideHeader num="08" title="Documentação automatizada" subtitle="Cada análise vira um dossiê pronto para protocolo" />
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <DocCard
              titulo="Memória de Cálculo (PDF)"
              desc="Cada R$ 1,00 de crédito identificado é rastreável até a linha do SPED original. Lista completa de operações, CFOPs, valores base, alíquotas aplicadas, valores recuperáveis. Blindada para auditoria fiscal."
              icon="📄"
            />
            <DocCard
              titulo="Planilha de Apuração (Excel)"
              desc="Apuração mensal por tributo, com agrupamento por período, ano e grupo (combustíveis, bebidas, etc). Formato XLSX exportável para sistema contábil."
              icon="📊"
            />
            <DocCard
              titulo="Parecer Técnico (PDF)"
              desc="Gerado por IA Claude com fundamentação legal completa, citação de jurisprudência (acórdãos do STF/STJ/CARF), análise de riscos e probabilidade. Pode ser revisado pelo time jurídico antes do envio."
              icon="⚖️"
            />
            <DocCard
              titulo="Petição Administrativa (PDF)"
              desc="Modelo de petição com pedido formalizado, fundamentação, valor pleiteado e identificação completa do contribuinte. Pronta para protocolo no e-CAC."
              icon="📋"
            />
            <DocCard
              titulo="PER/DCOMP"
              desc="Pedido Eletrônico de Restituição / Declaração de Compensação. Documentos no formato exigido pela Receita Federal."
              icon="🏛️"
            />
            <DocCard
              titulo="Checklist de Validação"
              desc="Lista automatizada de documentos faltantes, validações contábeis e ações pendentes antes do protocolo. Reduz o risco de devolução por inconformidade."
              icon="✅"
            />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <p className="text-sm text-gray-400">
              <span className="text-emerald-400 font-bold">Tudo gerado em paralelo em ~15 segundos.</span> Pacote
              completo é baixado como ZIP, com cada documento marcado d&apos;água invisível (rastreável a quem
              gerou — proteção contra vazamento).
            </p>
          </div>
        </Slide>

        {/* Slide 9 — Compliance RT */}
        <Slide active={current === 9} id="p2-overview">
          <SlideHeader num="09" title="Produto 2 — Compliance em Tempo Real" subtitle="Da auditoria pontual à inteligência fiscal contínua" />
          <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-700/40 rounded-2xl p-8 mb-6">
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              O modelo tradicional de recuperação tributária olha pro <span className="text-orange-400">passado</span>:
              identifica o que foi pago a maior e busca devolução. Mas a empresa continua pagando indevido todo mês.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              O <span className="text-orange-400 font-bold">Compliance em Tempo Real</span> resolve isso. A plataforma
              monitora as escriturações mensais e alerta sobre pagamentos indevidos{' '}
              <span className="text-orange-300 font-bold">antes que aconteçam</span> — economia direta no caixa do
              cliente, mês a mês.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Stat label="Upload mensal" value="SPED" sub="EFD-ICMS, EFD-Contrib, ECF, ECD" color="orange" />
            <Stat label="Análise em" value="< 1 min" sub="por arquivo enviado" color="orange" />
            <Stat label="Economia comprovada" value="dashboard" sub="acumulada em tempo real" color="orange" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <p className="text-xs text-orange-500 uppercase font-bold tracking-wider mb-3">Como funciona</p>
              <ol className="space-y-2 text-sm text-gray-300">
                <li><span className="text-orange-400 font-bold">1.</span> Cliente cadastra CNPJ pra monitoramento</li>
                <li><span className="text-orange-400 font-bold">2.</span> Configura upload automático ou manual</li>
                <li><span className="text-orange-400 font-bold">3.</span> Cada SPED é analisado em segundos</li>
                <li><span className="text-orange-400 font-bold">4.</span> Plataforma gera alertas por severidade</li>
                <li><span className="text-orange-400 font-bold">5.</span> Cliente vê economia mensal no dashboard</li>
                <li><span className="text-orange-400 font-bold">6.</span> Relatório mensal de economia acumulada</li>
              </ol>
            </Card>
            <Card>
              <p className="text-xs text-orange-500 uppercase font-bold tracking-wider mb-3">Vantagens estratégicas</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>✓ <span className="text-orange-300 font-bold">Receita recorrente</span> pra Consultri</li>
                <li>✓ Cliente paga por valor entregue, não por horas</li>
                <li>✓ Economia é <span className="text-orange-300 font-bold">comprovada na plataforma</span></li>
                <li>✓ Lock-in natural: quanto mais usa, mais valor gera</li>
                <li>✓ Auditabilidade total (cliente vê e valida)</li>
                <li>✓ Posicionamento de inovação no mercado</li>
              </ul>
            </Card>
          </div>
        </Slide>

        {/* Slide 10 — Alertas */}
        <Slide active={current === 10} id="p2-alertas">
          <SlideHeader num="10" title="Alertas automáticos" subtitle="Cada SPED gera alertas categorizados, com parecer e base legal" />
          <div className="space-y-3">
            {[
              { sev: 'critical', cor: 'red', tributo: 'PIS/COFINS', titulo: 'Créditos sobre entradas não aproveitados', base: 'Lei 10.637/02 art. 3° | Lei 10.833/03 art. 3° | STJ Tema 779', desc: 'Empresa do Lucro Real com entradas sem registro de PIS/COFINS. Plataforma calcula crédito não aproveitado por CFOP e recomenda retificação da EFD-Contribuições.' },
              { sev: 'warning', cor: 'amber', tributo: 'ICMS', titulo: 'Saldo credor acumulado não aproveitado', base: 'LC 87/96 art. 25 | RICMS estadual', desc: 'Ativo tributário parado. Plataforma identifica saldo credor e recomenda transferência a terceiros ou ressarcimento junto à SEFAZ-UF.' },
              { sev: 'warning', cor: 'amber', tributo: 'PIS/COFINS', titulo: 'Tema 69 STF — exclusão ICMS da base', base: 'RE 574.706 STF (Tema 69) — repercussão geral', desc: 'Cálculo automático da economia mensal pela exclusão do ICMS destacado da base de PIS/COFINS. Alerta gerado se a exclusão ainda não está sendo aplicada.' },
              { sev: 'info', cor: 'blue', tributo: 'ICMS-ST', titulo: 'Ressarcimento da diferença de ICMS-ST', base: 'LC 87/96 art. 10 | ADI 2.777 STF | Portaria CAT (SP)', desc: 'Operações com CFOP 1403/2403 detectadas. Plataforma sinaliza se base de cálculo presumida está superior à efetiva, gerando direito a ressarcimento.' },
              { sev: 'critical', cor: 'red', tributo: 'INSS', titulo: 'Verbas indenizatórias na folha', base: 'STF Tema 985 | STJ REsp 1.230.957', desc: 'Análise da folha identifica verbas indenizatórias (aviso prévio, terço de férias, salário-maternidade) com INSS recolhido indevidamente.' },
              { sev: 'warning', cor: 'amber', tributo: 'IRPJ/CSLL', titulo: 'Subvenções para investimento na base', base: 'LC 160/17 | STJ Tema 1.182', desc: 'Benefícios fiscais de ICMS sendo tributados na base IRPJ/CSLL — possível exclusão conforme LC 160/2017.' },
              { sev: 'info', cor: 'blue', tributo: 'PIS/COFINS', titulo: 'Receitas financeiras com alíquota errada', base: 'Decreto 8.426/15', desc: 'Receitas financeiras tributadas a 4,65% (alíquotas integrais) quando o regime de origem permitiria alíquota reduzida.' },
              { sev: 'critical', cor: 'red', tributo: 'PIS/COFINS', titulo: 'Monofásicos pagos a maior', base: 'Lei 10.147/2000 | LC 123/2006 art. 18 §4°-A (Simples)', desc: 'Produtos monofásicos (combustíveis, bebidas, farmacêuticos, cosméticos, autopeças) com PIS/COFINS pagos no DAS — quando deveriam ser zero.' },
            ].map((a, i) => (
              <div key={i} className={`bg-gray-900 border-l-4 border-${a.cor}-500 border-y border-r border-gray-800 rounded-r-xl p-4`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-${a.cor}-500/20 text-${a.cor}-400 border border-${a.cor}-500/30`}>{a.sev}</span>
                    <span className="text-xs font-bold text-gray-400">{a.tributo}</span>
                  </div>
                </div>
                <p className="font-bold text-white mb-1">{a.titulo}</p>
                <p className="text-xs text-gray-400 mb-2">{a.desc}</p>
                <p className="text-xs text-gray-500 italic font-mono">{a.base}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-6 text-center italic">
            A plataforma mantém biblioteca de alertas em expansão. Cada novo julgamento STF/STJ pode gerar novo
            alerta sem necessidade de deploy — atualização via painel administrativo.
          </p>
        </Slide>

        {/* Slide 11 — Simples Nacional */}
        <Slide active={current === 11} id="p3-simples">
          <SlideHeader num="11" title="Produto 3 — Simples Nacional Recovery" subtitle="Recuperação de PIS/COFINS monofásicos e ICMS-ST no Simples" />
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
            <p className="text-gray-300 leading-relaxed mb-4">
              Empresas do Simples Nacional <span className="text-emerald-400 font-bold">não devem recolher</span>{' '}
              PIS, COFINS e ICMS sobre produtos monofásicos ou já tributados por substituição tributária. Mas a
              imensa maioria recolhe — porque o DAS não diferencia automaticamente.
            </p>
            <p className="text-gray-300 leading-relaxed">
              A TaxCredit identifica esses valores <span className="text-emerald-400 font-bold">a partir das
              NFes</span> da empresa, calcula com precisão de centavo e gera o dossiê completo de recuperação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-4">Cobertura técnica</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>✓ <span className="font-bold">36+ NCMs monofásicos</span> mapeados em 7 grupos</li>
                <li>✓ Detecção automática de CSOSN 500/201/202/203 (ICMS-ST)</li>
                <li>✓ 6 faixas do Anexo I do Simples (alíquotas embutidas)</li>
                <li>✓ Parser nativo de NFe XML (e ZIP em lote, 50 NFes)</li>
                <li>✓ Base legal específica em cada item identificado</li>
                <li>✓ Agrupamento por grupo de produto e por competência</li>
              </ul>
            </Card>
            <Card>
              <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-4">Grupos de produtos</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <p>• Combustíveis (4 NCMs)</p>
                <p>• Veículos (5 NCMs)</p>
                <p>• Autopeças (8 NCMs)</p>
                <p>• Bebidas (8 NCMs)</p>
                <p>• Farmacêuticos (6 NCMs)</p>
                <p>• Cosméticos (7 NCMs)</p>
                <p>• Máquinas agrícolas (6 NCMs)</p>
                <p>• ICMS-ST (qualquer CSOSN)</p>
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">
                Tabela em expansão contínua conforme novas decisões e novos NCMs entram no regime monofásico.
              </p>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-emerald-900/20 to-orange-900/20 border border-emerald-700/30 rounded-xl p-5">
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-2">Base legal PIS/COFINS monofásico</p>
                <p className="text-gray-300 italic">
                  Lei 10.147/2000, Art. 2° — concentração na indústria.<br/>
                  LC 123/2006, Art. 18, §4°-A, I — exclusão do DAS.
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-2">Base legal ICMS-ST</p>
                <p className="text-gray-300 italic">
                  LC 123/2006, Art. 18, §4°-A, IV — ICMS já recolhido por substituição não entra no DAS.
                </p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 12 — Integrações ERP */}
        <Slide active={current === 12} id="erp">
          <SlideHeader num="12" title="Integrações com ERPs" subtitle="Onde os dados nascem, a TaxCredit conecta" />
          <p className="text-gray-400 mb-8 max-w-3xl">
            A plataforma se conecta diretamente aos ERPs do cliente, eliminando completamente o processo manual
            de coleta de SPEDs e NFes. Suporte a webhook para qualquer ERP que envie dados via API.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <ErpCard nome="Omie" desc="Conector nativo. Sincronização automática de NFes emitidas e recebidas. Captura de SPEDs gerados." status="Pronto" />
            <ErpCard nome="SAP" desc="Webhook + ApiKey customizada. Suporta SAP Business One e S/4HANA. Sincronização por job agendado." status="Pronto" />
            <ErpCard nome="Oracle" desc="Conector via REST API. Suporte a Oracle Cloud ERP e EBS. Autenticação OAuth 2.0." status="Pronto" />
            <ErpCard nome="TOTVS" desc="Webhook nativo. Compatível com Protheus, RM e Datasul. Documentação técnica completa." status="Pronto" />
            <ErpCard nome="Conta Azul" desc="Integração para empresas do Simples Nacional. Sincronização de NFes via API REST." status="Pronto" />
            <ErpCard nome="Webhook genérico" desc="Qualquer ERP que aceite POST HTTP. Documentação OpenAPI. Suporte JSON e XML." status="Pronto" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-4">Segurança nas integrações</p>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-300">
              <div>
                <p className="font-bold text-white mb-1">ApiKeys com escopo</p>
                <p className="text-gray-400 text-xs">Chaves específicas por integração. Permissões granulares (upload, read, sync).</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Rate limit dedicado</p>
                <p className="text-gray-400 text-xs">60 req/min por chave. Configurável. Bloqueio automático em caso de abuso.</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Logs auditáveis</p>
                <p className="text-gray-400 text-xs">Cada evento registrado com payload, status, tempo de processamento e erro (se houver).</p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 13 — SERPRO */}
        <Slide active={current === 13} id="serpro">
          <SlideHeader num="13" title="SERPRO / Integra Contador" subtitle="Conexão oficial com a Receita Federal" />
          <div className="bg-gradient-to-br from-blue-950/40 to-gray-900 border border-blue-800/40 rounded-2xl p-8 mb-6">
            <p className="text-gray-300 leading-relaxed mb-4">
              Diferente de soluções que dependem de raspagem (scraping) do portal e-CAC — uma prática que está
              sendo cada vez mais bloqueada pela Receita — a TaxCredit usa o{' '}
              <span className="text-blue-400 font-bold">canal oficial Integra Contador do SERPRO</span>.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Isso significa <span className="text-blue-400 font-bold">acesso oficial</span> aos dados do
              contribuinte, com procurações digitais válidas, certificado A1/A3 e auditabilidade completa.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-4">Serviços disponíveis</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>✓ Consulta DCTF Web</li>
                <li>✓ Situação fiscal completa</li>
                <li>✓ Histórico de PER/DCOMP</li>
                <li>✓ Restituições em andamento</li>
                <li>✓ Parcelamentos ativos</li>
                <li>✓ Pendências e malhas</li>
                <li>✓ Consulta CNPJ completo</li>
                <li>✓ Análise de domicílio tributário</li>
              </ul>
            </Card>
            <Card>
              <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-4">Infraestrutura técnica</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>✓ OAuth 2.0 com consumer key/secret</li>
                <li>✓ Certificado digital A1/A3 (PFX/PEM)</li>
                <li>✓ Ambiente trial + produção</li>
                <li>✓ Procuração e-CAC integrada</li>
                <li>✓ Logs auditáveis por serviço/endpoint</li>
                <li>✓ Retry automático com backoff</li>
                <li>✓ Renovação automática de tokens</li>
                <li>✓ Conformidade LGPD</li>
              </ul>
            </Card>
          </div>
        </Slide>

        {/* Slide 14 — Procurações */}
        <Slide active={current === 14} id="procuracoes">
          <SlideHeader num="14" title="Procurações Digitais" subtitle="Geração, assinatura e gestão integrada" />
          <p className="text-gray-400 mb-8 max-w-3xl">
            Cada projeto de recuperação tributária exige procurações para acessar e-CAC, SEFAZ e protocolar
            documentos. A TaxCredit gera e gerencia procurações em três cenários distintos.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Card>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <p className="font-bold text-lg mb-2">Cenário 1 · Atom Lawyer</p>
              <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-3">Advogado da TaxCredit</p>
              <p className="text-sm text-gray-400">
                Quando o cliente não tem advogado e prefere usar o advogado tributarista vinculado à plataforma.
                Procuração gerada para advogado interno com OAB cadastrada.
              </p>
            </Card>
            <Card>
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <p className="font-bold text-lg mb-2">Cenário 2 · Partner Lawyer</p>
              <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-3">Advogado da Consultri</p>
              <p className="text-sm text-gray-400">
                Quando o parceiro (Consultri) tem advogado próprio que vai conduzir o protocolo. Procuração com
                OAB do advogado parceiro, vinculação no contrato tripartite.
              </p>
            </Card>
            <Card>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">👤</span>
              </div>
              <p className="font-bold text-lg mb-2">Cenário 3 · Client Lawyer</p>
              <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-3">Advogado do cliente</p>
              <p className="text-sm text-gray-400">
                Quando o próprio cliente já tem departamento jurídico ou escritório de confiança. Procuração
                personalizada com dados do advogado escolhido pelo cliente.
              </p>
            </Card>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-3">Tipos suportados</p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div><p className="font-bold text-white">Particular</p><p className="text-gray-500 text-xs">Procuração ad judicia para representação geral</p></div>
              <div><p className="font-bold text-white">e-CAC Guide</p><p className="text-gray-500 text-xs">Habilitação no e-CAC com poderes específicos</p></div>
              <div><p className="font-bold text-white">SEFAZ</p><p className="text-gray-500 text-xs">Procuração estadual para protocolo em SEFAZ-UF</p></div>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic">
              Prazo padrão 2 anos. Renovação automatizada. Assinatura digital com captura de IP, data e hora.
            </p>
          </div>
        </Slide>

        {/* Slide 14b — Procuração CONSULTRI Automatizada */}
        <Slide active={current === 15} id="consultri-procuracao">
          <SlideHeader
            num="14b"
            title="Procuração CONSULTRI — de 45 min para 1 clique"
            subtitle="Preset oficial conforme PDF MOT-CONSULTRI JUN2025"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            Estudamos o passo a passo oficial enviado pelo Tadeu e transformamos os 8 passos manuais
            (com 45 caixinhas a marcar no CAV, assinador SERPRO em .jnlp e Java desatualizado) em um
            fluxo guiado dentro da plataforma. O cliente final continua autorizando via certificado
            digital — mas com checklist, vídeo e suporte 1:1.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-red-400 mb-3">Antes (hoje)</p>
              <ul className="text-sm space-y-2 text-gray-300">
                <li>✗ Cliente recebe PDF de 6 páginas por e-mail</li>
                <li>✗ Marca 45 caixinhas manualmente (alta taxa de erro)</li>
                <li>✗ Baixa .jnlp, atualiza Java, executa assinador</li>
                <li>✗ Liga pro escritório quando trava</li>
                <li>✗ CONSULTRI não sabe em qual passo o cliente está</li>
                <li>✗ Não há aviso quando a procuração vence</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">
                Tempo médio: 30-60 min por cliente · suporte humano em ~60% dos casos
              </p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-3">
                Depois (TaxCredit + CONSULTRI)
              </p>
              <ul className="text-sm space-y-2 text-gray-300">
                <li>✓ Link único enviado por WhatsApp/e-mail</li>
                <li>✓ Wizard guiado dentro da plataforma, com vídeo por passo</li>
                <li>✓ Preset CONSULTRI (CNPJ 27.591.029/0001-41 + 45 poderes) já pré-marcado</li>
                <li>✓ Verificação automática via SERPRO Integra Contador (OBTERPROCURACAO41)</li>
                <li>✓ Painel mostra status em tempo real para o escritório</li>
                <li>✓ Alerta 60/30/7 dias antes do vencimento, com botão "renovar"</li>
              </ul>
              <p className="text-xs text-emerald-400/80 mt-4 italic font-bold">
                Tempo médio: 5-10 min · suporte humano cai pra ~10%
              </p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-xs uppercase tracking-wider font-bold text-sky-400 mb-3">
              O que já está rodando no código
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-bold text-white mb-1">Backend</p>
                <p className="text-gray-400">
                  Preset oficial CONSULTRI com os 45 poderes do PDF JUN2025 em
                  <code className="text-emerald-400 font-mono"> procuration.service.ts</code>
                </p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Endpoints</p>
                <p className="text-gray-400">
                  <code className="text-emerald-400 font-mono">/api/procuration/presets</code>,
                  <code className="text-emerald-400 font-mono"> /generate-preset</code> e
                  <code className="text-emerald-400 font-mono"> /:id/check-serpro</code>
                </p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Verificação SERPRO</p>
                <p className="text-gray-400">
                  Diff automático entre poderes outorgados (OBTERPROCURACAO41) e os 45 requeridos —
                  mostra qual ficou faltando.
                </p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 14c — Painel de Carteira */}
        <Slide active={current === 16} id="consultri-carteira">
          <SlideHeader
            num="14c"
            title="Painel de Carteira — visão do escritório CONSULTRI"
            subtitle="Centenas de procurações geridas em uma tela"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            A CONSULTRI opera dezenas/centenas de clientes simultaneamente. O painel
            <code className="text-emerald-400 font-mono"> /consultri/carteira </code>
            entrega uma visão única: quem está ativo, quem está aguardando outorga, quem precisa
            renovar nos próximos 30 dias e quem deixou poderes faltando.
          </p>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <MiniStat label="Total na carteira" value="N" tone="white" />
            <MiniStat label="Ativas" value="N" tone="emerald" />
            <MiniStat label="Vencendo ≤30d" value="N" tone="yellow" />
            <MiniStat label="Aguardando outorga" value="N" tone="sky" />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-4">
              Colunas do painel
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-300">
              <div>• Cliente outorgante (razão + CNPJ)</div>
              <div>• Status SERPRO (ativa / parcial / não encontrada)</div>
              <div>• Vigência + dias restantes (cor por urgência)</div>
              <div>• Última verificação automática SERPRO</div>
              <div>• Botão "Verificar SERPRO agora"</div>
              <div>• Botão "Detalhes" → checklist 45 poderes</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/30 rounded-2xl p-6">
            <p className="text-sm text-gray-200 leading-relaxed">
              <strong className="text-emerald-300">Próxima onda:</strong> job de polling automático
              roda OBTERPROCURACAO41 em todas as procurações <em>pending_serpro</em> a cada 15
              minutos, dispara WhatsApp pro responsável CONSULTRI assim que cliente assina e ativa
              coleta automática de Caixa Postal, DCTFWeb, Situação Fiscal e SPED.
            </p>
          </div>
        </Slide>

        {/* Slide 14d — Convite Magico */}
        <Slide active={current === 17} id="consultri-convite">
          <SlideHeader
            num="14d"
            title="Convite magico — onboarding do cliente em minutos"
            subtitle="Link unico, passo a passo guiado, zero login"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            Para acelerar a outorga, a Consultri envia um link unico (token de 192 bits) por e-mail
            ou WhatsApp. O cliente final acessa uma landing limpa com o checklist dos 45 poderes,
            CNPJ do procurador pronto pra copiar, dicas do assinador SERPRO e botao "Concluido!"
            que dispara a verificacao automatica.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <p className="text-xs uppercase tracking-wider font-bold text-purple-400 mb-2">1. Geracao</p>
              <p className="text-sm text-gray-300">
                Operador da Consultri clica em "Enviar convite" no painel da carteira.
                Token unico, valido 14 dias.
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider font-bold text-purple-400 mb-2">2. Notificacao</p>
              <p className="text-sm text-gray-300">
                Cliente recebe e-mail + WhatsApp com o link. Notificacoes ficam auditadas em
                <code className="text-emerald-400 font-mono"> Notification</code> (canal, status, retry).
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider font-bold text-purple-400 mb-2">3. Outorga guiada</p>
              <p className="text-sm text-gray-300">
                Cliente acessa <code className="text-emerald-400 font-mono">/outorga/[token]</code>,
                segue 8 passos com progresso visual, copia CNPJ procurador, marca checklist e
                clica "Concluido".
              </p>
            </Card>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">Telemetria automatica</p>
            <div className="grid md:grid-cols-4 gap-3 text-sm">
              <Tag>pending</Tag>
              <Tag>opened (telemetria)</Tag>
              <Tag>acknowledged (cliente)</Tag>
              <Tag color="emerald">completed (SERPRO)</Tag>
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              Cada transicao deixa trilha em <code className="text-emerald-400 font-mono">ProcurationAudit</code> com
              IP, user-agent, payload e ator (cliente_self | cron | user).
            </p>
          </div>
        </Slide>

        {/* Slide 14e — Automacao 24x7 */}
        <Slide active={current === 18} id="consultri-automacao">
          <SlideHeader
            num="14e"
            title="Automacao 24x7 — 3 jobs cuidam da carteira sozinhos"
            subtitle="node-cron + SERPRO Integra Contador + Notification service"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            O scheduler <code className="text-emerald-400 font-mono">consultri-scheduler.service.ts</code> roda
            3 jobs idempotentes no fuso America/Sao_Paulo. Tudo audita no banco e dispara
            notificacoes automaticas (email + WhatsApp) — modo log-only se nao houver credenciais.
          </p>

          <div className="space-y-4 mb-6">
            <JobCard
              cor="sky"
              icone="↻"
              titulo="pollSerpro"
              periodicidade="a cada 15 minutos"
              descricao="Varre procuracoes pending/partial/not_found. Roda OBTERPROCURACAO41 via SERPRO Integra Contador, calcula diff de poderes, atualiza status. Quando vira active: notifica responsavel + marca convite como completed + dispara coleta de Caixa Postal."
            />
            <JobCard
              cor="yellow"
              icone="!"
              titulo="expiryAlerts"
              periodicidade="diario 08:00 BRT"
              descricao="Verifica procuracoes proximas do vencimento. Envia alerta nos marcos 60/30/7 dias antes (email + WhatsApp). Cada envio fica registrado em alert60SentAt/alert30SentAt/alert7SentAt para garantir 1 alerta por marco — zero spam."
            />
            <JobCard
              cor="emerald"
              icone="✓"
              titulo="collectConformidade"
              periodicidade="diario 06:00 BRT"
              descricao="Pra cada procuracao active: coleta Caixa Postal (qtdNovasMensagens) + Situacao Fiscal (pendencias) + DCTFWeb status. Salva snapshot diario + dispara WhatsApp imediato se chegou intimacao nova na Caixa Postal."
            />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">
              Operador da Consultri pode disparar manualmente
            </p>
            <p className="text-sm text-gray-300">
              Pagina <code className="text-emerald-400 font-mono">/consultri/configuracoes</code> tem botoes
              para rodar cada job sob demanda, util pra demos e testes. Resultado JSON aparece em tempo real.
            </p>
          </div>
        </Slide>

        {/* Slide 14f — Conformidade da Carteira */}
        <Slide active={current === 19} id="consultri-conformidade">
          <SlideHeader
            num="14f"
            title="Conformidade da Carteira — risco em tempo real"
            subtitle="Score 0-100 + ranking de inadimplencia + filtros"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            A coleta diaria alimenta um dashboard <code className="text-emerald-400 font-mono">/consultri/conformidade</code> que
            transforma dados crus do e-CAC em <strong className="text-white">score por cliente</strong>: cada nova
            mensagem da Caixa Postal nao lida tira -5 pontos, cada pendencia fiscal tira -10. A
            Consultri ve quem precisa de atencao agora.
          </p>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <MiniStat label="Clientes monitorados" value="N" tone="white" />
            <MiniStat label="Caixa Postal pendente" value="N" tone="yellow" />
            <MiniStat label="Situacao com pendencia" value="N" tone="orange" />
            <MiniStat label="Score medio" value="N" tone="emerald" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">O que cada cliente exibe</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Score 0-100 com barra de progresso colorida</li>
                <li>• Mensagens novas na Caixa Postal</li>
                <li>• Situacao fiscal (Regular / Pendencias)</li>
                <li>• Atrasos DCTFWeb</li>
                <li>• Timestamp ultima coleta</li>
              </ul>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">Filtros e ordenacao</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• "Risco" (score &lt; 60)</li>
                <li>• "Caixa pendente"</li>
                <li>• "Situacao com pendencia"</li>
                <li>• Ordenar por score / pendencias / data</li>
                <li>• Export CSV com filtros aplicados</li>
              </ul>
            </Card>
          </div>

          <div className="mt-6 bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/30 rounded-2xl p-5 text-sm text-gray-200">
            Resultado pratico pra Consultri: <strong className="text-emerald-300">trocar fogo amigo
            por fogo cruzado</strong>. O operador entra de manha, ve top 10 clientes em risco,
            aciona o consultor responsavel — sem precisar abrir 200 caixas postais uma a uma.
          </div>
        </Slide>

        {/* Slide 14g — Modo Hibrido (Auto + Manual) */}
        <Slide active={current === 20} id="consultri-hibrido">
          <SlideHeader
            num="14g"
            title="Modo Hibrido — outorga automatica quando possivel, guiada sempre"
            subtitle="AUTENTICAPROCURADOR + link magico, com aviso transparente ao operador"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            A plataforma consulta automaticamente o contrato SERPRO para descobrir se o servico
            <code className="text-emerald-400 font-mono"> AUTENTICAPROCURADOR </code>
            esta disponivel. Quando esta, oferece <strong className="text-emerald-300">outorga programatica</strong>
            (sem o cliente abrir o CAV). Quando nao esta, cai automaticamente para o <strong className="text-sky-300">link
            magico guiado</strong>. O operador da Consultri ve sempre as duas opcoes com avisos claros sobre o que
            cada uma faz.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Auto */}
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚡</span>
                <h3 className="font-bold text-emerald-300">Modo Automatico</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-emerald-400/80 font-bold mb-3">
                via SERPRO AUTENTICAPROCURADOR / ENVIOXMLASSINADO81
              </p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Outorga feita programaticamente, sem o cliente abrir o CAV</li>
                <li>✓ Requer XML assinado pelo cert digital do outorgante</li>
                <li>✓ Requer contrato SERPRO da Consultri com AUTENTICAPROCURADOR</li>
                <li>✓ Retorna protocolo SERPRO registrado em <code className="text-emerald-400 font-mono">autoGrantProtocol</code></li>
                <li>✓ Audit log: <code className="text-emerald-400 font-mono">auto_grant_success</code></li>
              </ul>
            </div>

            {/* Manual */}
            <div className="bg-sky-500/5 border border-sky-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔗</span>
                <h3 className="font-bold text-sky-300">Modo Guiado (link magico)</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-sky-400/80 font-bold mb-3">
                fallback universal — sempre funciona
              </p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Cliente recebe link unico por email/WhatsApp</li>
                <li>✓ Wizard guiado com 8 passos e checklist 45 poderes</li>
                <li>✓ Sistema detecta ativacao via OBTERPROCURACAO41 em 15min</li>
                <li>✓ Compativel com qualquer escopo SERPRO</li>
                <li>✓ Audit log: <code className="text-sky-400 font-mono">invite_sent</code> → <code className="text-sky-400 font-mono">acknowledged</code> → <code className="text-emerald-400 font-mono">serpro_active</code></li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-3">
              Bonus de seguranca: detec\u00e7\u00e3o automatica de revogacao
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Se uma procuracao previamente <code className="text-emerald-400">active</code> deixar de retornar
              via SERPRO (cliente revogou no CAV), o job <code className="text-sky-400">pollSerpro</code> identifica
              em ate 15 minutos: marca status <code className="text-red-400">revoked_detected</code>, dispara
              WhatsApp + email pro responsavel CONSULTRI ("ATENCAO: procuracao revogada, contato urgente"), e
              interrompe a coleta automatica de Caixa Postal/SitFis para esse cliente. Zero surpresa contratual.
            </p>
          </div>
        </Slide>

        {/* Slide 14h — Coletas Federais via Procuracao */}
        <Slide active={current === 21} id="consultri-coletas">
          <SlideHeader
            num="14h"
            title="Coletas Federais via Procuracao — 7 servicos em 1 tela"
            subtitle="PER/DCOMP, DCTF, DIRF, Fontes Pagadoras, Parcelamentos e Caixa Postal"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            Uma vez que a procuracao esta ATIVA no SERPRO, a Consultri tem acesso programatico a
            <strong className="text-emerald-300"> 7 servicos federais distintos</strong> em uma
            unica tela (<code className="text-emerald-400 font-mono">/consultri/cliente/[id]/coleta</code>).
            Cada consulta gera log auditavel em <code className="text-sky-400 font-mono">SerproLog</code> com
            response bruto, status, e tempo de execucao.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-5">
              <div className="text-2xl mb-2">💰</div>
              <h4 className="font-bold text-emerald-300 mb-2">PER/DCOMP</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Listar pedidos por periodo</li>
                <li>• Consultar pedido especifico</li>
                <li>• Despacho decisorio</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3 italic">LISTARPERDCOMP22 / CONSPERDCOMP21 / CONSDESPACHO23</p>
            </div>
            <div className="bg-gray-900 border border-sky-500/30 rounded-xl p-5">
              <div className="text-2xl mb-2">📋</div>
              <h4 className="font-bold text-sky-300 mb-2">DCTF + DIRF</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• DCTF por periodo de apuracao</li>
                <li>• DIRF por ano-base</li>
                <li>• Fontes pagadoras (terceiros)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3 italic">CONSDECLARACAO15 / CONSDECLARACAO17</p>
            </div>
            <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5">
              <div className="text-2xl mb-2">📅</div>
              <h4 className="font-bold text-purple-300 mb-2">Parcelamentos + Caixa</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Parcelamento PGFN</li>
                <li>• Parcelamento RFB</li>
                <li>• Caixa Postal — detalhe da msg</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3 italic">PARCELAMENTOS/* + DETALHARMENSAGEM</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-900/30 to-purple-900/30 border border-emerald-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-300 mb-2">Valor para o cliente CONSULTRI</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Sem precisar logar no e-CAC, baixar PDFs ou guardar telas, o operador da Consultri obtem em
              segundos: <strong className="text-white">historico fiscal completo</strong>, situacao de
              parcelamentos em curso, novas mensagens da Caixa Postal e contradicoes entre DIRF
              declarada e fontes pagadoras (perfeito para deteccao de teses tributarias).
              Tudo arquivado, auditavel, com timestamp.
            </p>
          </div>
        </Slide>

        {/* Slide 14i — Metricas Comerciais */}
        <Slide active={current === 22} id="consultri-metricas">
          <SlideHeader
            num="14i"
            title="Metricas Comerciais — KPIs em tempo real da carteira"
            subtitle="Acesse em /consultri/metricas — sem planilha, sem export, ao vivo"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            Toda a operacao gera dados estruturados. A pagina
            <code className="text-purple-400 font-mono"> /consultri/metricas </code>
            consolida os KPIs em tempo real, agregados via endpoint
            <code className="text-emerald-400 font-mono"> /api/consultri/metrics </code>
            que cruza procuracoes, audits, convites, notificacoes e snapshots de conformidade.
          </p>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="text-xs uppercase text-emerald-400 font-bold mb-1">KPI 1</div>
              <div className="text-lg font-bold text-white">Taxa de ativacao</div>
              <p className="text-xs text-gray-400 mt-2">% de procuracoes que viram <code className="text-emerald-300">active</code> no SERPRO</p>
            </div>
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4">
              <div className="text-xs uppercase text-sky-400 font-bold mb-1">KPI 2</div>
              <div className="text-lg font-bold text-white">Tempo medio outorga</div>
              <p className="text-xs text-gray-400 mt-2">Horas entre <code className="text-sky-300">created</code> e <code className="text-emerald-300">serpro_active</code></p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="text-xs uppercase text-purple-400 font-bold mb-1">KPI 3</div>
              <div className="text-lg font-bold text-white">Funil de convites</div>
              <p className="text-xs text-gray-400 mt-2">Enviados → abertos → reconhecidos → concluidos</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <div className="text-xs uppercase text-orange-400 font-bold mb-1">KPI 4</div>
              <div className="text-lg font-bold text-white">Vencendo 30d</div>
              <p className="text-xs text-gray-400 mt-2">Acoes: dispara renovacao preventiva (job 09h BRT)</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-3">Outros indicadores</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• Distribuicao por modo de outorga (auto SERPRO vs guiado)</li>
                <li>• Notificacoes 24h (e-mail vs WhatsApp, sucesso vs falha)</li>
                <li>• Engajamento Caixa Postal (clientes com nova msg hoje)</li>
                <li>• Score medio de conformidade da carteira</li>
                <li>• Funil semanal: criadas vs ativadas (90 dias)</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-sky-900/40 border border-purple-500/30 rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-3">Para o time comercial CONSULTRI</p>
              <p className="text-sm text-gray-200 leading-relaxed">
                Em 1 olhada o gestor sabe: <strong className="text-emerald-300">quantos contratos
                ja deram retorno</strong>, <strong className="text-sky-300">onde esta o gargalo de
                onboarding</strong> e <strong className="text-orange-300">quantos clientes precisam
                de renovacao essa semana</strong>. Reuniao de pipeline com numero, nao com achismo.
              </p>
            </div>
          </div>
        </Slide>

        {/* Slide 14j — Real-time + Detector de Teses + Relatorio PDF */}
        <Slide active={current === 23} id="consultri-realtime">
          <SlideHeader
            num="14j"
            title="Tres super-poderes: webhook real-time, detector de teses, relatorio PDF"
            subtitle="Eventos em tempo real, IA tributaria sobre DIRF x Fontes, entrega ao cliente em 1 clique"
          />
          <div className="grid md:grid-cols-3 gap-5 mb-6">
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-bold text-emerald-300 mb-1">Webhook SERPRO real-time</h3>
              <p className="text-xs uppercase tracking-wider text-emerald-400/80 font-bold mb-3">/api/webhooks/serpro</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Eventos: revogacao, alteracao, expiracao, caixa postal</li>
                <li>✓ HMAC-SHA256 com <code className="text-emerald-400 font-mono">SERPRO_WEBHOOK_SECRET</code></li>
                <li>✓ Dispara re-check imediato (sem esperar poll 15min)</li>
                <li>✓ Audit log automatico: <code className="text-emerald-400 font-mono">webhook_received</code></li>
              </ul>
            </div>
            <div className="bg-sky-500/5 border border-sky-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-2">🔬</div>
              <h3 className="font-bold text-sky-300 mb-1">Detector DIRF x Fontes</h3>
              <p className="text-xs uppercase tracking-wider text-sky-400/80 font-bold mb-3">cross-analysis.service</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Cruza DIRF declarada x Fontes Pagadoras (terceiros)</li>
                <li>✓ Classifica divergencias: critical/high/medium/low</li>
                <li>✓ Score de risco 0-100 com semaforo visual</li>
                <li>✓ Sugere teses: IR retido a maior, omissao, malha preventiva</li>
              </ul>
            </div>
            <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-2">📄</div>
              <h3 className="font-bold text-indigo-300 mb-1">Relatorio PDF consolidado</h3>
              <p className="text-xs uppercase tracking-wider text-indigo-400/80 font-bold mb-3">/api/procurations/:id/report</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ HTML imprimivel (Ctrl+P -&gt; PDF) ou export server-side</li>
                <li>✓ Identificacao + poderes + caixa postal + sitfis</li>
                <li>✓ Inclui analise cruzada DIRF x Fontes do ano-base</li>
                <li>✓ Timeline de auditoria completa em uma pagina</li>
              </ul>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-900/30 via-sky-900/30 to-indigo-900/30 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-2">Impacto comercial</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Os tres juntos fecham o ciclo: <strong className="text-emerald-300">detectar mudancas em segundos</strong> (webhook),
              <strong className="text-sky-300"> achar dinheiro do cliente sem ele pedir</strong> (cross-analysis) e
              <strong className="text-indigo-300"> entregar o resultado em PDF profissional</strong> em 1 clique.
              CONSULTRI deixa de ser servico operacional e vira inteligencia tributaria.
            </p>
          </div>
        </Slide>

        {/* Slide 14k — Multi-procurador */}
        <Slide active={current === 24} id="consultri-multiproc">
          <SlideHeader
            num="14k"
            title="Multi-procurador — uma carteira, varios CNPJs procuradores"
            subtitle="Holding + Filial + Escritorios parceiros operando lado a lado"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            CONSULTRI nao precisa atender 100% dos clientes pelo mesmo CNPJ. A plataforma agora suporta
            <strong className="text-purple-300"> multiplos CNPJs procuradores</strong> simultaneamente, cada um com cor,
            preset de poderes proprio e relatorio segregado. Util para grupos economicos, parcerias estrategicas e
            modelos de franquia.
          </p>
          <div className="grid md:grid-cols-2 gap-5 mb-6">
            <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-3">Casos de uso</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>📦 <b>Holding + Filial</b>: holding atende grandes contas, filial atende SMB</li>
                <li>🤝 <b>Escritorios parceiros</b>: parceiro X opera 50 clientes, parceiro Y opera 30</li>
                <li>🏢 <b>Modelo franquia</b>: cada unidade tem CNPJ proprio, mas usa a mesma plataforma</li>
                <li>⚖️ <b>Compliance segregado</b>: cada procurador ve so a propria carteira</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-emerald-900/40 border border-purple-500/30 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-300 mb-3">Como funciona</p>
              <ol className="text-sm text-gray-200 space-y-2 list-decimal pl-5">
                <li>Cadastre cada CNPJ procurador em <code className="text-emerald-400 font-mono">/consultri/procuradores</code></li>
                <li>Defina preset padrao, cor visual e observacao</li>
                <li>Ao criar procuracao, vincule ao procurador certo</li>
                <li>Carteira/Conformidade/Metricas passam a poder filtrar por procurador</li>
                <li>Soft-delete se houver procuracoes vinculadas (preserva auditoria)</li>
              </ol>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-2">Modelo de dados</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Novo modelo <code className="text-emerald-400 font-mono">ProcuradorEntity</code> 1:N <code className="text-emerald-400 font-mono">Procuration</code>.
              Com indice em <code className="text-sky-400">procuradorEntityId</code> para queries rapidas. Migration idempotente em
              <code className="text-emerald-400 font-mono"> 20260516_consultri_multi_procurador</code>.
            </p>
          </div>
        </Slide>

        {/* Slide 14l — Hub de Notificacoes + Timeline */}
        <Slide active={current === 25} id="consultri-hub-timeline">
          <SlideHeader
            num="14l"
            title="Hub de Notificacoes + Timeline Unificada por Cliente"
            subtitle="Tudo o que aconteceu, em um so lugar, com bell icon em tempo real"
          />
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-purple-500/5 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔔</span>
                <h3 className="font-bold text-purple-300">Hub central de notificacoes</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-purple-400/80 font-bold mb-3">/consultri/notificacoes</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Todas notificacoes disparadas (email, WhatsApp, in-app, webhook)</li>
                <li>✓ Filtros: nao-lidas, criticas, por canal</li>
                <li>✓ Bell icon no header com badge de pendentes (polling 30s)</li>
                <li>✓ Severidade automatica: info / warning / critical</li>
                <li>✓ Deep-link para abrir contexto (procuracao, convite)</li>
                <li>✓ Marca-como-lido individual ou em lote</li>
              </ul>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🗓️</span>
                <h3 className="font-bold text-amber-300">Timeline consolidada por cliente</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-amber-400/80 font-bold mb-3">/consultri/cliente/[id]/timeline</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Cruza: procuracoes, audits, invites, notifs, snapshots</li>
                <li>✓ Visualizacao cronologica unificada com icones</li>
                <li>✓ Cores por severidade (verde/amarelo/vermelho)</li>
                <li>✓ Filtros: Tudo / Criticos / Auditoria / Notificacoes</li>
                <li>✓ Deep-link em cada evento para a tela correspondente</li>
                <li>✓ Ate 300 eventos ordenados pelo backend</li>
              </ul>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-900/30 to-amber-900/30 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-2">Para o operador CONSULTRI</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Em vez de procurar em 5 telas o que aconteceu com o Cliente X, <strong className="text-white">abre 1 tela
              e ve tudo</strong>: quando a procuracao foi criada, quando o convite foi aberto, quando o SERPRO confirmou
              ativacao, quando chegou nova mensagem na caixa postal, quando o webhook detectou revogacao. Auditoria
              completa, sem trabalho manual.
            </p>
          </div>
        </Slide>

        {/* Slide 14m — Auto-renovacao hibrida */}
        <Slide active={current === 26} id="consultri-autorenew">
          <SlideHeader
            num="14m"
            title="Auto-Renovacao Hibrida — zero gap entre vencimento e nova outorga"
            subtitle="60 dias antes: tenta auto-grant via SERPRO; se nao der, dispara convite com 60 dias de folga"
          />
          <p className="text-gray-400 mb-6 max-w-3xl">
            O job <code className="text-purple-400 font-mono">jobPreventiveRenewal</code> agora opera no <strong className="text-emerald-300">modo
            totalmente hibrido</strong>. Verifica capability SERPRO, tenta outorga programatica, e so cai pro convite
            manual se necessario — tudo em uma unica execucao diaria as 09h BRT.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">Passo 1 — DETECTAR</div>
              <div className="text-base font-bold text-white mb-2">Janela 55-65 dias</div>
              <p className="text-xs text-gray-400">Procuracoes ativas vencendo nesse intervalo, sem renovacao em curso. Idempotente.</p>
            </div>
            <div className="bg-gray-900 border border-sky-500/30 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-sky-400 mb-2">Passo 2 — CLONAR</div>
              <div className="text-base font-bold text-white mb-2">Nova procuracao</div>
              <p className="text-xs text-gray-400">Mesma config (preset, procurador, responsaveis), com nova vigencia de 12 meses + audit link.</p>
            </div>
            <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-purple-400 mb-2">Passo 3 — TENTAR AUTO</div>
              <div className="text-base font-bold text-white mb-2">AUTENTICAPROCURADOR</div>
              <p className="text-xs text-gray-400">Se o contrato SERPRO suporta, faz cadastro programatico e marca <code className="text-emerald-400">auto_grant_success</code>.</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-900/40 via-sky-900/40 to-purple-900/40 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-2">Passo 4 — FALLBACK INTELIGENTE</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Se a capability nao existir, ou a SERPRO recusar o auto-grant (motivo registrado em <code className="text-emerald-400">autoGrantError</code>),
              o sistema <strong className="text-sky-300">dispara automaticamente o convite manual</strong> com link magico
              para o responsavel via email/WhatsApp. Resultado: o cliente <strong className="text-white">nunca passa um dia
              sem procuracao ativa</strong>, mesmo nos casos em que a auto-outorga nao esta disponivel.
            </p>
          </div>
        </Slide>

        {/* Slide 14n — Executive Summary + Filtros por Procurador */}
        <Slide active={current === 27} id="consultri-executive">
          <SlideHeader
            num="14n"
            title="Executive Summary + Filtros granulares por procurador"
            subtitle="Um PDF por sessao de board + drill-down por CNPJ procurador em todas as telas"
          />
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📄</span>
                <h3 className="font-bold text-indigo-300">Executive Summary PDF</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-indigo-400/80 font-bold mb-3">/api/consultri/executive-summary</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Visao macro: total, ativas, parciais, revogadas</li>
                <li>✓ KPIs: taxa de ativacao, auto-grants, vencendo 30d</li>
                <li>✓ Score medio da carteira + clientes em risco</li>
                <li>✓ Engajamento 7d: notificacoes enviadas/falhadas/WhatsApp</li>
                <li>✓ Top 10 clientes em risco (score crescente)</li>
                <li>✓ Filtravel por procurador (mostra so a carteira do CNPJ X)</li>
              </ul>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎯</span>
                <h3 className="font-bold text-purple-300">Filtros por procurador em todas as telas</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-purple-400/80 font-bold mb-3">aplicado em Carteira, Conformidade, Metricas</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Carteira: dropdown filtra procuracoes do procurador selecionado</li>
                <li>✓ Conformidade: snapshots so dos clientes daquele procurador</li>
                <li>✓ Metricas: KPIs recalculados em tempo real para a sub-carteira</li>
                <li>✓ Backend: <code className="text-emerald-400">procuradorEntityId</code> propagado em todos os endpoints</li>
                <li>✓ Suporta operacao segregada (compliance, franquia, parceiros)</li>
              </ul>
            </div>
          </div>
          <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-purple-300 mb-2">Mais um plus: capability widget</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              A pagina <code className="text-emerald-400">/consultri/configuracoes</code> agora mostra um widget de
              <strong className="text-emerald-300"> teste de capability AUTENTICAPROCURADOR </strong>
              em 1 clique — descobrindo se o contrato SERPRO atual ja suporta auto-grant. Util para a Consultri
              dimensionar quando vale a pena upgradar o contrato SERPRO para ativar 100% do modo automatico.
            </p>
          </div>
        </Slide>

        {/* Slide 14o — Cobertura Nacional SEFAZ */}
        <Slide active={current === 28} id="consultri-cobertura">
          <SlideHeader
            num="14o"
            title="Cobertura Nacional SEFAZ — engine parametrizado + 27 UFs"
            subtitle="Hoje 8 estados (78% do PIB). Arquitetura pronta para os outros 19 — Nordeste priorizado"
          />

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-2">Hoje em producao</div>
              <div className="text-4xl font-extrabold text-emerald-300 mb-1">8 UFs</div>
              <div className="text-sm text-gray-300">SP · RJ · MG · RS · PR · SC · BA · MT</div>
              <div className="text-xs text-emerald-400/80 mt-2">~78% do PIB nacional</div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-2">Onda 1+2 (tier B)</div>
              <div className="text-4xl font-extrabold text-amber-300 mb-1">9 UFs</div>
              <div className="text-sm text-gray-300">PE · CE · MA · ES · GO · DF · MS · AM · PA</div>
              <div className="text-xs text-amber-400/80 mt-2">Regras detalhadas, faltam adapters de portal/RPA</div>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/30 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-orange-400 font-bold mb-2">Onda 3 (tier C)</div>
              <div className="text-4xl font-extrabold text-orange-300 mb-1">10 UFs</div>
              <div className="text-sm text-gray-300">AL · SE · RN · PB · PI · RO · RR · AP · AC · TO</div>
              <div className="text-xs text-orange-400/80 mt-2">Template manual + protocolo presencial / e-mail</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-500/5 border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚙️</span>
                <h3 className="font-bold text-blue-300">StateRulesEngine</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-blue-400/80 font-bold mb-3">src/config/state-rules.config.ts</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ <strong>Uma config canonica</strong> de cada UF: SEFAZ, autoridade, RICMS, cadastro, sistema (e-CredAc, SISCRED...)</li>
                <li>✓ <strong>Procuracao parametrizada</strong>: requer instrumento proprio? prazo? poderes?</li>
                <li>✓ <strong>Tier de integracao</strong>: A (API), B (portal/RPA), C (manual)</li>
                <li>✓ Adicionar nova UF = <strong>1 entrada no JSON</strong>, zero refactor</li>
                <li>✓ Migrado: <code className="text-emerald-400">formalization · compliance · demonstrativo · procuration</code></li>
              </ul>
            </div>

            <div className="bg-purple-500/5 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🗺️</span>
                <h3 className="font-bold text-purple-300">Mapa /admin/sefaz/cobertura</h3>
              </div>
              <p className="text-xs uppercase tracking-wider text-purple-400/80 font-bold mb-3">visualizacao executiva</p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Mapa visual por <strong>regiao</strong> com 5 grupos (N, NE, CO, SE, S)</li>
                <li>✓ Cores por status: verde · amarelo · cinza</li>
                <li>✓ Click na UF revela: autoridade, cadastro, sistema, RICMS, regras</li>
                <li>✓ KPIs: % PIB coberto, % planejado, % pendente</li>
                <li>✓ Backend: <code className="text-emerald-400">GET /api/sefaz/cobertura</code> e <code className="text-emerald-400">/api/sefaz/uf/:uf</code></li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-900/30 to-amber-900/30 border border-emerald-500/30 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-300 mb-2">Proximas ondas (alinhado com a forca da Consultri)</p>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div>
                <strong className="text-emerald-300">Onda 1+2 (tier B):</strong> 9 UFs com regras ricas — PE, CE, MA, ES, GO, DF, MS, AM, PA. Inclui regimes especiais ZFM (AM), agroindustria diferida (MS), exportacao mineral (PA). Adiciona ~20% do PIB.
              </div>
              <div>
                <strong className="text-emerald-300">Onda 3 (tier C):</strong> 10 UFs com template manual padronizado — AL, SE, RN, PB, PI, RO, RR, AP, AC, TO. Plataforma gera peticao com fundamentacao do RICMS local; protocolo presencial/e-mail. Cobre os ~6% restantes.
              </div>
              <div>
                <strong className="text-amber-300">Resultado:</strong> <strong className="text-emerald-300">27/27 UFs com regras ativas</strong>. Mapa nacional completo, zero estado em "pendente". Evolucao tier C → B → A acontece sob demanda comercial, sem refactor de logica.
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 15 — Contratos */}
        <Slide active={current === 29} id="contratos">
          <SlideHeader num="15" title="Contratos Tripartite Digitais" subtitle="Modelo contratual pronto para rede de parceiros" />
          <p className="text-gray-400 mb-8 max-w-3xl">
            A TaxCredit já tem desenhado contratualmente o modelo de operação em rede — o que poupa meses de
            estruturação jurídica pra Consultri. Suporta bipartite (TaxCredit + Cliente) e{' '}
            <span className="text-emerald-400 font-bold">tripartite (TaxCredit + Cliente + Parceiro)</span>.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-4">Estrutura contratual já modelada</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="font-bold mb-2 text-white">Splits configuráveis</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• % cliente (default 80%)</li>
                  <li>• % plataforma (configurável)</li>
                  <li>• % parceiro/advogado (configurável)</li>
                  <li>• Taxa de adesão (R$ 2.000 default)</li>
                  <li>• Pagamento bipartite ou tripartite</li>
                </ul>
              </div>
              <div>
                <p className="font-bold mb-2 text-white">Garantias e gestão</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Conta escrow Banco Fibra</li>
                  <li>• Assinaturas com captura de IP</li>
                  <li>• Status flow: draft → signed → active → completed</li>
                  <li>• Checklist de acompanhamento por etapa</li>
                  <li>• Earnings rastreados por parte</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-3">Bipartite (TaxCredit + Cliente)</p>
              <p className="text-sm text-gray-300 mb-2">Modelo usado quando o cliente final contrata direto a plataforma.</p>
              <p className="text-xs text-gray-500">Split padrão: 80% cliente / 20% TaxCredit</p>
            </Card>
            <Card>
              <p className="text-xs text-orange-400 font-bold uppercase tracking-wider mb-3">Tripartite (TaxCredit + Cliente + Consultri)</p>
              <p className="text-sm text-gray-300 mb-2">Modelo ideal pra rede de parceiros. Cliente continua sendo do parceiro 100%.</p>
              <p className="text-xs text-gray-500">Splits e papéis configuráveis por contrato</p>
            </Card>
          </div>
        </Slide>

        {/* Slide 16 — IA + Teses + Jurisprudência */}
        <Slide active={current === 30} id="ia">
          <SlideHeader num="16" title="IA + Teses + Jurisprudência" subtitle="Inteligência tributária viva, atualizada sem deploy" />
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <p className="font-bold text-lg mb-2">IA Claude (Anthropic)</p>
              <p className="text-sm text-gray-400">
                Modelo Opus 4.5 para análises profundas e Sonnet 4.5 para triagem rápida. Mix inteligente conforme
                complexidade. Custo controlado, qualidade preservada.
              </p>
            </Card>
            <Card>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <p className="font-bold text-lg mb-2">34 Teses Tributárias</p>
              <p className="text-sm text-gray-400">
                Cada tese tem código, descrição, fundamentação, tribunal, tema vinculante, setores aplicáveis,
                regimes, fórmula de cálculo, fonte e data da decisão. <span className="text-emerald-400">Editável pelo admin sem deploy.</span>
              </p>
            </Card>
            <Card>
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <p className="font-bold text-lg mb-2">Jurisprudência Vinculante</p>
              <p className="text-sm text-gray-400">
                Tabela de TeseJurisprudência ajusta probabilidade de sucesso por decisão recente (STF/STJ). Se uma
                tese teve julgamento desfavorável, probabilidade despenca. Se favorável, dispara.
              </p>
            </Card>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-4">Varredura automática de jurisprudência</p>
            <p className="text-gray-300 mb-4 leading-relaxed">
              Job cron diário roda às 6h (horário de Brasília), varre fontes públicas de jurisprudência (STF, STJ,
              CARF, TRFs) e gera <span className="text-emerald-400 font-bold">propostas de atualização</span> que
              ficam aguardando aprovação no painel administrativo.
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-center mt-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-2xl font-black text-emerald-400">Diário</p>
                <p className="text-xs text-gray-500 mt-1">Varredura STF/STJ</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-2xl font-black text-emerald-400">Sem deploy</p>
                <p className="text-xs text-gray-500 mt-1">Atualização via painel</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-2xl font-black text-emerald-400">Auditável</p>
                <p className="text-xs text-gray-500 mt-1">Histórico de revisões</p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 17 — Segurança */}
        <Slide active={current === 31} id="seguranca">
          <SlideHeader num="17" title="Segurança nível bancário" subtitle="9 camadas de proteção · LGPD-compliant · Honeypot ativo" />
          <p className="text-gray-400 mb-8 max-w-3xl">
            Dados fiscais são o ativo mais sensível da operação tributária. A TaxCredit aplica camadas de proteção
            que <span className="text-emerald-400 font-bold">a maioria das fintechs e bancos brasileiros ainda
            não tem</span>.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-red-950/30 to-gray-900 border border-red-800/40 rounded-2xl p-6">
              <p className="text-xs text-red-400 uppercase font-bold tracking-wider mb-4">Anti-Scraping (Shield) — 9 camadas</p>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li>0 · Bloqueio de subnets cloud conhecidas</li>
                <li>1 · Bloqueio permanente após reincidência</li>
                <li>2 · Bloqueio temporário (24h)</li>
                <li>3 · Honeypot paths (20 rotas-isca)</li>
                <li>4 · Detecção de User-Agent de bot (60+ patterns)</li>
                <li>5 · UA ausente ou inválido</li>
                <li>6 · Rate limit em rotas sensíveis</li>
                <li>7 · Janela de tempo (reset 5min)</li>
                <li>8 · Score-based + Geo lookup automático</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">
                Auto-lockdown em ataques coordenados (DDoS-lite): bloqueia qualquer IP não-BR
                durante a janela de ataque.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-950/30 to-gray-900 border border-purple-800/40 rounded-2xl p-6">
              <p className="text-xs text-purple-400 uppercase font-bold tracking-wider mb-4">Deception (Honeypot Ativo)</p>
              <p className="text-sm text-gray-300 mb-3">
                Quando um atacante toca em path-isca (.env, wp-admin, /api/internal/keys), o sistema serve{' '}
                <span className="text-purple-300 font-bold">dados falsos realistas</span> com canary tokens únicos
                embedded. Se esses tokens aparecerem em qualquer lugar do mundo, sabemos que veio daqui.
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• 16 tipos de bait (env, wp-config, swagger, graphql, etc)</li>
                <li>• Tarpit: delay artificial de 8-30s</li>
                <li>• Headers convincentes (fake Apache/PHP)</li>
                <li>• Persistência forense completa</li>
                <li>• Auto-bloqueio após mordida</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-950/30 to-gray-900 border border-blue-800/40 rounded-2xl p-6">
              <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-4">Watermark digital</p>
              <p className="text-sm text-gray-300 mb-3">
                Todo documento gerado (parecer, petição, relatório) recebe marca d&apos;água{' '}
                <span className="text-blue-300 font-bold">visível e invisível</span>:
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Visual: CSS rotacionado 45°, opacidade 3%</li>
                <li>• Invisível: caracteres zero-width (U+200B/C/D)</li>
                <li>• ID rastreável (SHA-256 user+timestamp+secret)</li>
                <li>• Footer com ID e data de geração</li>
                <li>• Em vazamento: identifica exatamente quem gerou</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900 border border-emerald-800/40 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-4">Padrões aplicados</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>✓ HTTPS obrigatório (HSTS preload)</li>
                <li>✓ JWT com expiração e refresh</li>
                <li>✓ Helmet completo (CSP, X-Frame-Options, etc)</li>
                <li>✓ Rate limit por tipo de rota</li>
                <li>✓ CORS com origens explícitas</li>
                <li>✓ Validação de payload via Zod</li>
                <li>✓ Logs forenses no Supabase</li>
                <li>✓ Classificação automática de ataques (11 tipos)</li>
                <li>✓ Dashboard de segurança em tempo real</li>
              </ul>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <p className="text-sm text-gray-400">
              <span className="text-emerald-400 font-bold">Conformidade LGPD:</span> dados criptografados em
              trânsito e em repouso. Audit log completo. Direito ao esquecimento implementado. Procurações
              explícitas para tratamento de dados fiscais sensíveis.
            </p>
          </div>
        </Slide>

        {/* Slide 18 — Modelo Comercial */}
        <Slide active={current === 32} id="comercial">
          <SlideHeader num="18" title="Modelo Comercial Consultri" subtitle="Dois jogos, duas lógicas, total previsibilidade" />
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-950/40 to-gray-900 border border-emerald-700/40 rounded-2xl p-8">
              <p className="text-xs text-emerald-400 uppercase tracking-wider font-bold mb-2">Produto 1 · Passado</p>
              <h3 className="text-2xl font-black mb-1">Recuperação 5 Anos</h3>
              <p className="text-sm text-emerald-300 mb-6">Mensalidade pura · sem performance</p>
              <p className="text-sm text-gray-400 mb-6 italic border-l-2 border-emerald-500 pl-3">
                Como o resultado depende de execução externa (protocolo, judiciário), não cobramos performance.
                Você usa, paga. Simples e auditável.
              </p>
              <div className="space-y-3">
                <PlanRow titulo="Starter" preco="R$ 3.900" desc="25 análises · 5 batches" />
                <PlanRow titulo="Pro" preco="R$ 9.900" desc="100 análises · 25 batches" />
                <PlanRow titulo="Enterprise" preco="R$ 24.900" desc="500 análises · ilimitado batches" />
                <div className="border-2 border-emerald-500 rounded-xl p-4 bg-emerald-950/40">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-black text-lg">Custom Consultri</p>
                    <p className="text-2xl font-black text-emerald-400">R$ 39.900<span className="text-sm text-gray-500">/mês</span></p>
                  </div>
                  <p className="text-xs text-gray-400">TUDO ilimitado · suporte dedicado · priority API · onboarding com nossa equipe</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-6">+ Setup único <span className="text-emerald-400 font-bold">R$ 30.000</span> (treinamento dos 120 consultores · onboarding · integração ERP)</p>
            </div>
            <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-700/40 rounded-2xl p-8">
              <p className="text-xs text-orange-400 uppercase tracking-wider font-bold mb-2">Produto 2 · Presente</p>
              <h3 className="text-2xl font-black mb-1">Compliance em Tempo Real</h3>
              <p className="text-sm text-orange-300 mb-6">Mensalidade por CNPJ + performance compartilhada</p>
              <p className="text-sm text-gray-400 mb-6 italic border-l-2 border-orange-500 pl-3">
                Como a economia é gerada dentro da plataforma e auditável em tempo real, fazemos parceria de
                performance. Métrica é o número no dashboard — não tem como negar pra ninguém.
              </p>
              <div className="space-y-3">
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-2">Mensalidade por CNPJ monitorado</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-300">1 a 100 CNPJs</span><span className="font-bold">R$ 750/mês</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">101 a 500 CNPJs</span><span className="font-bold">R$ 500/mês</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">500+ CNPJs</span><span className="font-bold">R$ 350/mês</span></div>
                  </div>
                </div>
                <div className="bg-orange-950/40 border-2 border-orange-500 rounded-xl p-4">
                  <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-2">Performance sobre economia comprovada</p>
                  <p className="text-sm text-gray-300 mb-3">
                    Cliente paga <span className="font-bold">20%</span> à Consultri sobre economia comprovada no
                    dashboard. Desses 20%:
                  </p>
                  <div className="bg-gray-900/60 rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-1"><span className="text-orange-300">Consultri fica com</span><span className="font-bold text-orange-300">70%</span></div>
                    <div className="flex justify-between"><span className="text-emerald-300">TaxCredit fica com</span><span className="font-bold text-emerald-300">30%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-3">Por que esse modelo funciona</p>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div>
                <p className="font-bold text-white mb-1">100% auditável</p>
                <p className="text-xs text-gray-500">Tudo é métrica da plataforma. Ninguém precisa confiar em ninguém pela palavra.</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Alinhamento total</p>
                <p className="text-xs text-gray-500">Quando o cliente economiza, todos ganham. Quando não economiza, ninguém ganha extra.</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Previsibilidade</p>
                <p className="text-xs text-gray-500">Mensalidade segura a casa pra ambos os lados. Performance é o upside compartilhado.</p>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 19 — Projeção */}
        <Slide active={current === 33} id="projecao">
          <SlideHeader num="19" title="Projeção financeira" subtitle="Cenário realista com crescimento gradual" />
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900 border border-emerald-700/30 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 uppercase tracking-wider font-bold mb-1">Ano 1 — operação inicial</p>
              <h3 className="text-xl font-bold mb-6">50 CNPJs em compliance · economia média R$ 100K/cliente</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Plano Custom (mensal)</span>
                  <span className="font-bold">R$ 39.900</span>
                </div>
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">50 CNPJs RT × R$ 750</span>
                  <span className="font-bold">R$ 37.500</span>
                </div>
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Performance 30% (TaxCredit)</span>
                  <span className="font-bold">R$ 300.000</span>
                </div>
                <div className="flex justify-between text-lg pt-2">
                  <span className="text-emerald-400 font-bold">Receita TaxCredit/mês</span>
                  <span className="font-black text-emerald-400">{fmt(377400)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-800 mt-3">
                  <span className="text-gray-300 font-bold">Anualizado</span>
                  <span className="font-black text-white">{fmt(4528800)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-2">Pra Consultri</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Performance 70%</span>
                  <span className="font-bold text-orange-300">R$ 700.000/mês</span>
                </div>
                <div className="flex justify-between text-base mt-1">
                  <span className="text-gray-300 font-bold">Anualizado</span>
                  <span className="font-black text-orange-300">{fmt(8400000)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-950/30 to-gray-900 border border-orange-700/30 rounded-2xl p-6">
              <p className="text-xs text-orange-400 uppercase tracking-wider font-bold mb-1">Ano 2 — operação madura</p>
              <h3 className="text-xl font-bold mb-6">200 CNPJs em compliance · economia consistente</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Plano Custom (mensal)</span>
                  <span className="font-bold">R$ 39.900</span>
                </div>
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">200 CNPJs RT (média R$ 600)</span>
                  <span className="font-bold">R$ 120.000</span>
                </div>
                <div className="flex justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Performance 30% (escala)</span>
                  <span className="font-bold">R$ 1.200.000</span>
                </div>
                <div className="flex justify-between text-lg pt-2">
                  <span className="text-orange-400 font-bold">Receita TaxCredit/mês</span>
                  <span className="font-black text-orange-400">{fmt(1359900)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-800 mt-3">
                  <span className="text-gray-300 font-bold">Anualizado</span>
                  <span className="font-black text-white">{fmt(16318800)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-2">Pra Consultri</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Performance 70%</span>
                  <span className="font-bold text-orange-300">R$ 2.800.000/mês</span>
                </div>
                <div className="flex justify-between text-base mt-1">
                  <span className="text-gray-300 font-bold">Anualizado</span>
                  <span className="font-black text-orange-300">{fmt(33600000)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="text-emerald-400 font-bold">Premissas:</span> economia média de R$ 100K/cliente/mês no ano 1
              (varejo médio), evoluindo para R$ 150-200K conforme adicionam clientes maiores. Performance fee de 20%
              sobre economia comprovada — padrão de mercado para compliance fiscal. Captação de 4-5 CNPJs novos por
              mês via 120 consultores. <span className="text-gray-500 italic">Projeção conservadora — não considera Produto 1 (recuperação 5 anos)
              que é receita adicional do lado da Consultri.</span>
            </p>
          </div>
        </Slide>

        {/* Slide 20 — Roadmap */}
        <Slide active={current === 34} id="roadmap">
          <SlideHeader num="20" title="Próximos passos" subtitle="Onboarding completo em 30 dias" />
          <div className="space-y-4 mb-8">
            <RoadmapRow semana="Semana 1" titulo="Contratação e setup técnico" itens={['Assinatura do contrato (Master Partner Consultri)', 'Pagamento da taxa de setup (R$ 30.000)', 'Provisionamento de infraestrutura dedicada', 'Configuração de DNS e certificados internos', 'Criação dos perfis admin da Consultri']} />
            <RoadmapRow semana="Semana 2" titulo="Onboarding e treinamento" itens={['Treinamento Tadeu + diretoria (1 dia presencial em SP)', 'Treinamento dos 120 consultores em grupos (online)', 'Material de apoio: vídeos, manuais, FAQ', 'Definição de processos internos da Consultri', 'Configuração de templates de procuração e contrato']} />
            <RoadmapRow semana="Semana 3" titulo="Integrações" itens={['Setup de integração com ERP do primeiro cliente piloto', 'Conexão SERPRO/Integra Contador (certificado)', 'Configuração de webhook (se aplicável)', 'Testes ponta-a-ponta com SPED real', 'Validação de saída (dossiê completo)']} />
            <RoadmapRow semana="Semana 4" titulo="Lançamento operacional" itens={['Primeiro projeto real em produção', 'Acompanhamento técnico dedicado', 'Monitoramento de performance', 'Ajustes finais', 'Marco de "Operação Plena" — review com Tadeu']} />
          </div>
          <div className="bg-gradient-to-r from-emerald-900/30 to-orange-900/30 border border-emerald-700/30 rounded-xl p-6 text-center">
            <p className="text-2xl font-black mb-2">30 dias</p>
            <p className="text-sm text-gray-400">do contrato à primeira recuperação rodando em produção. Acompanhamento dedicado durante todo o período.</p>
          </div>
        </Slide>

        {/* Slide 21 — CTA */}
        <Slide active={current === 35} id="cta">
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              Vamos construir juntos<br/>
              <span className="text-emerald-400">o futuro da Consultri</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mb-12 leading-relaxed">
              120 consultores. R$ 400 milhões recuperados em 9 anos. Imagina dobrar esse resultado em 24 meses,
              sem contratar uma pessoa a mais. <span className="text-emerald-400 font-bold">É isso que a TaxCredit faz pela Consultri.</span>
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
              <Card className="text-center"><p className="text-3xl font-black text-emerald-400 mb-2">3 produtos</p><p className="text-xs text-gray-500">integrados em uma plataforma</p></Card>
              <Card className="text-center"><p className="text-3xl font-black text-orange-400 mb-2">9 camadas</p><p className="text-xs text-gray-500">de segurança nível bancário</p></Card>
              <Card className="text-center"><p className="text-3xl font-black text-blue-400 mb-2">30 dias</p><p className="text-xs text-gray-500">do contrato à operação plena</p></Card>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4 mb-12">
              <a href="https://wa.me/5521999999999?text=Tadeu%20Consultri" className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors text-lg">
                Falar com o time TaxCredit
              </a>
              <a href="/apresentacao" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700">
                Ver a plataforma
              </a>
            </div>
            <p className="text-xs text-gray-600">TaxCredit Enterprise · ATOM BRASIL DIGITAL LTDA · Documento personalizado para Consultri Consultoria Tributária Ltda.</p>
          </div>
        </Slide>

      </main>

      {/* Navigation footer */}
      <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900/90 backdrop-blur border border-gray-800 rounded-full px-2 py-2 shadow-2xl">
        <button
          onClick={() => setCurrent(c => Math.max(c - 1, 0))}
          disabled={current === 0}
          className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        >
          ←
        </button>
        <span className="text-xs text-gray-400 px-3 font-mono min-w-[60px] text-center">
          {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </span>
        <button
          onClick={() => setCurrent(c => Math.min(c + 1, SLIDES.length - 1))}
          disabled={current === SLIDES.length - 1}
          className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold"
        >
          →
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────

function NotifBell() {
  const [unread, setUnread] = useState(0);
  const [critical, setCritical] = useState(0);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<any>(null);

  async function tick() {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token') || '') : '';
      if (!token) return;
      const r = await fetch('/api/consultri/notifications/badge', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) { setUnread(j.data.unread || 0); setCritical(j.data.criticalUnread || 0); setLast(j.data.last); }
    } catch { /* silent */ }
  }
  useEffect(() => { tick(); const i = setInterval(tick, 30000); return () => clearInterval(i); }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium border border-gray-700 relative"
        title="Hub de notificacoes"
      >
        🔔
        {unread > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${critical > 0 ? 'bg-red-500' : 'bg-purple-500'} text-white`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-300">Notificações ({unread} não lidas)</span>
            <a href="/consultri/notificacoes" className="text-xs text-purple-400 hover:text-purple-300">Abrir hub →</a>
          </div>
          {last ? (
            <div className="border border-gray-800 rounded p-2 bg-gray-950">
              <div className="text-xs font-bold text-white">{last.subject || last.template || 'Notificação'}</div>
              <div className="text-xs text-gray-400 mt-1 line-clamp-3">{last.body}</div>
              <div className="text-[10px] text-gray-600 mt-2">{new Date(last.createdAt).toLocaleString('pt-BR')}</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 text-center py-3">Sem notificações pendentes</div>
          )}
        </div>
      )}
    </div>
  );
}

function Slide({ active, id, children }: { active: boolean; id: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={`slide max-w-6xl mx-auto px-6 py-12 ${active ? 'block' : 'hidden print:block'}`}
    >
      {children}
    </section>
  );
}

function SlideHeader({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5">
          {num}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-transparent" />
      </div>
      <h2 className="text-3xl md:text-4xl font-black mb-2">{title}</h2>
      {subtitle && <p className="text-gray-400 text-base md:text-lg">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className || ''}`}>
      {children}
    </div>
  );
}

function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'emerald' | 'sky' | 'yellow' }) {
  const map: Record<string, string> = {
    gray: 'bg-gray-800 text-gray-300 border-gray-700',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    sky: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    yellow: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${map[color]}`}>
      {children}
    </span>
  );
}

function JobCard({
  cor, icone, titulo, periodicidade, descricao,
}: { cor: 'sky' | 'yellow' | 'emerald'; icone: string; titulo: string; periodicidade: string; descricao: string }) {
  const map: Record<string, { border: string; text: string; bg: string }> = {
    sky:     { border: 'border-sky-500/40',     text: 'text-sky-300',     bg: 'bg-sky-500/10' },
    yellow:  { border: 'border-yellow-500/40',  text: 'text-yellow-300',  bg: 'bg-yellow-500/10' },
    emerald: { border: 'border-emerald-500/40', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  };
  const c = map[cor];
  return (
    <div className={`bg-gray-900 border ${c.border} rounded-2xl p-5 flex gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0 ${c.bg} ${c.text}`}>
        {icone}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-3 mb-1">
          <h3 className="text-lg font-bold text-white font-mono">{titulo}</h3>
          <span className={`text-xs font-bold ${c.text}`}>· {periodicidade}</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{descricao}</p>
      </div>
    </div>
  );
}

function MiniStat({
  label, value, tone,
}: { label: string; value: string | number; tone: 'white' | 'emerald' | 'yellow' | 'sky' | 'orange' }) {
  const map: Record<string, string> = {
    white:   'border-gray-700 text-white',
    emerald: 'border-emerald-500/40 text-emerald-300',
    yellow:  'border-yellow-500/40 text-yellow-300',
    sky:     'border-sky-500/40 text-sky-300',
    orange:  'border-orange-500/40 text-orange-300',
  };
  return (
    <div className={`bg-gray-900 border ${map[tone]} rounded-xl p-4`}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    orange: 'text-orange-400 bg-orange-950/40 border-orange-800/40',
    blue: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
    purple: 'text-purple-400 bg-purple-950/40 border-purple-800/40',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.emerald}`}>
      <p className="text-xs uppercase tracking-wider font-bold opacity-70">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-700/50 transition-colors">
      <p className="font-bold mb-2">{title}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function TributoRow({ sigla, cor, teses }: { sigla: string; cor: string; teses: string[] }) {
  const corMap: Record<string, string> = {
    teal: 'from-teal-500 to-teal-700 border-teal-800/50',
    blue: 'from-blue-500 to-blue-700 border-blue-800/50',
    indigo: 'from-indigo-500 to-indigo-700 border-indigo-800/50',
    amber: 'from-amber-500 to-amber-700 border-amber-800/50',
    orange: 'from-orange-500 to-orange-700 border-orange-800/50',
    rose: 'from-rose-500 to-rose-700 border-rose-800/50',
    violet: 'from-violet-500 to-violet-700 border-violet-800/50',
  };
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-5`}>
      <div className={`shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br ${corMap[cor]} flex items-center justify-center font-black text-xl`}>
        {sigla}
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Teses cobertas</p>
        <div className="grid md:grid-cols-2 gap-1">
          {teses.map((t, i) => (
            <p key={i} className="text-sm text-gray-300">• {t}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocCard({ titulo, desc, icon }: { titulo: string; desc: string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="font-bold mb-2">{titulo}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function ErpCard({ nome, desc, status }: { nome: string; desc: string; status: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-lg">{nome}</p>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function PlanRow({ titulo, preco, desc }: { titulo: string; preco: string; desc: string }) {
  return (
    <div className="flex items-center justify-between border border-gray-800 rounded-lg p-3 bg-gray-800/30">
      <div>
        <p className="font-bold text-sm">{titulo}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <p className="font-bold text-emerald-400">{preco}<span className="text-xs text-gray-500">/mês</span></p>
    </div>
  );
}

function RoadmapRow({ semana, titulo, itens }: { semana: string; titulo: string; itens: string[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row gap-5">
      <div className="md:w-40 shrink-0">
        <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider">{semana}</p>
        <p className="font-bold mt-1">{titulo}</p>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm text-gray-400">
        {itens.map((item, i) => <li key={i} className="flex gap-2"><span className="text-emerald-400">✓</span> {item}</li>)}
      </ul>
    </div>
  );
}
