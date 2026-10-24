/**
 * Asyncio simulator module for learn-python.
 * Models coroutines, tasks, cooperative yielding via await asyncio.sleep(0),
 * and round-robin event loop scheduling.
 * Supports standard CPython asyncio APIs:
 *   async def main(): ...
 *   asyncio.run(main())
 *   asyncio.create_task(...)
 *   await asyncio.sleep(0)
 *   await asyncio.gather(...)
 *   asyncio.Lock
 */

import { allocObject } from '../memory';
import { PyReturn, PySuspend, PyTypeError } from '../errors';
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
let currentEventLoopId: string | null = null;

export function getActiveCoroutineId(): string | null {
  return activeCoroutineId;
}

export function setActiveCoroutineId(id: string | null): void {
  activeCoroutineId = id;
}

export function getCurrentEventLoopId(): string | null {
  return currentEventLoopId;
}

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
  const readyNames = l.ready
    .map((id) => (state.heap[id]?.value as TaskValue | undefined)?.name ?? '?')
    .join(', ');
  const doneNames = l.done
    .map((id) => (state.heap[id]?.value as TaskValue | undefined)?.name ?? '?')
    .join(', ');
  return `EventLoop · tick ${l.tick} · running ${l.running ? 'True' : 'False'} · [ready ${readyNames || '∅'} | done ${doneNames || '∅'}]`;
}

export function refreshAsyncReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'coroutine' || obj.type === 'task' || obj.type === 'eventloop') {
      obj.repr = asyncRepr(obj.type, obj.value, state);
    }
  }
}

/**
 * Construct a fresh coroutine heap object with parameters seeded.
 */
