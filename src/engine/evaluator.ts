/**
 * Evaluator for learn-python's Python subset.
 *
 * Mutates a memory state (frames + heap) and records stdout / errors.
 */

import { allocObject, cloneState, computeRefCounts, createModuleState } from './memory';
import { parse } from './parser';
import {
  PyAttributeError,
  PyException,
  PyIndexError,
  PyKeyError,
  PyModuleNotFoundError,
  PyNameError,
  PyRecursionError,
  PySyntaxError,
  PyTypeError,
  PyUnboundLocalError,
  PyValueError,
  PyZeroDivisionError,
  isExceptionInstanceOf,
} from './errors';
import {
  allocFloat,
  formatFloat,
  getObjectId,
  getTypeObject,
  typeName,
} from './builtins/types';
import { MATH_CONSTANTS, MATH_FUNCTIONS } from './builtins/math';
import {
  RangeValue,
  makeLazyRange,
  rangeContains,
  rangeGetItem,
  rangeLength,
  rangeRepr,
} from './builtins/range';
import { callListMethod } from './methods/list';
import { callDictMethod, dictKeyRepr } from './methods/dict';
import { callSetMethod } from './methods/set';
import { callStrMethod } from './methods/str';
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
    if (traceEnabled) state.trace = [cloneState(state)]; // frame 0: state before running
    const ast = parse(source);
    for (const stmt of ast) {
      if (stmt.line) state.currentLine = stmt.line;
      if (stmt.kind === 'ExprStatement') {
        // REPL-style: a bare top-level expression shows its value. `print()`
        // and mutating calls like `a.append(..)` return None, so they stay
        // silent (they already spoke for themselves, or have no value).
        const result = evalExpr(stmt.expr, state);
        if (result !== null) state.stdout.push(displayValue(result, state));
      } else {
        execStatement(stmt, state);
      }
      recordStep(state, stmt.line); // after each top-level statement
    }
    // A nested child may have been mutated in place (e.g. a[1].append(3)),
    // leaving a parent container's cached repr stale. Recompute container
    // reprs so display, print, and goal checks all see the current value.
    refreshReprs(state);
    // Recompute the refcount column for the RAM view from the now-final graph.
    computeRefCounts(state);
  } catch (err) {
    let finalErr = err;
    if (err instanceof RangeError || (err instanceof Error && err.name === 'RangeError')) {
      finalErr = new PyRecursionError('maximum recursion depth exceeded');
    }
    const message = finalErr instanceof Error ? `${finalErr.name}: ${finalErr.message}` : String(finalErr);
    state.errors.push(message);
    throw finalErr;
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
    if (obj.type === 'ndarray') {
      obj.repr = numpyRepr(ndarrayWindow(obj.id, state), (obj.value as NdarrayValue).dtype);
    }
  }
}

/**
 * Recompute the cached repr of every ndarray window AND its buffer after a
 * buffer write, so a mutation through one window is visible through every
 * other window (the whole point of a view).
 */
function refreshNdarrayReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'ndarray') obj.repr = numpyRepr(ndarrayWindow(obj.id, state), (obj.value as NdarrayValue).dtype);
    if (obj.type === 'buffer') obj.repr = `[${(obj.value as NumpyBufferValue).data.join(', ')}]`;
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
 * —— Step-recording ("watch it run") ——
 *
 * When enabled, the engine records a deep clone of the memory state after every
 * top-level statement and after every loop iteration. The replay UI scrubs
 * these frames to animate a loop running on the canvas. It is OFF by default so
 * the normal level/sandbox path (and the solvability tests) never pay for the
 * cloning, and the abstract model (snapshot/goals) is untouched either way.
 */
const TRACE_CAP = 60;
let traceEnabled = false;

/** Turn step-recording on or off for subsequent `run` calls. */
export function setTraceEnabled(on: boolean): void {
  traceEnabled = on;
}

/** Whether step-recording is currently on. */
export function isTraceEnabled(): boolean {
  return traceEnabled;
}

/** Push the current state onto `state.trace` (cloned, trace stripped), if enabled. */
function recordStep(state: MemoryState, line?: number): void {
  if (!traceEnabled) return;
  const arr = state.trace;
  if (!arr || arr.length >= TRACE_CAP) return;
  if (line !== undefined) state.currentLine = line;
  const frame = cloneState(state);
  delete frame.trace; // don't nest the growing array inside every frame
  arr.push(frame);
}

/** Run a block of statements, so loop/if bodies recurse through execStatement. */
function execBody(body: AstNode[], state: MemoryState): void {
  for (const stmt of body) execStatement(stmt, state);
}

/**
 * `break` / `continue` are signalled by thrown markers caught by the innermost
 * For/While executor (the engine is single-threaded, so exception control flow
 * is safe and mirrors how `return` is already done).
 */
class PyBreak extends Error {
  constructor() {
    super('break');
  }
}
class PyContinue extends Error {
  constructor() {
    super('continue');
  }
}

/**
 * Flatten an iterable expression value into the list of element values a `for`
 * loop will bind its target to, one element at a time. Handles list/tuple/set
 * heap objects, heap strings, and raw string literals (strings are raw values
 * in this engine, not heap objects).
 */
interface ScopeInfo {
  locals: Set<string>;
  globals: Set<string>;
  nonlocals: Set<string>;
}

const KNOWN_MODULES = new Set([
  'math',
  'copy',
  'numpy',
  'np',
  'pandas',
  'pd',
  'asyncio',
  'threading',
  'time',
  'json',
  'sys',
  'typing',
  'dataclasses',
  'collections',
  'random',
  'functools',
]);

function analyzeLocals(body: AstNode[]): ScopeInfo {
  const assigned = new Set<string>();
  const globals = new Set<string>();
  const nonlocals = new Set<string>();

  function extractTargetNames(target: AstNode): void {
    if (target.kind === 'Name') {
      assigned.add(target.id);
    } else if (target.kind === 'Tuple') {
      for (const e of target.elts) extractTargetNames(e);
    } else if (target.kind === 'List') {
      for (const e of target.elts) extractTargetNames(e);
    }
  }

  function walk(stmt: AstNode): void {
    if (!stmt) return;
    switch (stmt.kind) {
      case 'Global':
        for (const n of stmt.names) globals.add(n);
        break;
      case 'Nonlocal':
        for (const n of stmt.names) nonlocals.add(n);
        break;
      case 'Assign':
        extractTargetNames(stmt.target);
        break;
      case 'AugAssign':
        if (stmt.target.kind === 'Name') assigned.add(stmt.target.id);
        break;
      case 'For':
        assigned.add(stmt.target);
        for (const s of stmt.body) walk(s);
        if (stmt.elseBody) for (const s of stmt.elseBody) walk(s);
        break;
      case 'While':
        for (const s of stmt.body) walk(s);
        if (stmt.elseBody) for (const s of stmt.elseBody) walk(s);
        break;
      case 'If':
        for (const s of stmt.body) walk(s);
        for (const b of stmt.elifs) for (const s of b.body) walk(s);
        if (stmt.elseBody) for (const s of stmt.elseBody) walk(s);
        break;
      case 'Try':
        for (const s of stmt.body) walk(s);
        for (const h of stmt.handlers) {
          if (h.name) assigned.add(h.name);
          for (const s of h.body) walk(s);
        }
        if (stmt.elseBody) for (const s of stmt.elseBody) walk(s);
        if (stmt.finallyBody) for (const s of stmt.finallyBody) walk(s);
        break;
      case 'FunctionDef':
      case 'CoroutineDef':
        assigned.add(stmt.name);
        break;
    }
  }

  for (const s of body) walk(s);
  const locals = new Set<string>();
  for (const a of assigned) {
    if (!globals.has(a) && !nonlocals.has(a)) {
      locals.add(a);
    }
  }
  return { locals, globals, nonlocals };
}

/**
 * Flatten an iterable expression value into the list of element values a `for`
 * loop will bind its target to, one element at a time. Handles list/tuple/set/range
 * heap objects, heap strings, and raw string literals.
 */
function iterableToRtValues(v: RtValue, state: MemoryState, line: number): RtValue[] {
  if (typeof v !== 'string') {
    throw new PyTypeError(`'${typeName(v, state)}' object is not iterable (line ${line})`);
  }
  const obj = state.heap[v];
  if (!obj) {
    // A raw string literal value (e.g. `for x in 'abc'`).
    const s = v as string;
    const out: RtValue[] = [];
    for (let i = 0; i < s.length; i++) out.push(allocString(s[i]!, state));
    return out;
  }
  if (obj.type === 'str') {
    const s = obj.value as string;
    const out: RtValue[] = [];
    for (let i = 0; i < s.length; i++) out.push(allocString(s[i]!, state));
    return out;
  }
  if (obj.type === 'range') {
    const r = obj.value as RangeValue;
    const len = rangeLength(r);
    const out: RtValue[] = [];
    for (let i = 0; i < len; i++) out.push(rangeGetItem(r, i));
    return out;
  }
  if (['list', 'tuple', 'set'].includes(obj.type)) {
    return [...(obj.value as RtValue[])];
  }
  throw new PyTypeError(`'${obj.type}' object is not iterable (line ${line})`);
}

/**
 * `range(stop)` / `range(start, stop)` / `range(start, stop, step)` → lazy range heap object.
 */
function makeRange(args: RtValue[], state: MemoryState, line: number): RtValue {
  return makeLazyRange(args, state, line);
}

/**
 * Execute one statement.
 */
