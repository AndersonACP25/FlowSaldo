CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PARSED', 'REVIEW');
CREATE TYPE "MovementType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE "Currency" AS ENUM ('DOP', 'USD');
CREATE TABLE "MailImport" (
 "id" TEXT NOT NULL PRIMARY KEY, "externalId" TEXT NOT NULL, "body" TEXT NOT NULL,
 "status" "ImportStatus" NOT NULL DEFAULT 'PENDING', "reason" TEXT,
 "parserVersion" TEXT NOT NULL DEFAULT 'demo-v1', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Movement" (
 "id" TEXT NOT NULL PRIMARY KEY, "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
 "currency" "Currency" NOT NULL, "type" "MovementType" NOT NULL,
 "description" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'Sin categorizar',
 "occurredAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "importId" TEXT REFERENCES "MailImport"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MailImport_externalId_key" ON "MailImport"("externalId");
CREATE INDEX "MailImport_status_createdAt_idx" ON "MailImport"("status", "createdAt");
CREATE UNIQUE INDEX "Movement_importId_key" ON "Movement"("importId");
CREATE INDEX "Movement_currency_occurredAt_idx" ON "Movement"("currency", "occurredAt");
