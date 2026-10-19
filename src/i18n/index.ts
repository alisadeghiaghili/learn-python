/** Locale runtime: detect, persist, switch, and apply document direction,
 *  plus per-level and per-series copy overlays. Mirrors learn-dvc's i18n.
 */

import type { Catalog, LevelCopy, Locale, UiCopy } from './types';
import { LOCALES } from './types';
export { LOCALES };
export type { Locale, LevelCopy, UiCopy, Catalog };

import type { Level, Sequence } from '../engine/types';
import { en } from './en';
import { de } from './de';
import { fa } from './fa';

const STORAGE_KEY = 'learnpython-locale';

const catalogs: Record<Locale, Catalog> = { en, de, fa };

let current: Locale = 'en';

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as string[]).includes(v);
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* private mode */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  if (nav.toLowerCase().startsWith('de')) return 'de';
  if (nav.toLowerCase().startsWith('fa') || nav.toLowerCase().startsWith('pe')) return 'fa';
  return 'en';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  applyDocumentLocale();
}

export function getDir(): 'ltr' | 'rtl' {
  return catalogs[current].dir;
}

export function applyDocumentLocale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.documentElement.dir = getDir();
}

/** Set the initial locale from storage/navigator. Call once at boot. */
export function initLocale(): Locale {
  current = detectLocale();
  applyDocumentLocale();
  return current;
}

/** The active UI chrome copy. */
export function ui(): UiCopy {
  return catalogs[current].ui;
}

/** Overlay localized teaching copy onto a level. Never touches structural
 *  fields (`hint`, `solution`, `start`, `goal`). */
export function localizeLevel(level: Level): Level {
  if (current === 'en') return level;
  const copy = catalogs[current].levels[level.id];
  if (!copy) return level;
  return {
    ...level,
    name: copy.name,
    brief: copy.brief,
    learning: copy.learning ?? level.learning,
    fieldNotes: copy.fieldNotes ?? level.fieldNotes,
    lesson: copy.lesson ?? level.lesson,
  };
}

/** Localize a series' title + deep lesson (for the levels list + deep modal). */
export function localizeSequence(seq: Sequence): Sequence {
  if (current === 'en') return seq;
  const cat = catalogs[current];
  return {
    ...seq,
    title: cat.seriesTitles[seq.id] ?? seq.title,
    levels: seq.levels.map((l) => {
      const copy = cat.levels[l.id];
      return copy ? { ...l, name: copy.name, brief: copy.brief } : l;
    }),
    deepLesson: cat.deepLessons[seq.id] ?? seq.deepLesson,
  };
}
