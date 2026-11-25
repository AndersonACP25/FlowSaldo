CREATE TABLE "MovementSplit" (
    "movementId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),

    CONSTRAINT "MovementSplit_pkey" PRIMARY KEY ("movementId", "categoryId"),
    CONSTRAINT "MovementSplit_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovementSplit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MovementSplit_categoryId_idx" ON "MovementSplit"("categoryId");
