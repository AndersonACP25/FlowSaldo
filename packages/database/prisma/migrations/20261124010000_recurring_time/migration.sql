ALTER TABLE "RecurringTemplate" ADD COLUMN "timeOfDay" TEXT;
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_timeOfDay_check"
  CHECK ("timeOfDay" IS NULL OR "timeOfDay" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
