// src/routes/conformidade-facil.routes.ts
// API Conformidade Fácil — consultas Reforma Tributária (IBS/CBS)

import { Router, Request, Response } from 'express';
import { conformidadeFacilService } from '../services/conformidade-facil.service';
import { authenticateToken } from '../middleware/auth';

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}

/**
 * GET /api/conformidade-facil/status
 * Verifica se a API está configurada e disponível
 */
router.get('/status', authenticateToken, requireAdmin, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      available: conformidadeFacilService.isAvailable(),
      message: conformidadeFacilService.isAvailable()
        ? 'Certificado carregado — API Conformidade Fácil disponível'
        : 'Certificado não configurado. Configure Secret File + CONFORMIDADE_FACIL_CERT_PASSWORD no Render.',
    },
  });
});

/**
 * GET /api/conformidade-facil/class-trib
 * Consulta tabela CST / cClassTrib (Classificação Tributária)
 * Query: codigoCST?, nomeCST?
 */
router.get('/class-trib', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const { codigoCST, nomeCST } = req.query;
  const result = await conformidadeFacilService.consultarClassTrib(
    codigoCST as string | undefined,
    nomeCST as string | undefined
  );
  if (result.success) {
    return res.json({ success: true, data: result.data });
  }
  return res.status(result.disabled ? 503 : 500).json({
    success: false,
    error: result.error,
    disabled: result.disabled,
  });
});

/**
 * GET /api/conformidade-facil/cred-presumido
 */
router.get('/cred-presumido', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const result = await conformidadeFacilService.consultarCredPresumido();
  if (result.success) {
    return res.json({ success: true, data: result.data });
  }
  return res.status(result.disabled ? 503 : 500).json({
    success: false,
    error: result.error,
    disabled: result.disabled,
  });
});

/**
 * GET /api/conformidade-facil/anexos
 */
router.get('/anexos', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const result = await conformidadeFacilService.consultarAnexos();
  if (result.success) {
    return res.json({ success: true, data: result.data });
  }
  return res.status(result.disabled ? 503 : 500).json({
    success: false,
    error: result.error,
    disabled: result.disabled,
  });
});

/**
 * GET /api/conformidade-facil/ind-oper
 */
router.get('/ind-oper', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const result = await conformidadeFacilService.consultarIndOper();
  if (result.success) {
    return res.json({ success: true, data: result.data });
  }
  return res.status(result.disabled ? 503 : 500).json({
    success: false,
    error: result.error,
    disabled: result.disabled,
  });
});

export default router;
