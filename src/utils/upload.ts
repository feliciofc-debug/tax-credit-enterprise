import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { logger } from './logger';

const UPLOAD_DIR = path.join(os.tmpdir(), 'taxcredit-uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB per file

export const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Read file buffer from disk (replaces file.buffer from memoryStorage).
 * Works with both disk and memory stored files.
 */
export function getFileBuffer(file: Express.Multer.File): Buffer {
  if (file.buffer) return file.buffer;
  if (file.path) return fs.readFileSync(file.path);
  throw new Error(`No buffer or path for file: ${file.originalname}`);
}

/**
 * Cleanup temp files after processing.
 * Call this in a finally block or after processing is done.
 */
export function cleanupFiles(files: Express.Multer.File | Express.Multer.File[] | undefined): void {
  if (!files) return;
  const fileList = Array.isArray(files) ? files : [files];
  for (const file of fileList) {
    if (file.path) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err: any) {
        logger.warn(`[UPLOAD] Failed to cleanup ${file.path}: ${err.message}`);
      }
    }
  }
}

/**
 * Periodic cleanup of old temp files (>2h).
 */
export function startTempCleanupJob(): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  setInterval(() => {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) return;
      const files = fs.readdirSync(UPLOAD_DIR);
      const now = Date.now();
      let cleaned = 0;
      for (const f of files) {
        const fp = path.join(UPLOAD_DIR, f);
        try {
          const stat = fs.statSync(fp);
          if (now - stat.mtimeMs > TWO_HOURS) {
            fs.unlinkSync(fp);
            cleaned++;
          }
        } catch { /* ignore */ }
      }
      if (cleaned > 0) logger.info(`[UPLOAD] Cleaned ${cleaned} stale temp files`);
    } catch { /* ignore */ }
  }, 30 * 60 * 1000); // every 30 minutes
}
