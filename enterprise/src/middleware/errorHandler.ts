import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Multer errors
  if (err.message.includes('File too large')) {
    return res.status(413).json({
      success: false,
      error: 'Arquivo muito grande',
      message: 'O arquivo excede o tamanho máximo permitido'
    });
  }

  if (err.message.includes('Tipo de arquivo não permitido')) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de arquivo inválido',
      message: err.message
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  });
};
