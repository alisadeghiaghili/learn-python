/**
 * Simulated Python object memory: heap objects and stack frames.
 *
 * This module owns identity, references, and snapshots — the data model the
 * visualizer and goal checker both read.
 */

import type {
  Frame,
  HeapObject,
  MemorySegment,
  MemoryState,
  RtValue,
  Snapshot,
  SnapshotFrame,
  SnapshotHeapObject,
} from './types';

let nextObjectId = 1;
let nextAddr = 0;

/** Reset object id counter + address allocator (used by tests and full resets). */
export function resetObjectIds(): void {
  nextObjectId = 1;
  nextAddr = 0;
}

/**
 * Approximate in-memory size of a heap object, in bytes. A deliberate
 * CPython approximation (64-bit: a 16-byte object header + payload) for the RAM
 * view — the teaching point is *relative* size and contiguity, not exactness.
 */
function estimateByteSize(type: string, value: unknown): number {
  const HEADER = 16;
  const arrLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  switch (type) {
    case 'list':
    case 'tuple':
    case 'set':
      // an array of 8-byte slot pointers
      return HEADER + 8 * arrLen(value);
    case 'dict':
      return HEADER + 8 * arrLen(value);
    case 'defaultdict': {
      const v = value as { entries?: unknown[] };
      return HEADER + 8 + 8 * (v.entries ? v.entries.length : 0);
    }
    case 'str':
      return HEADER + 1 + (typeof value === 'string' ? value.length : 0);
    case 'buffer': {
      // a contiguous run of float64 (8 bytes each)
      const v = value as { data?: unknown[] };
      return HEADER + 8 * (v.data ? v.data.length : 0);
    }
    case 'ndarray':
      // buffer ptr + offset + shape + dtype + view flag
      return HEADER + 8 + 8 + 8 + 4 + 1;
    case 'series': {
      const v = value as { index?: unknown[] };
      return HEADER + 8 + 8 + 8 + 4 + 8 * (v.index ? v.index.length : 0);
    }
    case 'dataframe': {
      const v = value as { columns?: unknown[]; index?: unknown[] };
      return HEADER + 8 + 8 * (v.columns ? v.columns.length : 0) + 8 * (v.index ? v.index.length : 0);
    }
    case 'function':
      return HEADER + 8 + 8 + 8;
    case 'coroutine':
      // fn ptr + status + program counter + (locals grow with it)
      return HEADER + 8 + 8 + 8;
    case 'task':
      return HEADER + 8 + 8;
    case 'eventloop': {
      const v = value as { ready?: unknown[]; done?: unknown[] };
      return HEADER + 8 + 8 + 8 * (v.ready?.length ?? 0) + 8 * (v.done?.length ?? 0);
    }
    case 'thread':
      // target ref + status + program counter (locals grow with it)
      return HEADER + 8 + 8 + 8;
    case 'lock':
      // held flag + the thread id that holds it (absent when free)
      return HEADER + 8 + 8;
    default:
      return HEADER + 8;
  }
}

/**
 * Allocate a heap object and return its handle. Assigns a stable monotonic
 * address (models malloc — addresses are never reused) and an approximate byte
 * size for the RAM view. Reference count starts at 0 and is recomputed by
 * `computeRefCounts` after each statement.
 */
export function allocObject(type: string, value: unknown, repr: string, seg?: MemorySegment): HeapObject {
  const id = `obj_${nextObjectId++}`;
  const byteSize = estimateByteSize(type, value);
  const addr = nextAddr;
  nextAddr += Math.max(byteSize, 16); // 16-byte aligned, like real malloc
  return {
    id,
    type,
    value,
    repr,
    addr,
    byteSize,
    refCount: 0,
    seg: seg ?? (type === 'buffer' ? 'buffer' : 'heap'),
  };
}

/**
 * Recompute every heap object's reference count from the live graph: inbound
 * references from frame roots plus references from other containers. Drives the
 * refcount column in the RAM view and the GC teaching.
 */
