import React, { type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  previewLocalReconciliation,
  setCommerceRule,
  validateLocalAccounts,
  type BankRegistration,
  type Category,
  type CommerceRule,
  type Currency,
  type LocalAccount,
  type LocalReconciliation,
  type Movement,
} from '@flowsaldo/domain';
import { AboutApp } from './AboutApp';
import type { Owner, PersonalSession } from './access';
import { AccountSettings } from './AccountSettings';
import type { AuthRoute } from './AuthScreen';
import { BackupSettings } from './BackupSettings';
import { BankSettings } from './BankDirectory';
import { CategoryManager } from './CategoryManager';
import { CommerceRulesScreen } from './CommerceRulesScreen';
import { DataRetention } from './DataRetention';
import { hasUnassignedConnectedData, type LocalScope } from './dataScopes';
import { DueNotificationSettings } from './DueNotificationSettings';
import { FinancePanel, type FinancialAccount } from './FinancePanel';
import { GmailConnection } from './GmailConnection';
import { HelpScreen } from './HelpScreen';
import type { MovementRequest } from './history';
import { IconButton } from './IconButton';
import { LocalAccountsScreen } from './LocalAccountsScreen';
import { restoreLocalBackup } from './localBackup';
import { newLocalId } from './localRecords';
import { NotificationSettings } from './NotificationSettings';
import { PersonalAccount } from './PersonalAccount';
import type { Preferences } from './preferences';
import { RatesScreen } from './RatesScreen';
import { RecoverySettings } from './RecoverySettings';
import { SettingsMenu, type SettingsSection } from './SettingsMenu';
import type { LocalData, LocalUpdate } from './storage';
import { testAccount } from './testAccount';
import { useTheme } from './theme';
import { ThemeSettings } from './ThemeProvider';
import { Button, Choice } from './ui';

