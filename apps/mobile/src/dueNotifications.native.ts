import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dueReminderPrefix, planDueReminderUpdates, type DueReminder } from '@flowsaldo/domain';
import type { DueNotificationStatus } from './dueNotifications';
import { showLocalNotifications } from './notificationHandler';

const preference = 'flowsaldo.notifications.due';
const channel = 'vencimientos';

export async function setDueNotificationsEnabled(enabled: boolean) {
  if (Platform.OS !== 'android') return;
  if (enabled) {
    const notifications = await import('expo-notifications');
    await notifications.setNotificationChannelAsync(channel, {
      name: 'Vencimientos',
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PRIVATE,
      importance: notifications.AndroidImportance.DEFAULT,
    });
    const permission = await notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain)
      await notifications.requestPermissionsAsync();
  }
  await AsyncStorage.setItem(preference, enabled ? 'enabled' : 'disabled');
}

export async function allowExactDueNotifications() {
  if (Platform.OS !== 'android') return;
  const notifications = await import('expo-notifications');
  await notifications.requestExactAlarmPermissionsAsync();
}

let queue: Promise<unknown> = Promise.resolve();

export function syncDueNotifications(reminders: DueReminder[]): Promise<DueNotificationStatus> {
  const update = queue.then(() => reconcile(reminders));
  queue = update.catch(() => undefined);
  return update;
}

async function reconcile(reminders: DueReminder[]): Promise<DueNotificationStatus> {
  if (Platform.OS !== 'android')
    return { enabled: false, allowed: false, exact: false, scheduled: 0 };

  const optIn = await AsyncStorage.getItem(preference);
  if (optIn === null) return { enabled: false, allowed: false, exact: false, scheduled: 0 };
  const enabled = optIn === 'enabled';
  const notifications = await import('expo-notifications');
  const [permission, notificationChannel, alarm, scheduled, presented] = await Promise.all([
    notifications.getPermissionsAsync(),
    notifications.getNotificationChannelAsync(channel),
    notifications.getExactAlarmPermissionsAsync(),
    notifications.getAllScheduledNotificationsAsync(),
    notifications.getPresentedNotificationsAsync(),
  ]);
  const allowed =
    permission.granted && notificationChannel?.importance !== notifications.AndroidImportance.NONE;
  const desired = enabled && allowed ? reminders : [];
  const now = Date.now();
  const changes = planDueReminderUpdates(
    desired,
    scheduled.map((item) => item.identifier),
    presented.map((item) => item.request.identifier),
    now,
    alarm.granted,
  );
  await Promise.all([
    ...changes.cancel.map((id) => notifications.cancelScheduledNotificationAsync(id)),
    ...changes.dismiss.map((id) => notifications.dismissNotificationAsync(id)),
  ]);
  if (enabled && allowed) showLocalNotifications(notifications);
  const removed = new Set(changes.cancel);
  let count = scheduled.filter(
    ({ identifier }) => identifier.startsWith(dueReminderPrefix) && !removed.has(identifier),
  ).length;
  for (const [id, reminder] of changes.schedule) {
    if (reminder.dueAt <= Date.now()) continue;
    await notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title:
          reminder.kind === 'payment' ? 'Vence un pago pendiente' : 'Vence una plantilla mensual',
        body: 'Abre FlowSaldo para revisar el vencimiento.',
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.dueAt,
        channelId: channel,
      },
    });
    count++;
  }
  return {
    enabled,
    allowed,
    exact: alarm.granted,
    scheduled: count,
  };
}