export function computeRefCounts(state: MemoryState): void {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(state.heap)) counts[id] = 0;
  for (const frame of state.frames) {
    for (const targetId of Object.values(frame.locals)) {
      if (typeof targetId === 'string' && counts[targetId] !== undefined) counts[targetId] += 1;
    }
  }
  for (const obj of Object.values(state.heap)) {
    for (const ref of nestedRefs(obj)) {
      if (counts[ref] !== undefined) counts[ref] += 1;
    }
  }
  for (const id of Object.keys(counts)) state.heap[id].refCount = counts[id];
}

/**
 * True if `value` is an iterator's `{ source, index }` payload. Guards on BOTH
 * fields (not just the `source` key) so unrelated objects that happen to carry
 * a `source` string are never mistaken for an iterator.
 */
export function isIteratorValue(value: unknown): value is { source: string; index: number } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { source?: unknown; index?: unknown };
  return typeof v.source === 'string' && v.source.startsWith('obj_') && typeof v.index === 'number';
}

/**
 * A map/filter iterator's payload: `{ source, fn, isFilter }`. Distinct from a
 * plain iterator (`{ source, index }`) — it carries a function object id rather
 * than a numeric cursor.
 */
export function isMapFilterValue(value: unknown): value is { source: string; fn: string; isFilter: boolean } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { source?: unknown; fn?: unknown; isFilter?: unknown };
  return typeof v.source === 'string' && v.source.startsWith('obj_')
    && typeof v.fn === 'string' && v.fn.startsWith('obj_')
    && typeof v.isFilter === 'boolean';
}

/**
 * A defaultdict's payload: `{ factory, entries }`. Mirrors a plain dict's entry
 * array plus the default-factory name.
 */
export function isDefaultDictValue(value: unknown): value is { factory: string; entries: Array<[string, RtValue]> } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { factory?: unknown; entries?: unknown };
  return typeof v.factory === 'string' && Array.isArray(v.entries);
}

/**
 * An ndarray's payload: a window `{ buffer, offset, shape, dtype, view }`
 * onto a buffer box. `buffer` is a heap id, so it must stay alive and draw an
 * edge — the view-vs-copy picture is exactly "how many ndarrays point at one
 * buffer box."
 */
export function isNdarrayValue(value: unknown): value is { buffer: string; offset: number; shape: number; dtype: string; view: boolean } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { buffer?: unknown; offset?: unknown; shape?: unknown; dtype?: unknown; view?: unknown };
  return typeof v.buffer === 'string' && v.buffer.startsWith('obj_')
    && typeof v.offset === 'number' && typeof v.shape === 'number'
    && typeof v.dtype === 'string' && typeof v.view === 'boolean';
}

/**
 * A pandas Series/DataFrame payload carries a `buffer` heap id (a window over
 * a buffer box, the numpy picture lifted to a table). Detected by its buffer
 * ref plus a pandas marker (`length` for a Series, `columns` for a DataFrame).
 */
export function isPandasValue(value: unknown): value is { buffer: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { buffer?: unknown };
  if (typeof v.buffer !== 'string' || !v.buffer.startsWith('obj_')) return false;
  const hasSeries = (value as { length?: unknown }).length !== undefined;
  const hasFrame = Array.isArray((value as { columns?: unknown }).columns);
  return hasSeries || hasFrame;
}

/**
 * A coroutine's payload: `{ fn, status, pc, locals }` — a suspended call. `fn`
 * is the coroutine-function code object id. Detected by its `fn` ref plus the
 * two markers every coroutine carries (`status` + `pc`); this is what keeps a
 * coroutine distinct from a bare function.
 */
