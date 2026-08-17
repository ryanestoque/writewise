/**
 * Runs an async task over an array of items with a bounded concurrency pool.
 *
 * @param items - The items to process.
 * @param task - Async function called with each item. Should return true on success, false on failure.
 * @param options.concurrency - Maximum number of concurrent workers (default: 4).
 * @param options.onProgress - Optional callback fired after each item completes with (completedCount, totalCount).
 * @returns An object with successCount and failedItems.
 */
export async function runConcurrentPool<T>(
  items: T[],
  task: (item: T) => Promise<boolean>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ successCount: number; failedItems: T[] }> {
  const { concurrency = 4, onProgress } = options;

  let nextIdx = 0;
  let completedCount = 0;
  let successCount = 0;
  const failedItems: T[] = [];

  async function worker() {
    while (nextIdx < items.length) {
      const i = nextIdx++;
      const item = items[i];
      try {
        const ok = await task(item);
        if (ok) {
          successCount++;
        } else {
          failedItems.push(item);
        }
      } catch {
        failedItems.push(item);
      }
      completedCount++;
      onProgress?.(completedCount, items.length);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  if (workerCount > 0) {
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  return { successCount, failedItems };
}
