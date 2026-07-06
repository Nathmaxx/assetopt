/**
 * Run `fn` over every item with at most `limit` calls in flight at once.
 *
 * Results come back in input order regardless of completion order, and items
 * are *started* in input order too (workers pull the next index from a shared
 * cursor) — only completions interleave. A `limit` below 1 (or non-integer)
 * is clamped to 1.
 *
 * `fn` is expected to handle its own errors (the pipeline turns per-file
 * failures into errored results); if it does reject, the whole map rejects
 * with that error.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length));
  let next = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);

  return results;
}
