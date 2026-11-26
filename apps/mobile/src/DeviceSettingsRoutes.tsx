import React from 'react';
import type { Category, CommerceRule, Currency } from '@flowsaldo/domain';
import { BackupSettings } from './BackupSettings';
import { CommerceRulesScreen } from './CommerceRulesScreen';
import type { LocalScope } from './dataScopes';
import { LocalAccountsScreen } from './LocalAccountsScreen';
import { localSettingsCommands } from './localSettingsCommands';
import type { LocalData, LocalUpdate } from './storage';

type DeviceSettingsScreen = 'Cuentas y saldos' | 'Respaldo y restauración' | 'Reglas por comercio';

export function DeviceSettingsRoutes({
  screen,
  connected,
  busy,
  local,
  dataScope,
  currency,
  money,
  catalogReady,
  categoryCatalog,
  commerceRules,
  persist,
  saveForm,
  onLocalRestored,
}: {
  screen: DeviceSettingsScreen;
  connected: boolean;
  busy: boolean;
  local: LocalData;
  dataScope: LocalScope;
  currency: Currency;
  money: (minor: number, currency: Currency) => string;
  catalogReady: boolean;
  categoryCatalog: Category[];
  commerceRules: CommerceRule[];
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
  onLocalRestored: () => void;
}) {
  const commands = localSettingsCommands(persist);

  switch (screen) {
    case 'Cuentas y saldos':
      return connected ? null : (
        <LocalAccountsScreen
          accounts={local.accounts}
          movements={local.movements}
          currency={currency}
          money={money}
          busy={busy}
          onCreate={(input) => saveForm(() => commands.createAccount(input))}
          onUpdate={(id, changes) => saveForm(() => commands.updateAccount(id, changes))}
          onReconcile={(preview) => saveForm(() => commands.reconcile(preview))}
        />
      );
    case 'Respaldo y restauración':
      return connected ? null : (
        <BackupSettings
          local={local}
          busy={busy}
          onRestore={(backup, expected) =>
            saveForm(async () => {
              await commands.restore(backup, expected);
              onLocalRestored();
            })
          }
        />
      );
    case 'Reglas por comercio':
      return !catalogReady ? null : (
        <CommerceRulesScreen
          rules={commerceRules}
          categories={categoryCatalog}
          saving={busy}
          onSave={(draft, id) =>
            saveForm(() => commands.saveRule(dataScope, categoryCatalog, draft, id))
          }
          onRemove={(id) => saveForm(() => commands.removeRule(dataScope, id))}
        />
      );
  }
}
