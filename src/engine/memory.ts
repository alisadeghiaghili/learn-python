/**
 * Simulated Python object memory: heap objects and stack frames.
 *
 * This module owns identity, references, and snapshots — the data model the
 * visualizer and goal checker both read.
 */

import type {
  Frame,
  HeapObject,
  MemoryState,
  RtValue,
  Snapshot,
  SnapshotFrame,
  SnapshotHeapObject,
} from './types';

let nextObjectId = 1;

/**
 * Reset object id counter (used by tests and full resets).
 */
export function resetObjectIds(): void {
  nextObjectId = 1;
}

/**
 * Allocate a heap object and return its handle.
 */
export function allocObject(type: string, value: unknown, repr: string): HeapObject {
  const id = `obj_${nextObjectId++}`;
  return { id, type, value, repr };
}

export interface RefEdge {
  fromFrame: string;
  name: string;
  toId: string;
}

/**
 * Compute inbound reference edges from frames to heap objects.
 */
export function referenceEdges(state: MemoryState): RefEdge[] {
  const edges: RefEdge[] = [];
  for (const frame of state.frames) {
    for (const [name, targetId] of Object.entries(frame.locals)) {
      if (typeof targetId === 'string' && state.heap[targetId]) {
        edges.push({ fromFrame: frame.name, name, toId: targetId });
      }
    }
  }
  return edges;
}

/**
 * Collect object ids reachable from frame roots (for display order).
 */
export function liveObjectIds(state: MemoryState): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const frame of state.frames) {
    for (const targetId of Object.values(frame.locals)) {
      if (typeof targetId === 'string' && state.heap[targetId] && !seen.has(targetId)) {
        seen.add(targetId);
        queue.push(targetId);
      }
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const obj = state.heap[id];
    for (const ref of nestedRefs(obj)) {
      if (state.heap[ref] && !seen.has(ref)) {
        seen.add(ref);
        queue.push(ref);
      }
    }
  }
  return Object.keys(state.heap).filter((id) => seen.has(id));
}

/**
 * Nested object ids stored inside a container value.
 */
function nestedRefs(obj: HeapObject | undefined): string[] {
  if (!obj) return [];
  const { type, value } = obj;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return (value as RtValue[]).filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'dict') {
    return (value as Array<[string, RtValue]>)
      .flatMap(([k, v]) => [k, v])
      .filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  return [];
}

/**
 * Deep-clone a memory state (undo / level snapshots).
 */
export function cloneState(state: MemoryState): MemoryState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Structural snapshot used by goal compare (ids normalized away).
 */
export function snapshot(state: MemoryState): Snapshot {
  const heap: Record<string, SnapshotHeapObject> = {};
  const idMap: Record<string, string> = {};
  for (const obj of Object.values(state.heap)) {
    idMap[obj.id] = `h_${obj.id}`;
    heap[idMap[obj.id]] = {
      type: obj.type,
      repr: obj.repr,
      value: normalizeValue(obj.value, idMap, state.heap, true),
    };
  }
  // Second pass so nested refs resolve consistently.
  for (const obj of Object.values(state.heap)) {
    heap[idMap[obj.id]].value = normalizeValue(obj.value, idMap, state.heap, false);
  }
  const frames: SnapshotFrame[] = state.frames.map((frame) => {
    const locals: Record<string, RtValue | string> = {};
    for (const [name, targetId] of Object.entries(frame.locals)) {
      locals[name] = typeof targetId === 'string' && state.heap[targetId]
        ? idMap[targetId]
        : targetId;
    }
    return { name: frame.name, locals };
  });
  return { frames, heap };
}

/**
 * Rewrite a runtime value into snapshot form.
 */
function normalizeValue(
  value: unknown,
  idMap: Record<string, string>,
  heap: Record<string, HeapObject>,
  firstPass: boolean,
): unknown {
  if (typeof value === 'string' && value.startsWith('obj_') && heap[value]) {
    return firstPass ? idMap[value] || value : idMap[value];
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeValue(v, idMap, heap, firstPass));
  }
  return value;
}

/**
 * Build a fresh module-level state.
 */
export function createModuleState(): MemoryState {
  return {
    frames: [{ name: '<module>', locals: {} } as Frame],
    heap: {},
    stdout: [],
    errors: [],
    plots: [],
  };
}
