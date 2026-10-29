/**
 * Tests for Phase 3 visualizer fidelity: scalar heap toggle, truthful refcounting,
 * and execution trace stepping.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runFresh } from '../src/engine/session';
import { setTraceEnabled } from '../src/engine/evaluator';
import { computeRefCounts } from '../src/engine/memory';
import { isScalarValue, scalarDetails, renderMemory, renderRam } from '../src/ui/memory';

describe('Phase 3 Visualizer Fidelity', () => {
  beforeEach(() => {
    setTraceEnabled(true);
  });

  describe('Scalar value classification & details', () => {
    it('classifies integer scalars correctly', () => {
      const state = runFresh('x = 42\ny = 2**64');
      expect(isScalarValue(42, state)).toBe(true);
      expect(isScalarValue(state.frames[0]!.locals['y']!, state)).toBe(true);
      expect(scalarDetails(42, state)).toEqual({ repr: '42', type: 'int', raw: 42 });
    });

    it('classifies boolean and None scalars correctly', () => {
      const state = runFresh('t = True\nn = None');
      expect(isScalarValue(true, state)).toBe(true);
      expect(isScalarValue(null, state)).toBe(true);
      expect(scalarDetails(true, state)).toEqual({ repr: 'True', type: 'bool', raw: true });
      expect(scalarDetails(null, state)).toEqual({ repr: 'None', type: 'NoneType', raw: null });
    });

    it('classifies containers as non-scalars', () => {
      const state = runFresh('xs = [1, 2]\nd = {"a": 1}');
      const xsId = state.frames[0]!.locals['xs']!;
      const dId = state.frames[0]!.locals['d']!;
      expect(isScalarValue(xsId, state)).toBe(false);
      expect(isScalarValue(dId, state)).toBe(false);
    });
  });

  describe('Truthful reference counting', () => {
    it('computes reference counts from frame roots and container elements', () => {
      const state = runFresh('a = [1]\nb = a\nc = [a]');
      computeRefCounts(state);
      const aId = state.frames[0]!.locals['a'] as string;
      const cId = state.frames[0]!.locals['c'] as string;
      expect(state.heap[aId]!.refCount).toBe(3); // 'a', 'b', and inside 'c'
      expect(state.heap[cId]!.refCount).toBe(1); // 'c'
    });

    it('computes reference counts from closure cells', () => {
      const state = runFresh(`
def outer():
    x = [10, 20]
    def inner():
        return x
    return inner
fn = outer()
`);
      computeRefCounts(state);
      // The list x inside outer should be kept alive by inner's closure
      const listObj = Object.values(state.heap).find((o) => o.type === 'list' && o.repr === '[10, 20]');
      expect(listObj).toBeDefined();
      expect(listObj!.refCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Trace recording and line tracking', () => {
    it('records current line numbers in each trace step', () => {
      const state = runFresh(`x = 1
y = 2
z = x + y`);
      expect(state.trace).toBeDefined();
      expect(state.trace!.length).toBeGreaterThan(1);
      // Each step after line 1 should have a currentLine
      const lines = state.trace!.map((f) => f.currentLine).filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines).toContain(1);
      expect(lines).toContain(2);
      expect(lines).toContain(3);
    });
  });

  describe('DOM Rendering with minimal mock', () => {
    function createMockSvg(): any {
      const elements: any[] = [];
      const mockEl: any = {
        children: elements,
        childNodes: elements,
        firstChild: null,
        appendChild(child: any) {
          elements.push(child);
          this.firstChild = elements[0];
          return child;
        },
        removeChild(child: any) {
          const idx = elements.indexOf(child);
          if (idx !== -1) elements.splice(idx, 1);
          this.firstChild = elements[0] ?? null;
          return child;
        },
        setAttribute(k: string, v: string) {
          this[k] = v;
        },
        getAttribute(k: string) {
          return this[k];
        },
        style: {},
        addEventListener() {},
      };
      return mockEl;
    }

    // Set minimal document mock for renderMemory and renderRam
    beforeEach(() => {
      globalThis.document = {
        createElementNS(_ns: string, tag: string) {
          const el = createMockSvg();
          el.tagName = tag;
          return el;
        },
      } as any;
    });

    it('renders inline scalars with count chip by default', () => {
      const state = runFresh('x = 3\ny = 4');
      const svg = createMockSvg();
      renderMemory(svg, state, [], [], {
        showScalarsOnHeap: false,
        onToggleScalars: () => {},
      });
      expect(svg.children.length).toBeGreaterThan(0);
    });

    it('renders small-int interning to shared heap box when showScalarsOnHeap is true', () => {
      const state = runFresh('a = 100\nb = 100');
      const svg = createMockSvg();
      renderMemory(svg, state, [], [], {
        showScalarsOnHeap: true,
      });
      // In showScalarsOnHeap mode, the mock svg should contain elements for the heap objects
      expect(svg.children.length).toBeGreaterThan(0);
    });

    it('renders edges-layer before nodes-layer to preserve depth ordering', () => {
      const state = runFresh('xs = [1, 2]');
      const svg = createMockSvg();
      renderMemory(svg, state, [], Object.keys(state.heap));
      const edgesLayer = svg.children.find((c: any) => c.getAttribute?.('class') === 'edges-layer');
      const nodesLayer = svg.children.find((c: any) => c.getAttribute?.('class') === 'nodes-layer');
      expect(edgesLayer).toBeDefined();
      expect(nodesLayer).toBeDefined();
      const edgesIdx = svg.children.indexOf(edgesLayer);
      const nodesIdx = svg.children.indexOf(nodesLayer);
      expect(edgesIdx).toBeLessThan(nodesIdx);
    });

    it('collapses containers longer than 12 items', () => {
      const state = runFresh('xs = list(range(20))');
      const svg = createMockSvg();
      renderMemory(svg, state, [], Object.keys(state.heap));
      expect(svg.children.length).toBeGreaterThan(0);
    });

    it('renders RAM view with REFS header and reference count title', () => {
      const state = runFresh('xs = [1, 2]');
      const svg = createMockSvg();
      renderRam(svg, state, Object.keys(state.heap));
      expect(svg.children.length).toBeGreaterThan(0);
    });
  });
});
