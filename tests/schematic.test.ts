/**
 * Schematic engine: declarative spec → SVG string, and the ```schematic
 * markdown fence that embeds it in lessons.
 */

import { describe, test, expect } from 'vitest';

import { parseSchematic, layoutSchematic, renderSchematic, schematicBlock, type SchematicSpec } from '../src/ui/schematic';
import { renderMarkdown } from '../src/ui/dialog';

const SPEC: SchematicSpec = {
  id: 't',
  title: 'Name → pointer → object',
  nodes: [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b', sub: 'list[2]' },
    { id: 'c', label: 'child', type: 'buffer' },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'points at' },
    { from: 'b', to: 'c', label: 'holds' },
  ],
};

describe('schematic', () => {
  test('parseSchematic normalizes a valid spec', () => {
    const s = parseSchematic(JSON.stringify(SPEC));
    expect(s.id).toBe('t');
    expect(s.nodes).toHaveLength(3);
    expect(s.nodes[1]!.sub).toBe('list[2]');
    expect(s.nodes[2]!.type).toBe('buffer');
    expect(s.edges).toHaveLength(2);
    expect(s.edges[0]!.dashed).toBe(false);
  });

  test('parseSchematic rejects malformed input', () => {
    expect(() => parseSchematic('not json')).toThrow();
    expect(() => parseSchematic('{"nodes":[],"edges":[]}')).not.toThrow();
    expect(() => parseSchematic('{"nodes":[{"id":"a"}],"edges":[]}')).toThrow(); // missing label
    expect(() => parseSchematic('{"nodes":[{"id":"a","label":"a"}],"edges":[{"from":"a","to":"zz"}]}')).toThrow(); // bad edge
    expect(() => parseSchematic('{"nodes":[{"id":"a","label":"a"},{"id":"a","label":"b"}],"edges":[]}')).toThrow(); // dup id
  });

  test('layout places a source above its target (layer order)', () => {
    const layout = layoutSchematic(SPEC);
    const byId = new Map(layout.nodes.map((p) => [p.node.id, p]));
    // a → b → c: each link's target sits on a lower row (larger y).
    expect(byId.get('b')!.top).toBeGreaterThan(byId.get('a')!.top);
    expect(byId.get('c')!.top).toBeGreaterThan(byId.get('b')!.top);
    // canvas is wide enough to hold the widest row plus padding
    expect(layout.width).toBeGreaterThanOrEqual(layout.nodes[0]!.w);
  });

  test('a cycle never hangs the layer solver', () => {
    const cycled: SchematicSpec = {
      id: 'cyc',
      nodes: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }],
      edges: [{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }],
    };
    const layout = layoutSchematic(cycled); // must return, not loop
    expect(layout.nodes).toHaveLength(2);
  });

  test('renderSchematic emits an svg with every node label and each edge', () => {
    const svg = renderSchematic(SPEC);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
    expect(svg).toContain('Name → pointer → object');
    for (const n of SPEC.nodes) expect(svg).toContain(n.label);
    expect(svg).toContain('points at');
    expect(svg).toContain('holds');
  });

  test('schematicBlock emits a ready ```schematic fenced block', () => {
    const block = schematicBlock(SPEC);
    expect(block.startsWith('```schematic\n')).toBe(true);
    expect(block.trimEnd().endsWith('```')).toBe(true);
    expect(() => parseSchematic(block.slice('```schematic\n'.length, block.trimEnd().lastIndexOf('```')))).not.toThrow();
  });
});

describe('renderMarkdown schematic fence', () => {
  test('a ```schematic fence renders to an inline <svg>', () => {
    const md = `Intro line.\n\n${schematicBlock(SPEC)}\n\nAfter.`;
    const html = renderMarkdown(md);
    expect(html).toContain('<svg class="schematic"');
    expect(html).toContain('Intro line.');
    expect(html).toContain('After.');
  });

  test('malformed schematic degrades to a code block, not a crash', () => {
    const md = '```schematic\n{ not valid\n```\n';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="md-code" data-lang="schematic">');
    expect(html).toContain('{ not valid');
    expect(html).not.toContain('<svg');
  });

  test('non-schematic fences are untouched', () => {
    const html = renderMarkdown('```python\nx = 1\n```\n');
    expect(html).toContain('<pre class="md-code" data-lang="python">');
    expect(html).not.toContain('<svg');
  });
});
