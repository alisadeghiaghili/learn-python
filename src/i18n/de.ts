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
    bestStatements: (n) => `Bestwert: ${n} Statement${n === 1 ? '' : 's'}`,
    parStatements: (n) => `Par ${n} Statement${n === 1 ? '' : 's'}`,

    usageLevel: 'Aufruf: level <id>   z.B. level first-name',
    unknownLevel: (id) => `Unbekanntes Level: ${id}`,
    guideRight: 'Der Live-Leitfaden ist immer an der Seite.',
    hintsLevelsOnly: 'Tipps gibt es nur im Level-Modus.',
    metaSolution: (s) => `Lösung:\n${s}`,
    nothingToUndo: 'Nichts rückgängig zu machen.',
    undid: 'Letztes Statement rückgängig gemacht.',
    envReset: 'Umgebung zurückgesetzt.',
    unknownCommand: (c) => `Unbekannter Befehl: ${c}`,
    golf: (used, par) => `Statements: ${used} · Par: ${par}`,
    metaHint: (h) => `Tipp: ${h}`,

    levelsTitle: 'Level',
    levelsIntro:
      'Wähle eine Herausforderung. Neu hier? Fang oben an — <strong>▶ Hello, world</strong> — und arbeite dich nach unten. Der Kurs baut von einfachem Python über das Speichermodell bis zu den Bibliotheken auf.',
    howToRead: 'So liest du',
    legendPar: 'ideale Anzahl an Statements',
    legendSolved: 'gelöst, beste Statements',
    legendDifficulty: 'Schwierigkeit, 1–5',
    legendStart: 'hier starten, wenn du neu bist',
    deepLessonBtn: 'Tiefe Lektion',
    deepLessonTitle: (title) => `Die komplette ${title}-Lektion lesen (ELI5→ELI-PHD)`,
    close: 'Schließen',
    closePrimary: 'Schließen',

    whatThisTeaches: 'Was das lehrt',
    inProduction: 'In der Produktion',
    hintColon: 'Tipp:',
    deepLessonAction: 'Tiefe Lektion',
    deepLessonModalTitle: (title) => `${title} — tiefe Lektion`,

    helpTitle: 'Hilfe',
    helpBody: `### Befehlsreferenz

| Befehl | Wirkung |
|---|---|
| \`levels\` | Level-Katalog öffnen |
| \`lesson\` | Aktuelles Level erklären |
| \`hint\` | Tipp des Levels zeigen |
| \`solution\` | Ziellösung zeigen |
| \`undo\` | Letztes Statement entfernen |
| \`reset\` | Umgebung leeren |
| \`sandbox\` | Offenen Sandbox-Modus öffnen |
| \`clear\` | Konsolen-Protokoll leeren |
| \`script\` | Mehrzeiliger Skript-Editor ein/aus |
| \`local\` | Anleitung zur lokalen Python-Einrichtung |

### Ausführung
- Tippe an der Konsolen-Aufforderung und drücke **Enter**.
- **Tab** wechselt durch Autovervollständigungen.
- **Alt + -** fügt ein Leerzeichen um \` = \` ein.
- Drücke im Skript-Editor **Strg / Cmd + Enter**, um auszuführen.
`,

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
    golfOnPar: 'auf Par',
    golfStatements: (n, par) => `${n} Statements (Par ${par})`,
    celebrateTitle: 'Level geschafft',
    celebrateBadge: 'Level klar',
    celebrateNext: (name) => `Als Nächstes: **${name}**`,
    celebrateEnd: 'Du bist am Ende dieses Pakets angelangt.',
    celebrateStats: (n, par) => `${n} Statement${n === 1 ? '' : 's'} · Par ${par}`,
    keepGoing: 'Weitermachen',
    nextAction: (name) => `Weiter: ${name}`,
    browseLevels: 'Level durchsuchen',
  },
  seriesTitles: { ...deG1.seriesTitles, ...deG2.seriesTitles, ...deG3.seriesTitles, ...deG4.seriesTitles, ...deG5.seriesTitles },
  deepLessons: { ...deG1.deepLessons, ...deG2.deepLessons, ...deG3.deepLessons, ...deG4.deepLessons, ...deG5.deepLessons },
  levels: { ...deG1.levels, ...deG2.levels, ...deG3.levels, ...deG4.levels, ...deG5.levels },
};