export function isCoroutineValue(value: unknown): value is { fn: string; name: string; status: string; pc: number; locals: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { fn?: unknown; name?: unknown; status?: unknown; pc?: unknown };
  return typeof v.fn === 'string' && v.fn.startsWith('obj_')
    && typeof v.name === 'string' && typeof v.status === 'string' && typeof v.pc === 'number';
}

/**
 * A task's payload: `{ coro, name, status }` — a named handle to a coroutine.
 * Detected by its `coro` ref plus the `name` + `status` markers, so it is never
 * confused with a coroutine (which has `pc`) or a coroutine-function.
 */
export function isTaskValue(value: unknown): value is { coro: string; name: string; status: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { coro?: unknown; name?: unknown; status?: unknown };
  return typeof v.coro === 'string' && v.coro.startsWith('obj_')
    && typeof v.name === 'string' && typeof v.status === 'string';
}

/**
 * An event-loop's payload: `{ running, ready, done, tick }` — the queue of
 * ready tasks (ids) it round-robins, plus a tick counter. Detected by its
 * `ready`/`done` id arrays and `tick` counter.
 */
export function isEventLoopValue(value: unknown): value is { running: boolean; ready: string[]; done: string[]; tick: number } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { ready?: unknown; done?: unknown; tick?: unknown };
  return Array.isArray(v.ready) && Array.isArray(v.done) && typeof v.tick === 'number';
}

/**
 * A thread's payload: `{ target, name, status, pc, locals, returnValue }` — a
 * call running in its own frame that shares the module heap. Detected by its
 * `target` function id plus the `name` + `pc` + `status` markers (a coroutine
 * has `fn`/`status`/`pc` instead, so `target` is what keeps them apart).
 */
export function isThreadValue(value: unknown): value is { target: string; name: string; status: string; pc: number; locals: Record<string, unknown>; returnValue: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { target?: unknown; name?: unknown; status?: unknown; pc?: unknown };
  return typeof v.target === 'string' && v.target.startsWith('obj_')
    && typeof v.name === 'string' && typeof v.status === 'string' && typeof v.pc === 'number';
}

/**
 * A lock's payload: `{ held, holder }` — `holder` is the thread id that holds it
 * (null when free). Detected by its `held` boolean flag.
 */
export function isLockValue(value: unknown): value is { held: boolean; holder: string | null } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { held?: unknown; holder?: unknown };
  return typeof v.held === 'boolean'
    && (v.holder === null || (typeof v.holder === 'string' && v.holder.startsWith('obj_')));
}

export interface RefEdge {
  fromFrame: string;
  name: string;
  toId: string;
}

/**
 * Compute inbound reference edges from frames to heap objects.
 */
export function referenceEdges(state: MemoryState): RefEdge[] {
  const edges: RefEdge[] = [];
  for (const frame of state.frames) {
    for (const [name, targetId] of Object.entries(frame.locals)) {
      if (typeof targetId === 'string' && state.heap[targetId]) {
        edges.push({ fromFrame: frame.name, name, toId: targetId });
      }
    }
  }
  return edges;
}

/**
 * Collect object ids reachable from frame roots (for display order).
 */
export function liveObjectIds(state: MemoryState): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const frame of state.frames) {
    for (const targetId of Object.values(frame.locals)) {
      if (typeof targetId === 'string' && state.heap[targetId] && !seen.has(targetId)) {
        seen.add(targetId);
        queue.push(targetId);
      }
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const obj = state.heap[id];
    for (const ref of nestedRefs(obj)) {
      if (state.heap[ref] && !seen.has(ref)) {
        seen.add(ref);
        queue.push(ref);
      }
    }
  }
  return Object.keys(state.heap).filter((id) => seen.has(id));
}

/**
 * Nested object ids stored inside a container value.
 */
