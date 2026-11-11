CREATE TYPE "AccountKind" AS ENUM ('BANK','CASH','CREDIT_CARD','LOAN');
CREATE TABLE "FinanceLock" (id INTEGER PRIMARY KEY CHECK (id=1));
INSERT INTO "FinanceLock" (id) VALUES (1);
CREATE TABLE "FinancialAccount" (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, currency "Currency" NOT NULL, kind "AccountKind" NOT NULL,
 "openingMinor" INTEGER NOT NULL, "creditLimitMinor" INTEGER, archived BOOLEAN NOT NULL DEFAULT false,
 revision INTEGER NOT NULL DEFAULT 0, "reconciledThrough" TEXT,
 CHECK ("creditLimitMinor" IS NULL OR (kind='CREDIT_CARD' AND "creditLimitMinor">0)),
 CHECK (kind NOT IN ('CREDIT_CARD','LOAN') OR "openingMinor"<=0)
);
ALTER TABLE "Movement" ADD COLUMN "accountId" TEXT REFERENCES "FinancialAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "targetAccountId" TEXT REFERENCES "FinancialAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "requestKey" TEXT;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_account_pair" CHECK (
 ("accountId" IS NULL AND "targetAccountId" IS NULL) OR
 ("accountId" IS NOT NULL AND ((type='TRANSFER' AND "targetAccountId" IS NOT NULL AND "targetAccountId"<>"accountId") OR (type<>'TRANSFER' AND "targetAccountId" IS NULL)))
);
CREATE UNIQUE INDEX "Movement_requestKey_key" ON "Movement"("requestKey");
CREATE INDEX "Movement_accountId_occurredAt_idx" ON "Movement"("accountId","occurredAt");
CREATE INDEX "Movement_targetAccountId_occurredAt_idx" ON "Movement"("targetAccountId","occurredAt");
CREATE TABLE "Reconciliation" (
 id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "FinancialAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "asOf" TEXT NOT NULL, "balanceMinor" BIGINT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Reconciliation_accountId_asOf_key" ON "Reconciliation"("accountId","asOf");
CREATE TABLE "BudgetPeriod" (id TEXT PRIMARY KEY, month TEXT NOT NULL, currency "Currency" NOT NULL, version INTEGER NOT NULL DEFAULT 1, "limitMinor" INTEGER CHECK ("limitMinor">0));
CREATE UNIQUE INDEX "BudgetPeriod_month_currency_key" ON "BudgetPeriod"(month,currency);
CREATE TABLE "BudgetCategory" (
 "periodId" TEXT NOT NULL REFERENCES "BudgetPeriod"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "categoryId" TEXT NOT NULL REFERENCES "Category"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "limitMinor" INTEGER NOT NULL CHECK ("limitMinor">0), PRIMARY KEY ("periodId","categoryId")
);
CREATE TABLE "MovementRequest" (key TEXT PRIMARY KEY, "movementId" TEXT UNIQUE REFERENCES "Movement"(id) ON DELETE SET NULL ON UPDATE CASCADE);
