/**
 * Inline schematics: a declarative diagram spec rendered to a self-contained
 * SVG string and embedded in markdown via a ```schematic fenced block.
 *
 * The spec is pure data (nodes + edges). A small layered layout positions the
 * nodes top-to-bottom, and the result is drawn with the same palette as the
 * memory canvas. Kept DOM-free (it emits a markup string) so it drops straight
 * into renderMarkdown's innerHTML and stays unit-testable in the node test env.
 */

export type SchematicNodeType = 'box' | 'buffer' | 'note';

export interface SchematicNode {
  id: string;
  label: string;
  /** Optional second line under the label (type, offset, size). */
  sub?: string;
  /** Visual style. Default 'box'. */
  type?: SchematicNodeType;
}

export interface SchematicEdge {
  from: string;
  to: string;
  label?: string;
  /** Dashed + coral = "shared / aliased / view"; solid + amber = "points at / owns". */
  dashed?: boolean;
}

export interface SchematicLegend {
  color: 'amber' | 'teal' | 'coral' | 'muted';
  label: string;
}

export interface SchematicSpec {
  id: string;
  title?: string;
  nodes: SchematicNode[];
  edges: SchematicEdge[];
  legend?: SchematicLegend[];
}

/** Same palette as the memory canvas (src/ui/memory.ts). */
const COLORS = {
  ink: '#E7EEF2',
  muted: '#8FA0A8',
  amber: '#F0A050',
  teal: '#5BC4B0',
  coral: '#F07070',
  raised: '#1C252A',
  panel: '#141A1E',
  buffer: '#223038',
  line: '#2A353B',
};

const MONO = 'IBM Plex Mono, monospace';
const SANS = 'IBM Plex Sans, sans-serif';

const BOX_W = 134;
const BOX_H = 48;
const H_GAP = 30;
const ROW_H = BOX_H + 28;
const PADDING = 18;

export interface PlacedNode {
  node: SchematicNode;
  cx: number;
  top: number;
  w: number;
  h: number;
}

export interface SchematicLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
}

/**
 * Assign each node a layer (row) by its longest path from a source node. This
 * gives a clean top-to-bottom flow. Relaxation is capped at N passes so a cycle
 * can never loop forever; disconnected nodes simply keep their current layer.
 */
function computeLayers(spec: SchematicSpec): number[] {
  const ids = spec.nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const e of spec.edges) {
      if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
      const cand = (layer.get(e.from) ?? 0) + 1;
      if (cand > (layer.get(e.to) ?? 0)) {
        layer.set(e.to, cand);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return ids.map((id) => layer.get(id) ?? 0);
}

/**
 * Pure layout: group nodes into rows by layer, center each row, and return the
 * absolute position of every node. Deterministic for a given spec.
 */
export function layoutSchematic(spec: SchematicSpec): SchematicLayout {
  const layers = computeLayers(spec);
  const maxLayer = Math.max(0, ...layers);

  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  spec.nodes.forEach((n, i) => byLayer[layers[i]!]!.push(n.id));

  const titleH = spec.title ? 26 : 0;
  const legendH = spec.legend?.length ? 12 + spec.legend.length * 18 : 0;

  const rowWidths = byLayer.map((row) => row.length * BOX_W + Math.max(0, row.length - 1) * H_GAP);
  const canvasW = Math.max(BOX_W, ...rowWidths) + PADDING * 2;
  const height = titleH + PADDING + (maxLayer + 1) * ROW_H + legendH + PADDING;

  const nodes: PlacedNode[] = spec.nodes.map((n, i) => {
    const l = layers[i]!;
    const row = byLayer[l]!;
    const idxInRow = row.indexOf(n.id);
    const left = PADDING + (canvasW - PADDING * 2 - rowWidths[l]!) / 2 + idxInRow * (BOX_W + H_GAP);
    return { node: n, cx: left + BOX_W / 2, top: titleH + PADDING + l * ROW_H, w: BOX_W, h: BOX_H };
  });

  return { width: canvasW, height, nodes };
}

/**
 * Validate + normalize a raw schematic (as parsed from the fenced JSON). Throws
 * on any malformed node/edge so a broken diagram degrades to showing its source.
 */
export function parseSchematic(json: string): SchematicSpec {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('schematic: invalid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('schematic: not an object');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.nodes) || !Array.isArray(r.edges)) {
    throw new Error('schematic: needs nodes[] and edges[]');
  }

  const nodes: SchematicNode[] = (r.nodes as unknown[]).map((entry, i) => {
    const m = entry as Partial<SchematicNode>;
    if (typeof m?.id !== 'string' || typeof m.label !== 'string') {
      throw new Error(`schematic: node[${i}] needs an id and a label`);
    }
    return {
      id: m.id,
      label: m.label,
      sub: typeof m.sub === 'string' ? m.sub : undefined,
      type: m.type === 'box' || m.type === 'buffer' || m.type === 'note' ? m.type : undefined,
    };
  });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    throw new Error('schematic: duplicate node ids');
  }
  const ids = new Set(nodes.map((n) => n.id));

  const edges: SchematicEdge[] = (r.edges as unknown[]).map((entry, i) => {
    const m = entry as Partial<SchematicEdge>;
    if (typeof m?.from !== 'string' || typeof m.to !== 'string') {
      throw new Error(`schematic: edge[${i}] needs from and to`);
    }
    if (!ids.has(m.from) || !ids.has(m.to)) {
      throw new Error(`schematic: edge[${i}] references an unknown node`);
    }
    return {
      from: m.from,
      to: m.to,
      label: typeof m.label === 'string' ? m.label : undefined,
      dashed: m.dashed === true,
    };
  });

  const legend = Array.isArray(r.legend)
    ? (r.legend as SchematicLegend[]).filter((l) => l && typeof l.label === 'string' && typeof l.color === 'string')
    : undefined;

  return {
    id: typeof r.id === 'string' ? r.id : 'diagram',
    title: typeof r.title === 'string' ? r.title : undefined,
    nodes,
    edges,
    legend,
  };
}

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function svgText(
  x: number,
  y: number,
  text: string,
  fill: string,
  size: number,
  anchor: 'start' | 'middle' | 'end' = 'start',
  family: string = SANS,
  halo = false,
): string {
  const stroke = halo ? ` paint-order="stroke" stroke="${COLORS.panel}" stroke-width="3.5" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle" font-family="${family}"${stroke}>${esc(text)}</text>`;
}

