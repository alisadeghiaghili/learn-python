/**
 * Typed view over the shared differential corpus.
 *
 * `corpus.json` is the single source of truth: both the TypeScript simulator
 * (via this module, in `differential.test.ts`) and real CPython (via
 * `oracle.py`, directly) read the SAME sources from it. Editing a case means
 * editing one file, and the CPython oracle always re-checks the ground-truth
 * column against a real interpreter — so the corpus cannot silently drift
 * into "the simulator re-describing itself."
 */

import corpusRaw from './corpus.json';

export interface Expected {
  kind: 'ok' | 'exc';
  text?: string;
  excType?: string;
}

export interface CaseDef {
  /** Stable id, shared verbatim between the TS and CPython oracles. */
  id: string;
  /** One-line rationale, shown in reports. */
  note: string;
  /** Python-subset source, run identically by both oracles. */
  source: string;
  /** CPython ground truth. `kind: 'ok'` → `text` = stdout; `kind: 'exc'` → `excType`. */
  expected: Expected;
  /** 'parity' must match now; 'drift' is a known divergence being repaired. */
  expect: 'parity' | 'drift';
}

function asCase(row: Record<string, unknown>): CaseDef {
  const expected = row.expected as Expected;
  if (expected.kind !== 'ok' && expected.kind !== 'exc') {
    throw new Error(`corpus.json: case '${row.id}' has invalid expected.kind`);
  }
  const expect = row.expect as 'parity' | 'drift';
  if (expect !== 'parity' && expect !== 'drift') {
    throw new Error(`corpus.json: case '${row.id}' has invalid expect`);
  }
  return {
    id: row.id as string,
    note: row.note as string,
    source: row.source as string,
    expected,
    expect,
  };
}

export const CASES: CaseDef[] = (corpusRaw as Record<string, unknown>[]).map(asCase);
