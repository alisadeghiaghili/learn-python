"""
Memory Introspection Bridge for learn-python (Dual-lane execution).

Transforms Python runtime locals and heap into the standard MemoryState JSON
structure consumed by the Memory, Stack, Heap, and RAM boards.
"""

import sys
import gc
import json
import inspect

def serialize_runtime(user_namespace: dict, stdout_lines: list, error_lines: list) -> str:
    heap = {}
    id_map = {}
    next_id = 1

    def get_obj_id(obj) -> str:
        nonlocal next_id
        mem_id = id(obj)
        if mem_id not in id_map:
            id_map[mem_id] = f"obj_{next_id}"
            next_id += 1
        return id_map[mem_id]

    # Walk namespace to collect objects
    locals_map = {}
    ignored_names = {
        '__name__', '__doc__', '__package__', '__loader__', '__spec__',
        '__annotations__', '__builtins__', '_pyodide_run', 'serialize_runtime',
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

        # Placeholder to break cycles
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
            # Pydantic v2 model
            try:
                dump = val.model_dump()
                entries = []
                for k, v in dump.items():
                    entries.append([str(k), process_val(v, depth + 1)])
                heap_entry["value"] = entries
            except Exception:
                heap_entry["value"] = val_repr
        elif hasattr(val, "__dict__"):
            # Class instance
            entries = []
            for k, v in val.__dict__.items():
                if not k.startswith('_'):
                    entries.append([str(k), process_val(v, depth + 1)])
            heap_entry["value"] = entries
        else:
            heap_entry["value"] = val_repr

        return obj_id

    for name, val in user_namespace.items():
        if name in ignored_names:
            continue
        locals_map[name] = process_val(val)

    # Frame list (currently module level, extensible to stack frames)
    frames = [{
        "name": "module",
        "locals": locals_map
    }]

    state = {
        "frames": frames,
        "heap": heap,
        "stdout": stdout_lines,
        "errors": error_lines,
        "plots": [],
        "ticks": 0
    }
    return json.dumps(state)

if __name__ == "__main__":
    test_ns = {
        "x": 42,
        "text": "hello world",
        "items": [1, 2, "nested"],
        "info": {"status": "ok", "count": 3}
    }
    print(serialize_runtime(test_ns, ["output 1\n"], []))
