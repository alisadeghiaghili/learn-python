/**
 * Evaluator for the LearnPyState Python subset.
 *
 * Mutates a memory state (frames + heap) and records stdout / errors.
 */

import { allocObject, cloneState, createModuleState } from './memory.js';
import { parse } from './parser.js';

/**
 * Runtime value: primitives as JS values; mutables/tuples/sets/str as heap id strings.
 * @typedef {number|string|boolean|null} Primitive
 * @typedef {Primitive|objId} RtValue
 */

/**
 * @typedef {{frames: Array, heap: Object, stdout: string[], errors: string[]}} MemoryState
 */

/**
 * Evaluate a source chunk against (and mutating) `state`.
 *
 * @param {string} source - Python-subset source
 * @param {MemoryState} state - memory state to mutate
 * @returns {MemoryState} the same state (mutated)
 * @throws {Error} on parse or runtime errors (also pushed to state.errors)
 */
export function run(source, state) {
  try {
    const ast = parse(source);
    for (const stmt of ast) {
      execStatement(stmt, state);
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    state.errors.push(message);
    throw err;
  }
  return state;
}

/**
 * Create an empty module state and run source (tests / sandbox boot).
 *
 * @param {string} [source]
 * @returns {MemoryState}
 */
export function runFresh(source = '') {
  const state = createModuleState();
  if (source) run(source, state);
  return state;
}

/**
 * Execute one statement.
 *
 * @param {Object} node
 * @param {MemoryState} state
 * @returns {void}
 */
function execStatement(node, state) {
  switch (node.kind) {
    case 'Assign': {
      const value = evalExpr(node.value, state);
      bindTarget(node.target, value, state);
      return;
    }
    case 'AugAssign': {
      const current = readTarget(node.target, state);
      const rhs = evalExpr(node.value, state);
      const combined = binOp(node.op, current, rhs, state, node.line);
      bindTarget(node.target, combined, state);
      return;
    }
    case 'ExprStatement': {
      evalExpr(node.expr, state);
      return;
    }
    case 'Return': {
      const value = node.value ? evalExpr(node.value, state) : null;
      throw new PyReturn(value);
    }
    case 'FunctionDef': {
      const fn = allocObject('function', {
        name: node.name,
        params: [...node.params],
        body: node.body,
      }, `function ${node.name}`);
      // Store as a named frame binding to a code object; also keep callables in heap.
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'Pass':
      return;
    default:
      throw new Error(`RuntimeError: unsupported statement ${node.kind}`);
  }
}

/**
 * @param {*} value
 */
class PyReturn extends Error {
  /** @param {*} value */
  constructor(value) {
    super('return');
    this.value = value;
  }
}

/**
 * @param {MemoryState} state
 * @returns {Object}
 */
function currentFrame(state) {
  return state.frames[state.frames.length - 1];
}

/**
 * @param {Object} frame
 * @param {string} name
 * @param {*} value
 * @returns {void}
 */
function setFrameLocal(frame, name, value) {
  frame.locals[name] = value;
}

/**
 * Resolve a name: local frame then module.
 *
 * @param {string} name
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function lookupName(name, state, line) {
  for (let i = state.frames.length - 1; i >= 0; i--) {
    if (name in state.frames[i].locals) {
      return state.frames[i].locals[name];
    }
  }
  throw new Error(`NameError: name '${name}' is not defined (line ${line})`);
}

/**
 * Assign to a target expression.
 *
 * @param {Object} target
 * @param {*} value
 * @param {MemoryState} state
 * @returns {void}
 */
function bindTarget(target, value, state) {
  if (target.kind === 'Name') {
    setFrameLocal(currentFrame(state), target.id, value);
    return;
  }
  if (target.kind === 'Subscript') {
    const objId = evalExpr(target.object, state);
    const index = target.index ? evalExpr(target.index, state) : null;
    const obj = state.heap[objId];
    if (!obj) throw new Error('TypeError: cannot subscript immutable value');
    if (obj.type === 'list') {
      obj.value[index] = value;
      obj.repr = formatObject(obj, state);
      return;
    }
    if (obj.type === 'dict') {
      const keyRepr = dictKeyRepr(index, state);
      const existing = obj.value.find(([k]) => k === keyRepr);
      if (existing) existing[1] = value;
      else obj.value.push([keyRepr, value]);
      obj.repr = formatObject(obj, state);
      return;
    }
    throw new Error(`TypeError: '${obj.type}' object does not support item assignment`);
  }
  throw new Error(`SyntaxError: cannot assign to ${target.kind}`);
}

/**
 * Read a target used by augmented assignment.
 *
 * @param {Object} target
 * @param {MemoryState} state
 * @returns {*}
 */
function readTarget(target, state) {
  return evalExpr(target, state);
}

/**
 * Evaluate an expression node to a runtime value.
 *
 * @param {Object} node
 * @param {MemoryState} state
 * @returns {*}
 */
function evalExpr(node, state) {
  switch (node.kind) {
    case 'Literal':
      return node.value;
    case 'Name':
      return lookupName(node.id, state, node.line);
    case 'List': {
      const elts = node.elts.map((e) => evalExpr(e, state));
      const obj = allocObject('list', elts, formatListLike(elts, state, '[', ']'));
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Tuple': {
      const elts = node.elts.map((e) => evalExpr(e, state));
      const obj = allocObject('tuple', elts, formatListLike(elts, state, '(', ')'));
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Dict': {
      const pairs = [];
      for (let i = 0; i < node.keys.length; i++) {
        const k = evalExpr(node.keys[i], state);
        const v = evalExpr(node.values[i], state);
        pairs.push([dictKeyRepr(k, state), v]);
      }
      const obj = allocObject('dict', pairs, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'BinOp': {
      const left = evalExpr(node.left, state);
      const right = evalExpr(node.right, state);
      return binOp(node.op, left, right, state, node.line);
    }
    case 'UnaryOp': {
      const val = evalExpr(node.operand, state);
      if (node.op === 'not') return !truthy(val, state);
      if (node.op === '-') return -derefNumber(val, state);
      return derefNumber(val, state);
    }
    case 'BoolOp': {
      const left = evalExpr(node.left, state);
      if (node.op === 'and') {
        return truthy(left, state) ? evalExpr(node.right, state) : left;
      }
      return truthy(left, state) ? left : evalExpr(node.right, state);
    }
    case 'Compare': {
      const left = evalExpr(node.left, state);
      const right = evalExpr(node.right, state);
      return compareOp(node.op, left, right, state);
    }
    case 'Subscript': {
      const objId = evalExpr(node.object, state);
      const index = evalExpr(node.index, state);
      return subscriptGet(objId, index, state, node.line);
    }
    case 'Slice': {
      const objId = evalExpr(node.object, state);
      const start = node.start ? evalExpr(node.start, state) : null;
      const stop = node.stop ? evalExpr(node.stop, state) : null;
      return sliceGet(objId, start, stop, state, node.line);
    }
    case 'Attribute': {
      const objId = evalExpr(node.object, state);
      return { __method__: node.attr, __self__: objId };
    }
    case 'Call': {
      return evalCall(node, state);
    }
    default:
      throw new Error(`RuntimeError: unsupported expression ${node.kind}`);
  }
}

/**
 * Evaluate a call expression (builtins, methods, user functions).
 *
 * @param {Object} node
 * @param {MemoryState} state
 * @returns {*}
 */
function evalCall(node, state) {
  const args = node.args.map((a) => evalExpr(a, state));

  if (node.func.kind === 'Name') {
    const name = node.func.id;
    if (name === 'print') {
      const parts = args.map((a) => printArg(a, state));
      state.stdout.push(parts.join(' '));
      return null;
    }
    if (name === 'len') {
      return lengthOf(args[0], state);
    }
    if (name === 'type') {
      return typeName(args[0], state);
    }
    if (name === 'id') {
      return typeof args[0] === 'string' && state.heap[args[0]]
        ? `id(${args[0]})`
        : String(args[0]);
    }
    if (name === 'int') {
      return Math.trunc(derefNumber(args[0], state));
    }
    if (name === 'str') {
      return displayValue(args[0], state);
    }
    if (name === 'bool') {
      return truthy(args[0], state);
    }
    if (name === 'list') {
      const obj = allocObject('list', [...(Array.isArray(args[0]) ? args[0] : [])], '');
      state.heap[obj.id] = obj;
      // list(iterable) — only list/tuple/set
      if (typeof args[0] === 'string' && state.heap[args[0]]) {
        const src = state.heap[args[0]];
        if (['list', 'tuple', 'set'].includes(src.type)) {
          obj.value = [...src.value];
        }
      }
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'dict') {
      const pairs = [];
      if (typeof args[0] === 'string' && state.heap[args[0]]?.type === 'dict') {
        pairs.push(...state.heap[args[0]].value.map(([k, v]) => [k, v]));
      }
      const obj = allocObject('dict', pairs, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }

    const fnId = lookupName(name, state, node.line);
    return callUserFunction(fnId, args, state, node.line);
  }

  if (node.func.kind === 'Attribute') {
    const method = node.func.attr;
    const objId = evalExpr(node.func.object, state);
    return callMethod(objId, method, args, state, node.line);
  }

  const fnVal = evalExpr(node.func, state);
  return callUserFunction(fnVal, args, state, node.line);
}

/**
 * Call a user-defined function (heap function object).
 *
 * @param {*} fnId
 * @param {*[]} args
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function callUserFunction(fnId, args, state, line) {
  const fn = state.heap[fnId];
  if (!fn || fn.type !== 'function') {
    throw new Error(`TypeError: object is not callable (line ${line})`);
  }
  const { name, params, body } = fn.value;
  if (args.length !== params.length) {
    throw new Error(
      `TypeError: ${name}() takes ${params.length} positional argument(s) but ${args.length} were given (line ${line})`,
    );
  }
  const frame = { name, locals: {} };
  params.forEach((p, i) => {
    frame.locals[p] = args[i];
  });
  state.frames.push(frame);
  try {
    for (const stmt of body) {
      execStatement(stmt, state);
    }
  } catch (err) {
    if (err instanceof PyReturn) {
      state.frames.pop();
      return err.value;
    }
    state.frames.pop();
    throw err;
  }
  state.frames.pop();
  return null;
}

/**
 * Dispatch a method on a heap object.
 *
 * @param {*} objId
 * @param {string} method
 * @param {*[]} args
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function callMethod(objId, method, args, state, line) {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad method target (line ${line})`);

  if (obj.type === 'list') {
    if (method === 'append') {
      obj.value.push(args[0]);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'pop') {
      if (obj.value.length === 0) {
        throw new Error(`IndexError: pop from empty list (line ${line})`);
      }
      const popped = obj.value.pop();
      obj.repr = formatObject(obj, state);
      return popped;
    }
    if (method === 'extend') {
      const src = state.heap[args[0]];
      if (!src || !['list', 'tuple', 'set'].includes(src.type)) {
        throw new Error(`TypeError: extend() requires an iterable (line ${line})`);
      }
      obj.value.push(...src.value);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'insert') {
      obj.value.splice(Number(args[0]), 0, args[1]);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'remove') {
      const idx = findIndexOfValue(obj.value, args[0], state);
      if (idx < 0) throw new Error(`ValueError: list.remove(x): x not in list (line ${line})`);
      obj.value.splice(idx, 1);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'clear') {
      obj.value = [];
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'copy') {
      const clone = allocObject('list', [...obj.value], '');
      state.heap[clone.id] = clone;
      clone.repr = formatObject(clone, state);
      return clone.id;
    }
  }

  if (obj.type === 'dict') {
    if (method === 'keys') {
      const keys = obj.value.map(([k]) => k);
      const out = allocObject('list', keys.map((k) => keyToValue(k, state)), '');
      // store string keys as heap strings for display fidelity
      out.value = obj.value.map(([k]) => allocString(k, state));
      out.repr = formatObject(out, state);
      return out.id;
    }
    if (method === 'get') {
      const keyRepr = dictKeyRepr(args[0], state);
      const found = obj.value.find(([k]) => k === keyRepr);
      return found ? found[1] : (args.length > 1 ? args[1] : null);
    }
    if (method === 'update') {
      const src = state.heap[args[0]];
      if (!src || src.type !== 'dict') throw new Error(`TypeError: update() requires a dict (line ${line})`);
      for (const [k, v] of src.value) {
        const existing = obj.value.find(([ek]) => ek === k);
        if (existing) existing[1] = v;
        else obj.value.push([k, v]);
      }
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'pop') {
      const keyRepr = dictKeyRepr(args[0], state);
      const idx = obj.value.findIndex(([k]) => k === keyRepr);
      if (idx < 0) {
        if (args.length > 1) return args[1];
        throw new Error(`KeyError: ${keyRepr} (line ${line})`);
      }
      const [, v] = obj.value.splice(idx, 1)[0];
      obj.repr = formatObject(obj, state);
      return v;
    }
  }

  if (obj.type === 'str') {
    // methods on string objects stored as heap ids
    const s = obj.value;
    if (method === 'upper') return allocString(s.toUpperCase(), state);
    if (method === 'lower') return allocString(s.toLowerCase(), state);
  }

  throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
}

/**
 * Allocate a string heap object (strings are objects in this visualizer).
 *
 * @param {string} s
 * @param {MemoryState} state
 * @returns {string} object id
 */
function allocString(s, state) {
  const obj = allocObject('str', s, formatStr(s));
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Python-style string repr using single quotes.
 *
 * @param {string} s
 * @returns {string}
 */
function formatStr(s) {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

/**
 * Canonical dict key label.
 *
 * @param {*} k
 * @param {MemoryState} state
 * @returns {string}
 */
function dictKeyRepr(k, state) {
  return displayValue(k, state);
}

/**
 * @param {string} keyRepr
 * @param {MemoryState} state
 * @returns {*}
 */
function keyToValue(keyRepr, state) {
  let s = keyRepr;
  if (s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return allocString(s, state);
}

/**
 * @param {*} a
 * @param {*} b
 * @param {MemoryState} state
 * @returns {boolean}
 */
function valuesEqual(a, b, state) {
  return displayValue(a, state) === displayValue(b, state);
}

/**
 * @param {*[]} arr
 * @param {*} target
 * @param {MemoryState} state
 * @returns {number}
 */
function findIndexOfValue(arr, target, state) {
  for (let i = 0; i < arr.length; i++) {
    if (valuesEqual(arr[i], target, state)) return i;
  }
  return -1;
}

/**
 * @param {*} v
 * @param {MemoryState} state
 * @returns {boolean}
 */
function truthy(v, state) {
  if (v === null || v === false || v === 0 || v === '') return false;
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set') return obj.value.length > 0;
    if (obj.type === 'dict') return obj.value.length > 0;
    if (obj.type === 'str') return obj.value.length > 0;
  }
  return Boolean(v);
}

/**
 * @param {*} v
 * @param {MemoryState} state
 * @returns {number}
 */
function derefNumber(v, state) {
  return Number(v);
}

/**
 * @param {*} v
 * @param {MemoryState} state
 * @returns {number}
 */
function lengthOf(v, state) {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set', 'dict'].includes(obj.type)) return obj.value.length;
    if (obj.type === 'str') return obj.value.length;
  }
  if (typeof v === 'string') return v.length;
  throw new Error(`TypeError: object has no len()`);
}

/**
 * @param {*} v
 * @param {MemoryState} state
 * @returns {string}
 */
function typeName(v, state) {
  if (typeof v === 'string' && state.heap[v]) return state.heap[v].type;
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  return typeof v;
}

/**
 * @param {string} op
 * @param {*} left
 * @param {*} right
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function binOp(op, left, right, state, line) {
  // string concatenation
  const lt = typeName(left, state);
  const rt = typeName(right, state);
  if (op === '+' && lt === 'str' && rt === 'str') {
    const lv = state.heap[left].value;
    const rv = state.heap[right].value;
    return allocString(lv + rv, state);
  }
  if (op === '+' && lt === 'list' && rt === 'list') {
    const merged = [...state.heap[left].value, ...state.heap[right].value];
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }
  if (op === '*' && lt === 'list' && rt === 'int') {
    const n = Number(right);
    const src = state.heap[left].value;
    const merged = [];
    for (let i = 0; i < n; i++) merged.push(...src);
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }
  if (op === '*' && lt === 'str' && rt === 'int') {
    return allocString(state.heap[left].value.repeat(Number(right)), state);
  }

  const a = Number(left);
  const b = Number(right);
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) throw new Error(`ZeroDivisionError: division by zero (line ${line})`);
      return a / b;
    case '//':
      if (b === 0) throw new Error(`ZeroDivisionError: integer division or modulo by zero (line ${line})`);
      return Math.floor(a / b);
    case '%':
      if (b === 0) throw new Error(`ZeroDivisionError: integer division or modulo by zero (line ${line})`);
      return ((a % b) + b) % b;
    case '**': return a ** b;
    default:
      throw new Error(`RuntimeError: unsupported operator ${op} (line ${line})`);
  }
}

/**
 * @param {string} op
 * @param {*} left
 * @param {*} right
 * @param {MemoryState} state
 * @returns {boolean}
 */
function compareOp(op, left, right, state) {
  if (op === 'is') return left === right;
  if (op === 'is not') return left !== right;
  if (op === '==') return valuesEqual(left, right, state);
  if (op === '!=') return !valuesEqual(left, right, state);
  if (op === 'in') {
    const container = state.heap[right];
    if (!container) return false;
    if (['list', 'tuple', 'set'].includes(container.type)) {
      return container.value.some((v) => valuesEqual(v, left, state));
    }
    if (container.type === 'dict') {
      return container.value.some(([k]) => k === dictKeyRepr(left, state));
    }
  }
  const a = Number(left);
  const b = Number(right);
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    default:
      return false;
  }
}

/**
 * @param {*} objId
 * @param {*} index
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function subscriptGet(objId, index, state, line) {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: object is not subscriptable (line ${line})`);
  if (obj.type === 'list' || obj.type === 'tuple') {
    const i = Number(index);
    const idx = i < 0 ? obj.value.length + i : i;
    if (idx < 0 || idx >= obj.value.length) {
      throw new Error(`IndexError: index out of range (line ${line})`);
    }
    return obj.value[idx];
  }
  if (obj.type === 'dict') {
    const keyRepr = dictKeyRepr(index, state);
    const found = obj.value.find(([k]) => k === keyRepr);
    if (!found) throw new Error(`KeyError: ${keyRepr} (line ${line})`);
    return found[1];
  }
  if (obj.type === 'str') {
    const i = Number(index);
    const s = obj.value;
    const idx = i < 0 ? s.length + i : i;
    if (idx < 0 || idx >= s.length) throw new Error(`IndexError: string index out of range (line ${line})`);
    return allocString(s[idx], state);
  }
  throw new Error(`TypeError: '${obj.type}' object is not subscriptable (line ${line})`);
}

/**
 * @param {*} objId
 * @param {*} start
 * @param {*} stop
 * @param {MemoryState} state
 * @param {number} line
 * @returns {*}
 */
function sliceGet(objId, start, stop, state, line) {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: object is not sliceable (line ${line})`);
  const s = start === null ? 0 : Number(start);
  const e = stop === null ? (obj.type === 'str' ? obj.value.length : obj.value.length) : Number(stop);
  if (obj.type === 'list' || obj.type === 'tuple') {
    const elts = obj.value.slice(s, e);
    const out = allocObject(obj.type, elts, '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }
  if (obj.type === 'str') {
    return allocString(obj.value.slice(s, e), state);
  }
  throw new Error(`TypeError: '${obj.type}' object is not sliceable (line ${line})`);
}

/**
 * @param {*[]} elts
 * @param {MemoryState} state
 * @param {string} open
 * @param {string} close
 * @returns {string}
 */
function formatListLike(elts, state, open, close) {
  return open + elts.map((e) => displayValue(e, state)).join(', ') + close;
}

/**
 * @param {{type: string, value: *}} obj
 * @param {MemoryState} state
 * @returns {string}
 */
function formatObject(obj, state) {
  if (obj.type === 'list') return formatListLike(obj.value, state, '[', ']');
  if (obj.type === 'tuple') {
    const body = formatListLike(obj.value, state, '(', ')');
    return obj.value.length === 1 ? `(${displayValue(obj.value[0], state)},)` : body;
  }
  if (obj.type === 'set') {
    return '{' + obj.value.map((e) => displayValue(e, state)).join(', ') + '}';
  }
  if (obj.type === 'dict') {
    return '{' + obj.value.map(([k, v]) => `${k}: ${displayValue(v, state)}`).join(', ') + '}';
  }
  if (obj.type === 'str') return formatStr(obj.value);
  return String(obj.repr ?? obj.value);
}

/**
 * Human-facing display of a runtime value (repr-style).
 *
 * @param {*} v
 * @param {MemoryState} state
 * @returns {string}
 */
export function displayValue(v, state) {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && state.heap[v]) {
    return state.heap[v].repr || formatObject(state.heap[v], state);
  }
  if (typeof v === 'string') return formatStr(v);
  return String(v);
}

/**
 * print()/str() style — strings unquoted, like CPython's print.
 *
 * @param {*} v
 * @param {MemoryState} state
 * @returns {string}
 */
function printArg(v, state) {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    return obj.type === 'str' ? obj.value : (obj.repr || formatObject(obj, state));
  }
  if (typeof v === 'string') return v;
  return String(v);
}

export { cloneState, createModuleState };
