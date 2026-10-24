/**
 * Evaluator for learn-python's Python runtime.
 *
 * Coordinates execution against memory state (frames + heap) and records stdout / errors.
 */

import { allocObject, cloneState, computeRefCounts, createModuleState } from './memory';
import { parse } from './parser';
import {
  allocString,
  derefNumber,
  dictEntries,
  dictKeyMatch,
  dictKeyRepr,
  displayValue,
  findIndexOfValue,
  formatObject,
  lengthOf,
  liveRepr,
  printArg,
  truthy,
  typeName,
  valuesEqual,
} from './common';
import { PyBreak, PyContinue, PyReturn, PySuspend } from './signals';
import {
  dispatchNumpyModule,
  ndarraySlice,
  ndarrayWindow,
  numpyRepr,
  refreshNdarrayReprs,
  vecAdd,
  type NdarrayValue,
  type NumpyBufferValue,
} from './libs/numpy';
import {
  dispatchPandasModule,
  frameIlocRow,
  frameIlocSet,
  frameIlocSlice,
  frameLocRow,
  frameSetColumn,
  frameSubscript,
} from './libs/pandas';
import { dispatchAsyncioModule, getActiveCoroutineId, makeCoroutine } from './libs/asyncio';
import {
  dispatchThreadingModule,
} from './libs/threading';
import { dispatchMathFunction, MATH_CONSTANTS } from './libs/math';
import { dispatchObjectMethod } from './methods/index';
import {
  allocFloat,
  dispatchBuiltin,
  type RangeValue,
} from './builtins/index';
import type {
  AstNode,
  Frame,
  FunctionCode,
  MemoryState,
  RtValue,
} from './types';

export { cloneState, createModuleState, displayValue, liveRepr };

/**
 * Evaluate a source chunk against (and mutating) `state`.
 *
 * @throws {Error} on parse or runtime errors (also pushed to state.errors)
 */
export function run(source: string, state: MemoryState): MemoryState {
  try {
    if (traceEnabled) state.trace = [cloneState(state)];
    const ast = parse(source);
    for (const stmt of ast) {
      if (stmt.kind === 'ExprStatement') {
        const result = evalExpr(stmt.expr, state);
        if (result !== null) state.stdout.push(displayValue(result, state));
      } else {
        execStatement(stmt, state);
      }
      recordStep(state);
    }
    refreshReprs(state);
    computeRefCounts(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.errors.push(message);
    throw err;
  }
  return state;
}

/**
 * Recompute cached reprs of containers and library objects.
 */
function refreshReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'tuple' || obj.type === 'set' || obj.type === 'defaultdict') {
      obj.repr = formatObject(obj, state);
    }
    if (obj.type === 'ndarray') {
      obj.repr = numpyRepr(ndarrayWindow(obj.id, state));
    }
  }
}

/**
 * Create an empty module state and run source.
 */
export function runFresh(source = ''): MemoryState {
  const state = createModuleState();
  if (source) run(source, state);
  return state;
}

const TRACE_CAP = 60;
let traceEnabled = false;

export function setTraceEnabled(on: boolean): void {
  traceEnabled = on;
}

export function isTraceEnabled(): boolean {
  return traceEnabled;
}

function recordStep(state: MemoryState): void {
  if (!traceEnabled || !state.trace) return;
  if (state.trace.length >= TRACE_CAP) return;
  state.trace.push(cloneState(state));
}

function execBody(body: AstNode[], state: MemoryState): void {
  for (const s of body) {
    execStatement(s, state);
    recordStep(state);
  }
}

function currentFrame(state: MemoryState): Frame {
  return state.frames[state.frames.length - 1]!;
}

function setFrameLocal(frame: Frame, name: string, value: RtValue): void {
  frame.locals[name] = value;
}

/**
 * Scan AST of function body to determine all compile-time local variables.
 */
function collectCompileTimeLocals(body: AstNode[]): Set<string> {
  const locals = new Set<string>();
  const globals = new Set<string>();
  const nonlocals = new Set<string>();

  function walk(nodes: AstNode[]): void {
    for (const node of nodes) {
      if (node.kind === 'Global') {
        node.names.forEach((n) => globals.add(n));
      } else if (node.kind === 'Nonlocal') {
        node.names.forEach((n) => nonlocals.add(n));
      } else if (node.kind === 'Assign') {
        if (node.target.kind === 'Name') locals.add(node.target.id);
      } else if (node.kind === 'AugAssign') {
        if (node.target.kind === 'Name') locals.add(node.target.id);
      } else if (node.kind === 'For') {
        locals.add(node.target);
        walk(node.body);
        if (node.elseBody) walk(node.elseBody);
      } else if (node.kind === 'If') {
        walk(node.body);
        node.elifs.forEach((b) => walk(b.body));
        if (node.elseBody) walk(node.elseBody);
      } else if (node.kind === 'While') {
        walk(node.body);
        if (node.elseBody) walk(node.elseBody);
      }
    }
  }

  walk(body);
  for (const g of globals) locals.delete(g);
  for (const nl of nonlocals) locals.delete(nl);
  return locals;
}

const BUILTIN_NAMES = new Set([
  'print', 'len', 'type', 'id', 'int', 'float', 'str', 'bool',
  'list', 'dict', 'tuple', 'set', 'range', 'iter', 'next',
  'abs', 'min', 'max', 'sum', 'sorted', 'map', 'filter',
  'isinstance', 'scatter', 'line',
]);

/**
 * Look up a variable name using Python's LEGB rule with compile-time local detection.
 */
