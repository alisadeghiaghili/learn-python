/**
 * Level catalog barrel. Assembles the per-series modules (one file each) into
 * the ordered `sequences` list, plus the flat accessors the UI and tests use.
 * English is the base language (lives in the series files).
 */

import type { Level, Sequence } from '../engine/types';
import { series as basics } from './basics';
import { series as flow } from './flow';
import { series as loops } from './loops';
import { series as names } from './names';
import { series as aliasing } from './aliasing';
import { series as containers } from './containers';
import { series as copySemantics } from './copy-semantics';
import { series as iterators } from './iterators';
import { series as functional } from './functional';
import { series as numpy } from './numpy';
import { series as pandas } from './pandas';
import { series as asyncio } from './asyncio';
import { series as threading } from './threading';
import { series as mutation } from './mutation';
import { series as functions } from './functions';
import { series as plotting } from './plotting';
import { series as slicing } from './slicing';
import { series as recursion } from './recursion';
import { series as closures } from './closures';
import { series as regex } from './regex';
import { series as typingPydantic } from './typing-pydantic';
import { series as docstrings } from './docstrings';
import { series as testingPytest } from './testing-pytest';
import { series as sqlalchemy } from './sqlalchemy';
import { series as production } from './production';

/**
 * All series, in teaching order.
 *
 * Pure-Python spine first (basics → flow → loops → functions), then the memory
 * model (names → containers → mutation → aliasing → copy-semantics → iterators),
 * then functional + data libraries (functional → numpy → pandas), and finally
 * concurrency (asyncio → threading) plus plotting.
 *
 * Prerequisites are respected: `functions` (def) precedes the libraries and
 * concurrency series that use it, and `mutation` (.append) precedes `aliasing`
 * and `copy-semantics`, which mutate lists.
 */
export const sequences: Sequence[] = [
  ...basics,
  ...flow,
  ...loops,
  ...functions,
  ...names,
  ...containers,
  ...mutation,
  ...aliasing,
  ...copySemantics,
  ...iterators,
  ...functional,
  ...numpy,
  ...pandas,
  ...slicing,
  ...recursion,
  ...closures,
  ...docstrings,
  ...regex,
  ...typingPydantic,
  ...testingPytest,
  ...asyncio,
  ...threading,
  ...sqlalchemy,
  ...plotting,
  ...production,
];

/**
 * Flatten all levels in order.
 */
export function allLevels(): Level[] {
  return sequences.flatMap((s) => s.levels);
}

/**
 * Look up a level by id.
 */
export function getLevel(id: string): Level | null {
  return allLevels().find((l) => l.id === id) || null;
}

/**
 * Index of a level in the flat list, or -1.
 */
export function levelIndex(id: string): number {
  return allLevels().findIndex((l) => l.id === id);
}

/**
 * The series a level belongs to (for its deep lesson), or null.
 */
export function sequenceForLevel(id: string): Sequence | null {
  return sequences.find((s) => s.levels.some((l) => l.id === id)) ?? null;
}
