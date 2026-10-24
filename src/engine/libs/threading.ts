/**
 * Threading simulator module for learn-python.
 * Models threads, locks, preemption, and shared-state race conditions.
 * Supports standard Python APIs:
 *   import threading
 *   t = threading.Thread(target=f, args=(x,))
 *   t.start()
 *   t.join()
 *   lock = threading.Lock()
 *   lock.acquire() / lock.release()
 *   with lock:
 */

import { allocObject } from '../memory';
import { PyRuntimeError, PySuspend, PyTypeError } from '../errors';
import type { AstNode, FunctionCode, MemoryState, RtValue } from '../types';

export interface ThreadValue {
  target: string;
  name: string;
  status: 'not-started' | 'running' | 'blocked' | 'done';
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

export function getActiveThreadId(): string | null {
  return activeThreadId;
}

export function setActiveThreadId(id: string | null): void {
  activeThreadId = id;
}

export function threadRepr(type: string, v: unknown): string {
  if (type === 'thread') {
    const t = v as ThreadValue;
    return `Thread-${t.name} · ${t.status}`;
  }
  const l = v as LockValue;
  return `Lock · ${l.held ? 'HELD' : 'free'}`;
}

export function refreshThreadReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'thread' || obj.type === 'lock') {
      obj.repr = threadRepr(obj.type, obj.value);
    }
  }
}

/**
 * `threading.Thread(target=bump, args=(box,))` — construct a thread object.
 * Supports both CPython keyword arguments and positional target/args.
 */
export function makeThread(
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string
): RtValue {
  let fnId: RtValue | undefined = kwargs?.target;
  let argsTuple: RtValue | undefined = kwargs?.args;

  if (fnId === undefined && args.length > 0) {
    fnId = args[0];
  }
  if (argsTuple === undefined && args.length > 1) {
    argsTuple = args[1];
  }

  if (fnId === undefined) {
    throw new PyTypeError(`Thread() missing required argument: 'target' (line ${line})`);
  }

  const fn = typeof fnId === 'string' ? state.heap[fnId] : undefined;
  if (!fn || fn.type !== 'function') {
    throw new PyTypeError(`Thread() target must be a function, got ${typeName(fnId, state)} (line ${line})`);
  }

  const code = fn.value as FunctionCode;
  const params = code.params;

  let callArgs: RtValue[] = [];
  if (argsTuple !== undefined) {
    const tup = typeof argsTuple === 'string' ? state.heap[argsTuple] : undefined;
    if (tup && ['tuple', 'list'].includes(tup.type)) {
      callArgs = [...(tup.value as RtValue[])];
    } else if (Array.isArray(argsTuple)) {
      callArgs = [...argsTuple];
    }
  }

  if (callArgs.length !== params.length) {
    throw new PyTypeError(
      `Thread() target ${code.name}() takes ${params.length} arg(s), got ${callArgs.length} (line ${line})`
    );
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

/** `threading.Lock()` -> a fresh unheld lock. */
export function makeLock(state: MemoryState, line: number): RtValue {
  void line;
  const v: LockValue = { held: false, holder: null };
  const obj = allocObject('lock', v, threadRepr('lock', v));
  state.heap[obj.id] = obj;
  return obj.id;
}

/** `thread.start()` — mark thread running. */
export function threadStart(objId: string, state: MemoryState, line: number): void {
  const obj = state.heap[objId];
  if (!obj || obj.type !== 'thread') {
    throw new PyTypeError(`start() called on non-thread object (line ${line})`);
  }
  const th = obj.value as ThreadValue;
  if (th.status === 'running' || th.status === 'blocked') {
    throw new PyRuntimeError(`cannot start thread ${th.name} (already started) (line ${line})`);
  }
  th.status = 'running';
  th.pc = 0;
  refreshThreadReprs(state);
}

/** `lock.acquire()` -> acquire lock or suspend if held by another thread. */
export function lockAcquire(objId: string, state: MemoryState, line: number): RtValue {
  void line;
  const obj = state.heap[objId];
  if (!obj || obj.type !== 'lock') {
    throw new PyTypeError(`acquire() called on non-lock object (line ${line})`);
  }
  const lk = obj.value as LockValue;
  if (lk.held && lk.holder !== activeThreadId) {
    throw new PySuspend();
  }
  lk.held = true;
  lk.holder = activeThreadId;
  refreshThreadReprs(state);
  return null;
}

/** `lock.release()` -> release lock. */
export function lockRelease(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj || obj.type !== 'lock') {
    throw new PyTypeError(`release() called on non-lock object (line ${line})`);
  }
  const lk = obj.value as LockValue;
  if (lk.held && lk.holder !== activeThreadId) {
    throw new PyRuntimeError(`cannot release lock (not held by this thread) (line ${line})`);
  }
  lk.held = false;
  lk.holder = null;
  refreshThreadReprs(state);
  return null;
}

/**
 * `thread.join()` — drive all started threads in deterministic statement-by-statement round robin.
 */
export function threadJoin(
  objId: string,
  state: MemoryState,
  line: number,
  stepThreadCallback: (threadId: string, state: MemoryState) => void
): void {
  const self = state.heap[objId];
  if (!self || self.type !== 'thread') {
    throw new PyTypeError(`join() called on a non-thread (line ${line})`);
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
      stepThreadCallback(t.id, state);
      if (tv.status === 'done' || tv.pc > before) progressed = true;
    }
    refreshThreadReprs(state);
    if (!progressed) {
      if (++stalledRounds > 10000) break; // deadlock detection
      continue;
    }
    stalledRounds = 0;
  }
  refreshThreadReprs(state);
}

/**
 * Call module-level function in `threading`.
 */
export function callThreadingModule(
  method: string,
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string
): RtValue {
  switch (method) {
    case 'Thread':
      return makeThread(args, kwargs, state, line, typeName);
    case 'Lock':
      return makeLock(state, line);
    case 'current_thread':
      return activeThreadId ?? 'main';
    default:
      throw new PyTypeError(`module 'threading' has no attribute '${method}' (line ${line})`);
  }
}