function execStatement(node: AstNode, state: MemoryState): void {
  if (node.line) state.currentLine = node.line;
  switch (node.kind) {
    case 'Assign': {
      const value = evalExpr(node.value, state);
      bindTarget(node.target, value, state);
      return;
    }
    case 'AugAssign': {
      const target = node.target;
      const rhs = evalExpr(node.value, state);
      const op = node.op.endsWith('=') ? node.op.slice(0, -1) : node.op;
      if (target.kind === 'Name') {
        const current = lookupName(target.id, state, node.line);
        if (typeof current === 'string' && state.heap[current]) {
          const obj = state.heap[current];
          if (op === '+' && obj.type === 'list') {
            const items = iterableToRtValues(rhs, state, node.line);
            (obj.value as RtValue[]).push(...items);
            obj.repr = formatObject(obj, state);
            return;
          }
          if (op === '*' && obj.type === 'list') {
            const factor = Number(rhs);
            const src = [...(obj.value as RtValue[])];
            (obj.value as RtValue[]).length = 0;
            for (let i = 0; i < factor; i++) (obj.value as RtValue[]).push(...src);
            obj.repr = formatObject(obj, state);
            return;
          }
          if (op === '+' && obj.type === 'ndarray') {
            vecAddInPlace(current, rhs, state, node.line);
            return;
          }
        }
        const combined = binOp(op, current, rhs, state, node.line);
        bindTarget(target, combined, state);
        return;
      }
      const current = readTarget(target, state);
      const combined = binOp(op, current, rhs, state, node.line);
      bindTarget(target, combined, state);
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
      const paramDefaults: Record<string, RtValue> = {};
      if (node.paramDefaults) {
        for (const [p, expr] of Object.entries(node.paramDefaults)) {
          paramDefaults[p] = evalExpr(expr, state);
        }
      }
      const closure: Record<string, { value: RtValue }> = {};
      for (let i = state.frames.length - 1; i >= 1; i--) {
        const f = state.frames[i]!;
        for (const [k, v] of Object.entries(f.locals)) {
          if (!(k in closure)) {
            closure[k] = { value: v };
          }
        }
      }
      const fn = allocObject(
        'function',
        {
          name: node.name,
          params: [...node.params],
          paramDefaults,
          closure: Object.keys(closure).length > 0 ? closure : undefined,
          body: node.body,
        } as FunctionCode,
        `function ${node.name}`
      );
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'CoroutineDef': {
      const paramDefaults: Record<string, RtValue> = {};
      if (node.paramDefaults) {
        for (const [p, expr] of Object.entries(node.paramDefaults)) {
          paramDefaults[p] = evalExpr(expr, state);
        }
      }
      const fn = allocObject(
        'function',
        {
          name: node.name,
          params: [...node.params],
          paramDefaults,
          body: node.body,
          async: true,
        } as FunctionCode,
        `async function ${node.name}`
      );
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'Import': {
      if (!KNOWN_MODULES.has(node.name)) {
        throw new PyModuleNotFoundError(node.name);
      }
      const mod = allocObject('module', { name: node.name }, `<module '${node.name}'>`);
      state.heap[mod.id] = mod;
      const localName = node.alias ?? node.name.split('.')[0];
      setFrameLocal(currentFrame(state), localName, mod.id);
      return;
    }
    case 'ImportFrom': {
      if (!KNOWN_MODULES.has(node.module)) {
        throw new PyModuleNotFoundError(node.module);
      }
      if (node.module === 'math') {
        for (const item of node.names) {
          const boundName = item.alias ?? item.name;
          if (item.name in MATH_CONSTANTS) {
            setFrameLocal(currentFrame(state), boundName, allocFloat(MATH_CONSTANTS[item.name]!, state));
          } else if (item.name in MATH_FUNCTIONS) {
            const fnObj = allocObject('builtin', `math.${item.name}`, `math.${item.name}`, 'heap');
            state.heap[fnObj.id] = fnObj;
            setFrameLocal(currentFrame(state), boundName, fnObj.id);
          } else {
            throw new PyAttributeError(`cannot import name '${item.name}' from 'math'`);
          }
        }
        return;
      }
      return;
    }
    case 'If': {
      let taken = false;
      if (truthy(evalExpr(node.test, state), state)) {
        execBody(node.body, state);
        taken = true;
      } else {
        for (const branch of node.elifs) {
          if (truthy(evalExpr(branch.test, state), state)) {
            execBody(branch.body, state);
            taken = true;
            break;
          }
        }
      }
      if (!taken && node.elseBody) execBody(node.elseBody, state);
      return;
    }
    case 'For': {
      const iterVal = evalExpr(node.iterable, state);
      const isLiveList = typeof iterVal === 'string' && state.heap[iterVal]?.type === 'list';
      const targetList = isLiveList ? (state.heap[iterVal].value as RtValue[]) : null;
      let broke = false;

      if (targetList) {
        let i = 0;
        let loopGuard = 0;
        while (i < targetList.length) {
          if (++loopGuard > 100000) throw new PyRecursionError('for loop did not terminate (infinite loop)');
          setFrameLocal(currentFrame(state), node.target, targetList[i]!);
          try {
            execBody(node.body, state);
          } catch (e) {
            if (e instanceof PyBreak) { broke = true; break; }
            if (e instanceof PyContinue) { recordStep(state); i++; continue; }
            throw e;
          }
          recordStep(state);
          i++;
        }
      } else {
        const items = iterableToRtValues(iterVal, state, node.line);
        for (let i = 0; i < items.length; i++) {
          setFrameLocal(currentFrame(state), node.target, items[i]!);
          try {
            execBody(node.body, state);
          } catch (e) {
            if (e instanceof PyBreak) { broke = true; break; }
            if (e instanceof PyContinue) { recordStep(state); continue; }
            throw e;
          }
          recordStep(state);
        }
      }
      if (!broke && node.elseBody) {
        execBody(node.elseBody, state);
      }
      return;
    }
    case 'While': {
      let guard = 0;
      let broke = false;
      while (truthy(evalExpr(node.test, state), state)) {
        if (++guard > 100000) throw new PyRecursionError('while loop did not terminate (infinite loop)');
        try {
          execBody(node.body, state);
        } catch (e) {
          if (e instanceof PyBreak) { broke = true; break; }
          if (e instanceof PyContinue) { recordStep(state); continue; }
          throw e;
        }
        recordStep(state);
      }
      if (!broke && node.elseBody) {
        execBody(node.elseBody, state);
      }
      return;
    }
    case 'Try': {
      let excThrown: unknown = null;
      let handled = false;
      try {
        execBody(node.body, state);
      } catch (e) {
        excThrown = e;
        for (const handler of node.handlers) {
          if (!handler.type) {
            handled = true;
          } else {
            const excType = evalExpr(handler.type, state);
            const excTypeName =
              typeof excType === 'string' && state.heap[excType]?.type === 'type'
                ? (state.heap[excType].value as { name: string }).name
                : typeof excType === 'string' && state.heap[excType]?.type === 'builtin'
                ? (state.heap[excType].value as string)
                : String(excType);
            if (isExceptionInstanceOf(e, excTypeName)) {
              handled = true;
            }
          }
          if (handled) {
            if (handler.name) {
              setFrameLocal(currentFrame(state), handler.name, String(e));
            }
            execBody(handler.body, state);
            break;
          }
        }
        if (!handled) throw e;
      }
      if (!excThrown && node.elseBody) {
        execBody(node.elseBody, state);
      }
      if (node.finallyBody) {
        execBody(node.finallyBody, state);
      }
      return;
    }
    case 'Raise': {
      if (!node.exc) {
        throw new PyException('RuntimeError', 'No active exception to reraise');
      }
      const excVal = evalExpr(node.exc, state);
      throw new PyException(typeName(excVal, state), displayValue(excVal, state));
    }
    case 'Break':
      throw new PyBreak();
    case 'Continue':
      throw new PyContinue();
    case 'Pass':
    case 'Global':
    case 'Nonlocal':
      return;
    default:
      throw new PyException('RuntimeError', `unsupported statement ${node.kind}`);
  }
}

class PyReturn extends Error {
  value: RtValue;
  constructor(value: RtValue) {
    super('return');
    this.value = value;
  }
}

/**
 * Raised by `await a.sleep(...)` inside a coroutine to hand the tick back to the
 * event loop (a cooperative-yield suspension point). The coroutine executor
 * catches it, saves the suspended state, and resumes on the next tick.
 */
class PySuspend extends Error {
  constructor() {
    super('suspend');
  }
}

/**
 * The id of the coroutine currently being stepped by the event loop, or null.
 * Lets `evalExpr` on an `Await` know whether a suspension is in force (inside a
 * coroutine) or a plain no-op (a bare `await` outside a running task). The
 * engine is single-threaded, so a module pointer is safe.
 */
let activeCoroutineId: string | null = null;

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
  const current = currentFrame(state) as Frame & { scopeInfo?: ScopeInfo };
  if (current.scopeInfo) {
    const { locals, globals, nonlocals } = current.scopeInfo;
    if (locals.has(name)) {
      if (name in current.locals) return current.locals[name]!;
      throw new PyUnboundLocalError(`cannot access local variable '${name}' where it is not associated with a value (line ${line})`);
    }
    if (globals.has(name)) {
      if (name in state.frames[0].locals) return state.frames[0].locals[name]!;
      throw new PyNameError(`name '${name}' is not defined (line ${line})`);
    }
    if (nonlocals.has(name)) {
      for (let i = state.frames.length - 2; i >= 1; i--) {
        if (name in state.frames[i].locals) return state.frames[i].locals[name]!;
      }
      throw new PyNameError(`name '${name}' is not defined (line ${line})`);
    }
    if (name in current.locals) return current.locals[name]!;
  } else {
    if (name in current.locals) return current.locals[name]!;
  }

  for (let i = state.frames.length - 2; i >= 0; i--) {
    if (name in state.frames[i].locals) {
      return state.frames[i].locals[name]!;
    }
  }

  const curFrame = current as Frame & { closure?: Record<string, { value: RtValue }> };
  if (curFrame.closure && name in curFrame.closure) {
    return curFrame.closure[name]!.value;
  }

  if (['int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set', 'range', 'type'].includes(name)) {
    return getTypeObject(name, state);
  }
  if (BUILTIN_CONSTRUCTORS.has(name)) {
    const b = allocObject('builtin', name, name);
    state.heap[b.id] = b;
    return b.id;
  }
  throw new PyNameError(`name '${name}' is not defined (line ${line})`);
}

/**
 * Assign to a target expression.
 */
function bindTarget(target: AstNode, value: RtValue, state: MemoryState): void {
  if (target.kind === 'Name') {
    const current = currentFrame(state) as Frame & { scopeInfo?: ScopeInfo };
    if (current.scopeInfo) {
      if (current.scopeInfo.globals.has(target.id)) {
        state.frames[0].locals[target.id] = value;
        return;
      }
      if (current.scopeInfo.nonlocals.has(target.id)) {
        for (let i = state.frames.length - 2; i >= 1; i--) {
          if (target.id in state.frames[i].locals) {
            state.frames[i].locals[target.id] = value;
            return;
          }
        }
        state.frames[0].locals[target.id] = value;
        return;
      }
    }
    setFrameLocal(current, target.id, value);
    return;
  }
  if (target.kind === 'Subscript') {
    const objId = evalExpr(target.object, state);
    const index = target.index ? evalExpr(target.index, state) : null;
    const obj = state.heap[objId as string];
    if (!obj) throw new PyTypeError(`cannot subscript immutable value (line ${target.line})`);
    const line = target.line;

    if (target.attr === 'iloc') {
      frameIlocSet(objId as string, index as RtValue, value, state, line);
      return;
    }
    if (obj.type === 'dataframe') {
      frameSetColumn(objId as string, index as RtValue, value, state, line);
      return;
    }
    if (obj.type === 'list') {
      const elts = obj.value as RtValue[];
      let idx = Number(index);
      if (idx < 0) idx += elts.length;
      if (idx < 0 || idx >= elts.length) {
        throw new PyIndexError(`list assignment index out of range (line ${line})`);
      }
      elts[idx] = value;
      obj.repr = formatObject(obj, state);
      return;
    }
    if (obj.type === 'ndarray') {
      const v = obj.value as NdarrayValue;
      const n = Number(value);
      if (Number.isNaN(n)) throw new PyTypeError(`cannot assign non-number to ndarray (line ${line})`);
      const i = Number(index);
      const data = (state.heap[v.buffer].value as NumpyBufferValue).data;
      data[v.offset + i] = n;
      refreshNdarrayReprs(state);
      return;
    }
    if (obj.type === 'dict' || obj.type === 'defaultdict') {
      const keyRepr = dictKeyRepr(index, state, line);
      const entries = dictEntries(obj);
      const existing = entries.find(([k]) => k === keyRepr);
      if (existing) existing[1] = value;
      else entries.push([keyRepr, value]);
      obj.repr = formatObject(obj, state);
      return;
    }
    throw new PyTypeError(`'${obj.type}' object does not support item assignment (line ${line})`);
  }
  throw new PySyntaxError(`cannot assign to ${target.kind}`);
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
    case 'Literal': {
      if (node.isFloat) {
        return allocFloat(Number(node.value), state);
      }
      if (typeof node.value === 'string') return allocString(node.value, state);
      return node.value;
    }
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
      const entries: Array<[string, RtValue]> = [];
      for (let i = 0; i < node.keys.length; i++) {
        const k = evalExpr(node.keys[i]!, state);
        const v = evalExpr(node.values[i]!, state);
        const kRepr = dictKeyRepr(k, state, node.line);
        const existing = entries.find(([existingKey]) => existingKey === kRepr);
        if (existing) {
          existing[1] = v;
        } else {
          entries.push([kRepr, v]);
        }
      }
      const obj = allocObject('dict', entries, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Set': {
      const elts: RtValue[] = [];
      for (const e of node.elts) {
        const val = evalExpr(e, state);
        const kRepr = dictKeyRepr(val, state, node.line);
        if (!elts.some((existing) => dictKeyRepr(existing, state) === kRepr)) {
          elts.push(val);
        }
      }
      const obj = allocObject('set', elts, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Lambda': {
      const code: FunctionCode = {
        name: '<lambda>',
        params: node.params,
        body: [{ kind: 'Return', value: node.body, line: node.line }],
      };
      const fnObj = allocObject('function', code, '<function <lambda>>');
      state.heap[fnObj.id] = fnObj;
      return fnObj.id;
    }
    case 'BinOp': {
      const left = evalExpr(node.left, state);
      const right = evalExpr(node.right, state);
      return binOp(node.op, left, right, state, node.line);
    }
    case 'UnaryOp': {
      const val = evalExpr(node.operand, state);
      if (node.op === 'not') return !truthy(val, state);
      if (node.op === '-') {
        const t = typeName(val, state);
        if (t !== 'int' && t !== 'float' && t !== 'bool') {
          throw new PyTypeError(`bad operand type for unary -: '${t}' (line ${node.line})`);
        }
        if (t === 'float') {
          return allocFloat(-derefNumber(val, state), state);
        }
        if (typeof val === 'bigint') return -val;
        return -derefNumber(val, state);
      }
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
      return compareOp(node.op, left, right, state, node.line);
    }
    case 'Subscript': {
      const objId = evalExpr(node.object, state);
      const index = evalExpr(node.index!, state);
      if (node.attr === 'loc') return frameLocRow(objId as string, index, state, node.line);
      if (node.attr === 'iloc') return frameIlocRow(objId as string, index, state, node.line);
      return subscriptGet(objId, index, state, node.line);
    }
    case 'Slice': {
      const objId = evalExpr(node.object, state);
      const start = node.start ? evalExpr(node.start, state) : null;
      const stop = node.stop ? evalExpr(node.stop, state) : null;
      if (node.attr === 'iloc') return frameIlocSlice(objId as string, start, stop, state, node.line);
      return sliceGet(objId, start, stop, state, node.line);
    }
    case 'Attribute': {
      const objVal = evalExpr(node.object, state);
      if (objVal === null) {
        throw new PyAttributeError(`'NoneType' object has no attribute '${node.attr}' (line ${node.line})`);
      }
      if (typeof objVal === 'string' && state.heap[objVal]) {
        const obj = state.heap[objVal];
        if (obj.type === 'type') {
          if (node.attr === '__name__') {
            return (obj.value as { name: string }).name;
          }
        }
        if (obj.type === 'module') {
          const modVal = obj.value as { name: string; fields?: Record<string, unknown> };
          if (modVal.name === 'math') {
            if (node.attr in MATH_CONSTANTS) return allocFloat(MATH_CONSTANTS[node.attr]!, state);
            if (node.attr in MATH_FUNCTIONS) {
              const fnObj = allocObject('builtin', `math.${node.attr}`, `math.${node.attr}`, 'heap');
              state.heap[fnObj.id] = fnObj;
              return fnObj.id;
            }
          }
          if (modVal.fields && node.attr in modVal.fields) {
            return modVal.fields[node.attr] as RtValue;
          }
        }
      }
      const t = typeName(objVal, state);
      throw new PyAttributeError(`'${t}' object has no attribute '${node.attr}' (line ${node.line})`);
    }
    case 'Call': {
      return evalCall(node, state);
    }
    case 'Await': {
      // `await a.sleep(...)` inside a running coroutine is a suspension point:
      // it hands the tick back to the event loop (a cooperative yield). Outside a
      // running coroutine it is a no-op that just evaluates its operand.
      if (activeCoroutineId) {
        throw new PySuspend();
      }
      return evalExpr(node.value, state);
    }
    default:
      throw new PyException('RuntimeError', `unsupported expression ${node.kind}`);
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
      return getTypeObject(typeName(args[0], state), state);
    }
    if (name === 'id') {
      return getObjectId(args[0], state);
    }
    if (name === 'int') {
      if (args.length === 0) return 0;
      const v = args[0];
      if (typeof v === 'string') {
        const s = state.heap[v] && state.heap[v].type === 'str' ? (state.heap[v].value as string) : v;
        if (!/^\s*[-+]?[0-9]+\s*$/.test(s)) {
          throw new PyValueError(`invalid literal for int() with base 10: '${s}' (line ${node.line})`);
        }
        return parseInt(s.trim(), 10);
      }
      if (typeof v === 'number') return Math.trunc(v);
      if (typeof v === 'bigint') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return Math.trunc(derefNumber(v, state));
    }
    if (name === 'float') {
      if (args.length === 0) return allocFloat(0.0, state);
      const v = args[0];
      if (typeof v === 'string') {
        const s = state.heap[v] && state.heap[v].type === 'str' ? (state.heap[v].value as string) : v;
        const n = Number(s);
        if (isNaN(n)) throw new PyValueError(`could not convert string to float: '${s}' (line ${node.line})`);
        return allocFloat(n, state);
      }
      return allocFloat(Number(derefNumber(v, state)), state);
    }
    if (name === 'str') {
      if (args.length === 0) return allocString('', state);
      return allocString(printArg(args[0], state), state);
    }
    if (name === 'bool') {
      return truthy(args[0], state);
    }
    if (name === 'range') {
      return makeRange(args, state, node.line);
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
    if (name === 'list') {
      const elts: RtValue[] = [];
      if (args.length > 0) {
        const arg = args[0];
        if (typeof arg === 'string' && state.heap[arg]) {
          const src = state.heap[arg];
          if (src.type === 'str') {
            for (const ch of src.value as string) elts.push(allocString(ch, state));
          } else if (src.type === 'range') {
            const r = src.value as RangeValue;
            const len = rangeLength(r);
            for (let i = 0; i < len; i++) elts.push(rangeGetItem(r, i));
          } else if (Array.isArray(src.value)) {
            elts.push(...(src.value as RtValue[]));
          }
        } else if (typeof arg === 'string') {
          for (const ch of arg) elts.push(allocString(ch, state));
        }
      }
      const obj = allocObject('list', elts, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'dict') {
      const pairs: Array<[string, RtValue]> = [];
      if (args.length > 0) {
        const arg = args[0];
        if (typeof arg === 'string' && state.heap[arg]) {
          const src = state.heap[arg];
          if (src.type === 'list' || src.type === 'tuple') {
            for (const item of src.value as RtValue[]) {
              const itemObj = typeof item === 'string' ? state.heap[item] : null;
              if (itemObj && (itemObj.type === 'list' || itemObj.type === 'tuple')) {
                const pair = itemObj.value as RtValue[];
                if (pair.length >= 2) {
                  pairs.push([dictKeyRepr(pair[0], state, node.line), pair[1]!]);
                }
              }
            }
          } else if (src.type === 'dict') {
            pairs.push(...(src.value as Array<[string, RtValue]>));
          }
        }
      }
      const obj = allocObject('dict', pairs, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (name === 'set') {
      const elts: RtValue[] = [];
      const src = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
      if (src && ['list', 'tuple', 'set'].includes(src.type)) {
        for (const v of src.value as RtValue[]) {
          const key = dictKeyRepr(v, state, node.line);
          if (!elts.some((e) => dictKeyRepr(e, state) === key)) {
            elts.push(v);
          }
        }
      }
      const obj = allocObject('set', elts, '');
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
    const objVal = evalExpr(node.func.object, state);
    if (objVal === null) {
      throw new PyAttributeError(`'NoneType' object has no attribute '${method}' (line ${node.line})`);
    }
    if (typeof objVal === 'string' && state.heap[objVal]?.type === 'module') {
      const mod = state.heap[objVal];
      const modName = (mod.value as { name: string }).name;
      if (modName === 'math') {
        if (method in MATH_FUNCTIONS) {
          const res = MATH_FUNCTIONS[method](
            ...args.map((a) => (typeof a === 'string' && state.heap[a]?.type === 'float' ? state.heap[a].value : a))
          );
          if (['factorial', 'gcd', 'comb', 'floor', 'ceil'].includes(method)) {
            return Math.trunc(Number(res));
          }
          if (method === 'isclose') return Boolean(res);
          return allocFloat(Number(res), state);
        }
        throw new PyAttributeError(`module 'math' has no attribute '${method}' (line ${node.line})`);
      }
    }
    return callMethod(objVal, method, args, state, node.line);
  }

  const fnVal = evalExpr(node.func, state);
  return callUserFunction(fnVal, args, state, node.line);
}

/**
 * Call a user-defined function (heap function object).
 */
function callUserFunction(fnId: RtValue, args: RtValue[], state: MemoryState, line: number): RtValue {
  if (state.frames.length >= 100) {
    throw new PyRecursionError(`maximum recursion depth exceeded (line ${line})`);
  }
  const fn = state.heap[fnId as string];
  if (!fn || fn.type !== 'function') {
    if (fn && fn.type === 'builtin') {
      const bName = fn.value as string;
      if (bName.startsWith('math.')) {
        const mFn = bName.slice(5);
        if (mFn in MATH_FUNCTIONS) {
          const res = MATH_FUNCTIONS[mFn](
            ...args.map((a) => (typeof a === 'string' && state.heap[a]?.type === 'float' ? state.heap[a].value : a))
          );
          if (['factorial', 'gcd', 'comb', 'floor', 'ceil'].includes(mFn)) {
            return Math.trunc(Number(res));
          }
          if (mFn === 'isclose') return Boolean(res);
          return allocFloat(Number(res), state);
        }
      }
    }
    throw new PyTypeError(`object is not callable (line ${line})`);
  }
  const { name, params, paramDefaults, closure, body, async: isAsync } = fn.value as FunctionCode;
  if (isAsync) {
    return makeCoroutine(name, params, body, args, fnId as string, state);
  }

  const scope = analyzeLocals(body);
  const frame: Frame & { scopeInfo?: ScopeInfo; closure?: Record<string, { value: RtValue }> } = {
    name,
    locals: {},
    scopeInfo: scope,
    closure: closure ? { ...closure } : undefined,
  };
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    if (i < args.length) {
      frame.locals[p] = args[i]!;
    } else if (paramDefaults && p in paramDefaults) {
      frame.locals[p] = paramDefaults[p]!;
    } else {
      throw new PyTypeError(`${name}() missing required positional argument: '${p}' (line ${line})`);
    }
  }

  state.frames.push(frame);
  try {
    for (const stmt of body) {
      execStatement(stmt, state);
    }
  } catch (err) {
    if (err instanceof PyReturn) {
      return err.value;
    }
    throw err;
  } finally {
    state.frames.pop();
  }
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

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'numpy') {
    if (method === 'array') return makeNdarray(args, state, line);
    throw new Error(`AttributeError: module 'numpy' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'pandas') {
    if (method === 'Series') return makeSeries(args, state, line);
    if (method === 'DataFrame') return makeDataFrame(args, state, line);
    if (method === 'read_csv') return readCsv(args, state, line);
    throw new Error(`AttributeError: module 'pandas' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'asyncio') {
    if (method === 'create_task') return makeTask(args, state, line);
    if (method === 'gather') return gather(args, state, line);
    if (method === 'sleep') return asyncSleep(args, state, line);
    if (method === 'run') {
      runEventLoop(args, state, line);
      return null;
    }
    throw new Error(`AttributeError: module 'asyncio' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'module' && (obj.value as { name: string }).name === 'threading') {
    if (method === 'Thread') return makeThread(args, state, line);
    if (method === 'Lock') return makeLock(state, line);
    throw new Error(`AttributeError: module 'threading' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'thread') {
    if (method === 'start') { threadStart(objId as string, state, line); return null; }
    if (method === 'join') { threadJoin(objId as string, state, line); return null; }
    throw new Error(`AttributeError: 'thread' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'lock') {
    if (method === 'acquire') return lockAcquire(objId as string, state, line);
    if (method === 'release') return lockRelease(objId as string, state, line);
    throw new Error(`AttributeError: 'lock' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'ndarray') {
    if (method === 'copy') return copyNdarray(objId as string, state, line);
    if (method === 'sum') return ndarraySum(objId as string, state, line);
    throw new Error(`AttributeError: 'ndarray' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'series' || obj.type === 'dataframe') {
    // .loc / .iloc are not called — they are subscripts handled by bindTarget
    // and evalExpr (subscriptGet). Only callable methods land here.
    if (method === 'copy') return frameCopy(objId as string, state, line);
    if (method === 'sum') return frameSum(objId as string, state, line);
    throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'list') {
    return callListMethod(objId as string, method, args, state, line, valuesEqual, formatObject);
  }

  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    return callDictMethod(objId as string, method, args, state, line, formatObject);
  }

  if (obj.type === 'set') {
    return callSetMethod(objId as string, method, args, state, line, formatObject);
  }

  if (obj.type === 'str') {
    return callStrMethod(objId as string, method, args, state, line, allocString, formatObject);
  }

  throw new PyAttributeError(`'${obj.type}' object has no attribute '${method}' (line ${line})`);
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
    if (o.type === 'type') return (o.value as { name: string }).name;
    throw new PyTypeError(`expected a bare builtin, got a ${o.type} (line ${line})`);
  }
  throw new PyTypeError(`expected a bare builtin (e.g. list or int), not ${typeName(v, state)} (line ${line})`);
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
    if (o.type === 'builtin' || o.type === 'function' || o.type === 'type') return v;
  }
  throw new PyTypeError(`first argument must be a function (line ${line})`);
}

/** Ensure an argument is an iterator object (auto-wrap iterables with iter()). */
function ensureIterator(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const t = state.heap[v].type;
    if (isIteratorType(t)) return v;
    if (isIterableType(t)) return makeIterator(v, state, line) as string;
  }
  throw new PyTypeError(`argument of type '${typeName(v, state)}' is not iterable (line ${line})`);
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
  if (fn.type === 'builtin' || fn.type === 'type') {
    const b = fn.type === 'type' ? (fn.value as { name: string }).name : (fn.value as string);
    const a = args[0];
    if (b === 'int') return Math.trunc(derefNumber(a, state));
    if (b === 'float') return allocFloat(derefNumber(a, state), state);
    if (b === 'str') return allocString(displayValue(a, state), state);
    if (b === 'bool') return truthy(a, state);
    if (b === 'list' || b === 'tuple' || b === 'set') {
      const o = allocObject(b, Array.isArray(a) ? [...(a as unknown as RtValue[])] : [a], '');
      state.heap[o.id] = o;
      o.repr = formatObject(o, state);
      return o.id;
    }
    if (b === 'len') return lengthOf(a, state);
    if (b === 'abs') return Math.abs(derefNumber(a, state));
    throw new PyTypeError(`builtin '${b}' is not supported here (line ${line})`);
  }
  throw new PyTypeError(`object of type '${fn.type}' is not callable (line ${line})`);
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
 * A numpy buffer's payload: a flat run of numbers. Rendered as a separate
 * box on the canvas so a view-vs-copy distinction becomes visible — the
 * ndarray points at a buffer, and a copy mints a *second* buffer.
 */
interface NumpyBufferValue {
  data: number[];
  dtype: string;
}

/**
 * An ndarray's payload: a *window* onto a buffer. `buffer` is the id of the
 * heap buffer box; `offset` + `shape` carve the view's slice out of that
 * buffer's flat run. `view` is true when this window is not the buffer's full
 * extent (i.e. it is a slice) and false when it owns its own full buffer.
 */
interface NdarrayValue {
  buffer: string;
  offset: number;
  shape: number;
  dtype: string;
  view: boolean;
}

/** numpy-style repr of a number run. Right-pads integers; adds trailing dot to floats. */
function numpyRepr(data: number[], dtype: string = 'float64'): string {
  if (dtype === 'int64' || dtype === 'int32') {
    const strs = data.map(String);
    const maxLen = Math.max(...strs.map((s) => s.length), 1);
    const padded = strs.map((s) => s.padStart(maxLen, ' '));
    return `[${padded.join(' ')}]`;
  }
  const body = data.map((n) => (Number.isInteger(n) ? `${n}.` : String(n)));
  return `[${body.join(' ')}]`;
}

/** The numeric window an ndarray currently shows (offset+shape over buffer). */
function ndarrayWindow(ndId: string, state: MemoryState): number[] {
  const v = state.heap[ndId].value as NdarrayValue;
  const data = (state.heap[v.buffer].value as NumpyBufferValue).data;
  return data.slice(v.offset, v.offset + v.shape);
}

/** Allocate a buffer object holding a flat numeric run. */
function makeBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as NumpyBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * `np.array([...])` → a fresh buffer + an ndarray that owns its full buffer.
 */
function makeNdarray(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new PyTypeError(`array() takes exactly one argument (line ${line})`);
  const data = readNumberSeries(args[0], state);
  const listObj = typeof args[0] === 'string' ? state.heap[args[0]] : null;
  const hasFloat =
    listObj &&
    Array.isArray(listObj.value) &&
    (listObj.value as RtValue[]).some(
      (e) => typeof e === 'string' && state.heap[e]?.type === 'float'
    );
  const dtype = hasFloat ? 'float64' : 'int64';
  const bufId = makeBuffer(data, dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype, view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, dtype);
  return obj.id;
}

/**
 * `a.copy()` → a new buffer holding the array's current window. The new
 * buffer is fully independent: mutating one is invisible to the other.
 */
function copyNdarray(ndId: string, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new PyTypeError(`${typeName(ndId, state)} has no .copy() (line ${line})`);
  const data = ndarrayWindow(ndId, state);
  const dtype = (nd.value as NdarrayValue).dtype;
  const bufId = makeBuffer([...data], dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype, view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, dtype);
  return obj.id;
}

/**
 * `a[start:stop]` → a *view*: a new ndarray window onto the SAME buffer. This
 * is the flagship identity idea — slicing does not copy the data, it makes a
 * second window onto it. Writing through the view edits the shared buffer.
 */
function ndarraySlice(ndId: string, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new PyTypeError(`${typeName(ndId, state)} is not sliceable (line ${line})`);
  const v = nd.value as NdarrayValue;
  const full = (state.heap[v.buffer].value as NumpyBufferValue).data;
  const s = start === null ? 0 : Number(start);
  const e = stop === null ? v.shape : Number(stop);
  const offset = v.offset + s;
  const shape = Math.max(0, e - s);
  const obj = allocObject('ndarray', { buffer: v.buffer, offset, shape, dtype: v.dtype, view: true } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(full.slice(offset, offset + shape), v.dtype);
  void line;
  return obj.id;
}

/**
 * In-place vector addition for `+=`. Writes directly through the window to the shared buffer.
 */
function vecAddInPlace(ndId: string, right: RtValue, state: MemoryState, line: number): void {
  const a = state.heap[ndId];
  if (!a || a.type !== 'ndarray') throw new PyTypeError(`unsupported operand for += (line ${line})`);
  const b = Number(right);
  if (Number.isNaN(b)) throw new PyTypeError(`cannot add ${typeName(right, state)} to ndarray (line ${line})`);
  const v = a.value as NdarrayValue;
  const buffer = state.heap[v.buffer];
  const bufData = (buffer.value as NumpyBufferValue).data;
  for (let i = 0; i < v.shape; i++) {
    bufData[v.offset + i] += b;
  }
  refreshNdarrayReprs(state);
}

/**
 * `a + scalar` (vectorized) → a brand-new buffer holding the element-wise
 * result. The operand is read; a new buffer is minted for the result.
 */
function vecAdd(left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  const a = state.heap[left as string];
  if (!a || a.type !== 'ndarray') throw new PyTypeError(`unsupported operand (line ${line})`);
  const b = Number(right);
  if (Number.isNaN(b)) throw new PyTypeError(`cannot add ${typeName(right, state)} to ndarray (line ${line})`);
  const dtype = (a.value as NdarrayValue).dtype;
  const data = ndarrayWindow(left as string, state).map((n) => n + b);
  const bufId = makeBuffer(data, dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype, view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, dtype);
  return obj.id;
}

/** `a.sum()` → fold the array's window into a scalar. */
function ndarraySum(ndId: string, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new Error(`TypeError: ${typeName(ndId, state)} has no .sum() (line ${line})`);
  return ndarrayWindow(ndId, state).reduce((acc, n) => acc + n, 0);
}

/* ————————————————— asyncio (concurrency exemplar) —————————————————
 *
 * A coroutine is an object that holds a function's state across `await` points;
 * a Task is a named handle to one; the event loop is a tick-based scheduler that
 * round-robins ready tasks — each tick advances one task to its next `await`,
 * then moves on. There is no real loop or wall clock (the fidelity boundary):
 * the *schedule* is simulated so two coroutines visibly interleave.
 */

type AsyncStatus = 'pending' | 'ready' | 'suspended' | 'done';

interface CoroutineValue {
  fn: string;
  status: AsyncStatus;
  pc: number;
  name: string;
  params: string[];
  body: AstNode[];
  locals: Record<string, unknown>;
  returnValue: RtValue;
}

interface TaskValue {
  coro: string;
  name: string;
  status: AsyncStatus;
}

interface EventLoopValue {
  running: boolean;
  ready: string[];
  done: string[];
  tick: number;
}

function asyncRepr(type: string, v: unknown, state: MemoryState): string {
  if (type === 'coroutine') {
    const c = v as CoroutineValue;
    return `coro ${c.name}() · ${c.status}`;
  }
  if (type === 'task') {
    const t = v as TaskValue;
    return `Task(${t.name}) · ${t.status}`;
  }
  const l = v as EventLoopValue;
  const readyNames = l.ready.map((id) => (state.heap[id]?.value as TaskValue | undefined)?.name ?? '?').join(', ');
  const doneNames = l.done.map((id) => (state.heap[id]?.value as TaskValue | undefined)?.name ?? '?').join(', ');
  return `EventLoop · tick ${l.tick} · running ${l.running ? 'True' : 'False'} · [ready ${readyNames || '∅'} | done ${doneNames || '∅'}]`;
}

/**
 * Bind a coroutine function's call to a *suspended* coroutine object. Its
 * `locals` are seeded with the parameters; `pc` starts at 0 and the body has not
 * yet run — it only runs when the event loop ticks it.
 */
function makeCoroutine(
  name: string,
  params: string[],
  body: AstNode[],
  args: RtValue[],
  fnId: string,
  state: MemoryState,
): string {
  const locals: Record<string, unknown> = {};
  params.forEach((p, i) => (locals[p] = args[i]));
  const v: CoroutineValue = {
    fn: fnId,
    status: 'pending',
    pc: 0,
    name,
    params: [...params],
    body,
    locals,
    returnValue: null,
  };
  const obj = allocObject('coroutine', v, asyncRepr('coroutine', v, state));
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `a.create_task(coro)` → a Task wrapping the given coroutine (initially ready). */
function makeTask(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: create_task() takes one argument (a coroutine) (line ${line})`);
  const coroId = args[0];
  if (typeof coroId !== 'string' || state.heap[coroId]?.type !== 'coroutine') {
    throw new Error(`TypeError: create_task() takes a coroutine, got ${typeName(coroId, state)} (line ${line})`);
  }
  const coro = state.heap[coroId].value as CoroutineValue;
  const v: TaskValue = { coro: coroId, name: coro.name, status: coro.status === 'done' ? 'done' : 'ready' };
  const obj = allocObject('task', v, asyncRepr('task', v, state));
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `a.sleep(secs)` → a no-op builtin; the waiting is the surrounding `await`. */
function asyncSleep(args: RtValue[], state: MemoryState, line: number): RtValue {
  void state; // sleep is a no-op builtin — the waiting is the surrounding `await`
  if (args.length !== 1) throw new Error(`TypeError: sleep() takes one argument (line ${line})`);
  const secs = Number(args[0]);
  if (Number.isNaN(secs)) throw new Error(`TypeError: sleep() takes a number (line ${line})`);
  return null;
}

/** `a.gather(t1, t2, ...)` → a list of the task results (eager, for display). */
function gather(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1) throw new Error(`TypeError: gather() takes at least one awaitable (line ${line})`);
  const results: RtValue[] = args.map((a) => taskReturnValue(a, state, line));
  const obj = allocObject('list', results, '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

/** The value a finished task's coroutine returned (None if not done yet). */
function taskReturnValue(v: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof v !== 'string' || state.heap[v]?.type !== 'task') {
    throw new Error(`TypeError: gather() takes tasks, got ${typeName(v, state)} (line ${line})`);
  }
  const t = state.heap[v].value as TaskValue;
  const coro = state.heap[t.coro];
  if (!coro || coro.type !== 'coroutine') throw new Error(`RuntimeError: task coroutine was released (line ${line})`);
  const cv = coro.value as CoroutineValue;
  return cv.status === 'done' ? cv.returnValue : null;
}

/**
 * Advance one coroutine by exactly one tick: run statements from its `pc` until
 * it suspends on a cooperative `await` (handing the tick back to the loop) or it
 * returns. The suspended frame's locals are saved back onto the coroutine object
 * so the next tick resumes where it left off — a coroutine is a function that
 * remembers its place.
 */
function stepCoroutine(state: MemoryState): void {
  const coroId = activeCoroutineId!;
  const c = state.heap[coroId].value as CoroutineValue;
  const frame: Frame = { name: c.name, locals: {} };
  for (const [k, v] of Object.entries(c.locals)) frame.locals[k] = v as RtValue;
  state.frames.push(frame);
  try {
    while (c.pc < c.body.length) {
      try {
        execStatement(c.body[c.pc]!, state);
      } catch (err) {
        if (err instanceof PySuspend) {
          // Cooperative yield: move past the `await` statement so the next tick
          // resumes after it, not by re-running it.
          c.pc += 1;
          c.status = 'suspended';
          return;
        }
        if (err instanceof PyReturn) {
          c.returnValue = err.value;
          c.pc = c.body.length;
          c.status = 'done';
          return;
        }
        throw err;
      }
      c.pc += 1;
    }
    c.returnValue = null;
    c.status = 'done';
  } finally {
    for (const [k, v] of Object.entries(frame.locals)) c.locals[k] = v;
    state.frames.pop();
    refreshAsyncReprs(state);
  }
}

/** Recompute the repr of every async object (status / queue change each tick). */
function refreshAsyncReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'coroutine' || obj.type === 'task' || obj.type === 'eventloop') {
      obj.repr = asyncRepr(obj.type, obj.value, state);
    }
  }
}

/**
 * `a.run(t1, t2, ...)` — the event loop. It builds a loop object whose ready
 * queue holds the tasks, then steps them round-robin, one task per tick, until
 * all are done. Each tick is one unit of interleaving; the round-robined stdout
 * is the visible proof the tasks ran cooperatively (A, B, A, B, …), not one
 * after the other.
 */
function runEventLoop(args: RtValue[], state: MemoryState, line: number): void {
  if (args.length < 1) throw new Error(`TypeError: run() takes at least one task (line ${line})`);
  const taskIds = args.map((a) => ensureTaskId(a, state, line));
  const ready = taskIds.filter((id) => (state.heap[id].value as TaskValue).status !== 'done');
  const done = taskIds.filter((id) => (state.heap[id].value as TaskValue).status === 'done');
  const loop: EventLoopValue = { running: true, ready, done, tick: 0 };
  const loopObj = allocObject('eventloop', loop, asyncRepr('eventloop', loop, state));
  state.heap[loopObj.id] = loopObj;

  let guard = 0;
  while (loop.ready.length > 0) {
    const taskId = loop.ready.shift()!;
    const task = state.heap[taskId];
    if (!task || task.type !== 'task') {
      loop.ready = [];
      break;
    }
    const tv = task.value as TaskValue;
    activeCoroutineId = tv.coro; // this step runs inside the task's coroutine
    stepCoroutine(state);
    activeCoroutineId = null;
    loop.tick += 1;
    state.ticks += 1;
    const nowDone = (state.heap[tv.coro].value as CoroutineValue).status === 'done';
    tv.status = nowDone ? 'done' : 'ready';
    if (nowDone) loop.done.push(taskId);
    else loop.ready.push(taskId);
    // Refresh all async reprs after the state/queue update so the boxes agree.
    refreshAsyncReprs(state);
    if (guard++ > 10000) {
      loop.running = false;
      break;
    }
  }
  loop.running = false;
  refreshAsyncReprs(state);
}

/** Resolve a run() argument to a task object id (rejects lists / non-tasks). */
function ensureTaskId(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]?.type === 'task') return v;
  throw new Error(`TypeError: run() takes tasks, got ${typeName(v, state)} (line ${line})`);
}

/* ————————————————— threading (concurrency exemplar) —————————————————
 *
 * A thread is a call running in its own frame that SHARES the module heap. The
 * faithful difference from asyncio: a thread is preempted after EVERY statement,
 * not just at an await. `join` is the scheduler — it round-robins the started
 * threads one statement at a time, so two threads visibly interleave on the
 * shared memory. A lock's acquire() on a held lock suspends the caller until the
 * holder release()s — mutual exclusion that makes an interleaved read-modify-write
 * (the classic lost-update race) safe.
 */

type ThreadStatus = 'not-started' | 'running' | 'blocked' | 'done';

interface ThreadValue {
  target: string; // the function code object id this thread runs
  name: string;
  status: ThreadStatus;
  pc: number;
  body: AstNode[];
  locals: Record<string, unknown>;
  returnValue: RtValue;
  blocked: boolean; // true while suspended on a held lock
}

interface LockValue {
  held: boolean;
  holder: string | null; // the thread id holding it, null when free
}

/**
 * The id of the thread currently being stepped by `threadJoin`, or null. Lets
 * `lockAcquire`/`lockRelease` know which thread is running (is the lock already
 * held by THIS thread?) and who to record as holder. The engine is
 * single-threaded, so a module pointer is safe — exactly how `activeCoroutineId`
 * works for asyncio.
 */
let activeThreadId: string | null = null;

function threadRepr(type: string, v: unknown): string {
  if (type === 'thread') {
    const t = v as ThreadValue;
    return `Thread-${t.name} · ${t.status}`;
  }
  const l = v as LockValue;
  return `Lock · ${l.held ? 'HELD' : 'free'}`;
}

/**
 * `t.Thread(target, args_tuple)` — make a thread that runs `target` with the
 * `args_tuple` elements as its parameters. It starts in **not-started**: the
 * target has not run yet. The parser has no keyword args, so `target` and the
 * `args` tuple are positional (`t.Thread(bump, (box,))`).
 */
function makeThread(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1 || args.length > 2) {
    throw new Error(`TypeError: Thread() takes (target[, args_tuple]) (line ${line})`);
  }
  const fnId = args[0];
  const fn = typeof fnId === 'string' ? state.heap[fnId] : undefined;
  if (!fn || fn.type !== 'function') {
    throw new Error(`TypeError: Thread() target must be a function, got ${typeName(fnId, state)} (line ${line})`);
  }
  const code = fn.value as FunctionCode;
  const params = code.params;
  // Args come as a tuple (or list); its elements bind to the target's params.
  let callArgs: RtValue[] = [];
  if (args.length === 2) {
    const tup = typeof args[1] === 'string' ? state.heap[args[1] as string] : undefined;
    if (tup && ['tuple', 'list'].includes(tup.type)) {
      callArgs = [...(tup.value as RtValue[])];
    }
  }
  if (callArgs.length !== params.length) {
    throw new Error(`TypeError: Thread() target ${code.name}() takes ${params.length} arg(s), got ${callArgs.length} (line ${line})`);
  }
  const locals: Record<string, unknown> = {};
  params.forEach((p, i) => (locals[p] = callArgs[i]));
  const v: ThreadValue = {
    target: fnId as string,
    name: code.name,
    status: 'not-started',
    pc: 0,
    body: code.body,
    locals,
    returnValue: null,
    blocked: false,
  };
  const obj = allocObject('thread', v, threadRepr('thread', v));
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `t.Lock()` → a free lock. */
function makeLock(state: MemoryState, line: number): RtValue {
  void line;
  const v: LockValue = { held: false, holder: null };
  const obj = allocObject('lock', v, threadRepr('lock', v));
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `thread.start()` — the thread becomes running (it runs under `join`). */
function threadStart(objId: string, state: MemoryState, line: number): void {
  const th = state.heap[objId].value as ThreadValue;
  if (th.status === 'running' || th.status === 'blocked') {
    throw new Error(`RuntimeError: cannot start thread ${th.name} (already started) (line ${line})`);
  }
  th.status = 'running';
  th.pc = 0;
  refreshThreadReprs(state);
}

/**
 * `lock.acquire()` — take the lock. Free (or already held by THIS thread) takes
 * immediately; held by ANOTHER thread suspends the caller (PySuspend) so it is
 * retried next round until the holder releases. Acquiring never advances `pc` —
 * a suspended thread re-runs `acquire()` on its next turn, which is what makes
 * blocking different from asyncio's one-shot `await`.
 */
function lockAcquire(objId: string, state: MemoryState, line: number): RtValue {
  void line;
  const lk = state.heap[objId].value as LockValue;
  if (lk.held && lk.holder !== activeThreadId) {
    throw new PySuspend();
  }
  lk.held = true;
  lk.holder = activeThreadId;
  refreshThreadReprs(state);
  return null;
}

/** `lock.release()` — free the lock. Only the holder (or a free lock) may. */
function lockRelease(objId: string, state: MemoryState, line: number): RtValue {
  const lk = state.heap[objId].value as LockValue;
  if (lk.held && lk.holder !== activeThreadId) {
    throw new Error(`RuntimeError: cannot release lock (not held by this thread) (line ${line})`);
  }
  lk.held = false;
  lk.holder = null;
  refreshThreadReprs(state);
  return null;
}

/**
 * `thread.join()` — the scheduler. Every started (running or blocked) thread is
 * driven in a round-robin, ONE statement at a time, until they all finish. This
 * preemption is what makes threads race: a thread reads box[0], then the other
 * thread reads it too, THEN both write — so a write can be lost. A thread that
 * blocks on a held lock is suspended and retried the next round. A full round
 * with zero real progress is a deadlock (circular lock wait); we stop it rather
 * than hang, leaving the threads visibly blocked.
 */
function threadJoin(objId: string, state: MemoryState, line: number): void {
  const self = state.heap[objId];
  if (!self || self.type !== 'thread') {
    throw new Error(`TypeError: join() called on a non-thread (line ${line})`);
  }
  const selfTh = self.value as ThreadValue;
  if (selfTh.status === 'not-started') threadStart(objId, state, line);

  const active = Object.values(state.heap).filter((o) => o.type === 'thread');
  let stalledRounds = 0;
  for (;;) {
    const live = active.filter((t) => {
      const tv = t.value as ThreadValue;
      return tv.status === 'running' || tv.status === 'blocked';
    });
    if (live.length === 0) break;
    let progressed = false;
    for (const t of live) {
      const tv = t.value as ThreadValue;
      if (tv.status === 'blocked') { tv.blocked = false; tv.status = 'running'; }
      if (tv.pc >= tv.body.length) { tv.status = 'done'; progressed = true; continue; }
      const before = tv.pc;
      stepThread(t.id, state);
      // A re-block (pc unchanged, back to blocked) is no real progress — the
      // signal of a circular-wait deadlock.
      if (tv.status === 'done' || tv.pc > before) progressed = true;
    }
    refreshThreadReprs(state);
    if (!progressed) {
      if (++stalledRounds > 10000) break; // deadlock: leave them blocked
      continue;
    }
    stalledRounds = 0;
  }
  refreshThreadReprs(state);
}

/**
 * Step one thread by exactly ONE statement (not to its next suspension). This is
 * the preemption that lets threads interleave: read box[0], THEN hand off, THEN
 * write. Locals are saved back onto the thread across the yield; a lock-suspension
 * leaves `pc` on the `acquire()` so it retries.
 */
function stepThread(threadId: string, state: MemoryState): void {
  const th = state.heap[threadId].value as ThreadValue;
  if (th.pc >= th.body.length) { th.status = 'done'; return; }
  const frame: Frame = { name: `thread:${th.name}`, locals: {} };
  for (const [k, v] of Object.entries(th.locals)) frame.locals[k] = v as RtValue;
  state.frames.push(frame);
  activeThreadId = threadId;
  try {
    try {
      execStatement(th.body[th.pc]!, state);
    } catch (err) {
      if (err instanceof PySuspend) {
        // Blocking on a held lock: stay on the acquire() (pc NOT advanced) and
        // mark the thread blocked; the next round retries it.
        th.blocked = true;
        th.status = 'blocked';
        return;
      }
      if (err instanceof PyReturn) {
        th.returnValue = err.value;
        th.pc = th.body.length;
        th.status = 'done';
        return;
      }
      throw err;
    }
    th.pc += 1;
    if (th.pc >= th.body.length) th.status = 'done';
  } finally {
    for (const [k, v] of Object.entries(frame.locals)) th.locals[k] = v;
    state.frames.pop();
    activeThreadId = null;
    refreshThreadReprs(state);
    refreshReprs(state);
  }
}

/** Recompute the repr of every thread (status) and lock (held/free). */
function refreshThreadReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'thread' || obj.type === 'lock') {
      obj.repr = threadRepr(obj.type, obj.value);
    }
  }
}

/* ————————————————— pandas (Phase 2) —————————————————
 *
 * A Series/DataFrame is *windows over a buffer*, the numpy picture lifted to a
 * table. `buffer` here reuses the numpy 'buffer' box (a flat run of numbers),
 * so the RAM view shows the same byte layout and a copy is a genuinely new
 * buffer. Two identities are taught: loc/iloc give a *live view* (shares the
 * buffer), and .copy() gives an *independent* buffer.
 */

interface PandasBufferValue {
  data: number[];
  dtype: string;
}

/** A Series: a window over a buffer plus its row labels. */
interface PandasSeriesValue {
  buffer: string;
  offset: number;
  length: number;
  dtype: string;
  index: string[];
  view: boolean;
  name?: string;
  /** The shared buffer a row/iloc view derives from (its `base`). */
  source?: string;
}

/** A DataFrame: a window over a row-major buffer, plus labels. */
interface PandasDataFrameValue {
  buffer: string;
  columns: string[];
  index: string[];
  dtype: string;
  view: boolean;
  /** First row of this window into the buffer (0 for an owning frame; a row-slice shares the buffer at an offset). */
  rowOffset?: number;
  source?: string;
}

/** The number of rows an object currently shows. */
function frameRowCount(v: { length?: number; index?: string[] }): number {
  if (typeof v.length === 'number') return v.length;
  return v.index?.length ?? 0;
}

/**
 * Strip a display label down to a bare name: `'x'` → `x`. Dict keys are stored
 * as display labels (quoted for strings); pandas column names are the unquoted
 * value, so normalize on read and on lookup.
 */
function colName(label: string): string {
  if (label.startsWith('str:')) {
    return label.slice(4);
  }
  if (label.startsWith("'") && label.endsWith("'") && label.length >= 2) {
    return label.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return label;
}

/** The numbers a Series window currently shows. */
function seriesValues(sId: string, state: MemoryState): number[] {
  const s = state.heap[sId].value as PandasSeriesValue;
  const data = (state.heap[s.buffer].value as PandasBufferValue).data;
  return data.slice(s.offset, s.offset + s.length);
}

/** First buffer row a DataFrame window starts at (0 for an owning frame). */
function frameRowStart(v: PandasDataFrameValue): number {
  return v.rowOffset ?? 0;
}

/** Read one column of a DataFrame window as a plain number run (row-major). */
function frameColumn(dfId: string, col: string, state: MemoryState): number[] {
  const v = state.heap[dfId].value as PandasDataFrameValue;
  const data = (state.heap[v.buffer].value as PandasBufferValue).data;
  const ci = v.columns.indexOf(col);
  if (ci < 0) return [];
  const rowStart = frameRowStart(v);
  const nRows = frameRowCount(v);
  const out: number[] = [];
  for (let r = 0; r < nRows; r++) out.push(data[(rowStart + r) * v.columns.length + ci]!);
  return out;
}

/** Column-major: the buffer layout for a set of rows × columns. */
function frameBufferData(rows: Record<string, number[]>, columns: string[], nRows: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < nRows; r++) for (const c of columns) out.push(rows[c]?.[r] ?? 0);
  return out;
}

function makePandasBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as PandasBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Build the canonical label + header repr for a Series or DataFrame so the box
 * and the RAM view both read like a pandas object (labels, column headers).
 */
function pandasRepr(type: string, v: PandasSeriesValue | PandasDataFrameValue, state: MemoryState): string {
  if (type === 'series') {
    const s = v as PandasSeriesValue;
    const data = (state.heap[s.buffer].value as PandasBufferValue).data;
    const shown = data.slice(s.offset, s.offset + s.length);
    const labels = s.index.slice(s.offset, s.offset + s.length);
    const lines = labels.map((label, i) => `${String(label).padEnd(8)} ${shown[i] ?? 0}`);
    const header = s.name ? `Series: ${s.name}` : 'Series';
    return `${header}\n${lines.join('\n')}`;
  }
  const f = v as PandasDataFrameValue;
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  const nRows = frameRowCount(f);
  const rowStart = frameRowStart(f);
  const head = f.columns.join('  ');
  const lines: string[] = [head];
  for (let r = 0; r < nRows; r++) {
    const cells: string[] = [];
    for (const c of f.columns) cells.push(String(data[(rowStart + r) * f.columns.length + f.columns.indexOf(c)] ?? 0));
    lines.push(`${f.index[r] ?? ''}  ${cells.join('  ')}`);
  }
  return `DataFrame\n${lines.join('\n')}`;
}

/** `pd.Series([v0, v1, ...], index=[...])` → a Series window owning its buffer. */
function makeSeries(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: Series() takes one argument (line ${line})`);
  const data = readNumberSeries(args[0], state);
  const bufId = makePandasBuffer(data, 'float64', state);
  const v: PandasSeriesValue = {
    buffer: bufId,
    offset: 0,
    length: data.length,
    dtype: 'float64',
    index: data.map((_, i) => String(i)),
    view: false,
  };
  const obj = allocObject('series', v, '');
  state.heap[obj.id] = obj;
  obj.repr = pandasRepr('series', v, state);
  return obj.id;
}

/** `pd.DataFrame({col: [...], ...})` → a DataFrame with one buffer (row-major). */
function makeDataFrame(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: DataFrame() takes one argument (line ${line})`);
  const obj = state.heap[args[0] as string];
  if (!obj || obj.type !== 'dict') throw new Error(`TypeError: DataFrame() takes a dict of columns (line ${line})`);
  const entries = obj.value as Array<[string, RtValue]>;
  const columns = entries.map(([k]) => colName(k));
  const colData = entries.map(([, v]) => readNumberSeries(v, state));
  const nRows = Math.max(0, ...colData.map((c) => c.length));
  const rows: Record<string, number[]> = {};
  columns.forEach((c, ci) => (rows[c] = colData[ci]!));
  const bufId = makePandasBuffer(frameBufferData(rows, columns, nRows), 'float64', state);
  const v: PandasDataFrameValue = {
    buffer: bufId,
    columns,
    index: Array.from({ length: nRows }, (_, i) => String(i)),
    dtype: 'float64',
    view: false,
  };
  const df = allocObject('dataframe', v, '');
  state.heap[df.id] = df;
  df.repr = pandasRepr('dataframe', v, state);
  return df.id;
}