function nodeRect(p: PlacedNode): string {
  const { node } = p;
  const x = p.cx - p.w / 2;
  const y = p.top;
  const isNote = node.type === 'note';
  const isBuffer = node.type === 'buffer';
  const stroke = isNote ? COLORS.muted : isBuffer ? COLORS.teal : COLORS.line;
  const fill = isNote ? 'none' : isBuffer ? COLORS.buffer : COLORS.raised;
  const dash = isNote ? ' stroke-dasharray="4 3"' : '';
  const labelFill = isNote ? COLORS.muted : COLORS.ink;
  const hasSub = Boolean(node.sub);
  const labelY = hasSub ? y + p.h / 2 - 8 : y + p.h / 2;
  const subY = y + p.h / 2 + 9;
  let out = `<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.2"${dash}/>`;
  out += svgText(x + p.w / 2, labelY, node.label, labelFill, 12.5, 'middle', MONO);
  if (hasSub) out += svgText(x + p.w / 2, subY, node.sub!, isNote ? COLORS.muted : COLORS.teal, 9.5, 'middle', MONO);
  return out;
}

function edgePath(a: PlacedNode, b: PlacedNode, e: SchematicEdge, marker: string): string {
  const x1 = a.cx;
  const y1 = a.top + a.h;
  const x2 = b.cx;
  const y2 = b.top;
  const color = e.dashed ? COLORS.coral : COLORS.amber;
  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  const dash = e.dashed ? ' stroke-dasharray="5 4"' : '';
  let out = `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"${dash} marker-end="url(#${marker})"/>`;
  if (e.label) out += svgText((x1 + x2) / 2, midY, e.label, color, 10, 'middle', MONO, true);
  return out;
}

/** Render a validated spec to a self-contained inline SVG string. */
export function renderSchematic(spec: SchematicSpec): string {
  const layout = layoutSchematic(spec);
  const marker = `sch-arrow-${spec.id.replace(/[^a-z0-9]/gi, '')}`;
  const parts: string[] = [];
  parts.push(
    `<svg class="schematic" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" ` +
      `style="max-width:100%;height:auto;display:block;margin:14px auto" role="img" aria-label="${esc(spec.title ?? spec.id)}">`,
  );
  parts.push(
    `<defs><marker id="${marker}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">` +
      `<path d="M0,0 L8,4 L0,8" fill="none" stroke="${COLORS.amber}" stroke-width="1.2"/></marker></defs>`,
  );
  if (spec.title) {
    parts.push(svgText(layout.width / 2, 17, spec.title, COLORS.ink, 13, 'middle', 'Fraunces, Georgia, serif'));
  }

  const pos = new Map(layout.nodes.map((p) => [p.node.id, p]));
  for (const e of spec.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    parts.push(edgePath(a, b, e, marker));
  }
  for (const p of layout.nodes) parts.push(nodeRect(p));

  if (spec.legend?.length) {
    const baseY = layout.height - PADDING - 2;
    let lx = PADDING;
    for (const item of spec.legend) {
      const color = COLORS[item.color] ?? COLORS.muted;
      parts.push(`<rect x="${lx}" y="${baseY - 8}" width="13" height="13" rx="3" fill="${color}" opacity="0.35" stroke="${color}"/>`);
      parts.push(svgText(lx + 19, baseY - 1, item.label, COLORS.muted, 10, 'start', MONO));
      lx += 19 + item.label.length * 6.1 + 18;
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

/**
 * Build the ```schematic fenced block that embeds a spec in a lesson's markdown.
 * Returns a ready-to-interpolate runtime string, so lesson template literals
 * never have to escape backticks by hand.
 */
export function schematicBlock(spec: SchematicSpec): string {
  return '```schematic\n' + JSON.stringify(spec, null, 2) + '\n```';
}
