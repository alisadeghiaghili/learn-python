/**
 * Evaluator for learn-python's Python subset.
 *
 * Mutates a memory state (frames + heap) and records stdout / errors.
 */

import { allocObject, cloneState, createModuleState } from './memory';
import { parse } from './parser';
import type {
  AstNode,
  Frame,
  FunctionCode,
  HeapObject,
  MemoryState,
  RtValue,
} from './types';

/**
 * Evaluate a source chunk against (and mutating) `state`.
 *
 * @throws {Error} on parse or runtime errors (also pushed to state.errors)
 */
export function run(source: string, state: MemoryState): MemoryState {
  try {
    const ast = parse(source);
    for (const stmt of ast) {
      execStatement(stmt, state);
    }
    // A nested child may have been mutated in place (e.g. a[1].append(3)),
    // leaving a parent container's cached repr stale. Recompute container
    // reprs so display, print, and goal checks all see the current value.
    refreshReprs(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.errors.push(message);
    throw err;
  }
  return state;
}

/**
 * Recompute the cached `repr` of every container heap object so parents reflect
 * nested in-place mutations. Cheap: containers only, no allocation.
 */
function refreshReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'tuple' || obj.type === 'set' || obj.type === 'defaultdict') {
      obj.repr = formatObject(obj, state);
    }
  }
}

/**
 * Create an empty module state and run source (tests / sandbox boot).
 */
export function runFresh(source = ''): MemoryState {
  const state = createModuleState();
  if (source) run(source, state);
  return state;
}

/**
 * Execute one statement.
 */
function execStatement(node: AstNode, state: MemoryState): void {
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
      } as FunctionCode, `function ${node.name}`);
      // Store as a named frame binding to a code object; also keep callables in heap.
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'Import': {
      const mod = allocObject('module', { name: node.name }, `<module '${node.name}'>`);
      state.heap[mod.id] = mod;
      const localName = node.alias ?? node.name.split('.')[0];
      setFrameLocal(currentFrame(state), localName, mod.id);
      return;
    }
    case 'Pass':
      return;
    default:
      throw new Error(`RuntimeError: unsupported statement ${node.kind}`);
  }
}

class PyReturn extends Error {
  value: RtValue;
  constructor(value: RtValue) {
    super('return');
    this.value = value;
  }
}

function currentFrame(state: MemoryState): Frame {
  return state.frames[state.frames.length - 1];
}

function setFrameLocal(frame: Frame, name: string, value: RtValue): void {
  frame.locals[name] = value;
}

/**
 * Resolve a name: local frame then module.
 */
function lookupName(name: string, state: MemoryState, line: number): RtValue {
  for (let i = state.frames.length - 1; i >= 0; i--) {
    if (name in state.frames[i].locals) {
      return state.frames[i].locals[name];
    }
  }
  // A bare reference to a constructor (e.g. `defaultdict(int)`, `map(int, xs)`)
  // resolves to a `builtin` object so it can be stored on a map/defaultdict.
  if (BUILTIN_CONSTRUCTORS.has(name)) {
    const b = allocObject('builtin', name, name);
    state.heap[b.id] = b;
    return b.id;
  }
  throw new Error(`NameError: name '${name}' is not defined (line ${line})`);
}

/**
 * Assign to a target expression.
 */
function bindTarget(target: AstNode, value: RtValue, state: MemoryState): void {
  if (target.kind === 'Name') {
    setFrameLocal(currentFrame(state), target.id, value);
    return;
  }
  if (target.kind === 'Subscript') {
    const objId = evalExpr(target.object, state);
    const index = target.index ? evalExpr(target.index, state) : null;
    const obj = state.heap[objId as string];
    if (!obj) throw new Error('TypeError: cannot subscript immutable value');
    if (obj.type === 'list') {
      (obj.value as RtValue[])[index as number] = value;
      obj.repr = formatObject(obj, state);
      return;
    }
    if (obj.type === 'dict' || obj.type === 'defaultdict') {
      const keyRepr = dictKeyRepr(index, state);
      const entries = dictEntries(obj);
      const existing = entries.find(([k]) => k === keyRepr);
      if (existing) existing[1] = value;
      else entries.push([keyRepr, value]);
      obj.repr = formatObject(obj, state);
      return;
    }
    throw new Error(`TypeError: '${obj.type}' object does not support item assignment`);
  }
  throw new Error(`SyntaxError: cannot assign to ${target.kind}`);
}