/**
 * Select one or more columns of a DataFrame. Returns a single Series for a
 * scalar column key, a new owning DataFrame for a list of columns.
 */
function frameGetColumn(dfId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  const v = state.heap[dfId].value as PandasDataFrameValue;
  const isList = typeof key === 'string' && state.heap[key] && state.heap[key].type === 'list';
  const cols: string[] = [];
  if (isList) {
    for (const e of state.heap[key].value as RtValue[]) {
      const c = colName(displayValue(e, state));
      if (!v.columns.includes(c)) throw new PyKeyError(`column '${c}' (line ${line})`);
      cols.push(c);
    }
  } else {
    const c = colName(displayValue(key, state));
    if (!v.columns.includes(c)) throw new PyKeyError(`column '${c}' (line ${line})`);
    cols.push(c);
  }

  const nRows = frameRowCount(v);

  if (cols.length === 1 && !isList) {
    // a single named column is a Series. A column is not a contiguous run of
    // the row-major buffer, so it gets its own single-column buffer.
    const col = frameColumn(dfId, cols[0]!, state);
    const s: PandasSeriesValue = {
      buffer: makePandasBuffer(col, v.dtype, state),
      offset: 0,
      length: nRows,
      dtype: v.dtype,
      index: [...v.index],
      view: false,
      name: cols[0],
    };
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }

  // subset of columns → new owning DataFrame over a fresh buffer
  const rows: Record<string, number[]> = {};
  for (const c of cols) rows[c] = frameColumn(dfId, c, state);
  const nbuf = makePandasBuffer(frameBufferData(rows, cols, nRows), v.dtype, state);
  const nf: PandasDataFrameValue = {
    buffer: nbuf,
    columns: cols,
    index: [...v.index],
    dtype: v.dtype,
    view: false,
  };
  const nd = allocObject('dataframe', nf, '');
  state.heap[nd.id] = nd;
  nd.repr = pandasRepr('dataframe', nf, state);
  return nd.id;
}

