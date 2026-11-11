CREATE TABLE "RecoveryCode" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" INTEGER NOT NULL REFERENCES "AppOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "codeHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");
CREATE INDEX "RecoveryCode_ownerId_expiresAt_idx" ON "RecoveryCode"("ownerId","expiresAt");
CREATE TABLE "DataCleanup" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" INTEGER NOT NULL REFERENCES "AppOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "cutoff" TIMESTAMP(3) NOT NULL, "reviewBodies" INTEGER NOT NULL, "failedBodies" INTEGER NOT NULL,
 "accessRecords" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CleanupPreview" (
 "ownerId" INTEGER NOT NULL PRIMARY KEY REFERENCES "AppOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "id" TEXT NOT NULL, "cutoff" TIMESTAMP(3) NOT NULL, "importIds" TEXT[] NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CleanupPreview_id_key" ON "CleanupPreview"("id");
