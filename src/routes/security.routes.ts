import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getBlockedIps, getAllTrackedIps, unblockIp, blockIp, addBlockedRange, getBlockedRanges, addWhitelistIp, getWhitelistIps, getAttackReport } from '../middleware/antiScraping';

const router = Router();

router.get('/dashboard', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const suspiciousIps = getBlockedIps();
    const allIps = getAllTrackedIps();
    const blocked = suspiciousIps.filter(i => i.record.blocked);
    const watching = suspiciousIps.filter(i => !i.record.blocked);
    const ranges = getBlockedRanges();

    return res.json({
      success: true,
      data: {
        summary: {
          totalBlocked: blocked.length,
          totalWatching: watching.length,
          totalTracked: allIps.length,
          totalRanges: ranges.length,
        },
        blocked,
        watching,
        allConnected: allIps.slice(0, 50),
        blockedRanges: ranges,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/block', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP obrigatorio' });
    blockIp(ip);
    return res.json({ success: true, message: `IP ${ip} bloqueado permanentemente` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/unblock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP obrigatorio' });
    const success = unblockIp(ip);
    return res.json({ success, message: success ? `IP ${ip} desbloqueado` : 'IP nao encontrado' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/block-range', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prefix, reason } = req.body;
    if (!prefix) return res.status(400).json({ success: false, error: 'Prefixo obrigatorio (ex: 178.156.)' });
    addBlockedRange(prefix, reason || `Faixa bloqueada manualmente: ${prefix}`);
    return res.json({ success: true, message: `Faixa ${prefix}* bloqueada` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/blocked-ranges', authenticateToken, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: getBlockedRanges() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/attack-report', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const report = await getAttackReport();
    return res.json({ success: true, data: report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/whitelist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP obrigatorio' });
    addWhitelistIp(ip);
    return res.json({ success: true, message: `IP ${ip} adicionado a whitelist` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/whitelist', authenticateToken, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: getWhitelistIps() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
