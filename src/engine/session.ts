/**
 * Public facade of learn-python's simulated Python runtime.
 */

import {
  cloneState,
  createModuleState,
  liveObjectIds,
  referenceEdges,
  resetObjectIds,
  snapshot,
} from './memory';
import type { RefEdge } from './memory';
import { displayValue, run, runFresh } from './evaluator';
import type { MemoryState, RtValue, Snapshot } from './types';

export interface Session {
  readonly state: MemoryState;
  run: (source: string) => MemoryState;
  snapshot: () => Snapshot;
  clone: () => MemoryState;
  edges: () => RefEdge[];
  liveIds: () => string[];
  display: (v: RtValue) => string;
  reset: () => MemoryState;
  setState: (newState: MemoryState) => void;
}

/**
 * Create a new interpreter session.
 */
export function createSession(): Session {
  let state = createModuleState();
  return {
    get state() {
      return state;
    },
    run(source: string): MemoryState {
      return run(source, state);
    },
    snapshot(): Snapshot {
      return snapshot(state);
    },
    clone(): MemoryState {
      const arr = state.trace;
      delete state.trace;
      const copy = cloneState(state);
      state.trace = arr;
      return copy;
    },
    edges(): RefEdge[] {
      return referenceEdges(state);
    },
    liveIds(): string[] {
      return liveObjectIds(state);
    },
    display(v: RtValue): string {
      return displayValue(v, state);
    },
    reset(): MemoryState {
      resetObjectIds();
      state = createModuleState();
      return state;
    },
    setState(newState: MemoryState): void {
      state = newState;
    },
  };
}

export { run, runFresh, cloneState, createModuleState, snapshot, referenceEdges, liveObjectIds, displayValue, resetObjectIds };
