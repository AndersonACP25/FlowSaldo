CREATE TABLE "RecurringTemplate" (
 "id" TEXT NOT NULL PRIMARY KEY, "version" INTEGER NOT NULL DEFAULT 0, "description" TEXT NOT NULL,
 "amountMinor" INTEGER NOT NULL CHECK ("amountMinor">0), "currency" "Currency" NOT NULL, "type" "MovementType" NOT NULL,
 "category" TEXT NOT NULL, "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "startDate" TEXT NOT NULL, "nextDate" TEXT NOT NULL, "anchorDay" INTEGER NOT NULL CHECK ("anchorDay" BETWEEN 1 AND 31), "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "RecurringOccurrence" (
 "id" TEXT NOT NULL PRIMARY KEY, "templateId" TEXT NOT NULL REFERENCES "RecurringTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "scheduledFor" TEXT NOT NULL, "movementId" TEXT REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RecurringOccurrence_movementId_key" ON "RecurringOccurrence"("movementId");
CREATE UNIQUE INDEX "RecurringOccurrence_templateId_scheduledFor_key" ON "RecurringOccurrence"("templateId","scheduledFor");
