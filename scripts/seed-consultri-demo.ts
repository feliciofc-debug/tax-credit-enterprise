/**
 * Seed de demonstracao CONSULTRI
 * ---------------------------------------------------------------
 * Popula a base com 10 clientes ficticios e procuracoes em todos
 * os estados possiveis, para demos comerciais sem dependencia de
 * SERPRO real ou DBs vazios.
 *
 * Uso:  npx tsx scripts/seed-consultri-demo.ts
 * Idempotente: roda multiplas vezes sem duplicar (usa upsert por CNPJ).
 */

import { PrismaClient } from '@prisma/client';
import { CONSULTRI_PRESET } from '../src/services/procuration.service';

const prisma = new PrismaClient();

interface DemoClient {
  cnpj: string;
  company: string;
  email: string;
  scenario: string;
  cidade?: string;
  estado?: string;
}

const DEMO_CLIENTS: DemoClient[] = [
  { cnpj: '11.111.111/0001-11', company: 'Industria Alfa Ltda',          email: 'alfa@demo.local',     scenario: 'active_ok',   cidade: 'Sao Paulo',     estado: 'SP' },
  { cnpj: '22.222.222/0001-22', company: 'Comercio Beta S/A',            email: 'beta@demo.local',     scenario: 'active_ok',   cidade: 'Rio de Janeiro',estado: 'RJ' },
  { cnpj: '33.333.333/0001-33', company: 'Servicos Gama EIRELI',         email: 'gama@demo.local',     scenario: 'expiring_30', cidade: 'Belo Horizonte',estado: 'MG' },
  { cnpj: '44.444.444/0001-44', company: 'Logistica Delta Express',      email: 'delta@demo.local',    scenario: 'expiring_7',  cidade: 'Curitiba',      estado: 'PR' },
  { cnpj: '55.555.555/0001-55', company: 'Construtora Epsilon',          email: 'epsilon@demo.local',  scenario: 'partial',     cidade: 'Salvador',      estado: 'BA' },
  { cnpj: '66.666.666/0001-66', company: 'Quimica Zeta Industrial',      email: 'zeta@demo.local',     scenario: 'pending',     cidade: 'Porto Alegre',  estado: 'RS' },
  { cnpj: '77.777.777/0001-77', company: 'Tecnologia Eta Solucoes',      email: 'eta@demo.local',      scenario: 'not_found',   cidade: 'Florianopolis', estado: 'SC' },
  { cnpj: '88.888.888/0001-88', company: 'Distribuidora Theta',          email: 'theta@demo.local',    scenario: 'active_ok',   cidade: 'Cuiaba',        estado: 'MT' },
  { cnpj: '99.999.999/0001-99', company: 'Agropecuaria Iota',            email: 'iota@demo.local',     scenario: 'risk_caixa',  cidade: 'Sao Paulo',     estado: 'SP' },
  { cnpj: '10.101.010/0001-10', company: 'Metalurgica Kappa',            email: 'kappa@demo.local',    scenario: 'risk_sitfis', cidade: 'Belo Horizonte',estado: 'MG' },
  { cnpj: '11.222.333/0001-44', company: 'Tecidos Lambda Nordeste S/A',  email: 'lambda@demo.local',   scenario: 'active_ok',   cidade: 'Recife',        estado: 'PE' },
  { cnpj: '12.333.444/0001-55', company: 'Frutas Mu Exportadora EIRELI', email: 'mu@demo.local',       scenario: 'expiring_30', cidade: 'Fortaleza',     estado: 'CE' },
  { cnpj: '13.444.555/0001-66', company: 'Logistica Nu Federal Ltda',    email: 'nu@demo.local',       scenario: 'active_ok',   cidade: 'Brasilia',      estado: 'DF' },
  { cnpj: '14.555.666/0001-77', company: 'Mineracao Xi Amazonia S/A',    email: 'xi@demo.local',       scenario: 'partial',     cidade: 'Belem',         estado: 'PA' },
];

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('🌱 Seed CONSULTRI demo iniciando...\n');

  for (const c of DEMO_CLIENTS) {
    // 1. User
    const cidade = c.cidade ?? 'Rio de Janeiro';
    const estado = c.estado ?? 'RJ';
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { company: c.company, cnpj: c.cnpj, cidade, estado },
      create: {
        email: c.email,
        password: 'demo-only-no-login',
        name: c.company,
        company: c.company,
        cnpj: c.cnpj,
        role: 'user',
        endereco: 'Av. Demo, 100',
        cidade,
        estado,
        legalRepName: 'Responsavel Demo',
        legalRepCpf: '000.000.000-00',
        legalRepCargo: 'Diretor',
      },
    });

    // 2. Procuration por cenario
    let dataValidade: Date;
    let serproStatus: string;
    let status: string;
    let serproDiff: any = { granted: CONSULTRI_PRESET.poderes, missing: [], extras: [] };
    let lastCheck: Date | null = new Date(Date.now() - 60 * 60 * 1000);

    switch (c.scenario) {
      case 'active_ok':
        dataValidade = daysFromNow(300);
        serproStatus = 'active';
        status = 'active';
        break;
      case 'expiring_30':
        dataValidade = daysFromNow(20);
        serproStatus = 'active';
        status = 'active';
        break;
      case 'expiring_7':
        dataValidade = daysFromNow(5);
        serproStatus = 'active';
        status = 'active';
        break;
      case 'partial':
        dataValidade = daysFromNow(200);
        serproStatus = 'partial';
        status = 'generated';
        serproDiff = {
          granted: CONSULTRI_PRESET.poderes.slice(0, 30),
          missing: CONSULTRI_PRESET.poderes.slice(30),
          extras: [],
        };
        break;
      case 'pending':
        dataValidade = daysFromNow(365);
        serproStatus = 'pending_serpro';
        status = 'generated';
        serproDiff = { granted: [], missing: CONSULTRI_PRESET.poderes, extras: [] };
        lastCheck = null;
        break;
      case 'not_found':
        dataValidade = daysFromNow(365);
        serproStatus = 'not_found';
        status = 'generated';
        serproDiff = { granted: [], missing: CONSULTRI_PRESET.poderes, extras: [] };
        break;
      case 'risk_caixa':
      case 'risk_sitfis':
        dataValidade = daysFromNow(180);
        serproStatus = 'active';
        status = 'active';
        break;
      default:
        dataValidade = daysFromNow(365);
        serproStatus = 'active';
        status = 'active';
    }

    // Limpa procuracoes anteriores deste cliente demo
    await prisma.procuration.deleteMany({ where: { clientId: user.id, presetKey: 'consultri' } });

    const proc = await prisma.procuration.create({
      data: {
        clientId: user.id,
        type: 'ecac_preset',
        lawyerScenario: 'partner_lawyer',
        status,
        outorgadoAtom: false,
        outorgadoAdv: false,
        prazoAnos: 1,
        poderes: CONSULTRI_PRESET.poderes as any,
        dataValidade,
        presetKey: 'consultri',
        procuradorCnpj: CONSULTRI_PRESET.cnpj,
        procuradorNome: CONSULTRI_PRESET.razaoSocial,
        serproStatus,
        serproDiff,
        lastSerproCheckAt: lastCheck,
        responsavelEmail: 'operador@consultri.com.br',
        responsavelPhone: '+5511999999999',
      },
    });

    // 3. Audits
    await prisma.procurationAudit.createMany({
      data: [
        { procurationId: proc.id, event: 'created', message: 'Procuracao criada via preset consultri', actorType: 'system' },
        { procurationId: proc.id, event: 'guide_generated', message: 'Guia gerado (45 poderes, 12m)', actorType: 'system' },
        ...(c.scenario === 'active_ok' || c.scenario.startsWith('expiring') || c.scenario.startsWith('risk') ? [
          { procurationId: proc.id, event: 'invite_sent', message: 'Convite enviado por email + WhatsApp', actorType: 'user' as const },
          { procurationId: proc.id, event: 'invite_opened', message: 'Cliente abriu o link magico', actorType: 'client_self' as const },
          { procurationId: proc.id, event: 'invite_acknowledged', message: 'Cliente confirmou outorga', actorType: 'client_self' as const },
          { procurationId: proc.id, event: 'serpro_active', message: 'Procuracao detectada como ATIVA via OBTERPROCURACAO41', actorType: 'cron' as const },
        ] : []),
        ...(c.scenario === 'partial' ? [
          { procurationId: proc.id, event: 'invite_sent', message: 'Convite enviado', actorType: 'user' as const },
          { procurationId: proc.id, event: 'invite_acknowledged', message: 'Cliente acha que terminou', actorType: 'client_self' as const },
          { procurationId: proc.id, event: 'serpro_partial', message: '15 poderes faltando — pedir pra cliente revisar', actorType: 'cron' as const },
        ] : []),
        ...(c.scenario === 'expiring_30' ? [
          { procurationId: proc.id, event: 'alert_sent', message: 'Alerta 30 dias enviado', actorType: 'cron' as const },
        ] : []),
        ...(c.scenario === 'expiring_7' ? [
          { procurationId: proc.id, event: 'alert_sent', message: 'Alerta 30 dias enviado', actorType: 'cron' as const },
          { procurationId: proc.id, event: 'alert_sent', message: 'Alerta 7 dias enviado — URGENTE', actorType: 'cron' as const },
        ] : []),
      ],
    });

    // 4. Conformidade snapshot
    let caixa = 0, sitStatus: string = 'limpo', sitPend = 0;
    if (c.scenario === 'risk_caixa')  { caixa = 8; sitStatus = 'limpo'; }
    if (c.scenario === 'risk_sitfis') { caixa = 0; sitStatus = 'pendencias'; sitPend = 4; }
    if (c.scenario === 'active_ok' && Math.random() > 0.6) { caixa = Math.floor(Math.random() * 3); }

    if (serproStatus === 'active') {
      let score = 100;
      score -= caixa * 5;
      score -= sitPend * 10;
      await prisma.conformidadeSnapshot.create({
        data: {
          clientId: user.id,
          cnpj: c.cnpj,
          procurationId: proc.id,
          caixaPostalUnread: caixa,
          situacaoStatus: sitStatus,
          situacaoPendencias: sitPend,
          dctfwebAtrasos: 0,
          score: Math.max(0, score),
        },
      });
    }

    // 5. Notificacoes de exemplo
    await prisma.notification.createMany({
      data: [
        {
          channel: 'email',
          recipient: c.email,
          subject: `Procuracao CONSULTRI para ${c.company}`,
          body: 'Acesse o link guiado para outorgar...',
          template: 'procuration_invite',
          refType: 'procuration',
          refId: proc.id,
          status: 'sent',
          sentAt: new Date(),
          attempts: 1,
        },
        ...(c.scenario === 'expiring_7' ? [{
          channel: 'whatsapp',
          recipient: '+5511999999999',
          body: `[CONSULTRI] Procuracao de ${c.company} vence em 7 dias.`,
          template: 'procuration_expiry_7d',
          refType: 'procuration',
          refId: proc.id,
          status: 'sent',
          sentAt: new Date(),
          attempts: 1,
          updatedAt: new Date(),
        }] : []),
      ],
    });

    console.log(`✓ ${c.company.padEnd(38)} ${(estado).padEnd(2)} cenario=${c.scenario.padEnd(15)} status=${serproStatus}`);
  }

  // SerproConnection demo (vazia, apenas para o painel listar)
  const existing = await prisma.serproConnection.findFirst({ where: { cnpj: CONSULTRI_PRESET.cnpj } });
  if (!existing) {
    await prisma.serproConnection.create({
      data: {
        cnpj: CONSULTRI_PRESET.cnpj,
        companyName: CONSULTRI_PRESET.razaoSocial,
        consumerKey: 'demo-consumer-key-trocar-na-producao',
        consumerSecret: 'demo-secret-trocar-na-producao',
        environment: 'trial',
        status: 'pending',
      },
    });
    console.log('\n✓ SerproConnection demo criada (status=pending, trocar credenciais reais)');
  }

  console.log(`\n🎉 Seed concluido: ${DEMO_CLIENTS.length} clientes + procuracoes + auditoria + conformidade.\n`);
  console.log('Acesse:');
  console.log('  http://localhost:3000/consultri              (deck)');
  console.log('  http://localhost:3000/consultri/carteira     (carteira)');
  console.log('  http://localhost:3000/consultri/conformidade (conformidade)');
  console.log('  http://localhost:3000/consultri/configuracoes(configuracoes)\n');
}

main()
  .catch(e => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
