/**
 * Goal checking for levels (analogue of LGB TreeCompare).
 */

import type { GoalResult, GoalSpec, MemoryState, Snapshot } from './types';

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
};
