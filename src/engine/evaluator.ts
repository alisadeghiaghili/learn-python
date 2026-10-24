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
  PyRuntimeError,
  PyStopIteration,
  PySyntaxError,
  PyTypeError,
  PyUnboundLocalError,
  PyValueError,
  PyZeroDivisionError,
  PyReturn,
  PySuspend,
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
import {
  NumpyBufferValue,
  NdarrayValue,
  ndarraySlice,
  refreshNdarrayReprs,
  vecBinaryOp,
  vecInPlaceOp,
  ndarrayGetAttr,
  callNdarrayMethod,
  callNumpyModule,
} from './libs/numpy';
import {
  dataFrameIloc,
  dataFrameSetLoc,
  dataFrameLocRow,
  dataFrameIlocRow,
  dataFrameIlocSet,
  dataFrameGetColumn,
  dataFrameSetColumn,
  refreshPandasReprs,
  pandasGetAttr,
  callPandasMethod,
  callPandasModule,
} from './libs/pandas';
import {
  getActiveCoroutineId,
  makeCoroutine,
  callAsyncioModule,
} from './libs/asyncio';
import {
  ThreadValue,
  threadStart,
  threadJoin,
  lockAcquire,
  lockRelease,
  refreshThreadReprs,
  setActiveThreadId,
  callThreadingModule,
} from './libs/threading';
import {
  pltScatter,
  pltPlot,
  pltShow,
  resetMatplotlib,
  callMatplotlibModule,
} from './libs/matplotlib';
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
    resetMatplotlib();
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
    pltShow(state);
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
  }
  refreshNdarrayReprs(state);
  refreshPandasReprs(state);
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
  'a',
  'threading',
  't',
  'time',
  'matplotlib',
  'matplotlib.pyplot',
  'plt',
  'queue',
  'io',
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
          if (['+', '-', '*', '/'].includes(op) && obj.type === 'ndarray') {
            vecInPlaceOp(current, node.op, rhs, state, node.line);
            return;
          }
        }
        const combined = binOp(op, current, rhs, state, node.line);
        bindTarget(target, combined, state);
        return;
      }
      if (target.kind === 'Subscript' || target.kind === 'Slice') {
        const objVal = evalExpr(target.object, state);
        if (typeof objVal === 'string' && state.heap[objVal]?.type === 'ndarray') {
          vecInPlaceOp(objVal, node.op, rhs, state, node.line);
          return;
        }
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
    case 'With': {
      const lockIds: string[] = [];
      try {
        for (const item of node.items) {
          const ctxVal = evalExpr(item.contextExpr, state);
          if (typeof ctxVal === 'string' && state.heap[ctxVal]?.type === 'lock') {
            lockAcquire(ctxVal, state, node.line);
            lockIds.push(ctxVal);
            if (item.optionalVars && item.optionalVars.kind === 'Name') {
              setFrameLocal(currentFrame(state), item.optionalVars.id, ctxVal);
            }
          }
        }
        execBody(node.body, state);
      } finally {
        for (let i = lockIds.length - 1; i >= 0; i--) {
          lockRelease(lockIds[i]!, state, node.line);
        }
      }
      return;
    }
    case 'Pass':
    case 'Global':
    case 'Nonlocal':
      return;
    default:
      throw new PyException('RuntimeError', `unsupported statement ${node.kind}`);
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

    if (target.attr === 'loc') {
      let rowKey: RtValue = index;
      let colKey = '';
      if (typeof index === 'string' && state.heap[index]?.type === 'tuple') {
        const tupleElts = state.heap[index].value as RtValue[];
        rowKey = tupleElts[0]!;
        colKey = typeof tupleElts[1] === 'string' && state.heap[tupleElts[1]]?.type === 'str'
          ? (state.heap[tupleElts[1]].value as string)
          : String(tupleElts[1]);
      } else if (Array.isArray(index)) {
        rowKey = index[0]!;
        colKey = String(index[1]);
      }
      dataFrameSetLoc(objId as string, rowKey, colKey, value, state, line);
      return;
    }
    if (target.attr === 'iloc') {
      dataFrameIlocSet(objId as string, index as RtValue, value, state, line);
      return;
    }
    if (obj.type === 'dataframe') {
      dataFrameSetColumn(objId as string, index as RtValue, value, state, line);
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
  if (target.kind === 'Slice') {
    const objId = evalExpr(target.object, state);
    const obj = state.heap[objId as string];
    if (obj && obj.type === 'ndarray') {
      const v = obj.value as NdarrayValue;
      const s = target.start ? Number(evalExpr(target.start, state)) : 0;
      const e = target.stop ? Number(evalExpr(target.stop, state)) : (typeof v.shape === 'number' ? v.shape : v.shape[0]!);
      const bufData = (state.heap[v.buffer].value as NumpyBufferValue).data;
      const numVal = Number(value);
      for (let i = s; i < e; i++) {
        bufData[v.offset + i] = numVal;
      }
      refreshNdarrayReprs(state);
      return;
    }
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
      if (node.attr === 'loc') return dataFrameLocRow(objId as string, index, state, node.line);
      if (node.attr === 'iloc') return dataFrameIlocRow(objId as string, index, state, node.line);
      return subscriptGet(objId, index, state, node.line);
    }
    case 'Slice': {
      const objId = evalExpr(node.object, state);
      const start = node.start ? evalExpr(node.start, state) : null;
      const stop = node.stop ? evalExpr(node.stop, state) : null;
      const step = node.step ? evalExpr(node.step, state) : null;
      if (node.attr === 'iloc') return dataFrameIloc(objId as string, start, stop, state, node.line);
      return sliceGet(objId, start, stop, step, state, node.line);
    }
    case 'Attribute': {
      const objVal = evalExpr(node.object, state);
      if (objVal === null) {
        throw new PyAttributeError(`'NoneType' object has no attribute '${node.attr}' (line ${node.line})`);
      }
      if (typeof objVal === 'string' && state.heap[objVal]) {
        const obj = state.heap[objVal];
        if (obj.type === 'ndarray') {
          return ndarrayGetAttr(objVal, node.attr, state, node.line);
        }
        if (obj.type === 'dataframe' || obj.type === 'series') {
          return pandasGetAttr(objVal, node.attr, state, node.line);
        }
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
      if (getActiveCoroutineId()) {
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
  const kwargs: Record<string, RtValue> = {};
  if (node.keywords) {
    for (const kw of node.keywords) {
      kwargs[kw.arg] = evalExpr(kw.value, state);
    }
  }

  if (node.func.kind === 'Name') {
    const name = node.func.id;
    if (name === 'scatter') {
      return pltScatter(args, state, node.line, true);
    }
    if (name === 'line') {
      return pltPlot(args, state, node.line, true);
    }
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
    const fnId = lookupName(name, state, node.line);
    return callUserFunction(fnId, args, state, node.line, kwargs);
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
    return callMethod(objVal, method, args, state, node.line, kwargs);
  }

  const fnVal = evalExpr(node.func, state);
  return callUserFunction(fnVal, args, state, node.line, kwargs);
}

/**
 * Call a user-defined function (heap function object).
 */
function callUserFunction(
  fnId: RtValue,
  args: RtValue[],
  state: MemoryState,
  line: number,
  kwargs?: Record<string, RtValue>
): RtValue {
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
    } else if (kwargs && p in kwargs) {
      frame.locals[p] = kwargs[p]!;
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
      return err.value as RtValue;
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
function callMethod(
  objId: RtValue,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  kwargs?: Record<string, RtValue>
): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new PyAttributeError(`bad method target (line ${line})`);

  if (obj.type === 'module') {
    const modName = (obj.value as { name: string }).name;
    if (modName === 'numpy' || modName === 'np') {
      return callNumpyModule(method, args, kwargs, state, line);
    }
    if (modName === 'pandas' || modName === 'pd') {
      return callPandasModule(method, args, kwargs, state, line);
    }
    if (modName === 'asyncio' || modName === 'a') {
      return callAsyncioModule(method, args, state, line, typeName, execStatement);
    }
    if (modName === 'threading' || modName === 't') {
      return callThreadingModule(method, args, kwargs, state, line, typeName);
    }
    if (modName === 'matplotlib' || modName === 'matplotlib.pyplot' || modName === 'plt') {
      return callMatplotlibModule(method, args, state, line);
    }
    if (modName === 'time') {
      if (method === 'sleep') return null;
      throw new PyAttributeError(`module 'time' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'collections') {
      if (method === 'defaultdict') return makeDefaultdict(args, state, line);
      throw new PyAttributeError(`module 'collections' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'functools') {
      if (method === 'reduce') return reduce(args, state, line);
      throw new PyAttributeError(`module 'functools' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'copy') {
      if (args.length !== 1) throw new PyTypeError(`copy() takes exactly one argument (line ${line})`);
      if (method === 'copy') return shallowClone(args[0], state, line);
      if (method === 'deepcopy') return deepClone(args[0], state, line);
      throw new PyAttributeError(`module 'copy' has no attribute '${method}' (line ${line})`);
    }
    throw new PyAttributeError(`module '${modName}' has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'thread') {
    if (method === 'start') {
      threadStart(objId as string, state, line);
      return null;
    }
    if (method === 'join') {
      threadJoin(objId as string, state, line, stepThread);
      return null;
    }
    throw new PyAttributeError(`'thread' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'lock') {
    if (method === 'acquire') return lockAcquire(objId as string, state, line);
    if (method === 'release') return lockRelease(objId as string, state, line);
    throw new PyAttributeError(`'lock' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'ndarray') {
    return callNdarrayMethod(objId as string, method, args, state, line);
  }

  if (obj.type === 'series' || obj.type === 'dataframe') {
    return callPandasMethod(objId as string, method, args, kwargs, state, line);
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
 * Step one thread by exactly ONE statement, updating thread status and frames.
 */
function stepThread(threadId: string, state: MemoryState): void {
  const th = state.heap[threadId]?.value as ThreadValue | undefined;
  if (!th || th.pc >= th.body.length) {
    if (th) th.status = 'done';
    return;
  }
  const frame: Frame = { name: `thread:${th.name}`, locals: {} };
  for (const [k, v] of Object.entries(th.locals)) frame.locals[k] = v as RtValue;
  state.frames.push(frame);
  setActiveThreadId(threadId);
  try {
    try {
      execStatement(th.body[th.pc]!, state);
    } catch (err) {
      if (err instanceof PySuspend) {
        th.blocked = true;
        th.status = 'blocked';
        return;
      }
      if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'PyReturn') {
        th.returnValue = (err as any).value;
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
    setActiveThreadId(null);
    refreshThreadReprs(state);
    refreshReprs(state);
    pltShow(state);
  }
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
    throw new PyTypeError(`argument of type '${typeName(v, state)}' is not an iterator (line ${line})`);
  }
  const obj = state.heap[v];
  // map/filter iterators delegate to their source and apply the function.
  if (isMapFilterValue(obj.value)) {
    return stepMapFilter(v, state, line);
  }
  const itv = obj.value as IteratorValue;
  const src = state.heap[itv.source];
  if (!src) throw new PyRuntimeError(`iterator source was released (line ${line})`);
  const len = src.type === 'str' ? (src.value as string).length : (src.value as RtValue[]).length;
  if (itv.index >= len) {
    throw new PyStopIteration();
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

/* ————————————————— libraries (numpy, pandas, asyncio, threading, matplotlib) are in ./libs/ ————————————————— */






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
    if (obj.type === 'ndarray') {
      const sh = (obj.value as NdarrayValue).shape;
      return typeof sh === 'number' ? sh : sh[0]!;
    }
    if (obj.type === 'str') return Array.from(obj.value as string).length;
    if (obj.type === 'range') return rangeLength(obj.value as RangeValue);
  }
  if (typeof v === 'string') return Array.from(v).length;
  throw new PyTypeError(`object has no len()`);
}

function binOp(op: string, left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  const lt = typeName(left, state);
  const rt = typeName(right, state);

  // vectorized ndarray operations (+, -, *, /) with broadcasting
  if (['+', '-', '*', '/'].includes(op) && (lt === 'ndarray' || rt === 'ndarray')) {
    return vecBinaryOp(left, op as any, right, state, line);
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
    return dataFrameGetColumn(objId as string, index, state, line);
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
    const len = typeof v.shape === 'number' ? v.shape : v.shape[0]!;
    const i = Number(index);
    const idx = i < 0 ? len + i : i;
    if (idx < 0 || idx >= len) throw new PyIndexError(`index out of range (line ${line})`);
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

function sliceGet(
  objId: RtValue,
  start: RtValue,
  stop: RtValue,
  step: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new PyTypeError(`object is not sliceable (line ${line})`);
  let len = 0;
  if (obj.type === 'str') {
    len = (obj.value as string).length;
  } else if (obj.type === 'ndarray') {
    const sh = (obj.value as NdarrayValue).shape;
    len = typeof sh === 'number' ? sh : sh[0]!;
  } else if (Array.isArray(obj.value)) {
    len = (obj.value as RtValue[]).length;
  }
  const s = start === null ? 0 : Number(start);
  const e = stop === null ? len : Number(stop);
  const st = step === null ? 1 : Number(step);

  if (obj.type === 'list' || obj.type === 'tuple') {
    const raw = obj.value as RtValue[];
    let elts: RtValue[] = [];
    if (st === 1) {
      elts = raw.slice(s, e);
    } else if (st === -1) {
      const startIdx = start === null ? raw.length - 1 : Number(start);
      const stopIdx = stop === null ? -1 : Number(stop);
      for (let i = startIdx; i > stopIdx; i--) elts.push(raw[i]!);
    } else if (st > 0) {
      for (let i = s; i < e; i += st) elts.push(raw[i]!);
    }
    const out = allocObject(obj.type, elts, '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }
  if (obj.type === 'ndarray') {
    return ndarraySlice(objId as string, start, stop, step, state, line);
  }
  if (obj.type === 'dataframe') {
    return dataFrameIloc(objId as string, start, stop, state, line);
  }
  if (obj.type === 'str') {
    const sStr = obj.value as string;
    if (st === 1) return allocString(sStr.slice(s, e), state);
    let res = '';
    if (st === -1) {
      const startIdx = start === null ? sStr.length - 1 : Number(start);
      const stopIdx = stop === null ? -1 : Number(stop);
      for (let i = startIdx; i > stopIdx; i--) res += sStr[i]!;
    } else if (st > 0) {
      for (let i = s; i < e; i += st) res += sStr[i]!;
    }
    return allocString(res, state);
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