export function SettingsFeature({
  screen,
  onOpen,
  personal,
  onAuth,
  onLogout,
  onExpired,
  onProfileChanged,
  connected,
  busy,
  local,
  dataScope,
  persist,
  saveForm,
  onLocalRestored,
  currency,
  money,
  bankDirectory,
  banks,
  onBankChange,
  accountsQuery,
  request,
  dueNotificationSettings,
  onRetentionApplied,
  preferences,
  onSavePreferences,
  commerceRules,
  categoryCatalog,
  catalogReady,
  saveCategory,
  archiveCategory,
  deleteCategory,
}: {
  screen: SettingsSection | 'Configuración';
  onOpen: (screen: SettingsSection) => void;
  personal?: PersonalSession;
  onAuth: (route: AuthRoute) => void;
  onLogout: () => Promise<void>;
  onExpired: () => Promise<void>;
  onProfileChanged: (owner: Owner) => void;
  connected: boolean;
  busy: boolean;
  local: LocalData;
  dataScope: LocalScope;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
  onLocalRestored: () => void;
  currency: Currency;
  money: (minor: number, currency: Currency) => string;
  bankDirectory: Pick<UseQueryResult, 'isSuccess' | 'isError' | 'refetch'>;
  banks: BankRegistration[];
  onBankChange: (id: string, registered: boolean) => void;
  accountsQuery: UseQueryResult<FinancialAccount[]>;
  request: MovementRequest;
  dueNotificationSettings: ComponentProps<typeof DueNotificationSettings>;
  onRetentionApplied: () => Promise<void>;
  preferences: Preferences;
  onSavePreferences: (value: Preferences) => Promise<void>;
  commerceRules: CommerceRule[];
  categoryCatalog: Category[];
  catalogReady: boolean;
  saveCategory: (name: string, id?: string) => Promise<void>;
  archiveCategory: (id: string, archived: boolean) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  function saveLocalAccounts(update: (accounts: LocalAccount[]) => LocalAccount[]) {
    return persist((current) => {
      const accounts = update(current.accounts);
      validateLocalAccounts(accounts);
      return { ...current, accounts };
    });
  }
  async function saveLocalReconciliation(preview: LocalReconciliation) {
    await persist((current) => {
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
  }
  function updateCommerceRules(update: (rules: CommerceRule[]) => CommerceRule[]) {
    return saveForm(() => {
      return persist((current) => ({
        ...current,
        commerceRules: {
          ...current.commerceRules,
          [dataScope]: update(current.commerceRules[dataScope] ?? []),
        },
      }));
    });
  }

  return (
    <>
      {screen === 'Configuración' && (
        <SettingsMenu personal={!!personal} connected={connected} onOpen={onOpen} />
      )}
      {screen === 'Respaldo y restauración' && !connected && (
        <BackupSettings
          local={local}
          busy={busy}
          onRestore={(backup, expected) =>
            saveForm(async () => {
              await persist((current) => {
                if (current !== expected)
                  throw new Error('Los datos locales cambiaron. Selecciona el respaldo de nuevo.');
                return restoreLocalBackup(current, backup);
              });
              onLocalRestored();
            })
          }
        />
      )}
      {screen === 'Preguntas frecuentes' && <HelpScreen />}
      {screen === 'Acerca de la aplicación' && <AboutApp />}
      {screen === 'Apariencia' && <ThemeSettings />}
      {screen === 'Tasa del día' && <RatesScreen />}
      {screen === 'Mis bancos' &&
        (!connected || bankDirectory.isSuccess ? (
          <BankSettings banks={banks} busy={busy} local={!connected} onChange={onBankChange} />
        ) : (
          <View style={s.card}>
            <Text style={s.muted}>
              {bankDirectory.isError ? 'No se pudieron cargar los bancos.' : 'Cargando bancos…'}
            </Text>
            {bankDirectory.isError && (
              <Choice
                label="Reintentar bancos"
                selected={false}
                onPress={() => void bankDirectory.refetch()}
              />
            )}
          </View>
        ))}
      {screen === 'Cuentas y saldos' && !connected && (
        <LocalAccountsScreen
          accounts={local.accounts}
          movements={local.movements}
          currency={currency}
          money={money}
          busy={busy}
          onCreate={(input) =>
            saveForm(() =>
              saveLocalAccounts((accounts) => [
                ...accounts,
                { ...input, id: newLocalId(), archived: false },
              ]),
            )
          }
          onReconcile={(preview) => saveForm(() => saveLocalReconciliation(preview))}
          onUpdate={(id, changes) =>
            saveForm(() =>
              saveLocalAccounts((accounts) =>
                accounts.map((account) =>
                  account.id === id ? { ...account, ...changes } : account,
                ),
              ),
            )
          }
        />
      )}
      {screen === 'Cuentas y conciliación' &&
        connected &&
        (accountsQuery.isSuccess ? (
          <FinancePanel
            items={accountsQuery.data}
            request={request}
            money={money}
            onRefresh={async () => {
              await accountsQuery.refetch();
            }}
          />
        ) : (
          <View style={s.card}>
            <Text style={s.muted}>
              {accountsQuery.error ? 'No se pudieron cargar las cuentas.' : 'Cargando cuentas…'}
            </Text>
            {accountsQuery.error && (
              <Button label="Reintentar cuentas" onPress={() => void accountsQuery.refetch()} />
            )}
          </View>
        ))}
      {screen === 'Mi cuenta' &&
        (personal ? (
          <>
            <PersonalAccount
              session={personal}
              onLogout={onLogout}
              onPasswordChanged={onExpired}
              onProfileChanged={onProfileChanged}
            />
            {hasUnassignedConnectedData(local) && (
              <Text style={s.muted}>
                Este dispositivo conserva datos conectados antiguos sin servidor identificado.
                Permanecen fuera de la cuenta actual.
              </Text>
            )}
          </>
        ) : (
          <View style={s.card}>
            <Text style={s.title}>{testAccount.name}</Text>
            <Text style={s.muted}>{testAccount.email}</Text>
            <Button label="Ver inicio de sesión" onPress={() => onAuth('login')} />
            <Choice label="Registrarse" selected={false} onPress={() => onAuth('register')} />
            <IconButton icon="logout" label="Cerrar sesión" onPress={() => void onLogout()} />
          </View>
        ))}
      {screen === 'Notificaciones' &&
        (connected ? (
          personal && <NotificationSettings />
        ) : (
          <DueNotificationSettings {...dueNotificationSettings} />
        ))}
      {screen === 'Correo y Gmail' && personal && <GmailConnection token={personal.token} />}
      {screen === 'Seguridad y privacidad' && personal && (
        <>
          <RecoverySettings token={personal.token} />
          <DataRetention token={personal.token} onApplied={onRetentionApplied} />
        </>
      )}
      {screen === 'Preferencias' && (
        <AccountSettings preferences={preferences} onSave={onSavePreferences} />
      )}
      {screen === 'Reglas por comercio' && catalogReady && (
        <CommerceRulesScreen
          rules={commerceRules}
          categories={categoryCatalog}
          saving={busy}
          onSave={(draft, id) =>
            updateCommerceRules((rules) => {
              if (
                !categoryCatalog.some(
                  (category) =>
                    category.id === draft.categoryId && !category.archived && !category.system,
                )
              )
                throw new Error('Selecciona una categoría activa.');
              return setCommerceRule(rules, { ...draft, id: id ?? newLocalId() });
            })
          }
          onRemove={(id) => updateCommerceRules((rules) => rules.filter((rule) => rule.id !== id))}
        />
      )}
      {screen === 'Administrar categorías' && catalogReady && (
        <CategoryManager
          items={categoryCatalog}
          onSave={saveCategory}
          onArchive={archiveCategory}
          onDelete={deleteCategory}
        />
      )}
    </>
  );
}
