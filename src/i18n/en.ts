/** English base catalog. Teaching copy lives in the series files; this holds
 *  only the UI chrome. `levels`/`seriesTitles`/`deepLessons` are empty for EN —
 *  the EN source text is the series files themselves.
 */

import type { Catalog } from './types';

export const en: Catalog = {
  locale: 'en',
  dir: 'ltr',
  ui: {
    menuLabel: 'Menu',
    language: 'Language',
    levels: 'Levels',
    lesson: 'Lesson',
    lessonTitle: "Replay this level's lesson",
    guide: 'Guide',
    hint: 'Hint',
    solution: 'Solution',
    undo: 'Undo',
    reset: 'Reset',
    sandboxBtn: 'Sandbox',
    help: 'Help',
    visitorsTitle: 'Unique visitors',
    githubTitle: 'GitHub repository',
    support: 'Support',
    supportTitle: 'Buy me a coffee',
    titleLine: (idx, name) => `Level ${idx} · ${name}`,
    sandboxTitle: 'Sandbox',

    sandboxWelcome: 'learnpython sandbox. Type Python statements, or `help`.',
    levelMeta: (name) => `Level: ${name}`,

    dockSandboxTitle: 'Sandbox',
    dockSandboxObjective:
      'Type Python to mutate the memory graph. Names sit on the stack; mutables live on the heap; amber edges are references.',
    dockStartHere: 'Start here',
    dockStartHereItems: [
      '`a = [1]` — a name pointing at a heap list',
      '`b = a` — two names, one object (aliasing)',
      '`a.append(2)` — mutate the shared object in place',
    ],
    dockNoActiveLevel: 'No active level',
    dockNoActiveLevelDetail: 'Pick a level from the menu to start checking goals.',
    nextTitle: 'Next',
    allChecksPassed: 'All checks passed.',
    tryLabel: 'try',
    nowChip: 'now',
    hintLabel: 'Hint:',
    bestStatements: (n) => `Best: ${n} statement${n === 1 ? '' : 's'}`,
    parStatements: (n) => `Par ${n} statement${n === 1 ? '' : 's'}`,

    usageLevel: 'Usage: level <id>   e.g. level first-name',
    unknownLevel: (id) => `Unknown level: ${id}`,
    guideRight: 'The live guide is on the right.',
    hintsLevelsOnly: 'Hints are available in levels mode.',
    metaSolution: (s) => `Solution:\n${s}`,
    nothingToUndo: 'Nothing to undo.',
    undid: 'Undid last statement.',
    envReset: 'Environment reset.',
    unknownCommand: (c) => `Unknown command: ${c}`,
    golf: (used, par) => `statements: ${used} · par: ${par}`,
    metaHint: (h) => `Hint: ${h}`,

    levelsTitle: 'Levels',
    levelsIntro:
      'Pick a challenge. New here? Start at the top — <strong>▶ Hello, world</strong> — and work down. The course builds from plain Python up to the memory model, then the libraries.',
    howToRead: 'How to read',
    legendPar: 'ideal number of statements',
    legendSolved: 'solved, best statements',
    legendDifficulty: 'difficulty, 1–5',
    legendStart: 'start here if you are new',
    deepLessonBtn: 'deep lesson',
    deepLessonTitle: (title) => `Read the full ${title} lesson (ELI5→ELI-PHD)`,
    close: 'Close',
    closePrimary: 'Close',

    whatThisTeaches: 'What this teaches',
    inProduction: 'In production',
    hintColon: 'Hint:',
    deepLessonAction: 'Deep lesson',
    deepLessonModalTitle: (title) => `${title} — deep lesson`,

    helpTitle: 'Help',
    helpBody: `### Command Reference

| Command | Effect |
|---|---|
| \`levels\` | Open the level catalog |
| \`lesson\` | Explain the current level |
| \`hint\` | Reveal the level hint |
| \`solution\` | Show the target solution |
| \`undo\` | Remove the last statement |
| \`reset\` | Clear the environment |
| \`sandbox\` | Enter open sandbox mode |
| \`clear\` | Clear the console log |
| \`script\` | Toggle the multi-line script editor |
| \`local\` | Local Python setup guide |

### Execution
- Type in the console prompt and press **Enter**.
- **Tab** cycles through autocomplete suggestions.
- **Alt + -** inserts a spaced \` = \`.
- Press **Ctrl / Cmd + Enter** in the script editor to run.
`,

    welcomeTitle: 'Welcome to learnpython',
    welcomeBody: `Learn Python **from zero**, one small step at a time — and watch it work.

You start where every Python program starts: \`print("Hello, world!")\`. Then you save a value, do a little math, make a decision with \`if\`, and repeat a block with \`for\`. No prior Python needed.

Only once you can write real Python does the course show *how the computer holds your data* — names, objects, and the references between them, drawn live on the **Memory** canvas.

- **Memory tab** — the live object graph (stack frames, heap objects, amber reference edges).
- **Plot tab** — for the plotting levels.
- **Dock** — the always-on guide with a per-check checklist.
- **Step bar** — after a run, ⏮ ◀ ▶ ⏭ scrub the run so you can *watch a loop* one step at a time.
`,
    sandboxAction: 'Sandbox',
    openLevelsAction: 'Open levels',

    okLevelComplete: (golf) => `Level complete — ${golf}.`,
    golfOnPar: 'on par',
    golfStatements: (n, par) => `${n} statements (par ${par})`,
    celebrateTitle: 'Level complete',
    celebrateBadge: 'Level clear',
    celebrateNext: (name) => `Up next: **${name}**`,
    celebrateEnd: 'You reached the end of this pack.',
    celebrateStats: (n, par) => `${n} statement${n === 1 ? '' : 's'} · par ${par}`,
    keepGoing: 'Keep going',
    nextAction: (name) => `Next: ${name}`,
    browseLevels: 'Browse levels',
  },
  levels: {},
  seriesTitles: {},
  deepLessons: {},
};
