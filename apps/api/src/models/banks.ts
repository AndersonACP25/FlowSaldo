import { db } from '@flowsaldo/database';
import type { BankRegistration } from '@flowsaldo/domain';

export async function listBanks(ownerId: number): Promise<BankRegistration[]> {
  const banks = await db.bank.findMany({
    select: { id: true, name: true, owners: { where: { ownerId }, select: { bankId: true } } },
    orderBy: { name: 'asc' },
  });
  return banks.map(({ id, name, owners }) => ({ id, name, registered: owners.length > 0 }));
}

export async function setBankRegistration(ownerId: number, bankId: string, registered: boolean) {
  const bank = await db.bank.findUnique({ where: { id: bankId } });
  if (!bank) return false;
  if (registered) {
    await db.ownerBank.createMany({ data: { ownerId, bankId }, skipDuplicates: true });
  } else {
    await db.ownerBank.deleteMany({ where: { ownerId, bankId } });
  }
  return true;
}
