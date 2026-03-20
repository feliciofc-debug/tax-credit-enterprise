import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

function generateWatermarkId(userId: string, timestamp: number): string {
  const hash = crypto.createHash('sha256')
    .update(`${userId}:${timestamp}:${process.env.WATERMARK_SECRET || 'tcent-wm-2026'}`)
    .digest('hex')
    .substring(0, 12);
  return `TCE-${hash.toUpperCase()}`;
}

function generateInvisibleWatermark(userId: string, timestamp: number): string {
  const data = `${userId}|${timestamp}`;
  const encoded = Buffer.from(data).toString('base64');
  return encoded.split('').map(c => {
    const zeroWidth = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    return c + zeroWidth[c.charCodeAt(0) % 4];
  }).join('');
}

export function addWatermarkToText(text: string, userId: string): string {
  const timestamp = Date.now();
  const wmId = generateWatermarkId(userId, timestamp);
  const invisible = generateInvisibleWatermark(userId, timestamp);
  const dateStr = new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const footer = `\n${'='.repeat(73)}\nDOCUMENTO RASTREAVEL — ID: ${wmId}\nGerado em: ${dateStr} | TaxCredit Enterprise\nEste documento contem marcas digitais para rastreamento de uso indevido.\n${'='.repeat(73)}`;

  return `${invisible}${text}${footer}`;
}

export function addWatermarkToHtml(html: string, userId: string): string {
  const timestamp = Date.now();
  const wmId = generateWatermarkId(userId, timestamp);
  const dateStr = new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const watermarkCss = `
    <style>
      .tce-watermark {
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 80px; color: rgba(0,0,0,0.03);
        font-weight: bold; pointer-events: none;
        z-index: 9999; white-space: nowrap;
        font-family: Arial, sans-serif;
      }
      .tce-watermark-footer {
        margin-top: 30px; padding: 10px;
        border-top: 2px solid #e5e7eb;
        font-size: 9px; color: #9ca3af;
        text-align: center; font-family: monospace;
      }
      @media print {
        .tce-watermark { color: rgba(0,0,0,0.02); }
      }
    </style>
  `;

  const watermarkDiv = `<div class="tce-watermark">TAXCREDIT ENTERPRISE</div>`;
  const footerDiv = `<div class="tce-watermark-footer">
    Documento Rastreavel — ID: ${wmId} | Gerado: ${dateStr} | TaxCredit Enterprise — ATOM BRASIL DIGITAL LTDA
  </div>`;

  const hiddenSpan = `<span style="font-size:0;color:transparent;position:absolute;left:-9999px" data-tce="${wmId}">${wmId}</span>`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${watermarkCss}</head>`);
  }
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${watermarkDiv}${hiddenSpan}${footerDiv}</body>`);
  }

  return html;
}

export function watermarkResponseMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  const userId = (req as any).user?.id || (req as any).user?.email || 'anonymous';

  res.json = function(body: any) {
    if (body && typeof body === 'object') {
      if (body.data?.document && typeof body.data.document === 'string') {
        body.data.document = addWatermarkToText(body.data.document, userId);
      }
      if (body.data?.documents && Array.isArray(body.data.documents)) {
        body.data.documents = body.data.documents.map((d: any) => {
          if (d.document && typeof d.document === 'string') {
            d.document = addWatermarkToText(d.document, userId);
          }
          return d;
        });
      }
      if (body.data?.html && typeof body.data.html === 'string') {
        body.data.html = addWatermarkToHtml(body.data.html, userId);
      }
    }
    return originalJson(body);
  } as any;

  next();
}
