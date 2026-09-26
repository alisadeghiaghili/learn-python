/**
 * Public facade of the LearnPyState simulated Python runtime.
 */

import { cloneState, createModuleState, liveObjectIds, referenceEdges, resetObjectIds, snapshot } from './memory.js';
import { displayValue, run, runFresh } from './evaluator.js';

/**
 * Create a new interpreter session.
 *
 * @returns {{
 *   state: Object,
 *   run: (source: string) => Object,
 *   snapshot: () => Object,
 *   clone: () => Object,
 *   edges: () => Array,
 *   liveIds: () => string[],
 *   display: (v: *) => string,
 *   reset: () => Object,
 * }}
 */
export function createSession() {
  let state = createModuleState();
  return {
    get state() {
      return state;
    },
    /**
     * @param {string} source
     * @returns {Object}
     */
    run(source) {
      return run(source, state);
    },
    snapshot() {
      return snapshot(state);
    },
    clone() {
      return cloneState(state);
    },
    edges() {
      return referenceEdges(state);
    },
    liveIds() {
      return liveObjectIds(state);
    },
    /**
     * @param {*} v
     * @returns {string}
     */
    display(v) {
      return displayValue(v, state);
    },
    reset() {
      resetObjectIds();
      state = createModuleState();
      return state;
    },
  };
}

export { run, runFresh, cloneState, createModuleState, snapshot, referenceEdges, liveObjectIds, displayValue, resetObjectIds };
