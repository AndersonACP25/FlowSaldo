CREATE TABLE "Bank" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerBank" (
  "ownerId" INTEGER NOT NULL,
  "bankId" TEXT NOT NULL,
  CONSTRAINT "OwnerBank_pkey" PRIMARY KEY ("ownerId", "bankId"),
  CONSTRAINT "OwnerBank_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "AppOwner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OwnerBank_bankId_fkey"
    FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OwnerBank_bankId_idx" ON "OwnerBank" ("bankId");

-- Superintendencia de Bancos de la República Dominicana. Entidades operando.
-- https://www.sb.gob.do/supervisados/entidades-de-intermediacion-financiera/
INSERT INTO "Bank" ("id", "name") VALUES
  ('banco-ademi', 'Banco Ademi'),
  ('banco-adopem', 'Banco Adopem'),
  ('banco-agricola', 'Banco Agrícola'),
  ('banco-atlantico', 'Banco Atlántico'),
  ('banco-bacc', 'Banco BACC'),
  ('banco-bdi', 'Banco BDI'),
  ('banco-bhd', 'Banco BHD'),
  ('banco-caribe', 'Banco Caribe'),
  ('banco-cofaci', 'Banco Cofaci'),
  ('banco-confisa', 'Banco Confisa'),
  ('banco-fihogar', 'Banco Fihogar'),
  ('banco-gruficorp', 'Banco Gruficorp'),
  ('banco-lafise', 'Banco Lafise'),
  ('banco-lopez-de-haro', 'Banco López de Haro'),
  ('banco-optima-de-ahorro-y-credito', 'Banco Óptima de Ahorro y Crédito'),
  ('banco-popular', 'Banco Popular'),
  ('banco-promerica', 'Banco Promerica'),
  ('banco-santa-cruz', 'Banco Santa Cruz'),
  ('banco-union', 'Banco Unión'),
  ('banco-vimenca', 'Banco Vimenca'),
  ('bancotui', 'Bancotui'),
  ('bandex', 'Bandex'),
  ('banesco', 'Banesco'),
  ('banfondesa', 'Banfondesa'),
  ('banreservas', 'Banreservas'),
  ('bonanza', 'Bonanza'),
  ('citibank', 'Citibank'),
  ('jmmb-bank', 'JMMB Bank'),
  ('leasing-confisa', 'Leasing Confisa'),
  ('motor-credito', 'Motor Crédito'),
  ('qik-banco-digital', 'Qik Banco Digital'),
  ('scotiabank', 'Scotiabank');
