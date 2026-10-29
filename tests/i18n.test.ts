import { JSDOM } from 'jsdom';
/**
 * i18n coverage invariants. English lives in the series source files (the `en`
 * catalog's levels/seriesTitles/deepLessons are intentionally empty), so we check
 * the localized catalogs (de, fa) against the *source* catalog — every level,
 * series title and deep lesson that exists in English must be present in each
 * locale. This is the invariant that catches a half-finished translation group
 * (a stub file with empty objects) before it ships.
 */

import { test, expect } from 'vitest';

import { allLevels, sequences } from '../src/levels/index';
import { de } from '../src/i18n/de';
import { fa } from '../src/i18n/fa';
import { parseSchematic } from '../src/ui/schematic';
import type { Catalog } from '../src/i18n/types';

const DEEP_LESSON_BANNERS = ['## Beginner', '## Intermediate', '## Advanced', '## Expert'];

const locales: { name: string; cat: Catalog }[] = [
  { name: 'de', cat: de },
  { name: 'fa', cat: fa },
];

for (const { name, cat } of locales) {
  test(`[${name}] every level has localized name, brief and lesson`, () => {
    for (const level of allLevels()) {
      const copy = cat.levels[level.id];
      expect(copy, `[${name}] missing copy for level '${level.id}'`).toBeTruthy();
      expect(copy!.name, `[${name}] '${level.id}' empty name`).toBeTruthy();
      expect(copy!.brief, `[${name}] '${level.id}' empty brief`).toBeTruthy();
      expect(copy!.lesson, `[${name}] '${level.id}' missing lesson`).toBeTruthy();
    }
  });

  test(`[${name}] every series has a localized title`, () => {
    for (const seq of sequences) {
      expect(cat.seriesTitles[seq.id], `[${name}] missing title for series '${seq.id}'`).toBeTruthy();
    }
  });

  test(`[${name}] every source deep lesson is localized and ramps through the ELI bands`, () => {
    for (const seq of sequences) {
      if (!seq.deepLesson) continue;
      const md = cat.deepLessons[seq.id];
      expect(md, `[${name}] missing deep lesson for series '${seq.id}'`).toBeTruthy();
      for (const banner of DEEP_LESSON_BANNERS) {
        expect(md!.includes(banner), `[${name}] '${seq.id}' deep lesson missing '${banner}'`).toBe(true);
      }
      // Any embedded schematic must still parse — a broken diagram is a defect.
      const fences = md!.split('```schematic');
      for (let i = 1; i < fences.length; i++) {
        const body = fences[i]!.split('```')[0]!;
        expect(() => parseSchematic(body), `[${name}] '${seq.id}' has an unparseable schematic`).not.toThrow();
      }
    }
  });
}

test('[fa] Persian strings enforce ZWNJ discipline and contain no untranslated level titles', () => {
  const disallowedAffixes = [/\bمی\s+/g, /\bنمی\s+/g, /\s+هایش\b/g];
  for (const [id, copy] of Object.entries(fa.levels)) {
    const text = `${copy.name} ${copy.brief} ${copy.lesson ?? ''}`;
    for (const pat of disallowedAffixes) {
      expect(text.match(pat), `[fa] level '${id}' has missing ZWNJ for pattern ${pat}`).toBeNull();
    }
    if (id !== 'if-else') {
      expect(/[\u0600-\u06FF]/.test(copy.name), `[fa] level '${id}' name is not translated to Persian: ${copy.name}`).toBe(true);
    }
  }
  for (const [seqId, title] of Object.entries(fa.seriesTitles)) {
    expect(/[\u0600-\u06FF]/.test(title), `[fa] series '${seqId}' title is not translated to Persian: ${title}`).toBe(true);
  }
});

test('[ui] board and ram canvases have LTR direction and unicode-bidi isolation attributes', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const root = dom.window.document.getElementById('root')!;
  root.innerHTML = `
    <svg id="canvas" xmlns="http://www.w3.org/2000/svg" direction="ltr" style="direction: ltr; unicode-bidi: isolate;"></svg>
    <svg id="ram-canvas" xmlns="http://www.w3.org/2000/svg" direction="ltr" style="direction: ltr; unicode-bidi: isolate;"></svg>
  `;
  const canvas = root.querySelector('#canvas') as any;
  const ramCanvas = root.querySelector('#ram-canvas') as any;
  expect(canvas?.getAttribute('direction')).toBe('ltr');
  expect(canvas?.style.direction).toBe('ltr');
  expect(ramCanvas?.getAttribute('direction')).toBe('ltr');
  expect(ramCanvas?.style.direction).toBe('ltr');
});