export function makeCoroutine(
  name: string,
  params: string[],
  body: AstNode[],
  args: RtValue[],
  fnId: string,
  state: MemoryState
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
 * `asyncio.create_task(coro)` — schedule a coroutine on the running event loop.
 */
export function makeTask(
  args: RtValue[],
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string
): RtValue {
  if (args.length !== 1) {
    throw new PyTypeError(`create_task() takes exactly one argument (line ${line})`);
  }
  const coroId = args[0];
  if (typeof coroId !== 'string' || state.heap[coroId]?.type !== 'coroutine') {
    throw new PyTypeError(`create_task() argument must be a coroutine, got ${typeName(coroId, state)} (line ${line})`);
  }

  const coro = state.heap[coroId].value as CoroutineValue;
  const v: TaskValue = {
    coro: coroId,
    name: coro.name,
    status: coro.status === 'done' ? 'done' : 'ready',
  };
  const obj = allocObject('task', v, asyncRepr('task', v, state));
  state.heap[obj.id] = obj;

  // If there is an active running event loop, enqueue this task into the loop's ready queue
  if (currentEventLoopId && state.heap[currentEventLoopId]) {
    const loop = state.heap[currentEventLoopId].value as EventLoopValue;
    if (loop.running && v.status === 'ready') {
      loop.ready.push(obj.id);
      refreshAsyncReprs(state);
    }
  }

  return obj.id;
}

/**
 * `asyncio.sleep(secs)` — cooperative yield point when awaited.
 */
export function asyncSleep(args: RtValue[], state: MemoryState, line: number): RtValue {
  void state;
  if (args.length !== 1) {
    throw new PyTypeError(`sleep() takes exactly one argument (line ${line})`);
  }
  const secs = Number(args[0]);
  if (Number.isNaN(secs)) {
    throw new PyTypeError(`sleep() takes a number (line ${line})`);
  }
  return null;
}

/**
 * `asyncio.gather(*tasks_or_coros)` — gather awaitables.
 */
export function gather(
  args: RtValue[],
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string
): RtValue {
  if (args.length < 1) {
    throw new PyTypeError(`gather() takes at least one awaitable (line ${line})`);
  }
  const taskIds: string[] = args.map((a) => {
    if (typeof a === 'string' && state.heap[a]?.type === 'task') return a;
    if (typeof a === 'string' && state.heap[a]?.type === 'coroutine') {
      return makeTask([a], state, line, typeName) as string;
    }
    throw new PyTypeError(`gather() takes tasks or coroutines, got ${typeName(a, state)} (line ${line})`);
  });

  const results: RtValue[] = taskIds.map((tId) => {
    const t = state.heap[tId].value as TaskValue;
    const coro = state.heap[t.coro];
    if (!coro || coro.type !== 'coroutine') return null;
    const cv = coro.value as CoroutineValue;
    return cv.status === 'done' ? cv.returnValue : null;
  });

  const obj = allocObject('list', results, '');
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Step active coroutine by one tick until it suspends on await or returns.
 */
export function stepCoroutine(
  state: MemoryState,
  execStatementCallback: (stmt: AstNode, state: MemoryState) => void
): void {
  const coroId = activeCoroutineId;
  if (!coroId || !state.heap[coroId]) return;
  const c = state.heap[coroId].value as CoroutineValue;
  const frame: Frame = { name: c.name, locals: {} };
  for (const [k, v] of Object.entries(c.locals)) frame.locals[k] = v as RtValue;
  state.frames.push(frame);

  try {
    while (c.pc < c.body.length) {
      try {
        execStatementCallback(c.body[c.pc]!, state);
      } catch (err) {
        if (err instanceof PySuspend) {
          c.pc += 1;
          c.status = 'suspended';
          return;
        }
        if (err instanceof PyReturn) {
          c.returnValue = err.value as RtValue;
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
 * `asyncio.run(main_coro)` — start event loop and drive to completion.
 */
export function runEventLoop(
  args: RtValue[],
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string,
  execStatementCallback: (stmt: AstNode, state: MemoryState) => void
): RtValue {
  if (args.length < 1) {
    throw new PyTypeError(`run() takes at least one coroutine or task (line ${line})`);
  }

  // Convert coroutines or tasks to task IDs
  const taskIds: string[] = args.map((a) => {
    if (typeof a === 'string' && state.heap[a]?.type === 'task') return a;
    if (typeof a === 'string' && state.heap[a]?.type === 'coroutine') {
      const coro = state.heap[a].value as CoroutineValue;
      const tVal: TaskValue = {
        coro: a,
        name: coro.name,
        status: coro.status === 'done' ? 'done' : 'ready',
      };
      const tObj = allocObject('task', tVal, asyncRepr('task', tVal, state));
      state.heap[tObj.id] = tObj;
      return tObj.id;
    }
    throw new PyTypeError(`run() takes a coroutine or task, got ${typeName(a, state)} (line ${line})`);
  });

  const rootTaskId = taskIds[0]!;
  const ready = taskIds.filter((id) => (state.heap[id].value as TaskValue).status !== 'done');
  const done = taskIds.filter((id) => (state.heap[id].value as TaskValue).status === 'done');
  const loop: EventLoopValue = { running: true, ready, done, tick: 0 };
  const loopObj = allocObject('eventloop', loop, asyncRepr('eventloop', loop, state));
  state.heap[loopObj.id] = loopObj;

  const prevLoopId = currentEventLoopId;
  currentEventLoopId = loopObj.id;

  let guard = 0;
  try {
    while (loop.ready.length > 0) {
      const taskId = loop.ready.shift()!;
      const task = state.heap[taskId];
      if (!task || task.type !== 'task') continue;
      const tv = task.value as TaskValue;

      activeCoroutineId = tv.coro;
      stepCoroutine(state, execStatementCallback);
      activeCoroutineId = null;

      loop.tick += 1;
      state.ticks += 1;

      const nowDone = (state.heap[tv.coro]?.value as CoroutineValue)?.status === 'done';
      tv.status = nowDone ? 'done' : 'ready';
      if (nowDone) {
        loop.done.push(taskId);
      } else {
        loop.ready.push(taskId);
      }

      refreshAsyncReprs(state);
      if (guard++ > 10000) break;
    }
  } finally {
    loop.running = false;
    currentEventLoopId = prevLoopId;
    refreshAsyncReprs(state);
  }

  // Return the return value of root task's coroutine
  const rootTask = state.heap[rootTaskId]?.value as TaskValue | undefined;
  if (rootTask) {
    const rootCoro = state.heap[rootTask.coro]?.value as CoroutineValue | undefined;
    return rootCoro ? rootCoro.returnValue : null;
  }
  return null;
}

/**
 * Dispatch call for `asyncio` module methods.
 */
export function callAsyncioModule(
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  typeName: (v: RtValue, s: MemoryState) => string,
  execStatementCallback: (stmt: AstNode, state: MemoryState) => void
): RtValue {
  switch (method) {
    case 'create_task':
      return makeTask(args, state, line, typeName);
    case 'gather':
      return gather(args, state, line, typeName);
    case 'sleep':
      return asyncSleep(args, state, line);
    case 'run':
      return runEventLoop(args, state, line, typeName, execStatementCallback);
    default:
      throw new PyTypeError(`module 'asyncio' has no attribute '${method}' (line ${line})`);
  }
}
