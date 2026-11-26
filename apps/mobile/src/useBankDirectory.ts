import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dominicanBanks, type BankRegistration } from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { ApiRequest } from './apiClient';
import type { LocalUpdate } from './storage';

export function useBankDirectory({
  dataScope,
  connected,
  enabled,
  bankIds,
  request,
  persist,
}: {
  dataScope: LocalScope;
  connected: boolean;
  enabled: boolean;
  bankIds: string[];
  request: ApiRequest;
  persist: (change: LocalUpdate) => Promise<void>;
}) {
  const client = useQueryClient();
  const bankDirectory = useQuery({
    queryKey: ['banks', dataScope],
    enabled,
    retry: false,
    queryFn: async (): Promise<BankRegistration[]> => request('/banks'),
  });
  const banks = connected
    ? (bankDirectory.data ?? [])
    : dominicanBanks.map((bank) => ({ ...bank, registered: bankIds.includes(bank.id) }));

  async function changeBank(id: string, registered: boolean) {
    if (connected) {
      await request(`/banks/${id}`, { method: 'PATCH', body: JSON.stringify({ registered }) });
      client.setQueryData<BankRegistration[]>(['banks', dataScope], (current) =>
        current?.map((bank) => (bank.id === id ? { ...bank, registered } : bank)),
      );
      await client.invalidateQueries({ queryKey: ['banks', dataScope] });
    } else {
      await persist((current) => {
        const bankIds = new Set(current.bankIds);
        if (registered) bankIds.add(id);
        else bankIds.delete(id);
        return { ...current, bankIds: [...bankIds] };
      });
    }
  }

  return { bankDirectory, banks, changeBank };
}