/** `df.loc[rowIndex]` / `s.loc[rowIndex]` → a live row view (shares buffer). */
function frameLocRow(objId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad loc target (line ${line})`);
  const label = displayValue(key, state);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const i = s.index.indexOf(label);
    if (i < 0) throw new Error(`KeyError: ${label} (line ${line})`);
    // a row of a Series is a scalar
    return seriesValues(objId, state)[i]!;
  }

  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const i = f.index.indexOf(label);
    if (i < 0) throw new Error(`KeyError: ${label} (line ${line})`);
    // a row of a DataFrame is a Series view over the shared buffer
    const row: number[] = [];
    for (const c of f.columns) row.push(frameColumn(objId, c, state)[i]!);
    const s: PandasSeriesValue = {
      buffer: state.heap[f.buffer].id,
      offset: 0,
      length: f.columns.length,
      dtype: f.dtype,
      index: [...f.columns],
      view: true,
    };
    // materialize the row into its own single-row buffer so the RAM view shows
    // a live window over the shared (row-major) store.
    const rbuf = makePandasBuffer(row, f.dtype, state);
    s.buffer = rbuf;
    s.source = state.heap[f.buffer].id;
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .loc (line ${line})`);
}

/** `df.iloc[i]` / `s.iloc[i]` → a live position-based row view. */
function frameIlocRow(objId: string, i0: RtValue, state: MemoryState, line: number): RtValue {
  const i = Number(i0);
  if (Number.isNaN(i)) throw new Error(`TypeError: iloc takes an integer (line ${line})`);
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    return seriesValues(objId, state)[idx]!;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    const row: number[] = [];
    for (const c of f.columns) row.push(frameColumn(objId, c, state)[idx]!);
    const s: PandasSeriesValue = {
      buffer: makePandasBuffer(row, f.dtype, state),
      offset: 0,
      length: f.columns.length,
      dtype: f.dtype,
      index: [...f.columns],
      view: true,
      source: state.heap[f.buffer].id,
    };
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/** `s.iloc[a:b]` / `df.iloc[a:b]` → a window (view) over a row range. */
function frameIlocSlice(objId: string, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);
  const a = start === null ? 0 : Number(start);
  let e = stop === null ? 0 : Number(stop);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    e = stop === null ? n : e;
    // a row-range of a Series is a *view*: a new window over the same buffer.
    const v: PandasSeriesValue = {
      buffer: s.buffer,
      offset: s.offset + a,
      length: Math.max(0, e - a),
      dtype: s.dtype,
      index: s.index.slice(a, e),
      view: true,
      name: s.name,
    };
    const o = allocObject('series', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('series', v, state);
    return o.id;
  }

  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    e = stop === null ? n : e;
    // a row-range of a DataFrame is a *view*: a new window onto the SAME
    // buffer at an offset. No data is copied — exactly the numpy idea.
    const rowStart = frameRowStart(f) + a;
    const v: PandasDataFrameValue = {
      buffer: state.heap[f.buffer].id,
      columns: [...f.columns],
      index: f.index.slice(a, e),
      dtype: f.dtype,
      view: true,
      rowOffset: rowStart,
      source: state.heap[f.buffer].id,
    };
    const o = allocObject('dataframe', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('dataframe', v, state);
    return o.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/** `s.iloc[i] = v` / `df.iloc[i] = v` → write through the shared buffer. */
function frameIlocSet(objId: string, i0: RtValue, value: RtValue, state: MemoryState, line: number): void {
  const i = Number(i0);
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);
  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    const data = (state.heap[s.buffer].value as PandasBufferValue).data;
    data[s.offset + idx] = Number(value);
    obj.repr = pandasRepr('series', s, state);
    return;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    // value is a list (one per column); write the whole row into the buffer
    const listObj = state.heap[value as string];
    if (!listObj || listObj.type !== 'list') throw new Error(`TypeError: df.iloc row needs a list (line ${line})`);
    const cells = listObj.value as RtValue[];
    const rowStart = frameRowStart(f);
    const data = (state.heap[f.buffer].value as PandasBufferValue).data;
    for (let c = 0; c < f.columns.length; c++) data[(rowStart + idx) * f.columns.length + c] = Number(cells[c] ?? 0);
    obj.repr = pandasRepr('dataframe', f, state);
    return;
  }
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/** `x.copy()` on a Series/DataFrame → a new owning buffer. */
function frameCopy(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad copy target (line ${line})`);
  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const win = seriesValues(objId, state);
    const v: PandasSeriesValue = {
      buffer: makePandasBuffer([...win], s.dtype, state),
      offset: 0,
      length: win.length,
      dtype: s.dtype,
      index: s.index.slice(s.offset, s.offset + s.length),
      view: false,
      name: s.name,
    };
    const o = allocObject('series', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('series', v, state);
    return o.id;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const data = (state.heap[f.buffer].value as PandasBufferValue).data;
    const rowStart = frameRowStart(f);
    const nRows = frameRowCount(f);
    const win = data.slice(rowStart * f.columns.length, (rowStart + nRows) * f.columns.length);
    const v: PandasDataFrameValue = {
      buffer: makePandasBuffer([...win], f.dtype, state),
      columns: [...f.columns],
      index: [...f.index],
      dtype: f.dtype,
      view: false,
    };
    const o = allocObject('dataframe', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('dataframe', v, state);
    return o.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .copy() (line ${line})`);
}

