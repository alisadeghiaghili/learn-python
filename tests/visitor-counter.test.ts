import { describe, expect, it, vi } from 'vitest';
import {
  COUNT_CACHE_KEY,
  COUNTED_FLAG_KEY,
  formatVisitorCount,
  readCachedCount,
  resolveVisitorCount,
  startVisitorCounter,
} from '../src/ui/visitor-counter';

const BASE = 'https://abacus.jasoncameron.dev';
const NS = 'alisadeghiaghili.github.io';
const KEY = 'learn-python-unique-visitors';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function json(value: number, status = 200): Response {
  return new Response(JSON.stringify({ value }), { status });
}

function urlOf(call: unknown[]): string {
  return call[0] as string;
}

describe('visitor counter', () => {
  it('first visit hits exactly once, sets the flag and shows the hit value', async () => {
    const storage = memoryStorage();
    const fetch = vi.fn(async () => json(42));
    const count = await resolveVisitorCount({ fetch, storage });
    expect(count).toBe(42);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(urlOf(fetch.mock.calls[0]!)).toBe(`${BASE}/hit/${NS}/${KEY}`);
    expect(storage.data.get(COUNTED_FLAG_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sets the flag before the hit request is sent', async () => {
    const storage = memoryStorage();
    let flagAtRequest: string | null = null;
    const fetch = vi.fn(async () => {
      flagAtRequest = storage.getItem(COUNTED_FLAG_KEY);
      return json(7);
    });
    await resolveVisitorCount({ fetch, storage });
    expect(flagAtRequest).not.toBeNull();
  });

  it('second visit only reads and never increments', async () => {
    const storage = memoryStorage({ [COUNTED_FLAG_KEY]: '2026-01-01T00:00:00.000Z' });
    const fetch = vi.fn(async () => json(43));
    const count = await resolveVisitorCount({ fetch, storage });
    expect(count).toBe(43);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(urlOf(fetch.mock.calls[0]!)).toBe(`${BASE}/get/${NS}/${KEY}`);
    expect(fetch.mock.calls.some((c) => urlOf(c).includes('/hit/'))).toBe(false);
  });

  it('a failed hit removes the flag, falls back to get, and the next visit hits again', async () => {
    const storage = memoryStorage();
    const failing = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(json(10));
    const first = await resolveVisitorCount({ fetch: failing, storage });
    expect(first).toBe(10);
    expect(failing.mock.calls.map(urlOf)).toEqual([
      `${BASE}/hit/${NS}/${KEY}`,
      `${BASE}/get/${NS}/${KEY}`,
    ]);
    expect(storage.data.has(COUNTED_FLAG_KEY)).toBe(false);

    const healthy = vi.fn(async () => json(11));
    await resolveVisitorCount({ fetch: healthy, storage });
    expect(urlOf(healthy.mock.calls[0]!)).toBe(`${BASE}/hit/${NS}/${KEY}`);
    expect(storage.data.has(COUNTED_FLAG_KEY)).toBe(true);
  });

  it('treats a network error and bad JSON on hit as failures', async () => {
    for (const bad of [
      vi.fn().mockRejectedValueOnce(new TypeError('offline')),
      vi.fn().mockResolvedValueOnce(new Response('not json', { status: 200 })),
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ value: 'x' }), { status: 200 })),
    ]) {
      const storage = memoryStorage();
      const fetch = bad.mockResolvedValueOnce(json(5));
      expect(await resolveVisitorCount({ fetch, storage })).toBe(5);
      expect(storage.data.has(COUNTED_FLAG_KEY)).toBe(false);
    }
  });

  it('a get 404 means zero', async () => {
    const storage = memoryStorage({ [COUNTED_FLAG_KEY]: 'x' });
    const fetch = vi.fn(async () => new Response('not found', { status: 404 }));
    expect(await resolveVisitorCount({ fetch, storage })).toBe(0);
  });

  it('returns null when nothing can be read', async () => {
    const storage = memoryStorage({ [COUNTED_FLAG_KEY]: 'x' });
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await resolveVisitorCount({ fetch, storage })).toBeNull();
  });

  it('never hits when localStorage is unavailable', async () => {
    const fetch = vi.fn(async () => json(99));
    expect(await resolveVisitorCount({ fetch, storage: null })).toBe(99);
    expect(urlOf(fetch.mock.calls[0]!)).toBe(`${BASE}/get/${NS}/${KEY}`);

    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const fetch2 = vi.fn(async () => json(98));
    expect(await resolveVisitorCount({ fetch: fetch2, storage: throwing })).toBe(98);
    expect(fetch2.mock.calls.map(urlOf)).toEqual([`${BASE}/get/${NS}/${KEY}`]);
  });

  it('does not hit when the flag cannot be stored', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const fetch = vi.fn(async () => json(3));
    await resolveVisitorCount({ fetch, storage });
    expect(urlOf(fetch.mock.calls[0]!)).toContain('/get/');
  });

  it('sends no-store requests with an abort signal and aborts after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage({ [COUNTED_FLAG_KEY]: 'x' });
      let seen: RequestInit | undefined;
      const fetch = vi.fn((_url: string, init?: RequestInit) => {
        seen = init;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      });
      const pending = resolveVisitorCount({ fetch, storage, timeoutMs: 5000 });
      expect(seen?.cache).toBe('no-store');
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBeNull();
      expect(seen?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replaces a stale, inflated cache with the lower server value', async () => {
    const storage = memoryStorage({
      [COUNTED_FLAG_KEY]: 'x',
      [COUNT_CACHE_KEY]: JSON.stringify({ count: 5000, at: '2026-01-01T00:00:00.000Z' }),
    });
    const fetch = vi.fn(async () => json(120));
    const shown: number[] = [];
    await startVisitorCounter((n) => shown.push(n), { fetch, storage });
    expect(shown).toEqual([5000, 120]);
    expect(readCachedCount(storage)).toBe(120);
    expect(JSON.parse(storage.data.get(COUNT_CACHE_KEY)!).count).toBe(120);
  });

  it('keeps the placeholder untouched when the server cannot be reached', async () => {
    const storage = memoryStorage({
      [COUNTED_FLAG_KEY]: 'x',
      [COUNT_CACHE_KEY]: JSON.stringify({ count: 77, at: '2026-01-01T00:00:00.000Z' }),
    });
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const shown: number[] = [];
    await startVisitorCounter((n) => shown.push(n), { fetch, storage });
    expect(shown).toEqual([77]);
  });

  it('renders nothing before a number is known', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const shown: number[] = [];
    await startVisitorCounter((n) => shown.push(n), {
      fetch,
      storage: memoryStorage({ [COUNTED_FLAG_KEY]: 'x' }),
    });
    expect(shown).toEqual([]);
  });

  it('ignores a malformed cache entry', () => {
    expect(readCachedCount(memoryStorage({ [COUNT_CACHE_KEY]: 'nope' }))).toBeNull();
    expect(readCachedCount(memoryStorage({ [COUNT_CACHE_KEY]: '{"count":-1}' }))).toBeNull();
    expect(readCachedCount(null)).toBeNull();
  });

  it('formats the count as a locale integer', () => {
    expect(formatVisitorCount(1234567)).toBe('1,234,567');
  });
});