/**
 * Read a target used by augmented assignment.
 */
function readTarget(target: AstNode, state: MemoryState): RtValue {
  return evalExpr(target, state);
}

/**
 * Evaluate an expression node to a runtime value.
 */
function evalExpr(node: AstNode, state: MemoryState): RtValue {
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
      const pairs: Array<[string, RtValue]> = [];
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
    case 'Set': {
      const seen = new Map<string, RtValue>();
      for (const e of node.elts) {
        const v = evalExpr(e, state);
        // De-duplicate by displayed value (primitive/heap identity).
        const key = displayValue(v, state);
        if (!seen.has(key)) seen.set(key, v);
      }
      const elts = [...seen.values()];
      const obj = allocObject('set', elts, '');
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
      const index = evalExpr(node.index!, state);
      return subscriptGet(objId, index, state, node.line);
    }
    case 'Slice': {
      const objId = evalExpr(node.object, state);
      const start = node.start ? evalExpr(node.start, state) : null;
      const stop = node.stop ? evalExpr(node.stop, state) : null;
      return sliceGet(objId, start, stop, state, node.line);
    }
    case 'Attribute':
      // Method references are only ever immediately called; resolve in evalCall.
      throw new Error(`RuntimeError: unsupported expression ${node.kind}`);
    case 'Call': {
      return evalCall(node, state);
    }
    default:
      throw new Error(`RuntimeError: unsupported expression ${node.kind}`);
  }
}

/**
 * Evaluate a call expression (builtins, methods, user functions).
 */
