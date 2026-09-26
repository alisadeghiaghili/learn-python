/**
 * Simulated Python object memory: heap objects and stack frames.
 *
 * This module owns identity, references, and snapshots — the data model the
 * visualizer and goal checker both read.
 */

let nextObjectId = 1;

/**
 * Reset object id counter (used by tests and full resets).
 * @returns {void}
 */
export function resetObjectIds() {
  nextObjectId = 1;
}

/**
 * Allocate a heap object and return its handle.
 *
 * @param {string} type - Python type name (`list`, `dict`, `int`, ...)
 * @param {*} value - Internally structured value (refs as object ids for mutables)
 * @param {string} repr - Display representation
 * @returns {{id: string, type: string, value: *, repr: string}}
 */
export function allocObject(type, value, repr) {
  const id = `obj_${nextObjectId++}`;
  return { id, type, value, repr };
}

/**
 * Compute inbound reference edges from frames to heap objects.
 *
 * @param {{frames: Array, heap: Object}} state
 * @returns {Array<{fromFrame: string, name: string, toId: string}>}
 */
export function referenceEdges(state) {
  const edges = [];
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
 *
 * @param {{frames: Array, heap: Object}} state
 * @returns {string[]} object ids in stable allocation order that are live
 */
export function liveObjectIds(state) {
  const seen = new Set();
  const queue = [];
  for (const frame of state.frames) {
    for (const targetId of Object.values(frame.locals)) {
      if (typeof targetId === 'string' && state.heap[targetId] && !seen.has(targetId)) {
        seen.add(targetId);
        queue.push(targetId);
      }
    }
  }
  while (queue.length) {
    const id = queue.shift();
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
 *
 * @param {{type: string, value: *}} obj
 * @returns {string[]}
 */
function nestedRefs(obj) {
  if (!obj) return [];
  const { type, value } = obj;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return value.filter((v) => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'dict') {
    return value.flatMap(([k, v]) => [k, v]).filter((v) => typeof v === 'string' && v.startsWith('obj_'));
  }
  return [];
}

/**
 * Deep-clone a memory state (undo / level snapshots).
 *
 * @param {{frames: Array, heap: Object}} state
 * @returns {{frames: Array, heap: Object}}
 */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Structural snapshot used by goal compare (ids normalized away).
 *
 * @param {{frames: Array, heap: Object}} state
 * @returns {{frames: Array, heap: Object}}
 */
export function snapshot(state) {
  const heap = {};
  const idMap = {};
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
  const frames = state.frames.map((frame) => {
    const locals = {};
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
 *
 * @param {*} value
 * @param {Object} idMap
 * @param {Object} heap
 * @param {boolean} firstPass
 * @returns {*}
 */
function normalizeValue(value, idMap, heap, firstPass) {
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
 *
 * @returns {{frames: Array, heap: Object, stdout: string[], errors: string[]}}
 */
export function createModuleState() {
  return {
    frames: [{ name: '<module>', locals: {} }],
    heap: {},
    stdout: [],
    errors: [],
  };
}
