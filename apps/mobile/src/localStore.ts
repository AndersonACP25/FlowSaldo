export function createLocalStore<T>(
  read: () => Promise<T | null>,
  write: (value: T) => Promise<void>,
) {
  let committed: T | null | undefined;
  let tail = Promise.resolve();

  function enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function reload() {
    committed = undefined;
    committed = await read();
    return committed;
  }

  return {
    load: () => enqueue(reload),
    update(fallback: T, change: (current: T) => T, recoverUnreadable = false) {
      return enqueue(async () => {
        // Only the explicitly confirmed reset can replace unreadable storage.
        if (committed === undefined && !recoverUnreadable) await reload();
        const current = committed ?? fallback;
        const next = change(current);
        if (next !== current || committed === undefined) {
          await write(next);
          committed = next;
        }
        return next;
      });
    },
  };
}
