/** German catalog. UI chrome here; teaching copy (levels, series titles, deep
 *  lessons) comes from the de-gN group files. Commands & CLI stay English.
 */

import type { Catalog } from './types';
import { deG1 } from './de-g1';
import { deG2 } from './de-g2';
import { deG3 } from './de-g3';
import { deG4 } from './de-g4';
import { deG5 } from './de-g5';

export const de: Catalog = {
  locale: 'de',
  dir: 'ltr',
  ui: {
    menuLabel: 'Menü',
    language: 'Sprache',
    levels: 'Level',
    lesson: 'Lektion',
    lessonTitle: "Lektion dieses Levels erneut abspielen",
    guide: 'Leitfaden',
    hint: 'Tipp',
    solution: 'Lösung',
    undo: 'Rückgängig',
    reset: 'Zurücksetzen',
    sandboxBtn: 'Sandbox',
    help: 'Hilfe',
    visitorsTitle: 'Eindeutige Besucher',
    githubTitle: 'GitHub-Repository',
    support: 'Unterstützen',
    supportTitle: 'Kaffee spendieren',
    titleLine: (idx, name) => `Level ${idx} · ${name}`,
    sandboxTitle: 'Sandbox',
    eliBands: {
      eli5: 'Anfänger',
      eli10: 'Grundstufe',
      eli15: 'Mittelstufe',
      eli20: 'Fortgeschritten',
      eliphd: 'Meister',
    },

    sandboxWelcome: 'learnpython-Sandbox. Tippe Python-Statements ein, oder `help`.',
    levelMeta: (name) => `Level: ${name}`,

    dockSandboxTitle: 'Sandbox',
    dockSandboxObjective:
      'Tippe Python, um den Speichergraphen zu verändern. Namen sitzen auf dem Stack; veränderbare Objekte liegen im Heap; bernsteinfarbene Kanten sind Referenzen.',
    dockStartHere: 'Hier starten',
    dockStartHereItems: [
      '`a = [1]` — ein Name, der auf eine Heap-Liste zeigt',
      '`b = a` — zwei Namen, ein Objekt (Aliasing)',
      '`a.append(2)` — das gemeinsame Objekt an Ort und Stelle verändern',
    ],
    dockNoActiveLevel: 'Kein aktives Level',
    dockNoActiveLevelDetail: 'Wähle ein Level aus dem Menü, um die Zielprüfung zu starten.',
    nextTitle: 'Nächste',
    allChecksPassed: 'Alle Prüfungen bestanden.',
    tryLabel: 'probier',
    nowChip: 'jetzt',
    hintLabel: 'Tipp:',
    bestSoFar: (best, par) => `Bester Stand: ${best} Befehl${best === 1 ? '' : 'e'} · ideal: ${par}`,
    idealSolution: (par) => `Ideale Lösung: ${par} Befehl${par === 1 ? '' : 'e'} (weniger oder gleich ist ausgezeichnet)`,
    youAreLearning: 'Du lernst gerade',
    fieldNotesTitle: 'In der Praxis (Feldnotizen)',

    usageLevel: 'Aufruf: level <id>   z.B. level first-name',
    unknownLevel: (id) => `Unbekanntes Level: ${id}`,
    guideRight: 'Der Live-Leitfaden ist immer an der Seite.',
    hintsLevelsOnly: 'Tipps gibt es nur im Level-Modus.',
    metaSolution: (s) => `Lösung:\n${s}`,
    nothingToUndo: 'Nichts rückgängig zu machen.',
    undid: 'Letztes Statement rückgängig gemacht.',
    envReset: 'Umgebung zurückgesetzt.',
    unknownCommand: (c) => `Unbekannter Befehl: ${c}`,
    golf: (used, par) => `Befehle: ${used} · ideal: ${par}`,
    metaHint: (h) => `Tipp: ${h}`,

    levelsTitle: 'Level',
    levelsIntro:
      'Wähle eine Herausforderung. Neu hier? Fang oben an — <strong>▶ Hello, world</strong> — und arbeite dich nach unten. Der Kurs baut von einfachem Python über das Speichermodell bis zu den Bibliotheken auf.',
    howToRead: 'So liest du',
    legendPar: 'ideale Befehlzahl',
    legendSolved: 'gelöst, beste Befehle',
    legendDifficulty: 'Schwierigkeit, 1–5',
    legendStart: 'hier starten, wenn du neu bist',
    deepLessonBtn: 'Tiefe Lektion',
    deepLessonTitle: (title) => `Die komplette ${title}-Lektion lesen (Beginner→Master)`,
    close: 'Schließen',
    closePrimary: 'Schließen',

    whatThisTeaches: 'Was das lehrt',
    inProduction: 'In der Produktion',
    hintColon: 'Tipp:',
    deepLessonAction: 'Tiefe Lektion',
    deepLessonModalTitle: (title) => `${title} — tiefe Lektion`,

    uiGuideTitle: 'UI-Führer — was jeder Teil macht',
    uiHelpMapTitle: 'Seitenplan — was jeder UI-Bereich tut',
    uiHelpCommands: 'Befehle: `help` · `levels` · `lesson` · `hint` · `solution` · `undo` · `reset`',
    highlightThis: 'Hervorheben',
    useIt: 'Nutzung:',
    helpSections: [
      {
        id: 'level-title',
        selector: '.level-title',
        title: 'Aktuelle Level-Leiste',
        what: 'Zeigt die Level-Nummer und den Namen, z. B. **Level 1 · Hello, world**.',
        how: 'Lies sie, um zu sehen, wo du im Kurs bist.',
      },
      {
        id: 'menu',
        selector: '.nav-toggle',
        title: 'Menü (≡)',
        what:
          'Öffnet die Aktionstasten: **Level** (der gesamte Katalog), **Lektion** (Lehre dieses Levels erneut abspielen), **Leitfaden**, **Tipp**, **Lösung**, **Rückgängig**, **Zurücksetzen**, **Sandbox** und **Hilfe** (dieser Führer).',
        how: 'Tippe darauf, um die Tasten zu zeigen — **Level** ist die komplette Kurskarte.',
      },
      {
        id: 'board',
        selector: '.board-tabs',
        title: 'Board-Tabs — Memory / Plot / RAM',
        what:
          'Drei Linsen auf denselben Lauf: **Memory** ist der Live-Objektgraph (Stack-Frames, Heap, bernsteinfarbene Referenzkanten), **RAM** die Speicherkarte (Adressen, Bytes, Referenzzahlen), **Plot** für die Plotting-Level.',
        how: 'Wechsle die Tabs, um dasselbe aus einem anderen Winkel zu sehen.',
      },
      {
        id: 'canvas',
        selector: '.board-body',
        title: 'Das Canvas',
        what: 'Dort, wo Python vor deinen Augen läuft: Namen, Objekte und die Referenzen zwischen ihnen, live gezeichnet.',
        how: 'Beobachte es nach jedem Statement.',
      },
      {
        id: 'step',
        selector: '#step-bar',
        title: 'Schritt-Leiste — eine Schleife sehen',
        what: 'Nach einem Lauf ⏮ ◀ ▶ ⏭ das Programm auf dem Canvas Schritt für Schritt abspielen.',
        how: 'Auf den Schleifen-Level `for` / `while` über die Daten laufen sehen.',
      },
      {
        id: 'terminal',
        selector: '#terminal',
        title: 'Konsole',
        what:
          'Tippe Python hier ein und drücke **Enter**. **Tab** vervollständigt; die Konsole nimmt auch Meta-Befehle wie `levels`, `hint`, `solution`, `undo`, `reset` an.',
        how: 'Hier löst du das Level tatsächlich.',
      },
      {
        id: 'dock',
        selector: '.dock',
        title: 'Leitfaden-Panel (rechts, immer sichtbar)',
        what:
          'Der Live-Begleiter: was du lernst, Feldnotizen, die ideale Befehlzahl und eine Schritt-für-Schritt-Checkliste mit dem aktuellen, hervorgehobenen Schritt.',
        how: 'Behalte es beim Tippen im Blick; **Tipp** gibt Hilfe, wenn du feststeckst.',
      },
      {
        id: 'links',
        selector: 'a.tb-link',
        title: 'GitHub & Unterstützung',
        what: 'Quellcode-Repository und die Buy-Me-A-Coffee-Seite des Verfassers.',
        how: 'Beide öffnen sich in einem neuen Tab.',
      },
    ],

    welcomeTitle: 'Willkommen bei learnpython',
    welcomeBody: `Lerne Python **von null** — einen kleinen Schritt nach dem anderen — und sieh es arbeiten.

Du beginnst, wo jedes Python-Programm beginnt: \`print("Hello, world!")\`. Dann speicherst du einen Wert, rechnest ein wenig, triffst eine Entscheidung mit \`if\` und wiederholst einen Block mit \`for\`. Kein Python-Vorwissen nötig.

Erst wenn du echtes Python schreiben kannst, zeigt der Kurs *wie der Computer deine Daten hält* — Namen, Objekte und die Referenzen zwischen ihnen, live auf dem **Memory**-Kanal gezeichnet.

- **Memory-Kanal** — der Live-Objektgraph (Stack-Frames, Heap-Objekte, bernsteinfarbene Referenzkanten).
- **Plot-Kanal** — für die Plotting-Level.
- **Leitfaden** — die immer-sichtbare Anleitung mit einer Checkliste pro Prüfung.
- **Schritt-Leiste** — nach einer Ausführung mit ⏮ ◀ ▶ ⏭ durch den Lauf wischen, um eine *Schleife* Schritt für Schritt zu sehen.
`,
    sandboxAction: 'Sandbox',
    openLevelsAction: 'Level öffnen',

    okLevelComplete: (golf) => `Level geschafft — ${golf}.`,
    golfOnPar: 'auf oder unter dem Idealwert',
    golfStatements: (n, par) => `${n} Befehl${n === 1 ? '' : 'e'} (ideal ${par})`,
    celebrateTitle: 'Level geschafft',
    celebrateBadge: 'Level klar',
    celebrateNext: (name) => `Als Nächstes: **${name}**`,
    celebrateEnd: 'Du bist am Ende dieses Pakets angelangt.',
    celebrateStats: (n, par) => `${n} Befehl${n === 1 ? '' : 'e'} · ideal ${par}`,
    keepGoing: 'Weitermachen',
    nextAction: (name) => `Weiter: ${name}`,
    browseLevels: 'Level durchsuchen',
  },
  seriesTitles: { ...deG1.seriesTitles, ...deG2.seriesTitles, ...deG3.seriesTitles, ...deG4.seriesTitles, ...deG5.seriesTitles },
  deepLessons: { ...deG1.deepLessons, ...deG2.deepLessons, ...deG3.deepLessons, ...deG4.deepLessons, ...deG5.deepLessons },
  levels: { ...deG1.levels, ...deG2.levels, ...deG3.levels, ...deG4.levels, ...deG5.levels },
};
