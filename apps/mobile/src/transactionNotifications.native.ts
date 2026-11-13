import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const channel = 'transacciones';
const preference = 'flowsaldo.notifications.transactions';

export async function enableTransactionNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const notifications = await import('expo-notifications');
  await notifications.setNotificationChannelAsync(channel, {
    name: 'Transacciones',
    lockscreenVisibility: notifications.AndroidNotificationVisibility.PRIVATE,
    importance: notifications.AndroidImportance.DEFAULT,
  });
  const current = await notifications.getPermissionsAsync();
  const granted =
    current.granted ||
    (current.canAskAgain && (await notifications.requestPermissionsAsync()).granted);
  if (granted) await AsyncStorage.setItem(preference, 'enabled');
  return granted;
}

const delivered = new Set<string>();

export async function notifyTransaction(id: string, title: string): Promise<void> {
  if (Platform.OS !== 'android' || delivered.has(id)) return;
  delivered.add(id);
  try {
    const notifications = await import('expo-notifications');
    if (
      (await AsyncStorage.getItem(preference)) !== 'enabled' ||
      !(await notifications.getPermissionsAsync()).granted
    ) {
      delivered.delete(id);
      return;
    }
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    await notifications.scheduleNotificationAsync({
      identifier: `flowsaldo-${id}`,
      content: { title, body: 'Abre FlowSaldo para ver el movimiento.' },
      trigger: { channelId: channel },
    });
    if (delivered.size > 256) {
      const oldest = delivered.values().next().value;
      if (oldest) delivered.delete(oldest);
    }
  } catch {
    delivered.delete(id);
  }
}
