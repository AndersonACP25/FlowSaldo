import type { DueReminder } from '@flowsaldo/domain';

export interface DueNotificationStatus {
  enabled: boolean;
  allowed: boolean;
  exact: boolean;
  scheduled: number;
}

export async function syncDueNotifications(
  reminders: DueReminder[],
): Promise<DueNotificationStatus> {
  void reminders;
  return { enabled: false, allowed: false, exact: false, scheduled: 0 };
}

export async function setDueNotificationsEnabled(enabled: boolean): Promise<void> {
  void enabled;
}

export async function allowExactDueNotifications(): Promise<void> {}