function evalCall(node: Extract<AstNode, { kind: 'Call' }>, state: MemoryState): RtValue {
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
      return typeof args[0] === 'string' && state.heap[args[0] as string]
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
    if (name === 'iter') {
      return makeIterator(args[0], state, node.line);
    }
    if (name === 'next') {
      return nextIterator(args[0], state, node.line);
    }
    if (name === 'map') {
      return makeMapFilter(args, state, node.line, false);
    }
    if (name === 'filter') {
      return makeMapFilter(args, state, node.line, true);
    }
    if (name === 'reduce') {
      return reduce(args, state, node.line);
    }
    if (name === 'list') {
      const obj = allocObject('list', Array.isArray(args[0]) ? [...(args[0] as unknown as RtValue[])] : [], '');
      state.heap[obj.id] = obj;
      // list(iterable) — only list/tuple/set
      if (typeof args[0] === 'string' && state.heap[args[0] as string]) {
        const src = state.heap[args[0] as string];
        if (['list', 'tuple', 'set'].includes(src.type)) {
          obj.value = [...(src.value as RtValue[])];
        }
      }
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'dict') {
      const pairs: Array<[string, RtValue]> = [];
      if (typeof args[0] === 'string' && state.heap[args[0] as string]?.type === 'dict') {
        pairs.push(...(state.heap[args[0] as string].value as Array<[string, RtValue]>));
      }
      const obj = allocObject('dict', pairs, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'set') {
      const seen = new Map<string, RtValue>();
      const src = typeof args[0] === 'string' ? state.heap[args[0] as string] : undefined;
      if (src && ['list', 'tuple', 'set'].includes(src.type)) {
        for (const v of src.value as RtValue[]) {
          const key = displayValue(v, state);
          if (!seen.has(key)) seen.set(key, v);
        }
      }
      const obj = allocObject('set', [...seen.values()], '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'scatter' || name === 'line') {
      // Title is a display label, so use the unquoted (print-style) value,
      // not the repr form with surrounding quotes.
      const title = args.length >= 3 ? printArg(args[2], state) : name;
      const points = zipPoints(args[0], args[1], state);
      state.plots.push({ kind: name, title, points });
      return null;
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
 */
function callUserFunction(fnId: RtValue, args: RtValue[], state: MemoryState, line: number): RtValue {
  const fn = state.heap[fnId as string];
  if (!fn || fn.type !== 'function') {
    throw new Error(`TypeError: object is not callable (line ${line})`);
  }
  const { name, params, body } = fn.value as FunctionCode;
  if (args.length !== params.length) {
    throw new Error(
      `TypeError: ${name}() takes ${params.length} positional argument(s) but ${args.length} were given (line ${line})`,
    );
  }
  const frame: Frame = { name, locals: {} };
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
 */
function callMethod(objId: RtValue, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new Error(`TypeError: bad method target (line ${line})`);

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'collections') {
    if (method === 'defaultdict') return makeDefaultdict(args, state, line);
    throw new Error(`AttributeError: module 'collections' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'functools') {
    if (method === 'reduce') return reduce(args, state, line);
    throw new Error(`AttributeError: module 'functools' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'copy') {
    if (args.length !== 1) throw new Error(`TypeError: copy() takes exactly one argument (line ${line})`);
    if (method === 'copy') return shallowClone(args[0], state, line);
    if (method === 'deepcopy') return deepClone(args[0], state, line);
    throw new Error(`AttributeError: module 'copy' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'list') {
    const value = obj.value as RtValue[];
    if (method === 'append') {
      value.push(args[0]);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'pop') {
      if (value.length === 0) {
        throw new Error(`IndexError: pop from empty list (line ${line})`);
      }
      const popped = value.pop() as RtValue;
      obj.repr = formatObject(obj, state);
      return popped;
    }
    if (method === 'extend') {
      const src = state.heap[args[0] as string];
      if (!src || !['list', 'tuple', 'set'].includes(src.type)) {
        throw new Error(`TypeError: extend() requires an iterable (line ${line})`);
      }
      value.push(...(src.value as RtValue[]));
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'insert') {
      value.splice(Number(args[0]), 0, args[1]);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'remove') {
      const idx = findIndexOfValue(value, args[0], state);
      if (idx < 0) throw new Error(`ValueError: list.remove(x): x not in list (line ${line})`);
      value.splice(idx, 1);
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'clear') {
      obj.value = [];
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'copy') {
      const clone = allocObject('list', [...value], '');
      state.heap[clone.id] = clone;
      clone.repr = formatObject(clone, state);
      return clone.id;
    }
  }

  if (obj.type === 'dict') {
    const entries = obj.value as Array<[string, RtValue]>;
    if (method === 'keys') {
      const keys = entries.map(([k]) => k);
      const out = allocObject('list', keys.map((k) => keyToValue(k, state)), '');
      // store string keys as heap strings for display fidelity
      out.value = entries.map(([k]) => allocString(k, state));
      out.repr = formatObject(out, state);
      return out.id;
    }
    if (method === 'get') {
      const keyRepr = dictKeyRepr(args[0], state);
      const found = entries.find(([k]) => k === keyRepr);
      return found ? found[1] : (args.length > 1 ? args[1] : null);
    }
    if (method === 'update') {
      const src = state.heap[args[0] as string];
      if (!src || src.type !== 'dict') throw new Error(`TypeError: update() requires a dict (line ${line})`);
      const srcEntries = src.value as Array<[string, RtValue]>;
      for (const [k, v] of srcEntries) {
        const existing = entries.find(([ek]) => ek === k);
        if (existing) existing[1] = v;
        else entries.push([k, v]);
      }
      obj.repr = formatObject(obj, state);
      return null;
    }
    if (method === 'pop') {
      const keyRepr = dictKeyRepr(args[0], state);
      const idx = entries.findIndex(([k]) => k === keyRepr);
      if (idx < 0) {
        if (args.length > 1) return args[1];
        throw new Error(`KeyError: ${keyRepr} (line ${line})`);
      }
      const [, v] = entries.splice(idx, 1)[0];
      obj.repr = formatObject(obj, state);
      return v;
    }
    if (method === 'copy') {
      const clone = allocObject('dict', entries.map(([k, v]) => [k, v] as [string, RtValue]), '');
      state.heap[clone.id] = clone;
      clone.repr = formatObject(clone, state);
      return clone.id;
    }
  }

  if (obj.type === 'str') {
    // methods on string objects stored as heap ids
    const s = obj.value as string;
    if (method === 'upper') return allocString(s.toUpperCase(), state);
    if (method === 'lower') return allocString(s.toLowerCase(), state);
  }

  throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
}

/**
 * Allocate a string heap object (strings are objects in this visualizer).
 */
function allocString(s: string, state: MemoryState): string {
  const obj = allocObject('str', s, formatStr(s));
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Shallow clone a heap container: a new outer box whose nested container slots
 * point at the SAME child objects (Python `copy.copy` / `.copy()` semantics).
 */
function shallowClone(srcId: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof srcId !== 'string' || !state.heap[srcId]) {
    throw new Error(`TypeError: argument of type '${typeName(srcId, state)}' is not a container (line ${line})`);
  }
  const src = state.heap[srcId];
  const obj = allocObject(src.type, cloneContainerValue(src.type, src.value, state, false), '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

/**
 * Deep clone a heap container: a new outer box whose nested containers are
 * themselves cloned (Python `copy.deepcopy` semantics).
 */
function deepClone(srcId: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof srcId !== 'string' || !state.heap[srcId]) {
    throw new Error(`TypeError: argument of type '${typeName(srcId, state)}' is not a container (line ${line})`);
  }
  const src = state.heap[srcId];
  const obj = allocObject(src.type, cloneContainerValue(src.type, src.value, state, true), '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

/**
 * Rebuild a container's `value`, cloning nested containers in place.
 * When `deep` is false, nested containers are reused (their ids pass through);
 * when true, each nested container gets its own fresh (recursively cloned) box.
 */
function cloneContainerValue(type: string, value: unknown, state: MemoryState, deep: boolean): unknown {
  const cloneChild = (child: RtValue): RtValue =>
    typeof child === 'string' && state.heap[child] && isContainer(state.heap[child].type) && deep
      ? deepClone(child, state, 0)
      : child;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return (value as RtValue[]).map(cloneChild);
  }
  if (type === 'dict') {
    return (value as Array<[string, RtValue]>).map(([k, v]) => [k, cloneChild(v)] as [string, RtValue]);
  }
  return value;
}

function isContainer(type: string): boolean {
  return type === 'list' || type === 'tuple' || type === 'set' || type === 'dict';
}

/**
 * Iterator object value: a reference to the iterable it walks plus a cursor.
 */
interface IteratorValue {
  source: string;
  index: number;
}

// Containers the subset can walk. (Strings are raw values in this engine, not
// heap objects, so they are not iterable — a pre-existing model limitation.)
function isIterableType(type: string): boolean {
  return type === 'list' || type === 'tuple' || type === 'set';
}

function isIteratorType(type: string): boolean {
  return type.endsWith('iter');
}

/** `iter(x)` → a fresh stateful iterator object over container `x`. */
function makeIterator(v: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof v !== 'string' || !state.heap[v]) {
    throw new Error(`TypeError: '${typeName(v, state)}' object is not iterable (line ${line})`);
  }
  const src = state.heap[v];
  if (!isIterableType(src.type)) {
    throw new Error(`TypeError: '${src.type}' object is not iterable (line ${line})`);
  }
  const obj = allocObject(src.type + 'iter', { source: v, index: 0 } as IteratorValue, `<${src.type}_iterator>`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `next(it)` → advance the cursor one step and return the element. */
function nextIterator(v: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof v !== 'string' || !state.heap[v] || !isIteratorType(state.heap[v].type)) {
    throw new Error(`TypeError: argument of type '${typeName(v, state)}' is not an iterator (line ${line})`);
  }
  const obj = state.heap[v];
  // map/filter iterators delegate to their source and apply the function.
  if (isMapFilterValue(obj.value)) {
    return stepMapFilter(v, state, line);
  }
  const itv = obj.value as IteratorValue;
  const src = state.heap[itv.source];
  if (!src) throw new Error(`RuntimeError: iterator source was released (line ${line})`);
  const len = src.type === 'str' ? (src.value as string).length : (src.value as RtValue[]).length;
  if (itv.index >= len) {
    throw new Error(`StopIteration (line ${line})`);
  }
  const elem = src.type === 'str'
    ? allocString((src.value as string)[itv.index]!, state)
    : (src.value as RtValue[])[itv.index]!;
  itv.index += 1;
  return elem;
}

/**
 * Names that can be referenced as *values* (e.g. passed to `defaultdict`).
 * A bare occurrence allocates a `builtin` object; a call uses the real builtin.
 */
const BUILTIN_CONSTRUCTORS = new Set(['list', 'dict', 'int', 'float', 'str', 'tuple', 'set', 'bool', 'len', 'range', 'sorted', 'min', 'max', 'abs', 'sum']);

/**
 * A defaultdict's stored value: the default factory name plus its entry map.
 * Kept parallel to a plain `dict` (entries array) so the shared dict code
 * paths in bindTarget / subscriptGet / formatObject work unchanged.
 */
interface DefaultDictValue {
  factory: string;
  entries: Array<[string, RtValue]>;
}

/** `defaultdict(factory)` → a dict-like box carrying a factory (bare value). */
function makeDefaultdict(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: defaultdict() takes one argument (the default factory) (line ${line})`);
  const factory = bareBuiltinName(args[0], state, line);
  const obj = allocObject('defaultdict', { factory, entries: [] } as DefaultDictValue, '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

/** Read the entry map from a plain `dict` or a `defaultdict`. */
function dictEntries(obj: HeapObject): Array<[string, RtValue]> {
  if (obj.type === 'defaultdict') return (obj.value as DefaultDictValue).entries;
  return obj.value as Array<[string, RtValue]>;
}

/**
 * Resolve a bare builtin argument to its canonical name. Accepts a `builtin`
 * object (from a bare value) or an ordinary name; errors otherwise.
 */
function bareBuiltinName(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const o = state.heap[v];
    if (o.type === 'builtin') return o.value as string;
    throw new Error(`TypeError: expected a bare builtin, got a ${o.type} (line ${line})`);
  }
  throw new Error(`TypeError: expected a bare builtin (e.g. list or int), not ${typeName(v, state)} (line ${line})`);
}

/**
 * Produce the value a defaultdict factory yields for a fresh key.
 */
function applyFactory(factory: string, state: MemoryState, line: number): RtValue {
  if (factory === 'list') {
    const o = allocObject('list', [], '');
    state.heap[o.id] = o;
    o.repr = formatObject(o, state);
    return o.id;
  }
  if (factory === 'dict') {
    const o = allocObject('dict', [], '');
    state.heap[o.id] = o;
    o.repr = formatObject(o, state);
    return o.id;
  }
  if (factory === 'int' || factory === 'float') return 0;
  if (factory === 'bool') return false;
  if (factory === 'str') {
    const s = allocString('', state);
    return s;
  }
  throw new Error(`TypeError: default factory '${factory}' is not supported (line ${line})`);
}

/**
 * A map/filter iterator value: a reference to a source iterator plus the
 * function it applies (a `builtin` or user-function object id).
 */
interface MapFilterValue {
  source: string;
  fn: string;
  isFilter: boolean;
}

function isMapFilterValue(value: unknown): value is MapFilterValue {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { source?: unknown; fn?: unknown; isFilter?: unknown };
  return typeof v.source === 'string' && v.source.startsWith('obj_')
    && typeof v.fn === 'string' && v.fn.startsWith('obj_')
    && typeof v.isFilter === 'boolean';
}

/** `map(fn, it)` / `filter(pred, it)` → a lazy iterator over `it`. */
function makeMapFilter(args: RtValue[], state: MemoryState, line: number, isFilter: boolean): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: ${isFilter ? 'filter' : 'map'}() takes exactly two arguments (line ${line})`);
  const fn = resolveCallableName(args[0], state, line);
  const src = ensureIterator(args[1], state, line);
  const obj = allocObject(isFilter ? 'filteriter' : 'mapiter', { source: src, fn, isFilter } as MapFilterValue, `<${isFilter ? 'filter' : 'map'} object>`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/** Resolve the function argument to an object id (builtin object or user fn). */
function resolveCallableName(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const o = state.heap[v];
    if (o.type === 'builtin' || o.type === 'function') return v;
  }
  throw new Error(`TypeError: first argument must be a function (line ${line})`);
}

/** Ensure an argument is an iterator object (auto-wrap iterables with iter()). */
function ensureIterator(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const t = state.heap[v].type;
    if (isIteratorType(t)) return v;
    if (isIterableType(t)) return makeIterator(v, state, line) as string;
  }
  throw new Error(`TypeError: argument of type '${typeName(v, state)}' is not iterable (line ${line})`);
}

/**
 * A single `next` step for a map/filter iterator: pull from the source,
 * (for filter) discard falsy elements, and (for map) apply the function.
 */
function stepMapFilter(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  const mf = obj.value as MapFilterValue;
  for (;;) {
    if (state.heap[mf.source] && isIteratorType(state.heap[mf.source].type)) {
      const elem = nextIterator(mf.source, state, line);
      if (!mf.isFilter || truthy(elem, state)) {
        return mf.isFilter ? elem : applyBuiltinCall(mf.fn, [elem], state, line);
      }
    } else {
      throw new Error(`StopIteration (line ${line})`);
    }
  }
}

/** Call a `builtin` object (or user function) with the given args. */
function applyBuiltinCall(fnId: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const fn = state.heap[fnId];
  if (!fn) throw new Error(`RuntimeError: function reference was released (line ${line})`);
  if (fn.type === 'function') return callUserFunction(fnId, args, state, line);
  if (fn.type === 'builtin') {
    const b = fn.value as string;
    const a = args[0];
    if (b === 'int') return Math.trunc(derefNumber(a, state));
    if (b === 'float') return Number(a);
    if (b === 'str') return displayValue(a, state);
    if (b === 'bool') return truthy(a, state);
    if (b === 'list' || b === 'tuple' || b === 'set') {
      const o = allocObject(b, Array.isArray(a) ? [...(a as unknown as RtValue[])] : [a], '');
      state.heap[o.id] = o;
      o.repr = formatObject(o, state);
      return o.id;
    }
    if (b === 'len') return lengthOf(a, state);
    if (b === 'abs') return Math.abs(derefNumber(a, state));
    throw new Error(`TypeError: builtin '${b}' is not supported here (line ${line})`);
  }
  throw new Error(`TypeError: object of type '${fn.type}' is not callable (line ${line})`);
}

/**
 * `reduce(fn, iterable)` → eager fold. The first element seeds the accumulator;
 * each following element is passed as (acc, elem) to fn.
 */
function reduce(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: reduce() takes exactly two arguments (line ${line})`);
  const fn = resolveCallableName(args[0], state, line);
  const it = ensureIterator(args[1], state, line);
  let acc: RtValue | undefined;
  for (;;) {
    let elem: RtValue;
    try {
      elem = nextIterator(it, state, line);
    } catch (e) {
      if (acc === undefined) throw new Error(`TypeError: reduce() of empty iterable with no initial value (line ${line})`);
      return acc;
    }
    acc = acc === undefined ? elem : applyBuiltinCall(fn, [acc, elem], state, line);
  }
}

/**
 * Python-style string repr using single quotes.
 */
function formatStr(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

/**
 * Canonical dict key label.
 */
function dictKeyRepr(k: RtValue, state: MemoryState): string {
  return displayValue(k, state);
}

/**
 * Rebuild a runtime string value from a dict key label.
 */
function keyToValue(keyRepr: string, state: MemoryState): string {
  let s = keyRepr;
  if (s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return allocString(s, state);
}

/**
 * Value equality via display form.
 */
function valuesEqual(a: RtValue, b: RtValue, state: MemoryState): boolean {
  return displayValue(a, state) === displayValue(b, state);
}

/**
 * Index of first value equal to `target`.
 */
function findIndexOfValue(arr: RtValue[], target: RtValue, state: MemoryState): number {
  for (let i = 0; i < arr.length; i++) {
    if (valuesEqual(arr[i], target, state)) return i;
  }
  return -1;
}

function truthy(v: RtValue, state: MemoryState): boolean {
  if (v === null || v === false || v === 0 || v === '') return false;
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set') return (obj.value as RtValue[]).length > 0;
    if (obj.type === 'dict' || obj.type === 'defaultdict') return dictEntries(obj).length > 0;
    if (obj.type === 'str') return (obj.value as string).length > 0;
  }
  return Boolean(v);
}

function derefNumber(v: RtValue, state: MemoryState): number {
  void state;
  return Number(v);
}

function lengthOf(v: RtValue, state: MemoryState): number {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set', 'dict'].includes(obj.type)) return (obj.value as unknown[]).length;
    if (obj.type === 'defaultdict') return dictEntries(obj).length;
    if (obj.type === 'str') return (obj.value as string).length;
  }
  if (typeof v === 'string') return v.length;
  throw new Error(`TypeError: object has no len()`);
}

/**
 * Build numeric (x, y) point pairs from two containers for scatter()/line().
 * Each arg must be a heap list/tuple/set of numbers (or a raw number list).
 */
function zipPoints(xs: RtValue, ys: RtValue, state: MemoryState): Array<[number, number]> {
  const xArr = readNumberSeries(xs, state);
  const yArr = readNumberSeries(ys, state);
  const n = Math.min(xArr.length, yArr.length);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) pts.push([xArr[i]!, yArr[i]!]);
  return pts;
}

function readNumberSeries(v: RtValue, state: MemoryState): number[] {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set'].includes(obj.type)) {
      return (obj.value as RtValue[]).map((e) => {
        const n = Number(e);
        if (Number.isNaN(n)) throw new Error('TypeError: expected numeric points');
        return n;
      });
    }
    throw new Error(`TypeError: ${obj.type} is not an iterable of numbers`);
  }
  throw new Error('TypeError: expected a list of numbers');
}

function typeName(v: RtValue, state: MemoryState): string {
  if (typeof v === 'string' && state.heap[v]) return state.heap[v].type;
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  return typeof v;
}

function binOp(op: string, left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  // string concatenation
  const lt = typeName(left, state);
  const rt = typeName(right, state);
  if (op === '+' && lt === 'str' && rt === 'str') {
    const lv = state.heap[left as string].value as string;
    const rv = state.heap[right as string].value as string;
    return allocString(lv + rv, state);
  }
  if (op === '+' && lt === 'list' && rt === 'list') {
    const merged = [...(state.heap[left as string].value as RtValue[]), ...(state.heap[right as string].value as RtValue[])];
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }
  if (op === '*' && lt === 'list' && rt === 'int') {
    const n = Number(right);
    const src = state.heap[left as string].value as RtValue[];
    const merged: RtValue[] = [];
    for (let i = 0; i < n; i++) merged.push(...src);
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }
  if (op === '*' && lt === 'str' && rt === 'int') {
    return allocString((state.heap[left as string].value as string).repeat(Number(right)), state);
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

function compareOp(op: string, left: RtValue, right: RtValue, state: MemoryState): boolean {
  if (op === 'is') return left === right;
  if (op === 'is not') return left !== right;
  if (op === '==') return valuesEqual(left, right, state);
  if (op === '!=') return !valuesEqual(left, right, state);
  if (op === 'in') {
    const container = state.heap[right as string];
    if (!container) return false;
    if (['list', 'tuple', 'set'].includes(container.type)) {
      return (container.value as RtValue[]).some((v) => valuesEqual(v, left, state));
    }
    if (container.type === 'dict') {
      return (container.value as Array<[string, RtValue]>).some(([k]) => k === dictKeyRepr(left, state));
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

function subscriptGet(objId: RtValue, index: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new Error(`TypeError: object is not subscriptable (line ${line})`);
  if (obj.type === 'list' || obj.type === 'tuple') {
    const value = obj.value as RtValue[];
    const i = Number(index);
    const idx = i < 0 ? value.length + i : i;
    if (idx < 0 || idx >= value.length) {
      throw new Error(`IndexError: index out of range (line ${line})`);
    }
    return value[idx];
  }
  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    const keyRepr = dictKeyRepr(index, state);
    const entries = dictEntries(obj);
    const found = entries.find(([k]) => k === keyRepr);
    if (found) return found[1];
    if (obj.type === 'dict') throw new Error(`KeyError: ${keyRepr} (line ${line})`);
    // defaultdict auto-creates the factory value and stores it on read.
    const factory = (obj.value as DefaultDictValue).factory;
    const created = applyFactory(factory, state, line);
    entries.push([keyRepr, created]);
    obj.repr = formatObject(obj, state);
    return created;
  }
  if (obj.type === 'str') {
    const i = Number(index);
    const s = obj.value as string;
    const idx = i < 0 ? s.length + i : i;
    if (idx < 0 || idx >= s.length) throw new Error(`IndexError: string index out of range (line ${line})`);
    return allocString(s[idx], state);
  }
  throw new Error(`TypeError: '${obj.type}' object is not subscriptable (line ${line})`);
}

function sliceGet(objId: RtValue, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new Error(`TypeError: object is not sliceable (line ${line})`);
  const s = start === null ? 0 : Number(start);
  const e = stop === null
    ? (obj.type === 'str' ? (obj.value as string).length : (obj.value as RtValue[]).length)
    : Number(stop);
  if (obj.type === 'list' || obj.type === 'tuple') {
    const elts = (obj.value as RtValue[]).slice(s, e);
    const out = allocObject(obj.type, elts, '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }
  if (obj.type === 'str') {
    return allocString((obj.value as string).slice(s, e), state);
  }
  throw new Error(`TypeError: '${obj.type}' object is not sliceable (line ${line})`);
}

function formatListLike(elts: RtValue[], state: MemoryState, open: string, close: string): string {
  return open + elts.map((e) => displayValue(e, state)).join(', ') + close;
}

function formatObject(obj: HeapObject, state: MemoryState): string {
  if (obj.type === 'list') return formatListLike(obj.value as RtValue[], state, '[', ']');
  if (obj.type === 'tuple') {
    const value = obj.value as RtValue[];
    const body = formatListLike(value, state, '(', ')');
    return value.length === 1 ? `(${displayValue(value[0], state)},)` : body;
  }
  if (obj.type === 'set') {
    return '{' + (obj.value as RtValue[]).map((e) => displayValue(e, state)).join(', ') + '}';
  }
  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    return '{' + dictEntries(obj).map(([k, v]) => `${k}: ${displayValue(v, state)}`).join(', ') + '}';
  }
  if (obj.type === 'str') return formatStr(obj.value as string);
  return String(obj.repr ?? obj.value);
}

/**
 * Live repr for a heap object. Containers are recomputed from their current
 * `value` so that a parent reflects a nested child's in-place mutation
 * (e.g. `a[1].append(3)` shows up in `print(a)`); scalars/strings/functions
 * use their stored repr.
 */
export function liveRepr(obj: HeapObject, state: MemoryState): string {
  if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'tuple' || obj.type === 'set' || obj.type === 'defaultdict') {
    return formatObject(obj, state);
  }
  return obj.repr;
}

/**
 * Human-facing display of a runtime value (repr-style).
 */
export function displayValue(v: RtValue, state: MemoryState): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && state.heap[v]) {
    return liveRepr(state.heap[v], state);
  }
  if (typeof v === 'string') return formatStr(v);
  return String(v);
}

/**
 * print()/str() style — strings unquoted, like CPython's print.
 */
function printArg(v: RtValue, state: MemoryState): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    return obj.type === 'str' ? (obj.value as string) : liveRepr(obj, state);
  }
  if (typeof v === 'string') return v;
  return String(v);
}

export { cloneState, createModuleState };
