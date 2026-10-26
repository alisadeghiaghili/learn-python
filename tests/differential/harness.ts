/**
 * Differential-test harness: run a corpus of Python-subset snippets through the
 * in-process TypeScript simulator and report, per case, the stdout (when the
 * run succeeds) or the exception type (when it throws). The CPython side of
 * the same comparison lives in `oracle.py` and is driven from
 * `differential.test.ts`.
 *
 * The output shape is intentionally tiny and language-portable so the two
 * oracles can be diffed field-by-field without sharing any code:
 *
 *   { id, kind: 'ok' | 'exc', text?, excType? }
 *
 * `kind: 'ok'`  → `text` is the joined, newline-separated captured stdout.
 * `kind: 'exc'` → `excType` is the exception class name (e.g. `NameError`).
 *
 * Matching on the exception *type* (not the message) keeps the comparison
 * robust: the simulator and CPython phrase the same error differently, but
 * they must agree on *which* error it is.
 */

import { runFresh } from '../../src/engine/session';

export interface SimCaseResult {
  id: string;
  kind: 'ok' | 'exc';
  text?: string;
  excType?: string;
}

/**
 * Run a single snippet through the simulator and normalise the outcome.
 *
 * @param id - stable case identifier, shared with the CPython oracle.
 * @param code - Python-subset source.
 * @returns A portable result record (stdout or exception type).
 */
export function runSimCase(id: string, code: string): SimCaseResult {
  try {
    const state = runFresh(code);
    return { id, kind: 'ok', text: state.stdout.join('\n') };
  } catch (err) {
    // The simulator throws `Error` with a CPython-style message such as
    // "NameError: name 'x' is not defined (line 2)". The class name is the
    // first token before the first space or colon.
    const message = err instanceof Error ? err.message : String(err);
    const excType = message.split(/[\s:]/, 1)[0];
    return { id, kind: 'exc', excType };
  }
}
