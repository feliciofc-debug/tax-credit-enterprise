import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getBlockedIps, unblockIp, blockIp } from '../middleware/antiScraping';

const router = Router();

router.get('/dashboard', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const suspiciousIps = getBlockedIps();
    const blocked = suspiciousIps.filter(i => i.record.blocked);
    const watching = suspiciousIps.filter(i => !i.record.blocked);

    return res.json({
      success: true,
      data: {
        summary: {
          totalBlocked: blocked.length,
          totalWatching: watching.length,
          totalTracked: suspiciousIps.length,
        },
        blocked,
        watching,
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
    return res.json({ success: true, message: `IP ${ip} bloqueado` });
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

export default router;
