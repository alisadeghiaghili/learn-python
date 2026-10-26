/**
 * Differential test: TypeScript simulator vs. CPython ground truth.
 *
 * Each case in `cases.ts` carries a hand-verified CPython result. The
 * in-process test here asserts the simulator's behaviour against that
 * ground truth, per class:
 *
 *   - `parity` cases: the simulator must already agree with CPython. If it
 *     does not, a regression has entered the engine — fail loudly.
 *   - `drift` cases: a KNOWN divergence from the remediation brief. The
 *     simulator must currently disagree with CPython. If it starts agreeing,
 *     the drift has been closed and the case must be reclassified to `parity`
 *     (the assertion below forces that flip, which is how the brief's
 *     "drift list shrinks to zero" is measured mechanically).
 *
 * The `expected` values themselves are re-verified against *real* CPython by
 * the `tests/differential/oracle.py` job (CI, Python 3.12), which runs the
 * same sources through the actual interpreter and diffs against the
 * `expected` field. That keeps the ground-truth column honest rather than a
 * re-statement of the simulator.
 */

import { describe, it, expect } from 'vitest';

import { CASES } from './cases';
import { runSimCase } from './harness';

describe('differential: TS simulator vs. CPython', () => {
  for (const c of CASES) {
    it(`[${c.expect}] ${c.id}: ${c.note}`, () => {
      const sim = runSimCase(c.id, c.source);
      const simText = toComparable(sim);
      const expectedText = toComparable(c.expected);

      if (c.expect === 'parity') {
        expect(
          simText,
          `${c.id}: TS simulator no longer matches CPython for: ${c.note}`,
        ).toBe(expectedText);
      } else {
        // drift: the simulator must currently be wrong. When this assertion
        // starts failing, the drift has been closed — move the case to
        // `parity` so it is guarded as a regression test from then on.
        expect(
          simText,
          `${c.id}: expected the TS simulator to diverge from CPython; it now agrees — reclassify as parity`,
        ).not.toBe(expectedText);
      }
    });
  }

  it('the known-drift list is explicit and currently matches the catalog', () => {
    const drifts = CASES.filter((c) => c.expect === 'drift').map((c) => c.id).sort();
    expect(drifts).toEqual(['drift-iadd', 'drift-unbound']);
  });
});

/** Portable normalisation: stdout text, or `EXC:<TypeName>` for exceptions. */
function toComparable(r: { kind: 'ok' | 'exc'; text?: string; excType?: string }): string {
  return r.kind === 'ok' ? (r.text ?? '') : `EXC:${r.excType ?? '?'}`;
}
