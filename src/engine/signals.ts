/**
 * Internal evaluator control flow signals.
 */

import type { RtValue } from './types';

/**
 * Signal used to unwind execution to a function call boundary on `return`.
 */
export class PyReturn extends Error {
  value: RtValue;
  constructor(value: RtValue) {
    super('return');
    this.value = value;
  }
}

/**
 * Signal used to suspend a coroutine on `await` or a thread on a held lock.
 */
export class PySuspend extends Error {
  constructor() {
    super('suspend');
  }
}

/**
 * Signal used to exit the innermost loop on `break`.
 */
export class PyBreak extends Error {
  constructor() {
    super('break');
  }
}

/**
 * Signal used to skip to the next iteration of the innermost loop on `continue`.
 */
export class PyContinue extends Error {
  constructor() {
    super('continue');
  }
}