function nestedRefs(obj: HeapObject | undefined): string[] {
  if (!obj) return [];
  const { type, value } = obj;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return (value as RtValue[]).filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'dict') {
    return (value as Array<[string, RtValue]>)
      .flatMap(([k, v]) => [k, v])
      .filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'defaultdict') {
    const dd = value as { entries: Array<[string, RtValue]> };
    return dd.entries
      .flatMap(([k, v]) => [k, v])
      .filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  // An ndarray holds a ref to the buffer it views — keep that buffer alive and
  // let the canvas draw the ndarray → buffer edge (the view-vs-copy picture).
  if (isNdarrayValue(value)) return [value.buffer];
  // A pandas Series/DataFrame holds a ref to its buffer box — keep it alive.
  if (isPandasValue(value)) return [value.buffer];
  // A map/filter iterator holds a ref to the source iterator AND the function
  // it applies — keep both alive and let the canvas draw both edges.
  if (isMapFilterValue(value)) return [value.source, value.fn];
  // A coroutine holds a ref to the coroutine-function code object it was made
  // from; its `locals` may point at heap objects (keep those alive too).
  if (isCoroutineValue(value)) {
    const refs = [value.fn];
    for (const v of Object.values(value.locals)) {
      if (typeof v === 'string' && v.startsWith('obj_')) refs.push(v);
    }
    return refs;
  }
  // A task holds a ref to the coroutine it wraps.
  if (isTaskValue(value)) return [value.coro];
  // An event loop holds refs to every task in its ready queue and done list.
  if (isEventLoopValue(value)) return [...value.ready, ...value.done];
  // A thread holds a ref to the target function it runs (keep it alive and draw
  // the thread → target edge); its saved `locals` may point at heap objects too.
  if (isThreadValue(value)) {
    const refs = [value.target];
    for (const v of Object.values(value.locals)) {
      if (typeof v === 'string' && v.startsWith('obj_')) refs.push(v);
    }
    return refs;
  }
  // A held lock points at the thread that holds it (a live reference).
  if (isLockValue(value)) return value.holder ? [value.holder] : [];
  // An iterator holds a reference to the iterable it walks — keep that source
  // alive and let the canvas draw the iterator → source edge.
  if (isIteratorValue(value)) return [value.source];
  // Function closures: keep referenced cell objects alive and counted
  if (type === 'function' && typeof value === 'object' && value !== null) {
    const fnVal = value as { closure?: Record<string, { value: RtValue }> };
    if (fnVal.closure) {
      const refs: string[] = [];
      for (const cell of Object.values(fnVal.closure)) {
        if (typeof cell.value === 'string' && cell.value.startsWith('obj_')) {
          refs.push(cell.value);
        }
      }
      return refs;
    }
  }
  return [];
}

/**
 * Deep-clone a memory state (undo / level snapshots).
 * Handles BigInt and circular structures natively.
 */
export function cloneState(state: MemoryState): MemoryState {
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  return JSON.parse(
    JSON.stringify(state, (_key, val) =>
      typeof val === 'bigint' ? { __bigint: val.toString() } : val
    ),
    (_key, val) =>
      val && typeof val === 'object' && '__bigint' in val ? BigInt(val.__bigint) : val
  );
}

/**
 * Structural snapshot used by goal compare (ids normalized away).
 */
export function snapshot(state: MemoryState): Snapshot {
  const heap: Record<string, SnapshotHeapObject> = {};
  const idMap: Record<string, string> = {};
  for (const obj of Object.values(state.heap)) {
    idMap[obj.id] = `h_${obj.id}`;
    heap[idMap[obj.id]] = {
      type: obj.type,
      repr: obj.repr,
      value: normalizeValue(obj.value, idMap, state.heap, true),
    };
  }
  // Second pass so nested refs resolve consistently.
  for (const obj of Object.values(state.heap)) {
    heap[idMap[obj.id]].value = normalizeValue(obj.value, idMap, state.heap, false);
  }
  const frames: SnapshotFrame[] = state.frames.map((frame) => {
    const locals: Record<string, RtValue | string> = {};
    for (const [name, targetId] of Object.entries(frame.locals)) {
      locals[name] = typeof targetId === 'string' && state.heap[targetId]
        ? idMap[targetId]
        : targetId;
    }
    return { name: frame.name, locals };
  });
  return { frames, heap };
}

