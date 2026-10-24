/**
 * Master method dispatcher for heap objects.
 */

import { callListMethod } from './list';
import { callDictMethod } from './dict';
import { callSetMethod } from './set';
import { callStrMethod } from './str';
import { dispatchNdarrayMethod } from '../libs/numpy';
import { dispatchPandasMethod } from '../libs/pandas';
import { dispatchThreadingMethod } from '../libs/threading';
import type { AstNode, HeapObject, MemoryState, RtValue } from '../types';

/**
 * Dispatch a method call on a heap object to its type-specific handler.
 */
export function dispatchObjectMethod(
  obj: HeapObject,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  execStatement: (node: AstNode, state: MemoryState) => void,
  refreshReprs: (state: MemoryState) => void,
): RtValue {
  switch (obj.type) {
    case 'list':
      return callListMethod(obj, method, args, state, line);
    case 'dict':
      return callDictMethod(obj, method, args, state, line);
    case 'set':
      return callSetMethod(obj, method, args, state, line);
    case 'str':
      return callStrMethod(obj, method, args, state, line);
    case 'ndarray':
      return dispatchNdarrayMethod(obj.id, method, args, state, line);
    case 'series':
    case 'dataframe':
      return dispatchPandasMethod(obj.id, method, args, state, line);
    case 'thread':
    case 'lock':
      return dispatchThreadingMethod(obj.id, method, args, state, line, execStatement, refreshReprs);
    default:
      throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
  }
}
