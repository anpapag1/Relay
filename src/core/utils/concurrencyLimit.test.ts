import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrencyLimit';

describe('mapWithConcurrency', () => {
  it('processes every item and preserves result order regardless of completion order', async () => {
    const delays = [30, 10, 20, 0, 15];
    const results = await mapWithConcurrency(delays, 3, (ms) => new Promise<number>((resolve) => {
      setTimeout(() => resolve(ms), ms);
    }));
    expect(results).toEqual(delays);
  });

  it('never runs more than `limit` calls concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (i) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return i;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('handles an empty input array', async () => {
    const results = await mapWithConcurrency([], 3, async (i: number) => i);
    expect(results).toEqual([]);
  });

  it('handles a limit larger than the item count', async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (i) => i * 2);
    expect(results).toEqual([2, 4]);
  });
});
