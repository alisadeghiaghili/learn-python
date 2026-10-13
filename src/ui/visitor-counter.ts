/**
 * Unique-visitor counter shared by the course sites.
 *
 * The number lives only on the counter service; this module never adds an
 * offset, floor or fallback figure. A browser is counted once, ever: a
 * per-course localStorage flag decides between `hit` (count this browser) and
 * `get` (read only). The cached number is a first-paint placeholder and is
 * always replaced by the server value.
 */

export const COUNTER_API = 'https://abacus.jasoncameron.dev';
export const COUNTER_NAMESPACE = 'alisadeghiaghili.github.io';
export const COURSE_SLUG = 'learn-python';
export const COUNTER_KEY = `${COURSE_SLUG}-unique-visitors`;
export const COUNTED_FLAG_KEY = `${COURSE_SLUG}:visitor-counted:v1`;
export const COUNT_CACHE_KEY = `${COURSE_SLUG}:visitor-count:v2`;
export const REQUEST_TIMEOUT_MS = 5000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface VisitorCounterDeps {
  fetch?: FetchLike;
  /** `null` means storage is unavailable; omit to use the browser's localStorage. */
  storage?: StorageLike | null;
  timeoutMs?: number;
  now?: () => Date;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Call the counter service. Resolves to the count; a 404 on `get` means 0. */
async function request(
  action: 'get' | 'hit',
  deps: VisitorCounterDeps,
): Promise<number> {
  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const url = `${COUNTER_API}/${action}/${COUNTER_NAMESPACE}/${COUNTER_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await doFetch(url, { cache: 'no-store', signal: controller.signal });
    if (action === 'get' && res.status === 404) return 0;
    if (!res.ok) throw new Error(`counter ${action} failed: ${res.status}`);
    const body: unknown = await res.json();
    const value = (body as { value?: unknown } | null)?.value;
    if (!isCount(value)) throw new Error('counter returned an invalid value');
    return value;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Count this browser if it has not been counted yet, then return the server
 * value, or `null` when the service cannot be reached.
 */
export async function resolveVisitorCount(deps: VisitorCounterDeps = {}): Promise<number | null> {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const now = deps.now ?? (() => new Date());

  let shouldHit = false;
  if (storage) {
    try {
      if (storage.getItem(COUNTED_FLAG_KEY) === null) {
        storage.setItem(COUNTED_FLAG_KEY, now().toISOString());
        shouldHit = true;
      }
    } catch {
      shouldHit = false;
    }
  }

  if (shouldHit) {
    try {
      return await request('hit', deps);
    } catch {
      try {
        storage?.removeItem(COUNTED_FLAG_KEY);
      } catch {
        // storage became unavailable; nothing to undo
      }
    }
  }

  try {
    return await request('get', deps);
  } catch {
    return null;
  }
}

/** The last server value, for the first paint only. */
export function readCachedCount(storage: StorageLike | null = defaultStorage()): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(COUNT_CACHE_KEY);
    if (!raw) return null;
    const count = (JSON.parse(raw) as { count?: unknown } | null)?.count;
    return isCount(count) ? count : null;
  } catch {
    return null;
  }
}

function writeCachedCount(storage: StorageLike | null, count: number, now: Date): void {
  if (!storage) return;
  try {
    storage.setItem(COUNT_CACHE_KEY, JSON.stringify({ count, at: now.toISOString() }));
  } catch {
    // cache is optional
  }
}

/**
 * Show the cached number immediately (if any), then replace it with the server
 * value whenever it arrives, even when that value is lower.
 */
export async function startVisitorCounter(
  render: (count: number) => void,
  deps: VisitorCounterDeps = {},
): Promise<void> {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const cached = readCachedCount(storage);
  if (cached !== null) render(cached);

  const count = await resolveVisitorCount({ ...deps, storage });
  if (count === null) return;
  writeCachedCount(storage, count, (deps.now ?? (() => new Date()))());
  render(count);
}

export function formatVisitorCount(count: number, locale = 'en-US'): string {
  return count.toLocaleString(locale);
}
