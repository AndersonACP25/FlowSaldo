-- A singleton owner intentionally preserves the personal installation and its existing data.
CREATE TABLE "AppOwner" (
 "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK ("id"=1),
 "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AppOwner_email_key" ON "AppOwner"("email");
CREATE TABLE "AccessSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" INTEGER NOT NULL REFERENCES "AppOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "AccessSession_tokenHash_key" ON "AccessSession"("tokenHash");
CREATE INDEX "AccessSession_ownerId_expiresAt_idx" ON "AccessSession"("ownerId","expiresAt");
CREATE TABLE "AuthThrottle" ("key" TEXT NOT NULL PRIMARY KEY, "startedAt" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL);
