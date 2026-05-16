-- Onda 5A — Hub de Notificacoes in-app
-- Adiciona readAt, severity e link em Notification.

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "severity" TEXT,
  ADD COLUMN IF NOT EXISTS "link" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
