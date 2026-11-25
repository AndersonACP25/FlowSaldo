ALTER TABLE "Movement" ADD COLUMN "refundOfId" TEXT;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_refundOfId_fkey"
    FOREIGN KEY ("refundOfId") REFERENCES "Movement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_refund_shape"
    CHECK ("refundOfId" IS NULL OR ("refundOfId" <> id AND type = 'INCOME' AND "amountMinor" > 0));
CREATE INDEX "Movement_refundOfId_idx" ON "Movement"("refundOfId");
