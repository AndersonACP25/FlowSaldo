CREATE TABLE "Category" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "name" TEXT NOT NULL,
 "normalizedName" TEXT NOT NULL,
 "archived" BOOLEAN NOT NULL DEFAULT false,
 "system" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "Category_normalizedName_key" ON "Category"("normalizedName");
-- Preserve every movement label. Stable identifiers link historical labels to the catalog.
WITH names AS (
 SELECT unnest(ARRAY['Sin categorizar','Alimentación','Transporte','Servicios','Salario','Ocio','Transferencias']) AS name
 UNION SELECT "category" FROM "Movement"
), normalized AS (
 SELECT regexp_replace(trim(name), '\s+', ' ', 'g') AS name,
 lower(regexp_replace(trim(name), '\s+', ' ', 'g')) AS key FROM names
)
INSERT INTO "Category" ("id","name","normalizedName","system")
 SELECT 'category-'||md5(key),min(name),key,key='sin categorizar' FROM normalized GROUP BY key;
ALTER TABLE "Movement" ADD COLUMN "categoryId" TEXT;
UPDATE "Movement" m SET "categoryId"=c.id FROM "Category" c
 WHERE c."normalizedName"=lower(regexp_replace(trim(m.category), '\s+', ' ', 'g'));
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Movement_categoryId_idx" ON "Movement"("categoryId");