function lookupName(name: string, state: MemoryState, line: number): RtValue {
  const frame = currentFrame(state);

  if (frame.name !== '<module>') {
    if (frame.functionCode?.compileTimeLocals?.has(name)) {
      if (frame.locals[name] === undefined) {
        throw new Error(`UnboundLocalError: cannot access local variable '${name}' where it is not associated with a value`);
      }
      return frame.locals[name];
    }
    if (frame.nonlocalNames?.has(name)) {
      for (let i = state.frames.length - 2; i > 0; i--) {
        if (state.frames[i].locals[name] !== undefined) {
          return state.frames[i].locals[name];
        }
      }
      if (frame.closureFrames) {
        for (let i = frame.closureFrames.length - 1; i > 0; i--) {
          if (frame.closureFrames[i].locals[name] !== undefined) {
            return frame.closureFrames[i].locals[name];
          }
        }
      }
      throw new Error(`SyntaxError: no binding for nonlocal '${name}' found`);
    }
    if (frame.globalNames?.has(name)) {
      if (state.frames[0].locals[name] !== undefined) {
        return state.frames[0].locals[name];
      }
      throw new Error(`NameError: name '${name}' is not defined (line ${line})`);
    }
  }

  // 1. Local frame
  if (frame.locals[name] !== undefined) return frame.locals[name];

  // 2. Enclosing frames in call stack
  for (let i = state.frames.length - 2; i >= 0; i--) {
    if (state.frames[i].locals[name] !== undefined) {
      return state.frames[i].locals[name];
    }
  }

  // 3. Lexical closure frames
  if (frame.closureFrames) {
    for (let i = frame.closureFrames.length - 1; i >= 0; i--) {
      if (frame.closureFrames[i].locals[name] !== undefined) {
        return frame.closureFrames[i].locals[name];
      }
    }
  }

  // 3. Module frame
  if (state.frames[0].locals[name] !== undefined) {
    return state.frames[0].locals[name];
  }

  // 4. Built-in
  const heapBuiltin = Object.values(state.heap).find(
    (o) => o.type === 'builtin' && (o.value as string) === name,
  );
  if (heapBuiltin) return heapBuiltin.id;

  if (BUILTIN_NAMES.has(name)) {
    const obj = allocObject('builtin', name, `<built-in function ${name}>`);
    state.heap[obj.id] = obj;
    return obj.id;
  }

  throw new Error(`NameError: name '${name}' is not defined (line ${line})`);
}

/**
 * Bind assignment target to runtime value.
 */
function bindTarget(target: AstNode, value: RtValue, state: MemoryState): void {
  if (target.kind === 'Name') {
    const frame = currentFrame(state);
    if (frame.globalNames?.has(target.id)) {
      setFrameLocal(state.frames[0], target.id, value);
      return;
    }
    if (frame.nonlocalNames?.has(target.id)) {
      for (let i = state.frames.length - 2; i > 0; i--) {
        if (state.frames[i].locals[target.id] !== undefined) {
          setFrameLocal(state.frames[i], target.id, value);
          return;
        }
      }
      if (frame.closureFrames) {
        for (let i = frame.closureFrames.length - 1; i > 0; i--) {
          if (frame.closureFrames[i].locals[target.id] !== undefined) {
            setFrameLocal(frame.closureFrames[i], target.id, value);
            return;
          }
        }
      }
      throw new Error(`SyntaxError: no binding for nonlocal '${target.id}' found`);
    }
    setFrameLocal(frame, target.id, value);
    return;
  }
  if (target.kind === 'Subscript') {
    const objId = evalExpr(target.object, state);
    const index = target.index ? evalExpr(target.index, state) : null;
    const obj = state.heap[objId as string];
    if (!obj) throw new Error('TypeError: cannot subscript immutable value');
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
      const i = Number(index);
      const idx = i < 0 ? elts.length + i : i;
      if (idx < 0 || idx >= elts.length) {
        throw new Error('IndexError: list assignment index out of range');
      }
      elts[idx] = value;
      obj.repr = formatObject(obj, state);
      return;
    }
    if (obj.type === 'ndarray') {
      const v = obj.value as NdarrayValue;
      const n = Number(value);
      if (Number.isNaN(n)) throw new Error('TypeError: cannot assign non-number to ndarray');
      const i = Number(index);
      const idx = i < 0 ? v.shape + i : i;
      if (idx < 0 || idx >= v.shape) throw new Error('IndexError: index out of range');
      const data = (state.heap[v.buffer].value as NumpyBufferValue).data;
      data[v.offset + idx] = n;
      refreshNdarrayReprs(state);
      return;
    }
    if (obj.type === 'dict' || obj.type === 'defaultdict') {
      const keyRepr = dictKeyRepr(index, state);
      const entries = dictEntries(obj);
      const existing = entries.find(([k, , ok]) => dictKeyMatch(k, ok, index, keyRepr, state));
      if (existing) existing[1] = value;
      else entries.push([keyRepr, value, index]);
      obj.repr = formatObject(obj, state);
      return;
    }
    throw new Error(`TypeError: '${obj.type}' object does not support item assignment`);
  }
  throw new Error(`SyntaxError: cannot assign to ${target.kind}`);
}

function readTarget(target: AstNode, state: MemoryState): RtValue {
  return evalExpr(target, state);
}

