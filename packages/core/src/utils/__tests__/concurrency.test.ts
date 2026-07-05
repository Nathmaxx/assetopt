import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../concurrency.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
  it('returns results in input order even when completion order differs', async () => {
    // First item is the slowest: it completes last but must stay first.
    const out = await mapWithConcurrency([30, 0, 10], 3, async (ms) => {
      await delay(ms);
      return ms * 2;
    });
    expect(out).toEqual([60, 0, 20]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await delay(5);
        active--;
      },
    );
    expect(peak).toBe(3);
  });

  it('limit 1 runs strictly sequentially', async () => {
    const order: string[] = [];
    await mapWithConcurrency([1, 2, 3], 1, async (n) => {
      order.push(`start ${n}`);
      await delay(1);
      order.push(`end ${n}`);
    });
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
  });

  it('starts items in input order', async () => {
    const started: number[] = [];
    // Uneven durations so completions interleave; starts must not.
    await mapWithConcurrency([20, 1, 1, 1, 1], 2, async (ms, i) => {
      started.push(i);
      await delay(ms);
    });
    expect(started).toEqual([0, 1, 2, 3, 4]);
  });

  it('passes the item index to fn', async () => {
    const out = await mapWithConcurrency(['a', 'b', 'c'], 2, async (item, i) => `${i}:${item}`);
    expect(out).toEqual(['0:a', '1:b', '2:c']);
  });

  it('handles an empty list', async () => {
    const out = await mapWithConcurrency([], 4, async () => 1);
    expect(out).toEqual([]);
  });

  it('tolerates a limit larger than the item count', async () => {
    const out = await mapWithConcurrency([1, 2], 16, async (n) => n + 1);
    expect(out).toEqual([2, 3]);
  });

  it('clamps a sub-1 limit to 1', async () => {
    const out = await mapWithConcurrency([1, 2], 0, async (n) => n);
    expect(out).toEqual([1, 2]);
  });

  it('rejects if fn rejects', async () => {
    await expect(
      mapWithConcurrency([1], 2, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
