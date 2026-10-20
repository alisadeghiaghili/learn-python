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

const DEEP_LESSON_BANNERS = ['## ELI5', '## ELI10', '## ELI15', '## ELI20'];

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
