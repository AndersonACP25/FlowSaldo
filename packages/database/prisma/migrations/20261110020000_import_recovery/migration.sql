ALTER TYPE "ImportStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "ImportStatus" ADD VALUE 'FAILED';
ALTER TABLE "MailImport"
 ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts">=0),
 ADD COLUMN "manualRetries" INTEGER NOT NULL DEFAULT 0 CHECK ("manualRetries">=0),
 ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
 ADD COLUMN "lockedUntil" TIMESTAMP(3),
 ADD COLUMN "lockToken" TEXT,
 ADD COLUMN "lastErrorCode" TEXT,
 ADD COLUMN "processedAt" TIMESTAMP(3);
CREATE INDEX "MailImport_status_nextAttemptAt_idx" ON "MailImport"("status","nextAttemptAt");