/** `s.sum()` / `df.sum()` → reduce (Series: one scalar; DF: per-column Series). */
function frameSum(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad sum target (line ${line})`);
  if (obj.type === 'series') {
    return seriesValues(objId, state).reduce((a, b) => a + b, 0);
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const sums = f.columns.map((c) => frameColumn(objId, c, state).reduce((a, b) => a + b, 0));
    const s: PandasSeriesValue = {
      buffer: makePandasBuffer(sums, 'float64', state),
      offset: 0,
      length: sums.length,
      dtype: 'float64',
      index: [...f.columns],
      view: false,
      name: 'sum',
    };
    const o = allocObject('series', s, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('series', s, state);
    return o.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .sum() (line ${line})`);
}

/** `df['col']` / `df[['c1','c2']]` → a Series or column-subset DataFrame. */
function frameSubscript(dfId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  return frameGetColumn(dfId, key, state, line);
}

/** `df['col'] = list` → replace a column's values in the shared buffer. */
function frameSetColumn(dfId: string, colKey: RtValue, value: RtValue, state: MemoryState, line: number): void {
  const f = state.heap[dfId].value as PandasDataFrameValue;
  const col = colName(displayValue(colKey, state));
  if (!f.columns.includes(col)) throw new Error(`KeyError: column '${col}' (line ${line})`);
  const listObj = state.heap[value as string];
  if (!listObj || listObj.type !== 'list') throw new Error(`TypeError: assigning a column needs a list (line ${line})`);
  const cells = listObj.value as RtValue[];
  const nRows = frameRowCount(f);
  const ci = f.columns.indexOf(col);
  const rowStart = frameRowStart(f);
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  for (let r = 0; r < nRows; r++) data[(rowStart + r) * f.columns.length + ci] = Number(cells[r] ?? 0);
  state.heap[dfId].repr = pandasRepr('dataframe', f, state);
}

