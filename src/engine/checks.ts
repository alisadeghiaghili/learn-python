/**
 * Goal checking for levels (analogue of LGB TreeCompare).
 */

import type { GoalResult, GoalSpec, MemoryState, Snapshot, SnapshotHeapObject } from './types';

/**
 * Deep structural equality of two snapshot fragments.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

interface PrimitiveView {
  type: string;
  repr: string;
  value: unknown;
}

/**
 * View of a non-heap (primitive) snapshot slot.
 */
function primitiveView(slot: unknown): PrimitiveView {
  if (slot === null) return { type: 'NoneType', repr: 'None', value: null };
  if (typeof slot === 'boolean') {
    return { type: 'bool', repr: slot ? 'True' : 'False', value: slot };
  }
  if (typeof slot === 'number') {
    const isInt = Number.isInteger(slot);
    return { type: isInt ? 'int' : 'float', repr: String(slot), value: slot };
  }
  return { type: 'value', repr: String(slot), value: slot };
}

/**
 * Check a level goal against the current memory snapshot and runtime.
 */
export function checkGoal(goal: GoalSpec | null, snapshot: Snapshot, runtime: MemoryState): GoalResult {
  if (!goal) return { ok: false, message: 'No goal defined.' };

  if (goal.type === 'vars') {
    const module =
      snapshot.frames.find((f) => f.name === '<module>') || snapshot.frames[snapshot.frames.length - 1];
    for (const [name, expected] of Object.entries(goal.vars)) {
      if (!(name in module.locals)) {
        return { ok: false, message: `Missing binding for '${name}'.` };
      }
      const slot = module.locals[name];
      const obj = snapshot.heap[slot as string];
      const actual = obj || primitiveView(slot);

      if (expected.type && actual.type !== expected.type) {
        return {
          ok: false,
          message: `'${name}' is ${actual.type}, expected ${expected.type}.`,
        };
      }
      if (expected.repr !== undefined && actual.repr !== expected.repr) {
        return {
          ok: false,
          message: `'${name}' is ${actual.repr}, expected ${expected.repr}.`,
        };
      }
      if (expected.value !== undefined && !deepEqual(actual.value, expected.value)) {
        return {
          ok: false,
          message: `'${name}' has value ${JSON.stringify(actual.value)}, expected ${JSON.stringify(expected.value)}.`,
        };
      }
    }
    return { ok: true, message: 'Goal reached.' };
  }

  if (goal.type === 'stdout') {
    const lines = runtime.stdout.slice(-goal.lines.length);
    if (!deepEqual(lines, goal.lines)) {
      return {
        ok: false,
        message: `stdout mismatch. Got ${JSON.stringify(lines)}, expected ${JSON.stringify(goal.lines)}.`,
      };
    }
    return { ok: true, message: 'Goal reached.' };
  }

  if (goal.type === 'plot') {
    if (runtime.plots.length === 0) {
      return { ok: false, message: 'No plot yet — call scatter() or line().' };
    }
    if (goal.kind && !runtime.plots.some((p) => p.kind === goal.kind)) {
      return { ok: false, message: `Expected a ${goal.kind} plot.` };
    }
    return { ok: true, message: 'Plot drawn.' };
  }

  if (goal.type === 'predicates') {
    for (const pred of goal.predicates) {
      const result = pred(snapshot, runtime);
      if (result !== true) {
        return {
          ok: false,
          message: typeof result === 'string' ? result : 'A goal predicate is not satisfied yet.',
        };
      }
    }
    return { ok: true, message: 'Goal reached.' };
  }

  return { ok: false, message: 'Unknown goal type.' };
}

/**
 * Resolve a frame slot to a {type, repr} view, whether it points at a heap
 * object or holds a primitive value directly in the frame.
 */
