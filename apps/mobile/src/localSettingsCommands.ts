import {
  previewLocalReconciliation,
  setCommerceRule,
  validateLocalAccounts,
  type Category,
  type CommerceRule,
  type CommerceRuleDraft,
  type LocalAccount,
  type LocalReconciliation,
  type Movement,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { restoreLocalBackup } from './localBackup';
import { newLocalId } from './localRecords';
import type { LocalData, LocalUpdate } from './storage';

export function localSettingsCommands(persist: (update: LocalUpdate) => Promise<void>) {
  function updateAccounts(update: (accounts: LocalAccount[]) => LocalAccount[]) {
    return persist((current) => {
      const accounts = update(current.accounts);
      validateLocalAccounts(accounts);
      return { ...current, accounts };
    });
  }

  function updateRules(scope: LocalScope, update: (rules: CommerceRule[]) => CommerceRule[]) {
    return persist((current) => ({
      ...current,
      commerceRules: {
        ...current.commerceRules,
        [scope]: update(current.commerceRules[scope] ?? []),
      },
    }));
  }

  return {
    createAccount(input: Omit<LocalAccount, 'id' | 'archived'>) {
      return updateAccounts((accounts) => [
        ...accounts,
        { ...input, id: newLocalId(), archived: false },
      ]);
    },

    updateAccount(id: string, changes: Partial<Pick<LocalAccount, 'name' | 'archived'>>) {
      return updateAccounts((accounts) =>
        accounts.map((account) => (account.id === id ? { ...account, ...changes } : account)),
      );
    },

    reconcile(preview: LocalReconciliation) {
      return persist((current) => {
        const { accountId, occurredAt, statementMinor } = preview;
        const verified = previewLocalReconciliation(current.accounts, current.movements, {
          accountId,
          occurredAt,
          statementMinor,
        });
        if (verified.expectedMinor !== preview.expectedMinor || verified.differenceMinor === 0)
          throw new Error('El saldo cambió. Compara los saldos de nuevo.');
        const account = current.accounts.find((item) => item.id === accountId)!;
        const category = current.categories.find((item) => item.system)!;
        const movement: Movement = {
          id: 'adjustment-' + newLocalId(),
          description: `Ajuste de conciliación · ${account.name}`,
          type: 'TRANSFER',
          currency: account.currency,
          category: category.name,
          categoryId: category.id,
          occurredAt,
          amountMinor: Math.abs(verified.differenceMinor),
          accountId,
          balanceAdjustment: { expectedMinor: verified.expectedMinor, statementMinor },
        };
        return { ...current, movements: [movement, ...current.movements] };
      });
    },

    restore(backup: LocalData, expected: LocalData) {
      return persist((current) => {
        if (current !== expected)
          throw new Error('Los datos locales cambiaron. Selecciona el respaldo de nuevo.');
        return restoreLocalBackup(current, backup);
      });
    },

    saveRule(scope: LocalScope, categories: Category[], draft: CommerceRuleDraft, id?: string) {
      return updateRules(scope, (rules) => {
        if (
          !categories.some((item) => item.id === draft.categoryId && !item.archived && !item.system)
        )
          throw new Error('Selecciona una categoría activa.');
        return setCommerceRule(rules, { ...draft, id: id ?? newLocalId() });
      });
    },

    removeRule(scope: LocalScope, id: string) {
      return updateRules(scope, (rules) => rules.filter((rule) => rule.id !== id));
    },
  };
}
