export async function enableTransactionNotifications(): Promise<boolean> {
  return false;
}

export async function notifyTransaction(
  ..._notification: [id: string, title: string]
): Promise<void> {
  void _notification;
}
