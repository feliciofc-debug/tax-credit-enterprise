// src/utils/logger.ts
// Logger otimizado para Vercel (serverless) — sem file transport em produção

import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

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

// Em produção (Vercel): apenas console com JSON (Vercel captura stdout/stderr)
// Em desenvolvimento: console com cores + arquivos locais
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? jsonFormat : consoleFormat,
  }),
];

// Arquivos de log apenas em desenvolvimento (Vercel não persiste filesystem)
if (!isProduction) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: jsonFormat,
  transports,
});
