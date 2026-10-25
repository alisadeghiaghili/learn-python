/**
 * Pyodide & Real-Python execution lane for learn-python.
 *
 * Implements the dual-lane architecture (ADR 011):
 * - Runs complex Python code (re, pydantic, pytest, sqlalchemy, fastapi) via real Python.
 * - In Node/Vitest environments: uses child_process.spawnSync calling runner.py.
 * - In browser environments: lazy loads Pyodide WebAssembly with the introspection bridge.
 */

import type { MemoryState } from '../types';
import { createModuleState } from '../memory';

/** Cached Pyodide instance in the browser. */
let browserPyodide: unknown = null;
let pyodideLoadingPromise: Promise<unknown> | null = null;

/**
 * Check if running in a Node.js environment with child_process.
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

/**
 * Execute Python code synchronously in a Node.js environment via runner.py.
 */
export function runPyodideSync(source: string): MemoryState {
  if (isNodeEnvironment()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { spawnSync } = require('child_process') as typeof import('child_process');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');

      let pythonBin = 'python';
      const localToolsPy = path.resolve(__dirname, '../../../../.tools/python/python.exe');
      if (fs.existsSync(localToolsPy)) {
        pythonBin = localToolsPy;
      } else if (process.env.PYTHON_BIN) {
        pythonBin = process.env.PYTHON_BIN;
      }

      const runnerPath = path.resolve(__dirname, 'runner.py');
      const res = spawnSync(pythonBin, [runnerPath], {
        input: source,
        encoding: 'utf-8',
        timeout: 10000,
      });

      if (res.status === 0 && res.stdout) {
        const state = JSON.parse(res.stdout) as MemoryState;
        return state;
      }
      if (res.error) {
        throw res.error;
      }
      const state = createModuleState();
      state.errors = [res.stderr || 'Execution failed in Pyodide/CPython lane'];
      return state;
    } catch (err) {
      const state = createModuleState();
      state.errors = [err instanceof Error ? err.message : String(err)];
      return state;
    }
  }

  // Fallback if called outside Node without async Pyodide ready
  return createModuleState();
}

/**
 * Introspection script injected into Pyodide in browser environments.
 */
const BROWSER_INTROSPECT_SCRIPT = `
import sys
import io
import json
import gc
import inspect

def _learn_python_run(source_code):
    ns = {'__name__': '__main__'}
    old_stdout = sys.stdout
    buf = io.StringIO()
    sys.stdout = buf
    errors = []

    try:
        exec(source_code, ns)
    except Exception as e:
        import traceback
        errors.append(traceback.format_exc())
    finally:
        sys.stdout = old_stdout

    stdout_lines = buf.getvalue().splitlines(keepends=True)

    heap = {}
    id_map = {}
    next_id = 1

    def get_obj_id(obj):
        nonlocal next_id
        mem_id = id(obj)
        if mem_id not in id_map:
            id_map[mem_id] = f"obj_{next_id}"
            next_id += 1
        return id_map[mem_id]

    locals_map = {}
    ignored_names = {
        '__name__', '__doc__', '__package__', '__loader__', '__spec__',
        '__annotations__', '__builtins__', '_learn_python_run',
        'sys', 'io', 'gc', 'json', 'inspect'
    }

    def process_val(val, depth=0):
        if depth > 5:
            return repr(val)
        if val is None or isinstance(val, (bool, int, float)):
            return val

        obj_id = get_obj_id(val)
        if obj_id in heap:
            return obj_id

        val_type = type(val).__name__
        val_repr = repr(val)
        if len(val_repr) > 100:
            val_repr = val_repr[:97] + '...'

        try:
            byte_size = sys.getsizeof(val)
        except Exception:
            byte_size = 48

        heap_entry = {
            "id": obj_id,
            "type": val_type,
            "value": None,
            "repr": val_repr,
            "addr": id(val),
            "byteSize": max(24, byte_size),
            "refCount": max(1, len(gc.get_referents(val))),
            "seg": "heap"
        }
        heap[obj_id] = heap_entry

        if isinstance(val, str):
            heap_entry["value"] = val
        elif isinstance(val, (list, tuple)):
            heap_entry["value"] = [process_val(item, depth + 1) for item in val]
        elif isinstance(val, set):
            heap_entry["value"] = [process_val(item, depth + 1) for item in sorted(list(val), key=str)]
        elif isinstance(val, dict):
            entries = []
            for k, v in val.items():
                entries.append([str(k), process_val(v, depth + 1)])
            heap_entry["value"] = entries
        elif inspect.ismodule(val):
            heap_entry["value"] = f"<module '{getattr(val, '__name__', val_type)}'>"
        elif isinstance(val, type):
            heap_entry["value"] = f"<class '{getattr(val, '__name__', val_type)}'>"
        elif hasattr(val, "model_dump") and callable(getattr(val, "model_dump")):
            try:
                dump = val.model_dump()
                entries = []
                for k, v in dump.items():
                    entries.append([str(k), process_val(v, depth + 1)])
                heap_entry["value"] = entries
            except Exception:
                heap_entry["value"] = val_repr
        elif hasattr(val, "__dict__"):
            entries = []
            for k, v in val.__dict__.items():
                if not k.startswith('_'):
                    entries.append([str(k), process_val(v, depth + 1)])
            heap_entry["value"] = entries
        else:
            heap_entry["value"] = val_repr

        return obj_id

    for name, val in ns.items():
        if name in ignored_names:
            continue
        locals_map[name] = process_val(val)

    state = {
        "frames": [{"name": "module", "locals": locals_map}],
        "heap": heap,
        "stdout": stdout_lines,
        "errors": errors,
        "plots": [],
        "ticks": 0
    }
    return json.dumps(state)
`;

/**
 * Lazy loads Pyodide in the browser.
 */
export async function initPyodide(): Promise<unknown> {
  if (browserPyodide) return browserPyodide;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    if (typeof window === 'undefined') return null;

    // Check if Pyodide script is already present or load from public directory
    const win = window as unknown as { loadPyodide?: () => Promise<unknown> };
    if (!win.loadPyodide) {
      const script = document.createElement('script');
      script.src = './pyodide/pyodide.js';
      document.head.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => {
          // Fallback to CDN if self-hosted bundle is not pre-packaged
          const cdnScript = document.createElement('script');
          cdnScript.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
          cdnScript.onload = () => resolve();
          cdnScript.onerror = () => reject(new Error('Failed to load Pyodide'));
          document.head.appendChild(cdnScript);
        };
      });
    }

    if (win.loadPyodide) {
      const py = (await win.loadPyodide()) as {
        runPython: (s: string) => unknown;
        loadPackage: (p: string | string[]) => Promise<void>;
      };
      // Install introspection script
      py.runPython(BROWSER_INTROSPECT_SCRIPT);
      browserPyodide = py;
      return py;
    }
    return null;
  })();

  return pyodideLoadingPromise;
}

/**
 * Execute Python code asynchronously through Pyodide (browser) or CPython (Node).
 */
export async function runPyodide(source: string): Promise<MemoryState> {
  if (isNodeEnvironment()) {
    return runPyodideSync(source);
  }

  const py = (await initPyodide()) as {
    runPython: (s: string) => string;
  } | null;

  if (!py) {
    throw new Error('Pyodide is not initialized.');
  }

  // Invoke _learn_python_run with source code
  const jsonStr = py.runPython(`_learn_python_run(${JSON.stringify(source)})`);
  const state = JSON.parse(jsonStr) as MemoryState;
  return state;
}
