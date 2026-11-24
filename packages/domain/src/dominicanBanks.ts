export interface Bank {
  id: string;
  name: string;
}

export interface BankRegistration extends Bank {
  registered: boolean;
}

// El modo local usa el mismo catálogo inicial que la migración dominican_banks.
export const dominicanBanks: readonly Bank[] = [
  { id: 'banco-ademi', name: 'Banco Ademi' },
  { id: 'banco-adopem', name: 'Banco Adopem' },
  { id: 'banco-agricola', name: 'Banco Agrícola' },
  { id: 'banco-atlantico', name: 'Banco Atlántico' },
  { id: 'banco-bacc', name: 'Banco BACC' },
  { id: 'banco-bdi', name: 'Banco BDI' },
  { id: 'banco-bhd', name: 'Banco BHD' },
  { id: 'banco-caribe', name: 'Banco Caribe' },
  { id: 'banco-cofaci', name: 'Banco Cofaci' },
  { id: 'banco-confisa', name: 'Banco Confisa' },
  { id: 'banco-fihogar', name: 'Banco Fihogar' },
  { id: 'banco-gruficorp', name: 'Banco Gruficorp' },
  { id: 'banco-lafise', name: 'Banco Lafise' },
  { id: 'banco-lopez-de-haro', name: 'Banco López de Haro' },
  { id: 'banco-optima-de-ahorro-y-credito', name: 'Banco Óptima de Ahorro y Crédito' },
  { id: 'banco-popular', name: 'Banco Popular' },
  { id: 'banco-promerica', name: 'Banco Promerica' },
  { id: 'banco-santa-cruz', name: 'Banco Santa Cruz' },
  { id: 'banco-union', name: 'Banco Unión' },
  { id: 'banco-vimenca', name: 'Banco Vimenca' },
  { id: 'bancotui', name: 'Bancotui' },
  { id: 'bandex', name: 'Bandex' },
  { id: 'banesco', name: 'Banesco' },
  { id: 'banfondesa', name: 'Banfondesa' },
  { id: 'banreservas', name: 'Banreservas' },
  { id: 'bonanza', name: 'Bonanza' },
  { id: 'citibank', name: 'Citibank' },
  { id: 'jmmb-bank', name: 'JMMB Bank' },
  { id: 'leasing-confisa', name: 'Leasing Confisa' },
  { id: 'motor-credito', name: 'Motor Crédito' },
  { id: 'qik-banco-digital', name: 'Qik Banco Digital' },
  { id: 'scotiabank', name: 'Scotiabank' },
];
