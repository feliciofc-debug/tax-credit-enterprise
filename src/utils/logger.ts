// src/utils/logger.ts
// Logger otimizado para serverless (Vercel/Render) — sem file transport em produção

import winston from 'winston';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production';
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Em produção/serverless: apenas console (logs vão para o dashboard do provider)
// Em desenvolvimento: console com cores + arquivos locais (se possível)
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction || isServerless ? jsonFormat : consoleFormat,
  }),
];

// Arquivos de log apenas em dev local (NUNCA em serverless — filesystem é read-only)
if (!isProduction && !isServerless) {
  try {
    // Tentar criar a pasta logs (se não existir)
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  } catch {
    // Se não conseguir criar a pasta (ex: filesystem read-only), ignora silenciosamente
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: jsonFormat,
  transports,
});
