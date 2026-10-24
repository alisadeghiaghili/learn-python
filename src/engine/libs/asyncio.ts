/**
 * Asyncio event loop and coroutine runtime emulation.
 */

import { allocObject } from '../memory';
import { formatObject, typeName } from '../common';
import { PyReturn, PySuspend } from '../signals';
import type { AstNode, Frame, MemoryState, RtValue } from '../types';

export type AsyncStatus = 'pending' | 'ready' | 'suspended' | 'done';

export interface CoroutineValue {
  fn: string;
  status: AsyncStatus;
  pc: number;
  name: string;
  params: string[];
  body: AstNode[];
  locals: Record<string, unknown>;
  returnValue: RtValue;
}

export interface TaskValue {
  coro: string;
  name: string;
  status: AsyncStatus;
}

export interface EventLoopValue {
  running: boolean;
  ready: string[];
  done: string[];
  tick: number;
}

let activeCoroutineId: string | null = null;

/**
 * Return current active coroutine ID being executed.
 */
export function getActiveCoroutineId(): string | null {
  return activeCoroutineId;
}

/**
 * Set current active coroutine ID being executed.
 */
export function setActiveCoroutineId(id: string | null): void {
  activeCoroutineId = id;
}

/**
 * String representation for coroutine, task, or event loop objects.
 */
export function asyncRepr(type: string, v: unknown, state: MemoryState): string {
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
 * Create a coroutine object bound to a coroutine function call.
 */
export function makeCoroutine(
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

/**
 * `asyncio.create_task(coro)` implementation.
 */
export function makeTask(args: RtValue[], state: MemoryState, line: number): RtValue {
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

/**
 * `asyncio.sleep(secs)` implementation.
 */
export function asyncSleep(args: RtValue[], state: MemoryState, line: number): RtValue {
  void state;
  if (args.length !== 1) throw new Error(`TypeError: sleep() takes one argument (line ${line})`);
  const secs = Number(args[0]);
  if (Number.isNaN(secs)) throw new Error(`TypeError: sleep() takes a number (line ${line})`);
  return null;
}

/**
 * `asyncio.gather(t1, t2, ...)` implementation.
 */
export function gather(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1) throw new Error(`TypeError: gather() takes at least one awaitable (line ${line})`);
  const results: RtValue[] = args.map((a) => taskReturnValue(a, state, line));
  const obj = allocObject('list', results, '');
  state.heap[obj.id] = obj;
  obj.repr = formatObject(obj, state);
  return obj.id;
}

/**
 * Return value of completed task.
 */
export function taskReturnValue(v: RtValue, state: MemoryState, line: number): RtValue {
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
 * Advance active coroutine until next suspension or return.
 */
export function stepCoroutine(state: MemoryState, execStatement: (node: AstNode, state: MemoryState) => void): void {
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

/**
 * Recompute cached repr of all coroutine, task, and event loop objects.
 */
export function refreshAsyncReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'coroutine' || obj.type === 'task' || obj.type === 'eventloop') {
      obj.repr = asyncRepr(obj.type, obj.value, state);
    }
  }
}

/**
 * Validate that runtime value is a task ID.
 */
export function ensureTaskId(v: RtValue, state: MemoryState, line: number): string {
  if (typeof v === 'string' && state.heap[v]?.type === 'task') return v;
  throw new Error(`TypeError: run() takes tasks, got ${typeName(v, state)} (line ${line})`);
}

/**
 * `asyncio.run(t1, ...)` implementation.
 */
export function runEventLoop(
  args: RtValue[],
  state: MemoryState,
  line: number,
  execStatement: (node: AstNode, state: MemoryState) => void,
): void {
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
    activeCoroutineId = tv.coro;
    stepCoroutine(state, execStatement);
    activeCoroutineId = null;
    loop.tick += 1;
    state.ticks += 1;
    const nowDone = (state.heap[tv.coro].value as CoroutineValue).status === 'done';
    tv.status = nowDone ? 'done' : 'ready';
    if (nowDone) loop.done.push(taskId);
    else loop.ready.push(taskId);
    refreshAsyncReprs(state);
    if (guard++ > 10000) {
      loop.running = false;
      break;
    }
  }
  loop.running = false;
  refreshAsyncReprs(state);
}

/**
 * Dispatch table for asyncio module calls.
 */
export function dispatchAsyncioModule(
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  execStatement: (node: AstNode, state: MemoryState) => void,
): RtValue {
  if (method === 'create_task') return makeTask(args, state, line);
  if (method === 'gather') return gather(args, state, line);
  if (method === 'sleep') return asyncSleep(args, state, line);
  if (method === 'run') {
    runEventLoop(args, state, line, execStatement);
    return null;
  }
  throw new Error(`AttributeError: module 'asyncio' has no attribute '${method}' (line ${line})`);
}