/**
 * Execute a statement AST node.
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

      if (typeof current === 'string' && state.heap[current]?.type === 'list') {
        const obj = state.heap[current];
        const list = obj.value as RtValue[];
        if (node.op === '+=') {
          if (typeof rhs === 'string' && state.heap[rhs]) {
            const rObj = state.heap[rhs];
            if (['list', 'tuple', 'set'].includes(rObj.type)) {
              list.push(...(rObj.value as RtValue[]));
            } else if (rObj.type === 'str') {
              for (const ch of rObj.value as string) list.push(allocString(ch, state));
            } else if (rObj.type === 'range') {
              const rv = rObj.value as RangeValue;
              for (let i = rv.start; rv.step > 0 ? i < rv.stop : i > rv.stop; i += rv.step) {
                list.push(i);
              }
            }
          } else if (typeof rhs === 'string') {
            for (const ch of rhs) list.push(allocString(ch, state));
          } else if (Array.isArray(rhs)) {
            list.push(...rhs);
          } else {
            throw new Error(`TypeError: '${typeName(rhs, state)}' object is not iterable`);
          }
          obj.repr = formatObject(obj, state);
          return;
        }
        if (node.op === '*=') {
          const n = Number(rhs);
          if (Number.isNaN(n)) throw new Error(`TypeError: can't multiply sequence by non-int of type '${typeName(rhs, state)}'`);
          const orig = [...list];
          list.length = 0;
          for (let i = 0; i < n; i++) list.push(...orig);
          obj.repr = formatObject(obj, state);
          return;
        }
      }

      if (typeof current === 'string' && state.heap[current]?.type === 'ndarray') {
        const obj = state.heap[current];
        const v = obj.value as NdarrayValue;
        const b = Number(rhs);
        if (Number.isNaN(b)) throw new Error(`TypeError: cannot operate with ${typeName(rhs, state)} on ndarray`);
        const data = (state.heap[v.buffer].value as NumpyBufferValue).data;
        for (let i = 0; i < v.shape; i++) {
          if (node.op === '+=') data[v.offset + i] += b;
          else if (node.op === '-=') data[v.offset + i] -= b;
          else if (node.op === '*=') data[v.offset + i] *= b;
          else if (node.op === '/=') data[v.offset + i] /= b;
        }
        refreshNdarrayReprs(state);
        return;
      }

      const opSymbol = node.op.replace('=', '');
      const combined = binOp(opSymbol, current, rhs, state, node.line);
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
      const evaluatedDefaults: Record<string, RtValue> = {};
      if (node.defaults) {
        for (const [pName, defExpr] of Object.entries(node.defaults)) {
          evaluatedDefaults[pName] = evalExpr(defExpr, state);
        }
      }
      const compileTimeLocals = collectCompileTimeLocals(node.body);
      node.params.forEach((p) => compileTimeLocals.add(p));

      const fn = allocObject('function', {
        name: node.name,
        params: [...node.params],
        defaults: evaluatedDefaults,
        compileTimeLocals,
        body: node.body,
        closureFrames: [...state.frames],
      } as FunctionCode, `function ${node.name}`);
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'CoroutineDef': {
      const fn = allocObject('function', {
        name: node.name,
        params: [...node.params],
        body: node.body,
        async: true,
        closureFrames: [...state.frames],
      } as FunctionCode, `async function ${node.name}`);
      setFrameLocal(currentFrame(state), node.name, fn.id);
      state.heap[fn.id] = fn;
      return;
    }
    case 'Global': {
      const frame = currentFrame(state);
      if (!frame.globalNames) frame.globalNames = new Set();
      node.names.forEach((n) => frame.globalNames!.add(n));
      return;
    }
    case 'Nonlocal': {
      const frame = currentFrame(state);
      if (!frame.nonlocalNames) frame.nonlocalNames = new Set();
      node.names.forEach((n) => frame.nonlocalNames!.add(n));
      return;
    }
    case 'Import': {
      const KNOWN_MODULES = new Set([
        'math', 'numpy', 'pandas', 'asyncio', 'threading', 'copy',
        'collections', 'functools', 'time', 'json', 'random', 'itertools', 'sys',
      ]);
      const modBase = node.name.split('.')[0];
      if (!KNOWN_MODULES.has(modBase)) {
        throw new Error(`ModuleNotFoundError: No module named '${node.name}'`);
      }
      const mod = allocObject('module', { name: node.name }, `<module '${node.name}'>`);
      state.heap[mod.id] = mod;
      const localName = node.alias ?? modBase;
      setFrameLocal(currentFrame(state), localName, mod.id);
      return;
    }
    case 'ImportFrom': {
      const KNOWN_MODULES = new Set([
        'math', 'numpy', 'pandas', 'asyncio', 'threading', 'copy',
        'collections', 'functools', 'time', 'json', 'random', 'itertools', 'sys',
      ]);
      const modBase = node.module.split('.')[0];
      if (!KNOWN_MODULES.has(modBase)) {
        throw new Error(`ModuleNotFoundError: No module named '${node.module}'`);
      }
      for (const item of node.names) {
        const localName = item.alias ?? item.name;
        if (node.module === 'math') {
          if (MATH_CONSTANTS[item.name] !== undefined) {
            setFrameLocal(currentFrame(state), localName, allocFloat(MATH_CONSTANTS[item.name]!, state));
          } else {
            const fnObj = allocObject('builtin', `math.${item.name}`, `<built-in function ${item.name}>`);
            state.heap[fnObj.id] = fnObj;
            setFrameLocal(currentFrame(state), localName, fnObj.id);
          }
        } else {
          const fnObj = allocObject('builtin', `${node.module}.${item.name}`, `<built-in function ${item.name}>`);
          state.heap[fnObj.id] = fnObj;
          setFrameLocal(currentFrame(state), localName, fnObj.id);
        }
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
      const iterableVal = evalExpr(node.iterable, state);
      let broke = false;

      if (typeof iterableVal === 'string' && state.heap[iterableVal]?.type === 'range') {
        const rv = state.heap[iterableVal].value as RangeValue;
        for (let i = rv.start; rv.step > 0 ? i < rv.stop : i > rv.stop; i += rv.step) {
          setFrameLocal(currentFrame(state), node.target, i);
          try {
            execBody(node.body, state);
          } catch (e) {
            if (e instanceof PyBreak) {
              broke = true;
              break;
            }
            if (e instanceof PyContinue) {
              recordStep(state);
              continue;
            }
            throw e;
          }
          recordStep(state);
        }
      } else if (typeof iterableVal === 'string' && state.heap[iterableVal]?.type === 'list') {
        const listObj = state.heap[iterableVal];
        const arr = listObj.value as RtValue[];
        for (let i = 0; i < arr.length; i++) {
          setFrameLocal(currentFrame(state), node.target, arr[i]!);
          try {
            execBody(node.body, state);
          } catch (e) {
            if (e instanceof PyBreak) {
              broke = true;
              break;
            }
            if (e instanceof PyContinue) {
              recordStep(state);
              continue;
            }
            throw e;
          }
          recordStep(state);
        }
      } else {
        const items = iterableToRtValues(iterableVal, state, node.line);
        for (let i = 0; i < items.length; i++) {
          setFrameLocal(currentFrame(state), node.target, items[i]!);
          try {
            execBody(node.body, state);
          } catch (e) {
            if (e instanceof PyBreak) {
              broke = true;
              break;
            }
            if (e instanceof PyContinue) {
              recordStep(state);
              continue;
            }
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
        if (++guard > 100000) throw new Error('RuntimeError: while loop did not terminate (infinite loop)');
        try {
          execBody(node.body, state);
        } catch (e) {
          if (e instanceof PyBreak) {
            broke = true;
            break;
          }
          if (e instanceof PyContinue) {
            recordStep(state);
            continue;
          }
          throw e;
        }
        recordStep(state);
      }
      if (!broke && node.elseBody) {
        execBody(node.elseBody, state);
      }
      return;
    }
    case 'Break':
      throw new PyBreak();
    case 'Continue':
      throw new PyContinue();
    case 'Pass':
      return;
    default:
      throw new Error(`RuntimeError: unsupported statement ${(node as AstNode).kind}`);
  }
}

function iterableToRtValues(v: RtValue, state: MemoryState, line: number): RtValue[] {
  if (typeof v !== 'string') {
    throw new Error(`TypeError: '${typeName(v, state)}' object is not iterable (line ${line})`);
  }
  const obj = state.heap[v];
  if (!obj) {
    const s = v as string;
    const out: RtValue[] = [];
    for (const ch of s) out.push(allocString(ch, state));
    return out;
  }
  if (obj.type === 'str') {
    const s = obj.value as string;
    const out: RtValue[] = [];
    for (const ch of s) out.push(allocString(ch, state));
    return out;
  }
  if (['list', 'tuple', 'set'].includes(obj.type)) {
    return [...(obj.value as RtValue[])];
  }
  if (obj.type === 'range') {
    const rv = obj.value as RangeValue;
    const out: RtValue[] = [];
    for (let i = rv.start; rv.step > 0 ? i < rv.stop : i > rv.stop; i += rv.step) {
      out.push(i);
    }
    return out;
  }
  throw new Error(`TypeError: '${obj.type}' object is not iterable (line ${line})`);
}

/**
 * Evaluate an expression AST node.
 */
