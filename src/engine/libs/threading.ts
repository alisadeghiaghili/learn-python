/**
 * Threading and synchronization runtime emulation.
 */

import { allocObject } from '../memory';
import { typeName } from '../common';
import { PyReturn, PySuspend } from '../signals';
import type { AstNode, Frame, FunctionCode, MemoryState, RtValue } from '../types';

export type ThreadStatus = 'not-started' | 'running' | 'blocked' | 'done';

export interface ThreadValue {
  target: string;
  name: string;
  status: ThreadStatus;
  pc: number;
  body: AstNode[];
  locals: Record<string, unknown>;
  returnValue: RtValue;
  blocked: boolean;
}

export interface LockValue {
  held: boolean;
  holder: string | null;
}

let activeThreadId: string | null = null;

/**
 * Format string representation of a thread or lock object.
 */
export function threadRepr(type: string, v: unknown): string {
  if (type === 'thread') {
    const t = v as ThreadValue;
    return `Thread-${t.name} · ${t.status}`;
  }
  const l = v as LockValue;
  return `Lock · ${l.held ? 'HELD' : 'free'}`;
}

/**
 * `threading.Thread(target, args_tuple)` implementation.
 */
export function makeThread(args: RtValue[], state: MemoryState, line: number): RtValue {
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

/**
 * `threading.Lock()` implementation.
 */
export function makeLock(state: MemoryState, line: number): RtValue {
  void line;
  const v: LockValue = { held: false, holder: null };
  const obj = allocObject('lock', v, threadRepr('lock', v));
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * `thread.start()` transition.
 */
export function threadStart(objId: string, state: MemoryState, line: number): void {
  const th = state.heap[objId].value as ThreadValue;
  if (th.status === 'running' || th.status === 'blocked') {
    throw new Error(`RuntimeError: cannot start thread ${th.name} (already started) (line ${line})`);
  }
  th.status = 'running';
  th.pc = 0;
  refreshThreadReprs(state);
}

/**
 * `lock.acquire()` implementation.
 */
export function lockAcquire(objId: string, state: MemoryState, line: number): RtValue {
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

/**
 * `lock.release()` implementation.
 */
export function lockRelease(objId: string, state: MemoryState, line: number): RtValue {
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
 * Recompute cached repr of all thread and lock objects.
 */
export function refreshThreadReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'thread' || obj.type === 'lock') {
      obj.repr = threadRepr(obj.type, obj.value);
    }
  }
}

/**
 * Step one thread by a single statement.
 */
export function stepThread(
  threadId: string,
  state: MemoryState,
  execStatement: (node: AstNode, state: MemoryState) => void,
  refreshReprs: (state: MemoryState) => void,
): void {
  const th = state.heap[threadId].value as ThreadValue;
  if (th.pc >= th.body.length) {
    th.status = 'done';
    return;
  }
  const frame: Frame = { name: `thread:${th.name}`, locals: {} };
  for (const [k, v] of Object.entries(th.locals)) frame.locals[k] = v as RtValue;
  state.frames.push(frame);
  activeThreadId = threadId;
  try {
    try {
      execStatement(th.body[th.pc]!, state);
    } catch (err) {
      if (err instanceof PySuspend) {
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

/**
 * `thread.join()` scheduler loop.
 */
export function threadJoin(
  objId: string,
  state: MemoryState,
  line: number,
  execStatement: (node: AstNode, state: MemoryState) => void,
  refreshReprs: (state: MemoryState) => void,
): void {
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
      if (tv.status === 'blocked') {
        tv.blocked = false;
        tv.status = 'running';
      }
      if (tv.pc >= tv.body.length) {
        tv.status = 'done';
        progressed = true;
        continue;
      }
      const before = tv.pc;
      stepThread(t.id, state, execStatement, refreshReprs);
      if (tv.status === 'done' || tv.pc > before) progressed = true;
    }
    refreshThreadReprs(state);
    if (!progressed) {
      if (++stalledRounds > 10000) break;
      continue;
    }
    stalledRounds = 0;
  }
  refreshThreadReprs(state);
}

/**
 * Dispatch table for methods on thread and lock objects.
 */
export function dispatchThreadingMethod(
  objId: string,
  method: string,
  _args: RtValue[],
  state: MemoryState,
  line: number,
  execStatement: (node: AstNode, state: MemoryState) => void,
  refreshReprs: (state: MemoryState) => void,
): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad method target (line ${line})`);

  if (obj.type === 'thread') {
    if (method === 'start') {
      threadStart(objId, state, line);
      return null;
    }
    if (method === 'join') {
      threadJoin(objId, state, line, execStatement, refreshReprs);
      return null;
    }
    throw new Error(`AttributeError: 'thread' object has no attribute '${method}' (line ${line})`);
  }

  if (obj.type === 'lock') {
    if (method === 'acquire') return lockAcquire(objId, state, line);
    if (method === 'release') return lockRelease(objId, state, line);
    throw new Error(`AttributeError: 'lock' object has no attribute '${method}' (line ${line})`);
  }

  throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
}

/**
 * Dispatch table for threading module calls: `threading.Thread()`, `threading.Lock()`.
 */
export function dispatchThreadingModule(method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  if (method === 'Thread') return makeThread(args, state, line);
  if (method === 'Lock') return makeLock(state, line);
  throw new Error(`AttributeError: module 'threading' has no attribute '${method}' (line ${line})`);
}
