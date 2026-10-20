/** Locale + copy shapes for learn-python.
 *
 * Commands, `solution` and `start` source, and the goal spec stay English —
 * they are structural. Only display copy (UI chrome, level teaching text,
 * series titles and deep lessons) is localized.
 */

export type Locale = 'en' | 'de' | 'fa';

export const LOCALES: Locale[] = ['en', 'de', 'fa'];

/** Teaching copy for one translation group (a batch of series files). The
 *  per-language catalogs (de.ts / fa.ts) spread these together. */
export interface LevelGroup {
  seriesTitles: Record<string, string>;
  deepLessons: Record<string, string>;
  levels: Record<string, LevelCopy>;
}

/** Display copy for one level (English stays authoritative in the series files). */
export interface LevelCopy {
  name: string;
  /** One-line objective shown in the dock. */
  brief: string;
  /** "You are learning" bullets. */
  learning?: string[];
  /** "In production" field notes. */
  fieldNotes?: string[];
  /** Full markdown lesson. */
  lesson?: string;
}

/** UI chrome — toolbar, terminal, dock, modals. */
export interface UiCopy {
  // —— toolbar
  menuLabel: string;
  language: string;
  levels: string;
  lesson: string;
  lessonTitle: string;
  guide: string;
  hint: string;
  solution: string;
  undo: string;
  reset: string;
  sandboxBtn: string;
  help: string;
  visitorsTitle: string;
  githubTitle: string;
  support: string;
  supportTitle: string;
  titleLine: (idx: number, name: string) => string;
  sandboxTitle: string;

  // —— terminal meta
  sandboxWelcome: string;
  levelMeta: (name: string) => string;

  // —— dock
  dockSandboxTitle: string;
  dockSandboxObjective: string;
  dockStartHere: string;
  dockStartHereItems: string[];
  dockNoActiveLevel: string;
  dockNoActiveLevelDetail: string;
  nextTitle: string;
  allChecksPassed: string;
  tryLabel: string;
  nowChip: string;
  hintLabel: string;
  bestSoFar: (best: number, par: number) => string;
  idealSolution: (par: number) => string;
  youAreLearning: string;
  fieldNotesTitle: string;

  // —— meta commands (typed in the terminal)
  usageLevel: string;
  unknownLevel: (id: string) => string;
  guideRight: string;
  hintsLevelsOnly: string;
  metaSolution: (s: string) => string;
  nothingToUndo: string;
  undid: string;
  envReset: string;
  unknownCommand: (c: string) => string;
  golf: (used: number, par: number) => string;
  metaHint: (h: string) => string;

  // —— levels modal
  levelsTitle: string;
  levelsIntro: string;
  howToRead: string;
  legendPar: string;
  legendSolved: string;
  legendDifficulty: string;
  legendStart: string;
  deepLessonBtn: string;
  deepLessonTitle: (title: string) => string;
  close: string;
  closePrimary: string;

  // —— lesson modal
  whatThisTeaches: string;
  inProduction: string;
  hintColon: string;
  deepLessonAction: string;
  deepLessonModalTitle: (title: string) => string;

  // —— help modal
  helpTitle: string;
  helpBody: string;

  // —— welcome modal
  welcomeTitle: string;
  welcomeBody: string;
  sandboxAction: string;
  openLevelsAction: string;

  // —— level clear
  okLevelComplete: (golf: string) => string;
  golfOnPar: string;
  golfStatements: (n: number, par: number) => string;
  celebrateTitle: string;
  celebrateBadge: string;
  celebrateNext: (name: string) => string;
  celebrateEnd: string;
  celebrateStats: (n: number, par: number) => string;
  keepGoing: string;
  nextAction: (name: string) => string;
  browseLevels: string;
}

export interface Catalog {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  ui: UiCopy;
  /** Per-level display copy, keyed by level id. */
  levels: Record<string, LevelCopy>;
  /** Series id → localized series title. */
  seriesTitles: Record<string, string>;
  /** Series id → localized deep-lesson markdown. */
  deepLessons: Record<string, string>;
}
