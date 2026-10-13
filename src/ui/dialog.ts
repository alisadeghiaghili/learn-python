/**
 * HTML escaping, minimal markdown, and modal dialogs (ported from learn-r).
 */

import { parseSchematic, renderSchematic } from './schematic';

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInline(raw: string): string {
  const slots: string[] = [];
  const parts = raw.split(/(<a\b[\s\S]*?<\/a>)/gi);
  const mapped = parts
    .map((part, i) => {
      if (i % 2 === 1) {
        slots.push(part);
        return '@@HTML' + (slots.length - 1) + '@@';
      }
      let t = escapeHtml(part);
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, label: string, href: string) =>
          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      );
      return t;
    })
    .join('');
  return mapped.replace(/@@HTML(\d+)@@/g, (_m, i: string) => slots[Number(i)] ?? '');
}

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  const s = line.trim();
  if (!s.includes('|')) return false;
  return s.startsWith('|')
    ? s.endsWith('|') && splitTableRow(s).length >= 1
    : s.split('|').length >= 2;
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return (
    cells.length >= 1 &&
    cells.every((c) => /^:?-+:?$/.test(c.trim()) && c.includes('-'))
  );
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return '';
  const header = splitTableRow(rows[0]!);
  const body = rows.slice(2);
  const headHtml = header.map((h) => `<th>${renderInline(h)}</th>`).join('');
  const bodyHtml = body
    .map(
      (r) =>
        `<tr>${splitTableRow(r)
          .map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function isListItem(line: string): boolean {
  return /^\s*[-*+]\s+\S/.test(line) || /^\s*\d+\.\s+\S/.test(line);
}

function renderListItem(line: string): string {
  const s = line.trim().replace(/^([-*+]|\d+\.)\s+/, '');
  return `<li>${renderInline(s)}</li>`;
}

function renderProse(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${para.map(renderInline).join('<br/>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.join('')}</ul>`);
    list = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
      flushAll();
      const rows = [line, lines[i + 1]!];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]!) && !isTableSeparator(lines[i]!)) {
        rows.push(lines[i]!);
        i += 1;
      }
      out.push(renderTable(rows));
      continue;
    }
    if (!line.trim()) {
      flushAll();
      i += 1;
      continue;
    }
    if (isListItem(line)) {
      flushPara();
      list.push(renderListItem(line));
      i += 1;
      continue;
    }
    flushList();
    para.push(line);
    i += 1;
  }
  flushAll();
  return out.join('');
}

/**
 * Parse + render a ```schematic block, or fall back to showing the raw source
 * if the spec is malformed (a broken diagram should read as data, not vanish).
 */
function renderSchematicSafe(json: string): string {
  try {
    return renderSchematic(parseSchematic(json));
  } catch {
    return `<pre class="md-code" data-lang="schematic"><code>${escapeHtml(json)}</code></pre>`;
  }
}

export function renderMarkdown(md: string): string {
  const blocks = md.split(/```/);
  let html = '';
  blocks.forEach((block, i) => {
    if (i % 2 === 1) {
      const firstNewline = block.indexOf('\n');
      const lang = firstNewline >= 0 ? block.slice(0, firstNewline).trim() : '';
      const code = (firstNewline >= 0 ? block.slice(firstNewline + 1) : block).trimEnd();
      if (lang === 'schematic') {
        // A diagram: render the JSON spec to an inline SVG. On any parse error
        // fall back to showing the raw source so a broken spec degrades visibly.
        html += renderSchematicSafe(code);
      } else {
        html += `<pre class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(code)}</code></pre>`;
      }
    } else {
      const sections = block.split(/(^#{1,3}\s+.*$)/m);
      for (const sec of sections) {
        const hMatch = sec.match(/^(#{1,3})\s+(.*)$/);
        if (hMatch) {
          const level = hMatch[1]!.length;
          html += `<h${level + 1}>${renderInline(hMatch[2]!)}</h${level + 1}>`;
        } else if (sec.trim()) {
          html += renderProse(sec);
        }
      }
    }
  });
  return html;
}

export interface ModalAction {
  label: string;
  className?: string;
  onClick: () => void;
}

export interface ModalSpec {
  title: string;
  bodyHtml: string;
  actions?: ModalAction[];
  onDismiss?: () => void;
  onClose?: () => void;
  variant?: 'default' | 'celebrate';
}

let activeOverlay: HTMLElement | null = null;
let activeDismiss: (() => void) | undefined;

export function showModal(spec: ModalSpec): { close: () => void; el: HTMLElement } {
  closeModal();

  const isCelebrate = spec.variant === 'celebrate';
  const overlay = document.createElement('div');
  overlay.className = `overlay${isCelebrate ? ' overlay-celebrate' : ''}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = `modal${isCelebrate ? ' modal-celebrate' : ''}`;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', spec.title);

  const h2 = document.createElement('h2');
  if (isCelebrate) {
    h2.className = 'visually-hidden';
  }
  h2.textContent = spec.title;
  card.appendChild(h2);

  const body = document.createElement('div');
  body.className = 'markdown modal-body';
  body.innerHTML = spec.bodyHtml;
  card.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'modal-actions';

  const close = () => {
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
    if (activeOverlay === overlay) {
      activeOverlay = null;
      activeDismiss = undefined;
    }
    spec.onDismiss?.();
    spec.onClose?.();
  };

  const actions = spec.actions && spec.actions.length ? spec.actions : [{ label: 'Close', onClick: () => close() }];
  actions.forEach((act) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = (act.className ?? '').trim();
    btn.textContent = act.label;
    btn.addEventListener('click', () => {
      close();
      act.onClick();
    });
    footer.appendChild(btn);
  });

  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  activeOverlay = overlay;
  activeDismiss = spec.onDismiss;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  const firstBtn = footer.querySelector('button');
  firstBtn?.focus();

  return {
    close,
    el: overlay,
  };
}

export function closeModal(): void {
  if (activeOverlay) {
    const prev = activeOverlay;
    const dismiss = activeDismiss;
    activeOverlay = null;
    activeDismiss = undefined;
    if (document.body.contains(prev)) {
      prev.remove();
    }
    dismiss?.();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeOverlay) {
      closeModal();
    }
  });
}
