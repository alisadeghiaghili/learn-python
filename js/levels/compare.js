/**
 * Goal checking for levels (analogue of LGB TreeCompare).
 */

/**
 * Deep structural equality of two snapshot fragments.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * View of a non-heap (primitive) snapshot slot.
 *
 * @param {*} slot
 * @returns {{type: string, repr: string, value: *}}
 */
function primitiveView(slot) {
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
 * @typedef {{
 *   type: 'vars',
 *   vars: Object<string, {type: string, repr: string, value?: *}>
 * } | {
 *   type: 'predicates',
 *   predicates: Array<(snapshot: Object, runtime: Object) => boolean | string>
 * } | {
 *   type: 'stdout',
 *   lines: string[]
 * }} GoalSpec
 */

/**
 * Check a level goal against the current memory snapshot and runtime.
 *
 * @param {GoalSpec} goal
 * @param {Object} snapshot - normalized snapshot from memory.snapshot()
 * @param {{stdout: string[], frames: Array, heap: Object}} runtime
 * @returns {{ok: boolean, message: string}}
 */
export function checkGoal(goal, snapshot, runtime) {
  if (!goal) return { ok: false, message: 'No goal defined.' };

  if (goal.type === 'vars') {
    const module = snapshot.frames.find((f) => f.name === '<module>') || snapshot.frames[snapshot.frames.length - 1];
    for (const [name, expected] of Object.entries(goal.vars)) {
      if (!(name in module.locals)) {
        return { ok: false, message: `Missing binding for '${name}'.` };
      }
      const slot = module.locals[name];
      const obj = snapshot.heap[slot];
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
 * Convenience predicate builders used by the level pack.
 */
export const preds = {
  /**
   * @param {string} name
   * @returns {(snapshot: Object) => boolean|string}
   */
  hasName(name) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      return name in module.locals ? true : `Define a variable named '${name}'.`;
    };
  },

  /**
   * @param {string} name
   * @param {string} alias
   * @returns {(snapshot: Object) => boolean|string}
   */
  aliased(name, alias) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Both '${name}' and '${alias}' must be bound.`;
      return a === b ? true : `'${name}' and '${alias}' must reference the same object.`;
    };
  },

  /**
   * @param {string} name
   * @param {string} alias
   * @returns {(snapshot: Object) => boolean|string}
   */
  notAliased(name, alias) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Both '${name}' and '${alias}' must be bound.`;
      return a !== b ? true : `'${name}' and '${alias}' must point at different objects.`;
    };
  },

  /**
   * @param {string} name
   * @param {string} type
   * @returns {(snapshot: Object) => boolean|string}
   */
  hasType(name, type) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Bind '${name}' first.`;
      const obj = snapshot.heap[id];
      return obj.type === type ? true : `'${name}' is ${obj.type}, expected ${type}.`;
    };
  },

  /**
   * @param {string} name
   * @param {string} repr
   * @returns {(snapshot: Object) => boolean|string}
   */
  hasRepr(name, repr) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Bind '${name}' first.`;
      const obj = snapshot.heap[id];
      return obj.repr === repr ? true : `'${name}' is ${obj.repr}, expected ${repr}.`;
    };
  },

  /**
   * Shared mutable object mutated through alias.
   *
   * @param {string} name
   * @param {string} alias
   * @param {string} repr
   * @returns {(snapshot: Object) => boolean|string}
   */
  sharedMutation(name, alias, repr) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const a = module.locals[name];
      const b = module.locals[alias];
      if (!a || !b) return `Bind both '${name}' and '${alias}'.`;
      if (a !== b) return `'${name}' and '${alias}' must share one object.`;
      const obj = snapshot.heap[a];
      return obj.repr === repr ? true : `Object is ${obj.repr}, expected ${repr}.`;
    };
  },

  /**
   * Function name exists as a heap function.
   *
   * @param {string} name
   * @returns {(snapshot: Object) => boolean|string}
   */
  hasFunction(name) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Define function '${name}'.`;
      const obj = snapshot.heap[id];
      return obj && obj.type === 'function' ? true : `'${name}' is not a function.`;
    };
  },

  /**
   * @param {string} name
   * @param {number} count
   * @returns {(snapshot: Object) => boolean|string}
   */
  listLen(name, count) {
    return (snapshot) => {
      const module = snapshot.frames[snapshot.frames.length - 1];
      const id = module.locals[name];
      if (!id) return `Bind '${name}' first.`;
      const obj = snapshot.heap[id];
      const len = obj.type === 'dict' || obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set'
        ? obj.value.length
        : obj.value.length;
      return len === count ? true : `'${name}' length is ${len}, expected ${count}.`;
    };
  },
};
