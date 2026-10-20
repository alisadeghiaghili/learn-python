import { ui } from '../i18n';

export interface UiElementDoc {
  selector: string;
  id: string;
  title: string;
  what: string;
  how: string;
}

/** The on-screen regions the UI guide documents, in reading order. */
export function uiElements(): UiElementDoc[] {
  return ui().helpSections;
}

/** The interactive UI map, rendered into the help modal. */
export function uiHelpModalHtml(): string {
  const u = ui();
  const sections = uiElements()
    .map(
      (e) => `
      <section class="ui-help-item" data-help-id="${e.id}">
        <div class="ui-help-head">
          <h3>${escapeHtml(e.title)}</h3>
          <button type="button" class="ui-help-focus" data-focus-id="${e.id}">${escapeHtml(u.highlightThis)}</button>
        </div>
        <div class="ui-help-what">${formatInline(e.what)}</div>
        <div class="ui-help-how"><strong>${escapeHtml(u.useIt)}</strong> ${formatInline(e.how)}</div>
      </section>
    `,
    )
    .join('');
  return `<div class="ui-help">${sections}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Escape, then render `**bold**` and newlines — content is author-controlled. */
function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

/** Outline the live regions briefly so the learner connects the docs to the pixels. */
export function startUiTour(root: ParentNode, focusId?: string, durationMs = 6000): () => void {
  root.querySelectorAll('.ui-tour-on').forEach((el) => el.classList.remove('ui-tour-on'));
  const elements = uiElements().filter((e) => !focusId || e.id === focusId);
  const nodes = elements
    .map((e) => root.querySelector(e.selector))
    .filter(Boolean) as Element[];
  nodes.forEach((n) => n.classList.add('ui-tour-on'));
  const stop = () => {
    nodes.forEach((n) => n.classList.remove('ui-tour-on'));
  };
  window.setTimeout(stop, durationMs);
  return stop;
}