function slotView(name: string, snapshot: Snapshot): { type: string; repr: string } | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const slot = module.locals[name];
  if (slot === undefined) return null;
  if (typeof slot === 'string' && snapshot.heap[slot]) {
    const obj = snapshot.heap[slot];
    return { type: obj.type, repr: obj.repr };
  }
  if (slot === null) return { type: 'NoneType', repr: 'None' };
  if (typeof slot === 'boolean') return { type: 'bool', repr: slot ? 'True' : 'False' };
  if (typeof slot === 'number') return { type: Number.isInteger(slot) ? 'int' : 'float', repr: String(slot) };
  if (typeof slot === 'string') return { type: 'str', repr: `'${slot}'` };
  return { type: 'value', repr: String(slot) };
}

/**
 * Convenience predicate builders used by the level pack.
 */
export const preds = {
  hasName(name: string) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      return name in module.locals ? true : `Define a variable named '${name}'.`;
    };
  },

  aliased(name: string, alias: string) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Both '${name}' and '${alias}' must be bound.`;
      return a === b ? true : `'${name}' and '${alias}' must reference the same object.`;
    };
  },

  notAliased(name: string, alias: string) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Both '${name}' and '${alias}' must be bound.`;
      return a !== b ? true : `'${name}' and '${alias}' must point at different objects.`;
    };
  },

  hasType(name: string, type: string) {
    return (snapshot: Snapshot): boolean | string => {
      const view = slotView(name, snapshot);
      if (!view) return `Bind '${name}' first.`;
      return view.type === type ? true : `'${name}' is ${view.type}, expected ${type}.`;
    };
  },

  hasRepr(name: string, repr: string) {
    return (snapshot: Snapshot): boolean | string => {
      const view = slotView(name, snapshot);
      if (!view) return `Bind '${name}' first.`;
      return view.repr === repr ? true : `'${name}' is ${view.repr}, expected ${repr}.`;
    };
  },

  /**
   * Shared mutable object mutated through alias.
   */
  sharedMutation(name: string, alias: string, repr: string) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Bind both '${name}' and '${alias}'.`;
      if (a !== b) return `'${name}' and '${alias}' must share one object.`;
      const obj = snapshot.heap[a as string];
      return obj.repr === repr ? true : `Object is ${obj.repr}, expected ${repr}.`;
    };
  },

  /**
   * Function name exists as a heap function.
   */
  hasFunction(name: string) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Define function '${name}'.`;
      const obj = snapshot.heap[id as string];
      return obj && obj.type === 'function' ? true : `'${name}' is not a function.`;
    };
  },

  listLen(name: string, count: number) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Bind '${name}' first.`;
      const obj = snapshot.heap[id as string];
      const len = (obj.value as unknown[]).length;
      return len === count ? true : `'${name}' length is ${len}, expected ${count}.`;
    };
  },

  /** `name` is a defaultdict (not a plain dict). */
  isDefaultDict(name: string) {
    return (snapshot: Snapshot): boolean => {
      const view = slotView(name, snapshot);
      return view?.type === 'defaultdict';
    };
  },

  /** `name` is a numpy ndarray. */
  isNdarray(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'ndarray' ? true : `'${name}' is not an ndarray.`;
    };
  },

  /**
   * Two ndarrays point at the SAME buffer (a view shares its source's buffer).
   */
  sharesBuffer(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const a = ndarrayBufferId(name, snapshot);
      const b = ndarrayBufferId(other, snapshot);
      if (a === null || b === null) return `Bind both '${name}' and '${other}' as ndarrays.`;
      return a === b;
    };
  },

  /**
   * Two ndarrays point at DIFFERENT buffers (an independent copy).
   */
  independentBuffer(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const a = ndarrayBufferId(name, snapshot);
      const b = ndarrayBufferId(other, snapshot);
      if (a === null || b === null) return `Bind both '${name}' and '${other}' as ndarrays.`;
      return a !== b;
    };
  },

  /** `name` is a pandas Series. */
  isSeries(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'series' ? true : `'${name}' is not a Series.`;
    };
  },

  /** `name` is a pandas DataFrame. */
  isDataFrame(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'dataframe' ? true : `'${name}' is not a DataFrame.`;
    };
  },

  /** `name` (Series/DataFrame) currently shows exactly `count` rows. */
  rows(name: string, count: number) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module?.locals[name];
      if (typeof id !== 'string' || !snapshot.heap[id]) return `Bind '${name}' first.`;
      const v = snapshot.heap[id].value as { length?: number; index?: unknown[] };
      const n = typeof v.length === 'number' ? v.length : v.index?.length ?? 0;
      return n === count ? true : `'${name}' has ${n} rows, expected ${count}.`;
    };
  },

  /**
   * Two Series/DataFrames point at the SAME buffer (a view / shared store).
   */
  sharesFrameBuffer(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const a = pandasBufferId(name, snapshot);
      const b = pandasBufferId(other, snapshot);
      if (a === null || b === null) return `Bind both '${name}' and '${other}' as pandas objects.`;
      return a === b;
    };
  },

  /**
   * Two Series/DataFrames point at DIFFERENT buffers (an independent copy).
   */
  independentFrameBuffer(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const a = pandasBufferId(name, snapshot);
      const b = pandasBufferId(other, snapshot);
      if (a === null || b === null) return `Bind both '${name}' and '${other}' as pandas objects.`;
      return a !== b;
    };
  },

  /**
   * A plot has been drawn (optionally of a specific kind).
   */
  hasPlot(kind?: 'scatter' | 'line') {
    return (_snapshot: Snapshot, runtime: MemoryState): boolean | string => {
      if (runtime.plots.length === 0) return 'Draw a plot with scatter() or line().'
      if (kind && !runtime.plots.some((p) => p.kind === kind)) return `Draw a ${kind} plot.`
      return true;
    };
  },

  /**
   * Two names are different objects that still share at least one nested
   * container (a shallow copy: new outer box, same child).
   */
  sharesChild(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const shared = sharedChildId(name, other, snapshot);
      if (shared === 'missing') return `Bind both '${name}' and '${other}'.`;
      if (shared === 'same') return `'${name}' and '${other}' are the same object — copy it.`;
      return shared !== null;
    };
  },

  /**
   * Two names are different objects with no shared nested container (a deep
   * copy: every level is independent).
   */
  independent(name: string, other: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const shared = sharedChildId(name, other, snapshot);
      if (shared === 'missing') return `Bind both '${name}' and '${other}'.`;
      if (shared === 'same') return `'${name}' and '${other}' are the same object — make independent copies.`;
      return shared === null;
    };
  },

  /** `name` is an iterator whose source is the same object as `iterable`. */
  iteratesOver(name: string, iterable: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const itv = iteratorValue(name, snapshot);
      if (!itv) return `Create an iterator '${name}' with iter().`;
      const module = snapshot.frames[snapshot.frames.length - 1]!;
      const src = module.locals[iterable];
      if (!src) return `Bind '${iterable}' first.`;
      return itv.source === src ? true : `'${name}' must iterate over the object '${iterable}' points at.`;
    };
  },

  /** `name` is an iterator whose cursor is at exactly `i`. */
  iteratorIndex(name: string, i: number) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const itv = iteratorValue(name, snapshot);
      if (!itv) return `Create an iterator '${name}' with iter().`;
      return itv.index === i ? true : `'${name}' is at index ${itv.index}, expected ${i}.`;
    };
  },

  /** `name` is an iterator already at the end of its source. */
  exhausted(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const itv = iteratorValue(name, snapshot);
      if (!itv) return `Create an iterator '${name}' with iter().`;
      const len = iteratorSourceLength(itv.source, snapshot);
      if (len === null) return 'Cannot measure the iterator source.';
      return itv.index >= len;
    };
  },

  /** `name` is a coroutine (the object an `async def` call returns). */
  isCoroutine(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'coroutine' ? true : `'${name}' is not a coroutine — call an async def.`;
    };
  },

  /** `name` is a Task (a named handle to a coroutine). */
  isTask(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'task' ? true : `'${name}' is not a task — wrap a coroutine with asyncio.create_task().`;
    };
  },

  /** `name` (a task) is currently in `status`. */
  taskStatus(name: string, status: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const t = asyncTaskValue(name, snapshot);
      if (!t) return `Bind '${name}' as a task first.`;
      return t.status === status ? true : `Task '${name}' is ${t.status}, expected ${status}.`;
    };
  },

  /** The event loop advanced at least `n` ticks (the tasks actually interleaved). */
  loopRan(n: number) {
    return (_snapshot: Snapshot, runtime: MemoryState): boolean | string => {
      return runtime.ticks >= n ? true : `The event loop ran ${runtime.ticks} tick(s), expected at least ${n}.`;
    };
  },

  /** Two tasks wrap *different* coroutines (independent units of work). */
  differentTasks(a: string, b: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const ta = asyncTaskValue(a, snapshot);
      const tb = asyncTaskValue(b, snapshot);
      if (!ta || !tb) return `Bind both '${a}' and '${b}' as tasks.`;
      return ta.coro !== tb.coro ? true : `'${a}' and '${b}' wrap the same coroutine.`;
    };
  },

  /** `name` is a thread (the object `threading.Thread(...)` returns). */
  isThread(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'thread' ? true : `'${name}' is not a thread — build one with threading.Thread(target, args).`;
    };
  },

  /** `name` (a thread) is currently in `status` (not-started / running / blocked / done). */
  threadStatus(name: string, status: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const t = threadValue(name, snapshot);
      if (!t) return `Bind '${name}' as a thread first.`;
      return t.status === status ? true : `Thread '${name}' is ${t.status}, expected ${status}.`;
    };
  },

  /** Two threads run *different* targets (independent units of work). */
  differentThreads(a: string, b: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const ta = threadValue(a, snapshot);
      const tb = threadValue(b, snapshot);
      if (!ta || !tb) return `Bind both '${a}' and '${b}' as threads.`;
      return ta.target !== tb.target ? true : `'${a}' and '${b}' run the same target.`;
    };
  },

  /** `name` is a lock (the object `threading.Lock()` returns). */
  isLock(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const view = slotView(name, snapshot);
      return view?.type === 'lock' ? true : `'${name}' is not a lock — build one with threading.Lock().`;
    };
  },

  /** `name` (a lock) is currently held. */
  lockHeld(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const l = lockValue(name, snapshot);
      if (!l) return `Bind '${name}' as a lock first.`;
      return l.held ? true : `Lock '${name}' is free, expected HELD.`;
    };
  },

  /** `name` (a lock) is currently free. */
  lockFree(name: string) {
    return (snapshot: Snapshot, _runtime: MemoryState): boolean | string => {
      const l = lockValue(name, snapshot);
      if (!l) return `Bind '${name}' as a lock first.`;
      return l.held ? `Lock '${name}' is HELD, expected free.` : true;
    };
  },

  /** `name[index]` holds the number `value` — the read a race is about. */
  listValueAt(name: string, index: number, value: number) {
    return (snapshot: Snapshot): boolean | string => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (typeof id !== 'string' || !snapshot.heap[id]) return `Bind '${name}' first.`;
      const obj = snapshot.heap[id];
      const arr = obj.value as unknown[];
      if (!Array.isArray(arr)) return `'${name}' is not a list.`;
      const cell = arr[index];
      return Number(cell) === value ? true : `'${name}[${index}]' is ${cell}, expected ${value}.`;
    };
  },
};

/** Read a task's normalized `{ coro, name, status }` from the snapshot, or null. */
function asyncTaskValue(name: string, snapshot: Snapshot): { coro: string; name: string; status: string } | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (obj.type !== 'task') return null;
  const v = obj.value as { coro?: unknown; name?: unknown; status?: unknown };
  if (typeof v.coro !== 'string' || typeof v.status !== 'string') return null;
  return { coro: v.coro, name: typeof v.name === 'string' ? v.name : '', status: v.status };
}

/** Read a thread's normalized `{ target, name, status }` from the snapshot, or null. */
function threadValue(name: string, snapshot: Snapshot): { target: string; name: string; status: string } | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (obj.type !== 'thread') return null;
  const v = obj.value as { target?: unknown; name?: unknown; status?: unknown };
  if (typeof v.target !== 'string' || typeof v.status !== 'string') return null;
  return { target: v.target, name: typeof v.name === 'string' ? v.name : '', status: v.status };
}

/** Read a lock's normalized `{ held, holder }` from the snapshot, or null. */
function lockValue(name: string, snapshot: Snapshot): { held: boolean; holder: string | null } | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (obj.type !== 'lock') return null;
  const v = obj.value as { held?: unknown; holder?: unknown };
  if (typeof v.held !== 'boolean') return null;
  return { held: v.held, holder: v.holder === null ? null : (typeof v.holder === 'string' ? v.holder : null) };
}

/** Read a pandas Series/DataFrame's normalized `buffer` id from the snapshot. */
function pandasBufferId(name: string, snapshot: Snapshot): string | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (obj.type !== 'series' && obj.type !== 'dataframe') return null;
  const v = obj.value as { buffer?: unknown };
  return typeof v.buffer === 'string' ? v.buffer : null;
}

/** Read an ndarray's normalized `buffer` id from the snapshot, or null. */
function ndarrayBufferId(name: string, snapshot: Snapshot): string | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (obj.type !== 'ndarray') return null;
  const v = obj.value as { buffer?: unknown };
  return typeof v.buffer === 'string' ? v.buffer : null;
}

/** Read an iterator's `{ source, index }` from the normalized snapshot. */
function iteratorValue(name: string, snapshot: Snapshot): { source: string; index: number } | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return null;
  const id = module.locals[name];
  if (typeof id !== 'string' || !snapshot.heap[id]) return null;
  const obj = snapshot.heap[id];
  if (!obj.type.endsWith('iter')) return null;
  const v = obj.value as { source?: string; index?: number } | undefined;
  if (!v || typeof v.source !== 'string' || typeof v.index !== 'number') return null;
  return { source: v.source, index: v.index };
}

/** Length of the object an iterator points at, or null if unknown. */
function iteratorSourceLength(id: string, snapshot: Snapshot): number | null {
  const obj = snapshot.heap[id];
  if (!obj) return null;
  if (obj.type === 'str') return (obj.value as string).length;
  if (['list', 'tuple', 'set'].includes(obj.type)) return (obj.value as unknown[]).length;
  return null;
}

/**
 * Shared helper for sharesChild / independent.
 * Returns 'missing' if either name is unbound, 'same' if they alias one object,
 * a truthy id-string if they share a nested container, or null if fully independent.
 */
function sharedChildId(name: string, other: string, snapshot: Snapshot): string | 'missing' | 'same' | null {
  const module = snapshot.frames[snapshot.frames.length - 1];
  if (!module) return 'missing';
  const a = module.locals[name];
  const b = module.locals[other];
  if (!a || !b) return 'missing';
  if (a === b) return 'same';
  const shared = findSharedChild(a as string, b as string, snapshot);
  return shared ?? null;
}

/**
 * BFS over each object's nested container references; the first nested id that
 * appears under both objects is a shared child.
 */
function findSharedChild(idA: string, idB: string, snapshot: Snapshot): string | null {
  const reach = (start: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const obj = snapshot.heap[cur];
      if (!obj) continue;
      for (const ref of nestedRefsOf(obj)) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        queue.push(ref);
      }
    }
    seen.delete(start);
    return seen;
  };
  const reachB = reach(idB);
  for (const ref of reach(idA)) {
    if (reachB.has(ref)) return ref;
  }
  return null;
}

/** Nested container ids stored inside a snapshot heap object. */
function nestedRefsOf(obj: SnapshotHeapObject): string[] {
  const { type, value } = obj;
  const isRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('h_obj_');
  const refs: string[] = [];
  if (type === 'list' || type === 'tuple' || type === 'set') {
    for (const v of value as unknown[]) if (isRef(v)) refs.push(v);
    return refs;
  }
  if (type === 'dict') {
    for (const [, v] of value as Array<[string, unknown]>) if (isRef(v)) refs.push(v);
    return refs;
  }
  return refs;
}