/**
 * Rewrite a runtime value into snapshot form.
 */
function normalizeValue(
  value: unknown,
  idMap: Record<string, string>,
  heap: Record<string, HeapObject>,
  firstPass: boolean,
): unknown {
  if (typeof value === 'string' && value.startsWith('obj_') && heap[value]) {
    return firstPass ? idMap[value] || value : idMap[value];
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeValue(v, idMap, heap, firstPass));
  }
  // An ndarray's value holds a `buffer` id — remap it so a view and its source
  // array compare as pointing at the same buffer in the normalized snapshot.
  if (isNdarrayValue(value) && heap[value.buffer]) {
    return { ...(value as object), buffer: idMap[value.buffer] };
  }
  // A pandas Series/DataFrame's value holds a `buffer` id — remap it the same
  // way, so a copy (new buffer) and a view (shared buffer) compare distinctly.
  if (isPandasValue(value) && heap[(value as { buffer: string }).buffer]) {
    return { ...(value as object), buffer: idMap[(value as { buffer: string }).buffer] };
  }
  // An iterator's value is an object holding a `source` id — remap it so the
  // normalized snapshot can compare it against other objects.
  if (isIteratorValue(value) && heap[value.source]) {
    return { ...(value as object), source: idMap[value.source] };
  }
  // A map/filter iterator carries a `source` iterator and a `fn` object — remap
  // both so structural compare can match them across runs.
  if (isMapFilterValue(value)) {
    return {
      ...(value as object),
      source: heap[value.source] ? idMap[value.source] : value.source,
      fn: heap[value.fn] ? idMap[value.fn] : value.fn,
    };
  }
  // A defaultdict's value is `{ factory, entries }` — normalize its entry map.
  if (isDefaultDictValue(value)) {
    const entries = value.entries.map(([k, v]) => [k, normalizeValue(v, idMap, heap, firstPass)] as [string, unknown]);
    return { factory: value.factory, entries };
  }
  // A coroutine's value holds a `fn` id + a `locals` map of ids — remap both so
  // structural compare matches across runs.
  if (isCoroutineValue(value)) {
    const locals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.locals)) {
      locals[k] = typeof v === 'string' && v.startsWith('obj_') && heap[v] ? idMap[v] : v;
    }
    return { ...value, fn: idMap[value.fn] ?? value.fn, locals };
  }
  // A task's value holds a `coro` id — remap it.
  if (isTaskValue(value)) {
    return { ...value, coro: idMap[value.coro] ?? value.coro };
  }
  // An event loop's value holds `ready`/`done` task-id arrays — remap them.
  if (isEventLoopValue(value)) {
    const remap = (ids: string[]) => ids.map((i) => (heap[i] ? idMap[i] : i));
    return { ...value, ready: remap(value.ready), done: remap(value.done) };
  }
  // A thread's value holds a `target` id + a `locals` map of ids — remap both.
  if (isThreadValue(value)) {
    const locals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.locals)) {
      locals[k] = typeof v === 'string' && v.startsWith('obj_') && heap[v] ? idMap[v] : v;
    }
    return { ...value, target: idMap[value.target] ?? value.target, locals };
  }
  // A lock's value holds a `holder` thread id — remap it (null when free).
  if (isLockValue(value)) {
    return { ...value, holder: value.holder && heap[value.holder] ? idMap[value.holder] : value.holder };
  }
  return value;
}

/**
 * Build a fresh module-level state.
 */
export function createModuleState(): MemoryState {
  return {
    frames: [{ name: '<module>', locals: {} } as Frame],
    heap: {},
    stdout: [],
    errors: [],
    plots: [],
    ticks: 0,
  };
}