/**
 * `pd.read_csv(name, {col: [...], ...})` → a DataFrame. Structure-only (the
 * fidelity boundary: the sandbox has no disk): the file's parsed content is
 * supplied explicitly, and the result is a real DataFrame whose structure is
 * the teaching point — the box is labeled with the source filename.
 */
function readCsv(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: read_csv(name, data) takes two arguments (line ${line})`);
  // a string-literal filename is a raw value; a bound name resolves to its str
  const name = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : displayValue(args[0], state);
  const dfId = makeDataFrame([args[1]], state, line) as string;
  const df = state.heap[dfId];
  // label the box with the file it "came from" — the memory-model story
  df.repr = `DataFrame (from ${name})\n${df.repr.slice('DataFrame\n'.length)}`;
  return dfId;
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
 * Value equality for Python semantics (handles True == 1, 2 == 2.0, containers).
 */
function valuesEqual(a: RtValue, b: RtValue, state: MemoryState): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const at = typeName(a, state);
  const bt = typeName(b, state);
  if ((at === 'int' || at === 'float' || at === 'bool') && (bt === 'int' || bt === 'float' || bt === 'bool')) {
    const an = a === true ? 1 : a === false ? 0 : derefNumber(a, state);
    const bn = b === true ? 1 : b === false ? 0 : derefNumber(b, state);
    return an === bn;
  }
  if (at === 'str' && bt === 'str') {
    const as = state.heap[a as string]?.value as string ?? String(a);
    const bs = state.heap[b as string]?.value as string ?? String(b);
    return as === bs;
  }
  if (at !== bt) return false;
  if (at === 'list' || at === 'tuple' || at === 'set') {
    const aa = state.heap[a as string].value as RtValue[];
    const ba = state.heap[b as string].value as RtValue[];
    if (aa.length !== ba.length) return false;
    return aa.every((v, i) => valuesEqual(v, ba[i]!, state));
  }
  return false;
}

function truthy(v: RtValue, state: MemoryState): boolean {
  if (v === null || v === false || v === 0 || v === 0n || v === '') return false;
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set') return (obj.value as RtValue[]).length > 0;
    if (obj.type === 'dict' || obj.type === 'defaultdict') return dictEntries(obj).length > 0;
    if (obj.type === 'str') return (obj.value as string).length > 0;
    if (obj.type === 'range') return rangeLength(obj.value as RangeValue) > 0;
    if (obj.type === 'float') return (obj.value as number) !== 0;
  }
  return Boolean(v);
}

function derefNumber(v: RtValue, state: MemoryState): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'str') return Number(obj.value);
    if (obj.type === 'float') return obj.value as number;
    if (obj.type === 'int') return Number(obj.value);
  }
  return Number(v);
}

function lengthOf(v: RtValue, state: MemoryState): number {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set', 'dict'].includes(obj.type)) return (obj.value as unknown[]).length;
    if (obj.type === 'defaultdict') return dictEntries(obj).length;
    if (obj.type === 'ndarray') return (obj.value as NdarrayValue).shape;
    if (obj.type === 'str') return Array.from(obj.value as string).length;
    if (obj.type === 'range') return rangeLength(obj.value as RangeValue);
  }
  if (typeof v === 'string') return Array.from(v).length;
  throw new PyTypeError(`object has no len()`);
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
        const n = derefNumber(e, state);
        if (Number.isNaN(n)) throw new PyTypeError('expected numeric points');
        return n;
      });
    }
    throw new PyTypeError(`${obj.type} is not an iterable of numbers`);
  }
  throw new PyTypeError('expected a list of numbers');
}

function binOp(op: string, left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  const lt = typeName(left, state);
  const rt = typeName(right, state);

  // vectorized ndarray + scalar → a fresh buffer
  if (op === '+' && (lt === 'ndarray' || rt === 'ndarray')) {
    const scalar = lt === 'ndarray' ? right : left;
    const arr = lt === 'ndarray' ? left : right;
    if (typeof scalar !== 'number') throw new PyTypeError(`unsupported operand for + (line ${line})`);
    return vecAdd(arr, scalar, state, line);
  }

  // String formatting with %: e.g. '%d' % 1
  if (op === '%' && lt === 'str') {
    const formatStr = state.heap[left as string]?.value as string ?? String(left);
    const formatted = formatStr.replace(/%[sdrf]/g, () => printArg(right, state));
    return allocString(formatted, state);
  }

  // Strings
  if (lt === 'str' || rt === 'str') {
    if (op === '+' && lt === 'str' && rt === 'str') {
      const lv = state.heap[left as string]?.value as string ?? String(left);
      const rv = state.heap[right as string]?.value as string ?? String(right);
      return allocString(lv + rv, state);
    }
    if (op === '+' && lt === 'str') {
      throw new PyTypeError(`can only concatenate str (not "${rt}") to str (line ${line})`);
    }
    if (op === '+' && rt === 'str') {
      throw new PyTypeError(`unsupported operand type(s) for +: '${lt}' and 'str' (line ${line})`);
    }
    if (op === '*' && lt === 'str' && rt === 'int') {
      const s = state.heap[left as string]?.value as string ?? String(left);
      return allocString(s.repeat(Math.max(0, Number(right))), state);
    }
    if (op === '*' && lt === 'int' && rt === 'str') {
      const s = state.heap[right as string]?.value as string ?? String(right);
      return allocString(s.repeat(Math.max(0, Number(left))), state);
    }
    throw new PyTypeError(`unsupported operand type(s) for ${op}: '${lt}' and '${rt}' (line ${line})`);
  }

  // Lists
  if (lt === 'list' || rt === 'list') {
    if (op === '+' && lt === 'list' && rt === 'list') {
      const merged = [
        ...(state.heap[left as string].value as RtValue[]),
        ...(state.heap[right as string].value as RtValue[]),
      ];
      const obj = allocObject('list', merged, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (op === '+' && lt === 'list') {
      throw new PyTypeError(`can only concatenate list (not "${rt}") to list (line ${line})`);
    }
    if (op === '+' && rt === 'list') {
      throw new PyTypeError(`can only concatenate list (not "${lt}") to list (line ${line})`);
    }
    if (op === '*' && lt === 'list' && rt === 'int') {
      const n = Math.max(0, Number(right));
      const src = state.heap[left as string].value as RtValue[];
      const merged: RtValue[] = [];
      for (let i = 0; i < n; i++) merged.push(...src);
      const obj = allocObject('list', merged, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (op === '*' && lt === 'int' && rt === 'list') {
      const n = Math.max(0, Number(left));
      const src = state.heap[right as string].value as RtValue[];
      const merged: RtValue[] = [];
      for (let i = 0; i < n; i++) merged.push(...src);
      const obj = allocObject('list', merged, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    throw new PyTypeError(`unsupported operand type(s) for ${op}: '${lt}' and '${rt}' (line ${line})`);
  }

  // Tuples
  if (lt === 'tuple' || rt === 'tuple') {
    if (op === '+' && lt === 'tuple' && rt === 'tuple') {
      const merged = [
        ...(state.heap[left as string].value as RtValue[]),
        ...(state.heap[right as string].value as RtValue[]),
      ];
      const obj = allocObject('tuple', merged, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    if (op === '+' && lt === 'tuple') {
      throw new PyTypeError(`can only concatenate tuple (not "${rt}") to tuple (line ${line})`);
    }
    if (op === '+' && rt === 'tuple') {
      throw new PyTypeError(`can only concatenate tuple (not "${lt}") to tuple (line ${line})`);
    }
    throw new PyTypeError(`unsupported operand type(s) for ${op}: '${lt}' and '${rt}' (line ${line})`);
  }

  // Numeric operations (int, float, bool)
  const isNum = (t: string) => t === 'int' || t === 'float' || t === 'bool';
  if (!isNum(lt) || !isNum(rt)) {
    throw new PyTypeError(`unsupported operand type(s) for ${op}: '${lt}' and '${rt}' (line ${line})`);
  }

  const isFloat = lt === 'float' || rt === 'float';
  const a = derefNumber(left, state);
  const b = derefNumber(right, state);

  if (op === '/') {
    if (b === 0) throw new PyZeroDivisionError(`division by zero (line ${line})`);
    return allocFloat(a / b, state);
  }

  if (isFloat) {
    switch (op) {
      case '+': return allocFloat(a + b, state);
      case '-': return allocFloat(a - b, state);
      case '*': return allocFloat(a * b, state);
      case '//':
        if (b === 0) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
        return allocFloat(Math.floor(a / b), state);
      case '%':
        if (b === 0) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
        return allocFloat(a - Math.floor(a / b) * b, state);
      case '**': return allocFloat(a ** b, state);
      default:
        throw new PyException('RuntimeError', `unsupported operator ${op} (line ${line})`);
    }
  }

  // Both are integers (int or bool)
  const isBig =
    typeof left === 'bigint' ||
    typeof right === 'bigint' ||
    (op === '**' && Number(left) >= 2 && Number(right) >= 60);

  if (isBig) {
    const ba = BigInt(left as number | bigint | boolean);
    const bb = BigInt(right as number | bigint | boolean);
    switch (op) {
      case '+': return ba + bb;
      case '-': return ba - bb;
      case '*': return ba * bb;
      case '//': {
        if (bb === 0n) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
        const div = ba / bb;
        const rem = ba % bb;
        return rem !== 0n && (ba < 0n !== bb < 0n) ? div - 1n : div;
      }
      case '%': {
        if (bb === 0n) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
        return ((ba % bb) + bb) % bb;
      }
      case '**': {
        if (bb < 0n) return allocFloat(Number(ba) ** Number(bb), state);
        return ba ** bb;
      }
      default:
        throw new PyException('RuntimeError', `unsupported operator ${op} (line ${line})`);
    }
  }

  switch (op) {
    case '+': {
      const res = a + b;
      return Number.isSafeInteger(res) ? res : BigInt(a) + BigInt(b);
    }
    case '-': {
      const res = a - b;
      return Number.isSafeInteger(res) ? res : BigInt(a) - BigInt(b);
    }
    case '*': {
      const res = a * b;
      return Number.isSafeInteger(res) ? res : BigInt(a) * BigInt(b);
    }
    case '//':
      if (b === 0) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
      return Math.floor(a / b);
    case '%':
      if (b === 0) throw new PyZeroDivisionError(`integer division or modulo by zero (line ${line})`);
      return ((a % b) + b) % b;
    case '**': {
      if (b < 0) return allocFloat(a ** b, state);
      if (b >= 60 && a >= 2) return BigInt(a) ** BigInt(b);
      const res = a ** b;
      return Number.isSafeInteger(res) ? res : BigInt(a) ** BigInt(b);
    }
    default:
      throw new PyException('RuntimeError', `unsupported operator ${op} (line ${line})`);
  }
}

function compareOp(op: string, left: RtValue, right: RtValue, state: MemoryState, line?: number): boolean {
  if (op === 'is') {
    if (left === right) return true;
    if (left === null && right === null) return true;
    if (typeof left === 'number' && typeof right === 'number') {
      if (Number.isInteger(left) && Number.isInteger(right) && left === right && left >= -5 && left <= 256) {
        return true;
      }
    }
    return false;
  }
  if (op === 'is not') {
    return !compareOp('is', left, right, state, line);
  }
  if (op === '==') return valuesEqual(left, right, state);
  if (op === '!=') return !valuesEqual(left, right, state);
  if (op === 'in') {
    const container = state.heap[right as string];
    if (container) {
      if (['list', 'tuple', 'set'].includes(container.type)) {
        return (container.value as RtValue[]).some((v) => valuesEqual(v, left, state));
      }
      if (container.type === 'dict' || container.type === 'defaultdict') {
        const kRepr = dictKeyRepr(left, state, line);
        return (container.value as Array<[string, RtValue]>).some(([k]) => k === kRepr);
      }
      if (container.type === 'range') {
        return rangeContains(container.value as RangeValue, derefNumber(left, state));
      }
      if (container.type === 'str') {
        const needle = typeof left === 'string' && state.heap[left]?.type === 'str'
          ? (state.heap[left].value as string)
          : String(left);
        return (container.value as string).includes(needle);
      }
    }
    if (typeof right === 'string' && typeof left === 'string') return right.includes(left);
    throw new PyTypeError(`argument of type '${typeName(right, state)}' is not iterable${line ? ` (line ${line})` : ''}`);
  }
  if (op === 'not in') {
    return !compareOp('in', left, right, state, line);
  }

  const lt = typeName(left, state);
  const rt = typeName(right, state);

  if (lt === 'str' && rt === 'str') {
    const lv = state.heap[left as string]?.value as string ?? String(left);
    const rv = state.heap[right as string]?.value as string ?? String(right);
    switch (op) {
      case '<': return lv < rv;
      case '<=': return lv <= rv;
      case '>': return lv > rv;
      case '>=': return lv >= rv;
    }
  }

  if (lt === 'list' && rt === 'list') {
    const la = state.heap[left as string].value as RtValue[];
    const ra = state.heap[right as string].value as RtValue[];
    const minLen = Math.min(la.length, ra.length);
    for (let i = 0; i < minLen; i++) {
      if (!valuesEqual(la[i]!, ra[i]!, state)) {
        return compareOp(op, la[i]!, ra[i]!, state, line);
      }
    }
    switch (op) {
      case '<': return la.length < ra.length;
      case '<=': return la.length <= ra.length;
      case '>': return la.length > ra.length;
      case '>=': return la.length >= ra.length;
    }
  }

  if (lt === 'tuple' && rt === 'tuple') {
    const la = state.heap[left as string].value as RtValue[];
    const ra = state.heap[right as string].value as RtValue[];
    const minLen = Math.min(la.length, ra.length);
    for (let i = 0; i < minLen; i++) {
      if (!valuesEqual(la[i]!, ra[i]!, state)) {
        return compareOp(op, la[i]!, ra[i]!, state, line);
      }
    }
    switch (op) {
      case '<': return la.length < ra.length;
      case '<=': return la.length <= ra.length;
      case '>': return la.length > ra.length;
      case '>=': return la.length >= ra.length;
    }
  }

  const isNumType = (t: string) => t === 'int' || t === 'float' || t === 'bool';
  if (isNumType(lt) && isNumType(rt)) {
    const a = derefNumber(left, state);
    const b = derefNumber(right, state);
    switch (op) {
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
    }
  }

  throw new PyTypeError(`'${op}' not supported between instances of '${lt}' and '${rt}'${line ? ` (line ${line})` : ''}`);
}

function subscriptGet(objId: RtValue, index: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new PyTypeError(`object is not subscriptable (line ${line})`);

  if (obj.type === 'dataframe') {
    return frameSubscript(objId as string, index, state, line);
  }
  if (obj.type === 'list' || obj.type === 'tuple') {
    const value = obj.value as RtValue[];
    const i = Number(index);
    const idx = i < 0 ? value.length + i : i;
    if (idx < 0 || idx >= value.length) {
      throw new PyIndexError(`index out of range (line ${line})`);
    }
    return value[idx]!;
  }
  if (obj.type === 'range') {
    return rangeGetItem(obj.value as RangeValue, Number(index));
  }
  if (obj.type === 'ndarray') {
    const v = obj.value as NdarrayValue;
    const i = Number(index);
    const idx = i < 0 ? v.shape + i : i;
    if (idx < 0 || idx >= v.shape) throw new PyIndexError(`index out of range (line ${line})`);
    return (state.heap[v.buffer].value as NumpyBufferValue).data[v.offset + idx]!;
  }
  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    const keyRepr = dictKeyRepr(index, state, line);
    const entries = dictEntries(obj);
    const found = entries.find(([k]) => k === keyRepr);
    if (found) return found[1];
    if (obj.type === 'dict') throw new PyKeyError(String(index));
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
    if (idx < 0 || idx >= s.length) throw new PyIndexError(`string index out of range (line ${line})`);
    return allocString(s[idx]!, state);
  }
  throw new PyTypeError(`'${obj.type}' object is not subscriptable (line ${line})`);
}

function sliceGet(objId: RtValue, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new PyTypeError(`object is not sliceable (line ${line})`);
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
  if (obj.type === 'ndarray') {
    return ndarraySlice(objId as string, start, stop, state, line);
  }
  if (obj.type === 'str') {
    return allocString((obj.value as string).slice(s, e), state);
  }
  throw new PyTypeError(`'${obj.type}' object is not sliceable (line ${line})`);
}

function formatListLike(elts: RtValue[], state: MemoryState, open: string, close: string, seen = new Set<string>()): string {
  return (
    open +
    elts
      .map((e) =>
        typeof e === 'string' && state.heap[e]
          ? formatObject(state.heap[e], state, seen)
          : displayValue(e, state)
      )
      .join(', ') +
    close
  );
}

function formatObject(obj: HeapObject, state: MemoryState, seen = new Set<string>()): string {
  if (seen.has(obj.id)) {
    if (obj.type === 'list') return '[...]';
    if (obj.type === 'dict' || obj.type === 'defaultdict' || obj.type === 'set') return '{...}';
    return '...';
  }
  seen.add(obj.id);
  try {
    if (obj.type === 'list') return formatListLike(obj.value as RtValue[], state, '[', ']', seen);
    if (obj.type === 'tuple') {
      const value = obj.value as RtValue[];
      const body = formatListLike(value, state, '(', ')', seen);
      return value.length === 1 ? `(${displayValue(value[0]!, state)},)` : body;
    }
    if (obj.type === 'set') {
      const elts = [...(obj.value as RtValue[])];
      if (elts.length === 0) return 'set()';
      elts.sort((a, b) => {
        const na = typeof a === 'number' ? a : typeof a === 'bigint' ? Number(a) : NaN;
        const nb = typeof b === 'number' ? b : typeof b === 'bigint' ? Number(b) : NaN;
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return 0;
      });
      return (
        '{' +
        elts
          .map((e) =>
            typeof e === 'string' && state.heap[e]
              ? formatObject(state.heap[e], state, seen)
              : displayValue(e, state)
          )
          .join(', ') +
        '}'
      );
    }
    if (obj.type === 'dict' || obj.type === 'defaultdict') {
      const entries = dictEntries(obj);
      return (
        '{' +
        entries
          .map(([k, v]) => {
            const keyDisp = k.startsWith('str:') ? formatStr(k.slice(4)) : k.startsWith('num:') ? k.slice(4) : k;
            const valDisp = typeof v === 'string' && state.heap[v] ? formatObject(state.heap[v], state, seen) : displayValue(v, state);
            return `${keyDisp}: ${valDisp}`;
          })
          .join(', ') +
        '}'
      );
    }
    if (obj.type === 'str') return formatStr(obj.value as string);
    if (obj.type === 'float') return formatFloat(obj.value as number);
    if (obj.type === 'type') return obj.repr;
    if (obj.type === 'range') return rangeRepr(obj.value as RangeValue);
    return String(obj.repr ?? obj.value);
  } finally {
    seen.delete(obj.id);
  }
}

/**
 * Live repr for a heap object. Containers are recomputed from their current
 * `value` so that a parent reflects a nested child's in-place mutation
 * (e.g. `a[1].append(3)` shows up in `print(a)`); scalars/strings/functions
 * use their stored repr.
 */
export function liveRepr(obj: HeapObject, state: MemoryState): string {
  if (
    obj.type === 'list' ||
    obj.type === 'dict' ||
    obj.type === 'tuple' ||
    obj.type === 'set' ||
    obj.type === 'defaultdict'
  ) {
    return formatObject(obj, state);
  }
  if (obj.type === 'range') return rangeRepr(obj.value as RangeValue);
  if (obj.type === 'float') return formatFloat(obj.value as number);
  return obj.repr;
}

/**
 * Human-facing display of a runtime value (repr-style).
 */
export function displayValue(v: RtValue, state: MemoryState): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'bigint') return v.toString();
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
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'str') return obj.value as string;
    if (obj.type === 'float') return formatFloat(obj.value as number);
    if (obj.type === 'range') return rangeRepr(obj.value as RangeValue);
    return liveRepr(obj, state);
  }
  if (typeof v === 'string') return v;
  return String(v);
}

export { cloneState, createModuleState };
