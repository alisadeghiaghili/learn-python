/**
 * Python exception hierarchy for learn-python simulator.
 * All simulated exceptions subclass PyException to enable both JavaScript try/catch
 * and Python try/except matching against the exception class hierarchy.
 */

export class PyException extends Error {
  /** The CPython exception type name (e.g. 'TypeError', 'ValueError') */
  readonly pythonName: string;

  constructor(pythonName: string, message: string) {
    super(message ? `${pythonName}: ${message}` : pythonName);
    this.name = pythonName;
    this.pythonName = pythonName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PyTypeError extends PyException {
  constructor(message = '') {
    super('TypeError', message);
  }
}

export class PyValueError extends PyException {
  constructor(message = '') {
    super('ValueError', message);
  }
}

export class PyZeroDivisionError extends PyException {
  constructor(message = 'division by zero') {
    super('ZeroDivisionError', message);
  }
}

export class PyIndexError extends PyException {
  constructor(message = 'index out of range') {
    super('IndexError', message);
  }
}

export class PyKeyError extends PyException {
  constructor(keyRepr: string) {
    super('KeyError', keyRepr);
  }
}

export class PyAttributeError extends PyException {
  constructor(message = '') {
    super('AttributeError', message);
  }
}

export class PyNameError extends PyException {
  constructor(message = '') {
    super('NameError', message);
  }
}

export class PyUnboundLocalError extends PyException {
  constructor(message = '') {
    super('UnboundLocalError', message);
  }
}

export class PyRecursionError extends PyException {
  constructor(message = 'maximum recursion depth exceeded') {
    super('RecursionError', message);
  }
}

export class PyStopIteration extends PyException {
  constructor(message = '') {
    super('StopIteration', message);
  }
}

export class PyModuleNotFoundError extends PyException {
  constructor(modName: string) {
    super('ModuleNotFoundError', `No module named '${modName}'`);
  }
}

export class PySyntaxError extends PyException {
  constructor(message = '') {
    super('SyntaxError', message);
  }
}

export class PyRuntimeError extends PyException {
  constructor(message = '') {
    super('RuntimeError', message);
  }
}

/** Internal flow control signal to pause/yield simulator execution in coroutines or thread context switches. */
export class PySuspend extends Error {
  constructor() {
    super('suspend');
    this.name = 'PySuspend';
  }
}

/** Internal flow control signal for Python return statements. */
export class PyReturn extends Error {
  readonly value: unknown;
  constructor(value: unknown) {
    super('return');
    this.name = 'PyReturn';
    this.value = value;
  }
}

/**
 * Check if a thrown error matches an expected exception class name or tuple.
 */
export function isExceptionInstanceOf(err: unknown, targetName: string): boolean {
  if (!(err instanceof PyException)) return false;
  const name = err.pythonName;
  if (name === targetName) return true;
  // CPython inheritance tree checks:
  if (targetName === 'BaseException' || targetName === 'Exception') {
    return true;
  }
  if (targetName === 'NameError' && name === 'UnboundLocalError') {
    return true;
  }
  if (targetName === 'ArithmeticError' && name === 'ZeroDivisionError') {
    return true;
  }
  if (targetName === 'LookupError' && (name === 'IndexError' || name === 'KeyError')) {
    return true;
  }
  return false;
}
