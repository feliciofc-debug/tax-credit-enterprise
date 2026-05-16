import { prisma } from '../utils/prisma';
import { serproService, SerproCredentials } from './serpro.service';
import { runCrossAnalysisDirfFontes } from './cross-analysis.service';
import { logger } from '../utils/logger';

// ============================================================
// Consultri Report Service
// ------------------------------------------------------------
// Gera HTML consolidado pronto para impressao (Ctrl+P -> PDF)
// com TUDO que o e-CAC retornou para um cliente via procuracao:
//
//  - Identificacao do cliente + procurador
//  - Status da procuracao (poderes, vigencia, ultima verificacao)
//  - Caixa Postal (resumo + ultimas msgs)
//  - Situacao Fiscal (status + pendencias)
//  - DCTFWeb (ultimo periodo disponivel)
//  - Analise Cruzada DIRF x Fontes (com teses)
//  - Timeline de auditoria da procuracao
//
// Usado pelo endpoint /api/procurations/:id/report (admin)
// e pelo botao "Exportar relatorio" da pagina do cliente.
// ============================================================

export type ReportOptions = {
  procurationId: string;
  anoBase?: number;
  includeCrossAnalysis?: boolean;
};

function fmtDate(d?: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
function fmtMoney(n?: number | null): string {
  return `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
function esc(s: any): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function generateConsultriReport(opts: ReportOptions): Promise<string> {
  const proc = await prisma.procuration.findUnique({ where: { id: opts.procurationId } });
  if (!proc) throw new Error('Procuracao nao encontrada');

  // Resolve cliente
  let clienteNome = 'Cliente', clienteCnpj = '', clienteEndereco = '';
  if (proc.clientId.startsWith('analysis_')) {
    const a = await prisma.viabilityAnalysis.findUnique({ where: { id: proc.clientId.replace('analysis_', '') } });
    clienteNome = a?.companyName || 'Cliente';
    clienteCnpj = a?.cnpj || '';
  } else {
    const u = await prisma.user.findUnique({ where: { id: proc.clientId } });
    clienteNome = u?.company || u?.name || 'Cliente';
    clienteCnpj = u?.cnpj || '';
    clienteEndereco = '';
  }

  // Audits
  const audits = await prisma.procurationAudit.findMany({
    where: { procurationId: proc.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  // Snapshots de conformidade (mais recente)
  const snap = await prisma.conformidadeSnapshot.findFirst({
    where: { procurationId: proc.id },
    orderBy: { collectedAt: 'desc' },
  });

  // Coleta ao vivo (somente se procuracao ativa e tiver SerproConnection)
  let caixaData: any = null;
  let sitFisData: any = null;
  let dctfData: any = null;
  let crossAnalysis: any = null;

  if (proc.serproStatus === 'active' && clienteCnpj) {
    const conn = await prisma.serproConnection.findFirst({ where: { status: 'active' } }).catch(() => null);
    if (conn) {
      const creds: SerproCredentials = {
        consumerKey: conn.consumerKey,
        consumerSecret: conn.consumerSecret,
        certBase64: conn.certBase64 || undefined,
        certPassword: conn.certPassword || undefined,
        environment: (conn.environment || 'trial') as 'trial' | 'production',
      };

      const tasks = await Promise.allSettled([
        serproService.consultarNovasMensagens(creds, conn.cnpj, clienteCnpj),
        serproService.solicitarSituacaoFiscal(creds, conn.cnpj, clienteCnpj),
      ]);
      caixaData = tasks[0].status === 'fulfilled' ? (tasks[0].value as any)?.data : null;
      sitFisData = tasks[1].status === 'fulfilled' ? (tasks[1].value as any)?.data : null;

      if (opts.includeCrossAnalysis !== false && opts.anoBase) {
        try {
          crossAnalysis = await runCrossAnalysisDirfFontes(creds, conn.cnpj, clienteCnpj, opts.anoBase);
        } catch (e: any) {
          logger.warn(`[Report] cross-analysis falhou: ${e.message}`);
        }
      }
    }
  }

  const diff = proc.serproDiff as any || {};
  const poderesGranted = Array.isArray(diff.granted) ? diff.granted : [];
  const poderesMissing = Array.isArray(diff.missing) ? diff.missing : [];

  // ============================================================
  // HTML
  // ============================================================
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatorio Consolidado — ${esc(clienteNome)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; margin: 0; padding: 0; }
  h1 { font-size: 22px; margin: 0; color: #4c1d95; }
  h2 { font-size: 14px; margin: 18px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #7c3aed; color: #4c1d95; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 12px 0 6px 0; color: #1f2937; }
  .header { background: linear-gradient(135deg,#7c3aed,#3b82f6); color: white; padding: 18px 20px; border-radius: 8px; margin-bottom: 16px; }
  .header h1 { color: white; }
  .header .sub { font-size: 11px; opacity: .9; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 12px; }
  .box { background: #f8f9fc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
  .box .label { font-size: 9px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: .5px; }
  .box .value { font-size: 12px; color: #111; font-weight: 600; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-gray { background: #e5e7eb; color: #374151; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }
  th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-weight: 700; border-bottom: 1px solid #d1d5db; color: #374151; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .poderes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .poderes-col { font-size: 10px; }
  .poderes-col ul { margin: 4px 0; padding-left: 18px; }
  .poderes-col li { margin: 2px 0; }
  .timeline { border-left: 2px solid #c084fc; margin-left: 8px; padding-left: 14px; }
  .timeline-item { margin-bottom: 8px; position: relative; }
  .timeline-item:before { content: ''; position: absolute; left: -19px; top: 4px; width: 8px; height: 8px; background: #7c3aed; border-radius: 50%; }
  .timeline-item .when { font-size: 9px; color: #6b7280; }
  .timeline-item .what { font-size: 11px; font-weight: 600; color: #111; }
  .timeline-item .desc { font-size: 10px; color: #4b5563; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
  .score-pill { display: inline-block; padding: 6px 14px; border-radius: 18px; font-weight: 700; font-size: 13px; }
  .alerta { background: #fee2e2; border: 1px solid #f87171; padding: 10px; border-radius: 6px; color: #991b1b; margin: 8px 0; }
  .ok { background: #d1fae5; border: 1px solid #10b981; padding: 10px; border-radius: 6px; color: #065f46; margin: 8px 0; }
  .page-break { page-break-before: always; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>

<div class="header">
  <h1>Relatório Consolidado e-CAC</h1>
  <div class="sub">CONSULTRI · Procuração Eletrônica · Gerado em ${esc(fmtDate(new Date()))}</div>
</div>

<h2>1. Identificação</h2>
<div class="meta">
  <div class="box"><div class="label">Cliente</div><div class="value">${esc(clienteNome)}</div></div>
  <div class="box"><div class="label">CNPJ do Outorgante</div><div class="value">${esc(clienteCnpj)}</div></div>
  <div class="box"><div class="label">Procurador</div><div class="value">${esc(proc.procuradorNome || '—')}</div></div>
  <div class="box"><div class="label">CNPJ do Procurador</div><div class="value">${esc(proc.procuradorCnpj || '—')}</div></div>
  <div class="box"><div class="label">Status</div><div class="value">
    ${proc.serproStatus === 'active' ? '<span class="badge badge-green">Ativa no SERPRO</span>' :
      proc.serproStatus === 'partial' ? '<span class="badge badge-yellow">Parcial</span>' :
      proc.serproStatus === 'revoked_detected' ? '<span class="badge badge-red">Revogada</span>' :
      '<span class="badge badge-gray">' + esc(proc.serproStatus || 'pendente') + '</span>'}
  </div></div>
  <div class="box"><div class="label">Validade</div><div class="value">${esc(fmtDate(proc.dataValidade))}</div></div>
  <div class="box"><div class="label">Última verificação SERPRO</div><div class="value">${esc(fmtDate(proc.lastSerproCheckAt))}</div></div>
  <div class="box"><div class="label">Modo de outorga</div><div class="value">${esc(proc.grantMode || '—')}</div></div>
</div>

<h2>2. Poderes e-CAC</h2>
<p><b>${poderesGranted.length}</b> poderes concedidos &middot; <b>${poderesMissing.length}</b> faltando</p>
<div class="poderes-grid">
  <div class="poderes-col">
    <h3 style="color:#065f46;">✓ Concedidos</h3>
    <ul>${poderesGranted.slice(0, 50).map((p: string) => `<li>${esc(p)}</li>`).join('') || '<li><i>nenhum</i></li>'}</ul>
  </div>
  <div class="poderes-col">
    <h3 style="color:#991b1b;">✗ Faltando</h3>
    <ul>${poderesMissing.slice(0, 50).map((p: string) => `<li>${esc(p)}</li>`).join('') || '<li><i>nenhum — outorga completa</i></li>'}</ul>
  </div>
</div>

${snap ? `
<h2>3. Conformidade (último snapshot)</h2>
<div class="meta">
  <div class="box"><div class="label">Coletado em</div><div class="value">${esc(fmtDate(snap.collectedAt))}</div></div>
  <div class="box"><div class="label">Score</div><div class="value"><span class="score-pill" style="background:${(snap.score || 0) >= 80 ? '#d1fae5' : (snap.score || 0) >= 60 ? '#fef3c7' : '#fee2e2'};color:${(snap.score || 0) >= 80 ? '#065f46' : (snap.score || 0) >= 60 ? '#92400e' : '#991b1b'};">${snap.score || 0}/100</span></div></div>
  <div class="box"><div class="label">Caixa Postal não-lida</div><div class="value">${snap.caixaPostalUnread || 0}</div></div>
  <div class="box"><div class="label">Pendências fiscais</div><div class="value">${snap.situacaoPendencias || 0}</div></div>
</div>` : ''}

${caixaData ? `
<h2>4. Caixa Postal e-CAC (consulta ao vivo)</h2>
<pre style="background:#f8f9fc;padding:10px;border-radius:6px;font-size:9px;overflow:hidden;white-space:pre-wrap;">${esc(JSON.stringify(caixaData, null, 2).slice(0, 2000))}</pre>` : ''}

${sitFisData ? `
<h2>5. Situação Fiscal (consulta ao vivo)</h2>
<pre style="background:#f8f9fc;padding:10px;border-radius:6px;font-size:9px;overflow:hidden;white-space:pre-wrap;">${esc(JSON.stringify(sitFisData, null, 2).slice(0, 2000))}</pre>` : ''}

${crossAnalysis ? `
<div class="page-break"></div>
<h2>6. Análise Cruzada — DIRF × Fontes Pagadoras (${opts.anoBase})</h2>
<div class="meta">
  <div class="box"><div class="label">Total DIRF</div><div class="value">${fmtMoney(crossAnalysis.resumo.totalDeclaradoDirf)}</div></div>
  <div class="box"><div class="label">Total Fontes</div><div class="value">${fmtMoney(crossAnalysis.resumo.totalRecebidoFontes)}</div></div>
  <div class="box"><div class="label">Diferença</div><div class="value" style="color:${Math.abs(crossAnalysis.resumo.diferencaTotal) > 1000 ? '#991b1b' : '#065f46'};">${fmtMoney(crossAnalysis.resumo.diferencaTotal)}</div></div>
  <div class="box"><div class="label">Classificação</div><div class="value"><span class="score-pill" style="background:${crossAnalysis.resumo.classificacao === 'baixo' ? '#d1fae5' : crossAnalysis.resumo.classificacao === 'medio' ? '#fef3c7' : '#fee2e2'};color:${crossAnalysis.resumo.classificacao === 'baixo' ? '#065f46' : crossAnalysis.resumo.classificacao === 'medio' ? '#92400e' : '#991b1b'};">${esc(crossAnalysis.resumo.classificacao.toUpperCase())} · ${crossAnalysis.resumo.scoreRisco}/100</span></div></div>
</div>
${crossAnalysis.teses?.length ? `
<h3>Teses tributárias detectadas</h3>
<ul>${crossAnalysis.teses.map((t: string) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
${crossAnalysis.divergencias?.length ? `
<h3>Divergências (${crossAnalysis.divergencias.length})</h3>
<table>
  <thead><tr><th>Sev</th><th>Tipo</th><th>Fonte</th><th>DIRF</th><th>Fonte</th><th>Diferença</th><th>Descrição</th></tr></thead>
  <tbody>
    ${crossAnalysis.divergencias.slice(0, 50).map((d: any) => `
      <tr>
        <td><span class="badge ${d.severity === 'critical' ? 'badge-red' : d.severity === 'high' ? 'badge-yellow' : 'badge-gray'}">${esc(d.severity)}</span></td>
        <td>${esc(d.tipo)}</td>
        <td><b>${esc(d.nomeFonte || '—')}</b><br/><span style="color:#6b7280;font-size:9px;">${esc(d.cnpjFonte || '')}</span></td>
        <td style="text-align:right;">${fmtMoney(d.valorDirf)}</td>
        <td style="text-align:right;">${fmtMoney(d.valorFonte)}</td>
        <td style="text-align:right;color:${(d.diferenca || 0) > 0 ? '#92400e' : '#065f46'};">${fmtMoney(d.diferenca)}</td>
        <td style="font-size:9px;">${esc(d.descricao)}</td>
      </tr>`).join('')}
  </tbody>
</table>` : '<div class="ok">✓ Nenhuma divergência detectada — declaração consistente</div>'}
` : ''}

<div class="page-break"></div>
<h2>7. Linha do tempo — auditoria da procuração</h2>
<div class="timeline">
  ${audits.map(a => `
    <div class="timeline-item">
      <div class="when">${esc(fmtDate(a.createdAt))}</div>
      <div class="what">${esc(a.event)}</div>
      ${a.message ? `<div class="desc">${esc(a.message)}</div>` : ''}
    </div>`).join('') || '<i>Sem eventos registrados</i>'}
</div>

<div class="footer">
  Relatório gerado automaticamente pela plataforma TaxCredit · CONSULTRI · ${esc(new Date().toISOString())} <br/>
  Dados extraídos via SERPRO Integra Contador através de procuração eletrônica e-CAC válida.
</div>

<div class="no-print" style="position:fixed;bottom:16px;right:16px;background:#7c3aed;color:white;padding:10px 16px;border-radius:8px;font-size:12px;cursor:pointer;" onclick="window.print()">🖨️ Imprimir / Salvar PDF</div>

</body>
</html>`;

  return html;
}
