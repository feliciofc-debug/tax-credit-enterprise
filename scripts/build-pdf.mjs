// scripts/build-pdf.mjs
// Gera o PDF do deck Consultri usando Puppeteer e salva na area de trabalho.

import puppeteer from 'puppeteer';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'deck-consultri.html');
const outputPath = path.join(os.homedir(), 'Desktop', 'TaxCredit-Consultri.pdf');

console.log('============================================================');
console.log(' TaxCredit · Geracao de PDF da apresentacao Consultri');
console.log('============================================================');
console.log(' HTML:   ' + htmlPath);
console.log(' Output: ' + outputPath);
console.log('');

(async () => {
  const start = Date.now();

  console.log('[1/4] Abrindo navegador headless...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  console.log('[2/4] Carregando HTML do deck...');
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });

  console.log('[3/4] Gerando PDF (22 slides, A4 paisagem)...');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('[4/4] PDF gerado com sucesso em ' + elapsed + 's');
  console.log('');
  console.log('============================================================');
  console.log(' Salvo em: ' + outputPath);
  console.log(' Abra-o no Adobe Reader ou Chrome para revisar.');
  console.log('============================================================');
})().catch(err => {
  console.error('');
  console.error('ERRO ao gerar PDF:');
  console.error(err);
  process.exit(1);
});