function evalExpr(node: AstNode, state: MemoryState): RtValue {
  switch (node.kind) {
    case 'Literal': {
      if (node.isFloat) {
        return allocFloat(Number(node.value), state);
      }
      if (typeof node.value === 'string') {
        return allocString(node.value, state);
      }
      return node.value;
    }
    case 'Name':
      return lookupName(node.id, state, node.line);
    case 'List': {
      const elts = node.elts.map((e) => evalExpr(e, state));
      const obj = allocObject('list', elts, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Tuple': {
      const elts = node.elts.map((e) => evalExpr(e, state));
      const obj = allocObject('tuple', elts, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Dict': {
      const entries: Array<[string, RtValue, RtValue?]> = [];
      for (let i = 0; i < node.keys.length; i++) {
        const k = evalExpr(node.keys[i]!, state);
        const v = evalExpr(node.values[i]!, state);
        const keyRepr = dictKeyRepr(k, state);
        const existing = entries.find(([ek, , ok]) => dictKeyMatch(ek, ok, k, keyRepr, state));
        if (existing) existing[1] = v;
        else entries.push([keyRepr, v, k]);
      }
      const obj = allocObject('dict', entries, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'Set': {
      const elts: RtValue[] = [];
      for (const e of node.elts) {
        const v = evalExpr(e, state);
        dictKeyRepr(v, state);
        if (findIndexOfValue(elts, v, state) < 0) {
          elts.push(v);
        }
      }
      const obj = allocObject('set', elts, '');
      state.heap[obj.id] = obj;
      obj.repr = formatObject(obj, state);
      return obj.id;
    }
    case 'BinOp':
      return binOp(node.op, evalExpr(node.left, state), evalExpr(node.right, state), state, node.line);
    case 'UnaryOp': {
      const v = evalExpr(node.operand, state);
      if (node.op === '-') {
        const t = typeName(v, state);
        if (t !== 'int' && t !== 'float') {
          throw new Error(`TypeError: bad operand type for unary -: '${t}'`);
        }
        if (typeof v === 'bigint') return -v;
        const n = derefNumber(v, state);
        if (typeof v === 'string' && state.heap[v]?.type === 'float') {
          return allocFloat(-n, state);
        }
        return -n;
      }
      if (node.op === '+') {
        return derefNumber(v, state);
      }
      if (node.op === 'not') {
        return !truthy(v, state);
      }
      throw new Error(`RuntimeError: unsupported unary op ${node.op}`);
    }
    case 'BoolOp': {
      const left = evalExpr(node.left, state);
      if (node.op === 'and') {
        return truthy(left, state) ? evalExpr(node.right, state) : left;
      }
      return truthy(left, state) ? left : evalExpr(node.right, state);
    }
    case 'Compare': {
      if (node.left.kind === 'Compare') {
        const leftRes = evalExpr(node.left, state);
        if (!truthy(leftRes, state)) return false;
        const middle = evalExpr(node.left.right, state);
        const right = evalExpr(node.right, state);
        return compareOp(node.op, middle, right, state);
      }
      return compareOp(node.op, evalExpr(node.left, state), evalExpr(node.right, state), state);
    }
    case 'Subscript': {
      const objId = evalExpr(node.object, state);
      if (node.attr === 'loc') {
        const key = node.index ? evalExpr(node.index, state) : null;
        return frameLocRow(objId as string, key, state, node.line);
      }
      if (node.attr === 'iloc') {
        const key = node.index ? evalExpr(node.index, state) : null;
        return frameIlocRow(objId as string, key, state, node.line);
      }
      const index = node.index ? evalExpr(node.index, state) : null;
      return subscriptGet(objId, index, state, node.line);
    }
    case 'Slice': {
      const objId = evalExpr(node.object, state);
      const start = node.start ? evalExpr(node.start, state) : null;
      const stop = node.stop ? evalExpr(node.stop, state) : null;
      if (node.attr === 'iloc') {
        return frameIlocSlice(objId as string, start, stop, state, node.line);
      }
      return sliceGet(objId, start, stop, state, node.line);
    }
    case 'Attribute': {
      const objVal = evalExpr(node.object, state);
      if (objVal === null) {
        throw new Error(`AttributeError: 'NoneType' object has no attribute '${node.attr}'`);
      }
      if (typeof objVal === 'string' && state.heap[objVal]) {
        const obj = state.heap[objVal];
        if (obj.type === 'module') {
          const modName = (obj.value as { name: string }).name;
          if (modName === 'math' && MATH_CONSTANTS[node.attr] !== undefined) {
            return allocFloat(MATH_CONSTANTS[node.attr]!, state);
          }
        }
        if (obj.type === 'range') {
          const rv = obj.value as RangeValue;
          if (node.attr === 'start') return rv.start;
          if (node.attr === 'stop') return rv.stop;
          if (node.attr === 'step') return rv.step;
          throw new Error(`AttributeError: 'range' object has no attribute '${node.attr}'`);
        }
      }
      return objVal;
    }
    case 'Call':
      return evalCall(node, state);
    case 'Await': {
      if (getActiveCoroutineId()) {
        throw new PySuspend();
      }
      return evalExpr(node.value, state);
    }
    default:
      throw new Error(`RuntimeError: unsupported expression ${(node as AstNode).kind}`);
  }
}

/**
 * Evaluate a function call node.
 */
function evalCall(node: Extract<AstNode, { kind: 'Call' }>, state: MemoryState): RtValue {
  const args = node.args.map((a) => evalExpr(a, state));

  if (node.func.kind === 'Name') {
    const name = node.func.id;

    // First check if locally defined or shadowed in frame
    const frame = currentFrame(state);
    if (frame.locals[name] !== undefined || (frame.name !== '<module>' && frame.functionCode?.compileTimeLocals?.has(name))) {
      const fnId = lookupName(name, state, node.line);
      return callUserFunction(fnId, args, state, node.line);
    }

    const builtinResult = dispatchBuiltin(name, args, state, node.line, {
      makeIterator,
      nextIterator,
      makeMapFilter,
      reduce,
    });
    if (builtinResult.handled) {
      return builtinResult.result;
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
 * Call a user-defined function.
 */
function callUserFunction(fnId: RtValue, args: RtValue[], state: MemoryState, line: number): RtValue {
  if (state.frames.length >= 100) {
    throw new Error('RecursionError: maximum recursion depth exceeded');
  }
  const fn = typeof fnId === 'string' ? state.heap[fnId] : undefined;
  if (!fn) {
    throw new Error(`TypeError: '${typeName(fnId, state)}' object is not callable (line ${line})`);
  }

  if (fn.type === 'builtin') {
    const b = fn.value as string;
    if (b.startsWith('math.')) {
      return dispatchMathFunction(b.slice(5), args, state, line);
    }
    const res = dispatchBuiltin(b, args, state, line, {
      makeIterator,
      nextIterator,
      makeMapFilter,
      reduce,
    });
    if (res.handled) return res.result;
    throw new Error(`TypeError: builtin '${b}' is not callable (line ${line})`);
  }

  if (fn.type !== 'function') {
    throw new Error(`TypeError: '${typeName(fnId, state)}' object is not callable (line ${line})`);
  }

  const code = fn.value as FunctionCode;
  if (code.async) {
    return makeCoroutine(code.name, code.params, code.body, args, fnId as string, state);
  }
  const frame: Frame = {
    name: code.name,
    locals: {},
    globalNames: new Set(),
    nonlocalNames: new Set(),
    functionCode: code,
    closureFrames: code.closureFrames,
  };

  for (let i = 0; i < code.params.length; i++) {
    const p = code.params[i]!;
    if (i < args.length) {
      frame.locals[p] = args[i]!;
    } else if (code.defaults && code.defaults[p] !== undefined) {
      frame.locals[p] = code.defaults[p]!;
    } else {
      throw new Error(`TypeError: ${code.name}() missing required positional argument: '${p}'`);
    }
  }

  state.frames.push(frame);
  try {
    for (const stmt of code.body) {
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
 * Call method on a heap object or module.
 */
function callMethod(objId: RtValue, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId as string];
  if (!obj) throw new Error(`TypeError: bad method target (line ${line})`);

  if (obj.type === 'module') {
    const modName = (obj.value as { name: string }).name;
    if (modName === 'math') {
      return dispatchMathFunction(method, args, state, line);
    }
    if (modName === 'collections') {
      if (method === 'defaultdict') return makeDefaultdict(args, state, line);
      throw new Error(`AttributeError: module 'collections' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'functools') {
      if (method === 'reduce') return reduce(args, state, line);
      throw new Error(`AttributeError: module 'functools' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'copy') {
      if (args.length !== 1) throw new Error(`TypeError: copy() takes exactly one argument (line ${line})`);
      if (method === 'copy') return shallowClone(args[0], state, line);
      if (method === 'deepcopy') return deepClone(args[0], state, line);
      throw new Error(`AttributeError: module 'copy' has no attribute '${method}' (line ${line})`);
    }
    if (modName === 'numpy') {
      return dispatchNumpyModule(method, args, state, line);
    }
    if (modName === 'pandas') {
      return dispatchPandasModule(method, args, state, line);
    }
    if (modName === 'asyncio') {
      return dispatchAsyncioModule(method, args, state, line, execStatement);
    }
    if (modName === 'threading') {
      return dispatchThreadingModule(method, args, state, line);
    }
  }

  return dispatchObjectMethod(obj, method, args, state, line, execStatement, refreshReprs);
}

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

interface DefaultDictValue {
  factory: string;
  entries: Array<[string, RtValue, RtValue?]>;
}

function makeDefaultdict(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: defaultdict() takes one argument (the default factory) (line ${line})`);
  const factory = bareBuiltinName(args[0], state, line);
  const obj = allocObject('defaultdict', { factory, entries: [] } as DefaultDictValue, '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

function bareBuiltinName(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const o = state.heap[v];
    if (o.type === 'builtin') return o.value as string;
    throw new Error(`TypeError: expected a bare builtin, got a ${o.type} (line ${line})`);
  }
  throw new Error(`TypeError: expected a bare builtin (e.g. list or int), not ${typeName(v, state)} (line ${line})`);
}

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
  if (factory === 'str') return allocString('', state);
  throw new Error(`TypeError: default factory '${factory}' is not supported (line ${line})`);
}

interface IteratorValue {
  source: string;
  index: number;
}

function isIterableType(type: string): boolean {
  return type === 'list' || type === 'tuple' || type === 'set';
}

function isIteratorType(type: string): boolean {
  return type.endsWith('iter');
}

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

function nextIterator(v: RtValue, state: MemoryState, line: number): RtValue {
  if (typeof v === 'string' && state.heap[v] && (state.heap[v].type === 'mapiter' || state.heap[v].type === 'filteriter')) {
    return stepMapFilter(v, state, line);
  }
  if (typeof v !== 'string' || !state.heap[v] || !isIteratorType(state.heap[v].type)) {
    throw new Error(`TypeError: '${typeName(v, state)}' object is not an iterator (line ${line})`);
  }
  const it = state.heap[v];
  const iterVal = it.value as IteratorValue;
  const src = state.heap[iterVal.source];
  if (!src) throw new Error(`RuntimeError: iterator source was deleted (line ${line})`);

  if (src.type === 'list' || src.type === 'tuple' || src.type === 'set') {
    const arr = src.value as RtValue[];
    if (iterVal.index >= arr.length) throw new Error(`StopIteration (line ${line})`);
    const elem = arr[iterVal.index++]!;
    return elem;
  }
  if (src.type === 'dict') {
    const entries = src.value as Array<[string, RtValue]>;
    if (iterVal.index >= entries.length) throw new Error(`StopIteration (line ${line})`);
    return allocString(entries[iterVal.index++]![0], state);
  }
  throw new Error(`StopIteration (line ${line})`);
}

interface MapFilterValue {
  source: string;
  fn: string;
  isFilter: boolean;
}

function makeMapFilter(args: RtValue[], state: MemoryState, line: number, isFilter: boolean): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: ${isFilter ? 'filter' : 'map'}() takes exactly two arguments (line ${line})`);
  const fn = resolveCallableName(args[0], state, line);
  const it = ensureIterator(args[1], state, line);
  const val: MapFilterValue = { source: it, fn, isFilter };
  const type = isFilter ? 'filteriter' : 'mapiter';
  const obj = allocObject(type, val, `<${isFilter ? 'filter' : 'map'} object>`);
  state.heap[obj.id] = obj;
  return obj.id;
}

function resolveCallableName(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]) {
    const o = state.heap[v];
    if (o.type === 'builtin' || o.type === 'function') return o.id;
  }
  throw new Error(`TypeError: argument 1 must be callable, got ${typeName(v, state)} (line ${line})`);
}

function ensureIterator(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v] && state.heap[v].type === 'iterator') return v;
  return makeIterator(v, state, line) as string;
}

function stepMapFilter(objId: string, state: MemoryState, line: number): RtValue {
  const mf = state.heap[objId].value as MapFilterValue;
  for (;;) {
    const elem = nextIterator(mf.source, state, line);
    const result = applyBuiltinCall(mf.fn, [elem], state, line);
    if (!mf.isFilter) return result;
    if (truthy(result, state)) return elem;
  }
}

function applyBuiltinCall(fnId: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const fn = state.heap[fnId];
  if (!fn) throw new Error(`RuntimeError: function reference was released (line ${line})`);
  if (fn.type === 'function') return callUserFunction(fnId, args, state, line);
  if (fn.type === 'builtin') {
    const b = fn.value as string;
    const a = args[0];
    if (b === 'int') {
      if (typeof a === 'string') {
        const raw = (state.heap[a]?.type === 'str' ? (state.heap[a].value as string) : a).trim();
        return parseInt(raw, 10);
      }
      return Math.trunc(derefNumber(a, state));
    }
    if (b === 'float') return allocFloat(derefNumber(a, state), state);
    if (b === 'str') return allocString(printArg(a, state), state);
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

function reduce(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: reduce() takes exactly two arguments (line ${line})`);
  const fn = resolveCallableName(args[0], state, line);
  const it = ensureIterator(args[1], state, line);
  let acc: RtValue | undefined;
  for (;;) {
    let elem: RtValue;
    try {
      elem = nextIterator(it, state, line);
    } catch {
      if (acc === undefined) throw new Error(`TypeError: reduce() of empty iterable with no initial value (line ${line})`);
      return acc;
    }
    acc = acc === undefined ? elem : applyBuiltinCall(fn, [acc, elem], state, line);
  }
}

/**
 * Binary operator evaluation.
 */
function binOp(op: string, left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  const lt = typeName(left, state);
  const rt = typeName(right, state);

  if (op === '%' && lt === 'str') {
    const template = state.heap[left as string].value as string;
    const formatted = template
      .replace('%d', String(derefNumber(right, state)))
      .replace('%s', printArg(right, state));
    return allocString(formatted, state);
  }

  if (op === '+' && lt === 'str' && rt === 'str') {
    const lv = state.heap[left as string].value as string;
    const rv = state.heap[right as string].value as string;
    return allocString(lv + rv, state);
  }
  if (op === '+' && (lt === 'str' || rt === 'str')) {
    throw new Error(`TypeError: can only concatenate str (not "${rt === 'str' ? lt : rt}") to str`);
  }

  if (op === '+' && lt === 'list' && rt === 'list') {
    const merged = [...(state.heap[left as string].value as RtValue[]), ...(state.heap[right as string].value as RtValue[])];
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }
  if (op === '+' && (lt === 'list' || rt === 'list')) {
    throw new Error(`TypeError: can only concatenate list (not "${rt === 'list' ? lt : rt}") to list`);
  }
  if (op === '*' && lt === 'list' && (rt === 'int' || typeof right === 'number')) {
    const n = Math.max(0, Math.trunc(derefNumber(right, state)));
    const src = state.heap[left as string].value as RtValue[];
    const merged: RtValue[] = [];
    for (let i = 0; i < n; i++) merged.push(...src);
    const obj = allocObject('list', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }

  if (op === '+' && lt === 'tuple' && rt === 'tuple') {
    const merged = [...(state.heap[left as string].value as RtValue[]), ...(state.heap[right as string].value as RtValue[])];
    const obj = allocObject('tuple', merged, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return obj.id;
  }

  if (op === '+' && (lt === 'ndarray' || rt === 'ndarray')) {
    const scalar = lt === 'ndarray' ? right : left;
    const arr = lt === 'ndarray' ? left : right;
    if (typeof scalar !== 'number') throw new Error(`TypeError: unsupported operand for + (line ${line})`);
    return vecAdd(arr, scalar, state, line);
  }

  if (op === '*' && lt === 'str' && (rt === 'int' || typeof right === 'number')) {
    const n = Math.max(0, Math.trunc(derefNumber(right, state)));
    return allocString((state.heap[left as string].value as string).repeat(n), state);
  }

  if (typeof left === 'bigint' || typeof right === 'bigint') {
    const a = BigInt(left as bigint | number);
    const b = BigInt(right as bigint | number);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '//':
        if (b === 0n) throw new Error('ZeroDivisionError: integer division or modulo by zero');
        return a / b;
      case '%':
        if (b === 0n) throw new Error('ZeroDivisionError: integer division or modulo by zero');
        return ((a % b) + b) % b;
      case '**':
        return a ** b;
      case '/':
        if (b === 0n) throw new Error('ZeroDivisionError: division by zero');
        return allocFloat(Number(a) / Number(b), state);
    }
  }

  const a = derefNumber(left, state);
  const b = derefNumber(right, state);
  const isFloatOp = (typeof left === 'string' && state.heap[left]?.type === 'float') ||
                    (typeof right === 'string' && state.heap[right]?.type === 'float');

  switch (op) {
    case '+': {
      const res = a + b;
      return isFloatOp ? allocFloat(res, state) : res;
    }
    case '-': {
      const res = a - b;
      return isFloatOp ? allocFloat(res, state) : res;
    }
    case '*': {
      const res = a * b;
      return isFloatOp ? allocFloat(res, state) : res;
    }
    case '/': {
      if (b === 0) throw new Error(`ZeroDivisionError: division by zero (line ${line})`);
      return allocFloat(a / b, state);
    }
    case '//': {
      if (b === 0) throw new Error(`ZeroDivisionError: integer division or modulo by zero (line ${line})`);
      const res = Math.floor(a / b);
      return isFloatOp ? allocFloat(res, state) : res;
    }
    case '%': {
      if (b === 0) throw new Error(`ZeroDivisionError: integer division or modulo by zero (line ${line})`);
      const res = ((a % b) + b) % b;
      return isFloatOp ? allocFloat(res, state) : res;
    }
    case '**': {
      if (Number.isInteger(a) && Number.isInteger(b) && b >= 0 && (b > 30 || a > 100)) {
        return BigInt(Math.trunc(a)) ** BigInt(Math.trunc(b));
      }
      const res = a ** b;
      return isFloatOp ? allocFloat(res, state) : res;
    }
    default:
      throw new Error(`RuntimeError: unsupported operator ${op} (line ${line})`);
  }
}

/**
 * Compare operator evaluation.
 */
function compareOp(op: string, left: RtValue, right: RtValue, state: MemoryState): boolean {
  if (op === 'is') {
    if (left === right) return true;
    if (typeof left === 'number' && typeof right === 'number' && left === right && Number.isInteger(left) && left >= -5 && left <= 256) {
      return true;
    }
    return false;
  }
  if (op === 'is not') {
    return !compareOp('is', left, right, state);
  }
  if (op === '==') return valuesEqual(left, right, state);
  if (op === '!=') return !valuesEqual(left, right, state);

  if (op === 'in') {
    const container = typeof right === 'string' ? state.heap[right] : undefined;
    if (container) {
      if (['list', 'tuple', 'set'].includes(container.type)) {
        return (container.value as RtValue[]).some((v) => valuesEqual(v, left, state));
      }
      if (container.type === 'dict' || container.type === 'defaultdict') {
        const keyRepr = dictKeyRepr(left, state);
        return dictEntries(container).some(([k]) => k === keyRepr);
      }
      if (container.type === 'str') {
        const sub = typeof left === 'string' && state.heap[left]?.type === 'str'
          ? (state.heap[left].value as string)
          : String(left);
        return (container.value as string).includes(sub);
      }
    }
    if (typeof right === 'string' && typeof left === 'string') return right.includes(left);
    throw new Error(`TypeError: argument of type '${typeName(right, state)}' is not iterable`);
  }

  const lt = typeName(left, state);
  const rt = typeName(right, state);

  if (lt === 'str' && rt === 'str') {
    const lv = typeof left === 'string' && state.heap[left]?.type === 'str' ? (state.heap[left].value as string) : String(left);
    const rv = typeof right === 'string' && state.heap[right]?.type === 'str' ? (state.heap[right].value as string) : String(right);
    switch (op) {
      case '<': return lv < rv;
      case '<=': return lv <= rv;
      case '>': return lv > rv;
      case '>=': return lv >= rv;
    }
  }

  if (lt === 'list' && rt === 'list') {
    const lv = state.heap[left as string].value as RtValue[];
    const rv = state.heap[right as string].value as RtValue[];
    const minLen = Math.min(lv.length, rv.length);
    for (let i = 0; i < minLen; i++) {
      if (!valuesEqual(lv[i], rv[i], state)) {
        return compareOp(op, lv[i], rv[i], state);
      }
    }
    switch (op) {
      case '<': return lv.length < rv.length;
      case '<=': return lv.length <= rv.length;
      case '>': return lv.length > rv.length;
      case '>=': return lv.length >= rv.length;
    }
  }

  if (lt === 'tuple' && rt === 'tuple') {
    const lv = state.heap[left as string].value as RtValue[];
    const rv = state.heap[right as string].value as RtValue[];
    const minLen = Math.min(lv.length, rv.length);
    for (let i = 0; i < minLen; i++) {
      if (!valuesEqual(lv[i], rv[i], state)) {
        return compareOp(op, lv[i], rv[i], state);
      }
    }
    switch (op) {
      case '<': return lv.length < rv.length;
      case '<=': return lv.length <= rv.length;
      case '>': return lv.length > rv.length;
      case '>=': return lv.length >= rv.length;
    }
  }

  const isLeftNum = lt === 'int' || lt === 'float' || lt === 'bool';
  const isRightNum = rt === 'int' || rt === 'float' || rt === 'bool';
  if (isLeftNum !== isRightNum) {
    throw new Error(`TypeError: '${op}' not supported between instances of '${lt}' and '${rt}'`);
  }

  const a = derefNumber(left, state);
  const b = derefNumber(right, state);
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

  if (obj.type === 'dataframe') {
    return frameSubscript(objId as string, index, state, line);
  }
  if (obj.type === 'list' || obj.type === 'tuple') {
    const value = obj.value as RtValue[];
    const i = Number(index);
    const idx = i < 0 ? value.length + i : i;
    if (idx < 0 || idx >= value.length) {
      throw new Error(`IndexError: index out of range (line ${line})`);
    }
    return value[idx];
  }
  if (obj.type === 'ndarray') {
    const v = obj.value as NdarrayValue;
    const i = Number(index);
    const idx = i < 0 ? v.shape + i : i;
    if (idx < 0 || idx >= v.shape) throw new Error(`IndexError: index out of range (line ${line})`);
    return (state.heap[v.buffer].value as NumpyBufferValue).data[v.offset + idx]!;
  }
  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    const keyRepr = dictKeyRepr(index, state);
    const entries = dictEntries(obj);
    const found = entries.find(([k, , ok]) => dictKeyMatch(k, ok, index, keyRepr, state));
    if (found) return found[1];
    if (obj.type === 'dict') throw new Error(`KeyError: ${keyRepr} (line ${line})`);
    const factory = (obj.value as DefaultDictValue).factory;
    const created = applyFactory(factory, state, line);
    entries.push([keyRepr, created, index]);
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
    obj.repr = formatObject(obj, state);
    return out.id;
  }
  if (obj.type === 'ndarray') {
    return ndarraySlice(objId as string, start, stop, state, line);
  }
  if (obj.type === 'str') {
    return allocString((obj.value as string).slice(s, e), state);
  }
  throw new Error(`TypeError: '${obj.type}' object is not sliceable (line ${line})`);
}
